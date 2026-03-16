package database

import (
	"context"
	// "encoding/json"
	"fmt"
	"log"
	"os"
	// "time"

	"github.com/joho/godotenv"
	// "go.mongodb.org/mongo-driver/v2/bson"
	"go.mongodb.org/mongo-driver/v2/mongo"
	"go.mongodb.org/mongo-driver/v2/mongo/options"
)

var Client *mongo.Client

func ConnectMongo() *mongo.Client{
	err := godotenv.Load()
	if err != nil {
		// log.Fatal("Error loading .env file")
		log.Println("Warning: No .env file found. Relying on system environment variables.")
	}
	uri := os.Getenv("MONGODB_URI")
	docs := "www.mongodb.com/docs/drivers/go/current/"
	if uri == "" {
		log.Fatal("Set your 'MONGODB_URI' environment variable. " +
			"See: " + docs +
			"usage-examples/#environment-variable")
	} else {
        fmt.Println("Attempting to connect with a URI length of:", len(uri))
    }

	// ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
    // defer cancel()
	ctx := context.Background()

	client, err := mongo.Connect(options.Client().
		ApplyURI(uri))
	if err != nil {
		// panic(err)
		log.Fatalf("Failed to initialize MongoDB client: %v", err)
	}
	if err := client.Ping(ctx, nil); err != nil {
        log.Printf("Could not connect to MongoDB (this is fine for local API testing without DB): %v", err)
    } else {
		log.Println("Successfully connected to MongoDB!")
	}

	// defer func() {
	// 	if err := client.Disconnect(context.TODO()); err != nil {
	// 		panic(err)
	// 	}
	// }()

	// Client = client

	// database := "questionTestcaseDB"
	// question_col := "testcase_collection"

	// coll := client.Database(database).Collection(question_col)
	// title := "Reverse Linked-List"

	// var result bson.M
	// err = coll.FindOne(context.TODO(), bson.D{{"question_title", title}}).
	// 	Decode(&result)
	// if err == mongo.ErrNoDocuments {
	// 	fmt.Printf("No document was found with the title %s\n", title)
	// 	return nil
	// }
	// if err != nil {
	// 	panic(err)
	// }

	// jsonData, err := json.MarshalIndent(result, "", "    ")
	// if err != nil {
	// 	panic(err)
	// }
	// fmt.Printf("%s\n", jsonData)

	return client
}

func closeConnection(client *mongo.Client) {
	client.Disconnect(context.Background())
	log.Printf("Mongo Client disconnecting")
}
