import { NextResponse } from "next/server";
import { deleteTestimonial } from "@/lib/testimonials/service";
import { createClient } from "@/lib/supabase/server";

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const deleted = await deleteTestimonial(supabase, user.id, id);

  if (!deleted) {
    return NextResponse.json({ error: "Testimonial not found" }, { status: 404 });
  }

  return NextResponse.json({ success: true });
}
