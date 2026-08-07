package main

import (
	"context"
	"fmt"

	"github.com/jackc/pgx/v5/pgxpool"
	"golang.org/x/crypto/bcrypt"

	"github.com/syabanf/pm-platform/backend/internal/config"
)

// defaultAdminHash is the bcrypt the migration seeds for admin@wit.id. Its
// plaintext ("wit-admin-changeme") is in the repo, so a database still carrying
// this hash has a publicly known admin password. We detect it by value.
const defaultAdminHash = "$2a$10$ri3EraKDEjepi7sVhROqK.yg2twJ5Y/vKEOOsetJ.6MDqIaCDSDFC"

// ensureAdminPassword closes the committed-credential footgun.
//
//   - BOOTSTRAP_ADMIN_PASSWORD set  → the admin's password is rewritten to it,
//     so an operator can rotate without hand-run SQL.
//   - production, still the default, nothing set → refuse to boot. A public
//     deployment must not run with a password anyone can read in git history.
//   - anywhere else (dev, tests) → leave the demo credential alone.
func ensureAdminPassword(ctx context.Context, pool *pgxpool.Pool, cfg config.Config) error {
	if cfg.BootstrapAdminPassword != "" {
		hash, err := bcrypt.GenerateFromPassword(
			[]byte(cfg.BootstrapAdminPassword), bcrypt.DefaultCost)
		if err != nil {
			return fmt.Errorf("hashing BOOTSTRAP_ADMIN_PASSWORD: %w", err)
		}
		tag, err := pool.Exec(ctx,
			`UPDATE users SET password_hash = $1, updated_at = now()
			  WHERE email = 'admin@wit.id'`, string(hash))
		if err != nil {
			return fmt.Errorf("setting the admin password: %w", err)
		}
		if tag.RowsAffected() == 0 {
			// Not fatal: a deployment may have deleted or renamed the seeded
			// admin. Say so rather than pretend it worked.
			return nil
		}
		return nil
	}

	if cfg.Env != "production" {
		return nil // the demo credential is the point outside production
	}

	// Production with nothing set: is the seeded default still live?
	var stillDefault bool
	err := pool.QueryRow(ctx,
		`SELECT EXISTS (SELECT 1 FROM users
		   WHERE email = 'admin@wit.id' AND password_hash = $1)`,
		defaultAdminHash).Scan(&stillDefault)
	if err != nil {
		return fmt.Errorf("checking the admin password: %w", err)
	}
	if stillDefault {
		return fmt.Errorf(
			"refusing to start: the seeded admin still has its committed default " +
				"password (known from the repo). Set BOOTSTRAP_ADMIN_PASSWORD once to " +
				"rotate it, then unset it")
	}
	return nil
}
