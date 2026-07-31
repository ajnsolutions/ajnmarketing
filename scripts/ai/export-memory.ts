#!/usr/bin/env node
/**
 * Builds .ai/exports/PROJECT_MEMORY.md — a single-file combination of every
 * .ai/ memory doc, intended to be uploaded to ChatGPT or another AI tool
 * when it doesn't have direct GitHub repository access. Run:
 * `npm run ai:memory:export`.
 */
import { existsSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { redactSecrets } from "./redact.ts";

export interface MemoryInputs {
  currentStatus: string;
  roadmap: string;
  architecture: string;
  decisions: string;
  openItems: string;
  handoff: string;
  statusJson: string;
  latestRunSummary: string | null;
}

export function buildProjectMemoryMarkdown(inputs: MemoryInputs, generatedAt: string): string {
  const sections = [
    `# Project Memory — AJN Marketing\n\nGenerated ${generatedAt} by \`scripts/ai/export-memory.ts\`. This file combines every \`.ai/\` memory doc into one upload-friendly document for AI tools without direct repository access. It is a snapshot — for anything time-sensitive, prefer reading the repository directly if you can.\n`,
    `## Current Status\n\n${inputs.currentStatus}`,
    `## Roadmap\n\n${inputs.roadmap}`,
    `## Architecture\n\n${inputs.architecture}`,
    `## Decisions\n\n${inputs.decisions}`,
    `## Open Items\n\n${inputs.openItems}`,
    `## Handoff\n\n${inputs.handoff}`,
    `## Machine-readable status (STATUS.json)\n\n\`\`\`json\n${inputs.statusJson.trim()}\n\`\`\``,
  ];
  if (inputs.latestRunSummary) {
    sections.push(`## Latest overnight queue run\n\n${inputs.latestRunSummary}`);
  }
  return sections.join("\n\n---\n\n") + "\n";
}

function findLatestRunSummary(repoRoot: string): string | null {
  const runsDir = join(repoRoot, ".ai", "runs");
  if (!existsSync(runsDir)) return null;
  const entries = readdirSync(runsDir).filter((name) => statSync(join(runsDir, name)).isDirectory());
  if (entries.length === 0) return null;
  const latest = entries.sort().at(-1)!;
  const summaryPath = join(runsDir, latest, "RUN_SUMMARY.md");
  return existsSync(summaryPath) ? readFileSync(summaryPath, "utf8") : null;
}

function readAiFile(repoRoot: string, name: string): string {
  return readFileSync(join(repoRoot, ".ai", name), "utf8");
}

function main(): void {
  const repoRoot = process.cwd();
  const inputs: MemoryInputs = {
    currentStatus: readAiFile(repoRoot, "CURRENT_STATUS.md"),
    roadmap: readAiFile(repoRoot, "ROADMAP.md"),
    architecture: readAiFile(repoRoot, "ARCHITECTURE.md"),
    decisions: readAiFile(repoRoot, "DECISIONS.md"),
    openItems: readAiFile(repoRoot, "OPEN_ITEMS.md"),
    handoff: readAiFile(repoRoot, "HANDOFF.md"),
    statusJson: readAiFile(repoRoot, "STATUS.json"),
    latestRunSummary: findLatestRunSummary(repoRoot),
  };

  const markdown = redactSecrets(buildProjectMemoryMarkdown(inputs, new Date().toISOString()));
  const outDir = join(repoRoot, ".ai", "exports");
  mkdirSync(outDir, { recursive: true });
  const outPath = join(outDir, "PROJECT_MEMORY.md");
  writeFileSync(outPath, markdown, "utf8");
  console.log(`Wrote ${outPath}`);
}

const isMain = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
if (isMain) main();
