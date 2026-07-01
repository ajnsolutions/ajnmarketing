export const MAX_PUBLISHING_RETRIES = 3;

const BACKOFF_BASE_MS = 30_000;
const BACKOFF_MULTIPLIER = 4;

export function calculatePublishingRetryDelayMs(retryCount: number): number {
  return BACKOFF_BASE_MS * BACKOFF_MULTIPLIER ** Math.max(retryCount - 1, 0);
}

export function getPublishingRetryScheduledFor(retryCount: number, fromDate = new Date()): string {
  const delayMs = calculatePublishingRetryDelayMs(retryCount);
  return new Date(fromDate.getTime() + delayMs).toISOString();
}

export function shouldRetryPublishing(retryCount: number, maxRetries = MAX_PUBLISHING_RETRIES): boolean {
  return retryCount < maxRetries;
}

export function getRemainingPublishingRetries(
  retryCount: number,
  maxRetries = MAX_PUBLISHING_RETRIES
): number {
  return Math.max(maxRetries - retryCount, 0);
}
