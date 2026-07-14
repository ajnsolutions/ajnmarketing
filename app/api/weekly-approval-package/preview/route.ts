import { NextResponse } from "next/server";
import {
  generateWeeklyApprovalPackageForCurrentUser,
  toWeeklyApprovalPackagePreview,
} from "@/lib/weekly-approval-package";
import { resolveWeeklyPackageBaseUrl } from "@/lib/weekly-approval-package/signedLinks";

/**
 * Development / operator preview of the Weekly Approval Package for the
 * signed-in tenant. Never sends email.
 */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const format = url.searchParams.get("format") ?? "json";

  const pkg = await generateWeeklyApprovalPackageForCurrentUser({
    baseUrl: resolveWeeklyPackageBaseUrl(url.origin),
  });

  if (!pkg) {
    return NextResponse.json({ error: "Not authenticated or missing business profile." }, { status: 401 });
  }

  if (format === "html") {
    return new NextResponse(pkg.html, {
      status: 200,
      headers: { "Content-Type": "text/html; charset=utf-8" },
    });
  }

  if (format === "text") {
    return new NextResponse(pkg.text, {
      status: 200,
      headers: { "Content-Type": "text/plain; charset=utf-8" },
    });
  }

  return NextResponse.json(toWeeklyApprovalPackagePreview(pkg));
}
