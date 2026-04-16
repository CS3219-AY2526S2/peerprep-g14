package main

import (
	"log"
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/tgonet/peerprep-g14/services/code-execution-service/handler"
)

func main() {
	r := gin.Default()
	port := ":3006"

	h := handler.NewHandler()

	r.GET("/health", func(c *gin.Context) {
		c.JSON(http.StatusOK, gin.H{"status": "healthy"})
	})

	r.POST("/execute", h.PostExecute)

	log.Println("Starting Code Execution Service on port 3006...")
	if err := r.Run(port); err != nil {
		log.Fatalf("Failed to start server: %v", err)
	}
}
