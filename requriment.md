# Tinny (TinyHost-like) — Product Requirements and Architecture Overview

## 1. Purpose and Vision
Tinny is a self-hosted, lightweight alternative to TiinyHost for quickly publishing small static sites on subdomains (and later custom domains). The goal is to run reliably on a single server with minimal dependencies, a small footprint, and a clear module structure. Start as a single-process monolith and split into small, focused files as features mature.

## 2. Design Principles
- Simplicity first: one Node.js server (LTS 18–22), minimal packages, no heavy frameworks.
- Clear boundaries: each feature (uploads, storage, auth, admin, security, billing later) in its own small module/file.
- Self-hostable: defaults to local storage and SQLite; can switch to S3/MinIO and Postgres without app rewrites.
- Production-first: include CSP, sanitization, rate limits, logging, and backups from Day 1.
- Observability: structured logs, health endpoints, and hooks for metrics.
- Incremental complexity: ship Phase 1 as a robust MVP; add jobs, custom domains, billing, and analytics later.

## 3. High-Level Architecture
- Single Node.js process (server.js) acts as the glue layer.
- HTTP behind Nginx (or Caddy): terminates TLS, passes Host header for wildcard subdomains.
- Feature modules are small files (e.g., uploads.js, storage.js, auth.js, admin.js, security.js) imported by server.js.
- Storage abstraction supports local filesystem initially; S3/MinIO adapter added later.
- Metadata database abstraction supports SQLite locally and Postgres in production.

## 4. Core Feature Modules (Phase 1)
- Uploads: accept single HTML file or ZIP; validate, sanitize, unpack, and place under a predictable path.
- Storage: local FS layout sites/<siteId>/index.html; optional adapter for object storage later.
- Site Serving: resolve target site by Host header (wildcard subdomains) and serve static assets efficiently.
- Auth: email/password for owner and admin; session or token-based; minimal password reset flow via SMTP.
- Admin: minimal server-rendered pages for site listing, quotas, basic actions, and user management.
- Security: CSP headers, HTML sanitization (strip scripts and on* attributes), safe MIME types, and rate limits.
- Logging & Monitoring: structured logs (request/response/err), basic healthcheck, hooks for metrics later.
- Backups: simple tar/rsync-friendly layout; scheduled job or manual command to archive data and metadata.

## 5. Phase 1.5 / Phase 2 (Later)
- Custom Domains: map apex/subdomain to a user’s site; verification and SSL (via reverse proxy automation).
- Jobs/Queues: background processing for emails, ZIP extraction, backups, and async tasks.
- Billing: simple metered usage or plan tiers; webhooks and admin overrides.
- Analytics: lightweight pageview counts or external exporter; privacy-first.
- Team/Collab: invite-based access to manage the same site(s).

## 6. Data Model (Conceptual)
- User: id, email, password hash, role (admin/owner), status, createdAt.
- Site: id, ownerId, subdomain, status, createdAt, updatedAt.
- Deployment/Version (optional in P1): id, siteId, source (single-file or ZIP), metadata, createdAt.
- Usage/Quota (optional in P1): siteId, storageBytes, requestCount, lastResetAt.
- Audit/Event (optional in P1): who, what, when for admin visibility.

## 7. Request Lifecycle (Typical)
1) Client sends request to subdomain (e.g., https://myuser.example.tld).  
2) Nginx passes through Host header and forwards to Node.  
3) Server resolves site by subdomain; performs rate-limit checks and security headers.  
4) Static content served from storage adapter; logs request; returns response.  
5) Admin routes require authentication; POST actions validate CSRF strategy (if introduced later) and permissions.

## 8. Operational Model
- Reverse Proxy: Nginx handles TLS, wildcard cert, and caching headers; Node runs on a high port.
- Environments: dev (SQLite, local FS) vs prod (Postgres optional, S3/MinIO optional); feature-parity maintained.
- Backup Strategy: archive data/ and DB on schedule; restore tested regularly; offsite copy recommended.
- Recovery: stateless app; restore storage + DB from backup to resume service.

## 9. Storage Layout (Local FS, Phase 1)
- sites/<siteId>/index.html and optional assets.  
- tmp/ for in-flight uploads and ZIP extraction.  
- logs/ for application logs (rotation handled by external tools or logging library).  
- data/ for SQLite DB and misc metadata if needed.

## 10. Security Posture
- Sanitize uploaded HTML; deny dangerous content; enforce safe MIME and size limits.  
- Strict CSP by default (script-src 'none' unless explicitly allowed); disallow inline scripts.  
- Rate limit per IP and per route; admin routes stricter.  
- Strong password hashing; sessions secured; transport over TLS only.  
- Minimal attack surface: only necessary endpoints exposed; validate all inputs.  
- Audit logs for admin-critical actions (add in Phase 1.5 if needed).

## 11. Minimal Dependencies Philosophy
- Keep production deps under control; rely on standard libraries when possible.  
- Prefer battle-tested libraries over niche micro-libs.  
- Avoid heavy ORMs; use better-sqlite3 or pg directly; keep schema and queries simple.  
- Logging is structured and fast; avoid over-customization early.  
- Optional adapters (S3, queue) are pluggable and only added when needed.

## 12. Performance and Scale Strategy
- Efficient static file serving from disk with proper caching headers via Nginx.  
- Node process kept lean; CPU-bound work (e.g., ZIP unpack) can be offloaded to background job later.  
- Horizontal scale later by running multiple Node instances behind Nginx; storage and DB become shared services.  
- Monitor p95 latency and error rates; profile hotspots prior to optimization.  

## 13. Roadmap and Milestones
- Phase 1 (MVP, production-ready basics): uploads, storage, site serving via subdomains, auth, admin basics, CSP/sanitization, rate limits, logging, backups.  
- Phase 1.5: custom domains, job queue, better admin UX, quotas/usage accounting.  
- Phase 2: billing, analytics, teams, audit logs, metrics exporter, global CDN option.  

## 14. Non-Goals (For Now)
- Heavy server-side rendering frameworks or SPAs for admin.  
- Complex multi-region deployments.  
- Large plugin ecosystems or proprietary SDKs.  
- Realtime features or websockets beyond essentials.  

## 15. Collaboration and Module Boundaries
- Each module has a narrow purpose and clear inputs/outputs (function signatures, DTOs).  
- server.js wires modules together; modules don’t reach across boundaries directly.  
- Common utilities (validation, errors, logging) live in a small shared area and stay thin.  
- Tests are written per module; admin flows get basic integration tests.  

## 16. Success Criteria
- Clean, readable single-file server that can be split without refactor pain.  
- Deployable on a single VPS with Nginx; no external managed services required.  
- Can host thousands of tiny static sites with predictable performance.  
- Clear path to enable custom domains, queues, and billing without rewriting core logic.  

---
This document is an implementation guide and shared understanding, not a code spec. Keep the footprint small, the boundaries crisp, and iterate in small, testable steps.