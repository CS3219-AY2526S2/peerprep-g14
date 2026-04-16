package executor

import (
	"archive/tar"
	"bufio"
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"log"
	"strings"
	"time"

	"github.com/docker/docker/api/types/container"
	imagetypes "github.com/docker/docker/api/types/image"
	"github.com/docker/docker/api/types/mount"
	"github.com/docker/docker/client"
	"github.com/docker/docker/pkg/stdcopy"
)

const (
	executionTimeout = 30 * time.Second
	maxOutputBytes   = 10 * 1024 // 10KB cap
	maxConcurrent    = 5
)

// TestCaseResult holds the result of a single test case execution.
type TestCaseResult struct {
	TestCase int    `json:"testCase"`
	Passed   bool   `json:"passed"`
	Actual   string `json:"actual"`
	Expected string `json:"expected"`
	Error    string `json:"error,omitempty"`
}

// ExecuteResponse is the full response returned from code execution.
type ExecuteResponse struct {
	Results []TestCaseResult `json:"results"`
	Stdout  string           `json:"stdout"`
	Stderr  string           `json:"stderr"`
}

// Executor manages Docker-based code execution.
type Executor struct {
	cli       *client.Client
	semaphore chan struct{}
}

// NewExecutor creates a new Executor with a Docker client.
func NewExecutor() (*Executor, error) {
	cli, err := client.NewClientWithOpts(client.FromEnv, client.WithAPIVersionNegotiation())
	if err != nil {
		return nil, fmt.Errorf("failed to create Docker client: %w", err)
	}

	return &Executor{
		cli:       cli,
		semaphore: make(chan struct{}, maxConcurrent),
	}, nil
}

// Execute runs user code against the given test cases in a sandboxed container.
func (e *Executor) Execute(code string, language string, testCases []TestCase) (*ExecuteResponse, error) {
	// Acquire semaphore slot
	e.semaphore <- struct{}{}
	defer func() { <-e.semaphore }()

	// Generate runner script
	runner, err := GenerateRunner(language, code, testCases)
	if err != nil {
		return nil, fmt.Errorf("failed to generate runner: %w", err)
	}

	// Pull image if not present locally (separate generous timeout for first-time pulls)
	pullCtx, pullCancel := context.WithTimeout(context.Background(), 5*time.Minute)
	defer pullCancel()
	if err := e.ensureImage(pullCtx, runner.Image); err != nil {
		return nil, fmt.Errorf("failed to pull image %s: %w", runner.Image, err)
	}

	// Create and run container
	ctx, cancel := context.WithTimeout(context.Background(), executionTimeout+5*time.Second)
	defer cancel()

	containerConfig := &container.Config{
		Image:           runner.Image,
		Cmd:             runner.Cmd,
		WorkingDir:      "/code",
		NetworkDisabled: true,
		Tty:             false,
	}

	hostConfig := &container.HostConfig{
		Resources: container.Resources{
			Memory:   512 * 1024 * 1024, // 512MB (Go/Java compilers need more)
			NanoCPUs: 1000000000,        // 1 CPU
		},
		ReadonlyRootfs: false, // some language runtimes need write access
		Mounts: []mount.Mount{
			{
				Type:   mount.TypeTmpfs,
				Target: "/tmp",
				TmpfsOptions: &mount.TmpfsOptions{
					SizeBytes: 64 * 1024 * 1024, // 64MB tmpfs
				},
			},
		},
	}

	resp, err := e.cli.ContainerCreate(ctx, containerConfig, hostConfig, nil, nil, "")
	if err != nil {
		return nil, fmt.Errorf("failed to create container: %w", err)
	}
	containerID := resp.ID

	// Copy runner script into container via docker cp (avoids bind mount host-path issues)
	if err := copyToContainer(ctx, e.cli, containerID, "/code/"+runner.FileName, runner.Code); err != nil {
		return nil, fmt.Errorf("failed to copy runner to container: %w", err)
	}

	// Ensure cleanup
	defer func() {
		removeCtx, removeCancel := context.WithTimeout(context.Background(), 5*time.Second)
		defer removeCancel()
		if err := e.cli.ContainerRemove(removeCtx, containerID, container.RemoveOptions{Force: true}); err != nil {
			log.Printf("warning: failed to remove container %s: %v", containerID[:12], err)
		}
	}()

	// Start container
	if err := e.cli.ContainerStart(ctx, containerID, container.StartOptions{}); err != nil {
		return nil, fmt.Errorf("failed to start container: %w", err)
	}

	// Wait for container to finish with timeout
	waitCtx, waitCancel := context.WithTimeout(context.Background(), executionTimeout)
	defer waitCancel()

	statusCh, errCh := e.cli.ContainerWait(waitCtx, containerID, container.WaitConditionNotRunning)
	select {
	case err := <-errCh:
		if err != nil {
			// Timeout or error — kill the container
			killCtx, killCancel := context.WithTimeout(context.Background(), 3*time.Second)
			defer killCancel()
			_ = e.cli.ContainerKill(killCtx, containerID, "KILL")
			return &ExecuteResponse{
				Results: makeTimeoutResults(testCases),
				Stderr:  "Execution timed out (10 second limit)",
			}, nil
		}
	case status := <-statusCh:
		if status.StatusCode != 0 {
			// Non-zero exit — collect stderr for error info
			stdout, stderr := e.collectLogs(containerID)
			return &ExecuteResponse{
				Results: parseResults(stdout, testCases),
				Stdout:  truncate(stdout, maxOutputBytes),
				Stderr:  truncate(stderr, maxOutputBytes),
			}, nil
		}
	}

	// Collect logs
	stdout, stderr := e.collectLogs(containerID)

	return &ExecuteResponse{
		Results: parseResults(stdout, testCases),
		Stdout:  truncate(stdout, maxOutputBytes),
		Stderr:  truncate(stderr, maxOutputBytes),
	}, nil
}

