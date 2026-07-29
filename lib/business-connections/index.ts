/**
 * Business Connections — public barrel.
 */

export { CONNECTION_CATALOG, catalogByCategory, getCatalogEntry } from "@/lib/business-connections/catalog";
export { composeBusinessConnectionsSnapshot } from "@/lib/business-connections/compose";
export { buildBusinessBrainReadiness } from "@/lib/business-connections/readiness";
export { recommendNextConnection } from "@/lib/business-connections/recommendNext";
export {
  resolveBusinessConnections,
  type LiveConnectionSignals,
} from "@/lib/business-connections/resolve";
export type {
  BusinessBrainReadinessItem,
  BusinessConnection,
  BusinessConnectionsSnapshot,
  ConnectionCatalogEntry,
  ConnectionCategoryId,
  ConnectionProviderId,
  ConnectionStatus,
  NextConnectionRecommendation,
} from "@/lib/business-connections/types";
export {
  CAPABILITY_LABELS,
  CONNECTION_CATEGORY_LABELS,
  CONNECTION_HEALTH_LABELS,
  CONNECTION_STATUS_LABELS,
  ConnectionCapabilities,
  ConnectionCategories,
  ConnectionHealthLevels,
  ConnectionProviderIds,
  ConnectionStatuses,
} from "@/lib/business-connections/types";
