"use strict";
/**
 * analytics.js (scaffold)
 *
 * Purpose: Client-side module for fetching visitor network attributes via Cloudflare Radar
 *          and showing a popup in the dashboard. This file is a scaffold (no network logic yet)
 *          per the plan in analytics-feature.md. Implementations are TODO and will be completed
 *          after confirmation.
 *
 * See: ./analytics-feature.md for the full design and HTML structure.
 */
(function (global) {
  const DEFAULTS = {
    cfInfoUrl: "https://ip-check-perf.radar.cloudflare.com/api/info",
    storageEndpoint: "/api/analytics/visit",     // backend POST URL
    analyticsEndpoint: "/api/analytics/dashboard", // dashboard analytics data
    proxyEndpoint: "/api/analytics/ipinfo-proxy", // optional CORS fallback
    buttonSelector: "#open-analytics-btn",
    dashboardSelector: ".analytics-dashboard-btn", // dashboard button selector
    useSessionCache: true,
    sessionKey: "analytics_cf_info",
    autoTrack: true,                              // automatically track visitors
    trackSubdomains: true,                        // track across subdomains
    trackingDelay: 100,                          // delay before tracking (ms)
    respectDoNotTrack: true,                     // respect DNT header
    enablePopup: false,                          // disable popup by default for auto-tracking
    enableDashboard: true,                       // enable dashboard analytics
    trackIndividually: true,                     // track each site individually
  };

  const state = {
    options: { ...DEFAULTS },
    visitorInfo: null,
    popupEl: null,
    lastError: null,
  };

  // DOM helpers
  function ensurePopupContainer() {
    if (state.popupEl && document.body.contains(state.popupEl)) return state.popupEl;

    const wrapper = document.createElement("div");
    wrapper.id = "analytics-popup";
    wrapper.className = "analytics-popup";
    wrapper.setAttribute("role", "dialog");
    wrapper.setAttribute("aria-modal", "true");
    wrapper.setAttribute("aria-labelledby", "analytics-title");
    wrapper.hidden = true;
    
    const siteInfo = getSiteIdentifier();
    wrapper.innerHTML = `
      <div class="analytics-backdrop" data-action="close"></div>
      <div class="analytics-dialog" role="document">
        <header class="analytics-header">
          <h2 id="analytics-title">📊 Analytics Dashboard</h2>
          <div class="analytics-site-info">Site: ${escapeHtml(siteInfo.displayName)}</div>
          <button class="analytics-close" type="button" aria-label="Close" data-action="close">×</button>
        </header>
        <nav class="analytics-tabs">
          <button class="analytics-tab active" data-tab="visitor">Current Visitor</button>
          <button class="analytics-tab" data-tab="dashboard">Site Analytics</button>
          <button class="analytics-tab" data-tab="settings">Settings</button>
        </nav>
        <section class="analytics-content">
          <div class="analytics-tab-content" id="visitor-tab">
            <div class="analytics-grid"></div>
          </div>
          <div class="analytics-tab-content" id="dashboard-tab" hidden>
            <div class="analytics-loading">Loading analytics data...</div>
            <div class="analytics-dashboard-content"></div>
          </div>
          <div class="analytics-tab-content" id="settings-tab" hidden>
            <div class="analytics-settings-content">
              <h3>Analytics Settings</h3>
              <div class="setting-group">
                <label><input type="checkbox" id="track-individual"> Track each page individually</label>
              </div>
              <div class="setting-group">
                <label><input type="checkbox" id="respect-dnt"> Respect Do Not Track</label>
              </div>
              <div class="setting-group">
                <label>Dashboard Days: <select id="dashboard-days">
                  <option value="7">7 days</option>
                  <option value="30" selected>30 days</option>
                  <option value="90">90 days</option>
                </select></label>
              </div>
            </div>
          </div>
        </section>
        <footer class="analytics-footer">
          <div class="analytics-actions">
            <button class="analytics-refresh" type="button" data-action="refresh">🔄 Refresh</button>
            <button class="analytics-export" type="button" data-action="export">📊 Export</button>
          </div>
          <button class="analytics-close" type="button" data-action="close">Close</button>
        </footer>
      </div>`;

    document.body.appendChild(wrapper);
    injectBaseStyles();

    wrapper.addEventListener("click", async (e) => {
      const target = e.target;
      if (!(target instanceof Element)) return;
      
      if (target.matches("[data-action=close]")) {
        closePopup();
      } else if (target.matches("[data-action=refresh]")) {
        await refreshDashboard();
      } else if (target.matches("[data-action=export]")) {
        exportAnalytics();
      } else if (target.matches(".analytics-tab")) {
        switchTab(target.dataset.tab);
      }
    });

    state.popupEl = wrapper;
    return wrapper;
  }

  function injectBaseStyles() {
    if (document.getElementById("analytics-base-styles")) return;
    const style = document.createElement("style");
    style.id = "analytics-base-styles";
    style.textContent = `
      .analytics-popup[hidden] { display: none; }
      .analytics-backdrop { position: fixed; inset: 0; background: rgba(0,0,0,0.4); z-index: 10000; }
      .analytics-dialog { position: fixed; inset: 5% 50% auto 50%; transform: translate(-50%, 0); background: #fff; border-radius: 8px; width: min(900px, 95vw); box-shadow: 0 20px 40px rgba(0,0,0,0.3); z-index: 10001; }
      .analytics-header { padding: 16px 20px; border-bottom: 1px solid #eee; display: flex; align-items: center; justify-content: space-between; background: #f8f9fa; }
      .analytics-header h2 { margin: 0; font-size: 18px; }
      .analytics-site-info { font-size: 14px; color: #666; margin-left: 10px; }
      .analytics-tabs { display: flex; background: #f8f9fa; border-bottom: 1px solid #eee; }
      .analytics-tab { padding: 12px 20px; border: 0; background: transparent; cursor: pointer; border-bottom: 2px solid transparent; transition: all 0.2s; }
      .analytics-tab:hover { background: #e9ecef; }
      .analytics-tab.active { background: #fff; border-bottom-color: #007bff; color: #007bff; font-weight: 500; }
      .analytics-content { padding: 20px; max-height: 70vh; overflow: auto; }
      .analytics-tab-content[hidden] { display: none; }
      .analytics-footer { padding: 16px 20px; border-top: 1px solid #eee; display: flex; justify-content: space-between; align-items: center; background: #f8f9fa; }
      .analytics-actions { display: flex; gap: 8px; }
      .analytics-actions button { padding: 8px 12px; border: 1px solid #ddd; border-radius: 4px; background: #fff; cursor: pointer; font-size: 13px; }
      .analytics-actions button:hover { background: #f8f9fa; }
      .analytics-close { background: transparent; border: 0; font-size: 18px; cursor: pointer; padding: 4px; }
      .analytics-grid { display: grid; grid-template-columns: 1fr 2fr; gap: 12px 20px; }
      .analytics-grid .k { font-weight: 600; color: #555; }
      .analytics-grid .v { color: #111; word-break: break-word; font-family: monospace; }
      .analytics-loading { text-align: center; padding: 40px; color: #666; }
      .analytics-dashboard-content { display: grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap: 20px; }
      .analytics-card { background: #f8f9fa; padding: 16px; border-radius: 6px; border: 1px solid #e9ecef; }
      .analytics-card h4 { margin: 0 0 12px 0; color: #333; font-size: 14px; font-weight: 600; }
      .analytics-metric { font-size: 24px; font-weight: bold; color: #007bff; margin-bottom: 4px; }
      .analytics-label { font-size: 12px; color: #666; text-transform: uppercase; }
      .setting-group { margin: 12px 0; }
      .setting-group label { display: flex; align-items: center; gap: 8px; font-size: 14px; }
    `;
    document.head.appendChild(style);
  }

  // Rendering
  function getPopupHTML(info) {
    // Returns inner rows HTML for .analytics-grid based on info object
    const rows = buildKeyValueRows(info);
    return rows.join("");
  }

  function buildKeyValueRows(info) {
    const data = info || {};
    const entries = [
      ["IP Address", data.ip_address],
      ["IP Version", data.ip_version],
      ["ASN", data.asn],
      ["Continent", data.continent],
      ["Country", data.country],
      ["Region", data.region],
      ["City", data.city],
      ["Latitude", data.latitude],
      ["Longitude", data.longitude],
      ["Colo (Cloudflare PoP)", data.colo],
      ["URL", safe(() => window.location.href)],
      ["Referrer", safe(() => document.referrer)],
      ["User Agent", safe(() => navigator.userAgent)],
      ["Timezone", safe(() => Intl.DateTimeFormat().resolvedOptions().timeZone)],
      ["Language", safe(() => navigator.language)],
      ["Timestamp", new Date().toISOString()],
    ];
    return entries.map(([k, v]) => row(k, v));
  }

  function row(k, v) {
    const safeV = v == null ? "—" : String(v);
    return `<div class="row"><div class="k">${escapeHtml(k)}</div><div class="v">${escapeHtml(safeV)}</div></div>`;
  }

  function escapeHtml(str) {
    return String(str)
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  function safe(fn) {
    try { return fn(); } catch { return ""; }
  }

  // Utility functions for subdomain tracking
  function extractSubdomain(hostname) {
    if (!hostname || hostname === 'localhost') return '';
    const parts = hostname.split('.');
    if (parts.length <= 2) return ''; // no subdomain (e.g., example.com)
    return parts[0]; // first part is subdomain (e.g., 'blog' from 'blog.example.com')
  }

  function getOrCreateSessionId() {
    const key = 'analytics_session_id';
    let sessionId = sessionStorage.getItem(key);
    if (!sessionId) {
      sessionId = 'ses_' + Date.now().toString(36) + Math.random().toString(36).substr(2);
      sessionStorage.setItem(key, sessionId);
    }
    return sessionId;
  }

  function getVisitType() {
    const referrer = safe(() => document.referrer) || '';
    const currentDomain = safe(() => window.location.hostname) || '';
    
    if (!referrer) return 'direct';
    
    try {
      const referrerUrl = new URL(referrer);
      const referrerDomain = referrerUrl.hostname;
      
      // Same domain/subdomain
      if (referrerDomain === currentDomain || 
          referrerDomain.endsWith('.' + currentDomain.split('.').slice(-2).join('.')) ||
          currentDomain.endsWith('.' + referrerDomain.split('.').slice(-2).join('.'))) {
        return 'internal';
      }
      
      // Search engines
      const searchEngines = ['google', 'bing', 'yahoo', 'duckduckgo', 'baidu'];
      if (searchEngines.some(engine => referrerDomain.includes(engine))) {
        return 'search';
      }
      
      // Social media
      const socialSites = ['facebook', 'twitter', 'linkedin', 'instagram', 'pinterest', 'reddit'];
      if (socialSites.some(social => referrerDomain.includes(social))) {
        return 'social';
      }
      
      return 'referral';
    } catch {
      return 'unknown';
    }
  }

  function shouldTrack() {
    // Respect Do Not Track header
    if (state.options.respectDoNotTrack && navigator.doNotTrack === '1') {
      console.log('Analytics: Tracking disabled due to Do Not Track header');
      return false;
    }
    
    // Individual site tracking key (includes full path for unique tracking)
    const trackingKey = state.options.trackIndividually 
      ? 'analytics_tracked_' + window.location.hostname + '_' + Date.now().toString(36).slice(-4)
      : 'analytics_tracked_' + window.location.hostname;
      
    // For individual tracking, use shorter session keys to allow multiple visits per session
    if (!state.options.trackIndividually && sessionStorage.getItem(trackingKey)) {
      console.log('Analytics: Already tracked this session for', window.location.hostname);
      return false;
    }
    
    // Skip if localhost (unless explicitly enabled)
    if (window.location.hostname === 'localhost' && !state.options.trackLocalhost) {
      console.log('Analytics: Skipping localhost tracking');
      return false;
    }
    
    return true;
  }

  function markAsTracked() {
    const trackingKey = state.options.trackIndividually 
      ? 'analytics_tracked_' + window.location.hostname + '_' + Date.now().toString(36).slice(-4)
      : 'analytics_tracked_' + window.location.hostname;
    sessionStorage.setItem(trackingKey, Date.now().toString());
  }

  // Dashboard analytics functions
  async function fetchDashboardAnalytics(filters = {}) {
    if (!state.options.analyticsEndpoint) {
      console.warn('Analytics: No dashboard endpoint configured');
      return null;
    }
    
    try {
      const params = new URLSearchParams({
        hostname: filters.hostname || window.location.hostname,
        subdomain: filters.subdomain || extractSubdomain(window.location.hostname),
        days: filters.days || 30,
        limit: filters.limit || 100,
        ...filters
      });
      
      const response = await fetch(`${state.options.analyticsEndpoint}?${params}`, {
        method: 'GET',
        headers: { 'Accept': 'application/json' },
        signal: AbortSignal.timeout(10000)
      });
      
      if (!response.ok) {
        throw new Error(`Dashboard API returned ${response.status}`);
      }
      
      const data = await response.json();
      console.log('Analytics: Fetched dashboard data', data);
      return data;
      
    } catch (error) {
      console.warn('Analytics: Dashboard fetch failed:', error.message);
      return null;
    }
  }

  function getSiteIdentifier() {
    const hostname = window.location.hostname;
    const subdomain = extractSubdomain(hostname);
    return {
      hostname,
      subdomain,
      siteId: subdomain ? `${subdomain}.${hostname}` : hostname,
      displayName: subdomain ? `${subdomain} (${hostname})` : hostname
    };
  }

  async function openPopup(info) {
    const popup = ensurePopupContainer();
    const grid = popup.querySelector(".analytics-grid");
    if (grid) grid.innerHTML = getPopupHTML(info || state.visitorInfo);
    
    // Initialize settings with current values
    initializeSettings();
    
    popup.hidden = false;
    
    // Load dashboard data if analytics enabled
    if (state.options.enableDashboard) {
      await loadDashboardData();
    }
  }

  function switchTab(tabName) {
    const popup = state.popupEl;
    if (!popup) return;
    
    // Update tab buttons
    popup.querySelectorAll('.analytics-tab').forEach(tab => {
      tab.classList.toggle('active', tab.dataset.tab === tabName);
    });
    
    // Update tab content
    popup.querySelectorAll('.analytics-tab-content').forEach(content => {
      content.hidden = content.id !== `${tabName}-tab`;
    });
    
    // Load data for specific tabs
    if (tabName === 'dashboard' && state.options.enableDashboard) {
      loadDashboardData();
    }
  }

  function initializeSettings() {
    const popup = state.popupEl;
    if (!popup) return;
    
    const trackIndividualCheckbox = popup.querySelector('#track-individual');
    const respectDntCheckbox = popup.querySelector('#respect-dnt');
    const dashboardDaysSelect = popup.querySelector('#dashboard-days');
    
    if (trackIndividualCheckbox) {
      trackIndividualCheckbox.checked = state.options.trackIndividually;
      trackIndividualCheckbox.addEventListener('change', (e) => {
        state.options.trackIndividually = e.target.checked;
        console.log('Analytics: Individual tracking', e.target.checked ? 'enabled' : 'disabled');
      });
    }
    
    if (respectDntCheckbox) {
      respectDntCheckbox.checked = state.options.respectDoNotTrack;
      respectDntCheckbox.addEventListener('change', (e) => {
        state.options.respectDoNotTrack = e.target.checked;
        console.log('Analytics: DNT respect', e.target.checked ? 'enabled' : 'disabled');
      });
    }
    
    if (dashboardDaysSelect) {
      dashboardDaysSelect.addEventListener('change', (e) => {
        loadDashboardData({ days: parseInt(e.target.value) });
      });
    }
  }

  async function loadDashboardData(filters = {}) {
    const popup = state.popupEl;
    if (!popup) return;
    
    const loadingEl = popup.querySelector('.analytics-loading');
    const contentEl = popup.querySelector('.analytics-dashboard-content');
    
    if (loadingEl) loadingEl.style.display = 'block';
    if (contentEl) contentEl.innerHTML = '';
    
    try {
      const data = await fetchDashboardAnalytics(filters);
      if (loadingEl) loadingEl.style.display = 'none';
      
      if (data && contentEl) {
        contentEl.innerHTML = renderDashboardContent(data);
      } else if (contentEl) {
        contentEl.innerHTML = '<div class="analytics-loading">No dashboard data available. Configure analyticsEndpoint to enable.</div>';
      }
    } catch (error) {
      if (loadingEl) loadingEl.style.display = 'none';
      if (contentEl) contentEl.innerHTML = `<div class="analytics-loading">Error loading dashboard: ${error.message}</div>`;
    }
  }

  function renderDashboardContent(data) {
    const siteInfo = getSiteIdentifier();
    
    return `
      <div class="analytics-card">
        <h4>📊 Total Visits</h4>
        <div class="analytics-metric">${data.totalVisits || 0}</div>
        <div class="analytics-label">Last ${data.days || 30} days</div>
      </div>
      
      <div class="analytics-card">
        <h4>🌍 Unique Visitors</h4>
        <div class="analytics-metric">${data.uniqueVisitors || 0}</div>
        <div class="analytics-label">Unique IP addresses</div>
      </div>
      
      <div class="analytics-card">
        <h4>🔗 Current Site</h4>
        <div class="analytics-metric">${escapeHtml(siteInfo.hostname)}</div>
        <div class="analytics-label">Subdomain: ${siteInfo.subdomain || 'none'}</div>
      </div>
      
      <div class="analytics-card">
        <h4>📈 Top Countries</h4>
        <div class="analytics-metric">${(data.topCountries || []).slice(0, 3).map(c => c.country).join(', ') || 'N/A'}</div>
        <div class="analytics-label">Most common locations</div>
      </div>
      
      <div class="analytics-card">
        <h4>🚦 Traffic Sources</h4>
        <div class="analytics-metric">
          ${Object.entries(data.trafficSources || {}).map(([type, count]) => 
            `<div style="font-size: 14px; margin: 4px 0;">${type}: ${count}</div>`
          ).join('') || 'N/A'}
        </div>
        <div class="analytics-label">Visit types breakdown</div>
      </div>
      
      <div class="analytics-card">
        <h4>📱 Recent Visits</h4>
        <div style="font-size: 14px; max-height: 120px; overflow-y: auto;">
          ${(data.recentVisits || []).map(visit => 
            `<div style="margin: 4px 0; padding: 4px; background: #fff; border-radius: 3px;">
              <strong>${visit.country || 'Unknown'}</strong> - ${visit.city || 'Unknown'}<br>
              <small style="color: #666;">${new Date(visit.timestamp).toLocaleString()} - ${visit.visitType || 'direct'}</small>
            </div>`
          ).join('') || '<div style="color: #666;">No recent visits</div>'}
        </div>
      </div>
    `;
  }

  async function refreshDashboard() {
    await loadDashboardData();
  }

  function exportAnalytics() {
    const siteInfo = getSiteIdentifier();
    const data = {
      site: siteInfo,
      visitor: state.visitorInfo,
      timestamp: new Date().toISOString(),
      settings: state.options
    };
    
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    
    const a = document.createElement('a');
    a.href = url;
    a.download = `analytics-${siteInfo.hostname}-${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    
    console.log('Analytics: Data exported');
  }

  function closePopup() {
    if (state.popupEl) state.popupEl.hidden = true;
  }

  // Network (implementation)
  async function fetchVisitorInfo() {
    try {
      // First try direct fetch to Cloudflare
      const response = await fetch(state.options.cfInfoUrl, {
        method: 'GET',
        headers: { 'Accept': 'application/json' },
        signal: AbortSignal.timeout(2500) // 2.5s timeout
      });
      
      if (!response.ok) {
        throw new Error(`Cloudflare API returned ${response.status}`);
      }
      
      const data = await response.json();
      console.log('Analytics: Fetched visitor info from Cloudflare', data);
      return data;
      
    } catch (error) {
      console.warn('Analytics: Direct Cloudflare fetch failed:', error.message);
      
      // Try proxy fallback if available
      if (state.options.proxyEndpoint) {
        try {
          const proxyResponse = await fetch(state.options.proxyEndpoint, {
            method: 'GET',
            headers: { 'Accept': 'application/json' },
            signal: AbortSignal.timeout(2500)
          });
          
          if (!proxyResponse.ok) {
            throw new Error(`Proxy returned ${proxyResponse.status}`);
          }
          
          const proxyData = await proxyResponse.json();
          console.log('Analytics: Fetched visitor info via proxy', proxyData);
          return proxyData;
          
        } catch (proxyError) {
          console.warn('Analytics: Proxy fetch also failed:', proxyError.message);
        }
      }
      
      // Both methods failed, return null (graceful degradation)
      state.lastError = error;
      return null;
    }
  }

  async function postVisitRecord(info) {
    if (!state.options.storageEndpoint) {
      console.warn('Analytics: No storage endpoint configured, skipping POST');
      return { ok: false, skipped: true };
    }
    
    try {
      // Merge Cloudflare data with browser metadata
      const payload = {
        // Cloudflare data (may be null if fetch failed)
        ...(info || {}),
        // Browser metadata
        url: safe(() => window.location.href) || '',
        hostname: safe(() => window.location.hostname) || '',
        subdomain: extractSubdomain(safe(() => window.location.hostname) || ''),
        referrer: safe(() => document.referrer) || '',
        userAgent: safe(() => navigator.userAgent) || '',
        timezone: safe(() => Intl.DateTimeFormat().resolvedOptions().timeZone) || '',
        language: safe(() => navigator.language) || '',
        screenResolution: safe(() => `${screen.width}x${screen.height}`) || '',
        viewportSize: safe(() => `${window.innerWidth}x${window.innerHeight}`) || '',
        timestamp: new Date().toISOString(),
        // Session tracking
        sessionId: getOrCreateSessionId(),
        visitType: getVisitType()
      };
      
      const response = await fetch(state.options.storageEndpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        body: JSON.stringify(payload),
        signal: AbortSignal.timeout(5000) // 5s timeout for POST
      });
      
      if (!response.ok) {
        throw new Error(`Storage endpoint returned ${response.status}`);
      }
      
      const result = await response.json();
      console.log('Analytics: Successfully stored visit record', result);
      return { ok: true, ...result };
      
    } catch (error) {
      console.warn('Analytics: Failed to store visit record:', error.message);
      state.lastError = error;
      return { ok: false, error: error.message };
    }
  }

  // Auto-tracking function (runs automatically)
  async function autoTrack() {
    if (!shouldTrack()) return;
    
    try {
      console.log('Analytics: Auto-tracking visitor on', window.location.hostname);
      
      // Load from session cache if available
      if (state.options.useSessionCache && !state.visitorInfo) {
        try {
          const raw = sessionStorage.getItem(state.options.sessionKey);
          if (raw) {
            state.visitorInfo = JSON.parse(raw);
            console.log('Analytics: Loaded visitor info from cache');
          }
        } catch {}
      }
      
      // Fetch visitor info if not cached
      if (!state.visitorInfo) {
        state.visitorInfo = await fetchVisitorInfo();
        
        // Cache the result
        if (state.visitorInfo && state.options.useSessionCache) {
          try {
            sessionStorage.setItem(state.options.sessionKey, JSON.stringify(state.visitorInfo));
          } catch (storageError) {
            console.warn('Analytics: Failed to cache in sessionStorage:', storageError.message);
          }
        }
      }
      
      // Post visit record to backend
      const result = await postVisitRecord(state.visitorInfo);
      if (result.ok) {
        markAsTracked();
        console.log('Analytics: Successfully tracked visitor');
      }
      
    } catch (error) {
      console.warn('Analytics: Auto-tracking failed:', error.message);
      state.lastError = error;
    }
  }

  // Public API - manual initialization (optional)
  async function init(options = {}) {
    state.options = { ...DEFAULTS, ...options };

    // Enable popup functionality if requested
    if (state.options.enablePopup) {
      attachButton(state.options.buttonSelector);
    }
    
    // Enable dashboard functionality if requested
    if (state.options.enableDashboard) {
      attachDashboardButtons(state.options.dashboardSelector);
    }

    // If autoTrack is disabled, user must manually call track methods
    if (!state.options.autoTrack) {
      console.log('Analytics: Auto-tracking disabled, call trackVisitor() manually');
      return;
    }

    // Perform auto-tracking
    await autoTrack();
  }

  // Manual tracking function
  async function trackVisitor() {
    return await autoTrack();
  }

  function attachButton(selector) {
    if (!selector) return;
    const btn = document.querySelector(selector);
    if (!btn) return;
    btn.addEventListener("click", () => openPopup(state.visitorInfo));
  }
  
  function attachDashboardButtons(selector) {
    if (!selector) return;
    const buttons = document.querySelectorAll(selector);
    buttons.forEach(btn => {
      btn.addEventListener("click", () => {
        openPopup(state.visitorInfo);
        // Switch to dashboard tab by default for dashboard buttons
        setTimeout(() => switchTab('dashboard'), 100);
      });
    });
  }

  // Expose API
  global.AnalyticsFeature = {
    init,
    trackVisitor,
    openPopup,
    closePopup,
    fetchVisitorInfo,
    postVisitRecord,
    getPopupHTML,
    // Dashboard functions
    openDashboard: () => { openPopup(state.visitorInfo); setTimeout(() => switchTab('dashboard'), 100); },
    refreshDashboard,
    exportAnalytics,
    fetchDashboardAnalytics,
    switchTab,
    // Utility functions
    getSessionId: getOrCreateSessionId,
    getSubdomain: () => extractSubdomain(window.location.hostname),
    getSiteInfo: getSiteIdentifier,
    // State access for debugging
    getState: () => ({ ...state, options: { ...state.options } })
  };

  // Auto-initialize when script loads (unless explicitly disabled)
  if (typeof window !== 'undefined') {
    // Check for global config before auto-init
    const globalConfig = window.ANALYTICS_CONFIG || {};
    
    if (globalConfig.disableAutoInit !== true) {
      // Auto-initialize after DOM is ready or immediately if already ready
      if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => {
          setTimeout(() => init(globalConfig), globalConfig.trackingDelay || DEFAULTS.trackingDelay);
        });
      } else {
        // DOM already ready
        setTimeout(() => init(globalConfig), globalConfig.trackingDelay || DEFAULTS.trackingDelay);
      }
    }
  }
})(window);
