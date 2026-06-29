package config

import (
	"fmt"
	"os"
	"strconv"
)

type Config struct {
	Port          string
	DBHost        string
	DBPort        string
	DBUser        string
	DBPassword    string
	DBName        string
	DBSSLMode     string
	RedisHost     string
	RedisPort     string
	RedisPassword string
	RedisDB       int
	JWTSecret     string
	NodeID        int64
	// AWS / S3 Configuration
	AWSRegion          string
	AWSAccessKeyID     string
	AWSSecretAccessKey string
	S3Bucket           string
	S3Endpoint         string
	S3UsePathStyle     bool

	// LiveKit Configuration
	LiveKitURL       string
	LiveKitAPIKey    string
	LiveKitAPISecret string
	VoiceStateTTL    int // seconds; default 60
}

func LoadConfig() (*Config, error) {
	port := os.Getenv("API_PORT")
	if port == "" {
		port = "8080"
	}

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
		dbPassword = "postgres"
	}

	dbName := os.Getenv("POSTGRES_DB")
	if dbName == "" {
		dbName = "synapse"
	}

	dbSSLMode := os.Getenv("POSTGRES_SSLMODE")
	if dbSSLMode == "" {
		dbSSLMode = "disable"
	}

	redisHost := os.Getenv("REDIS_HOST")
	if redisHost == "" {
		redisHost = "localhost"
	}

	redisPort := os.Getenv("REDIS_PORT")
	if redisPort == "" {
		redisPort = "6379"
	}

	redisPassword := os.Getenv("REDIS_PASSWORD")

	redisDBStr := os.Getenv("REDIS_DB")
	redisDB := 0
	if redisDBStr != "" {
		if val, err := strconv.Atoi(redisDBStr); err == nil {
			redisDB = val
		}
	}

	jwtSecret := os.Getenv("JWT_SECRET")
	if jwtSecret == "" {
		jwtSecret = "supersecretjwtkey123"
	}

	nodeIDStr := os.Getenv("NODE_ID")
	var nodeID int64 = 1
	if nodeIDStr != "" {
		if val, err := strconv.ParseInt(nodeIDStr, 10, 64); err == nil {
			nodeID = val
		}
	}

	awsRegion := os.Getenv("AWS_REGION")
	if awsRegion == "" {
		awsRegion = "us-east-1"
	}

	s3UsePathStyle := false
	if os.Getenv("S3_USE_PATH_STYLE") == "true" {
		s3UsePathStyle = true
	}

	voiceStateTTL := 60
	if v := os.Getenv("VOICE_STATE_TTL"); v != "" {
		if val, err := strconv.Atoi(v); err == nil && val > 0 {
			voiceStateTTL = val
		}
	}

	return &Config{
		Port:               port,
		DBHost:             dbHost,
		DBPort:             dbPort,
		DBUser:             dbUser,
		DBPassword:         dbPassword,
		DBName:             dbName,
		DBSSLMode:          dbSSLMode,
		RedisHost:          redisHost,
		RedisPort:          redisPort,
		RedisPassword:      redisPassword,
		RedisDB:            redisDB,
		JWTSecret:          jwtSecret,
		NodeID:             nodeID,
		AWSRegion:          awsRegion,
		AWSAccessKeyID:     os.Getenv("AWS_ACCESS_KEY_ID"),
		AWSSecretAccessKey: os.Getenv("AWS_SECRET_ACCESS_KEY"),
		S3Bucket:           os.Getenv("S3_BUCKET"),
		S3Endpoint:         os.Getenv("S3_ENDPOINT"),
		S3UsePathStyle:     s3UsePathStyle,
		LiveKitURL:         os.Getenv("LIVEKIT_URL"),
		LiveKitAPIKey:      os.Getenv("LIVEKIT_API_KEY"),
		LiveKitAPISecret:   os.Getenv("LIVEKIT_API_SECRET"),
		VoiceStateTTL:      voiceStateTTL,
	}, nil
}

func (c *Config) PostgresDSN() string {
	return fmt.Sprintf("host=%s port=%s user=%s password=%s dbname=%s sslmode=%s",
		c.DBHost, c.DBPort, c.DBUser, c.DBPassword, c.DBName, c.DBSSLMode)
}

func (c *Config) RedisAddress() string {
	return fmt.Sprintf("%s:%s", c.RedisHost, c.RedisPort)
}
