# WARP.md

This file provides guidance to WARP (warp.dev) when working with code in this repository.

## Project Overview

**Tinny** is a self-hosted, lightweight alternative to TiinyHost for quickly publishing small static sites on subdomains. It's designed as a single-process Node.js application with modular architecture and minimal dependencies.

### Core Functionality
- Upload HTML files or ZIP archives to create static sites
- Serve sites on custom subdomains (*.lvh.me for development)
- User authentication and session management
- Password-protected sites with 6-digit passcodes
- Site management dashboard with code editing capabilities
- Analytics integration with Cloudflare Radar API

## Common Development Commands

### Environment Setup
```bash
# Copy environment template and configure
cp .env.example .env
# Edit .env to set SESSION_SECRET and other config

# Install dependencies
npm install

# Initialize database (creates SQLite DB and runs migrations)
npm run migrate
```

### Running the Application
```bash
# Development mode with auto-restart
npm run dev

# Production mode
npm start

# Run tests (when implemented)
npm test
```

### Database Operations
```bash
# Initialize/reset database and run migrations
npm run migrate

# Create backups (placeholder - to be implemented)
npm run backup
```

## High-Level Architecture

### Modular Monolith Structure
The application follows a modular monolith pattern where `server.js` acts as the main orchestrator importing feature-specific modules:

**Core Modules:**
- `server.js` - Main entry point, middleware setup, route mounting
- `auth.js` - User authentication (signup/login/logout) and session management
- `db.js` - Database abstraction layer with migration runner (SQLite with better-sqlite3)
- `subdomain.js` - Subdomain detection and static file serving
- `dashboard.js` - User dashboard and site management interface
- `api.js` - REST API endpoints for site operations
- `upload.js` - File upload processing and site deployment
- `storage.js` - File storage abstraction (local filesystem)
- `password-protected.js` - Password protection for individual sites

### Request Flow Architecture
1. **Subdomain Detection**: `subdomainMiddleware` parses Host header to identify site requests
2. **Route Hierarchy**: Subdomain routes → API routes → Auth routes → Dashboard (protected)
3. **Static Serving**: Sites stored in `sites/<siteId>/` directory structure
4. **Security Layer**: Helmet CSP, HTML sanitization, rate limiting, input validation

### Database Schema
- **users**: Authentication and user management
- **sites**: Site metadata (subdomain, owner, status)
- **events**: Audit logging and analytics
- **quotas**: Usage tracking (future feature)
- **visits**: Analytics data (Cloudflare integration)

### Storage Layout
```
/
├── sites/<siteId>/           # Static site files
├── tmp/                      # Upload processing
├── data/                     # SQLite database
├── migrations/               # SQL migration files
└── static/                   # Application assets
```

## Key Design Patterns

### Security-First Approach
- Strict Content Security Policy (CSP) with allowlists
- HTML sanitization for uploaded content
- Rate limiting (general: 100/15min, auth: 10/15min)
- Session-based authentication with secure cookies
- Input validation and SQL injection prevention

### Deployment Philosophy
- Single-process application designed for VPS deployment
- Local filesystem storage with S3 adapter planned
- SQLite for development, Postgres compatibility for production
- Nginx reverse proxy for TLS termination and caching

### Feature Module Boundaries
Each module has clear responsibilities and minimal cross-dependencies:
- Database operations abstracted through `db.js`
- Template rendering centralized in `template.js`
- File operations handled by `storage.js`
- No circular dependencies between feature modules

## Development Workflow

### Adding New Features
1. Create feature-specific module (e.g., `billing.js`)
2. Add database migrations in `migrations/` if needed
3. Mount routes in `server.js`
4. Follow existing patterns for error handling and validation

### Database Migrations
- Sequential SQL files in `migrations/` directory
- Auto-executed on server startup
- Use `npm run migrate` to manually trigger

### Environment Configuration
- Development uses `lvh.me` domain for subdomain testing
- Production requires wildcard SSL certificate setup
- Environment variables defined in `.env.example`

## Current Limitations & Future Plans

### Phase 1 (Current)
- Local file storage only
- SQLite database
- Basic analytics via Cloudflare Radar
- Password protection with 6-digit codes

### Phase 1.5 (Planned)
- Custom domain support
- Background job processing
- Enhanced admin interface
- Usage quotas and billing

### Phase 2 (Future)
- S3/MinIO storage adapter
- PostgreSQL database support
- Team collaboration features
- Advanced analytics dashboard

## Testing Strategy

Currently the codebase relies on manual testing. The `package.json` includes a test script using Mocha, but test files need to be created following the module structure.

## Performance Considerations

- Static file serving handled by Nginx in production
- Database queries use prepared statements via better-sqlite3
- File uploads have size limits (HTML: 5MB, ZIP: 25MB)
- Rate limiting prevents abuse
- Graceful shutdown handling for zero-downtime deployments

## Security Notes

- Never store secrets in code - use environment variables
- All user input is validated and sanitized
- File uploads are scanned for malicious content
- CSP prevents XSS attacks
- Session cookies are httpOnly and secure in production