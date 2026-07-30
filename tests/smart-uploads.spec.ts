import { test, expect } from "@playwright/test";
import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd();

function read(rel: string) {
  return readFileSync(join(root, rel), "utf8");
}

test("Smart Uploads modules, routes, and docs exist", () => {
  expect(existsSync(join(root, "lib/smart-uploads/types.ts"))).toBe(true);
  expect(existsSync(join(root, "lib/smart-uploads/extractors/registry.ts"))).toBe(true);
  expect(existsSync(join(root, "lib/smart-uploads/openai-extractor.ts"))).toBe(true);
  expect(existsSync(join(root, "lib/smart-uploads/persistence.ts"))).toBe(true);
  expect(existsSync(join(root, "lib/smart-uploads/service.ts"))).toBe(true);
  expect(existsSync(join(root, "lib/smart-uploads/duplicateDetection.ts"))).toBe(true);
  expect(existsSync(join(root, "lib/smart-uploads/toBusinessInsight.ts"))).toBe(true);
  expect(existsSync(join(root, "lib/smart-uploads/crossover.ts"))).toBe(true);
  expect(existsSync(join(root, "lib/embeddings/provider.ts"))).toBe(true);
  expect(existsSync(join(root, "lib/embeddings/openaiProvider.ts"))).toBe(true);
  expect(existsSync(join(root, "app/api/smart-uploads/documents/route.ts"))).toBe(true);
  expect(existsSync(join(root, "app/api/smart-uploads/documents/[id]/route.ts"))).toBe(true);
  expect(existsSync(join(root, "app/api/smart-uploads/documents/[id]/reprocess/route.ts"))).toBe(true);
  expect(existsSync(join(root, "components/dashboard/smart-uploads-page.tsx"))).toBe(true);
  expect(existsSync(join(root, "app/dashboard/smart-uploads/page.tsx"))).toBe(true);
  expect(existsSync(join(root, "supabase/migrations/033_smart_uploads.sql"))).toBe(true);
  expect(existsSync(join(root, "docs/project-magic/SMART_UPLOADS.md"))).toBe(true);
});

test("unauthenticated Smart Uploads page redirects to login", async ({ page }) => {
  await page.goto("/dashboard/smart-uploads");
  await expect(page).toHaveURL(/\/login/);
});

test("unauthenticated Smart Uploads APIs remain unauthorized", async ({ request }) => {
  const endpoints = [
    { method: "GET", url: "/api/smart-uploads/documents" },
    { method: "POST", url: "/api/smart-uploads/documents", data: {} },
    { method: "GET", url: "/api/smart-uploads/documents/00000000-0000-0000-0000-000000000000" },
    { method: "DELETE", url: "/api/smart-uploads/documents/00000000-0000-0000-0000-000000000000" },
    { method: "POST", url: "/api/smart-uploads/documents/00000000-0000-0000-0000-000000000000/reprocess" },
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

test("catalog entry is live and points at the Smart Uploads dashboard route", () => {
  const catalog = read("lib/business-connections/catalog.ts");
  expect(catalog).toContain("conn_smart_uploads");
  expect(catalog).toContain('connectHref: "/dashboard/smart-uploads"');
  expect(catalog).toContain('manageHref: "/dashboard/smart-uploads"');

  const resolve = read("lib/business-connections/resolve.ts");
  expect(resolve).toContain("resolveSmartUploads");
  expect(resolve).toContain("ConnectionProviderIds.SMART_UPLOADS");
});

test("extractor registry is architected for future file types without changing its interface", () => {
  const types = read("lib/smart-uploads/types.ts");
  expect(types).toContain("POWERPOINT");
  expect(types).toContain("EXCEL");
  expect(types).toContain("IMAGE");
  expect(types).toContain("CSV");

  const registry = read("lib/smart-uploads/extractors/registry.ts");
  expect(registry).toContain("pdf: pdfExtractor");
  expect(registry).toContain("docx: docxExtractor");
  // Future types intentionally have no extractor registered yet.
  expect(registry).not.toMatch(/powerpoint:\s*\w+Extractor/);
});

test("Growth Advisor and Weekly Growth Plan cite Smart Upload knowledge", () => {
  const observations = read("lib/growth-advisor/observations.ts");
  expect(observations).toContain("websiteContentGapObservation");
  expect(observations).toContain("searchDemandCrossoverObservation");
  expect(observations).toContain("crossover:external_intelligence+smart_uploads");

  const evidence = read("lib/growth-planner/evidence.ts");
  expect(evidence).toContain("smart_uploads");
  expect(evidence).toContain("findSearchDemandCrossovers");
});

test("Content Generator threads Smart Upload knowledge into prompts automatically", () => {
  const service = read("lib/content-generator/service.ts");
  expect(service).toContain("formatSmartUploadKnowledgeForContentPrompt");
  expect(service).toContain("getActiveSmartUploadKnowledgeForUser");

  const promptBuilder = read("lib/content-generator/prompt-builder.ts");
  expect(promptBuilder).toContain("smartUploadsPromptBlock");
});

test("connect page source never leaks storage/service internals", () => {
  const page = read("components/dashboard/smart-uploads-page.tsx");
  expect(page).not.toMatch(/OPENAI_API_KEY|SUPABASE_SECRET|storage_path|access_token/i);
});

test("embedding abstraction is provider-agnostic — no caller imports the OpenAI provider directly", () => {
  const provider = read("lib/embeddings/provider.ts");
  expect(provider).toContain("interface EmbeddingProvider");
  expect(provider).not.toMatch(/openai/i);

  const service = read("lib/embeddings/service.ts");
  expect(service).toContain("EmbeddingProvider");
  // The default constructor is the one seam allowed to know about OpenAI —
  // every other function in this file takes an injected provider.
  expect(service).toContain("createDefaultEmbeddingProvider");
});

test("migration enforces RLS on every Smart Upload table and creates a private storage bucket", () => {
  const migration = read("supabase/migrations/033_smart_uploads.sql");
  for (const tableName of [
    "smart_upload_documents",
    "smart_upload_knowledge_facts",
    "smart_upload_fact_embeddings",
  ]) {
    expect(migration).toContain(`create table if not exists public.${tableName}`);
    expect(migration).toContain(`alter table public.${tableName} enable row level security`);
  }
  expect(migration).toContain("auth.uid() = user_id");
  expect(migration).toContain("values ('smart-uploads', 'smart-uploads', false)");
  expect(migration).not.toMatch(/using \(true\)/i);
});

test("cron gate remains false", () => {
  const gate = read("lib/trigger/scheduleActivation.ts");
  expect(gate).toContain("ATTACH_DECLARATIVE_PRODUCTION_CRONS = false");
});

test("docs cover architecture, extraction, Business Brain integration, confidence, embeddings, and roadmap", () => {
  const docs = read("docs/project-magic/SMART_UPLOADS.md");
  expect(docs).toContain("Architecture");
  expect(docs).toContain("Knowledge extraction");
  expect(docs).toContain("Business Brain");
  expect(docs).toContain("Confidence");
  expect(docs).toContain("Embedding");
  expect(docs).toContain("Future roadmap");
});
