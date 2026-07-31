/**
 * memory-access.gate.ts — Sprint-10 Step 3A Task 1
 * Memory Access Gate: executeTask 内强制 validateAccess()
 *
 * 职责：
 *   1. 在执行任务前验证 agent 的 memory namespace 归属权
 *   2. 确保 caller 的 tenantId 与 agent 的 memory namespace 一致
 *   3. 拒绝跨租户内存访问，记录审计
 *
 * 使用位置：
 *   enterprise-agent-runtime.service.ts → executeTask()
 *   在读取 HermesProfileBinding 后立即调用
 */

import { prisma } from '../../utils/index.js';
import { agentAuditService } from '../../services/enterprise/agent-audit.service.js';

export interface MemoryAccessGateParams {
  tenantId: string;
  organizationId?: string;
  agentInstanceId: string;
  profileId: string;
  taskId: string;
  hermesAgentId?: string;
  memoryNamespace?: string;
}

export interface MemoryAccessGateResult {
  allowed: boolean;
  reason?: string;
  code?: string;
}

export class MemoryAccessGate {
  /**
   * 验证 Agent 的 memory namespace 访问权限
   *
   * 规则：
   *   - binding 的 memoryNamespace 必须以 tenantId 开头
   *   - 若无 binding → 不阻断（legacy 兼容），但记录警告
   *   - 跨租户访问 → 阻断 + 审计
   */
  static async validate(params: MemoryAccessGateParams): Promise<MemoryAccessGateResult> {
    const { tenantId, organizationId, agentInstanceId, profileId, taskId, hermesAgentId, memoryNamespace } = params;

    // 1. 无 binding 信息 → legacy 兼容，记录警告但不阻断
    if (!hermesAgentId || !memoryNamespace) {
      console.warn(`[MemoryAccessGate] ⚠️ No HermesProfileBinding: instanceId=${agentInstanceId.slice(0, 8)}, profileId=${profileId.slice(0, 8)} — legacy mode`);
      return { allowed: true, code: 'LEGACY_NO_BINDING' };
    }

    // 2. 验证 memoryNamespace 归属权
    // 规则: memoryNamespace = tenant_{tenantId_short}_{role}
    // 确保 namespace 中的 tenant 前缀与调用方 tenantId 一致
    const orgKey = organizationId || tenantId;
    const nsPrefix = `tenant_${orgKey.slice(0, 8)}`;
    const nsLower = memoryNamespace.toLowerCase();

    if (!nsLower.startsWith(nsPrefix.toLowerCase())) {
      const reason = `Memory namespace mismatch: "${memoryNamespace}" does not belong to tenant "${orgKey.slice(0, 8)}..."`;
      console.error(`[MemoryAccessGate] 🚫 CROSS-TENANT: ${reason}`);

      // 记录审计 — 跨租户访问事件
      await agentAuditService.log({
        tenantId,
        agentId: profileId,
        taskId,
        action: 'memory.access_denied',
        resource: 'hermes_profile_binding',
        resourceId: agentInstanceId,
        metadata: {
          hermesAgentId,
          memoryNamespace,
          expectedPrefix: nsPrefix,
          reason: 'CROSS_TENANT_NAMESPACE',
        },
      }).catch(() => {});

      return {
        allowed: false,
        reason,
        code: 'CROSS_TENANT_NAMESPACE',
      };
    }

    // 3. 验证通过 — 记录审计
    await agentAuditService.log({
      tenantId,
      agentId: profileId,
      taskId,
      action: 'memory.access_granted',
      resource: 'hermes_profile_binding',
      resourceId: agentInstanceId,
      metadata: {
        hermesAgentId,
        memoryNamespace,
        validated: true,
      },
    }).catch(() => {});

    return { allowed: true, code: 'ACCESS_GRANTED' };
  }
}
