// ════════════════════════════════════════════════════════════
// KH3-T003 — Review Canonical Model
// ════════════════════════════════════════════════════════════

export interface ReviewComment {
  id: string
  author: string
  content: string
  createdAt: string
}

export type ReviewStatus = 'draft' | 'in_review' | 'changes_requested' | 'approved'

export interface ReviewRecord {
  id: string
  packageId: string
  status: ReviewStatus
  reviewers: string[]
  comments: ReviewComment[]
  decision: string | null
  createdAt: string
  completedAt: string | null
}

export interface ApprovalPolicy {
  requiresReview: boolean
  minimumReviewers: number
  allowSelfApproval: boolean
  requiredRoles: string[]
}

export interface ApprovalResult {
  approved: boolean
  reviewId: string
  packageId: string
  decision: string
  publishTargets: string[]
  completedAt: string
}
