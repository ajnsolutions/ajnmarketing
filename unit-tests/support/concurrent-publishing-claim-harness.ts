/**
 * In-memory compare-and-swap claim harness for publishing jobs.
 *
 * Simulates two concurrent executePublishingJobById callers racing the same
 * atomic claim without touching a real database or Google API. Exactly one
 * update that filters on the expected prior status succeeds; the loser gets
 * null (0 rows), matching Postgres CAS behavior.
 *
 * Use this later for real concurrent executePublishingJobById integration
 * tests — do not wire a live Google publish through it.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import type { PublishingJob, PublishingJobStatus } from "@/lib/publishing/publishingTypes";

export type ConcurrentClaimAttempt = {
  callerId: string;
  won: boolean;
  claimed: PublishingJob | null;
};

export type ConcurrentClaimHarness = {
  /** Shared mutable job row (status flips to publishing on first win). */
  getJob: () => PublishingJob;
  /**
   * Minimal Supabase-shaped client whose publishing_jobs.update(...).maybeSingle()
   * implements CAS: only succeeds when current status === expectedStatus filter.
   */
  client: SupabaseClient;
  /** Fire N parallel claim updates; returns who won. */
  raceClaims: (
    callers: string[],
    expectedStatus: PublishingJobStatus
  ) => Promise<ConcurrentClaimAttempt[]>;
};

export function createConcurrentPublishingClaimHarness(
  initialJob: PublishingJob
): ConcurrentClaimHarness {
  let job: PublishingJob = { ...initialJob };

  function applyCas(
    expectedStatus: PublishingJobStatus,
    publishingJobId: string,
    userId: string
  ): PublishingJob | null {
    if (job.id !== publishingJobId || job.user_id !== userId) {
      return null;
    }
    if (job.status !== expectedStatus) {
      return null;
    }
    if (
      expectedStatus !== "queued" &&
      expectedStatus !== "scheduled" &&
      expectedStatus !== "retrying"
    ) {
      return null;
    }
    job = {
      ...job,
      status: "publishing",
      last_error: null,
      updated_at: new Date().toISOString(),
    };
    return { ...job };
  }

  const client = {
    from(table: string) {
      if (table !== "publishing_jobs") {
        throw new Error(`ConcurrentClaimHarness only supports publishing_jobs (got ${table})`);
      }

      let expectedStatus: PublishingJobStatus | null = null;
      let publishingJobId: string | null = null;
      let userId: string | null = null;
      let isUpdate = false;

      const builder: Record<string, unknown> = {
        select() {
          return builder;
        },
        update() {
          isUpdate = true;
          return builder;
        },
        eq(column: string, value: unknown) {
          if (column === "id") publishingJobId = String(value);
          if (column === "user_id") userId = String(value);
          if (column === "status") expectedStatus = value as PublishingJobStatus;
          return builder;
        },
        maybeSingle: async () => {
          if (!isUpdate || !expectedStatus || !publishingJobId || !userId) {
            return { data: { ...job }, error: null };
          }
          const claimed = applyCas(expectedStatus, publishingJobId, userId);
          return { data: claimed, error: null };
        },
        single: async () => {
          const result = await (builder.maybeSingle as () => Promise<{ data: unknown; error: null }>)();
          return result;
        },
      };

      return builder;
    },
  } as unknown as SupabaseClient;

  return {
    getJob: () => ({ ...job }),
    client,
    async raceClaims(callers, expectedStatus) {
      const results = await Promise.all(
        callers.map(async (callerId) => {
          const { data } = await client
            .from("publishing_jobs")
            .update({ status: "publishing", last_error: null })
            .eq("id", job.id)
            .eq("user_id", job.user_id)
            .eq("status", expectedStatus)
            .select("*")
            .maybeSingle();

          const claimed = data as PublishingJob | null;
          return {
            callerId,
            won: claimed !== null,
            claimed,
          };
        })
      );
      return results;
    },
  };
}
