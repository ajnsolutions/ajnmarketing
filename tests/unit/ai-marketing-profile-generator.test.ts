import test from "node:test";
import assert from "node:assert/strict";
import { AiMarketingProfileGenerationError } from "../../lib/ai-marketing-profile/errors.ts";
import { createAiMarketingProfileGenerator } from "../../lib/ai-marketing-profile/generator.ts";
import { OpenAiMarketingProfileGenerator } from "../../lib/ai-marketing-profile/openai-generator.ts";

test("createAiMarketingProfileGenerator throws instead of silently using placeholder content when OpenAI is not configured", () => {
  const original = process.env.OPENAI_API_KEY;
  delete process.env.OPENAI_API_KEY;

  try {
    assert.throws(
      () => createAiMarketingProfileGenerator(),
      (error) => {
        assert.ok(error instanceof AiMarketingProfileGenerationError);
        assert.equal(error.details.provider, "openai");
        return true;
      }
    );
  } finally {
    if (original !== undefined) process.env.OPENAI_API_KEY = original;
  }
});

test("createAiMarketingProfileGenerator returns the real OpenAI generator when configured", () => {
  const original = process.env.OPENAI_API_KEY;
  process.env.OPENAI_API_KEY = "sk-test-fake-key-for-unit-test";

  try {
    const generator = createAiMarketingProfileGenerator();
    assert.ok(generator instanceof OpenAiMarketingProfileGenerator);
  } finally {
    if (original === undefined) delete process.env.OPENAI_API_KEY;
    else process.env.OPENAI_API_KEY = original;
  }
});
