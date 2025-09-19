const sanitizeHtml = require('sanitize-html');
const yauzl = require('yauzl');
const fs = require('fs').promises;
const fsSync = require('fs');
const path = require('path');
const { storage } = require('./storage');

/**
 * Upload processing module for Tinny
 * 
 * Handles HTML sanitization, ZIP extraction, and file validation
 */

// HTML sanitization options - very strict for security
const SANITIZE_OPTIONS = {
  allowedTags: [
    'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
    'p', 'br', 'hr',
    'div', 'span', 'section', 'article', 'aside', 'header', 'footer', 'nav', 'main',
    'ul', 'ol', 'li',
    'a', 'img',
    'table', 'thead', 'tbody', 'tr', 'td', 'th',
    'form', 'input', 'textarea', 'select', 'option', 'button', 'label',
    'strong', 'em', 'b', 'i', 'u', 'small', 'mark', 'del', 'ins', 'sub', 'sup',
    'blockquote', 'pre', 'code',
    'meta', 'title', 'head', 'body', 'html',
    'style', 'link'
  ],
  allowedAttributes: {
    '*': ['class', 'id'],
    'a': ['href', 'title', 'target', 'rel'],
    'img': ['src', 'alt', 'width', 'height', 'title'],
    'meta': ['charset', 'name', 'content', 'viewport'],
    'link': ['rel', 'href', 'type'],
    'input': ['type', 'name', 'value', 'placeholder', 'required'],
    'textarea': ['name', 'rows', 'cols', 'placeholder'],
    'select': ['name'],
    'option': ['value'],
    'form': ['action', 'method'],
    'table': ['border', 'cellpadding', 'cellspacing'],
    'td': ['colspan', 'rowspan'],
    'th': ['colspan', 'rowspan']
  },
  allowedSchemes: ['http', 'https', 'mailto'],
  disallowedTagsMode: 'discard',
  allowedSchemesByTag: {
    img: ['http', 'https', 'data'],
    a: ['http', 'https', 'mailto']
  },
  transformTags: {
    'script': 'span', // Transform script tags to spans instead of removing
    'iframe': 'div',
    'object': 'div',
    'embed': 'div'
  }
};

// File validation constants
const MAX_HTML_SIZE = parseInt(process.env.MAX_HTML_BYTES) || 5_000_000; // 5MB
const MAX_ZIP_SIZE = parseInt(process.env.MAX_ZIP_BYTES) || 25_000_000; // 25MB
const ALLOWED_HTML_EXTENSIONS = ['.html', '.htm'];
const ALLOWED_ZIP_EXTENSIONS = ['.zip'];

// Allowed file types inside ZIP
const ALLOWED_ZIP_CONTENT = [
  '.html', '.htm', '.css', '.js', '.json',
  '.png', '.jpg', '.jpeg', '.gif', '.svg', '.webp',
  '.woff', '.woff2', '.ttf', '.otf',
  '.txt', '.md'
];

class UploadProcessor {
  /**
   * Validate file type and size
   */
  validateFile(file, type) {
    if (!file || !file.originalname) {
      throw new Error('No file provided');
    }

    const ext = path.extname(file.originalname).toLowerCase();
    
    if (type === 'html') {
      if (!ALLOWED_HTML_EXTENSIONS.includes(ext)) {
        throw new Error(`Invalid file type. Expected ${ALLOWED_HTML_EXTENSIONS.join(' or ')}, got ${ext}`);
      }
      if (file.size > MAX_HTML_SIZE) {
        throw new Error(`HTML file too large. Maximum size is ${Math.round(MAX_HTML_SIZE / 1024 / 1024)}MB`);
      }
    } else if (type === 'zip') {
      if (!ALLOWED_ZIP_EXTENSIONS.includes(ext)) {
        throw new Error(`Invalid file type. Expected ${ALLOWED_ZIP_EXTENSIONS.join(' or ')}, got ${ext}`);
      }
      if (file.size > MAX_ZIP_SIZE) {
        throw new Error(`ZIP file too large. Maximum size is ${Math.round(MAX_ZIP_SIZE / 1024 / 1024)}MB`);
      }
    } else {
      throw new Error('Invalid upload type. Must be "html" or "zip"');
    }

    return true;
  }

  /**
   * Sanitize HTML content
   */
  sanitizeHtml(htmlContent) {
    try {
      return sanitizeHtml(htmlContent, SANITIZE_OPTIONS);
    } catch (error) {
      console.error('HTML sanitization error:', error);
      throw new Error('Failed to sanitize HTML content');
    }
  }

  /**
   * Process single HTML file upload
   */
  async processHtmlUpload(file, userId, siteId) {
    console.log(`Processing HTML upload for user ${userId}, site ${siteId}`);
    
    // Read file content
    const htmlContent = await fs.readFile(file.path, 'utf8');
    
    // Sanitize HTML
    const sanitizedHtml = this.sanitizeHtml(htmlContent);
    
    // Store the sanitized HTML
    await storage.writeFile(userId, siteId, 'index.html', sanitizedHtml);
    
    console.log(`HTML file processed and stored for site ${siteId}`);
    return {
      type: 'html',
      files: ['index.html'],
      size: Buffer.byteLength(sanitizedHtml, 'utf8')
    };
  }

