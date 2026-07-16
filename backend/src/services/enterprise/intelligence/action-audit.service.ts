/**
 * Action Audit Service — Sprint 4.2.3
 * 职责: 执行追踪 + 验证完成 (CTO 命名: Audit > Track)
 * 冻结: APPROVED → EXECUTING → COMPLETED → VERIFIED
 * CTO: status != APPROVED → 禁止 EXECUTING（Service 层 enforce）
 */
import { prisma } from '../../../utils/index.js';
import { tenantOnly } from '../../../enterprise/reality/demo-boundary.js';
import { ActionStats } from './action.types.js';
import {
  ActionStatus,
  ExecutionResult,
  VerificationInput,
  StatusHistoryEntry,
  ActionNotFoundError,
  InvalidStatusTransitionError,
  ActionNotApprovedError,
} from './action.types.js';

export class ActionAuditService {
  /**
   * 开始执行
   * 状态流: APPROVED → EXECUTING
   * CTO: status != APPROVED → 禁止 EXECUTING
   */
  async startExecution(tenantId: string, actionId: string, actor: string): Promise<any> {
    const action = await prisma.enterpriseAction.findFirst({
      where: { id: actionId, ...tenantOnly(tenantId) },
    });
    if (!action) {
      throw new ActionNotFoundError(actionId);
    }

    // CTO: 必须从 APPROVED 才开始执行
    if (action.status !== ActionStatus.APPROVED) {
      throw new ActionNotApprovedError(actionId);
    }

    const now = new Date();
    const historyEntry: StatusHistoryEntry = {
      from: ActionStatus.APPROVED,
      to: ActionStatus.EXECUTING,
      actor,
      time: now.toISOString(),
    };

    return prisma.enterpriseAction.update({
      where: { id: actionId },
      data: {
        status: ActionStatus.EXECUTING,
        startedAt: now,
        statusHistory: { push: historyEntry as any },
        updatedAt: now,
      },
    });
  }

  /**
   * 标记完成
   * 状态流: EXECUTING → COMPLETED
   */
  async completeAction(tenantId: string, actionId: string, result: ExecutionResult, actor: string): Promise<any> {
    const action = await prisma.enterpriseAction.findFirst({
      where: { id: actionId, ...tenantOnly(tenantId) },
    });
    if (!action) {
      throw new ActionNotFoundError(actionId);
    }

    // CTO: 只能从 EXECUTING 流转
    if (action.status !== ActionStatus.EXECUTING) {
      throw new InvalidStatusTransitionError(action.status, ActionStatus.COMPLETED);
    }

    const now = new Date();
    const historyEntry: StatusHistoryEntry = {
      from: ActionStatus.EXECUTING,
      to: ActionStatus.COMPLETED,
      actor,
      note: result.executionResult,
      time: now.toISOString(),
    };

    return prisma.enterpriseAction.update({
      where: { id: actionId },
      data: {
        status: ActionStatus.COMPLETED,
        completedAt: now,
        executionResult: result.executionResult,
        statusHistory: { push: historyEntry as any },
        updatedAt: now,
      },
    });
  }

  /**
   * 验证完成
   * 状态流: COMPLETED → VERIFIED
   */
  async verifyAction(tenantId: string, actionId: string, verification: VerificationInput, actor: string): Promise<any> {
    const action = await prisma.enterpriseAction.findFirst({
      where: { id: actionId, ...tenantOnly(tenantId) },
    });
    if (!action) {
      throw new ActionNotFoundError(actionId);
    }

    // CTO: 只能从 COMPLETED 流转
    if (action.status !== ActionStatus.COMPLETED) {
      throw new InvalidStatusTransitionError(action.status, ActionStatus.VERIFIED);
    }

    const now = new Date();
    const historyEntry: StatusHistoryEntry = {
      from: ActionStatus.COMPLETED,
      to: ActionStatus.VERIFIED,
      actor,
      note: verification.verificationResult,
      time: now.toISOString(),
    };

    return prisma.enterpriseAction.update({
      where: { id: actionId },
      data: {
        status: ActionStatus.VERIFIED,
        verifiedAt: now,
        verificationResult: verification.verificationResult,
        statusHistory: { push: historyEntry as any },
        updatedAt: now,
      },
    });
  }

  /**
   * 统计
   */
  async getStats(tenantId: string): Promise<ActionStats> {
    const [pending, approved, executing, completed, verified, rejected] = await Promise.all([
      prisma.enterpriseAction.count({ where: { ...tenantOnly(tenantId), status: ActionStatus.PENDING } }),
      prisma.enterpriseAction.count({ where: { ...tenantOnly(tenantId), status: ActionStatus.APPROVED } }),
      prisma.enterpriseAction.count({ where: { ...tenantOnly(tenantId), status: ActionStatus.EXECUTING } }),
      prisma.enterpriseAction.count({ where: { ...tenantOnly(tenantId), status: ActionStatus.COMPLETED } }),
      prisma.enterpriseAction.count({ where: { ...tenantOnly(tenantId), status: ActionStatus.VERIFIED } }),
      prisma.enterpriseAction.count({ where: { ...tenantOnly(tenantId), status: ActionStatus.REJECTED } }),
    ]);

    return {
      pending,
      approved,
      executing,
      completed,
      verified,
      rejected,
      total: pending + approved + executing + completed + verified + rejected,
    };
  }

  /**
   * 获取 Action 历史（status_history JSONB 直接返回）
   */
  async getActionHistory(tenantId: string, options?: { status?: string; limit?: number }) {
    const where: any = tenantOnly(tenantId);
    if (options?.status) where.status = options.status;

    return prisma.enterpriseAction.findMany({
      where,
      orderBy: { updatedAt: 'desc' },
      take: options?.limit || 20,
      select: {
        id: true,
        title: true,
        status: true,
        ownerType: true,
        ownerId: true,
        statusHistory: true,
        createdAt: true,
        updatedAt: true,
      },
    });
  }
}

export const actionAuditService = new ActionAuditService();
