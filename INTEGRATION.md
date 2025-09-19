# 🚀 Subdomain Analytics Integration Guide

## Quick Start (Auto-Tracking)

Simply add this to any page where you want to track visitors:

```html
<!-- Option 1: Basic auto-tracking (posts to /api/analytics/visit) -->
<script src="analytics.js"></script>

<!-- Option 2: With custom configuration -->
<script>
window.ANALYTICS_CONFIG = {
    storageEndpoint: '/api/analytics/visit',
    trackingDelay: 500,
    respectDoNotTrack: true,
    enablePopup: false  // Disable popup for production
};
</script>
<script src="analytics.js"></script>
```

**That's it!** The script will automatically:
- ✅ Track visitors when they land on any subdomain
- ✅ Fetch IP geolocation from Cloudflare Radar
- ✅ Extract subdomain information
- ✅ POST data to your backend endpoint
- ✅ Avoid duplicate tracking within the same session
- ✅ Respect privacy settings (DNT headers)

## Configuration Options

| Option | Default | Description |
|--------|---------|-------------|
| `storageEndpoint` | `/api/analytics/visit` | Your backend endpoint for storing visit data |
| `proxyEndpoint` | `/api/analytics/ipinfo-proxy` | Fallback for CORS issues |
| `trackingDelay` | `100` | Delay (ms) before tracking starts |
| `respectDoNotTrack` | `true` | Respect DNT browser headers |
| `trackLocalhost` | `false` | Track visits to localhost |
| `enablePopup` | `false` | Enable analytics popup UI |
| `useSessionCache` | `true` | Cache IP data in session storage |
| `disableAutoInit` | `false` | Disable automatic initialization |

## Backend Endpoint

Your backend should handle POST requests to `/api/analytics/visit`:

### Request Payload
```json
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
  "ip_version": "IPv6",
  "url": "https://blog.example.com/post/123",
  "hostname": "blog.example.com",
  "subdomain": "blog",
  "referrer": "https://google.com/search?q=example",
  "userAgent": "Mozilla/5.0...",
  "timezone": "Asia/Kolkata",
  "language": "en-US",
  "screenResolution": "1920x1080",
  "viewportSize": "1366x768",
  "timestamp": "2025-01-20T10:30:45.123Z",
  "sessionId": "ses_abc123",
  "visitType": "search"
}
```

### Response Expected
```json
{
  "ok": true,
  "id": "visit_12345"
}
```

## Database Schema Example

```sql
CREATE TABLE visits (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    
    -- Page Info
    url TEXT NOT NULL,
    hostname TEXT NOT NULL,
    subdomain TEXT,
    
    -- Visitor Info  
    ip_address INET,
    ip_version TEXT,
    session_id TEXT,
    
    -- Location (from Cloudflare)
    country TEXT,
    region TEXT,
    city TEXT,
    latitude NUMERIC(9,5),
    longitude NUMERIC(9,5),
    asn INTEGER,
    colo TEXT,
    
    -- Browser Info
    user_agent TEXT,
    language TEXT,
    timezone TEXT,
    screen_resolution TEXT,
    viewport_size TEXT,
    
    -- Traffic Analysis
    referrer TEXT,
    visit_type TEXT, -- 'direct', 'search', 'social', 'referral', 'internal'
    
    -- Indexes for analytics queries
    INDEX idx_visits_created_at (created_at),
    INDEX idx_visits_hostname (hostname),
    INDEX idx_visits_subdomain (subdomain),
    INDEX idx_visits_country (country),
    INDEX idx_visits_visit_type (visit_type)
);
```

## Express.js Backend Example

