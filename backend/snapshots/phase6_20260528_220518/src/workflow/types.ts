/**
 * workflow/types.ts — Workflow DAG 类型定义
 *
 * Workflow 不决定 provider，provider 来自 User Config V2。
 * Workflow 只描述"做什么"，不描述"用什么做"。
 */

/** DAG 节点类型 — 每个类型对应一种执行能力 */
export type WorkflowNodeType =
  /** LLM 文本转换（优化提示词、改写、翻译等） */
  | 'llm.optimize'
  /** 图片生成 */
  | 'image.generate'
  /** 视频生成 */
  | 'video.generate'
  /** TTS 语音合成 */
  | 'tts.generate'
  /** 人工确认步骤（跳过执行） */
  | 'manual.confirm'

/** DAG 节点 */
export interface WorkflowNode {
  /** 唯一 ID */
  id: string
  /** 节点类型 — 决定了路由到哪个 Provider 能力 */
  type: WorkflowNodeType
  /** 执行输入 */
  input: Record<string, any>
  /** 依赖的节点 ID 列表（当前未实现并行 DAG，保留用于 future） */
  dependsOn?: string[]
  /** 执行输出（运行后填充） */
  output?: any
  /** 执行状态 */
  status?: 'pending' | 'running' | 'success' | 'failed' | 'skipped'
  /** 错误信息 */
  error?: string
}

/** 完整 DAG */
export interface WorkflowGraph {
  id: string
  nodes: WorkflowNode[]
}

/** 执行请求（前端→后端） */
export interface ExecuteNodeRequest {
  type: WorkflowNodeType
  input: Record<string, any>
  /** 依赖的上游节点输出（可选，注入上下文） */
  context?: Record<string, any>
}

/** 执行响应 */
export interface ExecuteNodeResponse {
  success: boolean
  nodeId: string
  type: WorkflowNodeType
  status: string
  output?: any
  error?: string
}
