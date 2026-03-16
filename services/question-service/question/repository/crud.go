// package main
package repository

import (
	"context"
	"errors"
	"fmt"

	// "log"
	"strings"
	"time"

	// "github.com/tgonet/peerprep-g14/services/question-service/internal/database"
	"go.mongodb.org/mongo-driver/v2/bson"
	"go.mongodb.org/mongo-driver/v2/mongo"
	// "go.mongodb.org/mongo-driver/v2/mongo"
	// "golang.org/x/text/cases"
)

type QuestionService struct{}

var quest_col string = "question_collection"
var test_col string = "testcase_collection"

type difficulty int
type topic int

const (
	easy difficulty = iota
	medium
	hard
)

const (
	binary_search topic = iota
	depth_first_search
	breadth_first_search
	singly_linked_list
	doubly_linked_list
)

type TopicStore struct {
    topics map[string]struct{}
}

func NewTopicStore() *TopicStore {
    return &TopicStore{
        topics: map[string]struct{}{
            "binary_search":        {},
			"depth_first_search":   {},
			"breadth_first_search": {},
			"singly_linked_list":   {},
			"doubly_linked_list":   {},
        },
    }
}

type Question struct {
	ID          bson.ObjectID   `json:"_id,omitempty" bson:"_id,omitempty"`
	Title       string   `json:"title" bson:"Title"`
	Description string   `json:"description" bson:"Description"`
	Difficulty  string   `json:"difficulty" bson:"Difficulty"`
	Topics      []string `json:"topics" bson:"Topics"`
	CreatedAt   string   `json:"createdAt" bson:"CreatedAt"`
	// image_url
}

// Stringer inteface
// func (d difficulty) String() string {
// 	return [...]string{"Easy", "Medium", "Hard"}[d]
// }

func validateDifficulty(s string) (string, error) {
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

func validateTopics(input []string, ts *TopicStore) ([]string, error) {
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

func initQuestion() Question{
	var quest_struct Question
	quest_struct.Title = ""
	quest_struct.Description = ""
	quest_struct.Difficulty = ""
	quest_struct.Topics = []string{}
	quest_struct.CreatedAt = ""
	return quest_struct
}

func (q *QuestionService) CreateQuestion(title *string, desc *string, diff string, topics []string, client *mongo.Client) (any, error) {
	doc := initQuestion()
	topicstore := NewTopicStore()
	// validateTitle(title)
	validatedLevel, err := validateDifficulty(diff)
	if err != nil {
		fmt.Println("Validation Error:", err)
        return nil, err// Stop execution if the difficulty is invalid
    }

	validatedTopics, err := validateTopics(topics, topicstore)
	if err != nil {
		fmt.Println("Validation Error:", err)
        return nil, err// Stop execution if the difficulty is invalid
    }

	doc.Title = *title
	doc.Description = *desc
	doc.Difficulty = validatedLevel
	doc.Topics = validatedTopics
	doc.CreatedAt = time.Now().Format(time.DateTime)
	
	fmt.Printf("Inserting: \n")
	fmt.Printf("Title: %s\n", doc.Title)
	fmt.Printf("Desc: %s\n", doc.Description)
	fmt.Printf("Diff: %s\n", doc.Difficulty)
	fmt.Printf("Topics: %s\n", doc.Topics)
	fmt.Printf("createdAt: %s\n", doc.CreatedAt)

	// client := database.ConnectMongo()
	questionColl := client.Database("questionTestcaseDB").Collection(quest_col)
	result, err := questionColl.InsertOne(context.TODO(), doc)
	if err != nil {
		// panic(err)
		return nil, err
	}
	fmt.Printf("Inserted document with _id: %v\n", result.InsertedID)
	return result.InsertedID, nil
}

func (q *QuestionService) GetQuestions(difficulty string, topic string, client *mongo.Client) ([]Question, error) {
	questionColl := client.Database("questionTestcaseDB").Collection(quest_col)

	filter := bson.M{}
	if difficulty != "" {
		filter["Difficulty"] = difficulty
	}
	if topic != "" {
		filter["Topics"] = bson.M{"$in": []string{topic}}
	}

	cursor, err := questionColl.Find(context.TODO(), filter)
	if err != nil {
		return nil, err
	}
	defer cursor.Close(context.TODO())

	var questions []Question // initialize as nil slice, Find will append
	if err = cursor.All(context.TODO(), &questions); err != nil {
		return nil, err
	}

	if questions == nil {
		questions = []Question{}
	}

	return questions, nil
}

func (q *QuestionService) GetQuestionByID(id string, client *mongo.Client) (*Question, error) {
	questionColl := client.Database("questionTestcaseDB").Collection(quest_col)

	objID, err := bson.ObjectIDFromHex(id)
	if err != nil {
		return nil, fmt.Errorf("invalid ID format")
	}

	var result Question
	err = questionColl.FindOne(context.TODO(), bson.M{"_id": objID}).Decode(&result)
	if err != nil {
		if err == mongo.ErrNoDocuments {
			return nil, fmt.Errorf("question not found")
		}
		return nil, err
	}

	return &result, nil
}

func (q *QuestionService) UpdateQuestion(id string, title *string, desc *string, diff string, topics []string, client *mongo.Client) error {
	questionColl := client.Database("questionTestcaseDB").Collection(quest_col)

	objID, err := bson.ObjectIDFromHex(id)
	if err != nil {
		return fmt.Errorf("invalid ID format")
	}

	topicstore := NewTopicStore()
	validatedLevel, err := validateDifficulty(diff)
	if err != nil {
		return err
	}

	validatedTopics, err := validateTopics(topics, topicstore)
	if err != nil {
		return err
	}

	update := bson.M{
		"$set": bson.M{
			"Title":       *title,
			"Description": *desc,
			"Difficulty":  validatedLevel,
			"Topics":      validatedTopics,
		},
	}

	result, err := questionColl.UpdateOne(context.TODO(), bson.M{"_id": objID}, update)
	if err != nil {
		return err
	}
	if result.MatchedCount == 0 {
		return fmt.Errorf("question not found")
	}

	return nil
}

func (q *QuestionService) DeleteQuestion(id string, client *mongo.Client) error {
	questionColl := client.Database("questionTestcaseDB").Collection(quest_col)

	objID, err := bson.ObjectIDFromHex(id)
	if err != nil {
		return fmt.Errorf("invalid ID format")
	}

	result, err := questionColl.DeleteOne(context.TODO(), bson.M{"_id": objID})
	if err != nil {
		return err
	}
	if result.DeletedCount == 0 {
		return fmt.Errorf("question not found")
	}

	return nil
}

func (q *QuestionService) QueryAllQuestions(client *mongo.Client) ([]Question, error) {
	questionColl := client.Database("questionTestcaseDB").Collection(quest_col)

	var questionList []Question

	cursor, err := questionColl.Find(context.TODO(), bson.D{})
	if err != nil {
		return nil, err
	}

	if err := cursor.All(context.TODO(), &questionList); err != nil {
		return nil, err
	}
	return questionList, nil
}
