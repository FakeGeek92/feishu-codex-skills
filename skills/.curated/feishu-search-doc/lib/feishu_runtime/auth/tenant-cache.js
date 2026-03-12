import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";

const REFRESH_AHEAD_MS = 60 * 1000;

async function ensureDir(dir) {
  await mkdir(dir, { recursive: true, mode: 0o700 });
}

async function readJson(filePath) {
  try {
    return JSON.parse(await readFile(filePath, "utf8"));
  } catch {
    return {};
  }
}

export function createTenantTokenCache(options = {}) {
  const baseDir = options.baseDir;
  const filePath = join(baseDir, "tenant-cache.json");

  return {
    async get(appId) {
      const content = await readJson(filePath);
      const token = content[appId];
      if (!token) {
        return null;
      }
      if (Date.now() >= token.expiresAt - REFRESH_AHEAD_MS) {
        return null;
      }
      return token;
    },

    async set(appId, token) {
      await ensureDir(baseDir);
      const content = await readJson(filePath);
      content[appId] = token;
      await writeFile(filePath, JSON.stringify(content, null, 2));
    }
  };
}
