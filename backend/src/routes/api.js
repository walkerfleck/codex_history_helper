import express from "express";
import { getDb } from "../db/index.js";
import { config } from "../config.js";
import { scanAndIndexSessions } from "../indexer/indexer.js";
import { resumeSession } from "../lib/resume.js";

const db = getDb();
const router = express.Router();

const sessionListSql = `
  SELECT
    s.session_id,
    s.source_path,
    s.repo_path,
    s.cwd,
    s.model,
    s.started_at,
    s.updated_at,
    s.entry_count,
    s.auto_summary,
    sm.custom_summary,
    COALESCE(sm.custom_summary, s.auto_summary) AS display_summary,
    COALESCE(sm.pinned, s.pinned, 0) AS pinned,
    COALESCE(sm.archived, 0) AS archived,
    GROUP_CONCAT(t.name, ',') AS tags
  FROM sessions s
  LEFT JOIN session_metadata sm ON sm.session_id = s.session_id
  LEFT JOIN session_tags st ON st.session_id = s.session_id
  LEFT JOIN tags t ON t.id = st.tag_id
  WHERE (? IS NULL OR s.repo_path = ?)
    AND (? = 1 OR COALESCE(sm.archived, 0) = 0)
  GROUP BY s.session_id
  ORDER BY pinned DESC, COALESCE(s.updated_at, s.started_at, s.last_indexed_at) DESC
  LIMIT ?
`;

const sessionDetailSql = `
  SELECT
    s.session_id,
    s.source_path,
    s.repo_path,
    s.cwd,
    s.model,
    s.started_at,
    s.updated_at,
    s.entry_count,
    s.auto_summary,
    sm.custom_summary,
    COALESCE(sm.pinned, s.pinned, 0) AS pinned,
    COALESCE(sm.archived, 0) AS archived
  FROM sessions s
  LEFT JOIN session_metadata sm ON sm.session_id = s.session_id
  WHERE s.session_id = ?
`;

const entryListSql = `
  SELECT
    id,
    entry_index,
    timestamp,
    entry_type,
    role,
    title,
    content,
    command_text,
    output_text,
    error_text,
    raw_json
  FROM entries
  WHERE session_id = ?
  ORDER BY entry_index ASC
`;

const repoListSql = `
  SELECT DISTINCT repo_path
  FROM sessions
  WHERE repo_path IS NOT NULL AND repo_path != ''
  ORDER BY repo_path ASC
`;

const tagListSql = `
  SELECT t.name
  FROM session_tags st
  JOIN tags t ON t.id = st.tag_id
  WHERE st.session_id = ?
  ORDER BY t.name ASC
`;

const searchSql = `
  SELECT
    e.session_id,
    e.id AS entry_id,
    e.entry_type,
    e.role,
    e.timestamp,
    COALESCE(s.repo_path, '') AS repo_path,
    COALESCE(sm.custom_summary, s.auto_summary) AS summary,
    COALESCE(sm.archived, 0) AS archived,
    snippet(entries_fts, 9, '<mark>', '</mark>', ' … ', 18) AS snippet
  FROM entries_fts
  JOIN entries e ON e.id = entries_fts.entry_id
  JOIN sessions s ON s.session_id = e.session_id
  LEFT JOIN session_metadata sm ON sm.session_id = s.session_id
  WHERE entries_fts MATCH ?
    AND (? IS NULL OR s.repo_path = ?)
    AND (? = 1 OR COALESCE(sm.archived, 0) = 0)
  ORDER BY bm25(entries_fts), COALESCE(s.updated_at, s.started_at, s.last_indexed_at) DESC
  LIMIT 100
`;

const fallbackTitleSql = db.prepare(`
  SELECT content
  FROM entries
  WHERE session_id = ?
    AND entry_type = 'response_item:message'
    AND role = 'user'
    AND content NOT LIKE '%# AGENTS.md instructions%'
    AND content NOT LIKE '%<environment_context>%'
    AND content IS NOT NULL
    AND content != ''
  ORDER BY entry_index ASC
  LIMIT 1
`);

