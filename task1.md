# Task 1 — Bootstrap the project and define initial SQLite schema (no code)

Objective
- Create the minimal file/module structure and define the initial data model so implementation can start immediately in Task 2.

Deliverables (files to create; empty or with TODO headers only in Task 2)
- server.js — single entrypoint; wires modules; sets security headers, rate limits, logging; mounts routes.
- homepage.js — renders landing page with simple upload CTA and login link.
- auth.js — handles login and signup (combined module); basic email/password flows and logout.
- dashboard.js — authenticated area showing sites list and upload action.
- db.js — database bootstrap for SQLite; provides a small query wrapper and connection lifecycle.
- migrations/001_init.sql — schema creation for users, sites, sessions (if needed), and audit/events (optional later).

Initial routes and behaviors (spec)
- Public
  - GET / — homepage; explain service; CTA to login or upload after auth.
  - GET /login — login page; email, password.
  - POST /login — authenticate; on success set session cookie and redirect to /dashboard; on failure show error.
  - GET /signup — signup page; email, password, confirm; basic validations (email format, password length >= 8).
  - POST /signup — create user; on success set session cookie and redirect to /dashboard.
  - GET /logout — clear session and redirect to /.
- Authenticated
  - GET /dashboard — list user’s sites (none initially); link to upload and account settings.

Security, policies, and middleware (to be wired in server.js)
- Security headers: CSP (default deny scripts), X-Content-Type-Options, X-Frame-Options, Referrer-Policy, HSTS via proxy.
- Rate limits: per-IP for auth routes (stricter), general limits for public routes.
- Sessions: signed cookie session; httpOnly, secure (behind TLS), sameSite=lax.
- Input hygiene: validate and sanitize inputs for auth forms; normalize emails.
- Logging: structured request logging + error logging.

SQLite data model (Phase 1)
- users
  - id (string ULID/UUID)
  - email (string, unique, lowercase)
  - password_hash (string, bcrypt)
  - role (enum: admin|user; default user)
  - created_at (timestamp, default now)
  - updated_at (timestamp)
- sites
  - id (string ULID/UUID)
  - owner_id (string -> users.id)
  - subdomain (string, unique, validated: [a-z0-9-])
  - status (enum: active|disabled)
  - created_at (timestamp)
  - updated_at (timestamp)
- Optional later tables (define but may postpone inserts/logic)
  - events (id, user_id, type, meta JSON, created_at) — for audits/analytics later
  - quotas (site_id, storage_bytes, request_count, window_start) — for rate/quota accounting later

Configuration and env (referenced, not implemented)
- PORT (default 3000)
- SESSION_SECRET (required)
- DB_TYPE=sqlite (for now)
- SQLITE_PATH=./data/metadata.db

User flows to support
- Signup ➜ Redirect to dashboard (empty state) ➜ See guidance to create first site.
- Login ➜ Dashboard ➜ Logout.

Non-goals in Task 1
- File uploads, ZIP processing, subdomain serving, custom domains, S3 adapters, or billing. These start in Task 2+.

Acceptance criteria
- The files listed in Deliverables exist with clear top-of-file TODO comments (to be implemented in Task 2).
- migrations/001_init.sql includes CREATE TABLE statements for users and sites (and stubs for optional tables).
- db.js documents connection strategy for better-sqlite3 (sync) and path resolution for SQLITE_PATH.
- server.js responsibilities are documented: middleware order, route mounting plan, error handling strategy.
- No business logic code yet — only structure and schema defined.

Notes for the next task (Task 2 preview)
- Implement auth: bcrypt hashing, cookie-session, basic views (EJS or minimal templates).
- Implement dashboard list (no uploads yet).
- Add request logging and CSP headers.
- Prepare initial tests for auth routes and db bootstrap.
