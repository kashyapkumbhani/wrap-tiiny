-- Migration: Password protection indexes and defaults
-- Date: 2024-01-01
-- Task: Password protection feature for sites
-- Note: Columns already exist, this migration only adds indexes and defaults

-- Index for performance on password-enabled queries (safe to run multiple times)
CREATE INDEX IF NOT EXISTS idx_sites_password_enabled ON sites(password_enabled);

-- Update existing sites to have password protection disabled by default (safe to run multiple times)
UPDATE sites SET password_enabled = COALESCE(password_enabled, FALSE);
