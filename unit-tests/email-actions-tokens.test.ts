import test from "node:test";
import assert from "node:assert/strict";
import {
  EmailActionTokenError,
  buildEmailActionAbsoluteUrl,
  buildEmailActionOpenPath,
  createEmailActionToken,
  verifyEmailActionToken,
} from "../lib/email-actions/tokens.ts";
import { createWeeklyPackageSignedToken } from "../lib/weekly-approval-package/signedLinks.ts";

function withEnv(vars: Record<string, string | undefined>, fn: () => void | Promise<void>) {
  const originals: Record<string, string | undefined> = {};
  for (const key of Object.keys(vars)) {
    originals[key] = process.env[key];
    if (vars[key] === undefined) delete process.env[key];
    else process.env[key] = vars[key];
  }
  return Promise.resolve(fn()).finally(() => {
    for (const key of Object.keys(originals)) {
      if (originals[key] === undefined) delete process.env[key];
      else process.env[key] = originals[key];
    }
  });
}

const SIGNING_ENV = { EMAIL_ACTION_TOKEN_SECRET: "1".repeat(64), TOKEN_ENCRYPTION_KEY: "0".repeat(64) };
const USER = "user-1";
const BIZ = "biz-1";
const EMAIL = "owner@example.com";

test("createEmailActionToken + verifyEmailActionToken: round trip for approve", async () => {
  await withEnv(SIGNING_ENV, () => {
    const now = new Date("2026-07-14T12:00:00.000Z");
    const token = createEmailActionToken({
      action: "approve",
      userId: USER,
      businessProfileId: BIZ,
      emailRecipient: EMAIL,
      contentApprovalId: "ca-1",
      now,
    });

    const payload = verifyEmailActionToken(token, now);
    assert.equal(payload.action, "approve");
    assert.equal(payload.userId, USER);
    assert.equal(payload.businessProfileId, BIZ);
    assert.equal(payload.contentApprovalId, "ca-1");
    assert.equal(payload.emailRecipient, EMAIL);
    assert.equal(payload.tokenVersion, 1);
    assert.ok(payload.nonce);
  });
});

test("createEmailActionToken: approve_all requires a non-empty contentApprovalIds snapshot", async () => {
  await withEnv(SIGNING_ENV, () => {
    assert.throws(
      () =>
        createEmailActionToken({
          action: "approve_all",
          userId: USER,
          businessProfileId: BIZ,
          emailRecipient: EMAIL,
          contentApprovalIds: [],
        }),
      EmailActionTokenError
    );
  });
});

test("createEmailActionToken: approve_all snapshot round-trips exactly (package membership immutability)", async () => {
  await withEnv(SIGNING_ENV, () => {
    const now = new Date("2026-07-14T12:00:00.000Z");
    const snapshot = ["ca-1", "ca-2", "ca-3"];
    const token = createEmailActionToken({
      action: "approve_all",
      userId: USER,
      businessProfileId: BIZ,
      emailRecipient: EMAIL,
      contentApprovalIds: snapshot,
      now,
    });

    const payload = verifyEmailActionToken(token, now);
    assert.deepEqual(payload.contentApprovalIds, snapshot);

    // A new item created after the token was minted is never part of the payload --
    // there is no way to append to it without re-signing, which proves membership is
    // immutable once the package/email has been generated.
    assert.equal(payload.contentApprovalIds?.includes("ca-new-after-send"), false);
  });
});

test("verifyEmailActionToken: tampered signature is rejected (reason: tampered)", async () => {
  await withEnv(SIGNING_ENV, () => {
    const token = createEmailActionToken({
      action: "approve",
      userId: USER,
      businessProfileId: BIZ,
      emailRecipient: EMAIL,
      contentApprovalId: "ca-1",
    });
    const tampered = token.slice(0, -2) + (token.slice(-2) === "aa" ? "bb" : "aa");

    try {
      verifyEmailActionToken(tampered);
      assert.fail("expected verifyEmailActionToken to throw");
    } catch (error) {
      assert.ok(error instanceof EmailActionTokenError);
      assert.equal((error as EmailActionTokenError).reason, "tampered");
    }
  });
});

