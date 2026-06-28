import { NextResponse } from "next/server";
import {
  createPublishingQueueItemForUser,
  getPublishingQueueForCurrentUser,
  patchPublishingQueueItemForUser,
} from "@/lib/publishing-queue/service";
import type {
  PublishingQueueCreateInput,
  PublishingQueuePatchInput,
} from "@/lib/publishing-queue/types";
import { createClient } from "@/lib/supabase/server";

export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const items = await getPublishingQueueForCurrentUser();
  return NextResponse.json({ items });
}

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = (await request.json()) as PublishingQueueCreateInput;

  const { item, error } = await createPublishingQueueItemForUser(user.id, body);

  if (error || !item) {
    return NextResponse.json(
      { error: error ?? "Unable to add to publishing queue" },
      { status: error === "Only approved content can be added to the publishing queue" ? 400 : 502 }
    );
  }

  return NextResponse.json({ item });
}

export async function PATCH(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = (await request.json()) as PublishingQueuePatchInput;

  if (!body.id) {
    return NextResponse.json({ error: "Queue item id is required" }, { status: 400 });
  }

  const { item, error } = await patchPublishingQueueItemForUser(user.id, body);

  if (error || !item) {
    return NextResponse.json(
      { error: error ?? "Unable to update publishing queue item" },
      { status: error === "Publishing queue item not found" ? 404 : 502 }
    );
  }

  return NextResponse.json({ item });
}
