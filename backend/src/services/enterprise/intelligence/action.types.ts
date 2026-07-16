/**
 * Action Types & Enums — Sprint 4.2.3
 * CTO Frozen Contracts 定义
 */

// ─── Action Status (Contract 2) ───────────────────────────
export enum ActionStatus {
  PENDING    = 'pending',     // 待审批
  APPROVED   = 'approved',    // 已批准（可开始执行）
  EXECUTING  = 'executing',   // 执行中
  COMPLETED  = 'completed',   // 已完成（待验证）
  VERIFIED   = 'verified',    // 已验证（闭环）
  REJECTED   = 'rejected',    // 已拒绝
}

// ─── Allowed Transitions (Contract 2) ─────────────────────
export const ALLOWED_TRANSITIONS: Record<ActionStatus, ActionStatus[]> = {
  [ActionStatus.PENDING]:   [ActionStatus.APPROVED, ActionStatus.REJECTED],
  [ActionStatus.APPROVED]:  [ActionStatus.EXECUTING],
  [ActionStatus.EXECUTING]: [ActionStatus.COMPLETED],
  [ActionStatus.COMPLETED]: [ActionStatus.VERIFIED],
  [ActionStatus.VERIFIED]:  [],
  [ActionStatus.REJECTED]:  [],
};

// ─── Owner Type (Contract 3) ──────────────────────────────
export enum OwnerType {
  HUMAN     = 'human',       // 个人
  TEAM      = 'team',        // 团队
  AI_AGENT  = 'ai_agent',    // AI Agent (仅分配，不允许执行)
}

// ─── CTO 修正: Status History Entry ──────────────────────
export interface StatusHistoryEntry {
  from: ActionStatus | string;
  to: ActionStatus | string;
  actor: string;       // user_id 或 system
  note?: string;
  time: string;        // ISO timestamp
}

// ─── Create Action Input ──────────────────────────────────
export interface CreateActionInput {
  title: string;
  description?: string;
  ownerType: OwnerType | string;
  ownerId: string;
  priority?: string;        // P1/P2/P3/P4, default P3
  dueDate?: Date | string;
}

// ─── Approval Input (Contract 4) ─────────────────────────
export interface ApprovalInput {
  approvedBy: string;       // 审批人 User ID（必填）
  approvalNote?: string;    // 审批备注（可选）
}

// ─── Rejection Input (Contract 4) ────────────────────────
export interface RejectionInput {
  approvedBy: string;       // 审批人 User ID（必填）
  rejectReason: string;     // 拒绝原因（必填）
}

// ─── Execution Result ─────────────────────────────────────
export interface ExecutionResult {
  executionResult: string;  // 执行结果描述（必填）
}

// ─── Verification Input ───────────────────────────────────
export interface VerificationInput {
  verificationResult: string; // 验证结果（必填）
}

// ─── Action Stats ────────────────────────────────────────
export interface ActionStats {
  pending: number;
  approved: number;
  executing: number;
  completed: number;
  verified: number;
  rejected: number;
  total: number;
}

// ─── List Actions Options ─────────────────────────────────
export interface ListActionsOptions {
  status?: ActionStatus | string;
  ownerType?: OwnerType | string;
  ownerId?: string;
  decisionId?: string;
  limit?: number;
  offset?: number;
}

// ─── Custom Errors ───────────────────────────────────────
export class ActionNotFoundError extends Error {
  constructor(actionId: string) {
    super(`Action not found: ${actionId}`);
    this.name = 'ActionNotFoundError';
  }
}

export class InvalidStatusTransitionError extends Error {
  constructor(from: string, to: string) {
    super(`Invalid status transition: ${from} → ${to}`);
    this.name = 'InvalidStatusTransitionError';
  }
}

export class ActionNotApprovedError extends Error {
  constructor(actionId: string) {
    super(`Action ${actionId} has not been approved yet. Approval required before execution.`);
    this.name = 'ActionNotApprovedError';
  }
}
