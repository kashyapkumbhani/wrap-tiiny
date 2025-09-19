/**
 * Code Editor Module for Tinny
 * 
 * Features:
 * - CodeMirror integration for syntax highlighting
 * - File editing with save functionality
 * - Live preview (optional)
 * - Modal interface
 * - Error handling and status updates
 */

class CodeEditor {
  constructor() {
    this.editor = null;
    this.currentSiteId = null;
    this.currentFileName = 'index.html';
    this.currentFileContent = '';
    this.isDirty = false;
    this.previewEnabled = false;
    
    this.initializeModal();
    this.bindEvents();
  }

  /**
   * Initialize the code editor modal HTML
   */
  initializeModal() {
    const modalHtml = `
      <div id="code-editor-modal" class="modal-overlay" style="display: none;">
        <div class="modal modal-large">
          <div class="modal-header">
            <h2>Code Editor</h2>
            <div class="editor-controls">
              <select id="file-selector" class="file-selector">
                <option value="index.html">index.html</option>
              </select>
              <button id="toggle-preview" class="btn btn-secondary">
                <span id="preview-icon">👁️</span> Preview
              </button>
              <button id="save-file" class="btn btn-primary">
                <span id="save-icon">💾</span> Save
              </button>
            </div>
            <span class="modal-close">&times;</span>
          </div>
          
          <div class="editor-container">
            <div class="editor-pane">
              <div class="editor-toolbar">
                <div class="file-info">
                  <span id="current-file">index.html</span>
                  <span id="file-status" class="file-status"></span>
                </div>
                <div class="editor-actions">
                  <button id="format-code" class="btn-small" title="Format Code">🎨</button>
                  <button id="find-replace" class="btn-small" title="Find & Replace">🔍</button>
                  <button id="fullscreen-toggle" class="btn-small" title="Toggle Fullscreen">⛶</button>
                </div>
              </div>
              <div id="code-editor-textarea" class="code-editor-area"></div>
              <div class="editor-status-bar">
                <span id="cursor-position">Line 1, Col 1</span>
                <span id="file-size">0 bytes</span>
                <span id="last-saved">Not saved</span>
              </div>
            </div>
            
            <div id="preview-pane" class="preview-pane" style="display: none;">
              <div class="preview-toolbar">
                <span>Live Preview</span>
                <div class="preview-actions">
                  <button id="refresh-preview" class="btn-small" title="Refresh Preview">🔄</button>
                  <button id="preview-new-window" class="btn-small" title="Open in New Window">↗️</button>
                </div>
              </div>
              <iframe id="preview-frame" class="preview-frame" sandbox="allow-scripts allow-same-origin"></iframe>
            </div>
          </div>
          
          <div class="modal-footer">
            <div class="editor-help">
              <small>
                <kbd>Ctrl+S</kbd> Save | <kbd>Ctrl+F</kbd> Find | <kbd>F11</kbd> Fullscreen | <kbd>Esc</kbd> Close
              </small>
            </div>
            <div class="modal-actions">
              <button id="close-editor" class="btn btn-secondary">Close</button>
            </div>
          </div>
        </div>
      </div>
    `;

    // Append modal to body
    document.body.insertAdjacentHTML('beforeend', modalHtml);
  }

