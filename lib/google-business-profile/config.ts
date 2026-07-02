import "server-only";

import { isTokenEncryptionConfigured } from "@/lib/security/token-encryption";

export const GOOGLE_OAUTH_ENV_KEYS = [
  "GOOGLE_CLIENT_ID",
  "GOOGLE_CLIENT_SECRET",
  "GOOGLE_REDIRECT_URI",
] as const;

export const GOOGLE_CONNECTION_STORAGE_ENV_KEYS = ["TOKEN_ENCRYPTION_KEY"] as const;

export type GoogleBusinessEnvKey =
  | (typeof GOOGLE_OAUTH_ENV_KEYS)[number]
  | (typeof GOOGLE_CONNECTION_STORAGE_ENV_KEYS)[number];

export type GoogleBusinessServerConfigStatus = {
  oauthConfigured: boolean;
  connectionStorageConfigured: boolean;
  present: GoogleBusinessEnvKey[];
  missing: GoogleBusinessEnvKey[];
  invalid: GoogleBusinessEnvKey[];
  oauthMissing: GoogleBusinessEnvKey[];
  storageMissing: GoogleBusinessEnvKey[];
  storageInvalid: GoogleBusinessEnvKey[];
};

function readEnv(name: string): string {
  return process.env[name]?.trim() ?? "";
}

function inspectOAuthEnvKey(name: (typeof GOOGLE_OAUTH_ENV_KEYS)[number]): "present" | "missing" {
  return readEnv(name) ? "present" : "missing";
}

function inspectTokenEncryptionEnvKey(): "present" | "missing" | "invalid" {
  const raw = readEnv("TOKEN_ENCRYPTION_KEY");
  if (!raw) return "missing";
  if (!isTokenEncryptionConfigured()) return "invalid";
  return "present";
}

export function inspectGoogleBusinessServerConfig(): GoogleBusinessServerConfigStatus {
  const oauthMissing = GOOGLE_OAUTH_ENV_KEYS.filter(
    (key) => inspectOAuthEnvKey(key) === "missing"
  );
  const oauthPresent = GOOGLE_OAUTH_ENV_KEYS.filter(
    (key) => inspectOAuthEnvKey(key) === "present"
  );

  const tokenEncryptionState = inspectTokenEncryptionEnvKey();
  const storageMissing: GoogleBusinessEnvKey[] =
    tokenEncryptionState === "missing" ? ["TOKEN_ENCRYPTION_KEY"] : [];
  const storageInvalid: GoogleBusinessEnvKey[] =
    tokenEncryptionState === "invalid" ? ["TOKEN_ENCRYPTION_KEY"] : [];
  const storagePresent: GoogleBusinessEnvKey[] =
    tokenEncryptionState === "present" ? ["TOKEN_ENCRYPTION_KEY"] : [];

  const present = [...oauthPresent, ...storagePresent];
  const missing = [...oauthMissing, ...storageMissing];
  const invalid = [...storageInvalid];

  return {
    oauthConfigured: oauthMissing.length === 0,
    connectionStorageConfigured: tokenEncryptionState === "present",
    present,
    missing,
    invalid,
    oauthMissing,
    storageMissing,
    storageInvalid,
  };
}

export function logGoogleBusinessServerConfig(context: string): GoogleBusinessServerConfigStatus {
  const status = inspectGoogleBusinessServerConfig();

  if (status.oauthConfigured && status.connectionStorageConfigured) {
    console.info(`[google-business-config] ${context}: all required server config present`, {
      present: status.present,
    });
    return status;
  }

  console.warn(`[google-business-config] ${context}: required server config incomplete`, {
    present: status.present,
    missing: status.missing,
    invalid: status.invalid,
    oauthConfigured: status.oauthConfigured,
    connectionStorageConfigured: status.connectionStorageConfigured,
  });

  return status;
}
