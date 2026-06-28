import type { ApiResponse } from '../contracts/api/base.js';
import { FastifyInstance } from 'fastify'
import { prisma } from '../utils/index.js'

export default async function agentOrchestratorRoutes(fastify: FastifyInstance) {
  // ============================================
  // Agent CRUD
  // ============================================

  // 查询所有Agent定义
  fastify.get('/api/v1/admin/agents', async (_request, reply) => {
    let agents = await prisma.agentDef.findMany({ orderBy: { role: 'asc' } })
    if (agents.length > 0) return agents

    // 数据库空时自动写入默认内置 agent
    const defaults = [
      { id: 'agent_director', role: '剧情总指挥', name: '剧情总指挥', type: 'llm', model: 'deepseek-v3', status: 'active', systemPrompt: '你是一名资深影视编剧，负责统筹剧本拆解' },
      { id: 'agent_character', role: '角色设计师', name: '角色设计师', type: 'llm', model: 'deepseek-v3', status: 'active', systemPrompt: '你是顶级角色设计师，精通人物设定' },
      { id: 'agent_scene', role: '场景设计师', name: '场景设计师', type: 'llm', model: 'deepseek-v3', status: 'active', systemPrompt: '你是资深场景设计师，擅长构建环境' },
      { id: 'agent_storyboard', role: '分镜师', name: '分镜师', type: 'llm', model: 'deepseek-v3', status: 'active', systemPrompt: '你是经验丰富的分镜师，精通镜头语言' },
      { id: 'agent_prompt', role: '视频提示词优化师', name: '视频提示词优化师', type: 'llm', model: 'deepseek-v3', status: 'active', systemPrompt: '你是视频提示词优化专家' },
    ]
    for (const d of defaults) {
      await prisma.agentDef.create({ data: d })
    }
    agents = await prisma.agentDef.findMany({ orderBy: { role: 'asc' } })
    return agents
  })

  // 查询单个Agent
  fastify.get('/api/v1/admin/agents/:id', async (request, reply) => {
    const { id } = request.params as any
    const agent = await prisma.agentDef.findUnique({
      where: { id },
      include: { edgesFrom: true, edgesTo: true },
    })
    if (!agent) return reply.status(404).send({ error: 'Agent不存在' })
    return agent
  })

  // 新增Agent
  fastify.post('/api/v1/admin/agents', async (request, reply) => {
    const body = request.body as any
    const id = body.id || `agent_${Date.now()}`
    const agent = await prisma.agentDef.create({
      data: {
        id,
        role: body.role || body.name || '新Agent',
        name: body.name || body.role || '新Agent',
        model: body.model || 'deepseek-v3',
        type: body.type || 'llm',
        status: body.status || 'active',
        systemPrompt: body.systemPrompt || '',
        config: body.config || {},
      },
    })
    return agent
  })

  // 更新Agent
  fastify.put('/api/v1/admin/agents/:id', async (request, reply) => {
    const { id } = request.params as any
    const body = request.body as any
    const agent = await prisma.agentDef.update({
      where: { id },
      data: {
        role: body.role,
        name: body.name,
        model: body.model,
        status: body.status,
        systemPrompt: body.systemPrompt,
        config: body.config,
      },
    })
    return agent
  })

  // 删除Agent
  fastify.delete('/api/v1/admin/agents/:id', async (request, reply) => {
    const { id } = request.params as any
    await prisma.agentDef.delete({ where: { id } })
    return { success: true } satisfies ApiResponse<unknown>;

  })

  // 查询Agent边关系
  fastify.get('/api/v1/admin/agents/:id/edges', async (request, reply) => {
    const { id } = request.params as any
    const edges = await prisma.agentEdge.findMany({
      where: { OR: [{ fromAgentId: id }, { toAgentId: id }] },
    })
    return edges
  })

  // ============================================
  // Agent Edge CRUD
  // ============================================
  fastify.get('/api/agent-edges', async (_request, reply) => {
    const edges = await prisma.agentEdge.findMany()
    return edges
  })

  fastify.post('/api/agent-edges', async (request, reply) => {
    const body = request.body as any
    const edge = await prisma.agentEdge.create({
      data: {
        fromAgentId: body.fromAgentId,
        toAgentId: body.toAgentId,
        edgeType: body.edgeType || 'default',
        label: body.label || '',
        config: body.config || {},
      },
    })
    return edge
  })

  fastify.delete('/api/agent-edges/:id', async (request, reply) => {
    const { id } = request.params as any
    await prisma.agentEdge.delete({ where: { id } })
    return { success: true } satisfies ApiResponse<unknown>;

  })

  // ============================================
  // Workflow CRUD
  // ============================================
  fastify.get('/api/workflows', async (_request, reply) => {
    const workflows = await prisma.workflow.findMany({ orderBy: { name: 'asc' } })
    return workflows
  })

  fastify.post('/api/workflows', async (request, reply) => {
    const body = request.body as any
    const workflow = await prisma.workflow.create({
      data: {
        name: body.name || '新工作流',
        config: body.config || {},
      },
    })
    return workflow
  })

  fastify.put('/api/workflows/:id', async (request, reply) => {
    const { id } = request.params as any
    const body = request.body as any
    const workflow = await prisma.workflow.update({
      where: { id },
      data: {
        name: body.name,
        config: body.config,
      },
    })
    return workflow
  })

  fastify.delete('/api/workflows/:id', async (request, reply) => {
    const { id } = request.params as any
    await prisma.workflow.delete({ where: { id } })
    return { success: true } satisfies ApiResponse<unknown>;

  })

  // ============================================
  // Orchestrator
  // ============================================
  fastify.post('/api/orchestrator/run', async (request, reply) => {
    const body = request.body as any
    const execution = await prisma.agentExecution.create({
      data: {
        workflowId: body.workflowId || 'wf_default',
        input: body.input || {},
        status: 'queued',
      },
    })
    return execution
  })

  fastify.get('/api/orchestrator/runs', async (_request, reply) => {
    const runs = await prisma.agentExecution.findMany({
      orderBy: { createdAt: 'desc' },
      take: 20,
    })
    return runs
  })
}
