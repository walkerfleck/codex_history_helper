import { spawn, spawnSync } from "node:child_process";
import { config } from "../config.js";

const terminalCandidates = [
  { bin: "x-terminal-emulator", args: (sessionId) => ["-e", "codex", "resume", sessionId] },
  { bin: "gnome-terminal", args: (sessionId) => ["--", "codex", "resume", sessionId] },
  { bin: "konsole", args: (sessionId) => ["-e", "codex", "resume", sessionId] },
  { bin: "xfce4-terminal", args: (sessionId) => ["-x", "codex", "resume", sessionId] },
  { bin: "kitty", args: (sessionId) => ["codex", "resume", sessionId] }
];

function hasExecutable(bin) {
  const result = spawnSync("which", [bin], { stdio: "ignore" });
  return result.status === 0;
}

function parseConfiguredTerminal(configuredValue, sessionId) {
  const parts = configuredValue.split(/\s+/).filter(Boolean);
  if (parts.length === 0) {
    return null;
  }

  return {
    bin: parts[0],
    args: [...parts.slice(1), "codex", "resume", sessionId]
  };
}

export function resumeSession(sessionId) {
  const configured = config.resumeTerminal ? parseConfiguredTerminal(config.resumeTerminal, sessionId) : null;
  const candidate = configured || terminalCandidates.find((entry) => hasExecutable(entry.bin));

  if (!candidate) {
    throw new Error("No supported terminal emulator found. Set CODEX_RESUME_TERMINAL to override.");
  }

  const bin = candidate.bin;
  const args = configured ? candidate.args : candidate.args(sessionId);

  const child = spawn(bin, args, {
    detached: true,
    stdio: "ignore"
  });

  child.unref();

  return {
    ok: true,
    command: [bin, ...args].join(" ")
  };
}
