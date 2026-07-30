import { NextResponse } from "next/server";
import { getBusinessProfileForUser } from "@/lib/business-profile-server";
import {
  ingestBulkPastedTestimonials,
  ingestCsvTestimonials,
  ingestManualTestimonial,
  ingestWebsiteImportedTestimonials,
  listTestimonials,
} from "@/lib/testimonials/service";
import { createClient } from "@/lib/supabase/server";

export async function GET() {
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

  const testimonials = await listTestimonials(supabase, user.id, profile.id);
  return NextResponse.json({ testimonials });
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

  const body = (await request.json()) as {
    mode?: "manual" | "bulk_paste" | "csv_import" | "website_import";
    quote?: string;
    authorName?: string;
    authorTitle?: string;
    sourceUrl?: string;
    rating?: number;
    pastedText?: string;
    csvText?: string;
    websiteUrl?: string;
  };

  const userId = user.id;
  const businessProfileId = profile.id;

  switch (body.mode) {
    case "manual": {
      if (!body.quote?.trim()) {
        return NextResponse.json({ error: "quote is required" }, { status: 400 });
      }
      const testimonial = await ingestManualTestimonial(supabase, {
        userId,
        businessProfileId,
        testimonial: {
          quote: body.quote.trim(),
          authorName: body.authorName?.trim() || null,
          authorTitle: body.authorTitle?.trim() || null,
          sourceUrl: body.sourceUrl?.trim() || null,
          rating: body.rating ?? null,
        },
      });
      if (!testimonial) {
        return NextResponse.json({ error: "Failed to save testimonial" }, { status: 500 });
      }
      return NextResponse.json({ testimonials: [testimonial], errors: [] });
    }

    case "bulk_paste": {
      if (!body.pastedText?.trim()) {
        return NextResponse.json({ error: "pastedText is required" }, { status: 400 });
      }
      const result = await ingestBulkPastedTestimonials(supabase, {
        userId,
        businessProfileId,
        pastedText: body.pastedText,
      });
      return NextResponse.json(result);
    }

    case "csv_import": {
      if (!body.csvText?.trim()) {
        return NextResponse.json({ error: "csvText is required" }, { status: 400 });
      }
      const result = await ingestCsvTestimonials(supabase, {
        userId,
        businessProfileId,
        csvText: body.csvText,
      });
      return NextResponse.json(result);
    }

    case "website_import": {
      if (!body.websiteUrl?.trim()) {
        return NextResponse.json({ error: "websiteUrl is required" }, { status: 400 });
      }
      const result = await ingestWebsiteImportedTestimonials(supabase, {
        userId,
        businessProfileId,
        websiteUrl: body.websiteUrl.trim(),
      });
      return NextResponse.json(result);
    }

    default:
      return NextResponse.json(
        { error: "mode must be one of manual, bulk_paste, csv_import, website_import" },
        { status: 400 },
      );
  }
}
