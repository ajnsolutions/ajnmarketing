/**
 * Compose a Business Connections snapshot from resolved connections.
 */

import {
  CONNECTION_CATEGORY_LABELS,
  ConnectionCategories,
  ConnectionStatuses,
  type BusinessConnectionsSnapshot,
  type ConnectionCategoryId,
} from "@/lib/business-connections/types";
import { buildBusinessBrainReadiness } from "@/lib/business-connections/readiness";
import { recommendNextConnection } from "@/lib/business-connections/recommendNext";
import {
  resolveBusinessConnections,
  type LiveConnectionSignals,
} from "@/lib/business-connections/resolve";

const CATEGORY_ORDER: ConnectionCategoryId[] = [
  ConnectionCategories.CUSTOMER_FEEDBACK,
  ConnectionCategories.WEBSITE_AND_SEARCH,
  ConnectionCategories.ADVERTISING,
  ConnectionCategories.SOCIAL_MEDIA,
  ConnectionCategories.COMMUNICATIONS,
  ConnectionCategories.SCHEDULING_AND_COMMERCE,
  ConnectionCategories.CRM_AND_SALES,
  ConnectionCategories.DOCUMENTS,
];

export function composeBusinessConnectionsSnapshot(
  signals: LiveConnectionSignals,
  options?: { now?: Date; hasProfile?: boolean },
): BusinessConnectionsSnapshot {
  const now = options?.now ?? new Date();
  const connections = resolveBusinessConnections(signals);
  const readiness = buildBusinessBrainReadiness(connections);
  const recommendedNext = recommendNextConnection(connections);

  const byCategory = CATEGORY_ORDER.map((category) => ({
    category,
    label: CONNECTION_CATEGORY_LABELS[category],
    connections: connections
      .filter((c) => c.category === category)
      .sort((a, b) => a.priority - b.priority),
  })).filter((group) => group.connections.length > 0);

  const anyConnected = connections.some((c) => c.status === ConnectionStatuses.CONNECTED);
  let emptyState: BusinessConnectionsSnapshot["emptyState"] = null;
  if (options?.hasProfile === false) emptyState = "no_profile";
  else if (!anyConnected) emptyState = "nothing_connected";

  return {
    generatedAt: now.toISOString(),
    connections,
    byCategory,
    readiness,
    recommendedNext,
    emptyState,
  };
}
