# Analytics Feature – Cloudflare Radar IP Intelligence

Purpose
- Capture basic visitor network attributes using Cloudflare Radar (ip-check-perf.radar.cloudflare.com/api/info) on first visit.
- Store a visit record in our backend for analytics.
- Provide a dashboard action button that opens a popup showing the visitor’s analytics data (and optionally recent visits in future iterations).

Reference API
- Endpoint: https://ip-check-perf.radar.cloudflare.com/api/info
- Returns JSON for the caller’s public IP (no API key):
  {
    "colo": "BOM",
    "asn": 24560,
    "continent": "AS",
    "country": "IN",
    "region": "Gujarat",
    "city": "Ahmedabad",
    "latitude": "23.02579",
    "longitude": "72.58727",
    "ip_address": "2401:4900:8899:758b:1860:a328:e480:977a",
    "ip_version": "IPv6"
  }

Important constraints and approach
- The Cloudflare endpoint returns info for the requester’s IP. That means:
  - If the BROWSER fetches it, we get the visitor’s IP details (desired).
  - If our SERVER fetches it, we get our server’s IP (not desired), unless the service supports forwarding headers (not guaranteed here).
- Browser CORS: If the endpoint disallows CORS in some environments, direct browser fetch may fail. In that case, we’ll use a server-side proxy endpoint under our domain that forwards the request and returns the JSON response to the browser. This proxy must not leak secrets and should set appropriate CORS headers.

Data we plan to collect per visit
- From Cloudflare: colo, asn, continent, country, region, city, latitude, longitude, ip_address, ip_version.
- From browser: url (location.href), referrer (document.referrer), userAgent (navigator.userAgent), timezone (Intl.DateTimeFormat().resolvedOptions().timeZone), language (navigator.language), timestamp (new Date().toISOString()).
- Privacy note: Consider hashing or truncating IPs before storage depending on compliance requirements (see Privacy & Compliance section).

High-level flow
1) On first page load per session, attempt to fetch visitor info from Cloudflare.
   - If success, store in memory (and optionally sessionStorage to avoid repeat calls).
   - If CORS error, call our proxy endpoint instead (e.g., GET /api/analytics/ipinfo-proxy) or gracefully skip.
2) POST a visit record to our backend (e.g., POST /api/analytics/visit) with the collected fields.
3) Dashboard UI: An "Analytics" action button opens a popup with the visitor’s network attributes and page metadata.
4) Future: Popup can optionally fetch recent aggregated visits (GET /api/analytics/recent?limit=50) for richer analytics.

Backend endpoints (proposed)
- POST /api/analytics/visit
  - Body (JSON):
    {
      colo, asn, continent, country, region, city, latitude, longitude,
      ip_address, ip_version, url, referrer, userAgent, timezone, language, timestamp
    }
  - Returns: { ok: true, id: "..." }
- GET /api/analytics/recent?limit=50 (optional future)
  - Returns: array of recent visit records for display/aggregation.
- GET /api/analytics/ipinfo-proxy (only if needed for CORS fallback)
  - Server fetches Cloudflare endpoint and returns JSON (no caching of PII at proxy).

Suggested storage schema (generic)
- Relational example (PostgreSQL):
  visits(
    id UUID PK,
    created_at TIMESTAMPTZ,
    url TEXT,
    referrer TEXT,
    user_agent TEXT,
    timezone TEXT,
    language TEXT,
    colo TEXT,
    asn INTEGER,
    continent TEXT,
    country TEXT,
    region TEXT,
    city TEXT,
    latitude NUMERIC(9,5),
    longitude NUMERIC(9,5),
    ip_address TEXT,          -- optionally hashed/anonymized
    ip_version TEXT
  )

Dashboard UI – HTML structure (popup)
- Add an action button in the dashboard:
  <button id="open-analytics-btn" type="button" aria-haspopup="dialog" aria-controls="analytics-popup">Analytics</button>

