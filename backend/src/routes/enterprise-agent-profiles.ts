/**
 * Enterprise Agent Profile Routes v1.1
 * 
 * AI Employee Management API
 * /api/enterprise/agent-profiles
 */

import type { FastifyInstance } from 'fastify';
import { enterpriseAgentProfileService } from '../services/enterprise/enterprise-agent-profile.service';
import { prisma } from '../utils/index.js';
import { enterpriseAgentService } from '../services/enterprise/enterprise-agent.service.js';
import { getOrganizationIdForUser } from '../services/enterprise/organization/identity-bootstrap.service.js';

/** Unified identity resolver: get orgId from JWT user. Guarantees non-null string. */
async function resolveOrgId(request: any): Promise<string> {
  const user = request.user as any;
  const userId = user?.id
  if (!userId) return ''
  
  // Prefer user.tenantId if it looks like a proper org UUID (not the user's own ID)
  if (user?.tenantId && user.tenantId !== userId) {
    return user.tenantId
  }
  
  // Fall back to unified resolver
  try {
    const orgId = await getOrganizationIdForUser(userId)
    return orgId || ''
  } catch {
    // If resolver fails, return userId as last resort (legacy compatibility)
    return userId
  }
}

export async function registerEnterpriseAgentProfileRoutes(app: FastifyInstance) {
  
  // 认证hook
  app.addHook('preHandler', app.authenticate);
  
  /**
   * GET /api/enterprise/agent-profiles
   * 获取租户所有AI员工列表
   * 
   * Query params:
   *   types  (可选)  逗号分隔的 agentType 白名单，例如 ?types=recruiter,interview,marketing
   *   exlude (可选)  逗号分隔的 agentType 黑名单，例如 ?exclude=career_advisor
   */
  app.get('/', async (request, reply) => {
    try {
      const tenantId = await resolveOrgId(request);
      const query = request.query as { types?: string; exclude?: string };
      
      const filter: { types?: string[]; exclude?: string[] } = {};
      if (query.types) filter.types = query.types.split(',').map(t => t.trim()).filter(Boolean);
      if (query.exclude) filter.exclude = query.exclude.split(',').map(t => t.trim()).filter(Boolean);
      
      const agents = await enterpriseAgentProfileService.listAgents(tenantId, filter);
      
      return reply.send({
        code: 0,
        message: 'success',
        data: agents
      });
    } catch (error: any) {
      request.log.error(error);
      return reply.status(500).send({ code: 500, message: error.message || 'Internal error' });
    }
  });
  
  /**
   * GET /api/enterprise/agent-profiles/overview
   * 获取今日部门概览（CEO驾驶舱用）
   */
  app.get('/overview', async (request, reply) => {
    try {
      const tenantId = await resolveOrgId(request);
      
      const overview = await enterpriseAgentProfileService.getDepartmentOverview(tenantId);
      
      return reply.send({
        code: 0,
        message: 'success',
        data: overview
      });
    } catch (error: any) {
      request.log.error(error);
      return reply.status(500).send({ code: 500, message: error.message || 'Internal error' });
    }
  });
  
  /**
   * GET /api/enterprise/agent-profiles/:id
   * 获取单个AI员工详情
   */
  app.get('/:id', async (request, reply) => {
    try {
      const tenantId = await resolveOrgId(request);
      const { id } = request.params as { id: string };
      
      const agent = await enterpriseAgentProfileService.getAgent(tenantId, id);
      if (!agent) {
        return reply.status(404).send({ code: 404, message: 'AI员工不存在' });
      }
      
      return reply.send({
        code: 0,
        message: 'success',
        data: agent
      });
    } catch (error: any) {
      request.log.error(error);
      return reply.status(500).send({ code: 500, message: error.message || 'Internal error' });
    }
  });
  
  /**
   * PATCH /api/enterprise/agent-profiles/:id
   * 更新AI员工配置（名称/职责/目标/时间/备注/权限）
   */
  app.patch('/:id', async (request, reply) => {
    try {
      const tenantId = await resolveOrgId(request);
      const { id } = request.params as { id: string };
      const body = request.body as any;

      const existing = await prisma.enterpriseAgentProfile.findFirst({
        where: { id, tenantId },
      });
      if (!existing) {
        return reply.status(404).send({ code: 404, message: 'AI员工不存在' });
      }

      // 合并两个PATCH的处理逻辑
      const updateData: any = { updatedAt: new Date() };
      if (body.name !== undefined) updateData.name = body.name;
      if (body.role !== undefined) updateData.role = body.role;
      if (body.goal !== undefined) updateData.goal = body.goal;
      if (body.dailyTarget !== undefined) updateData.dailyTarget = body.dailyTarget;
      if (body.workingHours !== undefined) updateData.workingHours = body.workingHours;
      if (body.managerNote !== undefined) updateData.managerNote = body.managerNote;
      if (body.permissions !== undefined) updateData.permissions = body.permissions;

      const updated = await prisma.enterpriseAgentProfile.update({
        where: { id },
        data: updateData,
        select: { id: true, name: true, role: true, goal: true, status: true },
      });

      return reply.send({ code: 0, message: 'success', data: updated });
    } catch (error: any) {
      request.log.error(error);
      return reply.status(500).send({ code: 500, message: error.message || 'Internal error' });
    }
  });

  /**
   * POST /api/enterprise/agent-profiles/:id/toggle
   * 暂停/启用AI员工
   */
  app.post('/:id/toggle', async (request, reply) => {
    try {
      const tenantId = await resolveOrgId(request);
      const { id } = request.params as { id: string };
      
      const toggled = await enterpriseAgentProfileService.toggleAgentStatus(tenantId, id);
      if (!toggled) {
        return reply.status(404).send({ code: 404, message: 'AI员工不存在' });
      }
      
      return reply.send({
        code: 0,
        message: 'success',
        data: {
          id: toggled.id,
          name: toggled.name,
          status: toggled.status
        }
      });
    } catch (error: any) {
      request.log.error(error);
      return reply.status(500).send({ code: 500, message: error.message || 'Internal error' });
    }
  });
  
  /**
   * PUT /api/enterprise/agent-profiles/:id/note
   * 更新老板备注
   */
  app.put('/:id/note', async (request, reply) => {
    try {
      const tenantId = await resolveOrgId(request);
      const { id } = request.params as { id: string };
      const { note } = request.body as { note: string };
      
      const updated = await enterpriseAgentProfileService.updateAgent(tenantId, id, {
        managerNote: note
      });
      
      if (!updated) {
        return reply.status(404).send({ code: 404, message: 'AI员工不存在' });
      }
      
      return reply.send({
        code: 0,
        message: 'success',
        data: { id: updated.id, managerNote: updated.managerNote }
      });
    } catch (error: any) {
      request.log.error(error);
      return reply.status(500).send({ code: 500, message: error.message || 'Internal error' });
    }
  });

  // ═══════════════════════════════════════════════
  // Sprint-11B.2: AI Brain API
  // ═══════════════════════════════════════════════

  /**
   * GET /api/enterprise/agent-profiles/:id/brain
   * 获取 AI 员工大脑配置
   * 返回:
   *   - currentBinding: AgentModelBinding (含 EnterpriseLlmConfig)
   *   - availableConfigs: EnterpriseLlmConfig[] (该企业可选的配置)
   *   - hasPermission: boolean (当前用户是否可以修改)
   */
  app.get('/:id/brain', async (request, reply) => {
    try {
      const user = request.user as any;
      const tenantId = await resolveOrgId(request);
      const userRole = user?.role || 'member';
      const { id } = request.params as { id: string };

      // 验证 Agent 属于该企业
      const agent = await prisma.enterpriseAgentProfile.findFirst({
        where: { id, tenantId },
        select: { id: true, name: true, tenantId: true },
      });
      if (!agent) {
        return reply.status(404).send({ code: 404, message: 'AI员工不存在' });
      }

      // 当前绑定（含 LLM 配置详情）
      const currentBinding = await prisma.agentModelBinding.findFirst({
        where: { agentId: id, enabled: true, tenantId },
        include: { llmConfig: true },
        orderBy: { priority: 'asc' },
      });

      // 企业可用的 LLM 配置
      const availableConfigs = await prisma.enterpriseLlmConfig.findMany({
        where: { tenantId, enabled: true, status: 'active' },
        select: {
          id: true,
          provider: true,
          modelName: true,
          baseUrl: true,
          createdAt: true,
          updatedAt: true,
        },
        orderBy: { createdAt: 'desc' },
      });

      // 所有绑定的列表（用于切换）
      const allBindings = await prisma.agentModelBinding.findMany({
        where: { agentId: id, tenantId },
        include: { llmConfig: true },
        orderBy: { priority: 'asc' },
      });

      const hasPermission = userRole === 'admin' || userRole === 'owner';

      return reply.send({
        code: 0,
        message: 'success',
        data: {
          currentBinding,
          availableConfigs,
          allBindings,
          hasPermission,
        },
      });
    } catch (error: any) {
      request.log.error(error);
      return reply.status(500).send({ code: 500, message: error.message || 'Internal error' });
    }
  });

  /**
   * POST /api/enterprise/agent-profiles/:id/brain
   * 设置/切换 AI 员工模型
   * Body: { llmConfigId, temperature?, maxTokens? }
   * 权限: 仅 admin/owner 可操作
   */
  app.post('/:id/brain', async (request, reply) => {
    try {
      const user = request.user as any;
      const tenantId = await resolveOrgId(request);
      const userRole = user?.role || 'member';
      const { id } = request.params as { id: string };
      const { llmConfigId, temperature, maxTokens } = request.body as any;

      // 权限检查
      if (userRole !== 'admin' && userRole !== 'owner') {
        return reply.status(403).send({ code: 403, message: '仅管理员可配置 AI 员工模型' });
      }

      if (!llmConfigId) {
        return reply.status(400).send({ code: 400, message: 'llmConfigId 为必填' });
      }

      // 验证 Agent
      const agent = await prisma.enterpriseAgentProfile.findFirst({
        where: { id, tenantId },
        select: { id: true },
      });
      if (!agent) {
        return reply.status(404).send({ code: 404, message: 'AI员工不存在' });
      }

      // 验证 LLM 配置属于该企业
      const llmConfig = await prisma.enterpriseLlmConfig.findFirst({
        where: { id: llmConfigId, tenantId, enabled: true, status: 'active' },
        select: { id: true },
      });
      if (!llmConfig) {
        return reply.status(404).send({ code: 404, message: 'LLM 配置不存在或不可用' });
      }

      // 查找已有绑定
      const existingBinding = await prisma.agentModelBinding.findFirst({
        where: { agentId: id, enabled: true, tenantId },
      });

      let binding;
      if (existingBinding) {
        // 更新现有绑定
        binding = await prisma.agentModelBinding.update({
          where: { id: existingBinding.id },
          data: {
            llmConfigId,
            temperature: temperature !== undefined ? temperature : existingBinding.temperature,
            maxTokens: maxTokens !== undefined ? maxTokens : existingBinding.maxTokens,

          },
          include: { llmConfig: true },
        });
      } else {
        // 创建新绑定
        binding = await prisma.agentModelBinding.create({
          data: {
            tenantId,
            agentId: id,
            llmConfigId,
            taskType: 'general',
            temperature: temperature ?? 0.7,
            maxTokens: maxTokens ?? 16384,
            enabled: true,
          },
          include: { llmConfig: true },
        });
      }

      return reply.send({
        code: 0,
        message: 'success',
        data: binding,
      });
    } catch (error: any) {
      request.log.error(error);
      return reply.status(500).send({ code: 500, message: error.message || 'Internal error' });
    }
  });
}
