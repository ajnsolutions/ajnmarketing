import "server-only";

export function logMarketContextProviderError(
  provider: string,
  message: string,
  error?: unknown
): void {
  const detail = error instanceof Error ? error.message : error ? String(error) : undefined;
  console.error(
    `[market-context:${provider}] ${message}${detail ? `: ${detail}` : ""}`
  );
}

export function logMarketContextProviderInfo(provider: string, message: string): void {
  console.info(`[market-context:${provider}] ${message}`);
}
