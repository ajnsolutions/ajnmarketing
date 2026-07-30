"use client";

import Link from "next/link";
import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  KNOWLEDGE_CATEGORY_LABELS,
  SUPPORTED_FILE_TYPES,
  type SmartUploadDocumentRecord,
  type SmartUploadKnowledgeFactRecord,
} from "@/lib/smart-uploads/types";

function SectionCard({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-2xl border border-slate-200/80 bg-white shadow-sm shadow-slate-200/50 ring-1 ring-slate-900/[0.03]">
      <div className="border-b border-slate-100 px-5 py-4 sm:px-6">
        <h2 className="text-base font-bold tracking-tight text-navy-900 sm:text-lg">{title}</h2>
        {subtitle && <p className="mt-1 text-sm text-text-muted">{subtitle}</p>}
      </div>
      <div className="px-5 py-4 sm:px-6 sm:py-5">{children}</div>
    </section>
  );
}

function statusBadge(status: SmartUploadDocumentRecord["status"]) {
  const styles: Record<string, string> = {
    uploaded: "bg-slate-100 text-slate-600 ring-slate-200",
    processing: "bg-amber-50 text-amber-700 ring-amber-100",
    extracted: "bg-growth-50 text-growth-600 ring-emerald-100",
    failed: "bg-rose-50 text-rose-700 ring-rose-100",
  };
  const labels: Record<string, string> = {
    uploaded: "Uploaded",
    processing: "Processing",
    extracted: "Extracted",
    failed: "Failed",
  };
  return (
    <span className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ring-1 ${styles[status]}`}>
      {labels[status]}
    </span>
  );
}

export function SmartUploadsPage({
  initialDocuments,
  initialFacts,
  openAiConfigured,
}: {
  initialDocuments: SmartUploadDocumentRecord[];
  initialFacts: SmartUploadKnowledgeFactRecord[];
  openAiConfigured: boolean;
}) {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [documents, setDocuments] = useState(initialDocuments);
  const [facts] = useState(initialFacts);
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const activeFacts = facts.filter((fact) => !fact.superseded_by);
  const factsByCategory = new Map<string, SmartUploadKnowledgeFactRecord[]>();
  for (const fact of activeFacts) {
    const list = factsByCategory.get(fact.category) ?? [];
    list.push(fact);
    factsByCategory.set(fact.category, list);
  }

  async function refreshDocuments() {
    const response = await fetch("/api/smart-uploads/documents");
    if (!response.ok) return;
    const payload = (await response.json()) as { documents: SmartUploadDocumentRecord[] };
    setDocuments(payload.documents);
  }

  async function handleUpload(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;

    setBusy(true);
    setMessage(null);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const response = await fetch("/api/smart-uploads/documents", { method: "POST", body: formData });
      const payload = (await response.json()) as { error?: string };
      if (!response.ok) {
        setMessage(payload.error ?? "Unable to upload that file.");
        return;
      }
      setMessage(`${file.name} uploaded — extracting business knowledge now.`);
      await refreshDocuments();
      router.refresh();
    } finally {
      setBusy(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  async function handleDelete(documentId: string) {
    setBusy(true);
    setMessage(null);
    try {
      const response = await fetch(`/api/smart-uploads/documents/${documentId}`, { method: "DELETE" });
      const payload = (await response.json()) as { error?: string };
      if (!response.ok) {
        setMessage(payload.error ?? "Unable to delete that document.");
        return;
      }
      setMessage("Document deleted. Any knowledge that came only from it has been removed too.");
      await refreshDocuments();
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  async function handleReprocess(documentId: string) {
    setBusy(true);
    setMessage(null);
    try {
      const response = await fetch(`/api/smart-uploads/documents/${documentId}/reprocess`, { method: "POST" });
      const payload = (await response.json()) as { error?: string };
      if (!response.ok) {
        setMessage(payload.error ?? "Unable to reprocess that document.");
        return;
      }
      setMessage("Reprocessing started — knowledge will refresh once it completes.");
      await refreshDocuments();
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="max-w-3xl">
          <Link
            href="/dashboard/business-connections"
            className="text-sm font-semibold text-brand-600 transition-colors hover:text-brand-700"
          >
            ← Back to Business Connections
          </Link>
          <h1 className="mt-3 text-2xl font-bold tracking-tight text-navy-900 sm:text-3xl">Smart Uploads</h1>
          <p className="mt-2 text-sm leading-7 text-text-muted sm:text-base">
            Upload brochures, service sheets, price lists, or FAQs. We extract reusable business
            knowledge from them — products, services, pricing, guarantees, and more — so
            recommendations and generated content stay grounded in what you actually offer.
          </p>
        </div>
      </div>

      {!openAiConfigured && (
        <p className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-medium text-amber-800">
          Document extraction is temporarily unavailable. You can still upload files — they&apos;ll
          process automatically once this is configured.
        </p>
      )}

      <SectionCard
        title="Upload a document"
        subtitle={`Supported today: ${SUPPORTED_FILE_TYPES.join(", ")}. PowerPoint, Excel, images, and CSV are coming soon.`}
      >
        <label className="flex cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-slate-200 bg-[#F8FAFC] px-6 py-10 text-center transition-colors hover:border-brand-300">
          <span className="text-sm font-semibold text-navy-900">Choose a file to upload</span>
          <span className="text-xs text-text-muted">PDF, DOCX, TXT, or Markdown — up to 15 MB</span>
          <input
            ref={fileInputRef}
            type="file"
            accept=".pdf,.docx,.txt,.md,.markdown"
            onChange={handleUpload}
            disabled={busy}
            className="sr-only"
          />
        </label>
        {message && (
          <p className="mt-4 rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-medium text-navy-900">
            {message}
          </p>
        )}
      </SectionCard>

      <SectionCard title="Uploaded documents" subtitle="View status, reprocess, or delete anytime">
        {documents.length === 0 ? (
          <p className="text-sm text-text-muted">No documents uploaded yet.</p>
        ) : (
          <div className="space-y-3">
            {documents.map((doc) => (
              <div
                key={doc.id}
                className="flex flex-col gap-3 rounded-xl border border-slate-100 bg-[#F8FAFC] px-4 py-3 ring-1 ring-slate-200/60 sm:flex-row sm:items-center sm:justify-between"
              >
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-sm font-semibold text-navy-900">{doc.file_name}</p>
                    {statusBadge(doc.status)}
                  </div>
                  <p className="mt-1 text-xs text-text-muted">
                    {doc.status === "extracted"
                      ? `${doc.fact_count} facts learned`
                      : doc.status === "failed"
                        ? (doc.extraction_error ?? "Extraction failed")
                        : "Working on it..."}
                  </p>
                </div>
                <div className="flex flex-col gap-2 sm:flex-row">
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => handleReprocess(doc.id)}
                    className="min-h-11 rounded-full border border-slate-200 bg-white px-4 py-2 text-xs font-semibold text-navy-900 hover:bg-slate-50 disabled:opacity-60"
                  >
                    Reprocess
                  </button>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => handleDelete(doc.id)}
                    className="min-h-11 rounded-full border border-rose-200 bg-white px-4 py-2 text-xs font-semibold text-rose-700 hover:bg-rose-50 disabled:opacity-60"
                  >
                    Delete
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </SectionCard>

      <SectionCard title="What we learned" subtitle="Normalized business knowledge, not raw file summaries">
        {activeFacts.length === 0 ? (
          <p className="text-sm text-text-muted">
            Nothing learned yet. Upload a document above and check back once extraction finishes.
          </p>
        ) : (
          <div className="space-y-5">
            {[...factsByCategory.entries()].map(([category, categoryFacts]) => (
              <div key={category}>
                <h3 className="text-sm font-semibold uppercase tracking-wide text-text-muted">
                  {KNOWLEDGE_CATEGORY_LABELS[category as keyof typeof KNOWLEDGE_CATEGORY_LABELS] ?? category}
                </h3>
                <ul className="mt-2 space-y-2">
                  {categoryFacts.map((fact) => (
                    <li
                      key={fact.id}
                      className="rounded-xl border border-slate-100 bg-white px-4 py-3 ring-1 ring-slate-200/60"
                    >
                      <p className="text-sm text-navy-900">{fact.fact}</p>
                      <p className="mt-1 text-xs text-text-muted">
                        Confidence: {fact.confidence}
                        {fact.source_excerpt ? ` · "${fact.source_excerpt}"` : ""}
                      </p>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        )}
      </SectionCard>
    </div>
  );
}
