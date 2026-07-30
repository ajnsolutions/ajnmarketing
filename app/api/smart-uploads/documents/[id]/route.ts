import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getSmartUploadDocumentForUser } from "@/lib/smart-uploads/persistence";
import {
  deleteSmartUploadDocumentForCurrentUser,
  getKnowledgeFactsForDocumentForCurrentUser,
} from "@/lib/smart-uploads/service";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const document = await getSmartUploadDocumentForUser(supabase, user.id, id);
  if (!document) {
    return NextResponse.json({ error: "Document not found" }, { status: 404 });
  }

  const facts = await getKnowledgeFactsForDocumentForCurrentUser(id);
  return NextResponse.json({ document, facts });
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const result = await deleteSmartUploadDocumentForCurrentUser(id);
  if (!result.success) {
    return NextResponse.json({ error: result.error ?? "Unable to delete document" }, { status: 400 });
  }

  return NextResponse.json({ success: true });
}
