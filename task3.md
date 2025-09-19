# Task 3 — Code Editor & Password Protection Features

## Overview
Add code editing capabilities and password protection features to the dashboard, enhancing site management with inline HTML editing, action buttons for site operations, and 6-digit passcode protection for sites.

## Scope
- **Code Editor**: In-dashboard HTML editing with syntax highlighting and live preview
- **Site Actions**: Edit Code, View Site, Delete Site buttons on each site card
- **Password Protection**: Optional 6-digit passcode protection for sites
- **Enhanced UI**: Action buttons, larger modals, improved site cards

## 1. Code Editor Module (code-editor.js)

### Purpose
Provide an in-dashboard code editing interface for HTML files with syntax highlighting, live preview, and save functionality.

### Features
- **Syntax Highlighting**: HTML/CSS/JS syntax highlighting using CodeMirror or Monaco Editor
- **Live Preview**: Optional preview pane showing rendered HTML
- **File Management**: Edit index.html and navigate through site files (for ZIP uploads)
- **Auto-save**: Save changes automatically or manual save with Ctrl+S
- **Full Screen**: Expand editor to full screen for better coding experience
- **Error Handling**: Show validation errors and file save status

### UI Components
- **Large Modal**: 90vw x 85vh modal for comfortable editing
- **Split Layout**: Code editor (left) + Live preview (right, toggleable)
- **Toolbar**: Save, Preview Toggle, Full Screen, File Selector (for multi-file sites)
- **Status Bar**: File size, last saved time, cursor position, validation status

### API Endpoints Required
- `GET /api/sites/:siteId/files` - List all files in a site
- `GET /api/sites/:siteId/files/:filename` - Get file content
- `PUT /api/sites/:siteId/files/:filename` - Save file content
- `POST /api/sites/:siteId/files` - Create new file (Phase 3+)
- `DELETE /api/sites/:siteId/files/:filename` - Delete file (Phase 3+)

## 2. Enhanced Site Cards with Action Buttons

### Site Card Layout
Each site in "Your Sites" section will have:
```
[Site Info: Subdomain, Created Date, Status] [Action Buttons: Edit Code | View Site | Delete Site]
```

### Action Buttons
- **Edit Code** (📝): Opens code editor modal with the site's index.html
- **View Site** (🔗): Opens site URL in new tab (existing functionality)
- **Delete Site** (🗑️): Shows confirmation modal, then deletes site
- **Settings** (⚙️): Opens site settings modal (password protection, etc.)

### Button States
- **Edit Code**: Always enabled for active sites
- **View Site**: Always enabled, opens site URL
- **Delete Site**: Shows confirmation dialog with site name
- **Settings**: Opens settings modal

## 3. Password Protection Module (password-protected.js)

### Purpose
Add optional 6-digit passcode protection to sites, requiring visitors to enter the code before accessing content.

### Features
- **6-Digit Passcode**: Numeric PIN (000000-999999)
- **Upload-time Choice**: Enable password protection during file upload
- **Post-upload Management**: Add/remove/change password via Settings button
- **Session-based Access**: Once entered correctly, access persists for session
- **Customizable Styling**: Password entry page matches site branding

### Database Schema Extension
Add to `sites` table:
```sql
ALTER TABLE sites ADD COLUMN password_hash TEXT NULL;
ALTER TABLE sites ADD COLUMN password_enabled BOOLEAN DEFAULT FALSE;
```

### Password Flow
1. **Upload**: User can enable password protection and set 6-digit code
2. **Visit Protected Site**: Shows password entry form instead of site content
3. **Enter Password**: User enters 6-digit code
4. **Session Storage**: On success, set session/cookie to bypass password for subsequent visits
5. **Access Site**: Show actual site content

### API Endpoints Required
- `PUT /api/sites/:siteId/password` - Set/update site password
- `DELETE /api/sites/:siteId/password` - Remove password protection
- `POST /api/sites/:siteId/verify-password` - Verify password for site access

### Password Entry Page Design
```html
<!DOCTYPE html>
<html>
<head>
  <title>Protected Site - Enter Passcode</title>
  <!-- Clean, minimal styling -->
</head>
<body>
  <div class="password-container">
    <h1>🔒 Protected Site</h1>
    <p>This site is password protected. Please enter the 6-digit passcode:</p>
    <form>
      <input type="password" maxlength="6" pattern="[0-9]{6}" placeholder="000000">
      <button type="submit">Access Site</button>
    </form>
    <div class="error-message" style="display: none;">Incorrect passcode. Please try again.</div>
  </div>
</body>
</html>
```

