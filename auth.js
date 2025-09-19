const express = require('express');
const bcrypt = require('bcrypt');
const crypto = require('crypto');
const { getDB } = require('./db');
const { renderTemplate } = require('./template');

/**
 * Auth module for Tinny
 * 
 * Handles:
 * - Login and signup (combined module)
 * - Basic email/password flows
 * - Logout functionality
 * - Input validation and sanitization
 * - Session management
 */

const router = express.Router();

// Helper function to generate ULID-like ID
function generateId() {
  return crypto.randomBytes(16).toString('hex');
}

// Helper function to validate email format
function isValidEmail(email) {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

// Helper function to normalize email
function normalizeEmail(email) {
  return email.toLowerCase().trim();
}

/**
 * GET /signup - Signup page
 */
router.get('/signup', (req, res) => {
  // Redirect if already logged in
  if (req.session && req.session.userId) {
    return res.redirect('/dashboard');
  }

  const error = req.query.error;
  const email = req.query.email || '';

  // Render signup template
  const html = renderTemplate('signup', {
    ERROR_MESSAGE: error ? `<div class="error">${error}</div>` : '',
    EMAIL_VALUE: email
  });

  res.send(html);
});

/**
 * POST /signup - Process signup
 */
router.post('/signup', async (req, res) => {
  try {
    const { email, password, confirmPassword } = req.body;

    // Input validation
    if (!email || !password || !confirmPassword) {
      return res.redirect('/signup?error=' + encodeURIComponent('All fields are required'));
    }

    // Normalize email
    const normalizedEmail = normalizeEmail(email);

    // Email validation
    if (!isValidEmail(normalizedEmail)) {
      return res.redirect('/signup?error=' + encodeURIComponent('Invalid email format') + '&email=' + encodeURIComponent(email));
    }

    // Password validation
    if (password.length < 8) {
      return res.redirect('/signup?error=' + encodeURIComponent('Password must be at least 8 characters long') + '&email=' + encodeURIComponent(email));
    }

    // Confirm password
    if (password !== confirmPassword) {
      return res.redirect('/signup?error=' + encodeURIComponent('Passwords do not match') + '&email=' + encodeURIComponent(email));
    }

    const db = getDB();

    // Check if user already exists
    const existingUser = db.get('SELECT id FROM users WHERE email = ?', [normalizedEmail]);
    if (existingUser) {
      return res.redirect('/signup?error=' + encodeURIComponent('An account with this email already exists') + '&email=' + encodeURIComponent(email));
    }

    // Hash password
    const passwordHash = await bcrypt.hash(password, 12);

    // Create user
    const userId = generateId();
    db.run(
      'INSERT INTO users (id, email, password_hash) VALUES (?, ?, ?)',
      [userId, normalizedEmail, passwordHash]
    );

    // Set session
    req.session.userId = userId;
    req.session.email = normalizedEmail;

    console.log(`New user created: ${normalizedEmail}`);
    console.log('Session after signup:', {
      userId: req.session.userId,
      email: req.session.email,
      sessionKeys: Object.keys(req.session)
    });
    res.redirect('/dashboard');

  } catch (error) {
    console.error('Signup error:', error);
    res.redirect('/signup?error=' + encodeURIComponent('An error occurred. Please try again.'));
  }
});

/**
 * GET /login - Login page
 */
router.get('/login', (req, res) => {
  // Redirect if already logged in
  if (req.session && req.session.userId) {
    return res.redirect('/dashboard');
  }

  const error = req.query.error;
  const email = req.query.email || '';

  // Render login template
  const html = renderTemplate('login', {
    ERROR_MESSAGE: error ? `<div class="error">${error}</div>` : '',
    EMAIL_VALUE: email
  });

  res.send(html);
});

/**
 * POST /login - Process login
 */
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    // Input validation
    if (!email || !password) {
      return res.redirect('/login?error=' + encodeURIComponent('Email and password are required'));
    }

    // Normalize email
    const normalizedEmail = normalizeEmail(email);

    const db = getDB();

    // Find user
    const user = db.get('SELECT id, email, password_hash FROM users WHERE email = ?', [normalizedEmail]);
    if (!user) {
      return res.redirect('/login?error=' + encodeURIComponent('Invalid email or password') + '&email=' + encodeURIComponent(email));
    }

    // Verify password
    const isValidPassword = await bcrypt.compare(password, user.password_hash);
    if (!isValidPassword) {
      return res.redirect('/login?error=' + encodeURIComponent('Invalid email or password') + '&email=' + encodeURIComponent(email));
    }

    // Set session
    req.session.userId = user.id;
    req.session.email = user.email;

    console.log(`User logged in: ${user.email}`);
    res.redirect('/dashboard');

  } catch (error) {
    console.error('Login error:', error);
    res.redirect('/login?error=' + encodeURIComponent('An error occurred. Please try again.'));
  }
});

/**
 * GET /logout - Logout
 */
router.get('/logout', (req, res) => {
  if (req.session) {
    console.log(`User logged out: ${req.session.email || 'unknown'}`);
    // Clear session data manually (cookie-session doesn't have destroy method)
    delete req.session.userId;
    delete req.session.email;
  }
  res.redirect('/');
});

/**
 * Middleware to require authentication
 */
function requireAuth(req, res, next) {
  console.log('Session debug:', {
    hasSession: !!req.session,
    userId: req.session?.userId,
    email: req.session?.email,
    sessionKeys: req.session ? Object.keys(req.session) : []
  });

  if (!req.session || !req.session.userId) {
    console.log('Authentication failed, redirecting to login');
    return res.redirect('/login');
  }
  next();
}

module.exports = {
  router,
  requireAuth
};