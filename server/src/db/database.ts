import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';
import { createSchema } from './schema';

const DATA_DIR = path.join(__dirname, '..', '..', 'data');
const DB_PATH = path.join(DATA_DIR, 'agula.db');

let db: Database.Database;

export function getDatabase(): Database.Database {
  if (!db) {
    // Ensure data directory exists
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }

    db = new Database(DB_PATH);

    // Enable WAL mode for better concurrent access
    db.pragma('journal_mode = WAL');
    db.pragma('foreign_keys = ON');
    db.pragma('busy_timeout = 5000');

    // Create schema
    createSchema(db);

    // Migrations for existing databases
    const columns = db.prepare("PRAGMA table_info(carts)").all() as Array<{ name: string }>;
    if (!columns.some(c => c.name === 'checkin_location')) {
      db.exec('ALTER TABLE carts ADD COLUMN checkin_location TEXT');
    }
    if (!columns.some(c => c.name === 'dive_id')) {
      db.exec('ALTER TABLE carts ADD COLUMN dive_id INTEGER REFERENCES dives(id)');
    }

    // Add name column to dives table
    const diveColumns = db.prepare("PRAGMA table_info(dives)").all() as Array<{ name: string }>;
    if (!diveColumns.some(c => c.name === 'name')) {
      db.exec('ALTER TABLE dives ADD COLUMN name TEXT');
    }

    // Migrate unique constraint from cart_number alone to (cart_number, dive_id)
    const indexes = db.prepare("PRAGMA index_list(carts)").all() as Array<{ name: string; unique: number }>;
    const hasOldUnique = indexes.some(idx => {
      if (!idx.unique) return false;
      const cols = db.prepare(`PRAGMA index_info("${idx.name}")`).all() as Array<{ name: string }>;
      return cols.length === 1 && cols[0].name === 'cart_number';
    });
    if (hasOldUnique) {
      // SQLite can't drop constraints directly; recreate the table
      // Must disable FK checks temporarily since other tables reference carts
      db.pragma('foreign_keys = OFF');
      db.exec(`DROP TABLE IF EXISTS carts_new`);
      db.exec(`
        CREATE TABLE carts_new (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          cart_number INTEGER NOT NULL,
          cart_type INTEGER CHECK(cart_type BETWEEN 2 AND 8) DEFAULT 2,
          diver_names TEXT NOT NULL,
          dive_id INTEGER REFERENCES dives(id),
          status TEXT CHECK(status IN ('active', 'completed')) DEFAULT 'active',
          started_at TEXT NOT NULL,
          ended_at TEXT,
          paused_at TEXT,
          checkin_location TEXT,
          created_at TEXT DEFAULT (datetime('now')),
          UNIQUE(cart_number, dive_id)
        );
        INSERT INTO carts_new SELECT id, cart_number,
          CASE cart_type WHEN 'pair' THEN 2 WHEN 'trio' THEN 3 WHEN 'six' THEN 6 ELSE cart_type END,
          diver_names, dive_id, status, started_at, ended_at, paused_at, checkin_location, created_at FROM carts;
        DROP TABLE carts;
        ALTER TABLE carts_new RENAME TO carts;
        CREATE INDEX IF NOT EXISTS idx_carts_status ON carts(status);
      `);
      db.pragma('foreign_keys = ON');
    }

    // Migrate cart_type from text ('pair','trio','six') to integer (2,3,6)
    const cartTypeCol = columns.find(c => c.name === 'cart_type') as { name: string; type: string } | undefined;
    if (cartTypeCol && (cartTypeCol as any).type === 'TEXT') {
      db.pragma('foreign_keys = OFF');
      db.exec(`DROP TABLE IF EXISTS carts_new`);
      db.exec(`
        CREATE TABLE carts_new (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          cart_number INTEGER NOT NULL,
          cart_type INTEGER CHECK(cart_type BETWEEN 2 AND 8) DEFAULT 2,
          diver_names TEXT NOT NULL,
          dive_id INTEGER REFERENCES dives(id),
          status TEXT CHECK(status IN ('active', 'completed')) DEFAULT 'active',
          started_at TEXT NOT NULL,
          ended_at TEXT,
          paused_at TEXT,
          checkin_location TEXT,
          created_at TEXT DEFAULT (datetime('now')),
          UNIQUE(cart_number, dive_id)
        );
        INSERT INTO carts_new SELECT id, cart_number,
          CASE cart_type WHEN 'pair' THEN 2 WHEN 'trio' THEN 3 WHEN 'six' THEN 6 ELSE 2 END,
          diver_names, dive_id, status, started_at, ended_at, paused_at, checkin_location, created_at FROM carts;
        DROP TABLE carts;
        ALTER TABLE carts_new RENAME TO carts;
        CREATE INDEX IF NOT EXISTS idx_carts_status ON carts(status);
      `);
      db.pragma('foreign_keys = ON');
    }

    console.log(`Database initialized at ${DB_PATH} (WAL mode)`);
  }

  return db;
}

export function closeDatabase(): void {
  if (db) {
    db.close();
    console.log('Database connection closed');
  }
}
