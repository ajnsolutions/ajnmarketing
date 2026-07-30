import { test, expect } from "@playwright/test";
import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd();

function read(rel: string) {
  return readFileSync(join(root, rel), "utf8");
}

test("Website Testimonials modules, routes, and docs exist", () => {
  expect(existsSync(join(root, "lib/testimonials/types.ts"))).toBe(true);
  expect(existsSync(join(root, "lib/testimonials/bulkPaste.ts"))).toBe(true);
  expect(existsSync(join(root, "lib/testimonials/csvImport.ts"))).toBe(true);
  expect(existsSync(join(root, "lib/testimonials/websiteImport.ts"))).toBe(true);
  expect(existsSync(join(root, "lib/testimonials/openai-extractor.ts"))).toBe(true);
  expect(existsSync(join(root, "lib/testimonials/persistence.ts"))).toBe(true);
  expect(existsSync(join(root, "lib/testimonials/service.ts"))).toBe(true);
  expect(existsSync(join(root, "lib/testimonials/contentPromptBlock.ts"))).toBe(true);
  expect(existsSync(join(root, "lib/customer-voice/providers/websiteTestimonials.ts"))).toBe(true);
  expect(existsSync(join(root, "lib/business-knowledge-graph/adapters/testimonials.ts"))).toBe(true);
  expect(existsSync(join(root, "app/api/testimonials/route.ts"))).toBe(true);
  expect(existsSync(join(root, "app/api/testimonials/[id]/route.ts"))).toBe(true);
  expect(existsSync(join(root, "components/dashboard/testimonials-page.tsx"))).toBe(true);
  expect(existsSync(join(root, "app/dashboard/testimonials/page.tsx"))).toBe(true);
  expect(existsSync(join(root, "supabase/migrations/035_website_testimonials.sql"))).toBe(true);
  expect(existsSync(join(root, "docs/project-magic/WEBSITE_TESTIMONIALS.md"))).toBe(true);
});

test("unauthenticated Website Testimonials page redirects to login", async ({ page }) => {
  await page.goto("/dashboard/testimonials");
  await expect(page).toHaveURL(/\/login/);
});

test("unauthenticated Website Testimonials APIs remain unauthorized", async ({ request }) => {
  const endpoints = [
    { method: "GET", url: "/api/testimonials" },
    { method: "POST", url: "/api/testimonials", data: { mode: "manual", quote: "test" } },
    { method: "DELETE", url: "/api/testimonials/00000000-0000-0000-0000-000000000000" },
  ] as const;

  for (const endpoint of endpoints) {
    const response =
      endpoint.method === "GET"
        ? await request.get(endpoint.url)
        : endpoint.method === "DELETE"
          ? await request.delete(endpoint.url)
          : await request.post(endpoint.url, { data: "data" in endpoint ? endpoint.data : {} });
    expect(response.status(), endpoint.url).toBe(401);
  }
});

test("provider abstraction is preserved — no provider-id branching in shared Customer Voice modules", () => {
  const normalize = read("lib/customer-voice/normalize.ts");
  const compose = read("lib/customer-voice/compose.ts");
  const confidence = read("lib/customer-voice/confidence.ts");
  for (const source of [normalize, compose, confidence]) {
    expect(source).not.toMatch(/website_testimonials/);
    expect(source).not.toMatch(/google_business_reviews/);
  }

  const service = read("lib/customer-voice/service.ts");
  expect(service).toContain("createWebsiteTestimonialsProvider");
  expect(service).toContain("createGoogleBusinessReviewsProvider");
});

test("website testimonials provider uses the reserved provider id and the shared evidence shape", () => {
  const types = read("lib/customer-voice/types.ts");
  expect(types).toContain("WEBSITE_TESTIMONIALS");

  const provider = read("lib/customer-voice/providers/websiteTestimonials.ts");
  expect(provider).toContain("CustomerVoiceProviderIds.WEBSITE_TESTIMONIALS");
  expect(provider).toContain("mapTestimonialToEvidence");
});

test("dashboard threads knownServices into Customer Voice so themes can reinforce a specific existing entity", () => {
  const dashboard = read("app/dashboard/page.tsx");
  expect(dashboard).toContain("knownServices: businessDiscovery?.primaryServices?.value");
  expect(dashboard).toContain("testimonialFacts");
});

