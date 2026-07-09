/**
 * Thrown by googleApiFetch on any non-2xx response. Kept in its own module (no "server-only")
 * because it's a plain data class referenced from both server-only fetch code and shared
 * persistence helpers that are also imported by client components.
 */
export class GoogleApiError extends Error {
  readonly status: number;
  readonly googleStatus?: string;

  constructor(message: string, status: number, googleStatus?: string) {
    super(message);
    this.name = "GoogleApiError";
    this.status = status;
    this.googleStatus = googleStatus;
  }
}
