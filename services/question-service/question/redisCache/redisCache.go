package rediscache

import (
	"context"
	"encoding/json"
	"log"
	"strings"
	"time"

	"github.com/redis/go-redis/v9"
	"github.com/tgonet/peerprep-g14/services/question-service/question/repository"
	"go.mongodb.org/mongo-driver/v2/mongo"
)

const cacheKey = "top_matched_questions"
const cacheTTL = 20 * time.Minute

// CacheTop5Matched queries the top 5 most-matched questions from MongoDB
// and stores them in Redis. Errors are logged but do not panic.
func CacheTop5Matched(mongoclient *mongo.Client, redisclient *redis.Client) {
	svc := &repository.QuestionService{}
	questions, err := svc.QueryTop5MatchedQuestions(mongoclient)
	if err != nil {
		log.Printf("warning: failed to query top 5 matched questions: %v", err)
		return
	}

	data, err := json.Marshal(questions)
	if err != nil {
		log.Printf("warning: failed to marshal top 5 questions: %v", err)
		return
	}

	ctx := context.Background()
	if err := redisclient.Set(ctx, cacheKey, data, cacheTTL).Err(); err != nil {
		log.Printf("warning: failed to cache top 5 questions in Redis: %v", err)
		return
	}

	log.Printf("Cached %d top matched questions in Redis", len(questions))
}

// GetCachedTop5 retrieves the cached top 5 questions from Redis.
// Returns nil, nil on cache miss.
func GetCachedTop5(redisclient *redis.Client) ([]repository.Question, error) {
	ctx := context.Background()
	data, err := redisclient.Get(ctx, cacheKey).Bytes()
	if err == redis.Nil {
		return nil, nil
	}
	if err != nil {
		return nil, err
	}

	var questions []repository.Question
	if err := json.Unmarshal(data, &questions); err != nil {
		return nil, err
	}
	return questions, nil
}

// FilterCachedQuestions filters questions by difficulty, topic, and excludes
// questions whose IDs are in excludeIds.
func FilterCachedQuestions(questions []repository.Question, difficulty string, topic string, excludeIds []string) []repository.Question {
	excludeSet := make(map[string]bool, len(excludeIds))
	for _, id := range excludeIds {
		excludeSet[id] = true
	}

	var result []repository.Question
	for _, q := range questions {
		if excludeSet[q.ID.Hex()] {
			continue
		}
		if difficulty != "" && !strings.EqualFold(q.Difficulty, difficulty) {
			continue
		}
		if topic != "" {
			found := false
			for _, t := range q.Topics {
				if strings.EqualFold(t, topic) {
					found = true
					break
				}
			}
			if !found {
				continue
			}
		}
		result = append(result, q)
	}
	return result
}
