/**
 * GEO Workflow State Route
 *
 * GET  /api/v1/geo/projects/:projectId/workflow  — 获取 workflow state
 * POST /api/v1/geo/projects/:projectId/workflow/transition — 推进阶段
 */

import { FastifyInstance } from 'fastify'
import { prisma } from '../../../utils'

const STAGE_ACTIONS: Record<string, string[]> = {
  CREATED: ['START_SCAN'],
  DISCOVERING: [],
  UNDERSTANDING: ['VIEW_KNOWLEDGE', 'GENERATE_RECOMMENDATIONS'],
  OPTIMIZING: ['VIEW_MISSIONS', 'CREATE_MISSION'],
  VERIFYING: ['RUN_VERIFICATION'],
  PUBLISHING: ['START_PUBLISH'],
  OBSERVING: ['VIEW_GROWTH'],
}

const STAGE_ORDER = ['CREATED', 'DISCOVERING', 'UNDERSTANDING', 'OPTIMIZING', 'VERIFYING', 'PUBLISHING', 'OBSERVING']

const NEXT_STAGE_MAP: Record<string, string> = {
  CREATED: 'DISCOVERING',
  DISCOVERING: 'UNDERSTANDING',
  UNDERSTANDING: 'OPTIMIZING',
  OPTIMIZING: 'VERIFYING',
  VERIFYING: 'PUBLISHING',
  PUBLISHING: 'OBSERVING',
}

export default async function geoWorkflowRoutes(fastify: FastifyInstance) {
  // GET workflow state
  fastify.get('/api/v1/geo/projects/:projectId/workflow', { preHandler: [] }, async (request, reply) => {
    const { projectId } = request.params as any

    // Get or create workflow state
    let ws = await prisma.gEOWorkflowState.findUnique({ where: { projectId } })
    if (!ws) {
      ws = await prisma.gEOWorkflowState.create({
        data: {
          projectId,
          stage: 'CREATED',
          completedStages: JSON.stringify([]),
          availableActions: JSON.stringify(STAGE_ACTIONS['CREATED']),
        },
      })
    }

    return {
      success: true,
      data: {
        id: ws.id,
        projectId: ws.projectId,
        stage: ws.stage,
        completedStages: JSON.parse(ws.completedStages || '[]'),
        availableActions: JSON.parse(ws.availableActions || '[]'),
        updatedAt: ws.updatedAt.toISOString(),
      },
    }
  })

  // POST transition to next stage
  fastify.post('/api/v1/geo/projects/:projectId/workflow/transition', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    const { projectId } = request.params as any
    const { action } = request.body as { action?: string }

    if (!action) {
      return reply.status(400).send({ success: false, error: '缺少 action 参数' })
    }

    let ws = await prisma.gEOWorkflowState.findUnique({ where: { projectId } })
    if (!ws) {
      return reply.status(404).send({ success: false, error: '未找到 workflow state' })
    }

    if (!STAGE_ACTIONS[ws.stage]?.includes(action)) {
      return reply.status(400).send({ success: false, error: `阶段 ${ws.stage} 不支持操作 ${action}` })
    }

    const currentStage = ws.stage
    const completedStages: string[] = JSON.parse(ws.completedStages || '[]')

    if (!completedStages.includes(currentStage)) {
      completedStages.push(currentStage)
    }

    const nextStage = NEXT_STAGE_MAP[currentStage]
    if (!nextStage) {
      return reply.status(400).send({ success: false, error: '已是最终阶段' })
    }

    ws = await prisma.gEOWorkflowState.update({
      where: { projectId },
      data: {
        stage: nextStage,
        completedStages: JSON.stringify(completedStages),
        availableActions: JSON.stringify(STAGE_ACTIONS[nextStage] || []),
      },
    })

    return {
      success: true,
      data: {
        id: ws.id,
        projectId: ws.projectId,
        stage: ws.stage,
        completedStages: JSON.parse(ws.completedStages || '[]'),
        availableActions: JSON.parse(ws.availableActions || '[]'),
        updatedAt: ws.updatedAt.toISOString(),
      },
    }
  })
}
