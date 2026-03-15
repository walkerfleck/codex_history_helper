# Codex History Helper

A local-first Web GUI for browsing, searching, annotating, and resuming **Codex CLI session history**.

This tool converts your local Codex sessions into a searchable knowledge base so you can easily find previous prompts, commands, debugging sessions, and solutions.

Instead of remembering many CLI commands or digging through JSON logs, this application provides a clean graphical interface.

---

# Motivation

Codex CLI stores all conversation sessions locally, but they are saved as JSONL log files that are not easy to browse manually.

Each session is stored under:

~/.codex/sessions/YYYY/MM/DD/rollout-*.jsonl

Each JSONL file contains the full conversation history including:

- user prompts
- assistant replies
- tool calls
- shell commands
- command outputs
- errors
- token usage
- metadata

While these logs are extremely valuable, they are difficult to search and navigate.

This project builds a **local Web interface** on top of those session logs.

---

# Features

## Session browsing

- List recent Codex sessions
- Group sessions by repository / working directory
- View session metadata (time, repo path, model, etc.)

## Full-text search

Search across:

- user prompts
- assistant replies
- shell commands
- shell outputs
- errors

Search results show highlighted snippets and matched content.

## Session detail view

Display full session transcripts including:

- prompts
- responses
- commands
- outputs
- errors

All content is displayed in a scrollable interface.

## Custom summaries

Users can add or edit a **manual summary** for each session.

Summary priority:

1. custom summary
2. auto-generated summary
3. first prompt preview

## Tags

Add tags such as:

- `debug`
- `docker`
- `gsm`
- `deployment`
- `refactor`

Tags help organize sessions into meaningful groups.

## Pinned sessions

Mark important sessions as favorites.

Pinned sessions appear at the top of the list.

## Resume sessions

Resume a previous Codex CLI session directly from the interface.

The application calls:

codex resume <session-id>

This allows you to continue working where you left off.

---

# Architecture

This application is **local-first** and does not require internet access.

## Stack

Backend

- Node.js
- Express

Database

- SQLite
- SQLite FTS (full text search)

Frontend

- React

Platform

- Linux / macOS local machine

---

# Design Principles

## Local-first

All data remains on your machine.

No cloud services required.

## Read-only Codex logs

Original Codex session logs are **never modified**.

The application only reads:

~/.codex/sessions/

Custom metadata is stored separately in SQLite.

## Robust parsing

Codex session logs may change across versions.

The parser is designed to:

- tolerate unknown fields
- gracefully skip corrupted sessions
- avoid breaking if the schema evolves

## Simple architecture

This project prioritizes:

- maintainability
- readability
- minimal dependencies

---

# Project Structure
codex-history-search
│
├── backend
│ ├── parser
│ ├── routes
│ ├── database
│ └── server.js
│
├── frontend
│ ├── src
│ └── public
│
├── data
│ └── history.db
│
├── AGENTS.md
└── README.md


---

# Database Schema

Main tables:

## sessions

Stores session metadata.

Fields include:

- session_id
- started_at
- updated_at
- repo_path
- model
- auto_summary
- custom_summary
- pinned

## entries

Stores parsed conversation entries.

Types include:

- prompt
- assistant
- command
- output
- error

## tags

Tag definitions.

## session_tags

Mapping between sessions and tags.

---

# How It Works

1. Scan `~/.codex/sessions`
2. Parse JSONL session logs
3. Extract structured entries
4. Store searchable content in SQLite
5. Provide REST APIs
6. Render sessions via React UI

---

# UI Layout

Three-column layout:

Left panel

Session list and search results.

Center panel

Full session transcript.

Right panel

Metadata and actions.

Top toolbar

- search
- repo filter
- tag filter
- tabs

---

# Setup

## Requirements

- Node.js 18+
- Codex CLI installed
- Linux or macOS

## Clone repository

git clone <repo>
cd codex-history-search


## Install backend dependencies

cd backend
npm install


## Install frontend dependencies

cd ../frontend
npm install


## Run development server

Open:

http://localhost:3000

---

# Example Use Cases

## Find a previous debugging session

Search:


and instantly locate the session where it was solved.

## Resume unfinished work

Click "Resume Session" to continue the previous conversation.

## Build a personal coding knowledge base

Over time your Codex sessions become searchable engineering documentation.

---

# Limitations

- Requires Codex CLI session logs
- Session schema may evolve
- Very large history directories may require indexing time

---

# Future Improvements

Possible future features:

- session analytics
- command frequency statistics
- error clustering
- git commit integration
- export sessions to Markdown
- multi-machine sync

---



# Contributing

Contributions are welcome.

Possible areas:

- parser improvements
- UI enhancements
- performance optimization
- schema evolution support

---

# Acknowledgements

Inspired by the need for a practical interface on top of Codex CLI session logs.

Codex CLI already stores full transcripts locally; this project focuses on making them easier to browse and search.
