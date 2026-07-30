import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { listSmartUploadDocumentsForUser } from "@/lib/smart-uploads/persistence";
import { uploadSmartUploadDocumentForCurrentUser } from "@/lib/smart-uploads/service";

export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const documents = await listSmartUploadDocumentsForUser(supabase, user.id);
  return NextResponse.json({ documents });
}

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return NextResponse.json({ error: "Invalid upload request" }, { status: 400 });
  }

  const file = formData.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "A file is required" }, { status: 400 });
  }

  const arrayBuffer = await file.arrayBuffer();
  const { document, error } = await uploadSmartUploadDocumentForCurrentUser({
    fileName: file.name,
    contentType: file.type || "application/octet-stream",
    buffer: Buffer.from(arrayBuffer),
  });

  if (error || !document) {
    return NextResponse.json({ error: error ?? "Unable to upload document" }, { status: 400 });
  }

  return NextResponse.json({ document });
}
