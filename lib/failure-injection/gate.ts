/**
 * Failure injection is for controlled recovery testing only.
 * It MUST never activate in production deployments.
 */

export const FailureInjectionFaults = {
  OPENAI_OUTAGE: "openai_outage",
  GOOGLE_FAILURE: "google_failure",
  OAUTH_EXPIRED: "oauth_expired",
  PUBLISHING_REJECTION: "publishing_rejection",
  ANALYTICS_TIMEOUT: "analytics_timeout",
  NETWORK_INTERRUPTION: "network_interruption",
  DATABASE_RETRY: "database_retry",
  DUPLICATE_RECOMMENDATION_EXECUTION: "duplicate_recommendation_execution",
  DUPLICATE_APPROVAL: "duplicate_approval",
  DUPLICATE_PUBLISH: "duplicate_publish",
} as const;

export type FailureInjectionFault =
  (typeof FailureInjectionFaults)[keyof typeof FailureInjectionFaults];

export type FailureInjectionState = {
  enabled: boolean;
  reasonDisabled: string | null;
  activeFaults: FailureInjectionFault[];
};

export function isFailureInjectionAllowed(env: NodeJS.ProcessEnv = process.env): boolean {
  if (env.VERCEL_ENV === "production") return false;
  if (env.NODE_ENV === "production" && env.ALLOW_FAILURE_INJECTION !== "true") return false;
  if (env.FAILURE_INJECTION_ENABLED !== "true") return false;
  if (env.ATTACH_DECLARATIVE_PRODUCTION_CRONS === "true") return false;
  return true;
}

export function parseActiveFaults(raw: string | undefined): FailureInjectionFault[] {
  if (!raw?.trim()) return [];
  const allowed = new Set<string>(Object.values(FailureInjectionFaults));
  return raw
    .split(",")
    .map((part) => part.trim())
    .filter((part): part is FailureInjectionFault => allowed.has(part));
}

export function getFailureInjectionState(env: NodeJS.ProcessEnv = process.env): FailureInjectionState {
  if (!isFailureInjectionAllowed(env)) {
    return {
      enabled: false,
      reasonDisabled:
        env.VERCEL_ENV === "production" || env.NODE_ENV === "production"
          ? "Disabled in production."
          : "Set FAILURE_INJECTION_ENABLED=true only in non-production environments.",
      activeFaults: [],
    };
  }

  return {
    enabled: true,
    reasonDisabled: null,
    activeFaults: parseActiveFaults(env.FAILURE_INJECTION_FAULTS),
  };
}

export function isFaultActive(
  fault: FailureInjectionFault,
  env: NodeJS.ProcessEnv = process.env
): boolean {
  const state = getFailureInjectionState(env);
  return state.enabled && state.activeFaults.includes(fault);
}

export class InjectedFailureError extends Error {
  fault: FailureInjectionFault;

  constructor(fault: FailureInjectionFault, message?: string) {
    super(message ?? `Injected failure: ${fault}`);
    this.name = "InjectedFailureError";
    this.fault = fault;
  }
}

/** Throws when the named fault is active; no-op otherwise. */
export function maybeInjectFailure(
  fault: FailureInjectionFault,
  env: NodeJS.ProcessEnv = process.env
): void {
  if (!isFaultActive(fault, env)) return;
  throw new InjectedFailureError(fault);
}
