import test from "node:test";
import assert from "node:assert/strict";
import { clearDraftDecisions, loadDraftDecisions, saveDraftDecisions } from "../lib/snapshot-ui/decisionStorage.ts";

function fakeSessionStorage() {
  const store = new Map<string, string>();
  return {
    getItem: (key: string) => store.get(key) ?? null,
    setItem: (key: string, value: string) => {
      store.set(key, value);
    },
    removeItem: (key: string) => {
      store.delete(key);
    },
  };
}

test("no-ops safely with no thrown error when there is no window (this test's real environment)", () => {
  assert.equal(typeof window, "undefined");
  assert.doesNotThrow(() => saveDraftDecisions("ref-1", { primaryServices: { insightKey: "primaryServices" as never, decision: "confirm" as never } }));
  assert.deepEqual(loadDraftDecisions("ref-1"), {});
  assert.doesNotThrow(() => clearDraftDecisions("ref-1"));
});

test("round-trips a saved decision map through sessionStorage when a window is present", () => {
  (globalThis as { window?: unknown }).window = { sessionStorage: fakeSessionStorage() };
  try {
    const decisions = { primaryServices: { insightKey: "primaryServices" as never, decision: "confirm" as never } };
    saveDraftDecisions("ref-abc", decisions);
    assert.deepEqual(loadDraftDecisions("ref-abc"), decisions);
  } finally {
    delete (globalThis as { window?: unknown }).window;
  }
});

test("different references never share draft decisions", () => {
  (globalThis as { window?: unknown }).window = { sessionStorage: fakeSessionStorage() };
  try {
    saveDraftDecisions("ref-a", { primaryServices: { insightKey: "primaryServices" as never, decision: "confirm" as never } });
    saveDraftDecisions("ref-b", { primaryServices: { insightKey: "primaryServices" as never, decision: "reject" as never } });
    assert.equal(loadDraftDecisions("ref-a").primaryServices?.decision, "confirm");
    assert.equal(loadDraftDecisions("ref-b").primaryServices?.decision, "reject");
  } finally {
    delete (globalThis as { window?: unknown }).window;
  }
});

test("clearDraftDecisions removes only the specified reference's drafts", () => {
  (globalThis as { window?: unknown }).window = { sessionStorage: fakeSessionStorage() };
  try {
    saveDraftDecisions("ref-a", { primaryServices: { insightKey: "primaryServices" as never, decision: "confirm" as never } });
    saveDraftDecisions("ref-b", { primaryServices: { insightKey: "primaryServices" as never, decision: "confirm" as never } });
    clearDraftDecisions("ref-a");
    assert.deepEqual(loadDraftDecisions("ref-a"), {});
    assert.notDeepEqual(loadDraftDecisions("ref-b"), {});
  } finally {
    delete (globalThis as { window?: unknown }).window;
  }
});

test("loadDraftDecisions returns an empty object for corrupted stored JSON, never throws", () => {
  const storage = fakeSessionStorage();
  storage.setItem("ajn:snapshot-draft:ref-broken", "{not valid json");
  (globalThis as { window?: unknown }).window = { sessionStorage: storage };
  try {
    assert.deepEqual(loadDraftDecisions("ref-broken"), {});
  } finally {
    delete (globalThis as { window?: unknown }).window;
  }
});
