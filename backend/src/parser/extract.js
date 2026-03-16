import path from "node:path";

function isPlainObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function flattenText(value, parts = []) {
  if (value === null || value === undefined) {
    return parts;
  }

  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
    const text = String(value).trim();
    if (text) {
      parts.push(text);
    }
    return parts;
  }

  if (Array.isArray(value)) {
    for (const item of value) {
      flattenText(item, parts);
    }
    return parts;
  }

  if (isPlainObject(value)) {
    for (const [key, nestedValue] of Object.entries(value)) {
      if (key === "raw_json") {
        continue;
      }
      flattenText(nestedValue, parts);
    }
  }

  return parts;
}

function pickFirstString(candidateValues) {
  for (const value of candidateValues) {
    if (typeof value === "string" && value.trim()) {
      return value.trim();
    }
  }
  return null;
}

function parseJsonString(value) {
  if (typeof value !== "string") {
    return null;
  }

  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}

function collectContentText(content) {
  if (!Array.isArray(content)) {
    return "";
  }

  const texts = [];

  for (const item of content) {
    if (!item || typeof item !== "object") {
      continue;
    }

    if (typeof item.text === "string") {
      texts.push(item.text);
      continue;
    }

    if (typeof item.output_text === "string") {
      texts.push(item.output_text);
      continue;
    }

    if (typeof item.input_text === "string") {
      texts.push(item.input_text);
    }
  }

  return texts.join("\n\n").trim();
}

export function normalizeText(value) {
  return flattenText(value).join("\n").replace(/\n{3,}/g, "\n\n").trim();
}

export function extractTimestamp(entry) {
  return pickFirstString([
    entry.timestamp,
    entry.payload?.timestamp,
    entry.created_at,
    entry.updated_at,
    entry.time,
    entry.ts
  ]);
}

export function extractSessionId(filePath, entry) {
  return pickFirstString([
    entry.session_id,
    entry.sessionId,
    entry.id,
    entry.payload?.session_id,
    entry.payload?.sessionId,
    entry.payload?.id,
    entry.rollout_id,
    path.basename(filePath, path.extname(filePath))
  ]);
}

export function extractRepoPath(entry) {
  return pickFirstString([
    entry.repo_path,
    entry.repoPath,
    entry.cwd,
    entry.workdir,
    entry.workspace,
    entry.payload?.repo_path,
    entry.payload?.repoPath,
    entry.payload?.cwd,
    entry.payload?.workdir,
    entry.payload?.workspace,
    entry.context?.repo_path,
    entry.context?.cwd,
    entry.metadata?.repo_path,
    entry.metadata?.cwd
  ]);
}

export function extractModel(entry) {
  return pickFirstString([
    entry.model,
    entry.model_slug,
    entry.payload?.model,
    entry.payload?.model_slug,
    entry.payload?.model_provider,
    entry.metadata?.model,
    entry.context?.model
  ]);
}

export function deriveEntryType(entry) {
  const baseType = pickFirstString([
    entry.entry_type,
    entry.type,
    entry.kind,
    entry.event,
    entry.message_type,
    entry.tool_name ? "tool_call" : null
  ]) || "unknown";

  const payloadType = pickFirstString([
    entry.payload?.type,
    entry.payload?.kind
  ]);

  return payloadType ? `${baseType}:${payloadType}` : baseType;
}

export function deriveRole(entry) {
  return pickFirstString([
    entry.role,
    entry.actor,
    entry.author,
    entry.sender,
    entry.payload?.role
  ]);
}

export function extractCommand(entry) {
  const functionArgs = parseJsonString(entry.payload?.arguments);

  return normalizeText([
    entry.command,
    entry.command_text,
    entry.input,
    entry.tool_input?.command,
    entry.toolInvocation?.command,
    entry.shell?.command,
    functionArgs?.cmd,
    functionArgs?.command
  ]);
}

export function extractOutput(entry) {
  const parsedOutput = parseJsonString(entry.payload?.output);

  return normalizeText([
    entry.output,
    entry.stdout,
    entry.result,
    entry.tool_output,
    entry.shell?.stdout,
    entry.payload?.output,
    parsedOutput?.output,
    parsedOutput?.metadata?.stderr
  ]);
}

export function extractError(entry) {
  const parsedOutput = parseJsonString(entry.payload?.output);

  return normalizeText([
    entry.error,
    entry.stderr,
    entry.failure,
    entry.shell?.stderr,
    parsedOutput?.error,
    parsedOutput?.metadata?.error
  ]);
}

export function extractContent(entry) {
  const preferred = [
    entry.content,
    collectContentText(entry.content),
    entry.message,
    entry.text,
    entry.prompt,
    entry.reply,
    entry.response,
    entry.assistant_response,
    entry.user_message,
    entry.payload?.message,
    entry.payload?.text,
    collectContentText(entry.payload?.content),
    entry.data
  ];

  return normalizeText(preferred);
}

function cleanSummarySeed(text) {
  return String(text || "")
    .replace(/^message\s+user\s+input_text\s+/i, "")
    .replace(/^# AGENTS\.md instructions[^\n]*\n?/i, "")
    .replace(/<INSTRUCTIONS>[\s\S]*?<\/INSTRUCTIONS>\s*/i, "")
    .replace(/<environment_context>[\s\S]*?<\/environment_context>\s*/i, "")
    .trim();
}

function isBootstrapUserContent(text) {
  const value = String(text || "");
  return value.includes("# AGENTS.md instructions");
}

function firstReadableLine(text) {
  return cleanSummarySeed(text)
    .split(/\n+/)
    .map((line) => line.trim())
    .find((line) => {
      if (!line || line.length < 8) {
        return false;
      }

      return !/^<[^>]+>$/.test(line) && !/^##?\s/.test(line) && !/^###\s/.test(line);
    });
}

export function createAutoSummary(entries) {
  const userMessageEntry =
    entries.find(
      (entry) =>
        entry.entry_type === "response_item:message" &&
        entry.role === "user" &&
        entry.content &&
        !isBootstrapUserContent(entry.content)
    ) ||
    entries.find((entry) => entry.role === "user" && entry.content) ||
    entries.find((entry) => entry.entry_type.includes("user_message") && entry.content);

  const informativeEntry =
    userMessageEntry ||
    entries.find((entry) => entry.entry_type.includes("function_call") && entry.command_text) ||
    entries.find((entry) => entry.content || entry.command_text || entry.error_text);
  if (!informativeEntry) {
    return "Session with no extractable content";
  }

  const sourceText = informativeEntry.content || informativeEntry.command_text || informativeEntry.error_text;
  const summaryLine = firstReadableLine(sourceText);
  const cleanedText = cleanSummarySeed(sourceText);

  return (summaryLine || cleanedText || sourceText).slice(0, 220).replace(/\s+/g, " ").trim();
}

export function buildSearchText(entryRecord) {
  return [
    entryRecord.title,
    entryRecord.content,
    entryRecord.command_text,
    entryRecord.output_text,
    entryRecord.error_text
  ]
    .filter(Boolean)
    .join("\n\n")
    .trim();
}
