import fs from "node:fs";
import path from "node:path";

export function ensureDirSync(dirPath) {
  fs.mkdirSync(dirPath, { recursive: true });
}

export function walkJsonlFiles(rootDir) {
  const results = [];

  if (!fs.existsSync(rootDir)) {
    return results;
  }

  const stack = [rootDir];

  while (stack.length > 0) {
    const currentDir = stack.pop();
    const items = fs.readdirSync(currentDir, { withFileTypes: true });

    for (const item of items) {
      const fullPath = path.join(currentDir, item.name);

      if (item.isDirectory()) {
        stack.push(fullPath);
        continue;
      }

      if (item.isFile() && item.name.endsWith(".jsonl")) {
        const stats = fs.statSync(fullPath);
        results.push({
          path: fullPath,
          size: stats.size,
          mtimeMs: stats.mtimeMs
        });
      }
    }
  }

  results.sort((left, right) => right.mtimeMs - left.mtimeMs);
  return results;
}
