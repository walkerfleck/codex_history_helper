import React, { useEffect, useState } from "react";

export function MetadataPanel({ session, onSaveSummary, onSaveTags, onTogglePin, onToggleArchived, onResume, busy }) {
  const [summary, setSummary] = useState("");
  const [tagsInput, setTagsInput] = useState("");

  useEffect(() => {
    setSummary(session?.custom_summary || "");
    setTagsInput(session?.tags?.join(", ") || "");
  }, [session]);

  if (!session) {
    return <aside className="panel panel--side empty-state">Session metadata appears here.</aside>;
  }

  return (
    <aside className="panel panel--side">
      <div className="panel__header">
        <h2>Metadata</h2>
      </div>
      <div className="metadata-group">
        <label htmlFor="summary">Custom summary</label>
        <textarea
          id="summary"
          rows="6"
          value={summary}
          onChange={(event) => setSummary(event.target.value)}
        />
        <button onClick={() => onSaveSummary(summary)} disabled={busy}>
          Save summary
        </button>
      </div>
      <div className="metadata-group">
        <label htmlFor="tags">Tags</label>
        <input
          id="tags"
          type="text"
          placeholder="debug, refactor, deployment"
          value={tagsInput}
          onChange={(event) => setTagsInput(event.target.value)}
        />
        <button
          onClick={() =>
            onSaveTags(
              tagsInput
                .split(",")
                .map((tag) => tag.trim())
                .filter(Boolean)
            )
          }
          disabled={busy}
        >
          Save tags
        </button>
      </div>
      <div className="metadata-group metadata-group--facts">
        <div>
          <span>Repo</span>
          <strong>{session.repo_path || "Unknown"}</strong>
        </div>
        <div>
          <span>Model</span>
          <strong>{session.model || "Unknown"}</strong>
        </div>
        <div>
          <span>Entries</span>
          <strong>{session.entry_count}</strong>
        </div>
      </div>
      <div className="metadata-actions">
        <button onClick={() => onTogglePin(!session.pinned)} disabled={busy}>
          {session.pinned ? "Unpin session" : "Pin session"}
        </button>
        <button onClick={() => onToggleArchived(!session.archived)} disabled={busy}>
          {session.archived ? "Restore session" : "Hide session"}
        </button>
        <button onClick={onResume} disabled={busy}>
          Resume session
        </button>
      </div>
    </aside>
  );
}
