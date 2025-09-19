const express = require('express');
const multer = require('multer');
const path = require('path');
const crypto = require('crypto');
const rateLimit = require('express-rate-limit');
const fs = require('fs').promises;

const { requireAuth } = require('./auth');
const { getDB } = require('./db');
const { uploadProcessor } = require('./upload');
const { hashPasscode, isValidPasscode } = require('./password-protected');

/**
 * API routes module for Tinny
 * 
 * Handles:
 * - POST /api/sites/check-subdomain - Check subdomain availability
 * - POST /api/upload - Upload and deploy HTML/ZIP files
 * - GET /api/sites - List user's sites
 * - GET /api/sites/:siteId - Get site details
 * - GET /api/sites/:siteId/files - List site files
 * - GET /api/sites/:siteId/files/:filename - Get file content
 * - PUT /api/sites/:siteId/files/:filename - Update file content
 * - PUT /api/sites/:siteId/password - Set/update password protection
 * - DELETE /api/sites/:siteId/password - Remove password protection
 * - DELETE /api/sites/:siteId - Delete site
 */

const router = express.Router();

// Configuration
const BASE_DOMAIN = process.env.BASE_DOMAIN || 'lvh.me';

// Apply authentication to most API routes (exclude analytics/visit)
router.use((req, res, next) => {
  // Skip authentication for analytics visit recording endpoint
  if (req.path === '/analytics/visit' && req.method === 'POST') {
    return next();
  }
  // Apply auth to all other routes
  return requireAuth(req, res, next);
});

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, path.join(__dirname, 'tmp'));
  },
  filename: (req, file, cb) => {
    // Generate unique filename
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, 'upload-' + uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({
  storage: storage,
  limits: {
    fileSize: 50 * 1024 * 1024, // 50MB max (will be validated more strictly per type)
    files: 1
  },
  fileFilter: (req, file, cb) => {
    // Basic file type check
    const ext = path.extname(file.originalname).toLowerCase();
    if (['.html', '.htm', '.zip'].includes(ext)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type. Only HTML and ZIP files are allowed.'));
    }
  }
});

// Rate limiting for API endpoints
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 50, // 50 requests per window
  message: { error: 'Too many API requests, please try again later.' },
  standardHeaders: true,
  legacyHeaders: false
});

const uploadLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10, // 10 uploads per window
  message: { error: 'Too many upload requests, please try again later.' },
  standardHeaders: true,
  legacyHeaders: false
});

// Apply rate limiting
router.use(apiLimiter);

// Helper function to generate site ID
function generateSiteId() {
  return crypto.randomBytes(8).toString('hex');
}

