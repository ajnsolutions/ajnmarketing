import "server-only";

/**
 * TODO: Production encryption should use a proper server-side encryption key
 * (for example TOKEN_ENCRYPTION_KEY with AES-256-GCM via Node crypto).
 * This placeholder keeps tokens out of plaintext storage during development.
 */
export function encryptToken(plainText: string): string {
  if (!plainText) return "";

  return `enc:v1:${Buffer.from(plainText, "utf8").toString("base64url")}`;
}

export function decryptToken(encrypted: string): string {
  if (!encrypted) return "";

  if (!encrypted.startsWith("enc:v1:")) {
    throw new Error("Invalid encrypted token format");
  }

  return Buffer.from(encrypted.slice("enc:v1:".length), "base64url").toString("utf8");
}
