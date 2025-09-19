-- Initial schema for Tinny Phase 1
-- Users table: basic auth and role management
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY, -- ULID/UUID
  email TEXT UNIQUE NOT NULL, -- lowercase, validated
  password_hash TEXT NOT NULL, -- bcrypt
  role TEXT DEFAULT 'user' CHECK (role IN ('admin', 'user')),
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Sites table: subdomain hosting metadata
CREATE TABLE IF NOT EXISTS sites (
  id TEXT PRIMARY KEY, -- ULID/UUID
  owner_id TEXT NOT NULL,
  subdomain TEXT UNIQUE NOT NULL, -- validated [a-z0-9-]
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'disabled')),
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (owner_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Optional: Events table for audits/analytics (Phase 1.5+)
CREATE TABLE IF NOT EXISTS events (
  id TEXT PRIMARY KEY,
  user_id TEXT,
  type TEXT NOT NULL, -- login, upload, deploy, etc.
  meta TEXT, -- JSON metadata
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
);

-- Optional: Quotas table for rate/quota accounting (Phase 1.5+)
CREATE TABLE IF NOT EXISTS quotas (
  site_id TEXT PRIMARY KEY,
  storage_bytes INTEGER DEFAULT 0,
  request_count INTEGER DEFAULT 0,
  window_start DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (site_id) REFERENCES sites(id) ON DELETE CASCADE
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_sites_owner_id ON sites(owner_id);
CREATE INDEX IF NOT EXISTS idx_sites_subdomain ON sites(subdomain);
CREATE INDEX IF NOT EXISTS idx_events_user_id ON events(user_id);
CREATE INDEX IF NOT EXISTS idx_events_type ON events(type);
CREATE INDEX IF NOT EXISTS idx_events_created_at ON events(created_at);