// Helper function to validate subdomain format
function validateSubdomain(subdomain) {
  if (!subdomain || typeof subdomain !== 'string') {
    return { valid: false, error: 'Subdomain is required' };
  }

  // Convert to lowercase and trim
  subdomain = subdomain.toLowerCase().trim();

  // Check length
  if (subdomain.length < 1 || subdomain.length > 63) {
    return { valid: false, error: 'Subdomain must be 1-63 characters long' };
  }

  // Check format: alphanumeric and hyphens, no leading/trailing hyphens
  const subdomainRegex = /^[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?$/;
  if (!subdomainRegex.test(subdomain)) {
    return { valid: false, error: 'Subdomain can only contain letters, numbers, and hyphens (no leading/trailing hyphens)' };
  }

  // Reserved subdomains
  const reserved = ['www', 'api', 'admin', 'mail', 'ftp', 'localhost', 'app', 'staging', 'dev', 'test'];
  if (reserved.includes(subdomain)) {
    return { valid: false, error: 'This subdomain is reserved and cannot be used' };
  }

  return { valid: true, subdomain };
}

/**
 * POST /api/sites/check-subdomain
 * Check if a subdomain is available
 */
router.post('/sites/check-subdomain', async (req, res) => {
  try {
    const { subdomain } = req.body;
    
    // Validate subdomain format
    const validation = validateSubdomain(subdomain);
    if (!validation.valid) {
      return res.status(400).json({ error: validation.error });
    }

    const normalizedSubdomain = validation.subdomain;
    const db = getDB();

    // Check if subdomain is already taken (globally across all users)
    const existing = db.get('SELECT id FROM sites WHERE subdomain = ?', [normalizedSubdomain]);
    
    res.json({ 
      available: !existing,
      subdomain: normalizedSubdomain
    });

  } catch (error) {
    console.error('Check subdomain error:', error);
    res.status(500).json({ error: 'Failed to check subdomain availability' });
  }
});

/**
 * POST /api/upload
 * Upload and deploy HTML/ZIP files
 */
router.post('/upload', uploadLimiter, upload.single('file'), async (req, res) => {
  try {
    const { type, subdomain, enablePassword, password } = req.body;
    const file = req.file;

    // Validate required fields
    if (!type || !subdomain || !file) {
      return res.status(400).json({ error: 'Missing required fields: type, subdomain, file' });
    }
    
    // Validate password if password protection is enabled
    if (enablePassword === 'true' || enablePassword === true) {
      if (!isValidPasscode(password)) {
        return res.status(400).json({ error: 'Password must be a 6-digit numeric code when password protection is enabled' });
      }
    }

    // Validate type
    if (!['html', 'zip'].includes(type)) {
      return res.status(400).json({ error: 'Invalid type. Must be "html" or "zip"' });
    }

    // Validate subdomain
    const validation = validateSubdomain(subdomain);
    if (!validation.valid) {
      return res.status(400).json({ error: validation.error });
    }

    const normalizedSubdomain = validation.subdomain;
    const userId = req.session.userId;
    const db = getDB();

    // Check subdomain availability again (could have been taken since check)
    const existing = db.get('SELECT id FROM sites WHERE subdomain = ?', [normalizedSubdomain]);
    if (existing) {
      return res.status(409).json({ error: 'Subdomain is no longer available' });
    }

    // Generate site ID
    const siteId = generateSiteId();

    console.log(`Starting upload process: user=${userId}, site=${siteId}, subdomain=${normalizedSubdomain}, type=${type}`);

    // Process the upload
    const processResult = await uploadProcessor.processUpload(file, type, userId, siteId);
    
    // Hash password if password protection is enabled
    let passwordHash = null;
    const passwordEnabled = enablePassword === 'true' || enablePassword === true;
    if (passwordEnabled && password) {
      passwordHash = await hashPasscode(password);
    }

    // Create site record in database
    // Convert boolean to integer for SQLite3 compatibility
    const passwordEnabledInt = passwordEnabled ? 1 : 0;

    db.run(
      'INSERT INTO sites (id, owner_id, subdomain, status, password_enabled, password_hash) VALUES (?, ?, ?, ?, ?, ?)',
      [siteId, userId, normalizedSubdomain, 'active', passwordEnabledInt, passwordHash]
    );

    // Generate site URL
    const protocol = process.env.NODE_ENV === 'production' ? 'https' : 'http';
    const port = process.env.NODE_ENV === 'production' ? '' : `:${process.env.PORT || 3000}`;
    const siteUrl = `${protocol}://${normalizedSubdomain}.${BASE_DOMAIN}${port}`;

    console.log(`Upload completed successfully: ${siteUrl}`);

    // Return success response
    res.json({
      siteId,
      subdomain: normalizedSubdomain,
      url: siteUrl,
      files: processResult.files,
      size: processResult.size,
      type: processResult.type
    });

  } catch (error) {
    console.error('Upload error:', error);
    
    // Return user-friendly error message
    let errorMessage = 'Upload failed. Please try again.';
    if (error.message.includes('too large')) {
      errorMessage = error.message;
    } else if (error.message.includes('Invalid file type')) {
      errorMessage = error.message;
    } else if (error.message.includes('ZIP file must contain')) {
      errorMessage = error.message;
    } else if (error.message.includes('Unsupported file type')) {
      errorMessage = error.message;
    } else if (error.message.includes('path traversal')) {
      errorMessage = 'Invalid file structure detected';
    }

    res.status(400).json({ error: errorMessage });
  }
});

/**
 * GET /api/sites
 * Get user's sites
 */
router.get('/sites', async (req, res) => {
  try {
    const userId = req.session.userId;
    const db = getDB();

    // Get user's sites
    const sites = db.all(
      'SELECT id, subdomain, status, created_at, updated_at, password_enabled FROM sites WHERE owner_id = ? ORDER BY created_at DESC',
      [userId]
    );

    // Add URL to each site
    const protocol = process.env.NODE_ENV === 'production' ? 'https' : 'http';
    const port = process.env.NODE_ENV === 'production' ? '' : `:${process.env.PORT || 3000}`;
    
    const sitesWithUrls = sites.map(site => ({
      ...site,
      url: `${protocol}://${site.subdomain}.${BASE_DOMAIN}${port}`
    }));

    res.json(sitesWithUrls);

  } catch (error) {
    console.error('Get sites error:', error);
    res.status(500).json({ error: 'Failed to fetch sites' });
  }
});

/**
 * Error handler for multer
 */
router.use((error, req, res, next) => {
  if (error instanceof multer.MulterError) {
    if (error.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({ error: 'File too large' });
    } else if (error.code === 'LIMIT_FILE_COUNT') {
      return res.status(400).json({ error: 'Too many files' });
    } else if (error.code === 'LIMIT_UNEXPECTED_FILE') {
      return res.status(400).json({ error: 'Unexpected file field' });
    }
  }
  
  if (error.message) {
    return res.status(400).json({ error: error.message });
  }

  res.status(500).json({ error: 'Upload error occurred' });
});

/**
 * Helper function to check site ownership
 * @param {string} siteId - Site ID to check
 * @param {string} userId - User ID
 * @returns {Object|null} - Site object or null if not found/not owned
 */
function checkSiteOwnership(siteId, userId) {
  const db = getDB();
  return db.get('SELECT * FROM sites WHERE id = ? AND owner_id = ?', [siteId, userId]);
}

/**
 * GET /api/sites/:siteId
 * Get a single site's details
 */
router.get('/sites/:siteId', async (req, res) => {
  try {
    const { siteId } = req.params;
    const userId = req.session.userId;
    
    const site = checkSiteOwnership(siteId, userId);
    
    if (!site) {
      return res.status(404).json({ error: 'Site not found' });
    }

    // Generate site URL
    const protocol = process.env.NODE_ENV === 'production' ? 'https' : 'http';
    const port = process.env.NODE_ENV === 'production' ? '' : `:${process.env.PORT || 3000}`;
    const siteUrl = `${protocol}://${site.subdomain}.${BASE_DOMAIN}${port}`;
    
    // Add URL to site object
    const siteWithUrl = {
      ...site,
      url: siteUrl
    };
    
    res.json(siteWithUrl);
  } catch (error) {
    console.error('Get site error:', error);
    res.status(500).json({ error: 'Failed to fetch site details' });
  }
});

/**
 * GET /api/sites/:siteId/files
 * List all files in a site
 */
router.get('/sites/:siteId/files', async (req, res) => {
  try {
    const { siteId } = req.params;
    const userId = req.session.userId;
    
    const site = checkSiteOwnership(siteId, userId);
    
    if (!site) {
      return res.status(404).json({ error: 'Site not found' });
    }
    
    // Get site directory path
    const siteDir = path.join(__dirname, 'sites', userId, siteId);
    
    try {
      // Get list of files
      const files = await fs.readdir(siteDir);
      
      // Map files with additional metadata
      const fileDetails = await Promise.all(files.map(async (filename) => {
        const filePath = path.join(siteDir, filename);
        const stats = await fs.stat(filePath);
        
        return {
          name: filename,
          size: stats.size,
          modified: stats.mtime,
          type: path.extname(filename).substring(1) || 'unknown'
        };
      }));
      
      res.json(fileDetails);
    } catch (err) {
      if (err.code === 'ENOENT') {
        return res.status(404).json({ error: 'Site files not found' });
      }
      throw err;
    }
  } catch (error) {
    console.error('List site files error:', error);
    res.status(500).json({ error: 'Failed to list site files' });
  }
});

/**
 * GET /api/sites/:siteId/files/:filename
 * Get the content of a file
 */
router.get('/sites/:siteId/files/:filename', async (req, res) => {
  try {
    const { siteId, filename } = req.params;
    const userId = req.session.userId;
    
    // Validate filename (prevent path traversal)
    if (filename.includes('/') || filename.includes('\\')) {
      return res.status(400).json({ error: 'Invalid filename' });
    }
    
    const site = checkSiteOwnership(siteId, userId);
    
    if (!site) {
      return res.status(404).json({ error: 'Site not found' });
    }
    
    // Get file path
    const filePath = path.join(__dirname, 'sites', userId, siteId, filename);
    
    try {
      // Get file content
      const content = await fs.readFile(filePath, 'utf8');
      
      // Get file stats
      const stats = await fs.stat(filePath);
      
      res.json({
        name: filename,
        content: content,
        size: stats.size,
        modified: stats.mtime,
        type: path.extname(filename).substring(1) || 'unknown'
      });
    } catch (err) {
      if (err.code === 'ENOENT') {
        return res.status(404).json({ error: 'File not found' });
      }
      throw err;
    }
  } catch (error) {
    console.error('Get file content error:', error);
    res.status(500).json({ error: 'Failed to get file content' });
  }
});

/**
 * PUT /api/sites/:siteId/files/:filename
 * Update the content of a file
 */
router.put('/sites/:siteId/files/:filename', express.json({ limit: '5mb' }), async (req, res) => {
  try {
    const { siteId, filename } = req.params;
    const { content } = req.body;
    const userId = req.session.userId;
    
    // Validate content
    if (content === undefined) {
      return res.status(400).json({ error: 'File content is required' });
    }
    
    // Validate filename (prevent path traversal)
    if (filename.includes('/') || filename.includes('\\')) {
      return res.status(400).json({ error: 'Invalid filename' });
    }
    
    // Only allow updating certain file types
    const allowedExtensions = ['.html', '.htm', '.css', '.js', '.txt', '.json', '.xml'];
    const ext = path.extname(filename).toLowerCase();
    if (!allowedExtensions.includes(ext)) {
      return res.status(400).json({ error: 'This file type cannot be edited directly' });
    }
    
    const site = checkSiteOwnership(siteId, userId);
    
    if (!site) {
      return res.status(404).json({ error: 'Site not found' });
    }
    
    // Get file path
    const filePath = path.join(__dirname, 'sites', userId, siteId, filename);
    
    try {
      // Check if file exists
      await fs.access(filePath);
      
      // Write updated content
      await fs.writeFile(filePath, content, 'utf8');
      
      // Get updated file stats
      const stats = await fs.stat(filePath);
      
      res.json({
        name: filename,
        size: stats.size,
        modified: stats.mtime,
        success: true
      });
    } catch (err) {
      if (err.code === 'ENOENT') {
        return res.status(404).json({ error: 'File not found' });
      }
      throw err;
    }
  } catch (error) {
    console.error('Update file content error:', error);
    res.status(500).json({ error: 'Failed to update file content' });
  }
});

/**
 * DELETE /api/sites/:siteId
 * Delete a site completely
 */
router.delete('/sites/:siteId', async (req, res) => {
  try {
    const { siteId } = req.params;
    const userId = req.session.userId;
    
    const site = checkSiteOwnership(siteId, userId);
    
    if (!site) {
      return res.status(404).json({ error: 'Site not found' });
    }
    
    const db = getDB();
    const siteDir = path.join(__dirname, 'sites', userId, siteId);
    
    // Delete database record
    db.run('DELETE FROM sites WHERE id = ? AND owner_id = ?', [siteId, userId]);
    
    // Delete site files
    try {
      // Recursively delete directory
      const { execSync } = require('child_process');
      execSync(`rm -rf "${siteDir}"`);
    } catch (err) {
      console.error('Error deleting site files:', err);
      // Continue even if file deletion fails
    }
    
    res.json({ success: true, message: 'Site deleted successfully' });
  } catch (error) {
    console.error('Delete site error:', error);
    res.status(500).json({ error: 'Failed to delete site' });
  }
});

/**
 * PUT /api/sites/:siteId/password
 * Set or update password protection for a site
 */
router.put('/sites/:siteId/password', express.json(), async (req, res) => {
  try {
    const { siteId } = req.params;
    const { password } = req.body;
    const userId = req.session.userId;
    
    // Validate password
    if (!isValidPasscode(password)) {
      return res.status(400).json({ error: 'Password must be a 6-digit numeric code' });
    }
    
    const site = checkSiteOwnership(siteId, userId);
    
    if (!site) {
      return res.status(404).json({ error: 'Site not found' });
    }
    
    // Hash password
    const passwordHash = await hashPasscode(password);
    
    // Update site record
    const db = getDB();
    db.run(
      'UPDATE sites SET password_hash = ?, password_enabled = 1 WHERE id = ?',
      [passwordHash, siteId]
    );
    
    res.json({ success: true, message: 'Password protection enabled' });
  } catch (error) {
    console.error('Set password error:', error);
    res.status(500).json({ error: 'Failed to set password protection' });
  }
});

/**
 * DELETE /api/sites/:siteId/password
 * Remove password protection from a site
 */
router.delete('/sites/:siteId/password', async (req, res) => {
  try {
    const { siteId } = req.params;
    const userId = req.session.userId;
    
    const site = checkSiteOwnership(siteId, userId);
    
    if (!site) {
      return res.status(404).json({ error: 'Site not found' });
    }
    
    // Update site record
    const db = getDB();
    db.run(
      'UPDATE sites SET password_hash = NULL, password_enabled = 0 WHERE id = ?',
      [siteId]
    );
    
    res.json({ success: true, message: 'Password protection disabled' });
  } catch (error) {
    console.error('Remove password error:', error);
    res.status(500).json({ error: 'Failed to remove password protection' });
  }
});

/**
 * Analytics API Endpoints
 */

/**
 * POST /api/analytics/visit
 * Record a visitor analytics event (called by analytics.js)
 */
router.post('/analytics/visit', express.json(), async (req, res) => {
  try {
    const {
      // Cloudflare data
      colo, asn, continent, country, region, city, latitude, longitude,
      ip_address, ip_version,
      // Browser data
      url, hostname, subdomain, referrer, userAgent, timezone, language,
      screenResolution, viewportSize, timestamp, sessionId, visitType,
      // Site data
      siteId
    } = req.body;

    // Basic validation
    if (!url || !hostname) {
      return res.status(400).json({ error: 'Missing required fields: url, hostname' });
    }

    const db = getDB();
    
    // Find site by hostname/subdomain if siteId not provided
    let targetSiteId = siteId;
    if (!targetSiteId && hostname) {
      const extractedSubdomain = hostname.split('.')[0];
      const site = db.get('SELECT id FROM sites WHERE subdomain = ? AND status = ?', [extractedSubdomain, 'active']);
      targetSiteId = site?.id;
    }

    if (!targetSiteId) {
      return res.status(400).json({ error: 'Cannot identify target site' });
    }

    // Generate visit ID
    const visitId = crypto.randomBytes(8).toString('hex');

    // Store visit record
    db.run(`
      INSERT INTO visits (
        id, site_id, url, hostname, subdomain, ip_address, ip_version, session_id,
        country, region, city, latitude, longitude, asn, colo, continent,
        user_agent, language, timezone, screen_resolution, viewport_size,
        referrer, visit_type, created_at
      ) VALUES (
        ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?
      )
    `, [
      visitId, targetSiteId, url, hostname, subdomain, ip_address, ip_version, sessionId,
      country, region, city, latitude, longitude, asn, colo, continent,
      userAgent, language, timezone, screenResolution, viewportSize,
      referrer, visitType, timestamp || new Date().toISOString()
    ]);

    console.log(`Analytics: Recorded visit ${visitId} for site ${targetSiteId} (${hostname})`);
    
    res.json({ ok: true, id: visitId });
  } catch (error) {
    console.error('Analytics visit recording error:', error);
    res.status(500).json({ error: 'Failed to record visit' });
  }
});

/**
 * GET /api/analytics/site/:siteId
 * Get analytics data for a specific site (dashboard view)
 */
router.get('/analytics/site/:siteId', async (req, res) => {
  try {
    const { siteId } = req.params;
    const { days = 30 } = req.query;
    const userId = req.session.userId;
    
    // Check site ownership
    const site = checkSiteOwnership(siteId, userId);
    if (!site) {
      return res.status(404).json({ error: 'Site not found' });
    }

    const db = getDB();
    const daysNum = parseInt(days) || 30;
    const dateFilter = new Date(Date.now() - daysNum * 24 * 60 * 60 * 1000).toISOString();

    // Get total visits
    const totalVisits = db.get(
      'SELECT COUNT(*) as count FROM visits WHERE site_id = ? AND created_at >= ?',
      [siteId, dateFilter]
    )?.count || 0;

    // Get unique visitors (by IP)
    const uniqueVisitors = db.get(
      'SELECT COUNT(DISTINCT ip_address) as count FROM visits WHERE site_id = ? AND created_at >= ? AND ip_address IS NOT NULL',
      [siteId, dateFilter]
    )?.count || 0;

    // Get top countries
    const topCountries = db.all(`
      SELECT country, COUNT(*) as count 
      FROM visits 
      WHERE site_id = ? AND created_at >= ? AND country IS NOT NULL
      GROUP BY country 
      ORDER BY count DESC 
      LIMIT 10
    `, [siteId, dateFilter]);

    // Get traffic sources
    const trafficSources = db.all(`
      SELECT visit_type, COUNT(*) as count 
      FROM visits 
      WHERE site_id = ? AND created_at >= ? AND visit_type IS NOT NULL
      GROUP BY visit_type
    `, [siteId, dateFilter]);

    // Convert to object for easier frontend consumption
    const trafficSourcesObj = {};
    trafficSources.forEach(source => {
      trafficSourcesObj[source.visit_type] = source.count;
    });

    // Get recent visits (last 50)
    const recentVisits = db.all(`
      SELECT country, city, ip_version, visit_type, created_at as timestamp
      FROM visits 
      WHERE site_id = ? 
      ORDER BY created_at DESC 
      LIMIT 50
    `, [siteId]);

    const analyticsData = {
      days: daysNum,
      totalVisits,
      uniqueVisitors,
      topCountry: topCountries[0]?.country || 'N/A',
      primaryTrafficSource: Object.keys(trafficSourcesObj).reduce((a, b) => 
        trafficSourcesObj[a] > trafficSourcesObj[b] ? a : b, 'direct'
      ),
      topCountries,
      trafficSources: trafficSourcesObj,
      recentVisits
    };

    res.json(analyticsData);
  } catch (error) {
    console.error('Analytics fetch error:', error);
    res.status(500).json({ error: 'Failed to fetch analytics data' });
  }
});

/**
 * GET /api/analytics/site/:siteId/export
 * Export analytics data as JSON
 */
router.get('/analytics/site/:siteId/export', async (req, res) => {
  try {
    const { siteId } = req.params;
    const { days = 90 } = req.query;
    const userId = req.session.userId;
    
    // Check site ownership
    const site = checkSiteOwnership(siteId, userId);
    if (!site) {
      return res.status(404).json({ error: 'Site not found' });
    }

    const db = getDB();
    const daysNum = parseInt(days) || 90;
    const dateFilter = new Date(Date.now() - daysNum * 24 * 60 * 60 * 1000).toISOString();

    // Get all visits for export
    const visits = db.all(`
      SELECT * FROM visits 
      WHERE site_id = ? AND created_at >= ? 
      ORDER BY created_at DESC
    `, [siteId, dateFilter]);

    const exportData = {
      site: {
        id: siteId,
        subdomain: site.subdomain,
        exportDate: new Date().toISOString(),
        dayRange: daysNum
      },
      visits,
      summary: {
        totalVisits: visits.length,
        uniqueVisitors: new Set(visits.filter(v => v.ip_address).map(v => v.ip_address)).size,
        dateRange: {
          from: dateFilter,
          to: new Date().toISOString()
        }
      }
    };

    // Set headers for file download
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', `attachment; filename="analytics-${site.subdomain}-${new Date().toISOString().split('T')[0]}.json"`);
    
    res.json(exportData);
  } catch (error) {
    console.error('Analytics export error:', error);
    res.status(500).json({ error: 'Failed to export analytics data' });
  }
});

module.exports = router;