const upsertSummarySql = db.prepare(`
  INSERT INTO session_metadata (session_id, custom_summary, pinned, archived, updated_at)
  VALUES (
    @session_id,
    @custom_summary,
    COALESCE((SELECT pinned FROM session_metadata WHERE session_id = @session_id), 0),
    COALESCE((SELECT archived FROM session_metadata WHERE session_id = @session_id), 0),
    CURRENT_TIMESTAMP
  )
  ON CONFLICT(session_id) DO UPDATE SET
    custom_summary = excluded.custom_summary,
    updated_at = CURRENT_TIMESTAMP
`);

const upsertPinSql = db.prepare(`
  INSERT INTO session_metadata (session_id, custom_summary, pinned, archived, updated_at)
  VALUES (
    @session_id,
    (SELECT custom_summary FROM session_metadata WHERE session_id = @session_id),
    @pinned,
    COALESCE((SELECT archived FROM session_metadata WHERE session_id = @session_id), 0),
    CURRENT_TIMESTAMP
  )
  ON CONFLICT(session_id) DO UPDATE SET
    pinned = excluded.pinned,
    updated_at = CURRENT_TIMESTAMP
`);

const upsertArchivedSql = db.prepare(`
  INSERT INTO session_metadata (session_id, custom_summary, pinned, archived, updated_at)
  VALUES (
    @session_id,
    (SELECT custom_summary FROM session_metadata WHERE session_id = @session_id),
    COALESCE((SELECT pinned FROM session_metadata WHERE session_id = @session_id), 0),
    @archived,
    CURRENT_TIMESTAMP
  )
  ON CONFLICT(session_id) DO UPDATE SET
    archived = excluded.archived,
    updated_at = CURRENT_TIMESTAMP
`);

const insertTagSql = db.prepare(`
  INSERT INTO tags(name) VALUES (?)
  ON CONFLICT(name) DO NOTHING
`);

const clearSessionTagsSql = db.prepare(`
  DELETE FROM session_tags WHERE session_id = ?
`);

const attachTagSql = db.prepare(`
  INSERT OR IGNORE INTO session_tags(session_id, tag_id)
  SELECT ?, id FROM tags WHERE name = ?
`);

function normalizeTags(tagInput) {
  if (!Array.isArray(tagInput)) {
    return [];
  }

  return [...new Set(tagInput.map((tag) => String(tag || "").trim()).filter(Boolean))].sort();
}

function parseTagsString(value) {
  return value ? value.split(",").filter(Boolean) : [];
}

function buildFtsQuery(input) {
  return input
    .split(/\s+/)
    .map((part) => part.trim())
    .filter(Boolean)
    .map((part) => `"${part.replace(/"/g, '""')}"`)
    .join(" AND ");
}