test("verifyEmailActionToken: tampering with the payload (e.g. swapping contentApprovalId) is rejected", async () => {
  await withEnv(SIGNING_ENV, () => {
    const token = createEmailActionToken({
      action: "approve",
      userId: USER,
      businessProfileId: BIZ,
      emailRecipient: EMAIL,
      contentApprovalId: "ca-1",
    });
    const [encodedPayload, signature] = token.split(".");
    const payload = JSON.parse(Buffer.from(encodedPayload, "base64url").toString("utf8"));
    payload.contentApprovalId = "ca-someone-elses";
    const forgedPayload = Buffer.from(JSON.stringify(payload)).toString("base64url");
    const forgedToken = `${forgedPayload}.${signature}`;

    assert.throws(() => verifyEmailActionToken(forgedToken), EmailActionTokenError);
  });
});

test("verifyEmailActionToken: expired token is rejected (reason: expired)", async () => {
  await withEnv(SIGNING_ENV, () => {
    const issuedAt = new Date("2026-07-01T00:00:00.000Z");
    const token = createEmailActionToken({
      action: "reject",
      userId: USER,
      businessProfileId: BIZ,
      emailRecipient: EMAIL,
      contentApprovalId: "ca-1",
      ttlSeconds: 1,
      now: issuedAt,
    });

    try {
      verifyEmailActionToken(token, new Date("2026-07-14T00:00:00.000Z"));
      assert.fail("expected verifyEmailActionToken to throw");
    } catch (error) {
      assert.ok(error instanceof EmailActionTokenError);
      assert.equal((error as EmailActionTokenError).reason, "expired");
    }
  });
});

test("verifyEmailActionToken: malformed token strings are rejected without throwing an unhandled error", async () => {
  await withEnv(SIGNING_ENV, () => {
    for (const bad of ["", "no-dot-here", "a.b.c", "..", "onlyone."]) {
      assert.throws(() => verifyEmailActionToken(bad), EmailActionTokenError);
    }
  });
});

test("verifyEmailActionToken: each mint produces a unique nonce (no cross-token nonce reuse)", async () => {
  await withEnv(SIGNING_ENV, () => {
    const tokenA = createEmailActionToken({
      action: "approve",
      userId: USER,
      businessProfileId: BIZ,
      emailRecipient: EMAIL,
      contentApprovalId: "ca-1",
    });
    const tokenB = createEmailActionToken({
      action: "approve",
      userId: USER,
      businessProfileId: BIZ,
      emailRecipient: EMAIL,
      contentApprovalId: "ca-1",
    });

    assert.notEqual(tokenA, tokenB);
    assert.notEqual(verifyEmailActionToken(tokenA).nonce, verifyEmailActionToken(tokenB).nonce);
  });
});

test("email-action tokens are cryptographically distinct from weekly-package 'open' tokens even sharing a secret", async () => {
  await withEnv({ TOKEN_ENCRYPTION_KEY: "2".repeat(64), EMAIL_ACTION_TOKEN_SECRET: undefined, WEEKLY_APPROVAL_LINK_SECRET: undefined }, () => {
    // Both families fall back to TOKEN_ENCRYPTION_KEY when their own secret is unset.
    const openToken = createWeeklyPackageSignedToken({
      purpose: "approve_all",
      userId: USER,
      businessProfileId: BIZ,
    });

    // The weekly-package "open" token must never verify as an email-action token, and
    // vice versa, thanks to domain separation in the HMAC input.
    assert.throws(() => verifyEmailActionToken(openToken), EmailActionTokenError);
  });
});

test("buildEmailActionOpenPath / buildEmailActionAbsoluteUrl produce the expected shape", async () => {
  await withEnv(SIGNING_ENV, () => {
    const token = createEmailActionToken({
      action: "approve",
      userId: USER,
      businessProfileId: BIZ,
      emailRecipient: EMAIL,
      contentApprovalId: "ca-1",
    });

    assert.equal(buildEmailActionOpenPath(token), `/api/email-actions/open?token=${encodeURIComponent(token)}`);
    assert.equal(
      buildEmailActionAbsoluteUrl("https://app.example.com/", token),
      `https://app.example.com/api/email-actions/open?token=${encodeURIComponent(token)}`
    );
  });
});
