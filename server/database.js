// server/database.js — SQLite database for shop credentials storage
import Database from "better-sqlite3";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DB_PATH = path.join(__dirname, "..", "data", "shops.db");

// Initialize database
let db;

export function initDatabase() {
  try {
    db = new Database(DB_PATH, { verbose: console.log });
    
    // Create shops table
    db.exec(`
      CREATE TABLE IF NOT EXISTS shops (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        shop TEXT UNIQUE NOT NULL,
        access_token TEXT NOT NULL,
        scope TEXT,
        installed_at INTEGER DEFAULT (strftime('%s', 'now')),
        updated_at INTEGER DEFAULT (strftime('%s', 'now'))
      )
    `);

    // Create index for faster lookups
    db.exec(`
      CREATE INDEX IF NOT EXISTS idx_shop ON shops(shop)
    `);

    console.log("✅ Database initialized successfully");
    return db;
  } catch (error) {
    console.error("❌ Database initialization failed:", error);
    throw error;
  }
}

// Get shop credentials
export function getShop(shopDomain) {
  if (!db) throw new Error("Database not initialized");
  
  const stmt = db.prepare("SELECT * FROM shops WHERE shop = ?");
  return stmt.get(shopDomain);
}

// Save or update shop credentials
export function saveShop(shopDomain, accessToken, scope = "") {
  if (!db) throw new Error("Database not initialized");
  
  const stmt = db.prepare(`
    INSERT INTO shops (shop, access_token, scope, updated_at)
    VALUES (?, ?, ?, strftime('%s', 'now'))
    ON CONFLICT(shop) DO UPDATE SET
      access_token = excluded.access_token,
      scope = excluded.scope,
      updated_at = strftime('%s', 'now')
  `);
  
  const result = stmt.run(shopDomain, accessToken, scope);
  return result.changes > 0;
}

// Delete shop (on uninstall)
export function deleteShop(shopDomain) {
  if (!db) throw new Error("Database not initialized");
  
  const stmt = db.prepare("DELETE FROM shops WHERE shop = ?");
  const result = stmt.run(shopDomain);
  return result.changes > 0;
}

// Get all shops (for admin/debugging)
export function getAllShops() {
  if (!db) throw new Error("Database not initialized");
  
  const stmt = db.prepare("SELECT shop, installed_at, updated_at FROM shops");
  return stmt.all();
}

// Check if shop exists
export function shopExists(shopDomain) {
  if (!db) throw new Error("Database not initialized");
  
  const stmt = db.prepare("SELECT COUNT(*) as count FROM shops WHERE shop = ?");
  const result = stmt.get(shopDomain);
  return result.count > 0;
}

// Close database connection
export function closeDatabase() {
  if (db) {
    db.close();
    console.log("✅ Database connection closed");
  }
}

// Export db instance for advanced queries
export function getDatabase() {
  return db;
}
