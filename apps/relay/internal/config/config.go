package config

import (
	"fmt"
	"os"
	"strconv"
)

type Config struct {
	DBHost          string
	DBPort          string
	DBUser          string
	DBPassword      string
	DBName          string
	RedisAddr       string
	RedisPassword   string
	RedisDB         int
	WorkerPartition int16
	WorkerCount     int
}

func LoadConfig() (*Config, error) {
	// Defaults
	dbHost := os.Getenv("POSTGRES_HOST")
	if dbHost == "" {
		dbHost = "localhost"
	}
	dbPort := os.Getenv("POSTGRES_PORT")
	if dbPort == "" {
		dbPort = "5432"
	}
	dbUser := os.Getenv("POSTGRES_USER")
	if dbUser == "" {
		dbUser = "postgres"
	}
	dbPassword := os.Getenv("POSTGRES_PASSWORD")
	if dbPassword == "" {
		dbPassword = "password"
	}
	dbName := os.Getenv("POSTGRES_DB")
	if dbName == "" {
		dbName = "synapse"
	}
	redisAddr := os.Getenv("REDIS_ADDR")
	if redisAddr == "" {
		redisAddr = "localhost:6379"
	}
	redisPassword := os.Getenv("REDIS_PASSWORD")

	redisDB := 0
	if dbStr := os.Getenv("REDIS_DB"); dbStr != "" {
		if val, err := strconv.Atoi(dbStr); err == nil {
			redisDB = val
		}
	}

	workerPartition := int16(0)
	if partStr := os.Getenv("WORKER_PARTITION"); partStr != "" {
		if val, err := strconv.ParseInt(partStr, 10, 16); err == nil {
			workerPartition = int16(val)
		} else {
			return nil, fmt.Errorf("invalid WORKER_PARTITION: %v", err)
		}
	}

	workerCount := 16 // Total number of partitions
	if countStr := os.Getenv("WORKER_COUNT"); countStr != "" {
		if val, err := strconv.Atoi(countStr); err == nil {
			workerCount = val
		}
	}

	return &Config{
		DBHost:          dbHost,
		DBPort:          dbPort,
		DBUser:          dbUser,
		DBPassword:      dbPassword,
		DBName:          dbName,
		RedisAddr:       redisAddr,
		RedisPassword:   redisPassword,
		RedisDB:         redisDB,
		WorkerPartition: workerPartition,
		WorkerCount:     workerCount,
	}, nil
}
