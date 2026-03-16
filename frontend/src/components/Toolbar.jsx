import React from "react";

export function Toolbar({
  activeTab,
  onTabChange,
  query,
  onQueryChange,
  repos,
  repoFilter,
  onRepoFilterChange,
  includeArchived,
  onIncludeArchivedChange,
  onReindex,
  busy
}) {
  return (
    <header className="toolbar">
      <div className="toolbar__brand">
        <span className="toolbar__eyebrow">Local-first Codex history</span>
        <h1>Codex History Helper</h1>
      </div>
      <div className="toolbar__controls">
        <div className="tabs">
          <button className={activeTab === "sessions" ? "is-active" : ""} onClick={() => onTabChange("sessions")}>
            Sessions
          </button>
          <button className={activeTab === "search" ? "is-active" : ""} onClick={() => onTabChange("search")}>
            Search
          </button>
        </div>
        <input
          className="toolbar__search"
          type="search"
          placeholder="Search prompts, replies, commands, outputs, errors"
          value={query}
          onChange={(event) => onQueryChange(event.target.value)}
        />
        <select value={repoFilter} onChange={(event) => onRepoFilterChange(event.target.value)}>
          <option value="">All repos</option>
          {repos.map((repo) => (
            <option key={repo} value={repo}>
              {repo}
            </option>
          ))}
        </select>
        <label className="toolbar__toggle">
          <input
            type="checkbox"
            checked={includeArchived}
            onChange={(event) => onIncludeArchivedChange(event.target.checked)}
          />
          <span>Show hidden</span>
        </label>
        <button onClick={onReindex} disabled={busy}>
          {busy ? "Indexing..." : "Reindex"}
        </button>
      </div>
    </header>
  );
}