- Popup container (hidden by default). This can be injected by analytics.js or placed in HTML:
  <div id="analytics-popup" class="analytics-popup" role="dialog" aria-modal="true" aria-labelledby="analytics-title" hidden>
    <div class="analytics-backdrop" data-action="close"></div>
    <div class="analytics-dialog" role="document">
      <header class="analytics-header">
        <h2 id="analytics-title">Visitor Analytics</h2>
        <button class="analytics-close" type="button" aria-label="Close" data-action="close">×</button>
      </header>
      <section class="analytics-content">
        <div class="analytics-grid">
          <!-- Filled dynamically with rows like: -->
          <!-- <div class="row"><div class="k">IP Address</div><div class="v">...</div></div> -->
        </div>
      </section>
      <footer class="analytics-footer">
        <button class="analytics-close" type="button" data-action="close">Close</button>
      </footer>
    </div>
  </div>

- Minimal CSS (example, can be moved to stylesheet):
  <style>
    .analytics-popup[hidden] { display: none; }
    .analytics-backdrop { position: fixed; inset: 0; background: rgba(0,0,0,0.4); }
    .analytics-dialog { position: fixed; inset: 10% 50% auto 50%; transform: translate(-50%, 0); background: #fff; border-radius: 8px; width: min(720px, 90vw); box-shadow: 0 10px 30px rgba(0,0,0,0.2); }
    .analytics-header, .analytics-footer { padding: 12px 16px; border-bottom: 1px solid #eee; }
    .analytics-footer { border-top: 1px solid #eee; border-bottom: 0; }
    .analytics-content { padding: 16px; max-height: 60vh; overflow: auto; }
    .analytics-close { background: transparent; border: 0; font-size: 20px; cursor: pointer; }
    .analytics-grid { display: grid; grid-template-columns: 1fr 2fr; gap: 8px 16px; }
    .analytics-grid .k { font-weight: 600; color: #555; }
    .analytics-grid .v { color: #111; word-break: break-word; }
  </style>

JavaScript responsibilities (analytics.js)
- Functions and responsibilities:
  - init(options): configure endpoints, attach button handler, optionally fetch & store visitor info.
  - fetchVisitorInfo(): fetch Cloudflare JSON from the browser; fallback to proxy if needed.
  - postVisitRecord(info): POST the visit record to our backend.
  - openPopup(info): ensure popup exists, render data, show.
  - closePopup(): hide and restore focus.
  - getPopupHTML(info): returns the HTML content for the popup body from provided info.
  - attachButton(selector): binds the dashboard action button to open the popup.

Event flow
- Document ready -> init({ storageEndpoint: "/api/analytics/visit" })
- If not yet collected this session: fetchVisitorInfo() -> postVisitRecord()
- User clicks Analytics button -> openPopup() renders visitor data from cache/local state

Edge cases & fallbacks
- CORS failure to Cloudflare: try proxy endpoint, otherwise skip network attributes and only log basic page metadata.
- IPv6 vs IPv4: the endpoint supports both; store ip_version for clarity.
- User on very slow network: set a fetch timeout (e.g., 2500ms) and recover gracefully.
- Private browsing or blocked third-party: handle fetch errors silently, still show popup with any available data.

Privacy & compliance notes
- IP addresses may be considered personal data in many jurisdictions.
- Mitigations (choose based on policy):
  - Hash IP address client-side (SHA-256) before sending; store hash only.
  - Truncate IPv4 to /24 (e.g., 203.0.113.xxx) and IPv6 to /48.
  - Do not collect precise latitude/longitude; keep only city/region/country.
  - Respect user consent (CMP). If analytics consent not granted, skip collection.
- Never expose stored IP info on public endpoints without authorization.

Testing plan
- Manual: open site, verify popup opens, check fields populate from Cloudflare response.
- Network: simulate CORS error and verify proxy fallback.
- Backend: verify POST /api/analytics/visit receives well-formed payload.

Rollout plan
- Phase 1: Client-only fetch + local popup for current visitor.
- Phase 2: Store records via backend POST.
- Phase 3: Add aggregated analytics to popup using backend GET.

Open questions
- Backend stack and exact endpoint paths?
- Storage policy for IPs (hash/truncate)?
- Should we sample traffic or collect 100%?

Next steps
- Confirm backend endpoints and privacy policy.
- Implement analytics.js per stubs with careful error handling and timeouts.
- Integrate HTML container or allow JS to inject it dynamically.
- Wire up dashboard action button.
