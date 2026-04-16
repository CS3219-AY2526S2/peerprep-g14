package handler

import (
	"encoding/json"
	"fmt"
	"io"
	"log"
	"net/http"
	"os"
	"strings"

	"github.com/gin-gonic/gin"
	"github.com/tgonet/peerprep-g14/services/code-execution-service/executor"
)

type Handler struct {
	QuestionServiceURL string
	Executor           *executor.Executor
}

type ExecuteRequest struct {
	Code       string `json:"code" binding:"required"`
	Language   string `json:"language" binding:"required"`
	QuestionID string `json:"questionId" binding:"required"`
}

type TestCase struct {
	ID             string                 `json:"_id,omitempty"`
	FunctionToCall string                 `json:"function_to_call"`
	InputParams    map[string]interface{} `json:"input_params"`
	QuestionID     string                 `json:"question_id"`
	ExpectedOutput string                 `json:"expected_output"`
}

var supportedLanguages = map[string]bool{
	"python":     true,
	"javascript": true,
	"typescript": true,
	"java":       true,
	"cpp":        true,
	"c++":        true,
	"c":          true,
	"go":         true,
}

func NewHandler() *Handler {
	questionServiceURL := os.Getenv("QUESTION_SERVICE_URL")
	if questionServiceURL == "" {
		questionServiceURL = "http://question-service:3002"
	}

	exec, err := executor.NewExecutor()
	if err != nil {
		log.Fatalf("Failed to create executor: %v", err)
	}

	return &Handler{
		QuestionServiceURL: questionServiceURL,
		Executor:           exec,
	}
}

func (h *Handler) PostExecute(c *gin.Context) {
	var req ExecuteRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid request: code, language, and questionId are required"})
		return
	}

	lang := strings.ToLower(req.Language)
	if lang == "c++" {
		lang = "cpp"
	}
	if !supportedLanguages[lang] {
		c.JSON(http.StatusBadRequest, gin.H{"error": fmt.Sprintf("Unsupported language: %s", req.Language)})
		return
	}

	// Fetch test cases from question service
	testCases, err := h.fetchTestCases(req.QuestionID)
	if err != nil {
		log.Printf("Failed to fetch test cases: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch test cases"})
		return
	}

	if len(testCases) == 0 {
		c.JSON(http.StatusNotFound, gin.H{"error": "No test cases found for this question"})
		return
	}

	// Convert handler TestCase to executor TestCase
	execTestCases := make([]executor.TestCase, len(testCases))
	for i, tc := range testCases {
		execTestCases[i] = executor.TestCase{
			FunctionToCall: tc.FunctionToCall,
			InputParams:    tc.InputParams,
			ExpectedOutput: tc.ExpectedOutput,
		}
	}

	// Execute code
	result, err := h.Executor.Execute(req.Code, lang, execTestCases)
	if err != nil {
		log.Printf("Execution error: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": fmt.Sprintf("Execution failed: %v", err)})
		return
	}

	c.JSON(http.StatusOK, result)
}

func (h *Handler) fetchTestCases(questionID string) ([]TestCase, error) {
	url := fmt.Sprintf("%s/testcases/%s", h.QuestionServiceURL, questionID)
	resp, err := http.Get(url)
	if err != nil {
		return nil, fmt.Errorf("failed to reach question service: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		body, _ := io.ReadAll(resp.Body)
		return nil, fmt.Errorf("question service returned %d: %s", resp.StatusCode, string(body))
	}

	var testCases []TestCase
	if err := json.NewDecoder(resp.Body).Decode(&testCases); err != nil {
		return nil, fmt.Errorf("failed to decode test cases: %w", err)
	}

	return testCases, nil
}
