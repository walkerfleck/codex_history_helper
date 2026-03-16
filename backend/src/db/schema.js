export const schemaStatements = [
  `
    CREATE TABLE IF NOT EXISTS sessions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      session_id TEXT NOT NULL UNIQUE,
      source_path TEXT NOT NULL,
      repo_path TEXT,
      cwd TEXT,
      model TEXT,
      started_at TEXT,
      updated_at TEXT,
      last_indexed_at TEXT NOT NULL,
      file_mtime_ms INTEGER NOT NULL,
      entry_count INTEGER NOT NULL DEFAULT 0,
      auto_summary TEXT,
      pinned INTEGER NOT NULL DEFAULT 0
    )
  `,
  `
    CREATE TABLE IF NOT EXISTS entries (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      session_id TEXT NOT NULL,
      entry_index INTEGER NOT NULL,
      timestamp TEXT,
      entry_type TEXT,
      role TEXT,
      title TEXT,
      content TEXT,
      command_text TEXT,
      output_text TEXT,
      error_text TEXT,
      search_text TEXT NOT NULL,
      raw_json TEXT NOT NULL,
      FOREIGN KEY (session_id) REFERENCES sessions(session_id) ON DELETE CASCADE
    )
  `,
  `
    CREATE UNIQUE INDEX IF NOT EXISTS idx_entries_session_order
    ON entries(session_id, entry_index)
  `,
  `
    CREATE INDEX IF NOT EXISTS idx_sessions_repo_path
    ON sessions(repo_path)
  `,
  `
    CREATE INDEX IF NOT EXISTS idx_sessions_updated_at
    ON sessions(updated_at)
  `,
  `
    CREATE TABLE IF NOT EXISTS session_metadata (
      session_id TEXT PRIMARY KEY,
      custom_summary TEXT,
      pinned INTEGER NOT NULL DEFAULT 0,
      archived INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (session_id) REFERENCES sessions(session_id) ON DELETE CASCADE
    )
  `,
  `
    CREATE TABLE IF NOT EXISTS tags (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE
    )
  `,
  `
    CREATE TABLE IF NOT EXISTS session_tags (
      session_id TEXT NOT NULL,
      tag_id INTEGER NOT NULL,
      PRIMARY KEY (session_id, tag_id),
      FOREIGN KEY (session_id) REFERENCES sessions(session_id) ON DELETE CASCADE,
      FOREIGN KEY (tag_id) REFERENCES tags(id) ON DELETE CASCADE
    )
  `,
  `
    CREATE VIRTUAL TABLE IF NOT EXISTS entries_fts USING fts5(
      session_id UNINDEXED,
      entry_id UNINDEXED,
      entry_type,
      role,
      title,
      content,
      command_text,
      output_text,
      error_text,
      search_text
    )
  `
];
