require('dotenv').config();

const express = require('express');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const session = require('cookie-session');
const { initializeDatabase } = require('./db');

// Import route modules
const homepageRouter = require('./homepage');
const { router: authRouter } = require('./auth');
const dashboardRouter = require('./dashboard');
const apiRouter = require('./api');
const { subdomainMiddleware, createSubdomainRouter } = require('./subdomain');
const { passwordVerificationHandler } = require('./password-protected');

/**
 * Tinny Server - Main Entry Point
 * 
 * Responsibilities:
 * - Initialize database and run migrations
 * - Configure middleware (security, sessions, logging, rate limiting)
 * - Mount route modules
 * - Error handling
 * - Server lifecycle management
 */

const app = express();
const PORT = process.env.PORT || 3000;

// Validate required environment variables
if (!process.env.SESSION_SECRET) {
  console.error('ERROR: SESSION_SECRET environment variable is required');
  process.exit(1);
}

/**
 * Initialize Database
 */
console.log('Initializing database...');
try {
  initializeDatabase();
  console.log('Database initialized successfully');
} catch (error) {
  console.error('Failed to initialize database:', error);
  process.exit(1);
}

/**
 * Security Middleware
 */
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: [
        "'self'",
        "'unsafe-eval'", // CodeMirror needs eval for some features
        "'unsafe-inline'", // Allow inline scripts for password forms and other UI
        "https://cdnjs.cloudflare.com", // CodeMirror CDN
        "blob:" // For preview functionality
      ],
      styleSrc: [
        "'self'", 
        "'unsafe-inline'", // Allow inline styles for templates and CodeMirror
        "https://cdnjs.cloudflare.com" // CodeMirror CSS
      ],
      imgSrc: ["'self'", "data:", "https:", "blob:"],
      fontSrc: ["'self'", "https://cdnjs.cloudflare.com"],
      connectSrc: ["'self'", "https://ip-check-perf.radar.cloudflare.com"], // Allow Cloudflare Radar API for analytics
      mediaSrc: ["'none'"],
      objectSrc: ["'none'"],
      childSrc: ["'self'", "blob:"], // Allow blob URLs for preview iframe
      frameSrc: ["'self'", "blob:"], // Allow blob URLs for preview iframe
      baseUri: ["'self'"],
      formAction: ["'self'"]
    }
  },
  crossOriginEmbedderPolicy: false // Allow for easier development
}));

/**
 * Request Parsing Middleware
 */
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(express.json({ limit: '10mb' }));

/**
 * Session Management
 */
app.use(session({
  name: 'tinny_session',
  keys: [process.env.SESSION_SECRET],
  maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production', // HTTPS only in production
  sameSite: 'lax'
}));

/**
 * Rate Limiting
 */
// General rate limit for all requests
const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Limit each IP to 100 requests per windowMs
  message: 'Too many requests from this IP, please try again later.',
  standardHeaders: true,
  legacyHeaders: false
});

// Stricter rate limit for auth routes
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10, // Limit each IP to 10 auth requests per windowMs
  message: 'Too many authentication attempts, please try again later.',
  standardHeaders: true,
  legacyHeaders: false
});

app.use(generalLimiter);

/**
 * Request Logging Middleware
 */
app.use((req, res, next) => {
  const start = Date.now();
  
  // Log request
  console.log(`${new Date().toISOString()} ${req.method} ${req.url} - ${req.ip}`);
  
  // Log response when finished
  res.on('finish', () => {
    const duration = Date.now() - start;
    console.log(`${new Date().toISOString()} ${req.method} ${req.url} ${res.statusCode} - ${duration}ms`);
  });
  
  next();
});

/**
 * Static File Serving
 */
app.use('/static', express.static('static', {
  maxAge: process.env.NODE_ENV === 'production' ? '1d' : '0'
}));

/**
 * Subdomain Detection Middleware
 */
app.use(subdomainMiddleware);

/**
 * Route Mounting
 */
// API routes
app.use('/api', apiRouter);

// Create subdomain router instance with password protection
const subdomainRouterInstance = createSubdomainRouter();

// Subdomain routes (must be before main routes to catch subdomain requests)
app.use('/', (req, res, next) => {
  if (req.subdomain) {
    return subdomainRouterInstance(req, res, next);
  }
  next();
});

