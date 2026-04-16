package validation

import (
	// "context"
	"errors"
	"fmt"

	// "log"
	"strings"
	// "time"

	// "github.com/tgonet/peerprep-g14/services/question-service/internal/database"
	// "go.mongodb.org/mongo-driver/v2/bson"
	// "go.mongodb.org/mongo-driver/v2/mongo"
	// "go.mongodb.org/mongo-driver/v2/mongo"
	// "golang.org/x/text/cases"
)

type TopicStore struct {
    topics map[string]struct{}
}

func NewTopicStore() *TopicStore {
    return &TopicStore{
        topics: map[string]struct{}{
            "arrays":           {},
            "two-pointers":     {},
            "sliding-window":   {},
            "stack":            {},
            "binary-search":    {},
            "linked-list":      {},
            "trees":            {},
            "graphs":           {},
            "dp":               {},
        },
    }
}

func ValidateDifficulty(s string) (string, error) {
	validDiff := false
	s = strings.ToLower(s)

    switch s {
    case "easy":   validDiff = true
    case "medium": validDiff = true
    case "hard":   validDiff = true
    default:       validDiff = false
	}

	if validDiff == true {
		return s, nil
	} else {
		return "", errors.New("unknown difficulty level")
	}
}

func ValidateTopics(input []string, ts *TopicStore) ([]string, error) {
    var result []string
	validTopic := false

    for _, s := range input {
        // Check if the string exists in our list
		if _, ok := ts.topics[s]; ok {
        fmt.Printf("%s exist\n", s)
		result = append(result, s)
		validTopic = true
    	} else {
			validTopic = false
			break
		}
    }
	if validTopic == false {
		return nil, errors.New("unknown topic input")
	}
    return result, nil
}
