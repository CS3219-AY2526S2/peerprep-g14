package executor

import (
	"encoding/json"
	"fmt"
	"sort"
	"strings"
)

// TestCase represents a single test case from the question service.
type TestCase struct {
	FunctionToCall string                 `json:"function_to_call"`
	InputParams    map[string]interface{} `json:"input_params"`
	ExpectedOutput string                 `json:"expected_output"`
}

// RunnerConfig holds the generated runner script and execution metadata.
type RunnerConfig struct {
	FileName string   // e.g. "runner.py"
	Code     string   // full runner script content
	Image    string   // Docker image to use
	Cmd      []string // command to run inside container
}

// sortedParamValues returns input_params values sorted by key name (param1, param2, ...).
func sortedParamValues(params map[string]interface{}) []interface{} {
	keys := make([]string, 0, len(params))
	for k := range params {
		keys = append(keys, k)
	}
	sort.Strings(keys)

	values := make([]interface{}, 0, len(keys))
	for _, k := range keys {
		values = append(values, params[k])
	}
	return values
}

// extractFuncName strips parentheses from function_to_call, e.g. "twoSum()" → "twoSum".
func extractFuncName(raw string) string {
	name := strings.TrimSpace(raw)
	name = strings.TrimSuffix(name, "()")
	name = strings.TrimSuffix(name, "(")
	return name
}

// formatPythonValue formats a Go value as a Python literal.
func formatPythonValue(v interface{}) string {
	switch val := v.(type) {
	case string:
		return fmt.Sprintf("%q", val)
	case float64:
		if val == float64(int64(val)) {
			return fmt.Sprintf("%d", int64(val))
		}
		return fmt.Sprintf("%v", val)
	case map[string]interface{}:
		// Handle MongoDB $numberLong
		if nl, ok := val["$numberLong"]; ok {
			return fmt.Sprintf("%v", nl)
		}
		b, _ := json.Marshal(val)
		return string(b)
	case []interface{}:
		parts := make([]string, len(val))
		for i, item := range val {
			parts[i] = formatPythonValue(item)
		}
		return "[" + strings.Join(parts, ", ") + "]"
	case bool:
		if val {
			return "True"
		}
		return "False"
	default:
		return fmt.Sprintf("%v", val)
	}
}

// formatJSValue formats a Go value as a JavaScript literal.
func formatJSValue(v interface{}) string {
	switch val := v.(type) {
	case string:
		return fmt.Sprintf("%q", val)
	case float64:
		if val == float64(int64(val)) {
			return fmt.Sprintf("%d", int64(val))
		}
		return fmt.Sprintf("%v", val)
	case map[string]interface{}:
		if nl, ok := val["$numberLong"]; ok {
			return fmt.Sprintf("%v", nl)
		}
		b, _ := json.Marshal(val)
		return string(b)
	case []interface{}:
		parts := make([]string, len(val))
		for i, item := range val {
			parts[i] = formatJSValue(item)
		}
		return "[" + strings.Join(parts, ", ") + "]"
	case bool:
		if val {
			return "true"
		}
		return "false"
	default:
		return fmt.Sprintf("%v", val)
	}
}

// formatJavaValue formats a Go value as a Java literal (as a String for simplicity).
func formatJavaValue(v interface{}) string {
	switch val := v.(type) {
	case string:
		return fmt.Sprintf("\"%s\"", val)
	case float64:
		if val == float64(int64(val)) {
			return fmt.Sprintf("%d", int64(val))
		}
		return fmt.Sprintf("%v", val)
	case map[string]interface{}:
		if nl, ok := val["$numberLong"]; ok {
			return fmt.Sprintf("%v", nl)
		}
		return fmt.Sprintf("\"%v\"", val)
	case []interface{}:
		parts := make([]string, len(val))
		for i, item := range val {
			parts[i] = formatJavaValue(item)
		}
		return "new int[]{" + strings.Join(parts, ", ") + "}"
	default:
		return fmt.Sprintf("%v", val)
	}
}

