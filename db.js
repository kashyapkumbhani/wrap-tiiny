const Database = require('better-sqlite3');
const fs = require('fs');
const path = require('path');

/**
 * Database module for Tinny - SQLite bootstrap and query wrapper
 * 
 * Provides:
 * - Connection lifecycle management
 * - Migration runner
 * - Simple query wrapper for better-sqlite3 (sync operations)
 * - Path resolution for SQLITE_PATH environment variable
 */

class TinnyDB {
  constructor() {
    this.db = null;
    this.dbPath = process.env.SQLITE_PATH || './data/metadata.db';
  }

  /**
   * Initialize database connection and ensure data directory exists
   */
  init() {
    // Ensure data directory exists
    const dataDir = path.dirname(this.dbPath);
    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir, { recursive: true });
    }

    // Connect to SQLite database
    this.db = new Database(this.dbPath);
    
    // Enable foreign key constraints
    this.db.pragma('foreign_keys = ON');
    
    console.log(`Database connected: ${this.dbPath}`);
    return this;
  }

  /**
   * Run migrations from migrations directory
   */
  runMigrations() {
    const migrationsDir = path.join(__dirname, 'migrations');
    
    if (!fs.existsSync(migrationsDir)) {
      console.log('No migrations directory found');
      return;
    }

    const migrationFiles = fs.readdirSync(migrationsDir)
      .filter(file => file.endsWith('.sql'))
      .sort();

    for (const file of migrationFiles) {
      const filePath = path.join(migrationsDir, file);
      const sql = fs.readFileSync(filePath, 'utf8');
      
      console.log(`Running migration: ${file}`);
      this.db.exec(sql);
    }

    console.log('Migrations completed');
  }

  /**
   * Get a prepared statement
   */
  prepare(sql) {
    return this.db.prepare(sql);
  }

  /**
   * Execute a query and return all results
   */
  all(sql, params = {}) {
    return this.db.prepare(sql).all(params);
  }

  /**
   * Execute a query and return first result
   */
  get(sql, params = {}) {
    return this.db.prepare(sql).get(params);
  }

  /**
   * Execute a query and return run info (changes, lastInsertRowid)
   */
  run(sql, params = {}) {
    return this.db.prepare(sql).run(params);
  }

  /**
   * Begin transaction
   */
  transaction(fn) {
    return this.db.transaction(fn);
  }

  /**
   * Close database connection
   */
  close() {
    if (this.db) {
      this.db.close();
      console.log('Database connection closed');
    }
  }

  /**
   * Get database instance (for advanced usage)
   */
  getInstance() {
    return this.db;
  }
}

// Singleton instance
let dbInstance = null;

/**
 * Get database instance (singleton pattern)
 */
function getDB() {
  if (!dbInstance) {
    dbInstance = new TinnyDB().init();
  }
  return dbInstance;
}

/**
 * Initialize database and run migrations
 */
function initializeDatabase() {
  const db = getDB();
  db.runMigrations();
  return db;
}

module.exports = {
  getDB,
  initializeDatabase,
  TinnyDB
};