// server/database.js — SQLite database for shop credentials storage
import Database from "better-sqlite3";
import path from "path";
import { fileURLToPath } from "url";
import fs from "fs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ensure data directory exists
const DATA_DIR = path.join(__dirname, "..", "data");
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

const DB_PATH = path.join(DATA_DIR, "shops.db");

// Initialize database
let db;

export function initDatabase() {
  if (db) return db; // already initialized

  try {
    // open (better-sqlite3 is synchronous)
    db = new Database(DB_PATH, { verbose: console.log });

    // Create shops table if missing
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

    // index
    db.exec(`
      CREATE INDEX IF NOT EXISTS idx_shop ON shops(shop)
    `);

    console.log("✅ Database initialized successfully at", DB_PATH);
    return db;
  } catch (error) {
    console.error("❌ Database initialization failed:", error);
    throw error;
  }
}

// Ensure DB initialized on import (so other modules don't forget)
initDatabase();

// --- Public API (async-friendly) ---

// Get shop credentials
export async function getShop(shopDomain) {
  if (!db) initDatabase();
  const stmt = db.prepare("SELECT * FROM shops WHERE shop = ?");
  return stmt.get(shopDomain) || null;
}

// Save or update shop credentials
export async function saveShop(shopDomain, accessToken, scope = "") {
  if (!db) initDatabase();

  try {
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
  } catch (err) {
    console.error("saveShop error:", err);
    throw err;
  }
}

// Delete shop (on uninstall)
export async function deleteShop(shopDomain) {
  if (!db) initDatabase();
  try {
    const stmt = db.prepare("DELETE FROM shops WHERE shop = ?");
    const result = stmt.run(shopDomain);
    return result.changes > 0;
  } catch (err) {
    console.error("deleteShop error:", err);
    throw err;
  }
}

// Get all shops (for admin/debugging)
export async function getAllShops() {
  if (!db) initDatabase();
  const stmt = db.prepare("SELECT shop, installed_at, updated_at FROM shops");
  return stmt.all();
}

// Check if shop exists
export async function shopExists(shopDomain) {
  if (!db) initDatabase();
  const stmt = db.prepare("SELECT COUNT(*) as count FROM shops WHERE shop = ?");
  const result = stmt.get(shopDomain);
  return result.count > 0;
}

// Close database connection
export function closeDatabase() {
  if (db) {
    db.close();
    db = null;
    console.log("✅ Database connection closed");
  }
}

// Export db instance for advanced queries (sync)
export function getDatabase() {
  if (!db) initDatabase();
  return db;
}