// formatCppValue formats a Go value as a C++ literal string.
func formatCppValue(v interface{}) string {
	switch val := v.(type) {
	case string:
		return fmt.Sprintf("\"%s\"", val)
	case float64:
		if val == float64(int64(val)) {
			return fmt.Sprintf("%d", int64(val))
		}
		return fmt.Sprintf("%v", val)
	case map[string]interface{}:
		if nl, ok := val["$numberLong"]; ok {
			return fmt.Sprintf("%v", nl)
		}
		return fmt.Sprintf("%v", val)
	case []interface{}:
		parts := make([]string, len(val))
		for i, item := range val {
			parts[i] = formatCppValue(item)
		}
		return "vector<int>{" + strings.Join(parts, ", ") + "}"
	default:
		return fmt.Sprintf("%v", val)
	}
}

// formatGoValue formats a Go value as a Go literal.
func formatGoValue(v interface{}) string {
	switch val := v.(type) {
	case string:
		return fmt.Sprintf("%q", val)
	case float64:
		if val == float64(int64(val)) {
			return fmt.Sprintf("%d", int64(val))
		}
		return fmt.Sprintf("%v", val)
	case map[string]interface{}:
		if nl, ok := val["$numberLong"]; ok {
			return fmt.Sprintf("%v", nl)
		}
		return fmt.Sprintf("%v", val)
	case []interface{}:
		parts := make([]string, len(val))
		for i, item := range val {
			parts[i] = formatGoValue(item)
		}
		return "[]interface{}{" + strings.Join(parts, ", ") + "}"
	default:
		return fmt.Sprintf("%v", val)
	}
}

// GenerateRunner creates the runner script for the given language.
func GenerateRunner(language string, userCode string, testCases []TestCase) (*RunnerConfig, error) {
	switch language {
	case "python":
		return generatePythonRunner(userCode, testCases)
	case "javascript", "typescript":
		return generateJSRunner(userCode, testCases)
	case "java":
		return generateJavaRunner(userCode, testCases)
	case "cpp", "c":
		return generateCppRunner(userCode, testCases, language)
	case "go":
		return generateGoRunner(userCode, testCases)
	default:
		return nil, fmt.Errorf("unsupported language: %s", language)
	}
}

func generatePythonRunner(userCode string, testCases []TestCase) (*RunnerConfig, error) {
	var sb strings.Builder

	sb.WriteString("import json\nimport sys\n\n")
	sb.WriteString("# --- User Code ---\n")
	sb.WriteString(userCode)
	sb.WriteString("\n\n# --- Test Harness ---\n")
	sb.WriteString("results = []\n")

	for i, tc := range testCases {
		funcName := extractFuncName(tc.FunctionToCall)
		params := sortedParamValues(tc.InputParams)
		args := make([]string, len(params))
		for j, p := range params {
			args[j] = formatPythonValue(p)
		}

		sb.WriteString(fmt.Sprintf("try:\n"))
		sb.WriteString(fmt.Sprintf("    actual = %s(%s)\n", funcName, strings.Join(args, ", ")))
		sb.WriteString(fmt.Sprintf("    actual_str = str(actual)\n"))
		sb.WriteString(fmt.Sprintf("    expected = %q\n", tc.ExpectedOutput))
		sb.WriteString(fmt.Sprintf("    passed = actual_str == expected\n"))
		sb.WriteString(fmt.Sprintf("    results.append({\"testCase\": %d, \"passed\": passed, \"actual\": actual_str, \"expected\": expected})\n", i+1))
		sb.WriteString(fmt.Sprintf("except Exception as e:\n"))
		sb.WriteString(fmt.Sprintf("    results.append({\"testCase\": %d, \"passed\": False, \"actual\": \"\", \"expected\": %q, \"error\": str(e)})\n\n", i+1, tc.ExpectedOutput))
	}

	sb.WriteString("for r in results:\n")
	sb.WriteString("    print(json.dumps(r))\n")

	return &RunnerConfig{
		FileName: "runner.py",
		Code:     sb.String(),
		Image:    "python:3-slim",
		Cmd:      []string{"python", "/code/runner.py"},
	}, nil
}

