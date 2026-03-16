import React from "react";

function parseMarkedSnippet(snippet) {
  if (!snippet) {
    return [];
  }

  const parts = [];
  const regex = /<mark>(.*?)<\/mark>/g;
  let cursor = 0;
  let match = regex.exec(snippet);

  while (match) {
    if (match.index > cursor) {
      parts.push({ text: snippet.slice(cursor, match.index), marked: false });
    }

    parts.push({ text: match[1], marked: true });
    cursor = match.index + match[0].length;
    match = regex.exec(snippet);
  }

  if (cursor < snippet.length) {
    parts.push({ text: snippet.slice(cursor), marked: false });
  }

  return parts;
}

export function SearchResults({ results, onSelect, selectedSessionId }) {
  return (
    <div className="sidebar-list">
      {results.map((result) => (
        <button
          key={`${result.session_id}-${result.entry_id}`}
          className={`session-card ${selectedSessionId === result.session_id ? "is-selected" : ""}`}
          onClick={() => onSelect(result.session_id)}
        >
          <div className="session-card__top">
            <strong>{result.match_type}</strong>
            <span>{result.timestamp || result.repo_path || "Unknown"}</span>
          </div>
          <div className="session-card__summary">
            {parseMarkedSnippet(result.snippet || result.summary || "").map((part, index) =>
              part.marked ? <mark key={index}>{part.text}</mark> : <React.Fragment key={index}>{part.text}</React.Fragment>
            )}
          </div>
          <div className="session-card__bottom">
            <span>{result.repo_path || "No repo path"}</span>
          </div>
        </button>
      ))}
    </div>
  );
}
