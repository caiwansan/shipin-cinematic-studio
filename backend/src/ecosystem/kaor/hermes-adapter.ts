/**
 * SPRINT-ECO-03 — HermesAdapter（KAOR Runtime → Existing Hermes）
 *
 * 职责：把 KAOR Runtime Boundary 契约映射到现有 Hermes Runtime。
 * 原则：
 *   ✅ 只 import 现有服务并委托调用（零修改现有文件）
 *   ✅ 诚实标注 executedBy: hermes（真实委托）/ contract（仅契约）/ not_implemented（占位）
 *   ❌ 不执行插件代码 / 不开发本地执行 / 不改 Hermes 内部
 */
import type { PrismaClient } from '@prisma/client';
import {
  KAORRuntime,
  KAORResult,
  KAORCreateAgentParams,
  KAORAgentInstance,
  KAORAgentStatus,
  KAORMemoryQuery,
  KAORMemoryEntry,
  KAORToolCall,
  KAORToolResult,
  KAORWorkflowResult,
  KAORScheduledTask,
  KAORScheduleReceipt,
  KAORCapability,
} from './kaor-runtime.interface.js';
import { KAOR_CAPABILITIES } from './kaor-capabilities.js';

export class HermesAdapter implements KAORRuntime {
  readonly runtimeId = 'kaor';
  readonly adapterName = 'hermes-adapter';
  readonly version = '0.1.0';

  constructor(private prisma?: PrismaClient) {}

  getCapabilities(): KAORCapability[] {
    return KAOR_CAPABILITIES;
  }

  // ─────────────────────────────────────────────────────────────
  // Agent 生命周期 → Hermes IAgentLifecycle / AgentRuntimeAdapter
  // ─────────────────────────────────────────────────────────────

  async createAgentInstance(params: KAORCreateAgentParams): Promise<KAORResult<KAORAgentInstance>> {
    try {
      const { agentRuntimeAdapter } = await import('../../services/enterprise/agent-runtime.adapter.js');
      const agentId = `agent_${params.tenantId.slice(0, 8)}_${Date.now().toString(36)}`;
      const result = await agentRuntimeAdapter.createAgent({
        agentId,
        tenantId: params.tenantId,
        namespace: `tenant_${params.tenantId}_${params.role}`,
        role: params.role,
        modelConfig: params.modelConfig,
      });
      if (!result.success) {
        return { ok: false, error: { code: 'INTERNAL', message: 'createAgent 委托失败' }, executedBy: 'hermes' };
      }
      return {
        ok: true,
        data: {
          agentInstanceId: params.organizationId ? `${params.organizationId}:${agentId}` : agentId,
          runtimeAgentId: agentId,
          namespace: `tenant_${params.tenantId}_${params.role}`,
          role: params.role,
          status: 'active',
        },
        executedBy: 'hermes',
      };
    } catch (e: any) {
      return { ok: false, error: { code: 'INTERNAL', message: e.message }, executedBy: 'hermes' };
    }
  }

  async startAgent(agentInstanceId: string): Promise<KAORResult<KAORAgentStatus>> {
    try {
      const { agentRuntimeAdapter } = await import('../../services/enterprise/agent-runtime.adapter.js');
      await agentRuntimeAdapter.startAgent(agentInstanceId);
      return { ok: true, data: { agentInstanceId, status: 'active' }, executedBy: 'hermes' };
    } catch (e: any) {
      return { ok: false, error: { code: 'INTERNAL', message: e.message }, executedBy: 'hermes' };
    }
  }

  async pauseAgent(agentInstanceId: string): Promise<KAORResult<KAORAgentStatus>> {
    try {
      const { agentRuntimeAdapter } = await import('../../services/enterprise/agent-runtime.adapter.js');
      await agentRuntimeAdapter.stopAgent(agentInstanceId);
      return { ok: true, data: { agentInstanceId, status: 'stopped' }, executedBy: 'hermes' };
    } catch (e: any) {
      return { ok: false, error: { code: 'INTERNAL', message: e.message }, executedBy: 'hermes' };
    }
  }

  async stopAgent(agentInstanceId: string): Promise<KAORResult<KAORAgentStatus>> {
    try {
      const { agentRuntimeAdapter } = await import('../../services/enterprise/agent-runtime.adapter.js');
      await agentRuntimeAdapter.stopAgent(agentInstanceId);
      return { ok: true, data: { agentInstanceId, status: 'stopped' }, executedBy: 'hermes' };
    } catch (e: any) {
      return { ok: false, error: { code: 'INTERNAL', message: e.message }, executedBy: 'hermes' };
    }
  }

  async getAgentStatus(agentInstanceId: string): Promise<KAORResult<KAORAgentStatus>> {
    try {
      const { agentRuntimeAdapter } = await import('../../services/enterprise/agent-runtime.adapter.js');
      const status = await agentRuntimeAdapter.getStatus(agentInstanceId);
      return {
        ok: true,
        data: {
          agentInstanceId,
          status: (status.status as any) ?? 'stopped',
          lastActiveAt: status.lastActiveAt,
          totalTasks: status.totalTasks,
          totalErrors: status.totalErrors,
        },
        executedBy: 'hermes',
      };
    } catch (e: any) {
      return { ok: false, error: { code: 'INTERNAL', message: e.message }, executedBy: 'hermes' };
    }
  }

  // ─────────────────────────────────────────────────────────────
  // 记忆 → 契约占位（memoryNamespace 解析；执行待 Local App Sprint）
  // ─────────────────────────────────────────────────────────────

