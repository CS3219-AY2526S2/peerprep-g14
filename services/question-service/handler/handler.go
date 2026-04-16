package handler

import (
	"log"
	"math/rand"
	"net/http"
	"strings"

	"github.com/gin-gonic/gin"
	"github.com/redis/go-redis/v9"
	"github.com/tgonet/peerprep-g14/services/question-service/question/repository"
	rediscache "github.com/tgonet/peerprep-g14/services/question-service/question/redisCache"
	"go.mongodb.org/mongo-driver/v2/mongo"
)

type Handler struct {
	DB *mongo.Client
	Cache *redis.Client
    QuestSvc *repository.QuestionService
}


func (h *Handler) PostCreateQuestionRequest(c *gin.Context) {
	var params repository.CreateQuestionParams

	// Bind JSON from the UI request
    if err := c.ShouldBindJSON(&params); err != nil {
        c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid request"})
        return
    }

	questID, err := h.QuestSvc.CreateQuestion(
		params,
		h.DB)

	if err != nil {
        c.JSON(http.StatusConflict, gin.H{"message": err.Error()})
        return
    }

	c.JSON(http.StatusOK, gin.H{"question_id": questID})
}

//fetch all qns, or filter by difficulty and topic
func (h *Handler) GetQuestionsRequest(c *gin.Context) {
	difficulty := c.Query("difficulty")
	topic := c.Query("topic")

	questions, err := h.QuestSvc.GetQuestions(difficulty, topic, h.DB)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch questions"})
		return
	}

	c.JSON(http.StatusOK, questions)
}

func (h *Handler) GetQuestionByIDRequest(c *gin.Context) {
	id := c.Param("id")

	question, err := h.QuestSvc.GetQuestionByID(id, h.DB)
	if err != nil {
		if err.Error() == "invalid ID format" || err.Error() == "question not found" {
			c.JSON(http.StatusNotFound, gin.H{"error": "Question not found"})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch question"})
		return
	}

	c.JSON(http.StatusOK, question)
}

func (h *Handler) PutQuestionRequest(c *gin.Context) {
	var params repository.Question
	id := c.Param("id")

	if err := c.ShouldBindJSON(&params); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid request payload"})
		return
	}

	err := h.QuestSvc.UpdateQuestion(id, params, h.DB)

	if err != nil {
		if err.Error() == "invalid ID format" || err.Error() == "question not found" {
			c.JSON(http.StatusNotFound, gin.H{"error": "Question not found"})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "Question updated successfully"})
}

func (h *Handler) DeleteQuestionRequest(c *gin.Context) {
	id := c.Param("id")

	err := h.QuestSvc.DeleteQuestion(id, h.DB)
	if err != nil {
		if err.Error() == "invalid ID format" || err.Error() == "question not found" {
			c.JSON(http.StatusNotFound, gin.H{"error": "Question not found"})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to delete question"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "Question deleted successfully"})
}

// GetTestCasesByQuestionIDRequest returns all test cases for a given question.
func (h *Handler) GetTestCasesByQuestionIDRequest(c *gin.Context) {
	questionId := c.Param("questionId")

	testcases, err := h.QuestSvc.GetTestCasesByQuestionID(questionId, h.DB)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch test cases"})
		return
	}

	c.JSON(http.StatusOK, testcases)
}

// GetAvailableQuestionsRequest returns questions excluding those completed by given users.
// It checks the Redis cache of top-matched questions first, falling back to MongoDB.
func (h *Handler) GetAvailableQuestionsRequest(c *gin.Context) {
	difficulty := c.Query("difficulty")
	topic := c.Query("topic")
	user1 := c.Query("user1")
	user2 := c.Query("user2")

	var userIds []string
	if user1 != "" {
		userIds = append(userIds, user1)
	}
	if user2 != "" {
		userIds = append(userIds, user2)
	}

	var excludeIds []string
	if len(userIds) > 0 {
		var err error
		excludeIds, err = h.QuestSvc.GetCompletedQuestionIds(userIds, h.DB)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch completed questions"})
			return
		}
	}

	// Try cache first: pick a random question from cached top-matched questions
	cached, err := rediscache.GetCachedTop5(h.Cache)
	if err != nil {
		log.Printf("warning: Redis cache read failed: %v", err)
	}
	if len(cached) > 0 {
		filtered := rediscache.FilterCachedQuestions(cached, difficulty, topic, excludeIds)
		if len(filtered) > 0 {
			picked := filtered[rand.Intn(len(filtered))]
			c.JSON(http.StatusOK, []repository.Question{picked})
			return
		}
	}

	// Fallback to MongoDB
	questions, err := h.QuestSvc.GetAvailableQuestions(difficulty, topic, excludeIds, h.DB)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch questions"})
		return
	}

	c.JSON(http.StatusOK, questions)
}

// PostMarkCompletedRequest marks a question as completed for the given users
func (h *Handler) PostMarkCompletedRequest(c *gin.Context) {
	var params repository.MarkCompletedParams

	if err := c.ShouldBindJSON(&params); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid request"})
		return
	}

	if len(params.UserIds) == 0 || params.QuestionId == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "userIds and questionId are required"})
		return
	}

	err := h.QuestSvc.MarkQuestionsCompleted(params.UserIds, params.QuestionId, h.DB)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	// Increment the matched counter (best-effort)
	if incErr := h.QuestSvc.IncrementMatched(params.QuestionId, h.DB); incErr != nil {
		log.Printf("warning: failed to increment matched count for %s: %v", params.QuestionId, incErr)
	}

	c.JSON(http.StatusOK, gin.H{"message": "Questions marked as completed"})
}

// AdminOnly Middleware enforces that the requester has the 'ADMIN' role
func AdminOnly() gin.HandlerFunc {
	return func(c *gin.Context) {
		role := c.GetHeader("X-User-Role")
		
		// Convert to uppercase to handle 'admin', 'Admin', 'SUPERADMIN', 'superadmin', etc.
		roleUpper := strings.ToUpper(role)
		if roleUpper != "ADMIN" && roleUpper != "SUPERADMIN" && roleUpper != "SUPER_ADMIN" {
			c.JSON(http.StatusForbidden, gin.H{"error": "Forbidden: You must be an admin to perform this action"})
			c.Abort()
			return
		}
		
		// If they are an admin, proceed to the actual handler (like PostCreateQuestionRequest)
		c.Next()
	}
}
