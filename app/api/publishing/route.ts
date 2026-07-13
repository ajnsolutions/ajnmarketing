import { NextResponse } from "next/server";
import {
  cancelPublishForUser,
  getPublishingDashboardJobsForUser,
  getPublishingHistoryForUser,
  publishNowForUser,
  queuePublishForUser,
  retryPublishForUser,
  schedulePublishForUser,
  verifyPublishedContentForUser,
} from "@/lib/publishing/publishingEngine";
import { createClient } from "@/lib/supabase/server";

/**
 * Read-only. Due scheduled/retrying jobs are executed exclusively by the Trigger.dev
 * publishing-due-sweep path — never as a side effect of loading the Publishing dashboard.
 */
export async function GET(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const historyFor = searchParams.get("historyFor");

  if (historyFor) {
    const history = await getPublishingHistoryForUser(user.id, historyFor);
    return NextResponse.json({ history });
  }

  const jobs = await getPublishingDashboardJobsForUser(user.id);
  return NextResponse.json({ jobs });
}

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = (await request.json()) as {
    action?: string;
    publishingQueueId?: string;
    publishingJobId?: string;
    scheduledFor?: string;
  };

  switch (body.action) {
    case "queue": {
      if (!body.publishingQueueId) {
        return NextResponse.json({ error: "publishingQueueId is required" }, { status: 400 });
      }
      const result = await queuePublishForUser(user.id, {
        publishingQueueId: body.publishingQueueId,
        scheduledFor: body.scheduledFor ?? null,
      });
      return NextResponse.json(result, { status: result.error ? 502 : 200 });
    }
    case "publish_now": {
      if (!body.publishingQueueId) {
        return NextResponse.json({ error: "publishingQueueId is required" }, { status: 400 });
      }
      const result = await publishNowForUser(user.id, body.publishingQueueId);
      return NextResponse.json(result, { status: result.error ? 502 : 200 });
    }
    case "schedule": {
      if (!body.publishingQueueId || !body.scheduledFor) {
        return NextResponse.json(
          { error: "publishingQueueId and scheduledFor are required" },
          { status: 400 }
        );
      }
      const result = await schedulePublishForUser(
        user.id,
        body.publishingQueueId,
        body.scheduledFor
      );
      return NextResponse.json(result, { status: result.error ? 502 : 200 });
    }
    case "retry": {
      if (!body.publishingJobId) {
        return NextResponse.json({ error: "publishingJobId is required" }, { status: 400 });
      }
      const result = await retryPublishForUser(user.id, body.publishingJobId);
      return NextResponse.json(result, { status: result.error ? 502 : 200 });
    }
    case "cancel": {
      if (!body.publishingJobId) {
        return NextResponse.json({ error: "publishingJobId is required" }, { status: 400 });
      }
      const result = await cancelPublishForUser(user.id, body.publishingJobId);
      return NextResponse.json(result, { status: result.error ? 502 : 200 });
    }
    case "verify": {
      if (!body.publishingJobId) {
        return NextResponse.json({ error: "publishingJobId is required" }, { status: 400 });
      }
      const result = await verifyPublishedContentForUser(user.id, body.publishingJobId);
      return NextResponse.json(result, { status: result.error ? 502 : 200 });
    }
    default:
      return NextResponse.json({ error: "Unsupported publishing action" }, { status: 400 });
  }
}
