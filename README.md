# Codex History Helper

Codex History Helper is a local-first web UI for browsing, searching, annotating, hiding, and resuming Codex CLI sessions.

It reads Codex session JSONL files from disk, indexes them into SQLite, and layers user-managed metadata on top without modifying the original logs.

## Current stack

- Node.js
- Express
- SQLite via `better-sqlite3`
- React
- esbuild

## What the app does

- Scans local Codex session files under `~/.codex/sessions`
- Parses JSONL logs defensively without assuming a stable schema
- Indexes searchable content into SQLite FTS5
- Shows sessions in a three-panel UI
- Supports full-text search across prompts, replies, commands, outputs, and errors
- Lets you edit custom summaries
- Lets you manage tags
- Lets you pin important sessions
- Lets you hide sessions in SQLite without deleting source files
- Lets you toggle hidden sessions globally with `Show hidden`
- Opens `codex resume <session-id>` in a terminal emulator

## UI layout

- Top toolbar: tabs, search, repo filter, `Show hidden`, reindex
- Left panel: session list or search results
- Middle panel: transcript
- Right panel: summary, tags, facts, pin/hide/resume actions

Transcript behavior:

- `response_item:message / developer` is collapsed by default
- AGENTS/bootstrap `response_item:message / user` entries are collapsed by default
- `response_item:function_call_output` is collapsed by default

Session title behavior:

- `custom_summary` is used first if present
- otherwise the app derives a human-readable title from the first real user message
- AGENTS/bootstrap and environment wrapper messages are skipped when resolving titles

## Local-first rules

- Original Codex session files are treated as read-only
- All custom metadata is stored separately in SQLite
- Hiding a session only affects the database-backed UI, not the source JSONL file

## Project layout

```text
backend/
  src/
    config.js
    db/
      index.js
      schema.js
    indexer/
      indexer.js
    lib/
      fs.js
      resume.js
    parser/
      extract.js
      index.js
    routes/
      api.js
    server.js

frontend/
  index.html
  src/
    api.js
    App.jsx
    components/
      MetadataPanel.jsx
      SearchResults.jsx
      SessionList.jsx
      Toolbar.jsx
      TranscriptView.jsx
    styles/
      app.css

data/
  history.db
```

## Install

```bash
npm install
```

## Run

```bash
npm start
```

`npm start` builds the frontend bundle and starts a single Express server that serves both the UI and the API.

Default URL:

```text
http://localhost:3123
```

## Configuration

- `PORT`: HTTP port, default `3123`
- `CODEX_SESSIONS_DIR`: override the source session directory
- `CODEX_HISTORY_DB_PATH`: override the SQLite DB path
- `CODEX_RESUME_TERMINAL`: override the terminal launcher used for `resume`

## Data model

### `sessions`

Indexed immutable session metadata derived from JSONL files.

### `entries`

Normalized transcript rows plus extracted searchable text and raw JSON.

### `session_metadata`

Mutable UI metadata:

- `custom_summary`
- `pinned`
- `archived`

### `tags`

Tag names.

### `session_tags`

Many-to-many link between sessions and tags.

### `entries_fts`

SQLite FTS5 index for search.

## API

### Read APIs

- `GET /api/sessions`
- `GET /api/sessions?repo=/path/to/repo`
- `GET /api/sessions?includeArchived=1`
- `GET /api/sessions/:id`
- `GET /api/search?q=keyword`
- `GET /api/search?q=keyword&repo=/path/to/repo`
- `GET /api/search?q=keyword&includeArchived=1`

### Update APIs

- `POST /api/sessions/:id/summary`
- `POST /api/sessions/:id/tags`
- `POST /api/sessions/:id/pin`
- `POST /api/sessions/:id/hide`
- `POST /api/sessions/:id/resume`
- `POST /api/reindex`

Example request bodies:

```json
{ "summary": "Short custom note" }
```

```json
{ "tags": ["debug", "deployment"] }
```

```json
{ "pinned": true }
```

```json
{ "archived": true }
```

## Search behavior

- Search uses SQLite FTS5
- Search results include a snippet and match type
- Hidden sessions are excluded unless `includeArchived=1` is set

## Resume behavior

The app does not resume inside the browser. It launches a local terminal emulator and runs:

```bash
codex resume <session-id>
```

Common Linux terminal launchers are supported, and `CODEX_RESUME_TERMINAL` can override the default behavior.

## Reindex behavior

- Sessions are indexed on server startup
- `POST /api/reindex` forces a full reindex
- Reindexing refreshes parsed session data while preserving SQLite metadata such as custom summaries, tags, pin state, and hidden state

## Design notes

- The parser is resilient by design and keeps `raw_json` for transcript entries
- Unknown log structures are not treated as fatal
- Source file deletion is intentionally not part of the app
- Hiding is implemented as a database-only soft delete

## Current limitations

- Auto-generated session titles are heuristic, not semantic summaries
- Log formats vary across Codex versions and IDE/CLI flows, so extraction is best-effort
- Resume depends on `codex` being available locally and on a usable terminal emulator
