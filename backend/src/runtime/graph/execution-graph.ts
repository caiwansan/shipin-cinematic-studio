/**
 * runtime/graph/execution-graph.ts — 唯一执行路径图
 *
 * Phase 4, Rule 1: 只存在一条执行路径
 * 所有 AI 任务必须经过此图的每个节点
 */

export const ExecutionGraph = {
  /** 入口点 */
  entry: 'enqueueTask',

  /** 唯一执行流程 */
  flow: [
    'queue',                    // enqueueTask → BullMQ queue
    'worker',                   // worker-runtime 消费
    'buildRuntimePayload',      // 构建 RuntimePayload（含解密 API Key）
    'validateRuntimePayload',   // assertRuntimeIntegrity 校验
    'modelAdapterRegistry.execute', // 唯一模型执行入口
    'provider',                 // 适配器调用 provider 服务
    'db',                       // 持久化结果
    'response',                 // 返回给用户
  ] as const,

  /** 宪法规则 */
  rules: {
    noWrapperExecute: true,           // 禁止包装执行
    noProxyExecute: true,             // 禁止代理执行
    noDuplicateExecutionLayer: true,  // 禁止重复执行层
    noBypassAdapterRegistry: true,    // 禁止绕过适配器注册表
    noFallbackProvider: true,         // 禁止回退 provider（零回退宪法）
  },
} as const
