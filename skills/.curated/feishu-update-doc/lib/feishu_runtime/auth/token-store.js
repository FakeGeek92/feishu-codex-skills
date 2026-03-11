import { mkdir, readFile, rm, writeFile, chmod } from "node:fs/promises";
import { join } from "node:path";
import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

const KEY_BYTES = 32;
const IV_BYTES = 12;
const TAG_BYTES = 16;
const REFRESH_AHEAD_MS = 5 * 60 * 1000;

function safeName(value) {
  return value.replace(/[^a-zA-Z0-9._-]/g, "_");
}

async function ensureDir(dir) {
  await mkdir(dir, { recursive: true, mode: 0o700 });
}

async function ensureMasterKey(baseDir) {
  const keyPath = join(baseDir, "master.key");
  try {
    const key = await readFile(keyPath);
    if (key.length === KEY_BYTES) {
      return key;
    }
  } catch {
    // fall through
  }

  await ensureDir(baseDir);
  const key = randomBytes(KEY_BYTES);
  await writeFile(keyPath, key, { mode: 0o600 });
  await chmod(keyPath, 0o600);
  return key;
}

function encrypt(plaintext, key) {
  const iv = randomBytes(IV_BYTES);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  return Buffer.concat([iv, cipher.getAuthTag(), encrypted]);
}

function decrypt(payload, key) {
  if (payload.length < IV_BYTES + TAG_BYTES) {
    return null;
  }

  try {
    const iv = payload.subarray(0, IV_BYTES);
    const tag = payload.subarray(IV_BYTES, IV_BYTES + TAG_BYTES);
    const encrypted = payload.subarray(IV_BYTES + TAG_BYTES);
    const decipher = createDecipheriv("aes-256-gcm", key, iv);
    decipher.setAuthTag(tag);
    return Buffer.concat([decipher.update(encrypted), decipher.final()]).toString("utf8");
  } catch {
    return null;
  }
}

function tokenFilePath(baseDir, appId, userOpenId) {
  return join(baseDir, "tokens", `${safeName(appId)}__${safeName(userOpenId)}.enc`);
}

export function tokenStatus(token, now = Date.now()) {
  if (!token) {
    return "missing";
  }
  if (now < token.expiresAt - REFRESH_AHEAD_MS) {
    return "valid";
  }
  if (now < token.refreshExpiresAt) {
    return "needs_refresh";
  }
  return "expired";
}

export function createTokenStore(options = {}) {
  const baseDir = options.baseDir;

  return {
    async get(appId, userOpenId) {
      try {
        const key = await ensureMasterKey(baseDir);
        const encrypted = await readFile(tokenFilePath(baseDir, appId, userOpenId));
        const plaintext = decrypt(encrypted, key);
        return plaintext ? JSON.parse(plaintext) : null;
      } catch {
        return null;
      }
    },

    async set(token) {
      const key = await ensureMasterKey(baseDir);
      const filePath = tokenFilePath(baseDir, token.appId, token.userOpenId);
      await ensureDir(join(baseDir, "tokens"));
      await writeFile(filePath, encrypt(JSON.stringify(token), key), { mode: 0o600 });
      await chmod(filePath, 0o600);
    },

    async remove(appId, userOpenId) {
      await rm(tokenFilePath(baseDir, appId, userOpenId), { force: true });
    }
  };
}
