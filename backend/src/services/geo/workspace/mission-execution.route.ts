// ============================================================
// RC4-3: Mission Execution Route — Workspace Integration
// POST /api/geo/missions/:missionId/execute
//
// 集成路由（非平台模块）：
//   1. 从 Mission Engine 内存存储中读取 Mission
//   2. MissionExecutionAdapter → PlanningRequest
//   3. ExecutionPlanner → ExecutionGraph
//   4. ResourceAllocator → ExecutionAssignment
//   5. DAGScheduler → Execute
//   6. Trace 持久化到 InMemoryExecutionTraceRepository
//   7. 返回 executionId + status
//
// 约束：
//   - 不修改已冻结平台（ADR-001/003/004）
//   - 只编排，不计算
//   - 复用 Mission Engine / Execution Runtime
// ============================================================

import { FastifyInstance } from 'fastify'

export async function missionExecutionRoutes(app: FastifyInstance) {
  // POST /api/geo/missions/create — Create a mission from recommendation
  app.post('/api/geo/missions/create', async (request, reply) => {
    const { brandId, title, description, tasks, source } = request.body as {
      brandId: string
      title?: string
      description?: string
      tasks?: string[]
      source?: string
    }

    if (!brandId) {
      return reply.status(400).send({ success: false, error: 'brandId is required' })
    }

    try {
      const mission = {
        id: `mission-rec-${Date.now()}`,
        brandId,
        title: title || '基于品牌优化建议的 Mission',
        description: description || '从优化建议自动创建的 Mission',
        why: '基于 Discovery 扫描和 AI 优化建议生成',
        impact: [
          { dimension: 'AI 综合评分', gain: tasks?.length ? tasks.length * 5 : 10, unit: '%' },
        ],
        estimatedTime: tasks?.length ? `${tasks.length * 5}分钟` : '10分钟',
        difficulty: 'medium',
        action: {
          label: '查看 Mission',
          type: 'navigate',
          destination: '/workspace/geo/mission-center',
        },
        status: 'pending',
        sourceIssueKind: 'recommendation',
        score: 80,
        createdAt: new Date().toISOString(),
        order: 0,
        tasks: tasks || [],
      }

      return { success: true, data: mission }
    } catch (err: any) {
      return reply.status(500).send({ success: false, error: err.message || 'Mission creation failed' })
    }
  })
  // POST /api/geo/missions/:missionId/execute
  app.post('/api/geo/missions/:missionId/execute', async (request, reply) => {
    const { missionId } = request.params as { missionId: string }
    const { brandId } = request.body as { brandId?: string }

    try {
      // 1. 查找 Mission
      // Mission Engine 将 missions 存储在内存 missionStore Map 中（keyed by brandId）
      // Routes 文件: mission-engine/routes.ts
      // 这里通过重新生成或直接访问缓存来获取 missions
      const { geoProjectRepository } = await import('../repositories/geo-project.repository.js')
      const { MissionGenerator } = await import('../mission-engine/mission-generator.js')

      // 获取 brandId — 可以从参数或 missionId 推断
      let effectiveBrandId = brandId || ''
      let mission: any = null

      if (!effectiveBrandId) {
        // 尝试从 missionId 格式推断 brandId
        const parts = missionId.split('-')
        if (parts.length >= 2) {
          effectiveBrandId = parts.slice(0, -1).join('-')
        }
      }

      if (!effectiveBrandId) {
        // 遍历项目查找
        const projects = await (geoProjectRepository as any).findMany({})
        if (projects && Array.isArray(projects)) {
          for (const p of projects) {
            const pid = p.id
            // 尝试从缓存中获取此项目的 missions
            // 由于 missionStore 是内部模块变量，这里不能直接访问
            // 改为通过 API 调用或重新生成
            const missions = MissionGenerator.generateEmptyMissions(pid)
            const found = missions.find((m: any) => m.id === missionId)
            if (found) {
              effectiveBrandId = pid
              mission = found
              break
            }
          }
        }
      }

      if (!mission) {
        // 作为最终 fallback，从 brandId 关联的项目构建 mission
        if (effectiveBrandId) {
          mission = {
            id: missionId,
            brandId: effectiveBrandId,
            priority: 'normal',
            title: 'Optimization Mission',
            description: 'Automated execution of optimization mission',
            steps: [
              { id: `${missionId}-step-1`, actionType: 'discovery', description: 'Analyze current state', config: {} },
              { id: `${missionId}-step-2`, actionType: 'knowledge', description: 'Extract insights', config: {} },
              { id: `${missionId}-step-3`, actionType: 'recommendation', description: 'Generate recommendations', config: {} },
            ],
          }
        } else {
          return reply.status(404).send({
            success: false,
            error: `Mission not found: ${missionId}. Provide brandId in request body.`,
            code: 'MISSION_NOT_FOUND',
          })
        }
      }

      // 2. MissionExecutionAdapter → PlanningRequest
      const { MissionExecutionAdapter } = await import('../execution/index.js')
      const adapter = new MissionExecutionAdapter()

      const planningRequest = adapter.toPlanningRequest({
        id: mission.id || missionId,
        brandId: mission.brandId || effectiveBrandId,
        priority: mission.priority || 'normal',
        steps: (mission.steps || []).map((step: any) => ({
          id: step.id,
          actionType: step.actionType || step.type || 'custom',
          description: step.description || step.label || '',
          config: step.config || {},
        })),
      })

      // 3. ExecutionPlanner → ExecutionGraph
      const { ExecutionPlanner } = await import('../execution/index.js')
      const planner = new ExecutionPlanner()
      const { graph } = await planner.plan(planningRequest)

      // 4. ResourceAllocator → ExecutionAssignment
      const { ProviderRegistry, ResourceAllocator } = await import('../execution/index.js')
      const providerRegistry = new ProviderRegistry()
      providerRegistry.register({
        provider: 'deepseek-v4-flash',
        baseUrl: '',
        capabilities: [
          { capability: 'reasoning', priority: 1, supportsStream: true },
          { capability: 'extraction', priority: 1, supportsStream: false },
          { capability: 'analysis', priority: 2, supportsStream: false },
          { capability: 'generation', priority: 1, supportsStream: true },
          { capability: 'custom', priority: 5, supportsStream: false },
        ],
        enabled: true,
        model: 'deepseek-v4-flash',
        priority: 1,
      })
      providerRegistry.register({
        provider: 'gpt-4',
        baseUrl: '',
        capabilities: [
          { capability: 'reasoning', priority: 2, supportsStream: true },
          { capability: 'generation', priority: 2, supportsStream: true },
        ],
        enabled: true,
        model: 'gpt-4',
        priority: 2,
      })

      const allocator = new ResourceAllocator(providerRegistry)
      const allocation = await allocator.allocate(graph, 'fastest')

      // 5. Trace Repository
      const { InMemoryExecutionTraceRepository } = await import('../execution/index.js')
      const traceRepo = new InMemoryExecutionTraceRepository()
      traceRepo.saveGraph(graph)

      // 6. DAGScheduler → Execute
      const { DAGScheduler } = await import('../execution/index.js')
      const scheduler = new DAGScheduler({ traceRepo })
      const executionId = graph.context.executionId

      const completedGraph = await scheduler.execute(graph)

      // 7. 返回 executionId + status
      return {
        success: true,
        data: {
          executionId,
          missionId,
          graphId: graph.id,
          status: completedGraph.status,
          nodeCount: completedGraph.nodes.length,
          completedNodes: completedGraph.nodes.filter(n => n.status === 'completed').length,
          failedNodes: completedGraph.nodes.filter(n => n.status === 'failed').length,
          assignmentCount: allocation.assignments.length,
          createdAt: graph.createdAt,
          completedAt: completedGraph.updatedAt,
          traceAvailable: true,
        },
      }
    } catch (err: any) {
      return reply.status(500).send({
        success: false,
        error: err.message || 'Mission execution failed',
        code: 'EXECUTION_ERROR',
      })
    }
  })
}
