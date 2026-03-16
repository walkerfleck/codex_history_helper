import React from "react";

function TranscriptBlock({ label, text, className = "" }) {
  if (!text) return null;
  return (
    <div className={`transcript-block ${className}`}>
      <div className="transcript-block__label">{label}</div>
      <pre>{text}</pre>
    </div>
  );
}

function isAgentBootstrapUserMessage(entry) {
  return (
    entry.entry_type === "response_item:message" &&
    entry.role === "user" &&
    typeof entry.content === "string" &&
    entry.content.includes("# AGENTS.md instructions")
  );
}

function isCollapsedByDefault(entry) {
  if (entry.entry_type === "response_item:function_call_output") {
    return true;
  }

  if (entry.entry_type === "response_item:message" && entry.role === "developer") {
    return true;
  }

  return isAgentBootstrapUserMessage(entry);
}

function entryPreview(entry) {
  const source = entry.content || entry.command_text || entry.output_text || entry.error_text || "";
  const firstLine = source
    .split(/\n+/)
    .map((line) => line.trim())
    .find(Boolean);

  return firstLine ? firstLine.slice(0, 120) : "Hidden by default";
}

function EntryBody({ entry }) {
  return (
    <>
      <TranscriptBlock label="Content" text={entry.content} />
      <TranscriptBlock label="Command" text={entry.command_text} className="transcript-block--command" />
      <TranscriptBlock label="Output" text={entry.output_text} />
      <TranscriptBlock label="Error" text={entry.error_text} className="transcript-block--error" />
    </>
  );
}

export function TranscriptView({ session, entries }) {
  if (!session) {
    return <section className="panel panel--main empty-state">Select a session to view its transcript.</section>;
  }

  return (
    <section className="panel panel--main">
      <div className="panel__header">
        <div>
          <h2>{session.custom_summary || session.auto_summary || "Session transcript"}</h2>
          <p>{session.repo_path || "No repo path detected"}</p>
        </div>
      </div>
      <div className="transcript">
        {entries.map((entry) => (
          <article key={entry.id} className="entry-card">
            {isCollapsedByDefault(entry) ? (
              <details className="entry-collapse">
                <summary className="entry-card__header entry-card__header--summary">
                  <strong>{entry.title || entry.entry_type || "entry"}</strong>
                  <span>{entry.timestamp || "Unknown time"}</span>
                  <em>{entryPreview(entry)}</em>
                </summary>
                <div className="entry-collapse__body">
                  <EntryBody entry={entry} />
                </div>
              </details>
            ) : (
              <>
                <div className="entry-card__header">
                  <strong>{entry.title || entry.entry_type || "entry"}</strong>
                  <span>{entry.timestamp || "Unknown time"}</span>
                </div>
                <EntryBody entry={entry} />
              </>
            )}
          </article>
        ))}
      </div>
    </section>
  );
}
