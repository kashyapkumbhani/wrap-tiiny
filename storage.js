const fs = require('fs').promises;
const fsSync = require('fs');
const path = require('path');

/**
 * Storage module for Tinny
 * 
 * Handles file system operations for sites stored in sites/<userId>/<siteId>/ structure
 */

class StorageManager {
  constructor() {
    this.sitesDir = path.join(__dirname, 'sites');
    this.tmpDir = path.join(__dirname, 'tmp');
    this.staticDir = path.join(__dirname, 'static');
  }

  /**
   * Ensure base directories exist
   */
  async ensureDirectories() {
    await this.ensureDir(this.sitesDir);
    await this.ensureDir(this.tmpDir);
    await this.ensureDir(this.staticDir);
  }

  /**
   * Ensure a directory exists
   */
  async ensureDir(dirPath) {
    try {
      await fs.access(dirPath);
    } catch (error) {
      if (error.code === 'ENOENT') {
        await fs.mkdir(dirPath, { recursive: true });
      } else {
        throw error;
      }
    }
  }

  /**
   * Get site directory path for a user and site
   */
  getSiteDir(userId, siteId) {
    return path.join(this.sitesDir, userId, siteId);
  }

  /**
   * Get user directory path
   */
  getUserDir(userId) {
    return path.join(this.sitesDir, userId);
  }

  /**
   * Check if site directory exists
   */
  async siteExists(userId, siteId) {
    try {
      const siteDir = this.getSiteDir(userId, siteId);
      await fs.access(siteDir);
      return true;
    } catch (error) {
      return false;
    }
  }

  /**
   * Create site directory
   */
  async createSiteDir(userId, siteId) {
    const siteDir = this.getSiteDir(userId, siteId);
    await this.ensureDir(siteDir);
    return siteDir;
  }

  /**
   * Write file to site directory
   */
  async writeFile(userId, siteId, fileName, content) {
    const siteDir = await this.createSiteDir(userId, siteId);
    const filePath = path.join(siteDir, fileName);
    
    // Ensure we're writing within the site directory (security check)
    const normalizedPath = path.normalize(filePath);
    if (!normalizedPath.startsWith(siteDir)) {
      throw new Error('Invalid file path: path traversal detected');
    }

    await fs.writeFile(filePath, content);
    return filePath;
  }

  /**
   * Copy file to site directory
   */
  async copyFile(sourcePath, userId, siteId, fileName) {
    const siteDir = await this.createSiteDir(userId, siteId);
    const destPath = path.join(siteDir, fileName);
    
    // Security check
    const normalizedPath = path.normalize(destPath);
    if (!normalizedPath.startsWith(siteDir)) {
      throw new Error('Invalid file path: path traversal detected');
    }

    await fs.copyFile(sourcePath, destPath);
    return destPath;
  }

  /**
   * Create a subdirectory within a site
   */
  async createSubdir(userId, siteId, subdirName) {
    const siteDir = this.getSiteDir(userId, siteId);
    const subdirPath = path.join(siteDir, subdirName);
    
    // Security check
    const normalizedPath = path.normalize(subdirPath);
    if (!normalizedPath.startsWith(siteDir)) {
      throw new Error('Invalid directory path: path traversal detected');
    }

    await this.ensureDir(subdirPath);
    return subdirPath;
  }

  /**
   * Delete site directory and all contents
   */
  async deleteSite(userId, siteId) {
    const siteDir = this.getSiteDir(userId, siteId);
    try {
      await fs.rm(siteDir, { recursive: true, force: true });
      return true;
    } catch (error) {
      console.error(`Failed to delete site ${siteId} for user ${userId}:`, error);
      return false;
    }
  }

  /**
   * Get site file path
   */
  getSiteFilePath(userId, siteId, fileName = 'index.html') {
    return path.join(this.getSiteDir(userId, siteId), fileName);
  }

  /**
   * Check if index.html exists for a site
   */
  async hasIndexHtml(userId, siteId) {
    try {
      const indexPath = this.getSiteFilePath(userId, siteId, 'index.html');
      await fs.access(indexPath);
      return true;
    } catch (error) {
      return false;
    }
  }

  /**
   * Get temporary file path
   */
  getTempFilePath(filename) {
    return path.join(this.tmpDir, filename);
  }

  /**
   * Clean up temporary files
   */
  async cleanupTempFile(filePath) {
    try {
      await fs.unlink(filePath);
    } catch (error) {
      console.warn(`Failed to cleanup temp file ${filePath}:`, error.message);
    }
  }

  /**
   * Get site size in bytes
   */
  async getSiteSize(userId, siteId) {
    const siteDir = this.getSiteDir(userId, siteId);
    try {
      return await this.getDirectorySize(siteDir);
    } catch (error) {
      return 0;
    }
  }

  /**
   * Calculate directory size recursively
   */
  async getDirectorySize(dirPath) {
    let totalSize = 0;
    
    try {
      const items = await fs.readdir(dirPath, { withFileTypes: true });
      
      for (const item of items) {
        const itemPath = path.join(dirPath, item.name);
        
        if (item.isDirectory()) {
          totalSize += await this.getDirectorySize(itemPath);
        } else {
          const stats = await fs.stat(itemPath);
          totalSize += stats.size;
        }
      }
    } catch (error) {
      console.warn(`Error calculating size for ${dirPath}:`, error.message);
    }
    
    return totalSize;
  }
}

// Singleton instance
const storageManager = new StorageManager();

// Initialize directories on module load
storageManager.ensureDirectories().catch(error => {
  console.error('Failed to initialize storage directories:', error);
});

module.exports = {
  storage: storageManager,
  StorageManager
};