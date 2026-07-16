import { NextResponse } from "next/server";
import { createServiceRoleClient, isSupabaseServiceRoleConfigured } from "@/lib/supabase/service";
import { requireAdminUser } from "@/lib/admin/requireAdminUser";
import {
  addPilotIssueRecord,
  buildAssistedPilotDashboard,
  patchPilotIssueRecord,
  registerPilotBusiness,
  setPilotChecklistStage,
} from "@/lib/assisted-pilot/service";
import { executePilotManualAction } from "@/lib/assisted-pilot/manualActions";
import { isValidStageKey } from "@/lib/assisted-pilot/checklist";
import {
  PilotIssueCategories,
  PilotIssueSeverities,
  PilotIssueStatuses,
  PilotManualActionKeys,
  PilotStageStatuses,
} from "@/lib/assisted-pilot/types";
import { toSafeUserErrorMessage } from "@/lib/security/safe-error-message";
import { ATTACH_DECLARATIVE_PRODUCTION_CRONS } from "@/lib/trigger/scheduleActivation";

export async function GET() {
  const auth = await requireAdminUser();
  if ("error" in auth) return auth.error;

  if (!isSupabaseServiceRoleConfigured()) {
    return NextResponse.json(
      {
        generatedAt: new Date().toISOString(),
        scheduleGateOpen: ATTACH_DECLARATIVE_PRODUCTION_CRONS,
        pilots: [],
        openIssues: [],
        error: "SUPABASE_SECRET_KEY is not configured.",
      },
      { status: 503 }
    );
  }

  const data = await buildAssistedPilotDashboard(createServiceRoleClient());
  return NextResponse.json(data);
}

export async function POST(request: Request) {
  const auth = await requireAdminUser();
  if ("error" in auth) return auth.error;

  if (!isSupabaseServiceRoleConfigured()) {
    return NextResponse.json({ error: "SUPABASE_SECRET_KEY is not configured." }, { status: 503 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  if (typeof body !== "object" || body === null) {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const record = body as Record<string, unknown>;
  const action = typeof record.action === "string" ? record.action.trim() : "";
  const supabase = createServiceRoleClient();

  try {
    switch (action) {
      case "register_pilot": {
        const userId = typeof record.userId === "string" ? record.userId.trim() : "";
        const businessProfileId =
          typeof record.businessProfileId === "string" ? record.businessProfileId.trim() : "";
        const displayName = typeof record.displayName === "string" ? record.displayName.trim() : "";
        if (!userId || !businessProfileId || !displayName) {
          return NextResponse.json(
            { error: "userId, businessProfileId, and displayName are required" },
            { status: 400 }
          );
        }
        const pilot = await registerPilotBusiness(supabase, {
          userId,
          businessProfileId,
          displayName,
          notes: typeof record.notes === "string" ? record.notes : null,
        });
        return NextResponse.json({ pilot });
      }
      case "update_checklist": {
        const pilotBusinessId =
          typeof record.pilotBusinessId === "string" ? record.pilotBusinessId.trim() : "";
        const stageKey = typeof record.stageKey === "string" ? record.stageKey.trim() : "";
        const status = typeof record.status === "string" ? record.status.trim() : "";
        if (!pilotBusinessId || !isValidStageKey(stageKey)) {
          return NextResponse.json({ error: "Valid pilotBusinessId and stageKey required" }, { status: 400 });
        }
        if (!(Object.values(PilotStageStatuses) as string[]).includes(status)) {
          return NextResponse.json({ error: "Invalid checklist status" }, { status: 400 });
        }
        const checklist = await setPilotChecklistStage(
          supabase,
          pilotBusinessId,
          stageKey,
          status as (typeof PilotStageStatuses)[keyof typeof PilotStageStatuses],
          typeof record.errorMessage === "string" ? record.errorMessage : null
        );
        return NextResponse.json({ checklist });
      }
      case "create_issue": {
        const severity = typeof record.severity === "string" ? record.severity.trim() : "";
        const category = typeof record.category === "string" ? record.category.trim() : "";
        const description = typeof record.description === "string" ? record.description.trim() : "";
        if (
          !(Object.values(PilotIssueSeverities) as string[]).includes(severity) ||
          !(Object.values(PilotIssueCategories) as string[]).includes(category) ||
          !description
        ) {
          return NextResponse.json(
            { error: "severity, category, and description are required" },
            { status: 400 }
          );
        }
        const issue = await addPilotIssueRecord(supabase, {
          pilotBusinessId:
            typeof record.pilotBusinessId === "string" ? record.pilotBusinessId.trim() : null,
          severity: severity as (typeof PilotIssueSeverities)[keyof typeof PilotIssueSeverities],
          category: category as (typeof PilotIssueCategories)[keyof typeof PilotIssueCategories],
          workflowStage: typeof record.workflowStage === "string" ? record.workflowStage : null,
          description,
          owner: typeof record.owner === "string" ? record.owner : null,
        });
        return NextResponse.json({ issue });
      }
      case "update_issue": {
        const id = typeof record.id === "string" ? record.id.trim() : "";
        if (!id) return NextResponse.json({ error: "id is required" }, { status: 400 });
        const status =
          typeof record.status === "string" &&
          (Object.values(PilotIssueStatuses) as string[]).includes(record.status)
            ? (record.status as (typeof PilotIssueStatuses)[keyof typeof PilotIssueStatuses])
            : undefined;
        const issue = await patchPilotIssueRecord(supabase, id, {
          status,
          owner: typeof record.owner === "string" ? record.owner : undefined,
          resolution: typeof record.resolution === "string" ? record.resolution : undefined,
        });
        return NextResponse.json({ issue });
      }
      case "manual_action": {
        const pilotBusinessId =
          typeof record.pilotBusinessId === "string" ? record.pilotBusinessId.trim() : "";
        const actionKey = typeof record.actionKey === "string" ? record.actionKey.trim() : "";
        if (!pilotBusinessId || !(Object.values(PilotManualActionKeys) as string[]).includes(actionKey)) {
          return NextResponse.json(
            { error: "pilotBusinessId and a supported actionKey are required" },
            { status: 400 }
          );
        }
        const result = await executePilotManualAction({
          supabase,
          pilotBusinessId,
          actionKey,
          triggeredBy: auth.user.id,
          publishingJobId:
            typeof record.publishingJobId === "string" ? record.publishingJobId : null,
        });
        return NextResponse.json({
          ...result,
          scheduleGateOpen: ATTACH_DECLARATIVE_PRODUCTION_CRONS,
        });
      }
      default:
        return NextResponse.json({ error: "Unknown action" }, { status: 400 });
    }
  } catch (error) {
    const message = toSafeUserErrorMessage(error, "Request failed");
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
