import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { reprocessSmartUploadDocumentForCurrentUser } from "@/lib/smart-uploads/service";

export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const result = await reprocessSmartUploadDocumentForCurrentUser(id);
  if (!result.success) {
    return NextResponse.json({ error: result.error ?? "Unable to reprocess document" }, { status: 400 });
  }

  return NextResponse.json({ success: true });
}
