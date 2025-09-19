-- Migration: Analytics table for visitor tracking
-- Date: 2025-01-19
-- Purpose: Create table to store visitor analytics data from Cloudflare Radar API

-- Analytics visits table
CREATE TABLE IF NOT EXISTS visits (
  id TEXT PRIMARY KEY, -- ULID/UUID
  site_id TEXT NOT NULL, -- Reference to sites table
  
  -- Page Info
  url TEXT NOT NULL,
  hostname TEXT NOT NULL,
  subdomain TEXT,
  
  -- Visitor Info  
  ip_address TEXT, -- May be hashed for privacy
  ip_version TEXT, -- 'IPv4' or 'IPv6'
  session_id TEXT,
  
  -- Location (from Cloudflare Radar)
  country TEXT,
  region TEXT,
  city TEXT,
  latitude REAL,
  longitude REAL,
  asn INTEGER,
  colo TEXT, -- Cloudflare PoP
  continent TEXT,
  
  -- Browser Info
  user_agent TEXT,
  language TEXT,
  timezone TEXT,
  screen_resolution TEXT,
  viewport_size TEXT,
  
  -- Traffic Analysis
  referrer TEXT,
  visit_type TEXT, -- 'direct', 'search', 'social', 'referral', 'internal'
  
  -- Timestamps
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  
  FOREIGN KEY (site_id) REFERENCES sites(id) ON DELETE CASCADE
);

-- Indexes for analytics queries
CREATE INDEX IF NOT EXISTS idx_visits_site_id ON visits(site_id);
CREATE INDEX IF NOT EXISTS idx_visits_created_at ON visits(created_at);
CREATE INDEX IF NOT EXISTS idx_visits_hostname ON visits(hostname);
CREATE INDEX IF NOT EXISTS idx_visits_subdomain ON visits(subdomain);
CREATE INDEX IF NOT EXISTS idx_visits_country ON visits(country);
CREATE INDEX IF NOT EXISTS idx_visits_visit_type ON visits(visit_type);
CREATE INDEX IF NOT EXISTS idx_visits_session_id ON visits(session_id);

-- Composite indexes for common analytics queries
CREATE INDEX IF NOT EXISTS idx_visits_site_created ON visits(site_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_visits_site_country ON visits(site_id, country);
CREATE INDEX IF NOT EXISTS idx_visits_site_type ON visits(site_id, visit_type);