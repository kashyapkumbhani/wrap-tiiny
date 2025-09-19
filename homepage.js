const express = require('express');
const { renderTemplate } = require('./template');

/**
 * Homepage module for Tinny
 * 
 * Handles:
 * - Landing page with service explanation
 * - CTA to login or upload after authentication
 * - Public routes for unauthenticated users
 */

const router = express.Router();

/**
 * GET / - Landing page (only for main domain, subdomains handled separately)
 */
router.get('/', (req, res) => {
  // Subdomain requests are handled by subdomain.js, so this only handles main domain
  const isLoggedIn = req.session && req.session.userId;

  // Set up CTA buttons based on login status
  const ctaButtons = isLoggedIn ?
    '<a href="/dashboard" class="btn btn-primary">Go to Dashboard</a>' :
    '<a href="/signup" class="btn btn-primary">Get Started</a><a href="/login" class="btn btn-secondary">Sign In</a>';

  // Render the homepage template with variables
  const html = renderTemplate('homepage', {
    CTA_BUTTONS: ctaButtons
  });

  res.send(html);
});

/**
 * Export the router
 */
module.exports = router;