## 4. Frontend Implementation (dashboard.js updates)

### New Modal Types
- **Code Editor Modal**: Large modal with CodeMirror/Monaco integration
- **Delete Confirmation Modal**: Simple confirmation with site name
- **Site Settings Modal**: Password protection toggle and passcode input

### Enhanced Site Cards
Update `updateSitesList()` function to include action buttons:
```javascript
<div class="site-item">
  <div class="site-info">
    <h3><a href="${site.url}" target="_blank">${site.subdomain}</a></h3>
    <p>Created ${new Date(site.created_at).toLocaleDateString()}</p>
    ${site.password_enabled ? '<span class="password-badge">🔒 Protected</span>' : ''}
  </div>
  <div class="site-actions">
    <button class="btn-action" data-action="edit" data-site-id="${site.id}">📝 Edit Code</button>
    <button class="btn-action" data-action="view" data-site-id="${site.id}" data-url="${site.url}">🔗 View Site</button>
    <button class="btn-action" data-action="settings" data-site-id="${site.id}">⚙️ Settings</button>
    <button class="btn-action btn-danger" data-action="delete" data-site-id="${site.id}">🗑️ Delete</button>
  </div>
</div>
```

### Code Editor Integration
- **Dependency**: Include CodeMirror via CDN or npm (prefer CDN for simplicity)
- **Language**: HTML mode with CSS/JS syntax highlighting
- **Theme**: Clean, professional theme (default or monokai)
- **Features**: Line numbers, bracket matching, auto-indent, search/replace

## 5. Upload Modal Enhancement

### Password Protection Option
Add to upload modal after file selection:
```html
<div class="form-group">
  <label>
    <input type="checkbox" id="enable-password"> Enable Password Protection
  </label>
  <div class="password-options" id="password-options" style="display: none;">
    <label for="site-password">6-Digit Passcode</label>
    <input type="password" id="site-password" maxlength="6" pattern="[0-9]{6}" placeholder="000000">
    <small>Visitors will need this 6-digit code to access your site</small>
  </div>
</div>
```

### Upload Flow Update
1. User selects file and subdomain
2. User optionally enables password protection and sets 6-digit code
3. Upload processes file and stores password hash (if enabled)
4. Site is deployed with password protection (if enabled)

## 6. Backend Updates Required

### API Routes (api.js)
Add new endpoints for code editing and password management:
```javascript
// Code editing
router.get('/sites/:siteId/files', getSiteFiles);
router.get('/sites/:siteId/files/:filename', getFileContent);
router.put('/sites/:siteId/files/:filename', updateFileContent);

// Site management
router.delete('/sites/:siteId', deleteSite);

// Password protection
router.put('/sites/:siteId/password', setSitePassword);
router.delete('/sites/:siteId/password', removeSitePassword);
```

### Subdomain Serving Update (subdomain.js)
Update to handle password-protected sites:
```javascript
// Check if site requires password
if (site.password_enabled) {
  // Check if user has valid session for this site
  const sessionKey = `site_access_${site.id}`;
  if (!req.session[sessionKey]) {
    // Show password entry form
    return res.send(generatePasswordEntryPage(subdomain, site.id));
  }
}
// Proceed to serve site content...
```

### Database Migration
Create migration file `migrations/002_password_protection.sql`:
```sql
-- Add password protection fields to sites table
ALTER TABLE sites ADD COLUMN password_hash TEXT NULL;
ALTER TABLE sites ADD COLUMN password_enabled BOOLEAN DEFAULT FALSE;

-- Index for performance
CREATE INDEX IF NOT EXISTS idx_sites_password_enabled ON sites(password_enabled);
```

## 7. File Structure

### New Files
- `code-editor.js` - Code editor backend logic and file management
- `password-protected.js` - Password protection middleware and utilities
- `static/codemirror/` - CodeMirror assets (or CDN links)
- `migrations/002_password_protection.sql` - Database schema update

