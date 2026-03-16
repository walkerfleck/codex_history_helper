import { getDb } from "../db/index.js";
import { walkJsonlFiles } from "../lib/fs.js";
import { parseSessionFile } from "../parser/index.js";

const db = getDb();

const selectIndexedSession = db.prepare(`
  SELECT session_id, file_mtime_ms
  FROM sessions
  WHERE source_path = ?
`);

const deleteEntriesForSession = db.prepare(`
  DELETE FROM entries WHERE session_id = ?
`);

const deleteFtsForSession = db.prepare(`
  DELETE FROM entries_fts WHERE session_id = ?
`);

const selectSessionsBySourcePath = db.prepare(`
  SELECT session_id
  FROM sessions
  WHERE source_path = ?
`);

const deleteSessionById = db.prepare(`
  DELETE FROM sessions WHERE session_id = ?
`);

const upsertSession = db.prepare(`
  INSERT INTO sessions (
    session_id,
    source_path,
    repo_path,
    cwd,
    model,
    started_at,
    updated_at,
    last_indexed_at,
    file_mtime_ms,
    entry_count,
    auto_summary
  ) VALUES (
    @session_id,
    @source_path,
    @repo_path,
    @cwd,
    @model,
    @started_at,
    @updated_at,
    @last_indexed_at,
    @file_mtime_ms,
    @entry_count,
    @auto_summary
  )
  ON CONFLICT(session_id) DO UPDATE SET
    source_path = excluded.source_path,
    repo_path = excluded.repo_path,
    cwd = excluded.cwd,
    model = excluded.model,
    started_at = excluded.started_at,
    updated_at = excluded.updated_at,
    last_indexed_at = excluded.last_indexed_at,
    file_mtime_ms = excluded.file_mtime_ms,
    entry_count = excluded.entry_count,
    auto_summary = excluded.auto_summary
`);

const insertEntry = db.prepare(`
  INSERT INTO entries (
    session_id,
    entry_index,
    timestamp,
    entry_type,
    role,
    title,
    content,
    command_text,
    output_text,
    error_text,
    search_text,
    raw_json
  ) VALUES (
    @session_id,
    @entry_index,
    @timestamp,
    @entry_type,
    @role,
    @title,
    @content,
    @command_text,
    @output_text,
    @error_text,
    @search_text,
    @raw_json
  )
`);

const insertFts = db.prepare(`
  INSERT INTO entries_fts (
    session_id,
    entry_id,
    entry_type,
    role,
    title,
    content,
    command_text,
    output_text,
    error_text,
    search_text
  ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
`);

const indexSessionTransaction = db.transaction((parsedSession) => {
  const staleSessions = selectSessionsBySourcePath
    .all(parsedSession.session.source_path)
    .filter((row) => row.session_id !== parsedSession.session.session_id);

  for (const staleSession of staleSessions) {
    deleteEntriesForSession.run(staleSession.session_id);
    deleteFtsForSession.run(staleSession.session_id);
    deleteSessionById.run(staleSession.session_id);
  }

  upsertSession.run({
    ...parsedSession.session,
    last_indexed_at: new Date().toISOString()
  });

  deleteEntriesForSession.run(parsedSession.session.session_id);
  deleteFtsForSession.run(parsedSession.session.session_id);

  for (const entry of parsedSession.entries) {
    const result = insertEntry.run({
      ...entry,
      session_id: parsedSession.session.session_id
    });

    insertFts.run(
      parsedSession.session.session_id,
      result.lastInsertRowid,
      entry.entry_type,
      entry.role,
      entry.title,
      entry.content,
      entry.command_text,
      entry.output_text,
      entry.error_text,
      entry.search_text
    );
  }
});

export function scanAndIndexSessions(sessionsDir, options = {}) {
  const force = Boolean(options.force);
  const files = walkJsonlFiles(sessionsDir);
  const indexed = [];
  const skipped = [];
  const errors = [];

  for (const fileInfo of files) {
    try {
      const existing = selectIndexedSession.get(fileInfo.path);
      if (!force && existing && Number(existing.file_mtime_ms) === Math.trunc(fileInfo.mtimeMs)) {
        skipped.push(fileInfo.path);
        continue;
      }

      const parsedSession = parseSessionFile(fileInfo);
      indexSessionTransaction(parsedSession);
      indexed.push(parsedSession.session.session_id);
    } catch (error) {
      errors.push({
        path: fileInfo.path,
        message: error instanceof Error ? error.message : String(error)
      });
    }
  }

  return {
    totalFiles: files.length,
    indexedCount: indexed.length,
    skippedCount: skipped.length,
    errors
  };
}
