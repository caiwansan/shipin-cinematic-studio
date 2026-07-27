/**
 * routes/agent-runtime.ts
 * Agent Runtime API — Fastify Plugin
 */

import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { createAgentRuntimeModule } from '../agent-runtime/runtime.module.js';
import { prisma } from '../utils/index.js';

const runtime = createAgentRuntimeModule(prisma);

/**
 * Phase 3.1.1 P0-4: Tenant Guard Middleware
 * 验证 JWT + 检查用户是否属于目标 Organization
 */
async function tenantGuard(request: FastifyRequest, reply: FastifyReply): Promise<void> {
  try {
    // Step 1: JWT 验证
    await request.jwtVerify();
    const decoded = request.user as any;
    
    // Step 2: 单设备登录检查
    if (decoded && decoded.id && decoded.tokenVersion !== undefined) {
      const dbUser = await prisma.user.findUnique({
        where: { id: decoded.id },
        select: { tokenVersion: true },
      });
      if (dbUser && dbUser.tokenVersion !== decoded.tokenVersion) {
        reply.status(401).send({ error: '未授权', message: '账号已在其他设备登录，请重新登录' });
        return;
      }
    }

    // Step 3: Tenant 隔离检查 — 用户必须属于目标 Organization
    const targetOrgId = (request.headers['x-organization-id'] as string) || '';
    if (targetOrgId && decoded?.id) {
      const { getOrganizationIdForUser } = await import('../services/enterprise/organization/identity-bootstrap.service.js');
      const userOrgId = await getOrganizationIdForUser(decoded.id);
      
      // 用户必须属于该组织，或者是系统管理员
      if (userOrgId && userOrgId !== targetOrgId && decoded.role !== 'admin') {
        reply.status(403).send({ 
          error: 'Forbidden', 
          message: '跨组织访问被拒绝',
          detail: `User org=${userOrgId}, Target org=${targetOrgId}`
        });
        return;
      }
    }
  } catch (err: any) {
    // JWT 验证失败
    if (!reply.sent) {
      reply.status(401).send({ error: '未授权', message: 'token 无效或已过期' });
    }
    return;
  }
}

/**
 * 从请求中提取 Runtime Context
 */
function extractContext(req: FastifyRequest) {
  const orgId = (req.headers['x-organization-id'] as string) || '';
  return {
    organizationId: orgId,
    actorId: (req.headers['x-user-id'] as string) || (req.user as any)?.id || '',
    permissionScope: ['agent:create', 'agent:read', 'agent:deploy', 'agent:pause', 'agent:resume', 'agent:archive', 'agent:execute'],
  };
}

