/**
 * Action Approval Service — Sprint 4.2.3 + 4.2.3.1
 * 职责: Human Approval Gate (Contract 4) + Governance Permission (CTO 4.2.3.1)
 * 冻结: Decision → Action → Human Approval (with Permission) → Execution
 * CTO: 数据库层 + Service 层双重 enforce
 * CTO 4.2.3.1: Approval 必须校验 Role.capabilities → action.approve
 */
import { prisma } from '../../../utils/index.js';
import { tenantOnly } from '../../../enterprise/reality/demo-boundary.js';
import { enterpriseContextService, CAPABILITIES, PermissionDeniedError } from '../enterprise-context.service.js';
import { governanceAuditService } from '../governance-audit.service.js';
import {
  ActionStatus,
  ApprovalInput,
  RejectionInput,
  StatusHistoryEntry,
  ActionNotFoundError,
  InvalidStatusTransitionError,
} from './action.types.js';

export class ActionApprovalService {
  /**
   * 审批通过（带权限校验 — 4.2.3.1 推荐入口）
   * CTO: 必须校验 GovUser 的 Role.capabilities → action.approve
   * @param governanceTenantId Governance Tenant.id
   * @param actionId EnterpriseAction.id
   * @param approval 审批信息
   * @param govUserId 审批人 GovUser.id
   */
  async approveActionWithPermission(
    governanceTenantId: string,
    actionId: string,
    approval: ApprovalInput,
    govUserId: string,
  ): Promise<any> {
    // 1. 查找 GovUser
    const govUser = await prisma.govUser.findUnique({ where: { id: govUserId } });
    if (!govUser) {
      throw new PermissionDeniedError(`GovUser not found: ${govUserId}`);
    }

    // 2. 查找 Role
    const role = govUser.roleId
      ? await prisma.role.findUnique({ where: { id: govUser.roleId } })
      : null;

    // 3. 校验 Capability
    const caps = this.parseCapabilities(role?.capabilities);
    if (!caps.includes(CAPABILITIES.ACTION_APPROVE)) {
      throw new PermissionDeniedError(
        `Required: ${CAPABILITIES.ACTION_APPROVE}. Role(${role?.code || 'none'}): [${caps.join(', ')}]`
      );
    }

    // 4. 查找 Action（使用 governanceTenantId）
    const action = await prisma.enterpriseAction.findFirst({
      where: { id: actionId, governanceTenantId },
    });
    if (!action) {
      throw new ActionNotFoundError(actionId);
    }

    // 5. Status enforce
    if (action.status !== ActionStatus.PENDING) {
      throw new InvalidStatusTransitionError(action.status, ActionStatus.APPROVED);
    }

    // 6. 写入
    const now = new Date();
    const historyEntry: StatusHistoryEntry = {
      from: ActionStatus.PENDING,
      to: ActionStatus.APPROVED,
      actor: approval.approvedBy,
      actorGovUserId: govUserId,
      note: approval.approvalNote || null,
      time: now.toISOString(),
    };

    const updated = await prisma.enterpriseAction.update({
      where: { id: actionId },
      data: {
        status: ActionStatus.APPROVED,
        approvedBy: approval.approvedBy,
        approvedByGovUserId: govUserId,
        approvedAt: now,
        approvalNote: approval.approvalNote || null,
        statusHistory: { push: historyEntry as any },
        updatedAt: now,
      },
    });

    // 7. 同步 Audit
    await governanceAuditService.logActionStatusChange({
      governanceTenantId,
      actorId: govUserId,
      actionId,
      fromStatus: ActionStatus.PENDING,
      toStatus: ActionStatus.APPROVED,
    });

    return updated;
  }

  /**
   * 审批通过（旧入口 — @deprecated 4.2.3.1）
   * 保持向后兼容，内部调用旧逻辑
   */
  async approveAction(tenantId: string, actionId: string, approval: ApprovalInput): Promise<any> {
    const action = await prisma.enterpriseAction.findFirst({
      where: { id: actionId, ...tenantOnly(tenantId) },
    });
    if (!action) {
      throw new ActionNotFoundError(actionId);
    }

    if (action.status !== ActionStatus.PENDING) {
      throw new InvalidStatusTransitionError(action.status, ActionStatus.APPROVED);
    }

    const now = new Date();
    const historyEntry: StatusHistoryEntry = {
      from: ActionStatus.PENDING,
      to: ActionStatus.APPROVED,
      actor: approval.approvedBy,
      note: approval.approvalNote || null,
      time: now.toISOString(),
    };

    return prisma.enterpriseAction.update({
      where: { id: actionId },
      data: {
        status: ActionStatus.APPROVED,
        approvedBy: approval.approvedBy,
        approvedAt: now,
        approvalNote: approval.approvalNote || null,
        statusHistory: { push: historyEntry as any },
        updatedAt: now,
      },
    });
  }

  /**
   * 审批拒绝（旧入口 — @deprecated 4.2.3.1）
   * 保持向后兼容
   */
  async rejectAction(tenantId: string, actionId: string, rejection: RejectionInput): Promise<any> {
    const action = await prisma.enterpriseAction.findFirst({
      where: { id: actionId, ...tenantOnly(tenantId) },
    });
    if (!action) {
      throw new ActionNotFoundError(actionId);
    }

    if (action.status !== ActionStatus.PENDING) {
      throw new InvalidStatusTransitionError(action.status, ActionStatus.REJECTED);
    }

    const now = new Date();
    const historyEntry: StatusHistoryEntry = {
      from: ActionStatus.PENDING,
      to: ActionStatus.REJECTED,
      actor: rejection.approvedBy,
      note: rejection.rejectReason,
      time: now.toISOString(),
    };

    return prisma.enterpriseAction.update({
      where: { id: actionId },
      data: {
        status: ActionStatus.REJECTED,
        approvedBy: rejection.approvedBy,
        approvedAt: now,
        approvalNote: rejection.rejectReason,
        statusHistory: { push: historyEntry as any },
        updatedAt: now,
      },
    });
  }

  // ─── Private ───

  private parseCapabilities(raw: string | undefined | null): string[] {
    if (!raw) return [];
    try {
      return JSON.parse(raw);
    } catch {
      return [];
    }
  }
}

export const actionApprovalService = new ActionApprovalService();
