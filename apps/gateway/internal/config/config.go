package config

import (
	"fmt"
	"log"
	"os"
)

// Config holds all environmental configuration variables needed by the Gateway.
type Config struct {
	Port              string // Gateway port to listen on (e.g. 8081).
	RedisHost         string // Redis host address.
	RedisPort         string // Redis port.
	DBHost            string // PostgreSQL host address.
	DBPort            string // PostgreSQL port.
	DBUser            string // PostgreSQL user.
	DBPassword        string // PostgreSQL password.
	DBName            string // PostgreSQL database name.
	DBSSLMode         string // PostgreSQL SSL mode setting.
	SessionCookieName string // Cookie key name holding the session token.
}

// requireEnv fetches the environment variable or calls log.Fatalf to fail fast if missing.
func requireEnv(key string) string {
	val := os.Getenv(key)
	if val == "" {
		log.Fatalf("gateway config error: required environment variable %s is not set", key)
	}
	return val
}

// Load reads config variables from the environment.
// It fails fast (exits the application) if any required variable is missing.
func Load() *Config {
	return &Config{
		Port:              requireEnv("GATEWAY_PORT"),
		RedisHost:         requireEnv("REDIS_HOST"),
		RedisPort:         requireEnv("REDIS_PORT"),
		DBHost:            requireEnv("POSTGRES_HOST"),
		DBPort:            requireEnv("POSTGRES_PORT"),
		DBUser:            requireEnv("POSTGRES_USER"),
		DBPassword:        requireEnv("POSTGRES_PASSWORD"),
		DBName:            requireEnv("POSTGRES_DB"),
		DBSSLMode:         requireEnv("POSTGRES_SSLMODE"),
		SessionCookieName: requireEnv("SESSION_COOKIE_NAME"),
	}
}

// PostgresDSN returns the connection string formatted for the PostgreSQL driver.
func (c *Config) PostgresDSN() string {
	return fmt.Sprintf("host=%s port=%s user=%s password=%s dbname=%s sslmode=%s",
		c.DBHost, c.DBPort, c.DBUser, c.DBPassword, c.DBName, c.DBSSLMode)
}

// RedisAddress returns the endpoint string formatted for the Redis client.
func (c *Config) RedisAddress() string {
	return fmt.Sprintf("%s:%s", c.RedisHost, c.RedisPort)
}
