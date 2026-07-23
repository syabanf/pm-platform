// Command api serves the WIT Sprint OS REST API.
package main

import (
	"context"
	"errors"
	"log"
	"net/http"
	"os"
	"os/signal"
	"strconv"
	"syscall"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/joho/godotenv"

	"github.com/syabanf/pm-platform/backend/internal/config"
	"github.com/syabanf/pm-platform/backend/internal/httpapi"
)

func main() {
	if err := run(); err != nil {
		log.Fatalf("fatal: %v", err)
	}
}

func run() error {
	// .env is optional — real environments inject variables directly.
	_ = godotenv.Load()

	cfg, err := config.Load()
	if err != nil {
		return err
	}

	ctx, stop := signal.NotifyContext(context.Background(), os.Interrupt, syscall.SIGTERM)
	defer stop()

	poolCtx, cancel := context.WithTimeout(ctx, 10*time.Second)
	defer cancel()

	poolCfg, err := pgxpool.ParseConfig(cfg.DatabaseURL)
	if err != nil {
		return err
	}
	poolCfg.MaxConns = cfg.MaxDBConns
	poolCfg.MinConns = cfg.MinDBConns
	// A pool that only ever grows turns one traffic burst into a permanent
	// share of the server's connection budget, and makes a rolling deploy need
	// twice the slots.
	poolCfg.MaxConnIdleTime = cfg.MaxConnIdleTime
	poolCfg.MaxConnLifetime = cfg.MaxConnLifetime
	// A server-side statement_timeout is the only backstop that survives a
	// client hanging up: it stops the query, which releases the connection.
	if poolCfg.ConnConfig.RuntimeParams == nil {
		poolCfg.ConnConfig.RuntimeParams = map[string]string{}
	}
	if _, set := poolCfg.ConnConfig.RuntimeParams["statement_timeout"]; !set {
		poolCfg.ConnConfig.RuntimeParams["statement_timeout"] =
			strconv.FormatInt(cfg.StatementTimeout.Milliseconds(), 10)
	}
	// Set on the connection, not per transaction: a DELETE or a plain UPDATE
	// never runs inside withTx, so a per-transaction setting left exactly the
	// paths that block longest without a bound. Waiting for a lock now fails at
	// LockTimeout with 55P03, which the API answers as a retryable 409, instead
	// of holding a pool connection for the whole statement_timeout.
	if _, set := poolCfg.ConnConfig.RuntimeParams["lock_timeout"]; !set {
		poolCfg.ConnConfig.RuntimeParams["lock_timeout"] =
			strconv.FormatInt(cfg.LockTimeout.Milliseconds(), 10)
	}

	pool, err := pgxpool.NewWithConfig(poolCtx, poolCfg)
	if err != nil {
		return err
	}
	defer pool.Close()

	if err := pool.Ping(poolCtx); err != nil {
		return err
	}
	log.Printf("connected to postgres")

	e := httpapi.NewServer(cfg, pool)
	srv := &http.Server{
		Addr:         cfg.Addr(),
		Handler:      e,
		ReadTimeout:  cfg.ReadTimeout,
		WriteTimeout: cfg.WriteTimeout,
	}

	go func() {
		log.Printf("api listening on %s (env=%s)", cfg.Addr(), cfg.Env)
		if err := srv.ListenAndServe(); err != nil && !errors.Is(err, http.ErrServerClosed) {
			log.Printf("server error: %v", err)
			stop()
		}
	}()

	<-ctx.Done()
	log.Printf("shutting down…")

	shutdownCtx, shutdownCancel := context.WithTimeout(context.Background(), cfg.ShutdownTimeout)
	defer shutdownCancel()

	return srv.Shutdown(shutdownCtx)
}
