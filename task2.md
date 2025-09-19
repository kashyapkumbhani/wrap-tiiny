# Task 2 — Uploads API, Storage, and Single-page Dashboard Flow

Objective
- Implement backend endpoints and storage flow to support uploading a single HTML file or a ZIP (multiple files) and assigning a subdomain in one dashboard interaction (modal), staying on /dashboard.
- Use lvh.me for development subdomains; keep code configurable to switch to production base domain later.

Includes
- This task references the dashboard UX/design spec in dashboard-task2.md for front-end behavior and states.

Scope
- Backend:
  - POST /api/sites/check-subdomain — validate format and availability.
  - POST /api/upload — accept single HTML or ZIP, sanitize/validate, and deploy to sites/<id>/ with index.html.
  - GET /api/sites — list user’s sites for UI refresh after deploy.
- Storage:
  - Local filesystem storage in sites/<userId>/<siteId>/, predictable layout; sanitize/validate ZIP contents.
- Sanitization and Security:
  - Sanitize uploaded HTML; disallow scripts/inline event handlers; enforce safe MIME.
  - Strict CSP remains; dashboard uses external JS file only.
- Config:
  - BASE_DOMAIN env-driven: default lvh.me in dev; your-domain.tld in prod.
  - Size limits: HTML up to 5 MB, ZIP up to 25 MB (configurable via env).

Non-Goals
- Custom domain mapping and SSL automation.
- Background job queue for heavy ZIP processing (handle in-process for now, with timeouts).

API Design
- POST /api/sites/check-subdomain
  - Auth: required (session)
  - Body: { subdomain: string }
  - Validations: regex ^[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])$
  - Behavior: return { available: boolean }
- POST /api/upload
  - Auth: required (session)
  - Content-Type: multipart/form-data
  - Fields: type=html|zip, subdomain, file
  - Behavior:
    1) Validate subdomain format and availability for this user (unique across all users globally).
    2) If type=html: ensure .html, enforce size limit, sanitize, store as sites/<userId>/<siteId>/index.html
    3) If type=zip: check .zip, enforce size limit, extract to temp, verify index.html exists, sanitize key HTML(s), store all under sites/<userId>/<siteId>/
    4) Insert site record if new; return canonical URL https://<subdomain>.<BASE_DOMAIN>
  - Responses:
    - 200: { siteId, subdomain, url }
    - 4xx: { error }
- GET /api/sites
  - Auth: required (session)
  - Response: [{ id, subdomain, status, created_at }]

Filesystem Layout
- sites/<userId>/<siteId>/index.html
- sites/<userId>/<siteId>/assets/... (if ZIP)
- tmp/ for upload buffers and ZIP extraction

Sanitization
- Server-side HTML sanitization removes <script>, event handlers (on*), javascript: URLs.
- Enforce Content-Type and extension checks.

Env Vars
- BASE_DOMAIN (default: lvh.me)
- MAX_HTML_BYTES (default: 5_000_000)
- MAX_ZIP_BYTES (default: 25_000_000)

Acceptance Criteria (Backend)
- Robust format/availability checks for subdomain.
- Valid HTML/ZIP uploads are processed, sanitized, and deployed.
- Returned URL uses BASE_DOMAIN; in dev, subdomain.lvh.me resolves locally.
- GET /api/sites returns the user’s sites; dashboard can refresh without page reload.
- Input and size errors return 4xx with clear error messages.

Security Notes
- Rate-limit /api/upload and /api/sites/check-subdomain separately (stricter than general requests).
- Reject archives with path traversal, symlinks, or unsupported types.
- All actions require a valid session; expired session redirects to /login.

Dependencies (if needed in Task 2)
- multer for handling multipart uploads.
- sanitize-html for HTML sanitization.
- unzipper or yauzl for ZIP processing (prefer mature, maintained library).

Next Steps After Task 2
- Implement static serving per subdomain (nginx reverse proxy + server Host header mapping) for preview in dev.
- Add admin delete/disable site endpoints.
