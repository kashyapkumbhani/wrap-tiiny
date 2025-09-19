const bcrypt = require('bcrypt');

// Rate limiting for password attempts
const passwordAttempts = new Map(); // IP -> { count, lastAttempt }

const PASSWORD_ATTEMPTS = {
  MAX_ATTEMPTS: 5,
  WINDOW_MS: 15 * 60 * 1000, // 15 minutes
  LOCKOUT_MS: 30 * 60 * 1000, // 30 minutes
};

/**
 * Hash a 6-digit passcode for storage
 * @param {string} passcode - 6-digit numeric passcode
 * @returns {Promise<string>} - Bcrypt hash
 */
async function hashPasscode(passcode) {
  if (!isValidPasscode(passcode)) {
    throw new Error('Invalid passcode format. Must be 6 digits.');
  }
  
  const saltRounds = 12;
  return await bcrypt.hash(passcode.toString(), saltRounds);
}

/**
 * Verify a passcode against a hash
 * @param {string} passcode - Plain text 6-digit passcode
 * @param {string} hash - Bcrypt hash to verify against
 * @returns {Promise<boolean>} - True if passcode matches
 */
async function verifyPasscode(passcode, hash) {
  if (!isValidPasscode(passcode) || !hash) {
    return false;
  }
  
  return await bcrypt.compare(passcode.toString(), hash);
}

/**
 * Validate passcode format (6 digits)
 * @param {string|number} passcode - Passcode to validate
 * @returns {boolean} - True if valid format
 */
function isValidPasscode(passcode) {
  const code = passcode.toString();
  return /^[0-9]{6}$/.test(code);
}

/**
 * Check if IP is rate limited for password attempts
 * @param {string} ip - Client IP address
 * @returns {boolean} - True if rate limited
 */
function isRateLimited(ip) {
  const attempts = passwordAttempts.get(ip);
  
  if (!attempts) {
    return false;
  }
  
  const now = Date.now();
  const timeSinceLastAttempt = now - attempts.lastAttempt;
  
  // Reset attempts if window has passed
  if (timeSinceLastAttempt > PASSWORD_ATTEMPTS.WINDOW_MS) {
    passwordAttempts.delete(ip);
    return false;
  }
  
  // Check if locked out
  if (attempts.count >= PASSWORD_ATTEMPTS.MAX_ATTEMPTS) {
    if (timeSinceLastAttempt < PASSWORD_ATTEMPTS.LOCKOUT_MS) {
      return true;
    } else {
      // Lockout period expired, reset
      passwordAttempts.delete(ip);
      return false;
    }
  }
  
  return false;
}

/**
 * Record a password attempt (failed or successful)
 * @param {string} ip - Client IP address
 * @param {boolean} success - Whether the attempt was successful
 */
function recordPasswordAttempt(ip, success) {
  const now = Date.now();
  const attempts = passwordAttempts.get(ip) || { count: 0, lastAttempt: now };
  
  if (success) {
    // Successful attempt - clear rate limiting
    passwordAttempts.delete(ip);
  } else {
    // Failed attempt - increment counter
    attempts.count += 1;
    attempts.lastAttempt = now;
    passwordAttempts.set(ip, attempts);
  }
}

/**
 * Generate password entry page HTML
 * @param {string} subdomain - Site subdomain
 * @param {string} siteId - Site ID for form submission
 * @param {string} error - Optional error message to display
 * @returns {string} - HTML for password entry page
 */
