import "server-only";

import { createCipheriv, createDecipheriv, randomBytes } from "crypto";

const LEGACY_PREFIX = "enc:v1:";
const CURRENT_PREFIX = "enc:v2:";
const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 12;
const AUTH_TAG_LENGTH = 16;

export class TokenEncryptionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "TokenEncryptionError";
  }
}

/**
 * Generate a production encryption key:
 *
 *   openssl rand -hex 32
 *
 * Add the output to your server environment only (for example `.env.local`):
 *
 *   TOKEN_ENCRYPTION_KEY=<64-character-hex-string>
 *
 * The key must be exactly 32 bytes (64 hex characters, or 44-character base64).
 * Never expose this value to the client or commit it to version control.
 */
export const TOKEN_ENCRYPTION_KEY_HELP =
  "Set TOKEN_ENCRYPTION_KEY in your server environment. Generate one with: openssl rand -hex 32";

export function isTokenEncryptionConfigured(): boolean {
  const raw = process.env.TOKEN_ENCRYPTION_KEY?.trim();
  if (!raw) return false;

  if (/^[0-9a-fA-F]{64}$/.test(raw)) {
    return true;
  }

  return Buffer.from(raw, "base64").length === 32;
}

function resolveEncryptionKey(): Buffer {
  const raw = process.env.TOKEN_ENCRYPTION_KEY?.trim();

  if (!raw) {
    throw new TokenEncryptionError(
      `Token encryption is not configured. ${TOKEN_ENCRYPTION_KEY_HELP}`
    );
  }

  if (/^[0-9a-fA-F]{64}$/.test(raw)) {
    return Buffer.from(raw, "hex");
  }

  const base64Key = Buffer.from(raw, "base64");
  if (base64Key.length === 32) {
    return base64Key;
  }

  throw new TokenEncryptionError(
    "TOKEN_ENCRYPTION_KEY must be 32 bytes (use `openssl rand -hex 32`)."
  );
}

function encryptLegacy(plainText: string): string {
  return `${LEGACY_PREFIX}${Buffer.from(plainText, "utf8").toString("base64url")}`;
}

function decryptLegacy(encrypted: string): string {
  if (!encrypted.startsWith(LEGACY_PREFIX)) {
    throw new TokenEncryptionError("Invalid encrypted token format");
  }

  return Buffer.from(encrypted.slice(LEGACY_PREFIX.length), "base64url").toString("utf8");
}

function encryptWithAesGcm(plainText: string): string {
  const key = resolveEncryptionKey();
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv(ALGORITHM, key, iv);

  const ciphertext = Buffer.concat([cipher.update(plainText, "utf8"), cipher.final()]);
  const authTag = cipher.getAuthTag();

  const payload = Buffer.concat([iv, authTag, ciphertext]).toString("base64url");
  return `${CURRENT_PREFIX}${payload}`;
}

function decryptWithAesGcm(encrypted: string): string {
  const key = resolveEncryptionKey();
  const payload = Buffer.from(encrypted.slice(CURRENT_PREFIX.length), "base64url");

  if (payload.length <= IV_LENGTH + AUTH_TAG_LENGTH) {
    throw new TokenEncryptionError("Invalid encrypted token payload");
  }

  const iv = payload.subarray(0, IV_LENGTH);
  const authTag = payload.subarray(IV_LENGTH, IV_LENGTH + AUTH_TAG_LENGTH);
  const ciphertext = payload.subarray(IV_LENGTH + AUTH_TAG_LENGTH);

  const decipher = createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(authTag);

  return Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString("utf8");
}

export function encryptToken(plainText: string): string {
  if (!plainText) return "";

  if (!process.env.TOKEN_ENCRYPTION_KEY?.trim()) {
    throw new TokenEncryptionError(
      `Cannot encrypt OAuth tokens without TOKEN_ENCRYPTION_KEY. ${TOKEN_ENCRYPTION_KEY_HELP}`
    );
  }

  return encryptWithAesGcm(plainText);
}

export function decryptToken(encrypted: string): string {
  if (!encrypted) return "";

  if (encrypted.startsWith(LEGACY_PREFIX)) {
    return decryptLegacy(encrypted);
  }

  if (encrypted.startsWith(CURRENT_PREFIX)) {
    return decryptWithAesGcm(encrypted);
  }

  throw new TokenEncryptionError("Unsupported encrypted token format");
}

/** @internal Test helper for legacy token compatibility. */
export function encryptTokenLegacy(plainText: string): string {
  return encryptLegacy(plainText);
}
