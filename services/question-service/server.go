package main

import (
	"log"
	"net/http"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/tgonet/peerprep-g14/services/question-service/handler"
	"github.com/tgonet/peerprep-g14/services/question-service/internal/database"
	"github.com/tgonet/peerprep-g14/services/question-service/question/repository"
	rediscache "github.com/tgonet/peerprep-g14/services/question-service/question/redisCache"
)

func main() {
	// gin.SetMode(gin.ReleaseMode)
	r := gin.Default()
	port := ":3002"
	mongoClient := database.ConnectMongo()
	redisClient := database.RedisConnect()
	// defer func() {
    //     if err := database.Client.Disconnect(context.Background()); err != nil {
    //         log.Fatalf("Error disconnecting from MongoDB: %v", err)
    //     }
    // }()

	h := handler.Handler{
		DB: mongoClient,
		Cache: redisClient,
		QuestSvc: &repository.QuestionService{},
	}

	// Initial cache population
	rediscache.CacheTop5Matched(mongoClient, redisClient)

	// Periodic refresh every 15 minutes
	go func() {
		ticker := time.NewTicker(15 * time.Minute)
		defer ticker.Stop()
		for range ticker.C {
			log.Println("Refreshing top 5 matched questions cache...")
			rediscache.CacheTop5Matched(mongoClient, redisClient)
		}
	}()

	// curl.exe -X GET http://localhost:3002/health
	r.GET("/health", func(c *gin.Context) {
        c.JSON(http.StatusOK, gin.H{"status": "healthy"})
    })

	//curl.exe -X GET http://localhost:3002/?difficulty=easy
	//curl.exe -X GET "http://localhost:3002/?difficulty=medium&topic=arrays"
	//curl.exe -X GET "http://localhost:3002/?difficulty=hard&topic=binary-search"
    r.GET("/", h.GetQuestionsRequest)
	// available questions (excludes completed) — must be before /:id
	r.GET("/available", h.GetAvailableQuestionsRequest)
	r.POST("/completed", h.PostMarkCompletedRequest)

	// test cases for a question — must be before /:id
	//curl.exe -X POST "http://localhost:3002/testcases/69df1c439856683bad005164"
	r.GET("/testcases/:questionId", h.GetTestCasesByQuestionIDRequest)

	//curl.exe -X GET http://localhost:3002/69df1c439856683bad005164
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
