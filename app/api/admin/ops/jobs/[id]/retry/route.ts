import { NextResponse } from "next/server";
import { requireAdminUser } from "@/lib/admin/requireAdminUser";
import { createServiceRoleClient, isSupabaseServiceRoleConfigured } from "@/lib/supabase/service";
import { resetBackgroundJobForRetry } from "@/lib/background-jobs/persistence";
import { scheduleBackgroundJobProcessing } from "@/lib/background-jobs/scheduler";
import {
  classifyRetrySafety,
  RetrySafetyClassifications,
} from "@/lib/ops-dashboard/jobLifecycle";
import { logAuditEvent } from "@/lib/audit-log/service";
import { AuditActions } from "@/lib/audit-log/types";

/**
 * Admin-only, cross-tenant background job retry. Distinct from POST /api/jobs (PATCH
 * action=retry), which is customer-self-service and already scoped to the caller's
 * own jobs — this route exists for operators recovering *another* tenant's stuck or
 * failed job during pilot support, reusing the exact same safe transition primitive
 * (resetBackgroundJobForRetry only allows failed|cancelled -> queued) rather than a
 * new retry mechanism.
 */
export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const auth = await requireAdminUser();
  if ("error" in auth) return auth.error;

  if (!isSupabaseServiceRoleConfigured()) {
    return NextResponse.json({ error: "Service-role access is not configured." }, { status: 503 });
  }

  const { id } = await context.params;
  if (!id?.trim()) {
    return NextResponse.json({ error: "Job id is required." }, { status: 400 });
  }

  let body: unknown = {};
  try {
    body = await request.json();
  } catch {
    // Empty body is fine — confirmOperatorReview simply defaults to false.
  }
  const confirmOperatorReview =
    typeof body === "object" && body !== null && (body as Record<string, unknown>).confirmOperatorReview === true;

  const supabase = createServiceRoleClient();

  const { data: existing, error: lookupError } = await supabase
    .from("background_jobs")
    .select("id, user_id, business_profile_id, job_type, status, attempts")
    .eq("id", id)
    .maybeSingle();

  if (lookupError || !existing) {
    return NextResponse.json({ error: "Job not found." }, { status: 404 });
  }

  const safety = classifyRetrySafety({
    job_type: existing.job_type,
    status: existing.status,
    attempts: existing.attempts,
  });

  if (safety === RetrySafetyClassifications.NOT_RETRYABLE) {
    return NextResponse.json(
      { error: "This job is not in a retryable state.", retrySafety: safety },
      { status: 409 }
    );
  }

  if (
    safety === RetrySafetyClassifications.REQUIRES_OPERATOR_REVIEW &&
    !confirmOperatorReview
  ) {
    return NextResponse.json(
      {
        error:
          "This job requires operator review before retrying (possible duplicate side effect or exhausted automatic retries). Resubmit with confirmOperatorReview: true after verifying no duplicate work will occur.",
        retrySafety: safety,
      },
      { status: 409 }
    );
  }

  const job = await resetBackgroundJobForRetry(supabase, existing.user_id, id);

  if (!job) {
    // Another actor already retried/changed this job — idempotent no-op, not an error.
    return NextResponse.json(
      { retried: false, message: "Job is no longer in a retryable state (already retried or changed)." },
      { status: 200 }
    );
  }

  await logAuditEvent(supabase, {
    userId: job.user_id,
    businessProfileId: job.business_profile_id,
    action: AuditActions.BACKGROUND_JOB_QUEUED,
    entityType: "background_job",
    entityId: job.id,
    status: "started",
    metadata: {
      jobType: job.job_type,
      retry: true,
      triggeredByAdmin: auth.user.id,
      retrySafety: safety,
    },
  });

  scheduleBackgroundJobProcessing(job.id);

  return NextResponse.json({ retried: true, job: { id: job.id, status: job.status, jobType: job.job_type } });
}
