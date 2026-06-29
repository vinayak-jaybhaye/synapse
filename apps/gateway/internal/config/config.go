package config

import (
	"fmt"
	"os"
)

type Config struct {
	Port       string
	RedisHost  string
	RedisPort  string
	JWTSecret  string
}

func Load() *Config {
	port := os.Getenv("GATEWAY_PORT")
	if port == "" {
		port = "8081"
	}
	redisHost := os.Getenv("REDIS_HOST")
	if redisHost == "" {
		redisHost = "localhost"
	}
	redisPort := os.Getenv("REDIS_PORT")
	if redisPort == "" {
		redisPort = "6379"
	}
	jwtSecret := os.Getenv("JWT_SECRET")
	if jwtSecret == "" {
		jwtSecret = "supersecretjwtkey123"
	}
	return &Config{
		Port:      port,
		RedisHost: redisHost,
		RedisPort: redisPort,
		JWTSecret: jwtSecret,
	}
}

func (c *Config) RedisAddress() string {
	return fmt.Sprintf("%s:%s", c.RedisHost, c.RedisPort)
}
