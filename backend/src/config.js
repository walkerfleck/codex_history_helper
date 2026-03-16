import os from "node:os";
import path from "node:path";

const projectRoot = path.resolve(path.dirname(new URL(import.meta.url).pathname), "../..");
const defaultSessionsDir = path.join(os.homedir(), ".codex", "sessions");
const dataDir = path.join(projectRoot, "data");

export const config = {
  projectRoot,
  dataDir,
  dbPath: process.env.CODEX_HISTORY_DB_PATH || path.join(dataDir, "history.db"),
  sessionsDir: process.env.CODEX_SESSIONS_DIR || defaultSessionsDir,
  port: Number(process.env.PORT || 3123),
  frontendDistDir: path.join(projectRoot, "frontend", "dist"),
  frontendSourceDir: path.join(projectRoot, "frontend"),
  resumeTerminal: process.env.CODEX_RESUME_TERMINAL || "",
  maxSessionRows: 500
};
