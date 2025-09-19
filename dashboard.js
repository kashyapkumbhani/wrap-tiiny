const express = require('express');
const { getDB } = require('./db');
const { requireAuth } = require('./auth');
const { renderTemplate } = require('./template');

/**
 * Dashboard module for Tinny
 * 
 * Handles:
 * - Authenticated area for logged-in users
 * - Sites list and management
 * - Upload action (placeholder for Task 2+)
 * - Account settings
 */

const router = express.Router();

// Apply authentication middleware to all dashboard routes
router.use(requireAuth);

/**
 * GET /dashboard - Main dashboard
 */
router.get('/', (req, res) => {
  try {
    console.log('Dashboard route called with session:', {
      userId: req.session?.userId,
      email: req.session?.email
    });

    const db = getDB();

    // Get user's sites
    const sites = db.all(
      'SELECT id, subdomain, status, created_at FROM sites WHERE owner_id = ? ORDER BY created_at DESC',
      [req.session.userId]
    );

    // Get user info
    const user = db.get(
      'SELECT email, role FROM users WHERE id = ?',
      [req.session.userId]
    );

    console.log('Dashboard data:', {
      userFound: !!user,
      userEmail: user?.email,
      sitesCount: sites.length
    });

    if (!user) {
      console.log('User not found in database, redirecting to login');
      return res.redirect('/login');
    }

    // Build sites section HTML
    let sitesSection;
    if (sites.length === 0) {
      sitesSection = `
        <div class="card">
          <div class="empty-state">
            <div class="empty-state-icon">🚀</div>
            <h2>Welcome to Tinny!</h2>
            <p>You don't have any sites yet. Create your first site to get started.</p>
          </div>
        </div>
      `;
    } else {
      sitesSection = `
        <div class="card">
          <h2>Your Sites (${sites.length})</h2>
          <div class="sites-list">
            ${sites.map(site => `
              <div class="site-item">
                <div class="site-info">
                  <h3>${site.subdomain}</h3>
                  <p>Created ${new Date(site.created_at).toLocaleDateString()}</p>
                </div>
                <span class="site-status status-${site.status}">${site.status}</span>
              </div>
            `).join('')}
          </div>
        </div>
      `;
    }

    // Render dashboard template
    const html = renderTemplate('dashboard', {
      USER_EMAIL: user.email,
      SITES_SECTION: sitesSection
    });

    console.log('Dashboard rendered successfully');
    res.send(html);
  } catch (error) {
    console.error('Dashboard error:', error);
    res.redirect('/login?error=' + encodeURIComponent('An error occurred. Please try again.'));
  }
});

/**
 * Export the router
 */
module.exports = router;