```javascript
const express = require('express');
const app = express();

app.use(express.json());

app.post('/api/analytics/visit', async (req, res) => {
    try {
        const visitData = req.body;
        
        // Validate required fields
        if (!visitData.url || !visitData.hostname) {
            return res.status(400).json({ 
                ok: false, 
                error: 'Missing required fields' 
            });
        }
        
        // Store in database (example with PostgreSQL)
        const result = await db.query(`
            INSERT INTO visits (
                url, hostname, subdomain, ip_address, ip_version,
                country, region, city, latitude, longitude, asn, colo,
                user_agent, language, timezone, screen_resolution, viewport_size,
                referrer, visit_type, session_id
            ) VALUES (
                $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, 
                $11, $12, $13, $14, $15, $16, $17, $18, $19, $20
            ) RETURNING id
        `, [
            visitData.url, visitData.hostname, visitData.subdomain,
            visitData.ip_address, visitData.ip_version,
            visitData.country, visitData.region, visitData.city,
            visitData.latitude, visitData.longitude, visitData.asn, visitData.colo,
            visitData.userAgent, visitData.language, visitData.timezone,
            visitData.screenResolution, visitData.viewportSize,
            visitData.referrer, visitData.visitType, visitData.sessionId
        ]);
        
        res.json({ ok: true, id: result.rows[0].id });
        
    } catch (error) {
        console.error('Analytics error:', error);
        res.status(500).json({ ok: false, error: 'Internal server error' });
    }
});

// Optional: CORS proxy for Cloudflare (if needed)
app.get('/api/analytics/ipinfo-proxy', async (req, res) => {
    try {
        const response = await fetch('https://ip-check-perf.radar.cloudflare.com/api/info');
        const data = await response.json();
        res.json(data);
    } catch (error) {
        res.status(500).json({ error: 'Proxy failed' });
    }
});
```

## Privacy Considerations

1. **IP Address Handling**: Consider hashing or truncating IPs for privacy compliance:
   ```javascript
   const crypto = require('crypto');
   const hashedIp = crypto.createHash('sha256').update(visitData.ip_address).digest('hex');
   ```

2. **GDPR Compliance**: Add consent management if required:
   ```javascript
   window.ANALYTICS_CONFIG = {
       respectDoNotTrack: true,
       // Only track if consent granted
       disableAutoInit: !hasAnalyticsConsent()
   };
   ```

3. **Data Retention**: Implement automatic cleanup:
   ```sql
   DELETE FROM visits WHERE created_at < NOW() - INTERVAL '90 days';
   ```

## Subdomain Setup

To track across multiple subdomains, simply include the script on each:

```html
<!-- On main site: example.com -->
<script src="https://cdn.example.com/analytics.js"></script>

<!-- On blog: blog.example.com -->  
<script src="https://cdn.example.com/analytics.js"></script>

<!-- On shop: shop.example.com -->
<script src="https://cdn.example.com/analytics.js"></script>
```

Each will be tracked separately with proper subdomain identification.

## Analytics Dashboard Integration

To add analytics popup to your admin dashboard:

```html
<button id="analytics-btn">📊 Analytics</button>

<script>
window.ANALYTICS_CONFIG = {
    enablePopup: true,
    buttonSelector: '#analytics-btn'
};
</script>
<script src="analytics.js"></script>
```

## Testing

1. **Local Testing**: 
   ```bash
   # Enable localhost tracking
   window.ANALYTICS_CONFIG = { trackLocalhost: true };
   ```

2. **Check Browser Console**: Look for analytics log messages

3. **Verify Backend**: Confirm POST requests reach your endpoint

4. **Test Scenarios**:
   - Direct visits
   - Referral traffic  
   - Different subdomains
   - Various devices/browsers

## Troubleshooting

| Issue | Solution |
|-------|----------|
| No tracking on localhost | Set `trackLocalhost: true` |
| CORS errors with Cloudflare | Implement proxy endpoint |
| Duplicate visits | Check session storage is working |
| Missing geolocation | Verify Cloudflare API accessibility |
| Backend errors | Check endpoint URL and payload format |

## Production Checklist

- [ ] Backend endpoint implemented and tested
- [ ] Database schema created with proper indexes  
- [ ] Privacy policy updated for IP collection
- [ ] Analytics script hosted on CDN
- [ ] Error monitoring configured
- [ ] Data retention policy implemented
- [ ] CORS proxy setup (if needed)
- [ ] Testing completed across all subdomains

The analytics system is now ready for production use! 🎉