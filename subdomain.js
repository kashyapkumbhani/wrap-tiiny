const express = require('express');
const fs = require('fs');
const path = require('path');
const { getDB } = require('./db');
const { passwordProtectionMiddleware } = require('./password-protected');

/**
 * Subdomain module for Tinny
 *
 * Handles:
 * - Subdomain detection middleware
 * - Subdomain routing and content serving
 * - Database lookup for sites by subdomain
 * - File serving for uploaded content
 */

/**
 * Subdomain Detection Middleware
 * Extracts subdomain from Host header and attaches to request
 */
function subdomainMiddleware(req, res, next) {
  const host = req.get('host') || '';
  let subdomain = null;

  // Handle different domain formats
  if (host.includes('localhost:3000')) {
    // localhost:3000 or *.localhost:3000
    subdomain = host.replace('.localhost:3000', '').replace('localhost:3000', '');
  } else if (host.includes('lvh.me:3000')) {
    // lvh.me:3000 or *.lvh.me:3000 (wildcard DNS)
    subdomain = host.replace('.lvh.me:3000', '').replace('lvh.me:3000', '');
  } else if (host.includes('lvh.me')) {
    // lvh.me without port (for production-like testing)
    subdomain = host.replace('.lvh.me', '').replace('lvh.me', '');
  }

  // Clean up subdomain (remove any remaining dots or ports)
  if (subdomain) {
    subdomain = subdomain.replace(/:\d+$/, ''); // Remove port if present
    subdomain = subdomain.replace(/^\./, ''); // Remove leading dot
  }

  if (subdomain && subdomain !== 'localhost' && subdomain !== 'lvh' && subdomain !== '') {
    console.log(`[Subdomain Request] Host: ${host}, Subdomain: ${subdomain}`);
    req.subdomain = subdomain;
  } else {
    req.subdomain = null;
  }

  next();
}

/**
 * Subdomain Router
 * Handles serving content for subdomain requests
 */
