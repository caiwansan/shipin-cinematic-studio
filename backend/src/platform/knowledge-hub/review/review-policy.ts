// ════════════════════════════════════════════════════════════
// KH3-T004 — ApprovalPolicy
// ════════════════════════════════════════════════════════════
// All policy from first version. No hardcoded role checks.
// ════════════════════════════════════════════════════════════

import { ApprovalPolicy } from './types'

const DEFAULT_POLICY: ApprovalPolicy = {
  requiresReview: true,
  minimumReviewers: 1,
  allowSelfApproval: false,
  requiredRoles: ['reviewer'],
}

export class ReviewPolicyEngine {
  private policies: Map<string, ApprovalPolicy> = new Map()

  setPolicy(workspace: string, policy: Partial<ApprovalPolicy>) {
    const existing = this.policies.get(workspace) || { ...DEFAULT_POLICY }
    this.policies.set(workspace, { ...existing, ...policy })
  }

  getPolicy(workspace: string): ApprovalPolicy {
    return this.policies.get(workspace) || { ...DEFAULT_POLICY }
  }

  validateReviewers(reviewers: string[], workspace: string): { valid: boolean; error?: string } {
    const policy = this.getPolicy(workspace)
    if (reviewers.length < policy.minimumReviewers) {
      return {
        valid: false,
        error: `At least ${policy.minimumReviewers} reviewer(s) required`,
      }
    }
    return { valid: true }
  }
}
