/**
 * Enterprise Command Routes v1.1
 * 
 * CEO Task Center API
 * /api/enterprise/commands
 */

import type { FastifyInstance } from 'fastify';
import { enterpriseCommandService } from '../services/enterprise/enterprise-command.service';

export async function registerEnterpriseCommandRoutes(app: FastifyInstance) {
  
  // 认证hook (复用现有JWT验证)
  app.addHook('preHandler', app.authenticate);
  
  /**
   * GET /api/enterprise/commands
   * 查询指令列表
   * Query: status, limit, offset
   */
  app.get('/', async (request, reply) => {
    try {
      const user = request.user as any;
      const tenantId = user?.tenantId || user?.id;
      const { status, limit, offset } = request.query as {
        status?: string;
        limit?: string;
        offset?: string;
      };
      
      const result = await enterpriseCommandService.listCommands(tenantId, {
        status,
        limit: limit ? parseInt(limit) : undefined,
        offset: offset ? parseInt(offset) : undefined
      });
      
      return reply.send({
        code: 0,
        message: 'success',
        data: result
      });
    } catch (error: any) {
      request.log.error(error);
      return reply.status(500).send({ code: 500, message: error.message || 'Internal error' });
    }
  });
  
  /**
   * POST /api/enterprise/commands
   * CEO创建新指令
   * Body: { content, priority }
   */
  app.post('/', async (request, reply) => {
    try {
      const user = request.user as any;
      const tenantId = user?.tenantId || user?.id;
      const creatorId = user?.id;
      const { content, priority } = request.body as {
        content: string;
        priority?: 'low' | 'normal' | 'high' | 'urgent';
      };
      
      if (!content || content.trim().length === 0) {
        return reply.status(400).send({ code: 400, message: 'content不能为空' });
      }
      
      const result = await enterpriseCommandService.createCommand({
        tenantId,
        creatorId,
        content: content.trim(),
        priority
      });
      
      return reply.status(201).send({
        code: 0,
        message: 'success',
        data: result
      });
    } catch (error: any) {
      request.log.error(error);
      return reply.status(500).send({ code: 500, message: error.message || 'Internal error' });
    }
  });
  
  /**
   * GET /api/enterprise/commands/stats
   * 获取CEO指令统计面板数据
   */
  app.get('/stats', async (request, reply) => {
    try {
      const user = request.user as any;
      const tenantId = user?.tenantId || user?.id;
      
      const stats = await enterpriseCommandService.getStats(tenantId);
      
      return reply.send({
        code: 0,
        message: 'success',
        data: stats
      });
    } catch (error: any) {
      request.log.error(error);
      return reply.status(500).send({ code: 500, message: error.message || 'Internal error' });
    }
  });
  
  /**
   * GET /api/enterprise/commands/:id
   * 查询指令详情（含执行计划）
   */
  app.get('/:id', async (request, reply) => {
    try {
      const { id } = request.params as { id: string };
      
      const detail = await enterpriseCommandService.getCommandDetail(id);
      if (!detail) {
        return reply.status(404).send({ code: 404, message: '指令不存在' });
      }
      
      return reply.send({
        code: 0,
        message: 'success',
        data: detail
      });
    } catch (error: any) {
      request.log.error(error);
      return reply.status(500).send({ code: 500, message: error.message || 'Internal error' });
    }
  });
  
  /**
   * POST /api/enterprise/commands/:id/cancel
   * 取消执行中的指令
   */
  app.post('/:id/cancel', async (request, reply) => {
    try {
      const { id } = request.params as { id: string };
      
      const ok = await enterpriseCommandService.cancelCommand(id);
      if (!ok) {
        return reply.status(400).send({ code: 400, message: '无法取消已完成/已失败的任务' });
      }
      
      return reply.send({
        code: 0,
        message: 'success',
        data: { id, status: 'CANCELLED' }
      });
    } catch (error: any) {
      request.log.error(error);
      return reply.status(500).send({ code: 500, message: error.message || 'Internal error' });
    }
  });
}
