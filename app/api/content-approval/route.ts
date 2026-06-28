import { NextResponse } from "next/server";
import { getBusinessProfileForUser } from "@/lib/business-profile-server";
import {
  getContentApprovalsForCurrentUser,
  patchContentApprovalForUser,
  submitContentForApproval,
} from "@/lib/content-approval/service";
import type { ContentApprovalCreateInput, ContentApprovalPatchInput } from "@/lib/content-approval/types";
import { createClient } from "@/lib/supabase/server";

export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const approvals = await getContentApprovalsForCurrentUser();
  return NextResponse.json({ approvals });
}

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const profile = await getBusinessProfileForUser();
  if (!profile) {
    return NextResponse.json({ error: "Business profile not found" }, { status: 404 });
  }

  const body = (await request.json()) as ContentApprovalCreateInput;

  if (!body.content_type?.trim() || !body.title?.trim() || !body.content?.trim()) {
    return NextResponse.json({ error: "Missing required content fields" }, { status: 400 });
  }

  const approval = await submitContentForApproval(user.id, profile, body);
  return NextResponse.json({ approval });
}

export async function PATCH(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = (await request.json()) as ContentApprovalPatchInput;

  if (!body.id) {
    return NextResponse.json({ error: "Approval id is required" }, { status: 400 });
  }

  const approval = await patchContentApprovalForUser(user.id, body);
  if (!approval) {
    return NextResponse.json({ error: "Approval not found" }, { status: 404 });
  }

  return NextResponse.json({ approval });
}
