export type {
  WeeklyApprovalPackage,
  WeeklyPackageItem,
  WeeklyPackagePlatformGroup,
  WeeklyPackageExecutiveSummary,
  GenerateWeeklyApprovalPackageInput,
} from "@/lib/weekly-approval-package/types";

export {
  WeeklyPackageItemKinds,
  WeeklyPackagePlatforms,
} from "@/lib/weekly-approval-package/types";

export {
  generateWeeklyApprovalPackageForUser,
  generateWeeklyApprovalPackageForCurrentUser,
} from "@/lib/weekly-approval-package/service";

export { toWeeklyApprovalPackagePreview } from "@/lib/weekly-approval-package/preview";
export type { WeeklyApprovalPackagePreview } from "@/lib/weekly-approval-package/preview";

export {
  createWeeklyPackageSignedToken,
  verifyWeeklyPackageSignedToken,
  resolveApprovalCenterRedirect,
  buildWeeklyPackageAbsoluteUrl,
  WeeklyPackageLinkError,
} from "@/lib/weekly-approval-package/signedLinks";

export {
  groupWeeklyPackageItems,
  sortWeeklyPackageItems,
  buildExecutiveSummary,
  mapContentTypeToPlatform,
  platformLabel,
  formatWeekLabel,
  truncateSummary,
  classifyContentDraftKind,
} from "@/lib/weekly-approval-package/group";

export {
  selectPendingApprovalsForWeeklyPackage,
  selectPendingReviewRepliesForWeeklyPackage,
  collectWeeklyPackageItems,
} from "@/lib/weekly-approval-package/collect";

export { renderWeeklyApprovalPackageHtml } from "@/lib/weekly-approval-package/renderHtml";
export { renderWeeklyApprovalPackageText } from "@/lib/weekly-approval-package/renderText";
