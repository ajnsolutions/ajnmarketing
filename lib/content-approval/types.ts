export type ContentApprovalStatus = "pending" | "approved" | "rejected" | "published";

export type ContentApproval = {
  id: string;
  user_id: string;
  business_profile_id: string;
  content_type: string;
  title: string;
  content: string;
  status: ContentApprovalStatus;
  source: string;
  version: number;
  ai_score: number | null;
  notes: string | null;
  marketing_recommendation_id: string | null;
  approved_at: string | null;
  approved_by: string | null;
  rejected_reason: string | null;
  /** Structured rejection reason code; see lib/recommendation-outcomes/types.ts. */
  rejection_reason_code: string | null;
  created_at: string;
  updated_at: string;
};

export type ContentApprovalCreateInput = {
  content_type: string;
  title: string;
  content: string;
  source?: string;
  ai_score?: number | null;
  notes?: string | null;
  marketing_recommendation_id?: string | null;
};

export type ContentApprovalPatchInput = {
  id: string;
  /** "more_like_this" records a positive-feedback outcome event only -- it never
   * mutates this approval's status/title/content. See
   * lib/recommendation-outcomes/service.ts's recordDoMoreLikeThisOutcome. */
  action?: "approve" | "reject" | "regenerate" | "update" | "more_like_this";
  title?: string;
  content?: string;
  notes?: string;
  rejected_reason?: string;
  /** Structured rejection reason code; see lib/recommendation-outcomes/types.ts. */
  rejection_reason_code?: string;
};

export type ContentApprovalStats = {
  pending: number;
  approvedThisMonth: number;
  rejected: number;
};
