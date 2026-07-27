// ============================================================
// Job Agent Config API — 后台管理「求职管家 AI 配置」
// 路径：/api/admin/recruitment/agent-config
// 认证：requireAdmin
// ============================================================

import { FastifyInstance } from 'fastify';
import { requireAdmin } from '../../../middleware/require-admin.js';
import { jobAgentConfigRepository } from '../repositories/index.js';

export default async function jobAgentConfigRoutes(app: FastifyInstance) {

  // ── GET /api/admin/recruitment/agent-config — 获取所有 Agent 配置 ──
  app.get('/api/admin/recruitment/agent-config', { preHandler: [requireAdmin] }, async (_request, reply) => {
    try {
      const configs = await jobAgentConfigRepository.listAll();
      return { success: true, data: configs };
    } catch (error: any) {
      return reply.status(500).send({ success: false, error: '获取配置失败', message: error.message });
    }
  });

  // ── GET /api/admin/recruitment/agent-config/:id — 获取单条配置 ──
  app.get('/api/admin/recruitment/agent-config/:id', { preHandler: [requireAdmin] }, async (request: any, reply) => {
    try {
      const { id } = request.params as any;
      const config = await jobAgentConfigRepository.getById(id);
      if (!config) {
        return reply.status(404).send({ success: false, error: '配置不存在' });
      }
      return { success: true, data: config };
    } catch (error: any) {
      return reply.status(500).send({ success: false, error: '获取配置失败', message: error.message });
    }
  });

  // ── POST /api/admin/recruitment/agent-config — 创建 Agent 配置 ──
  app.post('/api/admin/recruitment/agent-config', { preHandler: [requireAdmin] }, async (request: any, reply: any) => {
    try {
      const body = request.body || {};
      const { provider, model, apiKey, baseUrl, systemPrompt, temperature, maxTokens, agentName, agentType } = body;

      if (!provider || !model) {
        return reply.status(400).send({ success: false, error: 'provider 和 model 为必填' });
      }

      const config = await jobAgentConfigRepository.create({
        provider,
        model,
        apiKey: apiKey ?? '',
        baseUrl,
        systemPrompt,
        temperature,
        maxTokens,
        agentName,
        agentType,
      });

      return reply.status(201).send({ success: true, data: config });
    } catch (error: any) {
      return reply.status(500).send({ success: false, error: '创建配置失败', message: error.message });
    }
  });

  // ── PUT /api/admin/recruitment/agent-config/:id — 更新配置 ──
  app.put('/api/admin/recruitment/agent-config/:id', { preHandler: [requireAdmin] }, async (request: any, reply: any) => {
    try {
      const { id } = request.params as any;
      const body = request.body || {};

      const existing = await jobAgentConfigRepository.getById(id);
      if (!existing) {
        return reply.status(404).send({ success: false, error: '配置不存在' });
      }

      const { agentName, provider, model, apiKey, baseUrl, systemPrompt, temperature, maxTokens, enabled } = body;
      const config = await jobAgentConfigRepository.update(id, {
        agentName,
        provider,
        model,
        apiKey,
        baseUrl,
        systemPrompt,
        temperature,
        maxTokens,
        enabled,
      });

      return { success: true, data: config };
    } catch (error: any) {
      return reply.status(500).send({ success: false, error: '更新配置失败', message: error.message });
    }
  });

  // ── DELETE /api/admin/recruitment/agent-config/:id — 删除配置 ──
  app.delete('/api/admin/recruitment/agent-config/:id', { preHandler: [requireAdmin] }, async (request: any, reply: any) => {
    try {
      const { id } = request.params as any;

      const existing = await jobAgentConfigRepository.getById(id);
      if (!existing) {
        return reply.status(404).send({ success: false, error: '配置不存在' });
      }

      await jobAgentConfigRepository.delete(id);
      return { success: true, data: { id } };
    } catch (error: any) {
      return reply.status(500).send({ success: false, error: '删除配置失败', message: error.message });
    }
  });

  // ── POST /api/admin/recruitment/agent-config/:id/toggle — 启用/禁用 ──
  app.post('/api/admin/recruitment/agent-config/:id/toggle', { preHandler: [requireAdmin] }, async (request: any, reply: any) => {
    try {
      const { id } = request.params as any;

      const config = await jobAgentConfigRepository.toggleEnabled(id);
      if (!config) {
        return reply.status(404).send({ success: false, error: '配置不存在' });
      }

      return { success: true, data: { id, enabled: config.enabled } };
    } catch (error: any) {
      return reply.status(500).send({ success: false, error: '切换状态失败', message: error.message });
    }
  });

  // ── GET /api/admin/recruitment/agent-config/active/:agentType — 获取启用的配置（供 Agent Runtime 调用）──
  app.get('/api/admin/recruitment/agent-config/active/:agentType', { preHandler: [requireAdmin] }, async (request: any, reply) => {
    try {
      const { agentType } = request.params as any;
      const config = await jobAgentConfigRepository.getActiveByType(agentType);
      if (!config) {
        return reply.status(404).send({ success: false, error: '没有启用的配置' });
      }
      return { success: true, data: config };
    } catch (error: any) {
      return reply.status(500).send({ success: false, error: '获取配置失败', message: error.message });
    }
  });
}
