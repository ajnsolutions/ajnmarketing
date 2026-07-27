/**
 * Anonymous, pre-auth draft decisions — sessionStorage only, keyed by the
 * opaque snapshotReference. These are never sent to any server; they exist
 * purely so a visitor's "That's right" / "Let me correct it" clicks on the
 * public Snapshot page aren't lost the moment they navigate to sign up.
 *
 * After authentication, Guided Onboarding's Snapshot review step reads these
 * back to pre-select the same choices — the visitor still takes one real,
 * explicit "Save my answers" action post-auth (see
 * components/onboarding/snapshot-review-step.tsx) before anything is
 * actually confirmed via PR #75's server contract. Merely having a draft
 * decision stored here is never treated as confirmation.
 *
 * Session-only (not localStorage) is deliberate: these are throwaway,
 * single-session preferences, not something that should silently persist
 * across visits or devices.
 */

import type { DraftDecisionMap } from "@/lib/snapshot-ui/types";

function storageKey(snapshotReference: string): string {
  return `ajn:snapshot-draft:${snapshotReference}`;
}

export function saveDraftDecisions(snapshotReference: string, decisions: DraftDecisionMap): void {
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.setItem(storageKey(snapshotReference), JSON.stringify(decisions));
  } catch {
    // Storage can fail (private browsing, quota) — draft decisions are a nice-to-have, never required.
  }
}

export function loadDraftDecisions(snapshotReference: string): DraftDecisionMap {
  if (typeof window === "undefined") return {};
  try {
    const raw = window.sessionStorage.getItem(storageKey(snapshotReference));
    if (!raw) return {};
    return JSON.parse(raw) as DraftDecisionMap;
  } catch {
    return {};
  }
}

export function clearDraftDecisions(snapshotReference: string): void {
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.removeItem(storageKey(snapshotReference));
  } catch {
    // Non-fatal.
  }
}
