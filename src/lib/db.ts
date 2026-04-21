/**
 * LocalFlow Database Layer
 *
 * Uses Neon serverless Postgres in production (Vercel) and SQLite for local dev.
 * SQLite import is lazy so native modules never load on serverless.
 */

import { neon } from "@neondatabase/serverless";
import { join } from "path";
import type DatabaseType from "better-sqlite3";

const DATABASE_URL = process.env.DATABASE_URL || process.env.POSTGRES_URL;
const IS_POSTGRES = !!DATABASE_URL;

// Postgres client (Neon)
let sqlClient: ((query: string, params?: unknown[]) => Promise<unknown>) | null = null;
if (IS_POSTGRES && DATABASE_URL) {
  sqlClient = neon(DATABASE_URL) as unknown as (query: string, params?: unknown[]) => Promise<unknown>;
  runMigrations().catch((err) => console.error("[DB] Migration failed:", err));
}

// SQLite client (local dev fallback) — lazy init to avoid build-time locks
let sqliteDb: unknown = null;
async function getSqliteDb() {
  if (!sqliteDb) {
    const { default: Database } = await import("better-sqlite3");
    const DB_PATH = process.env.LOCALFLOW_DB_PATH || join(process.cwd(), "localflow.db");
    const db = new Database(DB_PATH);
    db.pragma("journal_mode = WAL");
    migrateSqlite(db);
    sqliteDb = db;
  }
  return sqliteDb as DatabaseType;
}

/* ------------------------------------------------------------------ */
/*  Postgres helpers                                                  */
/* ------------------------------------------------------------------ */

function pgQuery(sqlStr: string, params: unknown[] = []) {
  if (!sqlClient) throw new Error("Postgres client not initialized");
  let i = 0;
  const pgSql = sqlStr.replace(/\?/g, () => `$${++i}`);
  return sqlClient(pgSql, params) as Promise<unknown>;
}

async function pgGetOne(sqlStr: string, params: unknown[] = []) {
  const rows = await pgQuery(sqlStr, params) as Record<string, unknown>[];
  return rows[0] || null;
}

async function pgGetAll(sqlStr: string, params: unknown[] = []) {
  return pgQuery(sqlStr, params) as Promise<Record<string, unknown>[]>;
}

async function pgInsert(table: string, data: Record<string, unknown>) {
  const keys = Object.keys(data);
  const placeholders = keys.map(() => "?").join(", ");
  const sqlStr = `INSERT INTO ${table} (${keys.join(", ")}) VALUES (${placeholders}) RETURNING id`;
  const result = await pgQuery(sqlStr, Object.values(data)) as { id: number }[];
  return result[0]?.id ?? 0;
}

/* ------------------------------------------------------------------ */
/*  SQLite helpers                                                    */
/* ------------------------------------------------------------------ */

async function sqliteQuery(sqlStr: string, params: unknown[] = []) {
  const db = await getSqliteDb();
  const stmt = db.prepare(sqlStr);
  return stmt.run(...params);
}

async function sqliteGetOne(sqlStr: string, params: unknown[] = []) {
  const db = await getSqliteDb();
  const stmt = db.prepare(sqlStr);
  return stmt.get(...params) as Record<string, unknown> | undefined || null;
}

async function sqliteGetAll(sqlStr: string, params: unknown[] = []) {
  const db = await getSqliteDb();
  const stmt = db.prepare(sqlStr);
  return stmt.all(...params) as Record<string, unknown>[];
}

async function sqliteInsert(table: string, data: Record<string, unknown>) {
  const db = await getSqliteDb();
  const keys = Object.keys(data);
  const placeholders = keys.map(() => "?").join(", ");
  const sqlStr = `INSERT INTO ${table} (${keys.join(", ")}) VALUES (${placeholders})`;
  const result = db.prepare(sqlStr).run(...Object.values(data));
  return Number(result.lastInsertRowid);
}

/* ------------------------------------------------------------------ */
/*  Unified API                                                       */
/* ------------------------------------------------------------------ */

export async function dbQuery(sqlStr: string, params: unknown[] = []) {
  if (IS_POSTGRES) return pgQuery(sqlStr, params);
  return sqliteQuery(sqlStr, params);
}

export async function dbGetOne(sqlStr: string, params: unknown[] = []) {
  if (IS_POSTGRES) return pgGetOne(sqlStr, params);
  return sqliteGetOne(sqlStr, params);
}

export async function dbGetAll(sqlStr: string, params: unknown[] = []) {
  if (IS_POSTGRES) return pgGetAll(sqlStr, params);
  return sqliteGetAll(sqlStr, params);
}

export async function dbInsert(table: string, data: Record<string, unknown>) {
  if (IS_POSTGRES) return pgInsert(table, data);
  return sqliteInsert(table, data);
}

/* ------------------------------------------------------------------ */
/*  Migrations                                                        */
/* ------------------------------------------------------------------ */

function migrateSqlite(db: DatabaseType) {
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

export async function runMigrations() {
  if (IS_POSTGRES && sqlClient) {
    await sqlClient("CREATE TABLE IF NOT EXISTS users (id SERIAL PRIMARY KEY, email TEXT UNIQUE NOT NULL, name TEXT, password_hash TEXT NOT NULL, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP)");
    await sqlClient("CREATE TABLE IF NOT EXISTS download_events (id SERIAL PRIMARY KEY, user_id INTEGER REFERENCES users(id), platform TEXT, ip TEXT, user_agent TEXT, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP)");
    await sqlClient("CREATE INDEX IF NOT EXISTS idx_users_email ON users(email)");
    await sqlClient("CREATE INDEX IF NOT EXISTS idx_downloads_user ON download_events(user_id)");
    await sqlClient("CREATE INDEX IF NOT EXISTS idx_downloads_created ON download_events(created_at)");
  }
}

/* ------------------------------------------------------------------ */
/*  Types                                                             */
/* ------------------------------------------------------------------ */

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
