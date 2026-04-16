// package main
package repository

import (
	"context"
	// "errors"
	"fmt"

	// "log"
	// "strings"
	"time"

	// "github.com/tgonet/peerprep-g14/services/question-service/internal/database"
	"github.com/tgonet/peerprep-g14/services/question-service/question/validation"
	"go.mongodb.org/mongo-driver/v2/bson"
	"go.mongodb.org/mongo-driver/v2/mongo"
	"go.mongodb.org/mongo-driver/v2/mongo/options"
	"github.com/sony/gobreaker"
	// "go.mongodb.org/mongo-driver/v2/mongo"
	// "golang.org/x/text/cases"
)

type QuestionService struct{}

var quest_col string = "question_collection"
var test_col string = "testcase_collection"
var completed_col string = "completed_collection"

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


type Question struct {
	ID          bson.ObjectID   `json:"_id,omitempty" bson:"_id,omitempty"`
	Title       string   		`json:"title" bson:"Title"`
	Description string   		`json:"description" bson:"Description"`
	Constraint string   		`json:"constraint" bson:"Constraint"`
	ExpectedOutput string   	`json:"expectedOutput" bson:"ExpectedOutput"`
	Difficulty  string   		`json:"difficulty" bson:"Difficulty"`
	Topics      []string 		`json:"topics" bson:"Topics"`
	CreatedAt   string   		`json:"createdAt" bson:"CreatedAt"`
	ImageUrls   []string 		`json:"imageUrls" bson:"ImageUrls"`
	Matched 	int				`json:"matched" bson:"Matched"`
}

type CompletedRecord struct {
	ID                bson.ObjectID `json:"_id,omitempty" bson:"_id,omitempty"`
	UserId            string        `json:"userId" bson:"UserId"`
	CompletedQuestion []string      `json:"completedQuestion" bson:"CompletedQuestion"`
}

type TestCase struct {
	ID             bson.ObjectID          `json:"_id,omitempty" bson:"_id,omitempty"`
	FunctionToCall string                 `json:"function_to_call" bson:"function_to_call"`
	InputParams    map[string]interface{} `json:"input_params" bson:"input_params"`
	QuestionID     string                 `json:"question_id" bson:"question_id"`
	ExpectedOutput string                 `json:"expected_output" bson:"expected_output"`
}

type MarkCompletedParams struct {
	UserIds    []string `json:"userIds"`
	QuestionId string   `json:"questionId"`
}

type CreateQuestionParams struct {
	Title       string   `json:"title"`
	Description string   `json:"description"`
	Constraint string   `json:"constraint"`
	ExpectedOutput string   `json:"expectedOutput"`
	Difficulty  string   `json:"difficulty"`
	Topics      []string `json:"topics"`
	ImageUrls   []string `json:"imageUrls"`
}

var FallbackQuestions = []Question{
	{
		ID:             bson.NewObjectID(),
		Title:          "Two Sum",
		Description:    "Given an array of integers nums and an integer target, return indices of the two numbers such that they add up to target. You may assume that each input would have exactly one solution.",
		Constraint:     "2 <= nums.length <= 10^4, -10^9 <= nums[i] <= 10^9, -10^9 <= target <= 10^9",
		ExpectedOutput: "[0, 1]",
		Difficulty:     "Easy",
		Topics:         []string{"Array", "Hash Table"},
		CreatedAt:      time.Now().Format(time.RFC3339),
		ImageUrls:      []string{},
	},
	{
		ID:             bson.NewObjectID(),
		Title:          "Reverse String",
		Description:    "Write a function that reverses a string. The input string is given as an array of characters s. You must do this by modifying the input array in-place with O(1) extra memory.",
		Constraint:     "1 <= s.length <= 10^5, s[i] is a printable ascii character.",
		ExpectedOutput: "[\"o\",\"l\",\"l\",\"e\",\"h\"]",
		Difficulty:     "Easy",
		Topics:         []string{"Two Pointers", "String"},
		CreatedAt:      time.Now().Format(time.RFC3339),
		ImageUrls:      []string{},
	},
	{
		ID:             bson.NewObjectID(),
		Title:          "Valid Anagram",
		Description:    "Given two strings s and t, return true if t is an anagram of s, and false otherwise. An Anagram is a word or phrase formed by rearranging the letters of a different word or phrase.",
		Constraint:     "1 <= s.length, t.length <= 5 * 10^4, s and t consist of lowercase English letters.",
		ExpectedOutput: "true",
		Difficulty:     "Easy",
		Topics:         []string{"Hash Table", "String", "Sorting"},
		CreatedAt:      time.Now().Format(time.RFC3339),
		ImageUrls:      []string{},
	},
}

