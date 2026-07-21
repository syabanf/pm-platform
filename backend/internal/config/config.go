// Package config loads runtime configuration from the environment.
package config

import (
	"fmt"
	"os"
	"strconv"
	"time"
)

// Config holds everything the API needs to boot.
type Config struct {
	Env             string
	Port            int
	DatabaseURL     string
	ReadTimeout     time.Duration
	WriteTimeout    time.Duration
	ShutdownTimeout time.Duration
	CORSOrigins     string
}

// Load reads configuration from the environment, applying sane defaults for
// local development. It returns an error only when a value is required and
// cannot be defaulted.
func Load() (Config, error) {
	cfg := Config{
		Env:             getenv("APP_ENV", "development"),
		Port:            getenvInt("PORT", 8080),
		DatabaseURL:     getenv("DATABASE_URL", ""),
		ReadTimeout:     getenvDuration("READ_TIMEOUT", 10*time.Second),
		WriteTimeout:    getenvDuration("WRITE_TIMEOUT", 20*time.Second),
		ShutdownTimeout: getenvDuration("SHUTDOWN_TIMEOUT", 10*time.Second),
		// Next.js dev server by default; comma-separated list.
		CORSOrigins: getenv("CORS_ORIGINS", "http://localhost:3000"),
	}

	if cfg.DatabaseURL == "" {
		return cfg, fmt.Errorf("DATABASE_URL is required (see .env.example)")
	}
	return cfg, nil
}

// Addr is the listen address for the HTTP server.
func (c Config) Addr() string { return fmt.Sprintf(":%d", c.Port) }

func getenv(key, fallback string) string {
	if v, ok := os.LookupEnv(key); ok && v != "" {
		return v
	}
	return fallback
}

func getenvInt(key string, fallback int) int {
	if v, ok := os.LookupEnv(key); ok && v != "" {
		if n, err := strconv.Atoi(v); err == nil {
			return n
		}
	}
	return fallback
}

func getenvDuration(key string, fallback time.Duration) time.Duration {
	if v, ok := os.LookupEnv(key); ok && v != "" {
		if d, err := time.ParseDuration(v); err == nil {
			return d
		}
	}
	return fallback
}