// Public routes (main domain only)
app.use('/', homepageRouter);

// Auth routes with stricter rate limiting
app.use('/signup', authLimiter);
app.use('/login', authLimiter);
app.use('/', authRouter);

// Password verification route (for protected sites)
const { getDB } = require('./db');
const db = getDB();
app.post('/verify-password', passwordVerificationHandler(db));

// Protected routes
app.use('/dashboard', dashboardRouter);

/**
 * Health Check Endpoint
 */
app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    version: require('./package.json').version || '0.1.0'
  });
});

/**
 * 404 Handler
 */
app.use((req, res) => {
  res.status(404).send(`
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Page Not Found - Tinny</title>
      <style>
        body {
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
          max-width: 600px;
          margin: 4rem auto;
          padding: 2rem;
          text-align: center;
          color: #374151;
        }
        h1 { color: #dc2626; margin-bottom: 1rem; }
        p { margin-bottom: 2rem; color: #6b7280; }
        a {
          color: #2563eb;
          text-decoration: none;
          padding: 0.75rem 1.5rem;
          border: 1px solid #2563eb;
          border-radius: 0.375rem;
          display: inline-block;
        }
        a:hover { background-color: #2563eb; color: white; }
      </style>
    </head>
    <body>
      <h1>404 - Page Not Found</h1>
      <p>The page you're looking for doesn't exist.</p>
      <a href="/">← Back to Home</a>
    </body>
    </html>
  `);
});

/**
 * Error Handler
 */
app.use((err, req, res, next) => {
  console.error(`Error: ${err.message}`);
  console.error(err.stack);
  
  // Don't leak error details in production
  const message = process.env.NODE_ENV === 'production' 
    ? 'Internal Server Error' 
    : err.message;
  
  res.status(500).send(`
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Server Error - Tinny</title>
      <style>
        body {
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
          max-width: 600px;
          margin: 4rem auto;
          padding: 2rem;
          text-align: center;
          color: #374151;
        }
        h1 { color: #dc2626; margin-bottom: 1rem; }
        p { margin-bottom: 2rem; color: #6b7280; }
        a {
          color: #2563eb;
          text-decoration: none;
          padding: 0.75rem 1.5rem;
          border: 1px solid #2563eb;
          border-radius: 0.375rem;
          display: inline-block;
        }
        a:hover { background-color: #2563eb; color: white; }
      </style>
    </head>
    <body>
      <h1>500 - Server Error</h1>
      <p>${message}</p>
      <a href="/">← Back to Home</a>
    </body>
    </html>
  `);
});

/**
 * Graceful Shutdown
 */
process.on('SIGTERM', () => {
  console.log('SIGTERM received, shutting down gracefully');
  process.exit(0);
});

process.on('SIGINT', () => {
  console.log('SIGINT received, shutting down gracefully');
  process.exit(0);
});

/**
 * Start Server
 */
app.listen(PORT, () => {
  console.log(`
🚀 Tinny server started successfully!

  Local:   http://localhost:${PORT}
  Environment: ${process.env.NODE_ENV || 'development'}
  Database: ${process.env.SQLITE_PATH || './data/metadata.db'}
  
Routes available:
  GET  /                    - Homepage
  GET  /signup              - User registration  
  POST /signup              - Process registration
  GET  /login               - User login
  POST /login               - Process login
  GET  /logout              - Logout
  GET  /dashboard           - User dashboard (auth required)
  
  POST /api/sites/check-subdomain  - Check subdomain availability
  POST /api/upload                 - Upload and deploy sites
  GET  /api/sites                  - List user sites
  GET  /api/sites/:id/files        - List site files (Task 3)
  PUT  /api/sites/:id/files/:file  - Update file content (Task 3)
  DELETE /api/sites/:id            - Delete site (Task 3)
  PUT  /api/sites/:id/password     - Set site password (Task 3)
  
  GET  /health              - Health check
  GET  *.lvh.me             - Serve user sites with password protection

Task 3 Features Active:
  ✅ Code Editor with syntax highlighting
  ✅ Password protection for sites
  ✅ Site management (edit, delete)
  ✅ Enhanced dashboard with action buttons
  `);
});