test("Business Knowledge Graph service accepts testimonial facts and never fabricates evidence", () => {
  const service = read("lib/business-knowledge-graph/service.ts");
  expect(service).toContain("testimonialFacts");
  expect(service).toContain("testimonialKnowledgeToGraphSignals");

  const adapter = read("lib/business-knowledge-graph/adapters/testimonials.ts");
  expect(adapter).toContain("source_excerpt");
  expect(adapter).not.toMatch(/Math\.random/);
});

test("Growth Advisor references testimonial evidence with an explicit why, gated on real contribution", () => {
  const observations = read("lib/growth-advisor/observations.ts");
  expect(observations).toContain("testimonialWebsiteGapObservation");
  expect(observations).toContain('contributingProviders.includes("website_testimonials")');
  expect(observations).toContain("whyItMatters");
});

test("Content Generator incorporates testimonial language and quotes without ever inventing them", () => {
  const service = read("lib/content-generator/service.ts");
  expect(service).toContain("formatTestimonialKnowledgeForContentPrompt");
  expect(service).toContain("formatTestimonialQuotesForContentPrompt");

  const promptBuilder = read("lib/content-generator/prompt-builder.ts");
  expect(promptBuilder).toContain("testimonialKnowledgePromptBlock");
  expect(promptBuilder).toContain("testimonialQuotesPromptBlock");
  expect(promptBuilder).toContain("never invent a quote");
});

test("Marketing Health gains a Customer Understanding dimension driven by real evidence counts", () => {
  const knowledgeHealth = read("lib/business-knowledge-graph/knowledgeHealth.ts");
  expect(knowledgeHealth).toContain("customerUnderstanding");
  expect(knowledgeHealth).toContain("testimonials: boolean");
  expect(knowledgeHealth).toContain("Website testimonials");
});

test("Business Connections catalog and resolver expose Website Testimonials as a live connection", () => {
  const catalog = read("lib/business-connections/catalog.ts");
  expect(catalog).toContain("conn_website_testimonials");
  expect(catalog).toContain('connectHref: "/dashboard/testimonials"');
  expect(catalog).toContain('manageHref: "/dashboard/testimonials"');

  const resolve = read("lib/business-connections/resolve.ts");
  expect(resolve).toContain("resolveTestimonials");
  expect(resolve).toContain("testimonialsConnected");
});

test("Supporting context surfaces a direct link to Website Testimonials", () => {
  const supportingContext = read("components/dashboard/growth-advisor/supporting-context.tsx");
  expect(supportingContext).toContain('href: "/dashboard/testimonials"');
});

test("migration enforces RLS with select/insert/update/delete policies on both new tables", () => {
  const migration = read("supabase/migrations/035_website_testimonials.sql");
  for (const tableName of ["website_testimonials", "testimonial_knowledge_facts"]) {
    expect(migration).toContain(`create table if not exists public.${tableName}`);
    expect(migration).toContain(`alter table public.${tableName} enable row level security`);
  }
  for (const action of ["select", "insert", "update", "delete"]) {
    const count = (migration.match(new RegExp(`for ${action}`, "g")) ?? []).length;
    expect(count, `expected 2 "for ${action}" policies (one per table)`).toBe(2);
  }
  expect(migration).toContain("auth.uid() = user_id");
  expect(migration).not.toMatch(/using \(true\)/i);
});

test("cron gate remains false", () => {
  const gate = read("lib/trigger/scheduleActivation.ts");
  expect(gate).toContain("ATTACH_DECLARATIVE_PRODUCTION_CRONS = false");
});

test("docs cover provider architecture, extraction model, Customer Voice/Business Brain/Learning Engine integration, and future roadmap", () => {
  const docs = read("docs/project-magic/WEBSITE_TESTIMONIALS.md");
  expect(docs).toContain("Provider architecture");
  expect(docs).toContain("Extraction model");
  expect(docs).toContain("Customer Voice");
  expect(docs).toContain("Business Brain");
  expect(docs).toContain("Learning Engine");
  expect(docs).toContain("Future roadmap");
});