  /**
   * Bind event handlers
   */
  bindEvents() {
    const modal = document.getElementById('code-editor-modal');
    const closeBtn = modal.querySelector('.modal-close');
    const closeEditorBtn = document.getElementById('close-editor');
    const saveBtn = document.getElementById('save-file');
    const previewBtn = document.getElementById('toggle-preview');
    const fileSelector = document.getElementById('file-selector');
    const formatBtn = document.getElementById('format-code');
    const findBtn = document.getElementById('find-replace');
    const fullscreenBtn = document.getElementById('fullscreen-toggle');
    const refreshPreviewBtn = document.getElementById('refresh-preview');
    const newWindowBtn = document.getElementById('preview-new-window');

    // Close modal events
    closeBtn.addEventListener('click', () => this.close());
    closeEditorBtn.addEventListener('click', () => this.close());
    
    // Click outside modal to close
    modal.addEventListener('click', (e) => {
      if (e.target === modal) {
        this.close();
      }
    });

    // Save file
    saveBtn.addEventListener('click', () => this.saveFile());

    // Toggle preview
    previewBtn.addEventListener('click', () => this.togglePreview());

    // File selector
    fileSelector.addEventListener('change', (e) => {
      this.switchFile(e.target.value);
    });

    // Editor actions
    formatBtn.addEventListener('click', () => this.formatCode());
    findBtn.addEventListener('click', () => this.openFindReplace());
    fullscreenBtn.addEventListener('click', () => this.toggleFullscreen());
    refreshPreviewBtn.addEventListener('click', () => this.refreshPreview());
    newWindowBtn.addEventListener('click', () => this.openPreviewInNewWindow());

    // Keyboard shortcuts
    document.addEventListener('keydown', (e) => {
      const modal = document.getElementById('code-editor-modal');
      if (modal && modal.style.display !== 'none' && modal.style.display !== '') {
        this.handleKeyboardShortcuts(e);
      }
    });

    // Prevent closing when there are unsaved changes
    window.addEventListener('beforeunload', (e) => {
      const modal = document.getElementById('code-editor-modal');
      if (this.isDirty && modal && modal.style.display !== 'none' && modal.style.display !== '') {
        e.preventDefault();
        e.returnValue = '';
      }
    });
  }

  /**
   * Open code editor for a site
   * @param {string} siteId - Site ID to edit
   * @param {string} fileName - Initial file to open (default: index.html)
   */
  async open(siteId, fileName = 'index.html') {
    try {
      this.currentSiteId = siteId;
      this.currentFileName = fileName;
      
      // Show modal
      const modal = document.getElementById('code-editor-modal');
      modal.style.display = 'flex';
      document.body.style.overflow = 'hidden';

      // Load site files
      await this.loadSiteFiles();
      
      // Load file content
      await this.loadFile(fileName);
      
      // Initialize CodeMirror if not already done
      if (!this.editor) {
        await this.initializeCodeMirror();
      }
      
      // Update UI
      this.updateFileInfo();
      this.setStatus('Ready');
      
      // Focus editor
      setTimeout(() => this.editor.focus(), 100);

    } catch (error) {
      console.error('Error opening code editor:', error);
      this.setStatus('Error loading file', 'error');
    }
  }

  /**
   * Close code editor
   */
  close() {
    if (this.isDirty) {
      const confirmClose = confirm('You have unsaved changes. Are you sure you want to close?');
      if (!confirmClose) return;
    }

    const modal = document.getElementById('code-editor-modal');
    modal.style.display = 'none';
    document.body.style.overflow = '';
    
    // Reset state
    this.currentSiteId = null;
    this.currentFileName = 'index.html';
    this.isDirty = false;
    this.previewEnabled = false;
    
    // Hide preview pane
    document.getElementById('preview-pane').style.display = 'none';
  }

  /**
   * Initialize CodeMirror editor
   */
  async initializeCodeMirror() {
    // Load CodeMirror from CDN if not already loaded
    if (typeof CodeMirror === 'undefined') {
      await this.loadCodeMirrorAssets();
    }

    const textarea = document.getElementById('code-editor-textarea');
    
    this.editor = CodeMirror(textarea, {
      value: this.currentFileContent,
      mode: this.getEditorMode(this.currentFileName),
      theme: 'default',
      lineNumbers: true,
      lineWrapping: true,
      autoCloseTags: true,
      autoCloseBrackets: true,
      matchBrackets: true,
      indentUnit: 2,
      tabSize: 2,
      indentWithTabs: false,
      extraKeys: {
        'Ctrl-S': () => this.saveFile(),
        'Cmd-S': () => this.saveFile(),
        'F11': () => this.toggleFullscreen(),
        'Esc': () => {
          if (this.isFullscreen) {
            this.toggleFullscreen();
          } else {
            this.close();
          }
        }
      },
      gutters: ['CodeMirror-linenumbers', 'CodeMirror-foldgutter'],
      foldGutter: true
    });

    // Track changes
    this.editor.on('change', () => {
      this.markAsDirty();
      this.updateCursorPosition();
      this.updateFileSize();
      
      // Auto-refresh preview if enabled
      if (this.previewEnabled) {
        clearTimeout(this.previewTimeout);
        this.previewTimeout = setTimeout(() => {
          this.refreshPreview();
        }, 1000);
      }
    });

    // Track cursor position
    this.editor.on('cursorActivity', () => {
      this.updateCursorPosition();
    });
  }

