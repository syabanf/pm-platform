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

	// RequestTimeout bounds a single request, and StatementTimeout bounds the
	// query behind it. Without the second, a cancelled request leaves its query
	// running and its pool connection held.
	RequestTimeout   time.Duration
	StatementTimeout time.Duration
	// LockTimeout bounds how long any statement waits for a row lock. It is set
	// on the connection rather than per transaction, so the plain UPDATE and
	// DELETE paths get it too — otherwise a contended delete waits the whole
	// StatementTimeout while holding a pool connection.
	LockTimeout time.Duration
	// DeleteTimeout is the budget for a DELETE, which cascades and can be
	// legitimately slow on a large tenant. RequestTimeout is far too short for
	// one, and a half-finished cascade is rolled back for nothing.
	DeleteTimeout time.Duration
	// MaxDBConns is set explicitly: pgx defaults to the machine's CPU count,
	// which quietly becomes the API's real concurrency limit. Remember the
	// budget is per process: replicas x MaxDBConns must stay under the server's
	// max_connections.
	MaxDBConns int32
	MinDBConns int32
	// Without these a pool that grew during a burst holds those connections
	// forever, and a rolling deploy overlaps two full-sized pools.
	MaxConnIdleTime time.Duration
	MaxConnLifetime time.Duration
	MaxBodySize     string
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

		RequestTimeout:   getenvDuration("REQUEST_TIMEOUT", 15*time.Second),
		StatementTimeout: getenvDuration("STATEMENT_TIMEOUT", 5*time.Second),
		LockTimeout:      getenvDuration("LOCK_TIMEOUT", 250*time.Millisecond),
		DeleteTimeout:    getenvDuration("DELETE_TIMEOUT", 120*time.Second),
		MaxDBConns:       int32(getenvInt("MAX_DB_CONNS", 25)),
		MinDBConns:       int32(getenvInt("MIN_DB_CONNS", 2)),
		MaxConnIdleTime:  getenvDuration("MAX_CONN_IDLE_TIME", 5*time.Minute),
		MaxConnLifetime:  getenvDuration("MAX_CONN_LIFETIME", 60*time.Minute),
		MaxBodySize:      getenv("MAX_BODY_SIZE", "1M"),
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
