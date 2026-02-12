import Database from 'better-sqlite3';

export function createSchema(db: Database.Database): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS dives (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT,
      manager_name TEXT NOT NULL,
      team_members TEXT DEFAULT '[]',
      status TEXT CHECK(status IN ('active', 'completed')) DEFAULT 'active',
      started_at TEXT NOT NULL,
      ended_at TEXT,
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS carts (
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

    CREATE TABLE IF NOT EXISTS checkins (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      cart_id INTEGER NOT NULL REFERENCES carts(id),
      checked_in_at TEXT NOT NULL,
      next_deadline TEXT NOT NULL,
      reset_reason TEXT,
      location TEXT,
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS events (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      cart_id INTEGER NOT NULL REFERENCES carts(id),
      event_type TEXT CHECK(event_type IN ('warning', 'overdue', 'emergency')) NOT NULL,
      status TEXT CHECK(status IN ('open', 'resolved')) DEFAULT 'open',
      opened_at TEXT NOT NULL,
      resolved_at TEXT,
      notes TEXT,
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS attachments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      cart_id INTEGER NOT NULL REFERENCES carts(id),
      filename TEXT NOT NULL,
      filepath TEXT NOT NULL,
      uploaded_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS audit_log (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      action TEXT NOT NULL,
      entity_type TEXT,
      entity_id INTEGER,
      details TEXT,
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS protocols (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      content TEXT NOT NULL,
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE INDEX IF NOT EXISTS idx_checkins_cart_id ON checkins(cart_id);
    CREATE INDEX IF NOT EXISTS idx_events_cart_id ON events(cart_id);
    CREATE INDEX IF NOT EXISTS idx_events_status ON events(status);
    CREATE INDEX IF NOT EXISTS idx_carts_status ON carts(status);
    CREATE INDEX IF NOT EXISTS idx_attachments_cart_id ON attachments(cart_id);
  `);
}
