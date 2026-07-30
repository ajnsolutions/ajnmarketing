import "server-only";

import { getBusinessConnectionsSnapshotForCurrentUser } from "@/lib/business-connections/service";
import { getCustomerSetupSnapshotForCurrentUser } from "@/lib/customer-setup/service";
import { getBusinessProfileForUser } from "@/lib/business-profile-server";
import { buildGuidedSetupExperience } from "@/lib/guided-setup/buildGuidedSetupExperience";
import type { GuidedSetupExperience } from "@/lib/guided-setup/types";

export async function getGuidedSetupExperienceForCurrentUser(): Promise<GuidedSetupExperience | null> {
  const [setup, connections, profile] = await Promise.all([
    getCustomerSetupSnapshotForCurrentUser(),
    getBusinessConnectionsSnapshotForCurrentUser().catch(() => null),
    getBusinessProfileForUser().catch(() => null),
  ]);

  if (!setup) return null;

  return buildGuidedSetupExperience({
    setup,
    connections,
    businessName: profile?.business_name,
  });
}