function generatePasswordEntryPage(subdomain, siteId, error = null) {
  return `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Protected Site - ${subdomain}</title>
    <style>
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }
        
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            min-height: 100vh;
            display: flex;
            align-items: center;
            justify-content: center;
        }
        
        .password-container {
            background: white;
            padding: 2.5rem;
            border-radius: 12px;
            box-shadow: 0 10px 25px rgba(0, 0, 0, 0.1);
            max-width: 400px;
            width: 90%;
            text-align: center;
        }
        
        .lock-icon {
            font-size: 3rem;
            color: #667eea;
            margin-bottom: 1rem;
        }
        
        h1 {
            color: #333;
            margin-bottom: 0.5rem;
            font-size: 1.5rem;
        }
        
        .subtitle {
            color: #666;
            margin-bottom: 2rem;
            font-size: 0.9rem;
        }
        
        .form-group {
            margin-bottom: 1.5rem;
        }
        
        label {
            display: block;
            color: #555;
            margin-bottom: 0.5rem;
            font-weight: 500;
        }
        
        input[type="password"] {
            width: 100%;
            padding: 0.875rem;
            font-size: 1.1rem;
            border: 2px solid #e1e5e9;
            border-radius: 8px;
            text-align: center;
            letter-spacing: 0.5rem;
            transition: border-color 0.2s, box-shadow 0.2s;
        }
        
        input[type="password"]:focus {
            outline: none;
            border-color: #667eea;
            box-shadow: 0 0 0 3px rgba(102, 126, 234, 0.1);
        }
        
        button {
            width: 100%;
            background: #667eea;
            color: white;
            padding: 0.875rem;
            font-size: 1rem;
            border: none;
            border-radius: 8px;
            cursor: pointer;
            font-weight: 500;
            transition: background-color 0.2s, transform 0.1s;
        }
        
        button:hover {
            background: #5a67d8;
        }
        
        button:active {
            transform: translateY(1px);
        }
        
        button:disabled {
            background: #a0aec0;
            cursor: not-allowed;
            transform: none;
        }
        
        .error-message {
            background: #fed7d7;
            color: #c53030;
            padding: 0.75rem;
            border-radius: 6px;
            margin-bottom: 1rem;
            font-size: 0.9rem;
        }
        
        .site-info {
            margin-top: 2rem;
            padding-top: 1.5rem;
            border-top: 1px solid #e2e8f0;
        }
        
        .site-name {
            color: #667eea;
            font-weight: 600;
        }
        
        @media (max-width: 480px) {
            .password-container {
                padding: 2rem 1.5rem;
            }
        }
    </style>
</head>
<body>
    <div class="password-container">
        <div class="lock-icon">🔒</div>
        <h1>Protected Site</h1>
        <p class="subtitle">This site is password protected</p>
        
        ${error ? `<div class="error-message">${error}</div>` : ''}
        
        <form method="POST" action="/verify-password">
            <input type="hidden" name="siteId" value="${siteId}">
            
            <div class="form-group">
                <label for="passcode">Enter 6-Digit Passcode</label>
                <input 
                    type="password" 
                    id="passcode" 
                    name="passcode" 
                    maxlength="6" 
                    pattern="[0-9]{6}" 
                    placeholder="000000" 
                    required
                    autocomplete="off"
                >
            </div>
            
            <button type="submit">Access Site</button>
        </form>
        
        <div class="site-info">
            <p>Accessing: <span class="site-name">${subdomain}</span></p>
        </div>
    </div>
    
    <script>
        // Auto-focus passcode input
        document.getElementById('passcode').focus();
        
        // Only allow numeric input
        document.getElementById('passcode').addEventListener('input', function(e) {
            e.target.value = e.target.value.replace(/[^0-9]/g, '');
        });
        
        // Auto-submit when 6 digits entered
        document.getElementById('passcode').addEventListener('input', function(e) {
            if (e.target.value.length === 6) {
                // Small delay to show the complete code
                setTimeout(() => {
                    e.target.form.submit();
                }, 200);
            }
        });
    </script>
</body>
</html>`;
}

/**
 * Route handler for password verification
 * @param {object} db - Database instance
 * @returns {function} - Express route handler
 */
function passwordVerificationHandler(db) {
  return async (req, res) => {
    try {
      console.log('Password verification request:', {
        method: req.method,
        path: req.path,
        body: req.body,
        subdomain: req.subdomain
      });

      const { siteId, passcode } = req.body;

      if (!siteId || !passcode) {
        console.log('Missing siteId or passcode');
        return res.status(400).send('Missing required fields');
      }

      // Get site info
      const site = db.get('SELECT * FROM sites WHERE id = ? AND status = ?', [siteId, 'active']);

      if (!site) {
        console.log('Site not found:', siteId);
        return res.status(404).send('Site not found');
      }

      const clientIP = req.ip || req.connection.remoteAddress;
      const sessionKey = `site_access_${site.id}`;

      // Check rate limiting
      if (isRateLimited(clientIP)) {
        console.log('Rate limited for IP:', clientIP);
        recordPasswordAttempt(clientIP, false);
        const html = generatePasswordEntryPage(
          req.subdomain,
          site.id,
          'Too many failed attempts. Please try again later.'
        );
        return res.status(429).send(html);
      }

      // Verify passcode
      console.log('Verifying passcode for site:', site.id);
      if (await verifyPasscode(passcode, site.password_hash)) {
        console.log('Password verification successful for site:', site.id);
        // Success - record attempt and set session
        recordPasswordAttempt(clientIP, true);
        req.session[sessionKey] = true;

        // Redirect to original URL or site root
        const redirectUrl = req.session.redirect_after_auth || '/';
        delete req.session.redirect_after_auth;
        console.log('Redirecting to:', redirectUrl);
        return res.redirect(redirectUrl);
      } else {
        console.log('Password verification failed for site:', site.id);
        // Failed - record attempt and show error
        recordPasswordAttempt(clientIP, false);
        const html = generatePasswordEntryPage(
          req.subdomain,
          site.id,
          'Incorrect passcode. Please try again.'
        );
        return res.status(401).send(html);
      }
    } catch (error) {
      console.error('Password verification error:', error);
      const html = generatePasswordEntryPage(
        req.subdomain,
        req.body.siteId,
        'An error occurred. Please try again.'
      );
      return res.status(500).send(html);
    }
  };
}