func initQuestion() Question{
	var quest_struct Question
	quest_struct.Title = ""
	quest_struct.Description = ""
	quest_struct.Difficulty = ""
	quest_struct.Constraint = ""
	quest_struct.ExpectedOutput = ""
	quest_struct.Topics = []string{}
	quest_struct.CreatedAt = ""
	quest_struct.ImageUrls = []string{}
	return quest_struct
}

var cb *gobreaker.CircuitBreaker

func init() {
	cb = gobreaker.NewCircuitBreaker(gobreaker.Settings{
		Name:        "DB-Questions",
		MaxRequests: 3,
		Interval:    5 * time.Second,
		Timeout:     30 * time.Second,
	})
}

// func (q *QuestionService) CreateQuestion(title *string, desc *string, diff string, topics []string, client *mongo.Client) (any, error) {
func (q *QuestionService) CreateQuestion(req CreateQuestionParams, client *mongo.Client) (any, error) {
	doc := initQuestion()
	topicstore := validation.NewTopicStore()
	// validateTitle(title)
	validatedLevel, err := validation.ValidateDifficulty(req.Difficulty)
	if err != nil {
		fmt.Println("Validation Error:", err)
        return nil, err// Stop execution if the difficulty is invalid
    }

	validatedTopics, err := validation.ValidateTopics(req.Topics, topicstore)
	if err != nil {
		fmt.Println("Validation Error:", err)
        return nil, err// Stop execution if the difficulty is invalid
    }

	doc.Title = req.Title
	doc.Description = req.Description
	doc.Difficulty = validatedLevel
	doc.Constraint = req.Constraint
	doc.ExpectedOutput = req.ExpectedOutput
	doc.Topics = validatedTopics
	doc.ImageUrls = req.ImageUrls
	doc.CreatedAt = time.Now().Format(time.DateTime)
	doc.Matched = 0
	
	fmt.Printf("Inserting: \n")
	fmt.Printf("Title: %s\n", doc.Title)
	fmt.Printf("Desc: %s\n", doc.Description)
	fmt.Printf("Diff: %s\n", doc.Difficulty)
	fmt.Printf("Topics: %s\n", doc.Topics)
	fmt.Printf("createdAt: %s\n", doc.CreatedAt)

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
		return FallbackQuestions, nil
	}

	defer cursor.Close(context.TODO())

	var questions []Question // initialize as nil slice, Find will append
	if err = cursor.All(context.TODO(), &questions); err != nil {
		return FallbackQuestions, nil
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

func (q *QuestionService) UpdateQuestion(id string, params Question, client *mongo.Client) error {
	questionColl := client.Database("questionTestcaseDB").Collection(quest_col)

	objID, err := bson.ObjectIDFromHex(id)
	if err != nil {
		return fmt.Errorf("invalid ID format")
	}

	topicstore := validation.NewTopicStore()
	validatedLevel, err := validation.ValidateDifficulty(params.Difficulty)
	if err != nil {
		return err
	}

	validatedTopics, err := validation.ValidateTopics(params.Topics, topicstore)
	if err != nil {
		return err
	}

	update := bson.M{
		"$set": bson.M{
			"Title":       		params.Title,
			"Description": 		params.Description,
			"Difficulty":  		validatedLevel,
			"Topics":      		validatedTopics,
			"Constraint":  		params.Constraint,
			"ExpectedOutput":  	params.ExpectedOutput,
			"ImageUrls":   		params.ImageUrls,
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

// GetCompletedQuestionIds returns a deduplicated list of question IDs
// that any of the given users have completed.
func (q *QuestionService) GetCompletedQuestionIds(userIds []string, client *mongo.Client) ([]string, error) {
	completedColl := client.Database("questionTestcaseDB").Collection(completed_col)

	filter := bson.M{"UserId": bson.M{"$in": userIds}}
	cursor, err := completedColl.Find(context.TODO(), filter)
	if err != nil {
		return nil, err
	}
	defer cursor.Close(context.TODO())

	seen := map[string]bool{}
	var result []string

	var records []CompletedRecord
	if err = cursor.All(context.TODO(), &records); err != nil {
		return nil, err
	}

	for _, rec := range records {
		for _, qid := range rec.CompletedQuestion {
			if !seen[qid] {
				seen[qid] = true
				result = append(result, qid)
			}
		}
	}

	return result, nil
}

// GetAvailableQuestions returns questions matching difficulty/topic filters,
// excluding any questions whose IDs are in excludeIds.
func (q *QuestionService) GetAvailableQuestions(difficulty string, topic string, excludeIds []string, client *mongo.Client) ([]Question, error) {
	questionColl := client.Database("questionTestcaseDB").Collection(quest_col)

	filter := bson.M{}
	if difficulty != "" {
		filter["Difficulty"] = difficulty
	}
	if topic != "" {
		filter["Topics"] = bson.M{"$in": []string{topic}}
	}

	if len(excludeIds) > 0 {
		var excludeObjIds []bson.ObjectID
		for _, id := range excludeIds {
			objID, err := bson.ObjectIDFromHex(id)
			if err == nil {
				excludeObjIds = append(excludeObjIds, objID)
			}
		}
		if len(excludeObjIds) > 0 {
			filter["_id"] = bson.M{"$nin": excludeObjIds}
		}
	}

	cursor, err := questionColl.Find(context.TODO(), filter)
	if err != nil {
		return FallbackQuestions, nil
	}
	defer cursor.Close(context.TODO())

	var questions []Question
	if err = cursor.All(context.TODO(), &questions); err != nil {
		return FallbackQuestions, nil
	}

	if questions == nil {
		questions = []Question{}
	}

	return questions, nil
}

// IncrementMatched atomically increments the Matched counter for a question.
func (q *QuestionService) IncrementMatched(questionId string, client *mongo.Client) error {
	questionColl := client.Database("questionTestcaseDB").Collection(quest_col)

	objID, err := bson.ObjectIDFromHex(questionId)
	if err != nil {
		return fmt.Errorf("invalid question ID format: %w", err)
	}

	_, err = questionColl.UpdateOne(
		context.TODO(),
		bson.M{"_id": objID},
		bson.M{"$inc": bson.M{"Matched": 1}},
	)
	return err
}

// QueryTop5MatchedQuestions returns the 5 most frequently matched questions,
// sorted by Matched descending.
func (q *QuestionService) QueryTop5MatchedQuestions(client *mongo.Client) ([]Question, error) {
	questionColl := client.Database("questionTestcaseDB").Collection(quest_col)

	opts := options.Find().SetSort(bson.M{"Matched": -1}).SetLimit(5)
	cursor, err := questionColl.Find(context.TODO(), bson.M{}, opts)
	if err != nil {
		return []Question{}, err
	}
	defer cursor.Close(context.TODO())

	var questions []Question
	if err = cursor.All(context.TODO(), &questions); err != nil {
		return []Question{}, err
	}
	if questions == nil {
		questions = []Question{}
	}
	return questions, nil
}

// GetTestCasesByQuestionID returns all test cases for a given question ID.
// Note: question_id is stored as a string in MongoDB, not an ObjectID.
func (q *QuestionService) GetTestCasesByQuestionID(questionId string, client *mongo.Client) ([]TestCase, error) {
	testcaseColl := client.Database("questionTestcaseDB").Collection(test_col)

	cursor, err := testcaseColl.Find(context.TODO(), bson.M{"question_id": questionId})
	if err != nil {
		return nil, err
	}
	defer cursor.Close(context.TODO())

	var testcases []TestCase
	if err = cursor.All(context.TODO(), &testcases); err != nil {
		return nil, err
	}

	if testcases == nil {
		testcases = []TestCase{}
	}

	return testcases, nil
}

// MarkQuestionsCompleted adds questionId to each user's CompletedQuestion array
// using upsert + $addToSet to avoid duplicates.
func (q *QuestionService) MarkQuestionsCompleted(userIds []string, questionId string, client *mongo.Client) error {
	completedColl := client.Database("questionTestcaseDB").Collection(completed_col)

	for _, uid := range userIds {
		filter := bson.M{"UserId": uid}
		update := bson.M{
			"$addToSet": bson.M{"CompletedQuestion": questionId},
		}
		_, err := completedColl.UpdateOne(context.TODO(), filter, update, options.UpdateOne().SetUpsert(true))
		if err != nil {
			return fmt.Errorf("failed to mark completed for user %s: %w", uid, err)
		}
	}

	return nil
}