export default async function agentRuntimeRoutes(fastify: FastifyInstance) {
  /**
   * POST /api/agent-runtime/agents
   * 创建 Agent
   */
  fastify.post('/api/agent-runtime/agents', { preHandler: tenantGuard }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const context = extractContext(request);
      const { name, role, agentType, description, goal, avatarUrl, knowledgeScope, capabilities } = request.body as any;

      const result = await runtime.orchestrator.createAgent(
        { name, role, agentType, description, goal, avatarUrl, knowledgeScope, capabilities },
        context
      );

      return reply.status(201).send({ success: true, data: result });
    } catch (error: any) {
      return reply.status(400).send({ success: false, error: error.message });
    }
  });

  /**
   * POST /api/agent-runtime/agents/:id/deploy
   * 部署 Agent
   */
  fastify.post('/api/agent-runtime/agents/:id/deploy', { preHandler: tenantGuard }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const context = extractContext(request);
      const { id } = request.params as any;
      await runtime.orchestrator.deployAgent(id, context);
      return reply.send({ success: true, message: 'Agent deployed' });
    } catch (error: any) {
      return reply.status(400).send({ success: false, error: error.message });
    }
  });

  /**
   * POST /api/agent-runtime/agents/:id/pause
   * 暂停 Agent
   */
  fastify.post('/api/agent-runtime/agents/:id/pause', { preHandler: tenantGuard }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const context = extractContext(request);
      const { id } = request.params as any;
      await runtime.orchestrator.pauseAgent(id, context);
      return reply.send({ success: true, message: 'Agent paused' });
    } catch (error: any) {
      return reply.status(400).send({ success: false, error: error.message });
    }
  });

  /**
   * POST /api/agent-runtime/agents/:id/resume
   * 恢复 Agent
   */
  fastify.post('/api/agent-runtime/agents/:id/resume', { preHandler: tenantGuard }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const context = extractContext(request);
      const { id } = request.params as any;
      await runtime.orchestrator.resumeAgent(id, context);
      return reply.send({ success: true, message: 'Agent resumed' });
    } catch (error: any) {
      return reply.status(400).send({ success: false, error: error.message });
    }
  });

  /**
   * POST /api/agent-runtime/agents/:id/archive
   * 归档 Agent
   */
  fastify.post('/api/agent-runtime/agents/:id/archive', { preHandler: tenantGuard }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const context = extractContext(request);
      const { id } = request.params as any;
      await runtime.orchestrator.archiveAgent(id, context);
      return reply.send({ success: true, message: 'Agent archived' });
    } catch (error: any) {
      return reply.status(400).send({ success: false, error: error.message });
    }
  });

  /**
   * GET /api/agent-runtime/agents/:id/status
   * 查询 Agent 状态
   */
  fastify.get('/api/agent-runtime/agents/:id/status', { preHandler: tenantGuard }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const context = extractContext(request);
      const { id } = request.params as any;
      const status = await runtime.orchestrator.getStatus(id, context);
      return reply.send({ success: true, data: { agentId: id, status } });
    } catch (error: any) {
      return reply.status(400).send({ success: false, error: error.message });
    }
  });

  /**
   * GET /api/agent-runtime/agents
   * 列出组织内所有 Agent
   */
  fastify.get('/api/agent-runtime/agents', { preHandler: tenantGuard }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const context = extractContext(request);
      const agents = await runtime.orchestrator.listAgents(context);
      return reply.send({ success: true, data: agents });
    } catch (error: any) {
      return reply.status(400).send({ success: false, error: error.message });
    }
  });

  /**
   * POST /api/agent-runtime/agents/:id/execute
   * 执行任务 — Sprint 2.2.2 新增
   */
  fastify.post('/api/agent-runtime/agents/:id/execute', { preHandler: tenantGuard }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const context = extractContext(request);
      const { id } = request.params as any;
      const { task } = request.body as any;

      if (!task) {
        return reply.status(400).send({ success: false, error: 'Missing task' });
      }

      const result = await runtime.orchestrator.executeTask(id, task, context);
      return reply.send({ success: true, data: result });
    } catch (error: any) {
      return reply.status(400).send({ success: false, error: error.message });
    }
  });

  // ═══════════════════════════════════════════════════════════════
  // Sprint 2.2.3 — Workflow Runtime
  // ═══════════════════════════════════════════════════════════════

  /**
   * POST /api/agent-runtime/workflows/definitions
   * 创建 Workflow 定义
   */
  fastify.post('/api/agent-runtime/workflows/definitions', { preHandler: tenantGuard }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const context = runtime.contextService.createContext(extractContext(request));
      const { name, description, nodes, edges } = request.body as any;

      const definition = await runtime.workflowDefinition.createDefinition(
        context.organizationId,
        name,
        nodes,
        edges,
        description
      );

      return reply.status(201).send({ success: true, data: definition });
    } catch (error: any) {
      return reply.status(400).send({ success: false, error: error.message });
    }
  });

  /**
   * POST /api/agent-runtime/workflows/definitions/:id/activate
   * 激活 Workflow 定义
   */
  fastify.post('/api/agent-runtime/workflows/definitions/:id/activate', { preHandler: tenantGuard }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { id } = request.params as any;
      await runtime.workflowDefinition.activateDefinition(id);
      return reply.send({ success: true, message: 'Workflow activated' });
    } catch (error: any) {
      return reply.status(400).send({ success: false, error: error.message });
    }
  });

  /**
   * GET /api/agent-runtime/workflows/definitions
   * 列出 Workflow 定义
   */
  fastify.get('/api/agent-runtime/workflows/definitions', { preHandler: tenantGuard }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const context = runtime.contextService.createContext(extractContext(request));
      const definitions = await runtime.workflowDefinition.listDefinitions(context.organizationId);
      return reply.send({ success: true, data: definitions });
    } catch (error: any) {
      return reply.status(400).send({ success: false, error: error.message });
    }
  });

  /**
   * POST /api/agent-runtime/workflows/start
   * 启动 Workflow Instance
   */
  fastify.post('/api/agent-runtime/workflows/start', { preHandler: tenantGuard }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const baseContext = extractContext(request);
      const { definitionId, input, agentId } = request.body as any;

      const context = runtime.contextService.createContext({
        ...baseContext,
        agentId: agentId || baseContext.agentId,
      });

      const result = await runtime.workflowEngine.startWorkflow(definitionId, input, context);
      return reply.status(201).send({ success: true, data: result });
    } catch (error: any) {
      return reply.status(400).send({ success: false, error: error.message });
    }
  });

  /**
   * POST /api/agent-runtime/workflows/:id/execute-next
   * 执行下一步
   */
  fastify.post('/api/agent-runtime/workflows/:id/execute-next', { preHandler: tenantGuard }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const context = runtime.contextService.createContext(extractContext(request));
      const { id } = request.params as any;

      const result = await runtime.workflowEngine.executeNextStep(id, context);
      return reply.send({ success: true, data: result });
    } catch (error: any) {
      return reply.status(400).send({ success: false, error: error.message });
    }
  });

  /**
   * POST /api/agent-runtime/workflows/:id/approve
   * 审批通过
   */
  fastify.post('/api/agent-runtime/workflows/:id/approve', { preHandler: tenantGuard }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const context = runtime.contextService.createContext(extractContext(request));
      const { id } = request.params as any;
      const { stepId } = request.body as any;

      await runtime.workflowEngine.approveStep(stepId, id, context);
      return reply.send({ success: true, message: 'Step approved' });
    } catch (error: any) {
      return reply.status(400).send({ success: false, error: error.message });
    }
  });

  /**
   * POST /api/agent-runtime/workflows/:id/reject
   * 审批拒绝
   */
  fastify.post('/api/agent-runtime/workflows/:id/reject', { preHandler: tenantGuard }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const context = runtime.contextService.createContext(extractContext(request));
      const { id } = request.params as any;
      const { stepId } = request.body as any;

      await runtime.workflowEngine.rejectStep(stepId, id, context);
      return reply.send({ success: true, message: 'Step rejected' });
    } catch (error: any) {
      return reply.status(400).send({ success: false, error: error.message });
    }
  });

  /**
   * GET /api/agent-runtime/workflows/:id/status
   * 查询 Workflow 状态
   */
  fastify.get('/api/agent-runtime/workflows/:id/status', { preHandler: tenantGuard }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { id } = request.params as any;
      const status = await runtime.workflowEngine.getWorkflowStatus(id);
      return reply.send({ success: true, data: status });
    } catch (error: any) {
      return reply.status(400).send({ success: false, error: error.message });
    }
  });
}
