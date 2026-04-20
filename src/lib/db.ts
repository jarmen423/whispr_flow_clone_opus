/**
 * LocalFlow SQLite Database Layer
 *
 * Uses better-sqlite3 for synchronous, zero-config local storage.
 * Perfect for a single-server free tool. Upgrade to PostgreSQL later if needed.
 */

import Database from "better-sqlite3";
import { join } from "path";

const DB_PATH = process.env.LOCALFLOW_DB_PATH || join(process.cwd(), "localflow.db");

let db: Database | null = null;

export function getDb(): Database {
  if (!db) {
    db = new Database(DB_PATH);
    db.pragma("journal_mode = WAL");
    migrate(db);
  }
  return db;
}

function migrate(db: Database) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      email TEXT UNIQUE NOT NULL,
      name TEXT,
      password_hash TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS download_events (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER REFERENCES users(id),
      platform TEXT,
      ip TEXT,
      user_agent TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
    CREATE INDEX IF NOT EXISTS idx_downloads_user ON download_events(user_id);
    CREATE INDEX IF NOT EXISTS idx_downloads_created ON download_events(created_at);
  `);
}

// Typed helpers
export interface UserRow {
  id: number;
  email: string;
  name: string | null;
  password_hash: string;
  created_at: string;
}

export interface DownloadEventRow {
  id: number;
  user_id: number | null;
  platform: string | null;
  ip: string | null;
  user_agent: string | null;
  created_at: string;
}
