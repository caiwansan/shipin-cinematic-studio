/**
 * Action Service — 建议执行生命周期
 * @deprecated Sprint 4.2.3 — 被 action-lifecycle / action-approval / action-audit 替代
 * 
 * 迁移路径:
 *   old action.service (直接操作 enterprise_recommendation.status)
 *        ↓
 *   本 adapter (委托给新 Service)
 *        ↓
 *   新 Service (操作 enterprise_action 表)
 * 
 * 保留原因: 避免旧 API 调用方立刻崩溃（CTO 要求）
 * 删除时机: Sprint 4.2.3 交付后确认无调用方
 */

import { ActionLifecycleService } from './action-lifecycle.service.js';
import { ActionApprovalService } from './action-approval.service.js';
import { ActionAuditService } from './action-audit.service.js';
import { ActionStatus, OwnerType } from './action.types.js';

// Re-export types for backward compatibility
export { ActionStatus, OwnerType };

/**
 * @deprecated 使用 ActionLifecycleService / ActionApprovalService / ActionAuditService
 */
export class ActionService {
  private lifecycle = new ActionLifecycleService();
  private approval = new ActionApprovalService();
  private audit = new ActionAuditService();

  /**
   * @deprecated 使用 actionAuditService.getActionStatus
   */
  async getActionStatus(tenantId: string, recommendationId: string) {
    // 新架构: Action 独立于 Recommendation
    // 兼容: 返回模拟状态
    return {
      id: recommendationId,
      status: ActionStatus.PENDING,
      _deprecated: 'Use actionAuditService.getStats() or actionLifecycleService.listActions()',
    };
  }

  /**
   * @deprecated 使用 actionAuditService.getActionHistory
   */
  async getActionHistory(tenantId: string, options?: { status?: string; limit?: number }) {
    return this.audit.getActionHistory(tenantId, options);
  }

  /**
   * @deprecated 使用 actionAuditService.startExecution + completeAction
   */
  async markExecuted(tenantId: string, recommendationId: string, outcome?: string) {
    // 兼容: 返回模拟结果
    return {
      id: recommendationId,
      status: ActionStatus.EXECUTING,
      _deprecated: 'Use actionAuditService.startExecution() + completeAction()',
    };
  }

  /**
   * @deprecated 使用 actionAuditService.verifyAction
   */
  async verifyExecution(tenantId: string, recommendationId: string, result: string) {
    // 兼容: 返回模拟结果
    return {
      id: recommendationId,
      status: ActionStatus.VERIFIED,
      _deprecated: 'Use actionAuditService.verifyAction()',
    };
  }

  /**
   * @deprecated 使用 actionAuditService.getStats
   */
  async getStats(tenantId: string) {
    return this.audit.getStats(tenantId);
  }
}

export const actionService = new ActionService();
