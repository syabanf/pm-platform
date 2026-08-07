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
	// VerificationTokenInLog lets an operator run in production before a mailer
	// exists: the verification token is written to the log so a link can be
	// completed by hand. Off by default — a token in a log is a credential in a
	// log — and without it, and without a mailer, registration refuses rather
	// than creating accounts nobody can ever verify.
	VerificationTokenInLog bool

	// SessionTTL is how long a login lasts. Fixed, not sliding: a sliding
	// window means a stolen token can be kept alive forever by using it.
	SessionTTL time.Duration
	// RateLimitRPS/Burst bound each client IP across the whole API; the login
	// limiter below is separate and much tighter, because login failures are
	// the only endpoint where an attacker learns something per attempt.
	RateLimitRPS    float64
	RateLimitBurst  int
	LoginRatePerMin float64
	// TrustProxyHeaders decides whether X-Forwarded-For is believed. Off by
	// default: echo trusts that header out of the box, which lets a directly
	// exposed service be told any client IP — and the rate limiters key on it,
	// so a spoofed header rotates past the login brute-force bucket. Turn this
	// on ONLY when a trusted proxy sits in front and sets the header itself.
	TrustProxyHeaders bool

	// BootstrapAdminPassword, when set, is written over the seeded admin's
	// password at boot. The migration seeds a known hash whose plaintext
	// ("wit-admin-changeme") is in the repo — fine for a demo, a live
	// credential in production. Setting this rotates it without hand-run SQL;
	// leaving it unset in production makes the process refuse to boot with the
	// default still in place (see cmd/api). Env is the wrong place for a
	// long-lived secret, so treat this as a one-shot: set it, boot once, unset.
	BootstrapAdminPassword string
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

		VerificationTokenInLog: getenv("VERIFICATION_TOKEN_IN_LOG", "") == "true",

		SessionTTL:             getenvDuration("SESSION_TTL", 168*time.Hour),
		RateLimitRPS:           float64(getenvInt("RATE_LIMIT_RPS", 50)),
		RateLimitBurst:         getenvInt("RATE_LIMIT_BURST", 100),
		LoginRatePerMin:        float64(getenvInt("LOGIN_RATE_PER_MIN", 5)),
		TrustProxyHeaders:      getenv("TRUST_PROXY_HEADERS", "") == "true",
		BootstrapAdminPassword: getenv("BOOTSTRAP_ADMIN_PASSWORD", ""),
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