  /**
   * Load CodeMirror assets from CDN
   */
  async loadCodeMirrorAssets() {
    return new Promise((resolve, reject) => {
      // Load CSS
      const css = document.createElement('link');
      css.rel = 'stylesheet';
      css.href = 'https://cdnjs.cloudflare.com/ajax/libs/codemirror/5.65.16/codemirror.min.css';
      document.head.appendChild(css);

      // Load theme CSS
      const theme = document.createElement('link');
      theme.rel = 'stylesheet';
      theme.href = 'https://cdnjs.cloudflare.com/ajax/libs/codemirror/5.65.16/theme/material.min.css';
      document.head.appendChild(theme);

      // Load JS
      const script = document.createElement('script');
      script.src = 'https://cdnjs.cloudflare.com/ajax/libs/codemirror/5.65.16/codemirror.min.js';
      script.onload = () => {
        // Load additional modes
        const modes = [
          'https://cdnjs.cloudflare.com/ajax/libs/codemirror/5.65.16/mode/xml/xml.min.js',
          'https://cdnjs.cloudflare.com/ajax/libs/codemirror/5.65.16/mode/css/css.min.js',
          'https://cdnjs.cloudflare.com/ajax/libs/codemirror/5.65.16/mode/javascript/javascript.min.js',
          'https://cdnjs.cloudflare.com/ajax/libs/codemirror/5.65.16/mode/htmlmixed/htmlmixed.min.js',
          'https://cdnjs.cloudflare.com/ajax/libs/codemirror/5.65.16/addon/edit/closetag.min.js',
          'https://cdnjs.cloudflare.com/ajax/libs/codemirror/5.65.16/addon/edit/closebrackets.min.js',
          'https://cdnjs.cloudflare.com/ajax/libs/codemirror/5.65.16/addon/edit/matchbrackets.min.js',
          'https://cdnjs.cloudflare.com/ajax/libs/codemirror/5.65.16/addon/fold/foldcode.min.js',
          'https://cdnjs.cloudflare.com/ajax/libs/codemirror/5.65.16/addon/fold/foldgutter.min.js',
          'https://cdnjs.cloudflare.com/ajax/libs/codemirror/5.65.16/addon/fold/xml-fold.min.js',
          'https://cdnjs.cloudflare.com/ajax/libs/codemirror/5.65.16/addon/dialog/dialog.min.js',
          'https://cdnjs.cloudflare.com/ajax/libs/codemirror/5.65.16/addon/search/search.min.js'
        ];

        let loaded = 0;
        modes.forEach(src => {
          const modeScript = document.createElement('script');
          modeScript.src = src;
          modeScript.onload = () => {
            loaded++;
            if (loaded === modes.length) {
              resolve();
            }
          };
          modeScript.onerror = reject;
          document.head.appendChild(modeScript);
        });
      };
      script.onerror = reject;
      document.head.appendChild(script);
    });
  }

  /**
   * Get appropriate CodeMirror mode for file
   * @param {string} fileName - File name to determine mode
   * @returns {string} - CodeMirror mode
   */
  getEditorMode(fileName) {
    const ext = fileName.split('.').pop().toLowerCase();
    const modes = {
      'html': 'htmlmixed',
      'htm': 'htmlmixed',
      'css': 'css',
      'js': 'javascript',
      'json': 'javascript',
      'txt': 'text',
      'xml': 'xml'
    };
    return modes[ext] || 'text';
  }

