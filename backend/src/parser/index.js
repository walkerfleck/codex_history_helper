import fs from "node:fs";
import {
  buildSearchText,
  createAutoSummary,
  deriveEntryType,
  deriveRole,
  extractCommand,
  extractContent,
  extractError,
  extractModel,
  extractOutput,
  extractRepoPath,
  extractSessionId,
  extractTimestamp
} from "./extract.js";

function safeJsonParse(line) {
  try {
    return JSON.parse(line);
  } catch {
    return null;
  }
}

function titleFromEntry(entryType, role) {
  return [entryType, role].filter(Boolean).join(" / ") || "entry";
}

function shouldSuppressContent(entryType) {
  return (
    entryType === "session_meta" ||
    entryType === "turn_context" ||
    entryType.includes("function_call") ||
    entryType.includes("custom_tool_call")
  );
}

export function parseSessionFile(fileInfo) {
  const lines = fs.readFileSync(fileInfo.path, "utf8").split(/\r?\n/);
  const rawEntries = [];
  let sessionId = null;
  let repoPath = null;
  let model = null;
  let startedAt = null;
  let updatedAt = null;

  for (const line of lines) {
    if (!line.trim()) {
      continue;
    }

    const parsed = safeJsonParse(line);

    if (!parsed || typeof parsed !== "object") {
      rawEntries.push({
        timestamp: null,
        entry_type: "unparsed",
        role: null,
        title: "unparsed line",
        content: line,
        command_text: "",
        output_text: "",
        error_text: "",
        raw_json: JSON.stringify({ rawLine: line })
      });
      continue;
    }

    sessionId = sessionId || extractSessionId(fileInfo.path, parsed);
    repoPath = repoPath || extractRepoPath(parsed);
    model = model || extractModel(parsed);

    const timestamp = extractTimestamp(parsed);
    if (timestamp && !startedAt) {
      startedAt = timestamp;
    }
    if (timestamp) {
      updatedAt = timestamp;
    }

    const entryType = deriveEntryType(parsed);
    const role = deriveRole(parsed);
    const content = shouldSuppressContent(entryType) ? "" : extractContent(parsed);

    rawEntries.push({
      timestamp,
      entry_type: entryType,
      role,
      title:
        parsed.payload?.name && entryType.includes("function_call")
          ? `${entryType} / ${parsed.payload.name}`
          : titleFromEntry(entryType, role),
      content,
      command_text: extractCommand(parsed),
      output_text: extractOutput(parsed),
      error_text: extractError(parsed),
      raw_json: JSON.stringify(parsed)
    });
  }

  const entries = rawEntries.map((entry, index) => ({
    ...entry,
    entry_index: index,
    search_text: buildSearchText(entry)
  }));

  return {
    session: {
      session_id: sessionId || fileInfo.path,
      source_path: fileInfo.path,
      repo_path: repoPath,
      cwd: repoPath,
      model,
      started_at: startedAt,
      updated_at: updatedAt || startedAt,
      file_mtime_ms: Math.trunc(fileInfo.mtimeMs),
      entry_count: entries.length,
      auto_summary: createAutoSummary(entries)
    },
    entries
  };
}