function createSubdomainRouter() {
  const router = express.Router();
  
  // Apply password protection middleware to all subdomain requests
  const db = getDB();
  router.use(passwordProtectionMiddleware(db));
  
  /**
   * Handle all requests - Serve subdomain content
   */
  router.use('/', (req, res) => {
  const subdomain = req.subdomain;

  if (!subdomain) {
    // This shouldn't happen if middleware is working correctly
    return res.status(400).send('Invalid subdomain request');
  }

  console.log(`Serving site for subdomain: ${subdomain}`);

  try {
    const db = getDB();

    // Look up the site by subdomain
    const site = db.get('SELECT * FROM sites WHERE subdomain = ? AND status = ?', [subdomain, 'active']);

    if (site) {
      // Site found - determine the file to serve
      let requestedFile = req.path === '/' ? 'index.html' : req.path.substring(1);
      
      // Prevent path traversal attacks
      if (requestedFile.includes('../') || requestedFile.includes('..\\')) {
        return res.status(400).send('Invalid file path');
      }
      
      const sitePath = path.join(__dirname, 'sites', site.owner_id, site.id, requestedFile);
      console.log(`Looking for site file: ${sitePath}`);

      if (fs.existsSync(sitePath)) {
        const stats = fs.statSync(sitePath);
        
        if (stats.isFile()) {
          // Determine content type based on file extension
          const ext = path.extname(requestedFile).toLowerCase();
          const contentTypes = {
            '.html': 'text/html',
            '.htm': 'text/html',
            '.css': 'text/css',
            '.js': 'application/javascript',
            '.json': 'application/json',
            '.txt': 'text/plain',
            '.png': 'image/png',
            '.jpg': 'image/jpeg',
            '.jpeg': 'image/jpeg',
            '.gif': 'image/gif',
            '.svg': 'image/svg+xml',
            '.ico': 'image/x-icon',
            '.pdf': 'application/pdf',
            '.zip': 'application/zip'
          };
          
          const contentType = contentTypes[ext] || 'application/octet-stream';
          res.set('Content-Type', contentType);
          
          // For text files, read as UTF-8, otherwise read as binary
          if (contentType.startsWith('text/') || contentType.includes('json') || contentType.includes('javascript')) {
            let content = fs.readFileSync(sitePath, 'utf8');
            
            // Auto-inject analytics script into HTML files
            if (contentType === 'text/html') {
              content = injectAnalyticsScript(content, site.subdomain, site.id);
            }
            
            console.log(`Serving text content: ${requestedFile} for site: ${site.subdomain}`);
            return res.send(content);
          } else {
            console.log(`Serving binary content: ${requestedFile} for site: ${site.subdomain}`);
            return res.sendFile(sitePath);
          }
        } else if (stats.isDirectory() && requestedFile !== 'index.html') {
          // Try to serve index.html in the directory
          const indexPath = path.join(sitePath, 'index.html');
          if (fs.existsSync(indexPath)) {
            let htmlContent = fs.readFileSync(indexPath, 'utf8');
            // Auto-inject analytics script
            htmlContent = injectAnalyticsScript(htmlContent, site.subdomain, site.id);
            console.log(`Serving directory index for: ${requestedFile}`);
            return res.send(htmlContent);
          }
        }
      } else {
        console.log(`Site file not found: ${sitePath}`);
        // For files other than index.html, return 404
        if (requestedFile !== 'index.html') {
          return res.status(404).send('File not found');
        }
      }
    }

    // Site not found or file doesn't exist - show default page
    const notFoundHtml = `
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>${subdomain} - Hosted on Tinny</title>
        <style>
          body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            max-width: 800px;
            margin: 4rem auto;
            padding: 2rem;
            text-align: center;
            background: linear-gradient(135deg, #f3f4f6 0%, #e5e7eb 100%);
            color: #374151;
            border-radius: 10px;
          }
          h1 { font-size: 3rem; margin-bottom: 1rem; }
          .subdomain-badge {
            background: rgba(0,0,0,0.1);
            padding: 1rem 2rem;
            border-radius: 50px;
            display: inline-block;
            margin: 2rem 0;
          }
          .error {
            color: #dc2626;
            background: #fef2f2;
            border: 1px solid #fecaca;
            padding: 1rem;
            border-radius: 0.5rem;
            margin: 2rem 0;
          }
        </style>
      </head>
      <body>
        <h1>🚫 Site Not Found</h1>
        <div class="subdomain-badge">
          <strong>Subdomain:</strong> ${subdomain}
        </div>
        <div class="error">
          <p><strong>No site found for this subdomain.</strong></p>
          <p>The site may not exist, be inactive, or the files may not have been uploaded yet.</p>
        </div>
        <p><a href="/" style="color: #2563eb;">Go to Main Site</a> to create a new site.</p>
      </body>
      </html>
    `;

    return res.send(notFoundHtml);
  } catch (error) {
    console.error('Error serving subdomain:', error);
    return res.status(500).send('Internal Server Error');
  }
});

  return router;
}

/**
 * Inject analytics script into HTML content
 */
function injectAnalyticsScript(htmlContent, subdomain, siteId) {
  // Skip injection if analytics script already present
  if (htmlContent.includes('analytics.js') || htmlContent.includes('AnalyticsFeature')) {
    return htmlContent;
  }
  
  // Analytics configuration and script injection
  const analyticsConfig = `
    <script>
      // Auto-injected analytics configuration
      window.ANALYTICS_CONFIG = {
        storageEndpoint: '/api/analytics/visit',
        analyticsEndpoint: '/api/analytics/dashboard',
        trackingDelay: 100,
        respectDoNotTrack: true,
        trackIndividually: true,
        enableDashboard: false,  // Disable popup on user sites
        autoTrack: true,
        // Site-specific config
        siteId: '${siteId}',
        siteName: '${subdomain}'
      };
    </script>
    <script src="/static/analytics.js"></script>
  `;
  
  // Try to inject before closing </head> tag
  if (htmlContent.includes('</head>')) {
    return htmlContent.replace('</head>', analyticsConfig + '\n  </head>');
  }
  
  // Try to inject before closing </body> tag
  if (htmlContent.includes('</body>')) {
    return htmlContent.replace('</body>', analyticsConfig + '\n  </body>');
  }
  
  // If no head or body tags, inject at the end
  return htmlContent + analyticsConfig;
}

module.exports = {
  subdomainMiddleware,
  createSubdomainRouter
};