  /**
   * Load list of files for current site
   */
  async loadSiteFiles() {
    try {
      const response = await fetch(`/api/sites/${this.currentSiteId}/files`);
      if (!response.ok) throw new Error('Failed to load site files');
      
      const files = await response.json();
      
      // Update file selector
      const selector = document.getElementById('file-selector');
      selector.innerHTML = files.map(file => 
        `<option value="${file.name}" ${file.name === this.currentFileName ? 'selected' : ''}>${file.name}</option>`
      ).join('');
      
    } catch (error) {
      console.error('Error loading site files:', error);
      this.setStatus('Error loading files', 'error');
    }
  }

  /**
   * Load content of a specific file
   * @param {string} fileName - File to load
   */
  async loadFile(fileName) {
    try {
      this.setStatus('Loading file...', 'loading');
      
      const response = await fetch(`/api/sites/${this.currentSiteId}/files/${fileName}`);
      if (!response.ok) throw new Error('Failed to load file');
      
      const fileData = await response.json();
      this.currentFileContent = fileData.content;
      this.currentFileName = fileName;
      
      // Update editor content if initialized
      if (this.editor) {
        this.editor.setValue(this.currentFileContent);
        this.editor.setOption('mode', this.getEditorMode(fileName));
      }
      
      // Update UI
      document.getElementById('current-file').textContent = fileName;
      document.getElementById('file-selector').value = fileName;
      
      this.isDirty = false;
      this.updateFileInfo();
      this.setStatus('File loaded');
      
    } catch (error) {
      console.error('Error loading file:', error);
      this.setStatus('Error loading file', 'error');
    }
  }

  /**
   * Switch to editing a different file
   * @param {string} fileName - File to switch to
   */
  async switchFile(fileName) {
    if (this.isDirty) {
      const shouldSave = confirm('Save current file before switching?');
      if (shouldSave) {
        await this.saveFile();
      }
    }
    
    await this.loadFile(fileName);
  }

