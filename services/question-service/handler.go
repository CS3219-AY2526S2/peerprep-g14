package main

import (
	// "log"
	// "context"
	// "fmt"
	// "context"
	"net/http"
	// "fmt"
	// "time"
	
	// "go.mongodb.org/mongo-driver/v2/mongo/readpref"
	"github.com/tgonet/peerprep-g14/services/question-service/internal/database"
	"github.com/tgonet/peerprep-g14/services/question-service/question/repository"
	// "go.mongodb.org/mongo-driver/v2/mongo"
	// "go.mongodb.org/mongo-driver/v2/mongo/options"
	"github.com/gin-gonic/gin"
)

type Handler struct {
    QuestSvc *repository.QuestionService
}


func (h *Handler) PostCreateQuestionRequest(c *gin.Context) {
	var questDoc struct {
        Title   string `json:"title"`
        Description string `json:"description"`
        Difficulty string `json:"difficulty"`
        Topics []string `json:"topics"`
    }

	// Bind JSON from the UI request
    if err := c.ShouldBindJSON(&questDoc); err != nil {
        c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid request"})
        return
    }

	questID, err := h.QuestSvc.CreateQuestion(
		&questDoc.Title, 
		&questDoc.Description, 
		questDoc.Difficulty, 
		questDoc.Topics, 
		database.Client)

	if err != nil {
        c.JSON(http.StatusConflict, gin.H{"message": err.Error()})
        return
    }

	c.JSON(http.StatusOK, gin.H{"question_id": questID})
}

func (h *Handler) GetQuestionsRequest(c *gin.Context) {
	difficulty := c.Query("difficulty")
	topic := c.Query("topic")

	questions, err := h.QuestSvc.GetQuestions(difficulty, topic, database.Client)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch questions"})
		return
	}

	c.JSON(http.StatusOK, questions)
}

func (h *Handler) GetQuestionByIDRequest(c *gin.Context) {
	id := c.Param("id")

	question, err := h.QuestSvc.GetQuestionByID(id, database.Client)
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
	id := c.Param("id")

	var questDoc struct {
		Title       string   `json:"title"`
		Description string   `json:"description"`
		Difficulty  string   `json:"difficulty"`
		Topics      []string `json:"topics"`
	}

	if err := c.ShouldBindJSON(&questDoc); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid request payload"})
		return
	}

	err := h.QuestSvc.UpdateQuestion(
		id,
		&questDoc.Title,
		&questDoc.Description,
		questDoc.Difficulty,
		questDoc.Topics,
		database.Client,
	)

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

	err := h.QuestSvc.DeleteQuestion(id, database.Client)
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

// AdminOnly Middleware enforces that the requester has the 'ADMIN' role
func AdminOnly() gin.HandlerFunc {
	return func(c *gin.Context) {
		role := c.GetHeader("X-User-Role")
		
		if role != "ADMIN" {
			c.JSON(http.StatusForbidden, gin.H{"error": "Forbidden: You must be an admin to perform this action"})
			c.Abort()
			return
		}
		
		// If they are an admin, proceed to the actual handler (like PostCreateQuestionRequest)
		c.Next()
	}
}
