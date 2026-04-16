package database

import (
	"context"
	"fmt"
	"os"

	"github.com/redis/go-redis/v9"
)

func RedisConnect() *redis.Client{
	ctx := context.Background()

	addr := os.Getenv("REDIS_ADDR")
	username := os.Getenv("REDIS_USERNAME")
	pw := os.Getenv("REDIS_PW")

	rdb := redis.NewClient(&redis.Options{
		Addr:     addr,
		Username: username,
		Password: pw,
		DB:       0,
	})

	_, err := rdb.Ping(ctx).Result()
	if err != nil {
		fmt.Printf("Warning: Redis ping failed: %v\n", err)
	} else {
		fmt.Println("Redis connected successfully")
	}

	return rdb
}
