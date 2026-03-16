import Database from "better-sqlite3";
import { config } from "../config.js";
import { ensureDirSync } from "../lib/fs.js";
import { schemaStatements } from "./schema.js";

ensureDirSync(config.dataDir);

const db = new Database(config.dbPath);
db.pragma("journal_mode = WAL");
db.pragma("foreign_keys = ON");

for (const statement of schemaStatements) {
  db.exec(statement);
}

const metadataColumns = db.prepare(`PRAGMA table_info(session_metadata)`).all();
if (!metadataColumns.some((column) => column.name === "archived")) {
  db.exec(`ALTER TABLE session_metadata ADD COLUMN archived INTEGER NOT NULL DEFAULT 0`);
}

export function getDb() {
  return db;
}
