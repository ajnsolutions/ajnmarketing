/**
 * Defense-in-depth redaction for anything written to .ai/exports/ — these
 * files are meant to be pasted into ChatGPT or another external tool, so
 * they must never carry a secret even by accident. This is a safety net,
 * not a substitute for not putting secrets in .ai/ memory files in the
 * first place.
 */
const PATTERNS: RegExp[] = [
  /sk-[A-Za-z0-9_-]{16,}/g, // OpenAI-style secret keys
  /sbp_[A-Za-z0-9]{16,}/g, // Supabase-style tokens
  /eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}/g, // JWT-shaped strings
  /(ghp|gho|ghu|ghs|ghr)_[A-Za-z0-9]{20,}/g, // GitHub tokens
  /-----BEGIN [A-Z ]*PRIVATE KEY-----[\s\S]*?-----END [A-Z ]*PRIVATE KEY-----/g,
  /Bearer\s+[A-Za-z0-9._-]{16,}/g,
];

export function redactSecrets(text: string): string {
  let result = text;
  for (const pattern of PATTERNS) {
    result = result.replace(pattern, "[REDACTED]");
  }
  return result;
}
