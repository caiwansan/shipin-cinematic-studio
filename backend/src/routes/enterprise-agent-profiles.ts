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

export async function registerEnterpriseAgentProfileRoutes(app: FastifyInstance) {
  
  // 认证hook
  app.addHook('preHandler', app.authenticate);
  
  /**
   * GET /api/enterprise/agent-profiles
   * 获取租户所有AI员工列表
   */
  app.get('/', async (request, reply) => {
    try {
      const user = request.user as any;
      const tenantId = user?.tenantId || user?.id;
      
      const agents = await enterpriseAgentProfileService.listAgents(tenantId);
      
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
      const user = request.user as any;
      const tenantId = user?.tenantId || user?.id;
      
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
      const user = request.user as any;
      const tenantId = user?.tenantId || user?.id;
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
      const user = request.user as any;
      const tenantId = user?.tenantId || user?.id;
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
      const user = request.user as any;
      const tenantId = user?.tenantId || user?.id;
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
      const user = request.user as any;
      const tenantId = user?.tenantId || user?.id;
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
}