function firstReadableLine(text) {
  const value = String(text || "");
  const requestMatch = value.match(/## My request for Codex:\s*([\s\S]+)/i);
  const candidate = requestMatch ? requestMatch[1] : value;

  return candidate
    .split(/\n+/)
    .map((line) => line.trim())
    .find((line) => {
      if (!line || line.length < 2) {
        return false;
      }

      return (
        !/^<[^>]+>$/.test(line) &&
        !/^# AGENTS\.md instructions/i.test(line) &&
        !/^# Context from my IDE setup:/i.test(line) &&
        !/^## Open tabs:/i.test(line) &&
        !/^## Active file:/i.test(line) &&
        !/^## My request for Codex:/i.test(line) &&
        !/^- .*: /.test(line) &&
        !/^##?\s/.test(line) &&
        !/^###\s/.test(line)
      );
    });
}

function needsTitleFallback(summary) {
  if (typeof summary !== "string") {
    return false;
  }

  return (
    summary.includes("# AGENTS.md instructions") ||
    summary.includes("<environment_context>") ||
    summary.includes("<INSTRUCTIONS>") ||
    /^<[^>]+>$/.test(summary.trim())
  );
}

function withResolvedTitle(sessionRow) {
  if (sessionRow.custom_summary && sessionRow.custom_summary.trim()) {
    return sessionRow;
  }

  if (!needsTitleFallback(sessionRow.display_summary || sessionRow.auto_summary)) {
    return sessionRow;
  }

  const fallback = fallbackTitleSql.get(sessionRow.session_id);
  const fallbackTitle = firstReadableLine(fallback?.content);

  if (!fallbackTitle) {
    return sessionRow;
  }

  return {
    ...sessionRow,
    auto_summary: fallbackTitle,
    display_summary: fallbackTitle
  };
}

const replaceTagsTransaction = db.transaction((sessionId, tags) => {
  clearSessionTagsSql.run(sessionId);
  for (const tag of tags) {
    insertTagSql.run(tag);
    attachTagSql.run(sessionId, tag);
  }
});

router.get("/health", (_req, res) => {
  res.json({ ok: true });
});

router.post("/reindex", (_req, res) => {
  const result = scanAndIndexSessions(config.sessionsDir, { force: true });
  res.json(result);
});

router.get("/sessions", (req, res) => {
  const repoPath = req.query.repo ? String(req.query.repo) : null;
  const includeArchived = req.query.includeArchived === "1" ? 1 : 0;
  const rows = db.prepare(sessionListSql).all(repoPath, repoPath, includeArchived, config.maxSessionRows);
  const repos = db.prepare(repoListSql).all().map((row) => row.repo_path);

  res.json({
    sessions: rows.map((row) => {
      const session = withResolvedTitle(row);
      return {
        ...session,
        pinned: Boolean(session.pinned),
        archived: Boolean(session.archived),
        tags: parseTagsString(session.tags)
      };
    }),
    repos
  });
});

router.get("/sessions/:id", (req, res) => {
  const sessionId = req.params.id;
  const session = db.prepare(sessionDetailSql).get(sessionId);

  if (!session) {
    res.status(404).json({ error: "Session not found" });
    return;
  }

  const entries = db.prepare(entryListSql).all(sessionId);
  const tags = db.prepare(tagListSql).all(sessionId).map((row) => row.name);

  res.json({
    session: {
      ...withResolvedTitle(session),
      pinned: Boolean(session.pinned),
      archived: Boolean(session.archived),
      tags
    },
    entries
  });
});

router.get("/search", (req, res) => {
  const query = String(req.query.q || "").trim();
  const repoPath = req.query.repo ? String(req.query.repo) : null;
  const includeArchived = req.query.includeArchived === "1" ? 1 : 0;
  const ftsQuery = buildFtsQuery(query);

  if (!query || !ftsQuery) {
    res.json({ results: [] });
    return;
  }

  const rows = db.prepare(searchSql).all(ftsQuery, repoPath, repoPath, includeArchived);
  res.json({
    results: rows.map((row) => ({
      ...row,
      archived: Boolean(row.archived),
      match_type: row.entry_type || row.role || "entry"
    }))
  });
});

router.post("/sessions/:id/summary", (req, res) => {
  const sessionId = req.params.id;
  const customSummary = String(req.body?.summary || "").trim();

  upsertSummarySql.run({
    session_id: sessionId,
    custom_summary: customSummary || null
  });

  res.json({ ok: true, summary: customSummary });
});

router.post("/sessions/:id/tags", (req, res) => {
  const sessionId = req.params.id;
  const tags = normalizeTags(req.body?.tags);
  replaceTagsTransaction(sessionId, tags);
  res.json({ ok: true, tags });
});

router.post("/sessions/:id/pin", (req, res) => {
  const sessionId = req.params.id;
  const pinned = Boolean(req.body?.pinned);

  upsertPinSql.run({
    session_id: sessionId,
    pinned: pinned ? 1 : 0
  });

  res.json({ ok: true, pinned });
});

router.post("/sessions/:id/hide", (req, res) => {
  const sessionId = req.params.id;
  const archived = Boolean(req.body?.archived);

  upsertArchivedSql.run({
    session_id: sessionId,
    archived: archived ? 1 : 0
  });

  res.json({ ok: true, archived });
});

router.post("/sessions/:id/resume", (req, res) => {
  try {
    const result = resumeSession(req.params.id);
    res.json(result);
  } catch (error) {
    res.status(500).json({
      ok: false,
      error: error instanceof Error ? error.message : String(error)
    });
  }
});

export function createApiRouter() {
  return router;
}