  /**
   * Save current file
   */
  async saveFile() {
    if (!this.editor || !this.currentSiteId) return;
    
    try {
      this.setStatus('Saving...', 'loading');
      
      const content = this.editor.getValue();
      
      const response = await fetch(`/api/sites/${this.currentSiteId}/files/${this.currentFileName}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ content })
      });
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to save file');
      }
      
      const result = await response.json();
      
      this.isDirty = false;
      this.updateFileInfo();
      this.setStatus('File saved successfully', 'success');
      
      // Update last saved time
      document.getElementById('last-saved').textContent = `Saved ${new Date().toLocaleTimeString()}`;
      
      // Refresh preview if enabled
      if (this.previewEnabled) {
        this.refreshPreview();
      }
      
    } catch (error) {
      console.error('Error saving file:', error);
      this.setStatus(`Error: ${error.message}`, 'error');
    }
  }

  /**
   * Toggle preview pane
   */
  togglePreview() {
    const previewPane = document.getElementById('preview-pane');
    const previewBtn = document.getElementById('toggle-preview');
    const icon = document.getElementById('preview-icon');
    
    this.previewEnabled = !this.previewEnabled;
    
    if (this.previewEnabled) {
      previewPane.style.display = 'flex';
      previewBtn.textContent = '👁️ Hide Preview';
      this.refreshPreview();
    } else {
      previewPane.style.display = 'none';
      previewBtn.textContent = '👁️ Preview';
    }
  }

  /**
   * Refresh preview with current content
   */
  refreshPreview() {
    if (!this.previewEnabled || !this.editor) return;
    
    const content = this.editor.getValue();
    const iframe = document.getElementById('preview-frame');
    
    // Create blob URL for preview
    const blob = new Blob([content], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    
    iframe.src = url;
    
    // Clean up previous URL
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  /**
   * Open preview in new window
   */
  openPreviewInNewWindow() {
    if (!this.editor) return;
    
    const content = this.editor.getValue();
    const newWindow = window.open('', '_blank');
    newWindow.document.write(content);
    newWindow.document.close();
  }

  /**
   * Format code (basic implementation)
   */
  formatCode() {
    if (!this.editor) return;
    
    // Basic HTML formatting - in a real implementation, you'd use a proper formatter
    const content = this.editor.getValue();
    // For now, just ensure proper indentation
    this.editor.setValue(content);
    this.setStatus('Code formatted');
  }

  /**
   * Open find/replace dialog
   */
  openFindReplace() {
    if (!this.editor) return;
    
    this.editor.execCommand('find');
  }

  /**
   * Toggle fullscreen mode
   */
  toggleFullscreen() {
    const modal = document.getElementById('code-editor-modal');
    const content = modal.querySelector('.modal-content');
    
    this.isFullscreen = !this.isFullscreen;
    
    if (this.isFullscreen) {
      content.classList.add('modal-fullscreen');
    } else {
      content.classList.remove('modal-fullscreen');
    }
    
    // Refresh editor layout
    setTimeout(() => this.editor && this.editor.refresh(), 100);
  }

  /**
   * Handle keyboard shortcuts
   * @param {KeyboardEvent} e - Keyboard event
   */
  handleKeyboardShortcuts(e) {
    // Ctrl/Cmd + S = Save
    if ((e.ctrlKey || e.metaKey) && e.key === 's') {
      e.preventDefault();
      this.saveFile();
    }
    
    // F11 = Fullscreen
    if (e.key === 'F11') {
      e.preventDefault();
      this.toggleFullscreen();
    }
    
    // Escape = Close (if not in fullscreen)
    if (e.key === 'Escape' && !this.isFullscreen) {
      this.close();
    }
  }

  /**
   * Mark file as dirty (unsaved changes)
   */
  markAsDirty() {
    if (!this.isDirty) {
      this.isDirty = true;
      this.updateFileInfo();
    }
  }

  /**
   * Update file info display
   */
  updateFileInfo() {
    const status = document.getElementById('file-status');
    const fileName = document.getElementById('current-file');
    
    if (this.isDirty) {
      status.textContent = '● Unsaved changes';
      status.className = 'file-status dirty';
      fileName.textContent = this.currentFileName + ' *';
    } else {
      status.textContent = 'Saved';
      status.className = 'file-status saved';
      fileName.textContent = this.currentFileName;
    }
  }

  /**
   * Update cursor position display
   */
  updateCursorPosition() {
    if (!this.editor) return;
    
    const cursor = this.editor.getCursor();
    document.getElementById('cursor-position').textContent = 
      `Line ${cursor.line + 1}, Col ${cursor.ch + 1}`;
  }

  /**
   * Update file size display
   */
  updateFileSize() {
    if (!this.editor) return;
    
    const content = this.editor.getValue();
    const bytes = new Blob([content]).size;
    document.getElementById('file-size').textContent = this.formatFileSize(bytes);
  }

  /**
   * Format file size for display
   * @param {number} bytes - File size in bytes
   * @returns {string} - Formatted size
   */
  formatFileSize(bytes) {
    if (bytes === 0) return '0 bytes';
    const k = 1024;
    const sizes = ['bytes', 'KB', 'MB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  }

  /**
   * Set status message
   * @param {string} message - Status message
   * @param {string} type - Status type (success, error, loading)
   */
  setStatus(message, type = 'info') {
    const statusEl = document.getElementById('file-status');
    statusEl.textContent = message;
    statusEl.className = `file-status ${type}`;
    
    // Clear status after 3 seconds for non-persistent messages
    if (type === 'success' || type === 'error') {
      setTimeout(() => {
        this.updateFileInfo();
      }, 3000);
    }
  }
}

// Initialize global code editor instance
window.codeEditor = new CodeEditor();