func (e *Executor) collectLogs(containerID string) (string, string) {
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	logReader, err := e.cli.ContainerLogs(ctx, containerID, container.LogsOptions{
		ShowStdout: true,
		ShowStderr: true,
	})
	if err != nil {
		return "", fmt.Sprintf("failed to read logs: %v", err)
	}
	defer logReader.Close()

	var stdoutBuf, stderrBuf bytes.Buffer
	_, err = stdcopy.StdCopy(&stdoutBuf, &stderrBuf, logReader)
	if err != nil {
		// Fallback: read raw
		raw, _ := io.ReadAll(logReader)
		return string(raw), ""
	}

	return stdoutBuf.String(), stderrBuf.String()
}

// ensureImage pulls the image if it is not already available locally.
func (e *Executor) ensureImage(ctx context.Context, image string) error {
	_, _, err := e.cli.ImageInspectWithRaw(ctx, image)
	if err == nil {
		return nil // image already exists
	}
	log.Printf("Pulling image %s ...", image)
	reader, err := e.cli.ImagePull(ctx, "docker.io/library/"+image, imagetypes.PullOptions{})
	if err != nil {
		return err
	}
	defer reader.Close()
	// Drain the pull output to wait for completion
	_, _ = io.Copy(io.Discard, reader)
	return nil
}

// copyToContainer creates a tar archive with a single file and copies it into the container.
func copyToContainer(ctx context.Context, cli *client.Client, containerID string, destPath string, content string) error {
	var buf bytes.Buffer
	tw := tar.NewWriter(&buf)

	hdr := &tar.Header{
		Name: destPath,
		Mode: 0444,
		Size: int64(len(content)),
	}
	if err := tw.WriteHeader(hdr); err != nil {
		return err
	}
	if _, err := tw.Write([]byte(content)); err != nil {
		return err
	}
	if err := tw.Close(); err != nil {
		return err
	}

	return cli.CopyToContainer(ctx, containerID, "/", &buf, container.CopyToContainerOptions{})
}

// parseResults extracts TestCaseResult JSON lines from stdout.
func parseResults(stdout string, testCases []TestCase) []TestCaseResult {
	var results []TestCaseResult
	scanner := bufio.NewScanner(strings.NewReader(stdout))
	for scanner.Scan() {
		line := strings.TrimSpace(scanner.Text())
		if line == "" {
			continue
		}
		var result TestCaseResult
		if err := json.Unmarshal([]byte(line), &result); err != nil {
			continue // skip non-JSON lines
		}
		results = append(results, result)
	}

	// If no valid results parsed, create error results
	if len(results) == 0 && len(testCases) > 0 {
		for i := range testCases {
			results = append(results, TestCaseResult{
				TestCase: i + 1,
				Passed:   false,
				Expected: testCases[i].ExpectedOutput,
				Error:    "No output produced — code may have a compilation or runtime error",
			})
		}
	}

	return results
}

func makeTimeoutResults(testCases []TestCase) []TestCaseResult {
	results := make([]TestCaseResult, len(testCases))
	for i, tc := range testCases {
		results[i] = TestCaseResult{
			TestCase: i + 1,
			Passed:   false,
			Expected: tc.ExpectedOutput,
			Error:    "Execution timed out (10 second limit)",
		}
	}
	return results
}

func truncate(s string, maxBytes int) string {
	if len(s) <= maxBytes {
		return s
	}
	return s[:maxBytes] + "\n... (output truncated)"
}