func generateJSRunner(userCode string, testCases []TestCase) (*RunnerConfig, error) {
	var sb strings.Builder

	sb.WriteString("// --- User Code ---\n")
	sb.WriteString(userCode)
	sb.WriteString("\n\n// --- Test Harness ---\n")
	sb.WriteString("const results = [];\n")

	for i, tc := range testCases {
		funcName := extractFuncName(tc.FunctionToCall)
		params := sortedParamValues(tc.InputParams)
		args := make([]string, len(params))
		for j, p := range params {
			args[j] = formatJSValue(p)
		}

		sb.WriteString(fmt.Sprintf("try {\n"))
		sb.WriteString(fmt.Sprintf("  const actual = %s(%s);\n", funcName, strings.Join(args, ", ")))
		sb.WriteString(fmt.Sprintf("  const actualStr = String(actual);\n"))
		sb.WriteString(fmt.Sprintf("  const expected = %q;\n", tc.ExpectedOutput))
		sb.WriteString(fmt.Sprintf("  results.push({testCase: %d, passed: actualStr === expected, actual: actualStr, expected});\n", i+1))
		sb.WriteString(fmt.Sprintf("} catch (e) {\n"))
		sb.WriteString(fmt.Sprintf("  results.push({testCase: %d, passed: false, actual: \"\", expected: %q, error: e.message});\n", i+1, tc.ExpectedOutput))
		sb.WriteString(fmt.Sprintf("}\n\n"))
	}

	sb.WriteString("results.forEach(r => console.log(JSON.stringify(r)));\n")

	return &RunnerConfig{
		FileName: "runner.js",
		Code:     sb.String(),
		Image:    "node:20-slim",
		Cmd:      []string{"node", "/code/runner.js"},
	}, nil
}

func generateJavaRunner(userCode string, testCases []TestCase) (*RunnerConfig, error) {
	var sb strings.Builder

	sb.WriteString("import java.util.*;\n\n")
	sb.WriteString("public class Main {\n\n")
	sb.WriteString("// --- User Code ---\n")
	sb.WriteString(userCode)
	sb.WriteString("\n\n")
	sb.WriteString("    public static void main(String[] args) {\n")

	for i, tc := range testCases {
		funcName := extractFuncName(tc.FunctionToCall)
		params := sortedParamValues(tc.InputParams)
		args := make([]string, len(params))
		for j, p := range params {
			args[j] = formatJavaValue(p)
		}

		sb.WriteString(fmt.Sprintf("        try {\n"))
		sb.WriteString(fmt.Sprintf("            Object actual = %s(%s);\n", funcName, strings.Join(args, ", ")))
		sb.WriteString(fmt.Sprintf("            String actualStr = String.valueOf(actual);\n"))
		sb.WriteString(fmt.Sprintf("            String expected = \"%s\";\n", tc.ExpectedOutput))
		sb.WriteString(fmt.Sprintf("            boolean passed = actualStr.equals(expected);\n"))
		sb.WriteString(fmt.Sprintf("            System.out.println(\"{\\\"testCase\\\":%d,\\\"passed\\\":\" + passed + \",\\\"actual\\\":\\\"\" + actualStr.replace(\"\\\"\", \"\\\\\\\"\") + \"\\\",\\\"expected\\\":\\\"\" + expected.replace(\"\\\"\", \"\\\\\\\"\") + \"\\\"}\");\n", i+1))
		sb.WriteString(fmt.Sprintf("        } catch (Exception e) {\n"))
		sb.WriteString(fmt.Sprintf("            System.out.println(\"{\\\"testCase\\\":%d,\\\"passed\\\":false,\\\"actual\\\":\\\"\\\",\\\"expected\\\":\\\"%s\\\",\\\"error\\\":\\\"\" + e.getMessage().replace(\"\\\"\", \"\\\\\\\"\") + \"\\\"}\");\n", i+1, tc.ExpectedOutput))
		sb.WriteString(fmt.Sprintf("        }\n\n"))
	}

	sb.WriteString("    }\n")
	sb.WriteString("}\n")

	return &RunnerConfig{
		FileName: "Main.java",
		Code:     sb.String(),
		Image:    "openjdk:21-slim",
		Cmd:      []string{"sh", "-c", "cd /code && javac Main.java && java Main"},
	}, nil
}