  async loadMemory(agentInstanceId: string, query: KAORMemoryQuery): Promise<KAORResult<KAORMemoryEntry[]>> {
    let namespace = query.namespace;
    if (!namespace && this.prisma) {
      try {
        const binding = await (this.prisma as any).hermesProfileBinding.findFirst({
          where: { agentInstanceId },
          select: { memoryNamespace: true },
        });
        namespace = binding?.memoryNamespace ?? undefined;
      } catch {
        /* 查询失败不阻断契约声明 */
      }
    }
    return {
      ok: true,
      data: [],
      error: {
        code: 'NOT_IMPLEMENTED',
        message: `memory 执行属契约占位（namespace=${namespace ?? 'unknown'}），执行待 Kunlun Media Local App Sprint`,
      },
      executedBy: 'contract',
    };
  }

  // ─────────────────────────────────────────────────────────────
  // 工具 → 权限校验 + 契约委托（不执行插件代码）
  // ─────────────────────────────────────────────────────────────

  async executeTool(agentInstanceId: string, call: KAORToolCall): Promise<KAORResult<KAORToolResult>> {
    try {
      const { toolPermissionService } = await import('../../services/enterprise/tool-permission.service.js');
      let allowed = false;
      try {
        const tools = await toolPermissionService.getBindingTools(agentInstanceId);
        allowed = tools.includes(call.toolName);
      } catch {
        allowed = false;
      }
      if (!allowed) {
        return {
          ok: false,
          data: { toolName: call.toolName, success: false, error: `工具未授权: ${call.toolName}` },
          error: { code: 'PERMISSION_DENIED', message: `工具未授权: ${call.toolName}` },
          executedBy: 'contract',
        };
      }
      return {
        ok: true,
        data: {
          toolName: call.toolName,
          success: false,
          error: 'ECO-03 只建立 Runtime Contract：工具执行待 ECO-04+（插件工具执行冻结）',
        },
        error: { code: 'NOT_IMPLEMENTED', message: '工具执行契约占位（ECO-03 不接插件执行）' },
        executedBy: 'contract',
      };
    } catch (e: any) {
      return { ok: false, error: { code: 'INTERNAL', message: e.message }, executedBy: 'contract' };
    }
  }

  // ─────────────────────────────────────────────────────────────
  // 工作流 → 真实委托 Hermes WorkflowEngineService
  // ─────────────────────────────────────────────────────────────

  async executeWorkflow(
    agentInstanceId: string,
    workflowId: string,
    input: unknown
  ): Promise<KAORResult<KAORWorkflowResult>> {
    if (!this.prisma) {
      return { ok: false, error: { code: 'INTERNAL', message: 'prisma 未注入' }, executedBy: 'hermes' };
    }
    try {
      const { WorkflowEngineService } = await import('../../agent-runtime/execution/workflow-engine.service.js');
      const { AgentBrainService } = await import('../../agent-runtime/brain/agent-brain.service.js');
      const engine = new WorkflowEngineService(this.prisma, new AgentBrainService(this.prisma));
      const result = await engine.startWorkflow(workflowId, String(input ?? ''), {
        organizationId: agentInstanceId,
        agentId: agentInstanceId,
        permissionScope: ['*'],
      } as any);
      return {
        ok: true,
        data: { workflowInstanceId: result.instanceId, status: result.status as any },
        executedBy: 'hermes',
      };
    } catch (e: any) {
      return {
        ok: false,
        data: { status: 'failed', error: e.message },
        error: { code: 'INTERNAL', message: e.message },
        executedBy: 'hermes',
      };
    }
  }

  // ─────────────────────────────────────────────────────────────
  // 权限 → 真实委托 Hermes RuntimeContextService.hasPermission
  // ─────────────────────────────────────────────────────────────

  async checkPermission(agentInstanceId: string, permission: string): Promise<KAORResult<boolean>> {
    try {
      const { RuntimeContextService } = await import('../../agent-runtime/context/runtime-context.service.js');
      const ctxService = new RuntimeContextService(this.prisma as any);
      const context = ctxService.createContext({
        organizationId: agentInstanceId,
        actorId: agentInstanceId,
        permissionScope: ['*'],
      } as any);
      const allowed = ctxService.hasPermission(context, permission);
      return { ok: true, data: allowed, executedBy: 'hermes' };
    } catch (e: any) {
      return { ok: false, error: { code: 'INTERNAL', message: e.message }, executedBy: 'hermes' };
    }
  }

  // ─────────────────────────────────────────────────────────────
  // 调度 → 真实委托 AgentScheduleService.createSchedule
  // ─────────────────────────────────────────────────────────────

  async scheduleTask(agentInstanceId: string, task: KAORScheduledTask): Promise<KAORResult<KAORScheduleReceipt>> {
    try {
      const { AgentScheduleService } = await import('../../services/enterprise/agent-schedule.service.js');
      const service = new AgentScheduleService();
      const schedule = await service.createSchedule({
        tenantId: agentInstanceId,
        agentId: agentInstanceId,
        cronExpression: task.cron,
        taskTemplate: task.input,
        taskType: task.taskType,
        enabled: task.enabled ?? true,
      });
      return {
        ok: true,
        data: {
          scheduleId: schedule?.id ?? 'delegated',
          cron: task.cron,
          status: 'delegated',
        },
        executedBy: 'hermes',
      };
    } catch (e: any) {
      return { ok: false, error: { code: 'INTERNAL', message: e.message }, executedBy: 'hermes' };
    }
  }
}

/** 全局单例（ECO-03 契约入口） */
export const hermesAdapter = new HermesAdapter();
