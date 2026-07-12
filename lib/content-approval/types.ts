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
  action?: "approve" | "reject" | "regenerate" | "update";
  title?: string;
  content?: string;
  notes?: string;
  rejected_reason?: string;
};

export type ContentApprovalStats = {
  pending: number;
  approvedThisMonth: number;
  rejected: number;
};
