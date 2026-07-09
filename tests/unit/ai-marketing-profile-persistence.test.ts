import test from "node:test";
import assert from "node:assert/strict";
import { formatAiMarketingProfileFailure } from "../../lib/ai-marketing-profile/persistence.ts";

test("formatAiMarketingProfileFailure returns null when there is no recorded failure", () => {
  assert.equal(formatAiMarketingProfileFailure(null), null);
  assert.equal(formatAiMarketingProfileFailure(undefined), null);
  assert.equal(formatAiMarketingProfileFailure({ provider: "openai", message: "" }), null);
});

test("formatAiMarketingProfileFailure surfaces the message", () => {
  const result = formatAiMarketingProfileFailure({
    provider: "openai",
    message: "OpenAI returned an empty marketing profile response",
  });

  assert.equal(result, "OpenAI returned an empty marketing profile response");
});

test("formatAiMarketingProfileFailure includes the HTTP status when present", () => {
  const result = formatAiMarketingProfileFailure({
    provider: "openai",
    status: 429,
    message: "Rate limit exceeded",
  });

  assert.equal(result, "Rate limit exceeded (status 429)");
});