func generateCppRunner(userCode string, testCases []TestCase, lang string) (*RunnerConfig, error) {
	var sb strings.Builder

	sb.WriteString("#include <iostream>\n#include <sstream>\n#include <string>\n#include <vector>\nusing namespace std;\n\n")
	sb.WriteString("// --- User Code ---\n")
	sb.WriteString(userCode)
	sb.WriteString("\n\n")
	sb.WriteString("int main() {\n")

	for i, tc := range testCases {
		funcName := extractFuncName(tc.FunctionToCall)
		params := sortedParamValues(tc.InputParams)
		args := make([]string, len(params))
		for j, p := range params {
			args[j] = formatCppValue(p)
		}

		sb.WriteString(fmt.Sprintf("    try {\n"))
		sb.WriteString(fmt.Sprintf("        auto actual = %s(%s);\n", funcName, strings.Join(args, ", ")))
		sb.WriteString(fmt.Sprintf("        ostringstream oss;\n"))
		sb.WriteString(fmt.Sprintf("        oss << actual;\n"))
		sb.WriteString(fmt.Sprintf("        string actualStr = oss.str();\n"))
		sb.WriteString(fmt.Sprintf("        string expected = \"%s\";\n", tc.ExpectedOutput))
		sb.WriteString(fmt.Sprintf("        bool passed = (actualStr == expected);\n"))
		sb.WriteString(fmt.Sprintf("        cout << \"{\\\"testCase\\\":%d,\\\"passed\\\":\" << (passed ? \"true\" : \"false\") << \",\\\"actual\\\":\\\"\" << actualStr << \"\\\",\\\"expected\\\":\\\"\" << expected << \"\\\"}\" << endl;\n", i+1))
		sb.WriteString(fmt.Sprintf("    } catch (exception& e) {\n"))
		sb.WriteString(fmt.Sprintf("        cout << \"{\\\"testCase\\\":%d,\\\"passed\\\":false,\\\"actual\\\":\\\"\\\",\\\"expected\\\":\\\"%s\\\",\\\"error\\\":\\\"\" << e.what() << \"\\\"}\" << endl;\n", i+1, tc.ExpectedOutput))
		sb.WriteString(fmt.Sprintf("    }\n\n"))
	}

	sb.WriteString("    return 0;\n")
	sb.WriteString("}\n")

	ext := "cpp"
	compileCmd := "g++ -o /tmp/main /code/main.cpp && /tmp/main"
	if lang == "c" {
		ext = "c"
		compileCmd = "gcc -o /tmp/main /code/main.c && /tmp/main"
	}

	return &RunnerConfig{
		FileName: "main." + ext,
		Code:     sb.String(),
		Image:    "gcc:latest",
		Cmd:      []string{"sh", "-c", compileCmd},
	}, nil
}

func generateGoRunner(userCode string, testCases []TestCase) (*RunnerConfig, error) {
	var sb strings.Builder

	sb.WriteString("package main\n\nimport (\n\t\"fmt\"\n\t\"encoding/json\"\n\t\"os\"\n)\n\n")
	sb.WriteString("// --- User Code ---\n")
	sb.WriteString(userCode)
	sb.WriteString("\n\n")
	sb.WriteString("type TestResult struct {\n")
	sb.WriteString("\tTestCase int    `json:\"testCase\"`\n")
	sb.WriteString("\tPassed   bool   `json:\"passed\"`\n")
	sb.WriteString("\tActual   string `json:\"actual\"`\n")
	sb.WriteString("\tExpected string `json:\"expected\"`\n")
	sb.WriteString("\tError    string `json:\"error,omitempty\"`\n")
	sb.WriteString("}\n\n")
	sb.WriteString("func main() {\n")
	sb.WriteString("\t_ = os.Stdout\n")

	for i, tc := range testCases {
		funcName := extractFuncName(tc.FunctionToCall)
		params := sortedParamValues(tc.InputParams)
		args := make([]string, len(params))
		for j, p := range params {
			args[j] = formatGoValue(p)
		}

		sb.WriteString(fmt.Sprintf("\t{\n"))
		sb.WriteString(fmt.Sprintf("\t\tactual := fmt.Sprintf(\"%%v\", %s(%s))\n", funcName, strings.Join(args, ", ")))
		sb.WriteString(fmt.Sprintf("\t\texpected := %q\n", tc.ExpectedOutput))
		sb.WriteString(fmt.Sprintf("\t\tr := TestResult{TestCase: %d, Passed: actual == expected, Actual: actual, Expected: expected}\n", i+1))
		sb.WriteString(fmt.Sprintf("\t\tb, _ := json.Marshal(r)\n"))
		sb.WriteString(fmt.Sprintf("\t\tfmt.Println(string(b))\n"))
		sb.WriteString(fmt.Sprintf("\t}\n\n"))
	}

	sb.WriteString("}\n")

	return &RunnerConfig{
		FileName: "main.go",
		Code:     sb.String(),
		Image:    "golang:1.22-alpine",
		Cmd:      []string{"go", "run", "/code/main.go"},
	}, nil
}
