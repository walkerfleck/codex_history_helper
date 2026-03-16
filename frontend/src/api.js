async function request(path, options = {}) {
  const response = await fetch(path, {
    headers: {
      "Content-Type": "application/json"
    },
    ...options
  });

  if (!response.ok) {
    const payload = await response.json().catch(() => ({}));
    throw new Error(payload.error || `Request failed: ${response.status}`);
  }

  return response.json();
}

export const api = {
  getSessions(repo, includeArchived = false) {
    const query = repo ? `?repo=${encodeURIComponent(repo)}` : "";
    const params = new URLSearchParams(query.replace(/^\?/, ""));
    if (includeArchived) params.set("includeArchived", "1");
    const suffix = params.toString() ? `?${params.toString()}` : "";
    return request(`/api/sessions${suffix}`);
  },
  getSession(sessionId) {
    return request(`/api/sessions/${encodeURIComponent(sessionId)}`);
  },
  search(query, repo, includeArchived = false) {
    const params = new URLSearchParams();
    if (query) params.set("q", query);
    if (repo) params.set("repo", repo);
    if (includeArchived) params.set("includeArchived", "1");
    return request(`/api/search?${params.toString()}`);
  },
  saveSummary(sessionId, summary) {
    return request(`/api/sessions/${encodeURIComponent(sessionId)}/summary`, {
      method: "POST",
      body: JSON.stringify({ summary })
    });
  },
  saveTags(sessionId, tags) {
    return request(`/api/sessions/${encodeURIComponent(sessionId)}/tags`, {
      method: "POST",
      body: JSON.stringify({ tags })
    });
  },
  setPinned(sessionId, pinned) {
    return request(`/api/sessions/${encodeURIComponent(sessionId)}/pin`, {
      method: "POST",
      body: JSON.stringify({ pinned })
    });
  },
  setArchived(sessionId, archived) {
    return request(`/api/sessions/${encodeURIComponent(sessionId)}/hide`, {
      method: "POST",
      body: JSON.stringify({ archived })
    });
  },
  resume(sessionId) {
    return request(`/api/sessions/${encodeURIComponent(sessionId)}/resume`, {
      method: "POST"
    });
  },
  reindex() {
    return request("/api/reindex", { method: "POST" });
  }
};
