package main

import (
	"net/http"
	"log"

	"github.com/gin-gonic/gin"
	// "github.com/gin-contrib/cors"
	// "github.com/tgonet/peerprep-g14/services/question-service"
	"github.com/tgonet/peerprep-g14/services/question-service/handler"
	"github.com/tgonet/peerprep-g14/services/question-service/internal/database"
	"github.com/tgonet/peerprep-g14/services/question-service/question/repository"
)

func main() {
	// gin.SetMode(gin.ReleaseMode)
	r := gin.Default()
	port := ":3002"
	mongoClient := database.ConnectMongo()
	// defer func() {
    //     if err := database.Client.Disconnect(context.Background()); err != nil {
    //         log.Fatalf("Error disconnecting from MongoDB: %v", err)
    //     }
    // }()

	h := handler.Handler{
		DB: mongoClient,
		QuestSvc: &repository.QuestionService{},
	}
	// curl.exe -X GET http://localhost:3002/health
	r.GET("/health", func(c *gin.Context) {
        c.JSON(http.StatusOK, gin.H{"status": "healthy"})
    })

	//curl.exe -X GET http://localhost:3002/?difficulty=easy
	//curl.exe -X GET "http://localhost:3002/?difficulty=medium&topic=depth_first_search"
	//curl.exe -X GET "http://localhost:3002/?difficulty=hard&topic=depth_first_search"
    r.GET("/", h.GetQuestionsRequest)
	//curl.exe -X GET http://localhost:3002/69a4454453ab6df3d3679d65
    r.GET("/:id", h.GetQuestionByIDRequest)

    // admin only routes
    r.POST("/", handler.AdminOnly(), h.PostCreateQuestionRequest)
    r.PUT("/:id", handler.AdminOnly(), h.PutQuestionRequest)
    r.DELETE("/:id", handler.AdminOnly(), h.DeleteQuestionRequest)

    log.Println("Starting Question Service on port 3002...")
    if err := r.Run(port); err != nil {
        log.Fatalf("Failed to start server: %v", err)
    }
	
}
