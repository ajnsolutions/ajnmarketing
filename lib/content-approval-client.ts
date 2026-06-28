import type {
  ContentApproval,
  ContentApprovalCreateInput,
  ContentApprovalPatchInput,
} from "@/lib/content-approval/types";

export async function fetchContentApprovals(): Promise<{
  approvals: ContentApproval[];
  error?: string;
}> {
  const response = await fetch("/api/content-approval", { method: "GET" });
  const payload = (await response.json()) as {
    approvals?: ContentApproval[];
    error?: string;
  };

  if (!response.ok) {
    return { approvals: [], error: payload.error ?? "Unable to load approvals" };
  }

  return { approvals: payload.approvals ?? [] };
}

export async function createContentApprovalRequest(
  input: ContentApprovalCreateInput
): Promise<{ approval: ContentApproval | null; error?: string }> {
  const response = await fetch("/api/content-approval", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });

  const payload = (await response.json()) as {
    approval?: ContentApproval | null;
    error?: string;
  };

  if (!response.ok) {
    return { approval: null, error: payload.error ?? "Unable to send content for approval" };
  }

  return { approval: payload.approval ?? null };
}

export async function patchContentApprovalRequest(
  input: ContentApprovalPatchInput
): Promise<{ approval: ContentApproval | null; error?: string }> {
  const response = await fetch("/api/content-approval", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });

  const payload = (await response.json()) as {
    approval?: ContentApproval | null;
    error?: string;
  };

  if (!response.ok) {
    return { approval: null, error: payload.error ?? "Unable to update approval" };
  }

  return { approval: payload.approval ?? null };
}