  /**
   * Extract ZIP file and validate contents
   */
  async extractZip(zipPath, extractDir) {
    return new Promise((resolve, reject) => {
      const extractedFiles = [];
      let hasIndexHtml = false;

      yauzl.open(zipPath, { lazyEntries: true }, (err, zipfile) => {
        if (err) {
          return reject(new Error(`Failed to open ZIP file: ${err.message}`));
        }

        zipfile.readEntry();

        zipfile.on('entry', (entry) => {
          // Skip directories
          if (/\/$/.test(entry.fileName)) {
            zipfile.readEntry();
            return;
          }

          // Security check: prevent path traversal
          const normalizedPath = path.normalize(entry.fileName);
          if (normalizedPath.includes('..') || path.isAbsolute(normalizedPath)) {
            return reject(new Error(`Invalid file path in ZIP: ${entry.fileName}`));
          }

          // Check file extension
          const ext = path.extname(entry.fileName).toLowerCase();
          if (!ALLOWED_ZIP_CONTENT.includes(ext)) {
            return reject(new Error(`Unsupported file type in ZIP: ${entry.fileName} (${ext})`));
          }

          // Check for index.html
          if (path.basename(entry.fileName).toLowerCase() === 'index.html') {
            hasIndexHtml = true;
          }

          // Extract file
          zipfile.openReadStream(entry, (err, readStream) => {
            if (err) {
              return reject(new Error(`Failed to read ${entry.fileName}: ${err.message}`));
            }

            const outputPath = path.join(extractDir, entry.fileName);
            const outputDir = path.dirname(outputPath);

            // Ensure output directory exists
            fsSync.mkdirSync(outputDir, { recursive: true });

            const writeStream = fsSync.createWriteStream(outputPath);
            
            readStream.on('end', () => {
              extractedFiles.push(entry.fileName);
              zipfile.readEntry();
            });

            readStream.on('error', (err) => {
              reject(new Error(`Failed to extract ${entry.fileName}: ${err.message}`));
            });

            writeStream.on('error', (err) => {
              reject(new Error(`Failed to write ${entry.fileName}: ${err.message}`));
            });

            readStream.pipe(writeStream);
          });
        });

        zipfile.on('end', () => {
          if (!hasIndexHtml) {
            return reject(new Error('ZIP file must contain an index.html file'));
          }
          
          resolve({
            files: extractedFiles,
            hasIndexHtml
          });
        });

        zipfile.on('error', (err) => {
          reject(new Error(`ZIP processing error: ${err.message}`));
        });
      });
    });
  }

  /**
   * Process ZIP file upload
   */
  async processZipUpload(file, userId, siteId) {
    console.log(`Processing ZIP upload for user ${userId}, site ${siteId}`);
    
    // Create temporary extraction directory
    const tempDir = storage.getTempFilePath(`extract_${siteId}_${Date.now()}`);
    await fs.mkdir(tempDir, { recursive: true });

    try {
      // Extract ZIP
      const extractResult = await this.extractZip(file.path, tempDir);
      
      // Create site directory
      const siteDir = await storage.createSiteDir(userId, siteId);
      
      // Process each extracted file
      const processedFiles = [];
      let totalSize = 0;

      for (const fileName of extractResult.files) {
        const filePath = path.join(tempDir, fileName);
        const stats = await fs.stat(filePath);
        totalSize += stats.size;

        // If it's an HTML file, sanitize it
        if (path.extname(fileName).toLowerCase() === '.html' || path.extname(fileName).toLowerCase() === '.htm') {
          const htmlContent = await fs.readFile(filePath, 'utf8');
          const sanitizedHtml = this.sanitizeHtml(htmlContent);
          
          // Write sanitized HTML to site directory
          const destPath = path.join(siteDir, fileName);
          const destDir = path.dirname(destPath);
          await fs.mkdir(destDir, { recursive: true });
          await fs.writeFile(destPath, sanitizedHtml);
        } else {
          // Copy non-HTML files as-is
          const destPath = path.join(siteDir, fileName);
          const destDir = path.dirname(destPath);
          await fs.mkdir(destDir, { recursive: true });
          await fs.copyFile(filePath, destPath);
        }

        processedFiles.push(fileName);
      }

      console.log(`ZIP file processed: ${processedFiles.length} files, ${totalSize} bytes`);
      
      return {
        type: 'zip',
        files: processedFiles,
        size: totalSize,
        hasIndexHtml: extractResult.hasIndexHtml
      };

    } finally {
      // Clean up temporary directory
      try {
        await fs.rm(tempDir, { recursive: true, force: true });
      } catch (error) {
        console.warn(`Failed to cleanup temp directory ${tempDir}:`, error.message);
      }
    }
  }

  /**
   * Process upload based on type
   */
  async processUpload(file, type, userId, siteId) {
    // Validate file
    this.validateFile(file, type);

    try {
      if (type === 'html') {
        return await this.processHtmlUpload(file, userId, siteId);
      } else if (type === 'zip') {
        return await this.processZipUpload(file, userId, siteId);
      } else {
        throw new Error('Invalid upload type');
      }
    } finally {
      // Always clean up the uploaded file
      await storage.cleanupTempFile(file.path);
    }
  }
}

// Export singleton instance
const uploadProcessor = new UploadProcessor();

module.exports = {
  uploadProcessor,
  UploadProcessor,
  SANITIZE_OPTIONS,
  MAX_HTML_SIZE,
  MAX_ZIP_SIZE
};