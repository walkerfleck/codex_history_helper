import React, { useEffect, useState } from "react";
import { api } from "./api.js";
import { MetadataPanel } from "./components/MetadataPanel.jsx";
import { SearchResults } from "./components/SearchResults.jsx";
import { SessionList } from "./components/SessionList.jsx";
import { Toolbar } from "./components/Toolbar.jsx";
import { TranscriptView } from "./components/TranscriptView.jsx";

export default function App() {
  const [activeTab, setActiveTab] = useState("sessions");
  const [sessions, setSessions] = useState([]);
  const [repos, setRepos] = useState([]);
  const [repoFilter, setRepoFilter] = useState("");
  const [includeArchived, setIncludeArchived] = useState(false);
  const [query, setQuery] = useState("");
  const [searchResults, setSearchResults] = useState([]);
  const [selectedSessionId, setSelectedSessionId] = useState("");
  const [selectedSession, setSelectedSession] = useState(null);
  const [entries, setEntries] = useState([]);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  async function loadSessions(currentRepo = repoFilter) {
    const payload = await api.getSessions(currentRepo, includeArchived);
    setSessions(payload.sessions);
    setRepos(payload.repos);
    const stillVisible = payload.sessions.some((session) => session.session_id === selectedSessionId);
    if (payload.sessions[0] && (!selectedSessionId || !stillVisible)) {
      setSelectedSessionId(payload.sessions[0].session_id);
      return;
    }

    if (!payload.sessions.length) {
      setSelectedSessionId("");
      setSelectedSession(null);
      setEntries([]);
    }
  }

  async function loadSession(sessionId) {
    if (!sessionId) return;
    const payload = await api.getSession(sessionId);
    setSelectedSession(payload.session);
    setEntries(payload.entries);
  }

  useEffect(() => {
    loadSessions().catch((error) => setMessage(error.message));
  }, []);

  useEffect(() => {
    loadSessions(repoFilter).catch((error) => setMessage(error.message));
  }, [repoFilter, includeArchived]);

  useEffect(() => {
    loadSession(selectedSessionId).catch((error) => setMessage(error.message));
  }, [selectedSessionId]);

  useEffect(() => {
    const trimmed = query.trim();
    if (!trimmed) {
      setSearchResults([]);
      return;
    }

    const handle = setTimeout(() => {
          api
        .search(trimmed, repoFilter, includeArchived)
        .then((payload) => {
          setSearchResults(payload.results);
          setActiveTab("search");
        })
        .catch((error) => setMessage(error.message));
    }, 180);

    return () => clearTimeout(handle);
  }, [query, repoFilter, includeArchived]);

  async function withRefresh(task, successMessage) {
    setBusy(true);
    setMessage("");
    try {
      await task();
      await loadSessions(repoFilter);
      await loadSession(selectedSessionId);
      if (successMessage) {
        setMessage(successMessage);
      }
    } catch (error) {
      setMessage(error.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="app-shell">
      <Toolbar
        activeTab={activeTab}
        onTabChange={setActiveTab}
        query={query}
        onQueryChange={setQuery}
        repos={repos}
        repoFilter={repoFilter}
        onRepoFilterChange={setRepoFilter}
        includeArchived={includeArchived}
        onIncludeArchivedChange={setIncludeArchived}
        onReindex={() =>
          withRefresh(async () => {
            await api.reindex();
          }, "Reindex complete")
        }
        busy={busy}
      />
      {message ? <div className="status-bar">{message}</div> : null}
      <main className="layout">
        <aside className="panel panel--left">
          {activeTab === "search" ? (
            <SearchResults
              results={searchResults}
              selectedSessionId={selectedSessionId}
              onSelect={setSelectedSessionId}
            />
          ) : (
            <SessionList
              sessions={sessions}
              selectedSessionId={selectedSessionId}
              onSelect={setSelectedSessionId}
            />
          )}
        </aside>
        <TranscriptView session={selectedSession} entries={entries} />
        <MetadataPanel
          session={selectedSession}
          busy={busy}
          onSaveSummary={(summary) =>
            withRefresh(async () => {
              await api.saveSummary(selectedSessionId, summary);
            }, "Summary saved")
          }
          onSaveTags={(tags) =>
            withRefresh(async () => {
              await api.saveTags(selectedSessionId, tags);
            }, "Tags saved")
          }
          onTogglePin={(pinned) =>
            withRefresh(async () => {
              await api.setPinned(selectedSessionId, pinned);
            }, pinned ? "Session pinned" : "Session unpinned")
          }
          onToggleArchived={(archived) =>
            withRefresh(async () => {
              await api.setArchived(selectedSessionId, archived);
            }, archived ? "Session hidden" : "Session restored")
          }
          onResume={() =>
            withRefresh(async () => {
              const result = await api.resume(selectedSessionId);
              setMessage(`Resume command launched: ${result.command}`);
            })
          }
        />
      </main>
    </div>
  );
}
