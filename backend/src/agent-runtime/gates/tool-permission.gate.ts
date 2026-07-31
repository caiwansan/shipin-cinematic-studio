/**
 * tool-permission.gate.ts — Sprint-10 Step 3A Task 2
 * ToolPermissionRuntimeGate: 统一 ToolExecutionGuard
 *
 * 职责：
 *   1. 集中管理 任务类型 → 所需工具 的映射关系
 *   2. 统一的权限检查入口，不分散在各个 service 层
 *   3. 所有工具调用必经此 Gate
 *
 * 解决问题：
 *   - 之前工具权限检查内联在 enterprise-agent-runtime.service.ts 的 executeTask() 中
 *   - 任何新执行路径（自主任务、定时任务）都需要重新实现同样的检查
 *   - 统一 Gate 后：所有路径调用同一方法，审计一致，维护单一
 *
 * 使用位置：
 *   executeTask() → ToolPermissionRuntimeGate.check()
 *   未来 autonomous task 也要经过此 Gate
 */

import { prisma } from '../../utils/index.js';
import { agentAuditService } from '../../services/enterprise/agent-audit.service.js';

// ─── 任务类型 → 所需工具映射（单一真相来源） ──────────

export const TASK_TOOL_MAP: Record<string, string[]> = {
  // Career Agent 工具
  profile_extraction: ['career_plan', 'resume_analyze'],
  job_search: ['job_search', 'job_match'],
  job_match: ['job_match'],
  interview_prepare: ['interview_prepare'],
  salary_analysis: ['salary_analysis'],

  // 招聘 Agent 工具
  talent_search: ['talent_search', 'talent_match'],
  resume_parse: ['resume_parse'],
  candidate_outreach: ['candidate_outreach'],

  // 新媒体运营 Agent 工具
  content_review: ['content_review'],
  hot_topic_scan: ['hot_topic_scan'],
  post_schedule: ['post_schedule'],
  data_pull: ['data_pull'],
};

// ─── 免检任务类型（LLM 对话类，不涉及工具调用） ──────

export const TOOL_EXEMPT_TASK_TYPES: string[] = [
  'general',          // 通用对话
  'generate_reply',   // LLM 回复生成
];

// ─── Types ──────────────────────────────────────────────

export interface ToolPermissionGateParams {
  taskType: string;
  profileId: string;
  agentInstanceId: string;
  tenantId: string;
  taskId: string;
  toolAllowList: string[];
}

export interface ToolPermissionGateResult {
  allowed: boolean;
  reason?: string;
  code: string;
  missingTools?: string[];
}

// ─── Gate ───────────────────────────────────────────────

export class ToolPermissionRuntimeGate {
  /**
   * 检查当前 taskType 所需的工具是否在 Agent 的 allow list 中
   *
   * 规则：
   *   1. TOOL_EXEMPT_TASK_TYPES → 直接通过（LLM 对话不调工具）
   *   2. 无 allow list（空/未配置） → 若需要工具则拒绝
   *   3. allow list 包含所需工具 → 通过
   *   4. allow list 不包含所需工具 → 拒绝 + 审计
   */
  static async check(params: ToolPermissionGateParams): Promise<ToolPermissionGateResult> {
    const { taskType, profileId, agentInstanceId, tenantId, taskId, toolAllowList } = params;

    // 1. 免检任务类型
    if (TOOL_EXEMPT_TASK_TYPES.includes(taskType)) {
      return { allowed: true, code: 'TOOL_EXEMPT' };
    }

    // 2. 查找 taskType 需要的工具
    const requiredTools = TASK_TOOL_MAP[taskType];
    if (!requiredTools || requiredTools.length === 0) {
      // 未知 taskType，但有豁免余地 — 通过，但记录
      console.warn(`[ToolPermissionGate] ⚠️ Unknown taskType="${taskType}", no tool mapping — allowing`);
      return { allowed: true, code: 'UNKNOWN_TASK_TYPE_ALLOWED' };
    }

    // 3. 检查 allow list 是否为空
    if (!toolAllowList || toolAllowList.length === 0) {
      const reason = `Tool permission denied: ${taskType} requires [${requiredTools.join(', ')}], but agent has no tools configured`;
      console.error(`[ToolPermissionGate] 🚫 ${reason}`);

      await this.denyAudit({ tenantId, profileId, taskId, agentInstanceId, taskType, requiredTools, allowedTools: [] });

      return {
        allowed: false,
        reason,
        code: 'TOOL_ALLOW_LIST_EMPTY',
        missingTools: requiredTools,
      };
    }

    // 4. 检查所需工具是否在 allow list 中
    const hasPermission = requiredTools.some(t => toolAllowList.includes(t));
    if (!hasPermission) {
      const reason = `Tool permission denied: ${taskType} requires [${requiredTools.join(', ')}], allowed: [${toolAllowList.join(', ')}]`;
      console.error(`[ToolPermissionGate] 🚫 ${reason}`);

      await this.denyAudit({ tenantId, profileId, taskId, agentInstanceId, taskType, requiredTools, allowedTools: toolAllowList });

      return {
        allowed: false,
        reason,
        code: 'TOOL_NOT_IN_ALLOW_LIST',
        missingTools: requiredTools,
      };
    }

    // 5. 通过 — 记录审计
    await agentAuditService.log({
      tenantId,
      agentId: profileId,
      taskId,
      action: 'tool_permission.granted',
      resource: 'tool_permission_gate',
      resourceId: agentInstanceId,
      metadata: { taskType, requiredTools, allowedTools: toolAllowList },
    }).catch(() => {});

    return { allowed: true, code: 'TOOL_PERMISSION_GRANTED' };
  }

  /**
   * 集中的审计拒绝日志记录
   */
  private static async denyAudit(params: {
    tenantId: string;
    profileId: string;
    taskId: string;
    agentInstanceId: string;
    taskType: string;
    requiredTools: string[];
    allowedTools: string[];
  }): Promise<void> {
    await agentAuditService.log({
      tenantId: params.tenantId,
      agentId: params.profileId,
      taskId: params.taskId,
      action: 'tool_permission.denied',
      resource: 'hermes_profile_binding',
      resourceId: params.agentInstanceId,
      metadata: {
        taskType: params.taskType,
        requiredTools: params.requiredTools,
        allowedTools: params.allowedTools,
        reason: 'TOOL_NOT_IN_ALLOW_LIST',
      },
    }).catch(() => {});
  }
}
