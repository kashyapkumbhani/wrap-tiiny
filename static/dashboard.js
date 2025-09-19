/**
 * Dashboard JavaScript for Tinny
 * 
 * Handles modal interactions, file uploads, and AJAX calls
 * No inline JavaScript - all interactions handled here
 */

class TinnyDashboard {
  constructor() {
    this.modal = null;
    this.currentStep = 'idle';
    this.uploadType = 'html';
    this.selectedFile = null;
    this.selectedSubdomain = '';
    this.enablePassword = false;
    this.password = '';
    
    this.init();
  }

  init() {
    // Wait for DOM to be ready
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', () => {
        this.bindEvents();
        this.loadInitialData();
      });
    } else {
      this.bindEvents();
      this.loadInitialData();
    }
  }
  
  /**
   * Load initial data on page load
   */
  async loadInitialData() {
    // Load sites on page load
    await this.refreshSites();
  }

  bindEvents() {
    // Upload button click
    const uploadBtn = document.getElementById('btn-upload');
    if (uploadBtn) {
      uploadBtn.addEventListener('click', (e) => {
        e.preventDefault();
        this.openModal();
      });
    }

    // Refresh sites button
    const refreshBtn = document.getElementById('btn-refresh-sites');
    if (refreshBtn) {
      refreshBtn.addEventListener('click', (e) => {
        e.preventDefault();
        this.refreshSites();
      });
    }
  }

  openModal() {
    this.modal = this.createModal();
    document.body.appendChild(this.modal);
    
    // Focus trap and ESC handling
    this.modal.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        this.closeModal();
      }
    });
    
    // Focus the first input
    const firstInput = this.modal.querySelector('input, select, textarea, button');
    if (firstInput) {
      firstInput.focus();
    }

    this.currentStep = 'selecting';
    this.bindModalEvents();
  }

  closeModal() {
    if (this.modal) {
      document.body.removeChild(this.modal);
      this.modal = null;
    }
    this.currentStep = 'idle';
    this.selectedFile = null;
    this.selectedSubdomain = '';
    this.enablePassword = false;
    this.password = '';
  }

  createModal() {
    const modal = document.createElement('div');
    modal.className = 'modal-overlay';
    modal.innerHTML = `
      <div class="modal" role="dialog" aria-modal="true" aria-labelledby="modal-title">
        <div class="modal-header">
          <h2 id="modal-title">Upload Site</h2>
          <button class="modal-close" aria-label="Close">&times;</button>
        </div>
        
        <div class="modal-body">
          <div class="upload-step" id="step-select">
            <div class="form-group">
              <label>Upload Type</label>
              <div class="radio-group">
                <label class="radio-label">
                  <input type="radio" name="uploadType" value="html" checked>
                  <span class="radio-text">Single HTML File</span>
                  <small>Upload a single HTML file</small>
                </label>
                <label class="radio-label">
                  <input type="radio" name="uploadType" value="zip">
                  <span class="radio-text">ZIP Archive</span>
                  <small>Upload multiple files (must contain index.html)</small>
                </label>
              </div>
            </div>

            <div class="form-group">
              <label for="file-input">Select File</label>
              <div class="file-input-container">
                <input type="file" id="file-input" accept=".html,.htm,.zip">
                <div class="file-drop-zone" id="drop-zone">
                  <div class="file-drop-text">
                    <strong>Choose a file</strong> or drag it here
                  </div>
                </div>
              </div>
              <div class="file-info" id="file-info" style="display: none;"></div>
            </div>

            <div class="form-group">
              <label for="subdomain-input">Subdomain</label>
              <div class="subdomain-group">
                <input type="text" id="subdomain-input" placeholder="mysite" maxlength="63">
                <span class="domain-suffix">.lvh.me</span>
                <button type="button" class="btn-check" id="check-subdomain">Check</button>
              </div>
              <div class="subdomain-help">Your site will be available at https://<strong id="preview-subdomain">mysite</strong>.lvh.me</div>
              <div class="validation-message" id="subdomain-validation"></div>
            </div>
            
            <div class="form-group">
              <div class="password-protection">
                <label class="checkbox-label">
                  <input type="checkbox" id="enable-password">
                  <span class="checkbox-text">Enable Password Protection</span>
                  <small>Require a 6-digit passcode to access the site</small>
                </label>
                <div class="password-options" id="password-options" style="display: none;">
                  <label for="site-password">6-Digit Passcode</label>
                  <input type="password" id="site-password" maxlength="6" pattern="[0-9]{6}" placeholder="000000" autocomplete="new-password">
                  <small>Visitors will need this code to access your site</small>
                </div>
              </div>
            </div>
          </div>

          <div class="upload-step" id="step-uploading" style="display: none;">
            <div class="upload-progress">
              <div class="progress-icon">📁</div>
              <div class="progress-text" id="progress-text">Preparing upload...</div>
              <div class="progress-bar">
                <div class="progress-fill" id="progress-fill"></div>
              </div>
            </div>
          </div>

          <div class="upload-step" id="step-success" style="display: none;">
            <div class="success-content">
              <div class="success-icon">✅</div>
              <h3>Site deployed successfully!</h3>
              <div class="site-url">
                <a href="#" id="site-link" target="_blank" rel="noopener"></a>
              </div>
              <div class="success-details" id="success-details"></div>
            </div>
          </div>

          <div class="upload-step" id="step-error" style="display: none;">
            <div class="error-content">
              <div class="error-icon">❌</div>
              <h3>Upload failed</h3>
              <div class="error-message" id="error-message"></div>
              <button type="button" class="btn btn-secondary" id="retry-btn">Try Again</button>
            </div>
          </div>
        </div>

        <div class="modal-footer">
          <button type="button" class="btn btn-secondary" id="cancel-btn">Cancel</button>
          <button type="button" class="btn btn-primary" id="deploy-btn" disabled>Deploy Site</button>
          <button type="button" class="btn btn-primary" id="close-success-btn" style="display: none;">Close</button>
        </div>
      </div>
    `;

    return modal;
  }

  bindModalEvents() {
    // Close button
    const closeBtn = this.modal.querySelector('.modal-close');
    const cancelBtn = this.modal.querySelector('#cancel-btn');
    [closeBtn, cancelBtn].forEach(btn => {
      if (btn) {
        btn.addEventListener('click', () => this.closeModal());
      }
    });

    // Upload type radio buttons
    const radioButtons = this.modal.querySelectorAll('input[name="uploadType"]');
    radioButtons.forEach(radio => {
      radio.addEventListener('change', (e) => {
        this.uploadType = e.target.value;
        this.updateFileInput();
        this.validateForm();
      });
    });

    // File input
    const fileInput = this.modal.querySelector('#file-input');
    const dropZone = this.modal.querySelector('#drop-zone');
    
    if (fileInput) {
      fileInput.addEventListener('change', (e) => this.handleFileSelect(e.target.files[0]));
    }

    if (dropZone) {
      // Drag and drop
      dropZone.addEventListener('dragover', (e) => {
        e.preventDefault();
        dropZone.classList.add('dragover');
      });

      dropZone.addEventListener('dragleave', () => {
        dropZone.classList.remove('dragover');
      });

      dropZone.addEventListener('drop', (e) => {
        e.preventDefault();
        dropZone.classList.remove('dragover');
        const file = e.dataTransfer.files[0];
        if (file) {
          this.handleFileSelect(file);
          fileInput.files = e.dataTransfer.files;
        }
      });

      dropZone.addEventListener('click', () => {
        fileInput.click();
      });
    }

    // Subdomain input
    const subdomainInput = this.modal.querySelector('#subdomain-input');
    if (subdomainInput) {
      subdomainInput.addEventListener('input', (e) => {
        this.selectedSubdomain = e.target.value;
        this.updateSubdomainPreview();
        this.validateForm();
      });

      subdomainInput.addEventListener('keydown', (e) => {
        // Allow only alphanumeric and hyphen
        if (!/[a-z0-9\-]/.test(e.key.toLowerCase()) && !['Backspace', 'Delete', 'ArrowLeft', 'ArrowRight', 'Tab'].includes(e.key)) {
          e.preventDefault();
        }
      });
    }

    // Check subdomain button
    const checkBtn = this.modal.querySelector('#check-subdomain');
    if (checkBtn) {
      checkBtn.addEventListener('click', () => this.checkSubdomain());
    }
    
    // Password protection toggle
    const passwordToggle = this.modal.querySelector('#enable-password');
    const passwordOptions = this.modal.querySelector('#password-options');
    const passwordInput = this.modal.querySelector('#site-password');
    
    if (passwordToggle) {
      passwordToggle.addEventListener('change', (e) => {
        this.enablePassword = e.target.checked;
        if (passwordOptions) {
          passwordOptions.style.display = this.enablePassword ? 'block' : 'none';
        }
        if (passwordInput && !this.enablePassword) {
          passwordInput.value = '';
          this.password = '';
        }
        this.validateForm();
      });
    }
    
    if (passwordInput) {
      passwordInput.addEventListener('input', (e) => {
        // Only allow numeric input
        e.target.value = e.target.value.replace(/[^0-9]/g, '');
        this.password = e.target.value;
        this.validateForm();
      });
      
      passwordInput.addEventListener('keydown', (e) => {
        // Only allow numeric keys, backspace, delete, and arrow keys
        if (!/[0-9]/.test(e.key) && !['Backspace', 'Delete', 'ArrowLeft', 'ArrowRight', 'Tab'].includes(e.key)) {
          e.preventDefault();
        }
      });
    }

    // Deploy button
    const deployBtn = this.modal.querySelector('#deploy-btn');
    if (deployBtn) {
      deployBtn.addEventListener('click', () => this.deploySite());
    }

    // Retry button
    const retryBtn = this.modal.querySelector('#retry-btn');
    if (retryBtn) {
      retryBtn.addEventListener('click', () => this.showStep('select'));
    }

    // Close success button
    const closeSuccessBtn = this.modal.querySelector('#close-success-btn');
    if (closeSuccessBtn) {
      closeSuccessBtn.addEventListener('click', () => {
        this.closeModal();
        this.refreshSites();
      });
    }
  }

  updateFileInput() {
    const fileInput = this.modal.querySelector('#file-input');
    if (fileInput) {
      if (this.uploadType === 'html') {
        fileInput.accept = '.html,.htm';
      } else {
        fileInput.accept = '.zip';
      }
    }
  }

  handleFileSelect(file) {
    if (!file) {
      this.selectedFile = null;
      this.hideFileInfo();
      this.validateForm();
      return;
    }

    // Basic validation
    const ext = file.name.split('.').pop().toLowerCase();
    if (this.uploadType === 'html' && !['html', 'htm'].includes(ext)) {
      this.showError('Please select an HTML file.');
      return;
    }
    if (this.uploadType === 'zip' && ext !== 'zip') {
      this.showError('Please select a ZIP file.');
      return;
    }

    // Size validation
    const maxSize = this.uploadType === 'html' ? 5 * 1024 * 1024 : 25 * 1024 * 1024; // 5MB for HTML, 25MB for ZIP
    if (file.size > maxSize) {
      const maxMB = Math.round(maxSize / 1024 / 1024);
      this.showError(`File too large. Maximum size is ${maxMB}MB.`);
      return;
    }

    this.selectedFile = file;
    this.showFileInfo(file);
    this.validateForm();
  }

  showFileInfo(file) {
    const fileInfo = this.modal.querySelector('#file-info');
    if (fileInfo) {
      const sizeKB = Math.round(file.size / 1024);
      const sizeText = sizeKB < 1024 ? `${sizeKB} KB` : `${Math.round(sizeKB / 1024 * 10) / 10} MB`;
      
      fileInfo.innerHTML = `
        <div class="file-selected">
          <strong>${file.name}</strong> (${sizeText})
        </div>
      `;
      fileInfo.style.display = 'block';
    }
  }

  hideFileInfo() {
    const fileInfo = this.modal.querySelector('#file-info');
    if (fileInfo) {
      fileInfo.style.display = 'none';
    }
  }

  updateSubdomainPreview() {
    const preview = this.modal.querySelector('#preview-subdomain');
    if (preview) {
      preview.textContent = this.selectedSubdomain || 'mysite';
    }
  }

  async checkSubdomain() {
    if (!this.selectedSubdomain) {
      this.showSubdomainValidation('Please enter a subdomain', 'error');
      return;
    }

    try {
      this.showSubdomainValidation('Checking availability...', 'checking');
      
      const response = await fetch('/api/sites/check-subdomain', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ subdomain: this.selectedSubdomain })
      });

      const data = await response.json();

      if (!response.ok) {
        this.showSubdomainValidation(data.error || 'Check failed', 'error');
        return;
      }

      if (data.available) {
        this.showSubdomainValidation('✓ Available', 'success');
      } else {
        this.showSubdomainValidation('✗ Already taken', 'error');
      }

    } catch (error) {
      console.error('Subdomain check error:', error);
      this.showSubdomainValidation('Check failed. Please try again.', 'error');
    }
  }

  showSubdomainValidation(message, type) {
    const validation = this.modal.querySelector('#subdomain-validation');
    if (validation) {
      validation.textContent = message;
      validation.className = `validation-message ${type}`;
    }
  }

  validateForm() {
    const deployBtn = this.modal.querySelector('#deploy-btn');
    if (deployBtn) {
      let isValid = this.selectedFile && this.selectedSubdomain && this.selectedSubdomain.length > 0;
      
      // If password protection is enabled, password must be exactly 6 digits
      if (this.enablePassword) {
        isValid = isValid && this.password.length === 6;
      }
      
      deployBtn.disabled = !isValid;
    }
  }

  async deploySite() {
    if (!this.selectedFile || !this.selectedSubdomain) {
      return;
    }

    try {
      this.showStep('uploading');
      this.updateProgress('Validating...', 10);

      // Create FormData
      const formData = new FormData();
      formData.append('type', this.uploadType);
      formData.append('subdomain', this.selectedSubdomain);
      formData.append('file', this.selectedFile);
      
      // Add password protection if enabled
      if (this.enablePassword && this.password) {
        formData.append('enablePassword', 'true');
        formData.append('password', this.password);
      }

      this.updateProgress('Uploading...', 30);

      // Upload file
      const response = await fetch('/api/upload', {
        method: 'POST',
        body: formData
      });

      this.updateProgress('Processing...', 70);

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Upload failed');
      }

      this.updateProgress('Complete!', 100);

      // Show success
      setTimeout(() => {
        this.showSuccess(data);
      }, 500);

    } catch (error) {
      console.error('Upload error:', error);
      this.showStep('error');
      this.modal.querySelector('#error-message').textContent = error.message || 'Upload failed. Please try again.';
    }
  }

  updateProgress(text, percent) {
    const progressText = this.modal.querySelector('#progress-text');
    const progressFill = this.modal.querySelector('#progress-fill');
    
    if (progressText) {
      progressText.textContent = text;
    }
    
    if (progressFill) {
      progressFill.style.width = `${percent}%`;
    }
  }

  showSuccess(data) {
    this.showStep('success');
    
    const siteLink = this.modal.querySelector('#site-link');
    const successDetails = this.modal.querySelector('#success-details');
    
    if (siteLink) {
      siteLink.href = data.url;
      siteLink.textContent = data.url;
    }
    
    if (successDetails) {
      const fileCount = Array.isArray(data.files) ? data.files.length : 1;
      const sizeText = this.formatBytes(data.size || 0);
      successDetails.innerHTML = `
        <div class="detail-item">Files: ${fileCount}</div>
        <div class="detail-item">Size: ${sizeText}</div>
        <div class="detail-item">Type: ${data.type === 'html' ? 'HTML' : 'ZIP Archive'}</div>
      `;
    }
  }

  showStep(step) {
    const steps = this.modal.querySelectorAll('.upload-step');
    steps.forEach(s => s.style.display = 'none');
    
    const targetStep = this.modal.querySelector(`#step-${step}`);
    if (targetStep) {
      targetStep.style.display = 'block';
    }

    // Update footer buttons
    const deployBtn = this.modal.querySelector('#deploy-btn');
    const cancelBtn = this.modal.querySelector('#cancel-btn');
    const closeSuccessBtn = this.modal.querySelector('#close-success-btn');

    if (step === 'success') {
      deployBtn.style.display = 'none';
      cancelBtn.style.display = 'none';
      closeSuccessBtn.style.display = 'inline-block';
    } else if (step === 'uploading') {
      deployBtn.style.display = 'none';
      cancelBtn.disabled = true;
    } else {
      deployBtn.style.display = 'inline-block';
      cancelBtn.style.display = 'inline-block';
      cancelBtn.disabled = false;
      closeSuccessBtn.style.display = 'none';
    }

    this.currentStep = step;
  }

  showError(message) {
    // Simple error display - could be enhanced with a toast system
    alert(message);
  }

  formatBytes(bytes) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }

  async refreshSites() {
    try {
      const response = await fetch('/api/sites');
      if (response.ok) {
        const sites = await response.json();
        this.updateSitesList(sites);
      } else {
        console.error('Failed to fetch sites:', response.status);
        // Show empty state if API fails
        this.updateSitesList([]);
      }
    } catch (error) {
      console.error('Failed to refresh sites:', error);
      // Show empty state on error
      this.updateSitesList([]);
    }
  }

  updateSitesList(sites) {
    const sitesContainer = document.querySelector('#sites-container');
    if (!sitesContainer) return;

    if (sites.length === 0) {
      sitesContainer.innerHTML = `
        <div class="card">
          <div class="empty-state">
            <div class="empty-state-icon">🚀</div>
            <h2>Welcome to Tinny!</h2>
            <p>You don't have any sites yet. Create your first site to get started.</p>
          </div>
        </div>
      `;
    } else {
      sitesContainer.innerHTML = `
        <div class="card">
          <div class="sites-header">
            <h2>Your Sites (${sites.length})</h2>
            <button class="btn btn-secondary btn-sm" id="btn-refresh-sites">Refresh</button>
          </div>
          <div class="sites-list">
            ${sites.map(site => `
              <div class="site-item">
                <div class="site-info">
                  <div class="site-header">
                    <h3><a href="${site.url}" target="_blank" rel="noopener">${site.subdomain}</a></h3>
                    ${site.password_enabled ? '<span class="password-badge">🔒 Protected</span>' : ''}
                  </div>
                  <p>Created ${new Date(site.created_at).toLocaleDateString()}</p>
                </div>
                <div class="site-actions">
                  <button class="btn-action btn-analytics" data-action="analytics" data-site-id="${site.id}" data-subdomain="${site.subdomain}" data-url="${site.url}" title="View Analytics">
                    📊 Analytics
                  </button>
                  <button class="btn-action" data-action="edit" data-site-id="${site.id}" data-subdomain="${site.subdomain}" title="Edit Code">
                    📝 Edit
                  </button>
                  <button class="btn-action" data-action="view" data-url="${site.url}" title="View Site">
                    🔗 View
                  </button>
                  <button class="btn-action" data-action="settings" data-site-id="${site.id}" data-subdomain="${site.subdomain}" data-password-enabled="${site.password_enabled}" title="Settings">
                    ⚙️ Settings
                  </button>
                  <button class="btn-action btn-danger" data-action="delete" data-site-id="${site.id}" data-subdomain="${site.subdomain}" title="Delete Site">
                    🗑️ Delete
                  </button>
                </div>
              </div>
            `).join('')}
          </div>
        </div>
      `;
      
      // Re-bind refresh button
      const refreshBtn = document.querySelector('#btn-refresh-sites');
      if (refreshBtn) {
        refreshBtn.addEventListener('click', (e) => {
          e.preventDefault();
          this.refreshSites();
        });
      }
      
      // Bind action buttons
      this.bindActionButtons();
    }
  }
  
  /**
   * Bind event handlers for site action buttons
   */
  bindActionButtons() {
    const actionButtons = document.querySelectorAll('.btn-action');
    actionButtons.forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        const action = btn.dataset.action;
        const siteId = btn.dataset.siteId;
        const subdomain = btn.dataset.subdomain;
        const url = btn.dataset.url;
        const passwordEnabled = btn.dataset.passwordEnabled === 'true';
        
        switch (action) {
          case 'analytics':
            this.openAnalytics(siteId, subdomain, url);
            break;
          case 'edit':
            this.openCodeEditor(siteId, subdomain);
            break;
          case 'view':
            this.viewSite(url);
            break;
          case 'settings':
            this.openSiteSettings(siteId, subdomain, passwordEnabled);
            break;
          case 'delete':
            this.confirmDeleteSite(siteId, subdomain);
            break;
        }
      });
    });
  }
  
  /**
   * Open analytics for a site
   */
  openAnalytics(siteId, subdomain, url) {
    const analyticsModal = this.createAnalyticsModal(siteId, subdomain, url);
    document.body.appendChild(analyticsModal);
    
    // Focus trap and ESC handling
    analyticsModal.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        this.closeAnalyticsModal(analyticsModal);
      }
    });
    
    this.bindAnalyticsModalEvents(analyticsModal, siteId, subdomain);
    this.loadAnalyticsData(analyticsModal, siteId, subdomain);
  }

  /**
   * Open code editor for a site
   */
  openCodeEditor(siteId, subdomain) {
    if (window.codeEditor) {
      window.codeEditor.open(siteId);
    } else {
      alert('Code editor is not available. Please refresh the page.');
    }
  }
  
  /**
   * View site in new tab
   */
  viewSite(url) {
    window.open(url, '_blank', 'noopener,noreferrer');
  }
  
  /**
   * Open site settings modal
   */
  openSiteSettings(siteId, subdomain, passwordEnabled) {
    const settingsModal = this.createSettingsModal(siteId, subdomain, passwordEnabled);
    document.body.appendChild(settingsModal);
    
    // Focus trap and ESC handling
    settingsModal.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        this.closeSettingsModal(settingsModal);
      }
    });
    
    this.bindSettingsModalEvents(settingsModal, siteId);
  }
  
  /**
   * Create site settings modal
   */
  createSettingsModal(siteId, subdomain, passwordEnabled) {
    const modal = document.createElement('div');
    modal.className = 'modal-overlay';
    modal.innerHTML = `
      <div class="modal" role="dialog" aria-modal="true" aria-labelledby="settings-modal-title">
        <div class="modal-header">
          <h2 id="settings-modal-title">Site Settings - ${subdomain}</h2>
          <button class="modal-close" aria-label="Close">&times;</button>
        </div>
        
        <div class="modal-body">
          <div class="settings-section">
            <h3>Password Protection</h3>
            <div class="form-group">
              <label class="checkbox-label">
                <input type="checkbox" id="settings-enable-password" ${passwordEnabled ? 'checked' : ''}>
                <span class="checkbox-text">Enable Password Protection</span>
              </label>
              <div class="password-options" id="settings-password-options" style="display: ${passwordEnabled ? 'block' : 'none'};">
                <label for="settings-password">6-Digit Passcode</label>
                <input type="password" id="settings-password" maxlength="6" pattern="[0-9]{6}" placeholder="000000">
                <small>Leave empty to keep current password, or enter new one</small>
              </div>
            </div>
          </div>
          
          <div class="settings-section">
            <h3>Site Information</h3>
            <div class="info-item">
              <strong>URL:</strong> <a href="#" id="settings-site-url" target="_blank"></a>
            </div>
            <div class="info-item">
              <strong>Site ID:</strong> <code>${siteId}</code>
            </div>
          </div>
        </div>
        
        <div class="modal-footer">
          <button type="button" class="btn btn-secondary" id="settings-cancel-btn">Cancel</button>
          <button type="button" class="btn btn-primary" id="settings-save-btn">Save Settings</button>
        </div>
      </div>
    `;
    
    return modal;
  }
  
  /**
   * Bind events for settings modal
   */
  bindSettingsModalEvents(modal, siteId) {
    // Close button
    const closeBtn = modal.querySelector('.modal-close');
    const cancelBtn = modal.querySelector('#settings-cancel-btn');
    const saveBtn = modal.querySelector('#settings-save-btn');
    
    [closeBtn, cancelBtn].forEach(btn => {
      btn.addEventListener('click', () => this.closeSettingsModal(modal));
    });
    
    // Password toggle
    const passwordToggle = modal.querySelector('#settings-enable-password');
    const passwordOptions = modal.querySelector('#settings-password-options');
    const passwordInput = modal.querySelector('#settings-password');
    
    if (passwordToggle) {
      passwordToggle.addEventListener('change', (e) => {
        const enabled = e.target.checked;
        passwordOptions.style.display = enabled ? 'block' : 'none';
        if (!enabled) {
          passwordInput.value = '';
        }
      });
    }
    
    // Password input validation
    if (passwordInput) {
      passwordInput.addEventListener('input', (e) => {
        e.target.value = e.target.value.replace(/[^0-9]/g, '');
      });
      
      passwordInput.addEventListener('keydown', (e) => {
        if (!/[0-9]/.test(e.key) && !['Backspace', 'Delete', 'ArrowLeft', 'ArrowRight', 'Tab'].includes(e.key)) {
          e.preventDefault();
        }
      });
    }
    
    // Save button
    saveBtn.addEventListener('click', () => this.saveSettings(modal, siteId));
  }
  
  /**
   * Save site settings
   */
  async saveSettings(modal, siteId) {
    const passwordEnabled = modal.querySelector('#settings-enable-password').checked;
    const password = modal.querySelector('#settings-password').value;
    const saveBtn = modal.querySelector('#settings-save-btn');
    
    if (passwordEnabled && password && password.length !== 6) {
      alert('Password must be exactly 6 digits');
      return;
    }
    
    try {
      saveBtn.disabled = true;
      saveBtn.textContent = 'Saving...';
      
      if (passwordEnabled && password) {
        // Set or update password
        const response = await fetch(`/api/sites/${siteId}/password`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ password })
        });
        
        if (!response.ok) {
          const error = await response.json();
          throw new Error(error.error || 'Failed to set password');
        }
      } else if (!passwordEnabled) {
        // Remove password protection
        const response = await fetch(`/api/sites/${siteId}/password`, {
          method: 'DELETE'
        });
        
        if (!response.ok) {
          const error = await response.json();
          throw new Error(error.error || 'Failed to remove password protection');
        }
      }
      
      this.closeSettingsModal(modal);
      this.refreshSites();
      
    } catch (error) {
      console.error('Settings save error:', error);
      alert(`Error: ${error.message}`);
    } finally {
      saveBtn.disabled = false;
      saveBtn.textContent = 'Save Settings';
    }
  }
  
  /**
   * Close settings modal
   */
  closeSettingsModal(modal) {
    document.body.removeChild(modal);
  }
  
  /**
   * Show delete confirmation modal
   */
  confirmDeleteSite(siteId, subdomain) {
    const deleteModal = this.createDeleteModal(siteId, subdomain);
    document.body.appendChild(deleteModal);
    
    // Focus on cancel button for safety
    const cancelBtn = deleteModal.querySelector('#delete-cancel-btn');
    if (cancelBtn) {
      cancelBtn.focus();
    }
    
    // ESC to cancel
    deleteModal.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        this.closeDeleteModal(deleteModal);
      }
    });
    
    this.bindDeleteModalEvents(deleteModal, siteId, subdomain);
  }
  
  /**
   * Create delete confirmation modal
   */
  createDeleteModal(siteId, subdomain) {
    const modal = document.createElement('div');
    modal.className = 'modal-overlay';
    modal.innerHTML = `
      <div class="modal modal-small" role="dialog" aria-modal="true" aria-labelledby="delete-modal-title">
        <div class="modal-header">
          <h2 id="delete-modal-title">Delete Site</h2>
          <button class="modal-close" aria-label="Close">&times;</button>
        </div>
        
        <div class="modal-body">
          <div class="delete-warning">
            <div class="warning-icon">⚠️</div>
            <p>Are you sure you want to delete <strong>${subdomain}</strong>?</p>
            <p class="warning-text">This action cannot be undone. All files and data for this site will be permanently deleted.</p>
          </div>
          
          <div class="confirmation-input">
            <label for="delete-confirmation">Type <strong>${subdomain}</strong> to confirm:</label>
            <input type="text" id="delete-confirmation" placeholder="${subdomain}" autocomplete="off">
          </div>
        </div>
        
        <div class="modal-footer">
          <button type="button" class="btn btn-secondary" id="delete-cancel-btn">Cancel</button>
          <button type="button" class="btn btn-danger" id="delete-confirm-btn" disabled>Delete Site</button>
        </div>
      </div>
    `;
    
    return modal;
  }
  
  /**
   * Bind events for delete modal
   */
  bindDeleteModalEvents(modal, siteId, subdomain) {
    const closeBtn = modal.querySelector('.modal-close');
    const cancelBtn = modal.querySelector('#delete-cancel-btn');
    const confirmBtn = modal.querySelector('#delete-confirm-btn');
    const confirmInput = modal.querySelector('#delete-confirmation');
    
    // Close handlers
    [closeBtn, cancelBtn].forEach(btn => {
      btn.addEventListener('click', () => this.closeDeleteModal(modal));
    });
    
    // Confirmation input
    if (confirmInput) {
      confirmInput.addEventListener('input', (e) => {
        const isMatch = e.target.value.toLowerCase() === subdomain.toLowerCase();
        confirmBtn.disabled = !isMatch;
      });
    }
    
    // Delete confirmation
    confirmBtn.addEventListener('click', () => this.deleteSite(modal, siteId, subdomain));
  }
  
  /**
   * Delete site
   */
  async deleteSite(modal, siteId, subdomain) {
    const confirmBtn = modal.querySelector('#delete-confirm-btn');
    
    try {
      confirmBtn.disabled = true;
      confirmBtn.textContent = 'Deleting...';
      
      const response = await fetch(`/api/sites/${siteId}`, {
        method: 'DELETE'
      });
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to delete site');
      }
      
      this.closeDeleteModal(modal);
      this.refreshSites();
      
      // Show success message
      this.showToast(`Site "${subdomain}" has been deleted successfully.`, 'success');
      
    } catch (error) {
      console.error('Delete site error:', error);
      alert(`Error: ${error.message}`);
    } finally {
      confirmBtn.disabled = false;
      confirmBtn.textContent = 'Delete Site';
    }
  }
  
  /**
   * Close delete modal
   */
  closeDeleteModal(modal) {
    document.body.removeChild(modal);
  }
  
  /**
   * Create analytics modal
   */
  createAnalyticsModal(siteId, subdomain, url) {
    const modal = document.createElement('div');
    modal.className = 'modal-overlay';
    modal.innerHTML = `
      <div class="modal modal-large" role="dialog" aria-modal="true" aria-labelledby="analytics-modal-title">
        <div class="modal-header">
          <h2 id="analytics-modal-title">📊 Analytics - ${subdomain}</h2>
          <button class="modal-close" aria-label="Close">&times;</button>
        </div>
        
        <nav class="analytics-tabs">
          <button class="analytics-tab active" data-tab="overview">Overview</button>
          <button class="analytics-tab" data-tab="visitors">Visitors</button>
          <button class="analytics-tab" data-tab="traffic">Traffic Sources</button>
          <button class="analytics-tab" data-tab="location">Locations</button>
        </nav>
        
        <div class="modal-body">
          <div class="analytics-loading" id="analytics-loading">
            <div style="text-align: center; padding: 40px; color: #666;">
              <div style="font-size: 2rem; margin-bottom: 1rem;">📈</div>
              <div>Loading analytics data...</div>
            </div>
          </div>
          
          <div class="analytics-content" id="analytics-content" style="display: none;">
            <div class="analytics-tab-content" id="overview-content">
              <div class="analytics-grid" id="overview-grid"></div>
            </div>
            <div class="analytics-tab-content" id="visitors-content" style="display: none;">
              <div id="visitors-data"></div>
            </div>
            <div class="analytics-tab-content" id="traffic-content" style="display: none;">
              <div id="traffic-data"></div>
            </div>
            <div class="analytics-tab-content" id="location-content" style="display: none;">
              <div id="location-data"></div>
            </div>
          </div>
          
          <div class="analytics-error" id="analytics-error" style="display: none;">
            <div style="text-align: center; padding: 40px; color: #dc2626;">
              <div style="font-size: 2rem; margin-bottom: 1rem;">⚠️</div>
              <div>Failed to load analytics data</div>
              <button class="btn btn-secondary btn-sm" id="retry-analytics" style="margin-top: 1rem;">Retry</button>
            </div>
          </div>
        </div>
        
        <div class="modal-footer">
          <div class="analytics-actions">
            <button class="btn btn-secondary btn-sm" id="refresh-analytics">🔄 Refresh</button>
            <button class="btn btn-secondary btn-sm" id="export-analytics">📊 Export</button>
            <a href="${url}" target="_blank" class="btn btn-secondary btn-sm">🔗 Visit Site</a>
          </div>
          <button type="button" class="btn btn-secondary" id="analytics-close-btn">Close</button>
        </div>
      </div>
    `;
    
    // Inject analytics styles
    this.injectAnalyticsStyles();
    
    return modal;
  }

  /**
   * Inject analytics modal styles
   */
  injectAnalyticsStyles() {
    if (document.getElementById('analytics-modal-styles')) return;
    
    const style = document.createElement('style');
    style.id = 'analytics-modal-styles';
    style.textContent = `
      .analytics-tabs {
        display: flex;
        background: #f8f9fa;
        border-bottom: 1px solid #e5e7eb;
      }
      .analytics-tab {
        padding: 12px 20px;
        border: 0;
        background: transparent;
        cursor: pointer;
        border-bottom: 2px solid transparent;
        transition: all 0.2s;
        color: #6b7280;
      }
      .analytics-tab:hover {
        background: #e5e7eb;
        color: #374151;
      }
      .analytics-tab.active {
        background: #fff;
        border-bottom-color: #667eea;
        color: #667eea;
        font-weight: 500;
      }
      .analytics-content {
        min-height: 400px;
      }
      .analytics-tab-content[hidden] {
        display: none !important;
      }
      .analytics-grid {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
        gap: 20px;
        margin-bottom: 2rem;
      }
      .analytics-card {
        background: linear-gradient(135deg, #f8f9fa 0%, #e9ecef 100%);
        padding: 20px;
        border-radius: 8px;
        border: 1px solid #e5e7eb;
        text-align: center;
      }
      .analytics-metric {
        font-size: 2.5rem;
        font-weight: bold;
        color: #667eea;
        margin-bottom: 8px;
      }
      .analytics-label {
        font-size: 0.875rem;
        color: #6b7280;
        text-transform: uppercase;
        letter-spacing: 0.05em;
        font-weight: 500;
      }
      .visitors-list {
        max-height: 400px;
        overflow-y: auto;
        border: 1px solid #e5e7eb;
        border-radius: 8px;
      }
      .visitor-item {
        padding: 12px 16px;
        border-bottom: 1px solid #f3f4f6;
        display: grid;
        grid-template-columns: 1fr 120px 100px;
        gap: 16px;
        align-items: center;
        font-size: 0.875rem;
      }
      .visitor-item:last-child {
        border-bottom: 0;
      }
      .visitor-location {
        font-weight: 500;
        color: #374151;
      }
      .visitor-details {
        color: #6b7280;
      }
      .visitor-time {
        color: #9ca3af;
        font-size: 0.75rem;
      }
    `;
    
    document.head.appendChild(style);
  }

  /**
   * Bind analytics modal events
   */
  bindAnalyticsModalEvents(modal, siteId, subdomain) {
    // Close handlers
    const closeBtn = modal.querySelector('.modal-close');
    const closeModalBtn = modal.querySelector('#analytics-close-btn');
    
    [closeBtn, closeModalBtn].forEach(btn => {
      btn.addEventListener('click', () => this.closeAnalyticsModal(modal));
    });
    
    // Tab switching
    const tabs = modal.querySelectorAll('.analytics-tab');
    tabs.forEach(tab => {
      tab.addEventListener('click', (e) => {
        const targetTab = e.target.dataset.tab;
        this.switchAnalyticsTab(modal, targetTab);
      });
    });
    
    // Action buttons
    const refreshBtn = modal.querySelector('#refresh-analytics');
    const exportBtn = modal.querySelector('#export-analytics');
    const retryBtn = modal.querySelector('#retry-analytics');
    
    if (refreshBtn) {
      refreshBtn.addEventListener('click', () => {
        this.loadAnalyticsData(modal, siteId, subdomain);
      });
    }
    
    if (exportBtn) {
      exportBtn.addEventListener('click', () => {
        this.exportAnalyticsData(siteId, subdomain);
      });
    }
    
    if (retryBtn) {
      retryBtn.addEventListener('click', () => {
        this.loadAnalyticsData(modal, siteId, subdomain);
      });
    }
  }

  /**
   * Switch analytics tab
   */
  switchAnalyticsTab(modal, tabName) {
    // Update tab buttons
    modal.querySelectorAll('.analytics-tab').forEach(tab => {
      tab.classList.toggle('active', tab.dataset.tab === tabName);
    });
    
    // Update tab content
    modal.querySelectorAll('.analytics-tab-content').forEach(content => {
      content.style.display = content.id === `${tabName}-content` ? 'block' : 'none';
    });
  }

  /**
   * Load analytics data
   */
  async loadAnalyticsData(modal, siteId, subdomain) {
    const loadingEl = modal.querySelector('#analytics-loading');
    const contentEl = modal.querySelector('#analytics-content');
    const errorEl = modal.querySelector('#analytics-error');
    
    // Show loading state
    loadingEl.style.display = 'block';
    contentEl.style.display = 'none';
    errorEl.style.display = 'none';
    
    try {
      const response = await fetch(`/api/analytics/site/${siteId}?days=30`);
      
      if (!response.ok) {
        throw new Error(`Failed to fetch analytics: ${response.status}`);
      }
      
      const data = await response.json();
      
      // Hide loading, show content
      loadingEl.style.display = 'none';
      contentEl.style.display = 'block';
      
      // Render analytics data
      this.renderAnalyticsData(modal, data);
      
    } catch (error) {
      console.error('Analytics loading error:', error);
      
      // Show error state
      loadingEl.style.display = 'none';
      errorEl.style.display = 'block';
    }
  }

  /**
   * Render analytics data in modal
   */
  renderAnalyticsData(modal, data) {
    // Overview tab
    const overviewGrid = modal.querySelector('#overview-grid');
    if (overviewGrid) {
      overviewGrid.innerHTML = `
        <div class="analytics-card">
          <div class="analytics-metric">${data.totalVisits || 0}</div>
          <div class="analytics-label">Total Visits</div>
        </div>
        <div class="analytics-card">
          <div class="analytics-metric">${data.uniqueVisitors || 0}</div>
          <div class="analytics-label">Unique Visitors</div>
        </div>
        <div class="analytics-card">
          <div class="analytics-metric">${data.topCountry || 'N/A'}</div>
          <div class="analytics-label">Top Country</div>
        </div>
        <div class="analytics-card">
          <div class="analytics-metric">${data.primaryTrafficSource || 'Direct'}</div>
          <div class="analytics-label">Main Traffic Source</div>
        </div>
      `;
    }
    
    // Visitors tab
    const visitorsData = modal.querySelector('#visitors-data');
    if (visitorsData && data.recentVisits) {
      visitorsData.innerHTML = `
        <h3 style="margin-bottom: 1rem;">Recent Visitors</h3>
        <div class="visitors-list">
          ${data.recentVisits.map(visit => `
            <div class="visitor-item">
              <div>
                <div class="visitor-location">${visit.country || 'Unknown'}, ${visit.city || 'Unknown'}</div>
                <div class="visitor-details">${visit.ip_version || 'IPv4'} • ${visit.visitType || 'direct'}</div>
              </div>
              <div class="visitor-time">${new Date(visit.timestamp).toLocaleDateString()}</div>
              <div class="visitor-time">${new Date(visit.timestamp).toLocaleTimeString()}</div>
            </div>
          `).join('')}
        </div>
      `;
    }
    
    // Traffic tab
    const trafficData = modal.querySelector('#traffic-data');
    if (trafficData && data.trafficSources) {
      const sources = Object.entries(data.trafficSources);
      trafficData.innerHTML = `
        <h3 style="margin-bottom: 1rem;">Traffic Sources</h3>
        <div class="analytics-grid">
          ${sources.map(([source, count]) => `
            <div class="analytics-card">
              <div class="analytics-metric">${count}</div>
              <div class="analytics-label">${source.charAt(0).toUpperCase() + source.slice(1)}</div>
            </div>
          `).join('')}
        </div>
      `;
    }
    
    // Location tab
    const locationData = modal.querySelector('#location-data');
    if (locationData && data.topCountries) {
      locationData.innerHTML = `
        <h3 style="margin-bottom: 1rem;">Top Locations</h3>
        <div class="analytics-grid">
          ${data.topCountries.slice(0, 6).map(location => `
            <div class="analytics-card">
              <div class="analytics-metric">${location.count}</div>
              <div class="analytics-label">${location.country}</div>
            </div>
          `).join('')}
        </div>
      `;
    }
  }

  /**
   * Export analytics data
   */
  async exportAnalyticsData(siteId, subdomain) {
    try {
      const response = await fetch(`/api/analytics/site/${siteId}/export`);
      if (!response.ok) throw new Error('Export failed');
      
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      
      const a = document.createElement('a');
      a.href = url;
      a.download = `analytics-${subdomain}-${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      
      this.showToast('Analytics data exported successfully!', 'success');
    } catch (error) {
      this.showToast('Failed to export analytics data', 'error');
    }
  }

  /**
   * Close analytics modal
   */
  closeAnalyticsModal(modal) {
    document.body.removeChild(modal);
  }

  /**
   * Show toast notification
   */
  showToast(message, type = 'info') {
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.textContent = message;
    
    document.body.appendChild(toast);
    
    // Trigger animation
    setTimeout(() => toast.classList.add('toast-show'), 100);
    
    // Remove after 3 seconds
    setTimeout(() => {
      toast.classList.remove('toast-show');
      setTimeout(() => document.body.removeChild(toast), 300);
    }, 3000);
  }
}

// Initialize dashboard when script loads
new TinnyDashboard();
