/**
 * workflow/workflow-engine.ts — Workflow DAG 执行引擎
 *
 * 职责：
 *   1. 接收前端请求（type + input）
 *   2. 根据 type 自动匹配 User Config V2
 *   3. 调用 ModelAdapterRegistry.execute()
 *   4. 返回执行结果
 *
 * 不做什么：
 *   ❌ 不确定 Provider
 *   ❌ 不存 DAG 状态（v1 为单节点执行）
 *   ❌ 不做并行 DAG 调度
 *
 * ── 执行链 ──
 *   Frontend: POST /api/workflow/execute-node { type, input }
 *   → resolveNodeExecutionParams(type, userConfig)
 *   → modelAdapterRegistry.execute(runtime, model, input)
 *   → result
 */

import { ModelAdapterRegistry } from '../model-adapters/registry.js'
import type { RuntimePayload } from '../runtime/runtime-payload.js'
import { resolveNodeExecutionParams, UserModelConfigV2Flat } from './node-resolver.js'
import type { WorkflowNodeType, ExecuteNodeRequest, ExecuteNodeResponse } from './types.js'

export class WorkflowEngine {
  private adapterRegistry: ModelAdapterRegistry

  constructor(adapterRegistry: ModelAdapterRegistry) {
    this.adapterRegistry = adapterRegistry
  }

  /**
   * 执行一个 DAG 节点
   *
   * @param type         节点类型（如 "llm.optimize"）
   * @param input        执行输入
   * @param userConfig   用户配置（V2 扁平结构）
   * @param userId       用户 ID（用于 state/trace）
   * @param context      上游上下文
   */
  async executeNode(
    type: WorkflowNodeType,
    input: Record<string, any>,
    userConfig: UserModelConfigV2Flat,
    userId: string,
    context?: Record<string, any>,
  ): Promise<ExecuteNodeResponse> {
    const nodeId = `wf_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`

    // 1. manual.confirm 直接跳过
    if (type === 'manual.confirm') {
      return {
        success: true,
        nodeId,
        type,
        status: 'skipped',
      }
    }

    // 2. 解析 Provider
    let params: ReturnType<typeof resolveNodeExecutionParams>
    try {
      params = resolveNodeExecutionParams(type, userConfig)
    } catch (err: any) {
      return {
        success: false,
        nodeId,
        type,
        status: 'failed',
        error: err.message,
      }
    }

    // 无 Provider 直接跳过
    if (!params) {
      return {
        success: true,
        nodeId,
        type,
        status: 'skipped',
      }
    }

    // 3. 构建 RuntimePayload（不带 config）
    const runtime: RuntimePayload = {
      userId,
      provider: params.provider,
      apiKey: params.apiKey,
    } as RuntimePayload

    // 4. 构建适配器输入（合并 input + context）
    const adapterInput: Record<string, any> = { ...input }
    if (context) {
      adapterInput.context = context
    }

    // 5. 执行
    try {
      const result = await this.adapterRegistry.execute(
        runtime,
        params.model,
        { ...adapterInput } as any,
      )

      return {
        success: true,
        nodeId,
        type,
        status: 'success',
        output: result,
      }
    } catch (err: any) {
      return {
        success: false,
        nodeId,
        type,
        status: 'failed',
        error: err.message,
      }
    }
  }
}

let _instance: WorkflowEngine | null = null

export function initWorkflowEngine(adapterRegistry: ModelAdapterRegistry): WorkflowEngine {
  _instance = new WorkflowEngine(adapterRegistry)
  return _instance
}

export function getWorkflowEngine(): WorkflowEngine {
  if (!_instance) {
    throw new Error('WorkflowEngine 未初始化')
  }
  return _instance
}