/**
 * Middleware to check if site requires password protection
 * @param {object} db - Database instance
 * @returns {function} - Express middleware function
 */
function passwordProtectionMiddleware(db) {
  return async (req, res, next) => {
    try {
      const subdomain = req.hostname.split('.')[0];
      
      // Skip protection for main domain
      if (subdomain === req.hostname) {
        return next();
      }
      
      // Get site info
      const site = db.prepare('SELECT * FROM sites WHERE subdomain = ?').get(subdomain);
      
      if (!site) {
        return next(); // Let subdomain handler deal with 404
      }
      
      // Check if password protection is enabled
      if (!site.password_enabled || !site.password_hash) {
        return next(); // No protection needed
      }
      
      // Check if user has valid session for this site
      const sessionKey = `site_access_${site.id}`;
      if (req.session && req.session[sessionKey]) {
        return next(); // Already authenticated
      }
      
      // Handle password verification form submission
      if (req.method === 'POST' && req.path === '/verify-password') {
        const { passcode, siteId } = req.body;
        const clientIP = req.ip || req.connection.remoteAddress;
        
        // Check rate limiting
        if (isRateLimited(clientIP)) {
          const html = generatePasswordEntryPage(
            subdomain, 
            site.id, 
            'Too many failed attempts. Please try again later.'
          );
          return res.status(429).send(html);
        }
        
        // Verify passcode
        if (siteId === site.id && await verifyPasscode(passcode, site.password_hash)) {
          // Success - record attempt and set session
          recordPasswordAttempt(clientIP, true);
          req.session[sessionKey] = true;
          
          // Redirect to original URL or site root
          const redirectUrl = req.session.redirect_after_auth || '/';
          delete req.session.redirect_after_auth;
          return res.redirect(redirectUrl);
        } else {
          // Failed - record attempt and show error
          recordPasswordAttempt(clientIP, false);
          const html = generatePasswordEntryPage(
            subdomain, 
            site.id, 
            'Incorrect passcode. Please try again.'
          );
          return res.status(401).send(html);
        }
      }
      
      // Store original URL for redirect after auth
      if (req.method === 'GET') {
        req.session.redirect_after_auth = req.url;
      }
      
      // Show password entry form
      const html = generatePasswordEntryPage(subdomain, site.id);
      return res.send(html);
      
    } catch (error) {
      console.error('Password protection middleware error:', error);
      return next(); // Continue without protection on error
    }
  };
}

/**
 * Clean up old password attempt records (call periodically)
 */
function cleanupPasswordAttempts() {
  const now = Date.now();
  const expiredIPs = [];
  
  for (const [ip, attempts] of passwordAttempts.entries()) {
    const timeSinceLastAttempt = now - attempts.lastAttempt;
    if (timeSinceLastAttempt > PASSWORD_ATTEMPTS.LOCKOUT_MS) {
      expiredIPs.push(ip);
    }
  }
  
  expiredIPs.forEach(ip => passwordAttempts.delete(ip));
}

// Clean up expired attempts every 10 minutes
setInterval(cleanupPasswordAttempts, 10 * 60 * 1000);

module.exports = {
  hashPasscode,
  verifyPasscode,
  isValidPasscode,
  isRateLimited,
  recordPasswordAttempt,
  generatePasswordEntryPage,
  passwordProtectionMiddleware,
  passwordVerificationHandler,
  cleanupPasswordAttempts,
};