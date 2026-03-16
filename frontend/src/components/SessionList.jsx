import React from "react";

function formatDate(value) {
  if (!value) return "Unknown time";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString();
}

export function SessionList({ sessions, selectedSessionId, onSelect }) {
  return (
    <div className="sidebar-list">
      {sessions.map((session) => (
        <button
          key={session.session_id}
          className={`session-card ${selectedSessionId === session.session_id ? "is-selected" : ""}`}
          onClick={() => onSelect(session.session_id)}
        >
          <div className="session-card__top">
            <strong>{session.archived ? "Hidden" : session.pinned ? "Pinned" : "Session"}</strong>
            <span>{formatDate(session.updated_at || session.started_at)}</span>
          </div>
          <div className="session-card__summary">{session.display_summary || session.auto_summary || "No summary"}</div>
          <div className="session-card__bottom">
            <span className="session-card__repo" title={session.repo_path || "No repo path"}>
              {session.repo_path || "No repo path"}
            </span>
            <span className="session-card__tags" title={session.tags.join(", ") || "No tags"}>
              {session.tags.join(", ") || "No tags"}
            </span>
          </div>
        </button>
      ))}
    </div>
  );
}
