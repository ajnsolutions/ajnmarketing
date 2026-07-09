import test from "node:test";
import assert from "node:assert/strict";
import { APIError } from "openai";
import {
  AiMarketingProfileGenerationError,
  buildOpenAiFailureDetails,
} from "../lib/ai-marketing-profile/errors.ts";

test("AiMarketingProfileGenerationError carries structured details as the error message and details payload", () => {
  const error = new AiMarketingProfileGenerationError({
    provider: "openai",
    model: "gpt-4.1-mini",
    status: 429,
    code: "rate_limit_exceeded",
    type: "requests",
    requestId: "req_abc123",
    message: "Rate limit exceeded",
  });

  assert.equal(error.name, "AiMarketingProfileGenerationError");
  assert.equal(error.message, "Rate limit exceeded");
  assert.deepEqual(error.details, {
    provider: "openai",
    model: "gpt-4.1-mini",
    status: 429,
    code: "rate_limit_exceeded",
    type: "requests",
    requestId: "req_abc123",
    message: "Rate limit exceeded",
  });
});

test("AiMarketingProfileGenerationError preserves the original error as `cause` when provided", () => {
  const original = new Error("network reset");
  const error = new AiMarketingProfileGenerationError(
    { provider: "unknown", message: "network reset" },
    { cause: original }
  );

  assert.equal(error.cause, original);
});

test("buildOpenAiFailureDetails preserves status/code/type/requestId from an OpenAI APIError", () => {
  const apiError = new AuthenticationErrorLike();

  const details = buildOpenAiFailureDetails(apiError, "gpt-4.1-mini");

  assert.equal(details.provider, "openai");
  assert.equal(details.model, "gpt-4.1-mini");
  assert.equal(details.status, 401);
  assert.equal(details.code, "invalid_api_key");
  assert.equal(details.type, "invalid_request_error");
  assert.equal(details.requestId, "req_xyz789");
  // APIError's message is prefixed with the HTTP status by the SDK itself.
  assert.equal(details.message, "401 Incorrect API key provided");
});

test("buildOpenAiFailureDetails falls back to a generic message for non-APIError failures", () => {
  const details = buildOpenAiFailureDetails(new Error("fetch failed"), "gpt-4.1-mini");

  assert.equal(details.provider, "openai");
  assert.equal(details.model, "gpt-4.1-mini");
  assert.equal(details.status, undefined);
  assert.equal(details.message, "fetch failed");
});

test("buildOpenAiFailureDetails handles non-Error thrown values", () => {
  const details = buildOpenAiFailureDetails("a plain string was thrown", "gpt-4.1-mini");

  assert.equal(details.message, "a plain string was thrown");
});

// Constructing a real OpenAI APIError requires the shape their SDK generates internally;
// build one via the same static factory the SDK itself uses so this test exercises the real class.
function AuthenticationErrorLike() {
  const headers = new Headers({ "x-request-id": "req_xyz789" });
  return APIError.generate(
    401,
    { error: { message: "Incorrect API key provided", type: "invalid_request_error", code: "invalid_api_key" } },
    "Incorrect API key provided",
    headers
  );
}
