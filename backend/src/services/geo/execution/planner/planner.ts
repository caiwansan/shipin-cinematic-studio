// ============================================================
// ExecutionPlanner — 执行规划器 (RC3-1)
// ============================================================
// 核心职责: PlanningRequest → ExecutionGraph
//
// 架构约束:
//   1. 只消费 Runtime Core，不修改（ADR-003）
//   2. 不调用 Runtime Scheduler
//   3. 不调用 CapabilityRouter（属于 RC3-2）
//   4. 不做成本/时间估算（属于 RC3-3）
//
// Planner 是平台统一入口，未来 Verification / Publishing / Knowledge Refresh
// 都经由各自的 Adapter 转为 PlanningRequest 后统一处理。

import { v4 as uuidv4 } from 'uuid'
import type { ExecutionGraph, ExecutionNode, ExecutionEdge } from '../types'
import { DEFAULT_RETRY_CONFIG } from '../types'
import { createExecutionContext } from '../context'
import type { PlanningRequest, PlanningResult } from './planner.types'
import { DependencyBuilder } from './dependency-builder'
import { GraphValidator } from './graph-validator'

export interface IExecutionPlanner {
  plan(
    request: PlanningRequest,
  ): Promise<{ graph: ExecutionGraph; result: PlanningResult }>
}

export class ExecutionPlanner implements IExecutionPlanner {
  constructor(
    private dependencyBuilder: DependencyBuilder = new DependencyBuilder(),
    private graphValidator: GraphValidator = new GraphValidator(),
  ) {}

  async plan(
    request: PlanningRequest,
  ): Promise<{ graph: ExecutionGraph; result: PlanningResult }> {
    // 1. 构建依赖边（手动 + 自动推断）
    const manualEdges = this.dependencyBuilder.buildEdges(request.steps)
    const inferredEdges = this.dependencyBuilder.inferDependencies(request.steps)
    const allEdges = [...manualEdges]

    // 合并推断依赖（避免重复）
    for (const edge of inferredEdges) {
      if (
        !allEdges.some((e) => e.from === edge.from && e.to === edge.to)
      ) {
        allEdges.push(edge)
      }
    }

    // 2. 校验 DAG
    const validation = this.graphValidator.validate(request.steps, allEdges)

    // 3. 转换为 ExecutionNode（RC1 类型）
    const nodes: ExecutionNode[] = request.steps.map((step) => ({
      id: step.id,
      label: step.label,
      type: step.type,
      capability: step.capability,
      providerPolicy: request.providerPolicy,
      config: { ...step.config },
      status: 'pending' as const,
      retryConfig: step.retryConfig ?? { ...DEFAULT_RETRY_CONFIG },
      timeout: step.timeout ?? 30000,
      dependencies: [...step.dependsOn],
      artifact: null,
      error: null,
      startedAt: null,
      completedAt: null,
    }))

    // 4. 转换为 ExecutionEdge（RC1 类型）
    const edges: ExecutionEdge[] = allEdges.map((e) => ({
      from: e.from,
      to: e.to,
    }))

    // 5. 构建 ExecutionContext（通过 RC1 工厂函数）
    const context = createExecutionContext({
      brandId: request.brandId,
      tenantId: request.tenantId,
      sourceType: request.sourceType,
      sourceId: request.sourceId,
      variables: {},
      providerPolicy: request.providerPolicy,
    })

    // 6. 构建 ExecutionGraph（符合 RC1 类型定义）
    const now = new Date().toISOString()
    const graph: ExecutionGraph = {
      id: uuidv4(),
      nodes,
      edges,
      status: 'pending',
      context,
      createdAt: now,
      updatedAt: now,
      completedAt: null,
    }

    // 7. 构建 PlanningResult
    const result: PlanningResult = {
      requestId: request.id,
      sourceType: request.sourceType,
      sourceId: request.sourceId,
      graph: {
        nodes: nodes.map((n) => ({
          id: n.id,
          label: n.label,
          type: n.type,
          capability: n.capability,
          dependencies: [...n.dependencies],
          config: { ...n.config },
          retryConfig: { ...n.retryConfig },
          timeout: n.timeout,
        })),
        edges: allEdges.map((e) => ({ from: e.from, to: e.to })),
      },
      validation,
      createdAt: now,
    }

    return { graph, result }
  }
}
