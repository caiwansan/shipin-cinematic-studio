/**
 * Enterprise Approval Routes v2.0
 * 
 * 审批中心 API
 * /api/enterprise/approvals
 * 
 * 修正2: revision_required 状态支持
 * 修正3: 审批绑定Agent身份
 */

import type { FastifyInstance } from 'fastify';
import { enterpriseApprovalService } from '../services/enterprise/enterprise-approval.service';

export async function registerEnterpriseApprovalRoutes(app: FastifyInstance) {
  
  app.addHook('preHandler', app.authenticate);
  
  /**
   * GET /api/enterprise/approvals
   * 审批列表 (按状态筛选)
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
      
      const result = await enterpriseApprovalService.list(tenantId, {
        status,
        limit: limit ? parseInt(limit) : undefined,
        offset: offset ? parseInt(offset) : undefined
      });
      
      return reply.send({ code: 0, message: 'success', data: result });
    } catch (error: any) {
      request.log.error(error);
      return reply.status(500).send({ code: 500, message: error.message });
    }
  });
  
  /**
   * GET /api/enterprise/approvals/stats
   * 审批统计面板
   */
  app.get('/stats', async (request, reply) => {
    try {
      const user = request.user as any;
      const tenantId = user?.tenantId || user?.id;
      const stats = await enterpriseApprovalService.getStats(tenantId);
      return reply.send({ code: 0, message: 'success', data: stats });
    } catch (error: any) {
      request.log.error(error);
      return reply.status(500).send({ code: 500, message: error.message });
    }
  });
  
  /**
   * GET /api/enterprise/approvals/history
   * 审批历史 (已处理记录)
   */
  app.get('/history', async (request, reply) => {
    try {
      const user = request.user as any;
      const tenantId = user?.tenantId || user?.id;
      const { limit, offset } = request.query as {
        limit?: string;
        offset?: string;
      };
      
      const result = await enterpriseApprovalService.getHistory(tenantId, {
        limit: limit ? parseInt(limit) : undefined,
        offset: offset ? parseInt(offset) : undefined
      });
      
      return reply.send({ code: 0, message: 'success', data: result });
    } catch (error: any) {
      request.log.error(error);
      return reply.status(500).send({ code: 500, message: error.message });
    }
  });
  
  /**
   * POST /api/enterprise/approvals/submit
   * Agent提交内容审批 (自动触发Content Safety Engine)
   */
  app.post('/submit', async (request, reply) => {
    try {
      const user = request.user as any;
      const tenantId = user?.tenantId || user?.id;
      const body = request.body as {
        contentPublishId: string;
        title: string;
        body: string;
        platform: string;
        agentId: string;
      };
      
      if (!body.title || !body.body || !body.agentId) {
        return reply.status(400).send({ code: 400, message: 'title/body/agentId不能为空' });
      }
      
      const result = await enterpriseApprovalService.submitForApproval({
        tenantId,
        contentPublishId: body.contentPublishId,
        title: body.title,
        body: body.body,
        platform: body.platform || 'wechat_official',
        agentId: body.agentId
      });
      
      return reply.status(201).send({ code: 0, message: 'success', data: result });
    } catch (error: any) {
      request.log.error(error);
      return reply.status(500).send({ code: 500, message: error.message });
    }
  });
  
  /**
   * GET /api/enterprise/approvals/:id
   * 审批详情 (含Agent身份)
   */
  app.get('/:id', async (request, reply) => {
    try {
      const { id } = request.params as { id: string };
      const detail = await enterpriseApprovalService.getDetail(id);
      if (!detail) {
        return reply.status(404).send({ code: 404, message: '审批记录不存在' });
      }
      return reply.send({ code: 0, message: 'success', data: detail });
    } catch (error: any) {
      request.log.error(error);
      return reply.status(500).send({ code: 500, message: error.message });
    }
  });
  
  /**
   * POST /api/enterprise/approvals/:id/approve
   * CEO批准发布
   */
  app.post('/:id/approve', async (request, reply) => {
    try {
      const user = request.user as any;
      const approverId = user?.id;
      const { id } = request.params as { id: string };
      const { note } = request.body as { note?: string };
      
      const result = await enterpriseApprovalService.approve(id, approverId, note);
      if (!result.success) {
        return reply.status(404).send({ code: 404, message: '审批记录不存在' });
      }
      
      return reply.send({ code: 0, message: 'success', data: result });
    } catch (error: any) {
      request.log.error(error);
      return reply.status(500).send({ code: 500, message: error.message });
    }
  });
  
  /**
   * POST /api/enterprise/approvals/:id/reject
   * CEO拒绝发布
   */
  app.post('/:id/reject', async (request, reply) => {
    try {
      const user = request.user as any;
      const approverId = user?.id;
      const { id } = request.params as { id: string };
      const { reason } = request.body as { reason: string };
      
      if (!reason) {
        return reply.status(400).send({ code: 400, message: '拒绝原因不能为空' });
      }
      
      const result = await enterpriseApprovalService.reject(id, approverId, reason);
      if (!result.success) {
        return reply.status(404).send({ code: 404, message: '审批记录不存在' });
      }
      
      return reply.send({ code: 0, message: 'success', data: result });
    } catch (error: any) {
      request.log.error(error);
      return reply.status(500).send({ code: 500, message: error.message });
    }
  });
  
  /**
   * POST /api/enterprise/approvals/:id/revision
   * 修正2: CEO要求修改（revision_required）
   */
  app.post('/:id/revision', async (request, reply) => {
    try {
      const user = request.user as any;
      const approverId = user?.id;
      const { id } = request.params as { id: string };
      const { note } = request.body as { note: string };
      
      if (!note) {
        return reply.status(400).send({ code: 400, message: '修改意见不能为空' });
      }
      
      const result = await enterpriseApprovalService.requestRevision(id, approverId, note);
      if (!result.success) {
        return reply.status(404).send({ code: 404, message: '审批记录不存在' });
      }
      
      return reply.send({ code: 0, message: 'success', data: result });
    } catch (error: any) {
      request.log.error(error);
      return reply.status(500).send({ code: 500, message: error.message });
    }
  });
}
