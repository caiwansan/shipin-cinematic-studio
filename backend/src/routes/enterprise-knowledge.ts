/**
 * Enterprise Knowledge Routes v2.0
 * 
 * 企业知识资产入口 API
 * /api/enterprise/knowledge
 * 
 * 修正1: 经Knowledge Hub读取，不直接给Agent
 */

import type { FastifyInstance } from 'fastify';
import { enterpriseKnowledgeService } from '../services/enterprise/enterprise-knowledge.service';

export async function registerEnterpriseKnowledgeRoutes(app: FastifyInstance) {
  
  app.addHook('preHandler', app.authenticate);
  
  /**
   * GET /api/enterprise/knowledge
   * 知识列表 (分页+类型筛选+搜索)
   */
  app.get('/', async (request, reply) => {
    try {
      const user = request.user as any;
      const tenantId = user?.tenantId || user?.id;
      const { type, status, search, limit, offset } = request.query as {
        type?: string;
        status?: string;
        search?: string;
        limit?: string;
        offset?: string;
      };
      
      const result = await enterpriseKnowledgeService.list(tenantId, {
        type,
        status: status || 'active',
        search,
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
   * POST /api/enterprise/knowledge
   * 创建知识条目
   */
  app.post('/', async (request, reply) => {
    try {
      const user = request.user as any;
      const tenantId = user?.tenantId || user?.id;
      const body = request.body as {
        type: 'intro' | 'product' | 'case' | 'script' | 'faq' | 'industry';
        title: string;
        content: string;
        fileUrl?: string;
        agentAccessScope?: string[];
      };
      
      if (!body.type || !body.title || !body.content) {
        return reply.status(400).send({ code: 400, message: 'type/title/content不能为空' });
      }
      
      const validTypes = ['intro', 'product', 'case', 'script', 'faq', 'industry'];
      if (!validTypes.includes(body.type)) {
        return reply.status(400).send({ code: 400, message: `无效类型,可选:${validTypes.join(',')}` });
      }
      
      const item = await enterpriseKnowledgeService.create({
        tenantId,
        type: body.type,
        title: body.title,
        content: body.content,
        fileUrl: body.fileUrl,
        agentAccessScope: body.agentAccessScope
      });
      
      return reply.status(201).send({ code: 0, message: 'success', data: item });
    } catch (error: any) {
      request.log.error(error);
      return reply.status(500).send({ code: 500, message: error.message });
    }
  });
  
  /**
   * GET /api/enterprise/knowledge/stats
   * 知识库统计
   */
  app.get('/stats', async (request, reply) => {
    try {
      const user = request.user as any;
      const tenantId = user?.tenantId || user?.id;
      const stats = await enterpriseKnowledgeService.getStats(tenantId);
      return reply.send({ code: 0, message: 'success', data: stats });
    } catch (error: any) {
      request.log.error(error);
      return reply.status(500).send({ code: 500, message: error.message });
    }
  });
  
  /**
   * GET /api/enterprise/knowledge/:id
   * 获取单条知识
   */
  app.get('/:id', async (request, reply) => {
    try {
      const { id } = request.params as { id: string };
      const item = await enterpriseKnowledgeService.get(id);
      if (!item) {
        return reply.status(404).send({ code: 404, message: '知识条目不存在' });
      }
      return reply.send({ code: 0, message: 'success', data: item });
    } catch (error: any) {
      request.log.error(error);
      return reply.status(500).send({ code: 500, message: error.message });
    }
  });
  
  /**
   * PATCH /api/enterprise/knowledge/:id
   * 更新知识条目
   */
  app.patch('/:id', async (request, reply) => {
    try {
      const { id } = request.params as { id: string };
      const body = request.body as {
        title?: string;
        content?: string;
        fileUrl?: string;
        status?: 'active' | 'archived';
        agentAccessScope?: string[];
      };
      
      const updated = await enterpriseKnowledgeService.update(id, body);
      if (!updated) {
        return reply.status(404).send({ code: 404, message: '知识条目不存在' });
      }
      return reply.send({ code: 0, message: 'success', data: updated });
    } catch (error: any) {
      request.log.error(error);
      return reply.status(500).send({ code: 500, message: error.message });
    }
  });
  
  /**
   * DELETE /api/enterprise/knowledge/:id
   * 归档知识条目
   */
  app.delete('/:id', async (request, reply) => {
    try {
      const { id } = request.params as { id: string };
      const ok = await enterpriseKnowledgeService.archive(id);
      if (!ok) {
        return reply.status(404).send({ code: 404, message: '知识条目不存在' });
      }
      return reply.send({ code: 0, message: 'success', data: { id, status: 'archived' } });
    } catch (error: any) {
      request.log.error(error);
      return reply.status(500).send({ code: 500, message: error.message });
    }
  });
}