### Updated Files
- `static/dashboard.js` - Enhanced with code editor and action buttons
- `html/dashboard.html` - Updated styles for new modals and action buttons
- `api.js` - New endpoints for file management and password protection
- `subdomain.js` - Password protection checks before serving content
- `server.js` - Mount new routes and middleware

## 8. Styling Requirements

### Action Buttons CSS
```css
.site-actions {
  display: flex;
  gap: 0.5rem;
  flex-wrap: wrap;
}

.btn-action {
  padding: 0.375rem 0.75rem;
  font-size: 0.875rem;
  border: 1px solid #d1d5db;
  background: white;
  border-radius: 0.375rem;
  cursor: pointer;
  transition: all 0.2s;
}

.btn-action:hover {
  background: #f9fafb;
  border-color: #2563eb;
}

.btn-danger:hover {
  background: #fef2f2;
  border-color: #dc2626;
  color: #dc2626;
}

.password-badge {
  display: inline-block;
  background: #fef3c7;
  color: #92400e;
  padding: 0.125rem 0.5rem;
  border-radius: 9999px;
  font-size: 0.75rem;
  font-weight: 500;
}
```

### Code Editor Modal CSS
```css
.modal-large {
  max-width: 90vw;
  max-height: 85vh;
  width: 90vw;
  height: 85vh;
}

.editor-container {
  display: flex;
  height: calc(100% - 120px); /* Account for header/footer */
}

.editor-pane {
  flex: 1;
  display: flex;
  flex-direction: column;
}

.preview-pane {
  flex: 1;
  border-left: 1px solid #e5e7eb;
  display: flex;
  flex-direction: column;
}

.editor-toolbar {
  display: flex;
  justify-content: space-between;
  padding: 0.75rem;
  border-bottom: 1px solid #e5e7eb;
  background: #f9fafb;
}
```

## 9. Security Considerations

### Code Editor Security
- **File Path Validation**: Prevent path traversal attacks when editing files
- **File Type Restrictions**: Only allow editing of safe file types (.html, .css, .js, .txt)
- **Size Limits**: Prevent editing of extremely large files
- **User Authorization**: Verify user owns the site before allowing edits

### Password Protection Security
- **Hash Storage**: Store bcrypt hashes, never plain text passcodes
- **Rate Limiting**: Limit password attempts per site per IP
- **Session Management**: Secure session storage for site access tokens
- **Passcode Validation**: Server-side validation of 6-digit numeric format

## 10. Acceptance Criteria

### Code Editor
- [ ] Edit button opens code editor modal with current HTML content
- [ ] Syntax highlighting works for HTML/CSS/JS
- [ ] Save button updates the file and shows success/error status
- [ ] Live preview pane shows rendered HTML (optional toggle)
- [ ] File size and save status displayed in status bar
- [ ] Modal can be resized and maximized for better editing

### Site Actions
- [ ] Each site card shows Edit Code, View Site, Settings, and Delete buttons
- [ ] Edit Code opens the code editor with the site's index.html
- [ ] View Site opens the live site URL in a new tab
- [ ] Delete shows confirmation dialog with site name, then removes site
- [ ] Settings opens modal for password protection management

### Password Protection
- [ ] Upload modal includes password protection option
- [ ] Password-protected sites show password entry form before content
- [ ] Correct 6-digit passcode grants access for the session
- [ ] Password can be added, changed, or removed via Settings
- [ ] Protected sites show lock badge in dashboard
- [ ] Invalid password attempts are rate-limited

### UI/UX
- [ ] All modals are responsive and accessible
- [ ] Action buttons have clear hover states and icons
- [ ] Code editor is comfortable for extended editing sessions
- [ ] Password entry form is clean and user-friendly
- [ ] All operations provide clear success/error feedback

## 11. Future Enhancements (Task 4+)

- **Multi-file Editing**: Edit CSS/JS files in ZIP uploads
- **File Browser**: Tree view for navigating site files
- **Syntax Validation**: Real-time HTML/CSS validation
- **Auto-backup**: Automatic backups before editing
- **Collaborative Editing**: Multiple users editing simultaneously
- **Custom Password Pages**: Branded password entry forms
- **Analytics**: Track password attempts and site access
- **Bulk Operations**: Batch delete/password management

---

This specification provides a comprehensive foundation for implementing advanced site management features while maintaining the simple, lightweight architecture established in previous tasks.