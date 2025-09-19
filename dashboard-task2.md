# Dashboard Task 2 — Single-page UX for Uploads and Subdomain Assignment (no full page redirects)

Objective
- Design a dashboard-centric UX where users can upload a single HTML file or a ZIP (multiple files) and choose a subdomain within a modal/popup, without navigating away from the dashboard.
- Use lvh.me during local development so any subdomain (e.g., mysite.lvh.me) resolves to localhost.
- Keep CSP strict: avoid inline scripts; use a single external JS file for dashboard interactions.

Key UX Principles
- Stay on /dashboard at all times; use modals/popovers for flows.
- Real-time validation (subdomain availability, allowed characters) before submission.
- Clear, accessible states: idle → selecting → validating → uploading → processing → success/error.

UI Components (Dashboard page)
- Upload button: primary action button in the “Quick Actions” section that opens the modal.
- Upload modal (no full page reload):
  - Tabs or radio for type: “Single HTML” | “ZIP (multiple files)”.
  - File selector (drag-and-drop + browse button). Show filename(s), size.
  - Subdomain input with helper text and availability check button.
  - Base domain hint: “Your site will be available at https://<subdomain>.{{BASE_DOMAIN}}”. During dev, BASE_DOMAIN=lvh.me.
  - Submit button: “Deploy Site”. Disabled until validations pass.
  - Cancel/Close button.
- Inline validations:
  - Subdomain regex: ^[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])$ (1–63 chars; no leading/trailing hyphen).
  - File type: .html for single upload; .zip for multi.
  - Size limits (configurable): e.g., 5 MB HTML, 25 MB ZIP in dev.
- Progress + Status area inside modal:
  - “Validating subdomain …”, “Uploading … 42%”, “Processing ZIP …”, “Sanitizing HTML …”.
- Success state:
  - Show a link to the new site: https://<subdomain>.{{BASE_DOMAIN}}
  - Button: “Open Site”, “Close”.
- Error states:
  - Clear message + remediation tips (e.g., “Subdomain already taken. Try another name.”).

Accessibility & Semantics
- Modal uses ARIA roles: role="dialog", aria-modal="true", focus trapping, ESC to close.
- Labels associated with inputs; error messages announced via aria-live="polite".

Client-side Interaction Contract (no inline JS)
- One static file (e.g., /static/dashboard.js) loaded on dashboard only.
- Events:
  - #btn-upload click → open modal
  - #file-input change → validate file type/size → update UI
  - #subdomain-input input → debounce → optional availability check
  - #check-subdomain-btn click → call POST /api/sites/check-subdomain
  - #deploy-btn click → POST multipart form to /api/upload
- JSON shapes:
  - POST /api/sites/check-subdomain
    - Request: { subdomain: string }
    - Response 200: { available: boolean }
    - Response 400: { error: string }
  - POST /api/upload (multipart/form-data)
    - Fields: type=html|zip, subdomain=<string>, file=<binary>
    - Response 200: { siteId: string, subdomain: string, url: string }
    - Response 4xx/5xx: { error: string }

States and Transitions
- Idle → Modal Open → Input Valid → Availability OK → Uploading → Processing → Success | Error
- Close modal returns to idle without page reload; dashboard list can optionally refresh via GET /api/sites.

Visual Design Notes
- Keep existing dashboard cards; add an “Upload Files” primary button (not clickable placeholder).
- Modal styling consistent with existing palette (blue accents #2563eb, gray text #374151/#6b7280).
- Avoid external fonts; rely on system font stack.

Dev/Prod Domains
- Dev: BASE_DOMAIN=lvh.me; show sample URL “https://mysite.lvh.me:{{PORT}}” if port visible.
- Prod: BASE_DOMAIN=your-domain.tld; same flow, different hint.

Edge Cases
- ZIP without index.html → error with guidance.
- Path traversal attempts in ZIP (ZipSlip) → block and error.
- Duplicate subdomain → suggest random suffix button.
- File too large → error; recommend optimizing.
- Session expired → redirect to /login (server will do this).

Acceptance Criteria (UI)
- All interactions occur on /dashboard without a full page reload.
- Subdomain validation prevents submitting invalid names.
- Availability check reflects accurate state.
- Uploads display progress and end in a success state with a working link (in dev using lvh.me).
- Errors are readable, actionable, and accessible.

Out of Scope for Task 2 (Dashboard)
- Custom domains mapping UI
- Advanced site settings and analytics
- Multi-user team features
