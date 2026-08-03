/**
 * SPRINT-ECO-03 — KAOR Runtime Capability Matrix（能力矩阵 SSOT）
 * 生态 Runtime 能力声明的唯一数据源。
 * 每个能力：code / 名称 / 描述 / 实现状态（delegated=委托现有 Hermes，contract=仅契约）/ Hermes 映射点
 */
import type { KAORCapability } from './kaor-runtime.interface.js';

export const KAOR_CAPABILITIES: KAORCapability[] = [
  {
    code: 'agent.lifecycle',
    name: 'Agent 生命周期',
    description: '创建 / 启动 / 暂停 / 停止 / 查询 AI 员工运行实例',
    status: 'delegated',
    hermesMapping: 'IAgentLifecycle (createAgent/deployAgent/pauseAgent/archiveAgent/getStatus) + AgentRuntimeAdapter',
  },
  {
    code: 'permission',
    name: '权限校验',
    description: '运行时权限点检查（agent:create / agent:deploy / tool 权限等）',
    status: 'delegated',
    hermesMapping: 'RuntimeContextService.hasPermission(context, permission)',
  },
  {
    code: 'workflow',
    name: '工作流执行',
    description: '多步工作流启动 / 推进 / 审批 / 状态查询',
    status: 'delegated',
    hermesMapping: 'WorkflowEngineService (startWorkflow/executeNextStep/approveStep/getWorkflowStatus)',
  },
  {
    code: 'scheduler',
    name: '任务调度',
    description: '定时任务 / 周期性调度登记与执行',
    status: 'delegated',
    hermesMapping: 'AgentScheduler + AgentScheduleService (createSchedule/toggleSchedule/markRun)',
  },
  {
    code: 'memory',
    name: '记忆存取',
    description: '命名空间隔离的记忆读写（memoryNamespace = tenant/{tenantId}/agent/{agentInstanceId}）',
    status: 'contract',
    hermesMapping: 'HermesProfileBinding.memoryNamespace + OpenClaw Runtime Memory（执行待 Kunlun Media Local App Sprint）',
  },
  {
    code: 'tool',
    name: '工具执行',
    description: '工具调用权限校验 + 委托执行（插件工具执行待 ECO-04+，系统工具走现有网关）',
    status: 'contract',
    hermesMapping: 'ToolPermissionService (generateMatrix/getBindingTools) + MemoryAccessGate（插件工具执行待后续 Sprint）',
  },
];

/** Runtime Capability Registry 种子：kaor runtime 身份 + 能力声明 */
export const KAOR_RUNTIME_SEED = {
  runtimeId: 'kaor',
  name: 'KAOR Runtime',
  description: 'Kunlun AI Operating Runtime — 生态 Runtime 契约层，委托现有 Hermes Runtime',
  version: '0.1.0',
  adapter: 'hermes-adapter',
  status: 'active',
};

/** 能力 code → 详情（快速查询） */
export function getKaorCapability(code: string): KAORCapability | undefined {
  return KAOR_CAPABILITIES.find((c) => c.code === code);
}

export function kaorCapabilityCodes(): string[] {
  return KAOR_CAPABILITIES.map((c) => c.code);
}
