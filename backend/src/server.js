import express from "express";
import path from "node:path";
import { config } from "./config.js";
import "./db/index.js";
import { scanAndIndexSessions } from "./indexer/indexer.js";
import { createApiRouter } from "./routes/api.js";

const app = express();

app.use(express.json({ limit: "2mb" }));
app.use("/api", createApiRouter());

app.get("/app.js", (_req, res) => {
  res.sendFile(path.join(config.frontendDistDir, "app.js"));
});

app.get("/app.css", (_req, res) => {
  res.sendFile(path.join(config.projectRoot, "frontend", "src", "styles", "app.css"));
});

app.get("*", (_req, res) => {
  res.sendFile(path.join(config.frontendSourceDir, "index.html"));
});

const indexResult = scanAndIndexSessions(config.sessionsDir);
app.locals.indexResult = indexResult;

app.listen(config.port, () => {
  console.log(`Codex History Helper running on http://localhost:${config.port}`);
  console.log(`Indexed ${indexResult.indexedCount} of ${indexResult.totalFiles} session files on startup.`);
});
