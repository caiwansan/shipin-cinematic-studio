/**
 * Enterprise Agent Identity Routes
 * Sprint 4.2.8 Step 5 — AI员工运行身份层 API
 *
 * /api/enterprise/agent-identity
 * - Instance 管理：创建、查询、更新运行时状态
 * - Model Binding 管理：员工级 BYOK 模型绑定
 * - Runtime Status：运行状态、任务统计
 */

import type { FastifyInstance } from 'fastify';
import { agentIdentityService } from '../services/enterprise/agent-identity.service.js';
import { agentChannelBindingService } from '../services/enterprise/agent-channel-binding.service.js';
import { channelProviderService } from '../services/enterprise/channel-provider.service.js';
import { prisma } from '../utils/index.js';

export async function registerAgentIdentityRoutes(app: FastifyInstance) {

  // JWT 鉴权
  app.addHook('preHandler', app.authenticate);

  // ───────────────── Agent Instance ─────────────────

  /**
   * POST /api/enterprise/agent-identity/instances
   * 为 AI 员工创建运行时身份
   * Body: { employeeId: string, agentId?: string, namespace?: string }
   */
  app.post('/instances', async (request, reply) => {
    try {
      const user = request.user as any;
      const tenantId = user?.tenantId || user?.id;
      const { employeeId, agentId, namespace } = request.body as any;

      if (!employeeId) {
        return reply.status(400).send({ code: 400, message: 'employeeId 为必填' });
      }

      // 验证 employee 存在
      const employee = await prisma.enterpriseAgentProfile.findUnique({ where: { id: employeeId } });
      if (!employee) {
        return reply.status(404).send({ code: 404, message: 'AI员工不存在' });
      }

      const instance = await agentIdentityService.createOrCreateInstance({
        tenantId,
        employeeId,
        agentId,
        namespace,
      });

      return reply.send({ code: 0, message: 'success', data: instance });
    } catch (error: any) {
      request.log.error(error);
      return reply.status(500).send({ code: 500, message: error.message || 'Internal error' });
    }
  });

  /**
   * GET /api/enterprise/agent-identity/instances
   * 获取企业下所有 Agent Instance
   */
  app.get('/instances', async (request, reply) => {
    try {
      const user = request.user as any;
      const tenantId = user?.tenantId || user?.id;

      const instances = await agentIdentityService.listByTenant(tenantId);

      return reply.send({ code: 0, message: 'success', data: instances });
    } catch (error: any) {
      request.log.error(error);
      return reply.status(500).send({ code: 500, message: error.message || 'Internal error' });
    }
  });

  /**
   * GET /api/enterprise/agent-identity/instances/:id/status
   * 获取 Agent 运行时状态
   */
  app.get('/instances/:id/status', async (request, reply) => {
    try {
      const { id } = request.params as { id: string };
      const status = await agentIdentityService.getRuntimeStatus(id);

      if (!status) {
        return reply.status(404).send({ code: 404, message: 'Agent Instance 不存在' });
      }

      return reply.send({ code: 0, message: 'success', data: status });
    } catch (error: any) {
      request.log.error(error);
      return reply.status(500).send({ code: 500, message: error.message || 'Internal error' });
    }
  });

  /**
   * PATCH /api/enterprise/agent-identity/instances/:id/status
   * 更新 Agent 运行时状态（暂停/恢复/停止）
   * Body: { status: 'active' | 'paused' | 'stopped' }
   */
  app.patch('/instances/:id/status', async (request, reply) => {
    try {
      const { id } = request.params as { id: string };
      const { status } = request.body as any;

      if (!['active', 'paused', 'stopped'].includes(status)) {
        return reply.status(400).send({ code: 400, message: 'status 必须为 active/paused/stopped' });
      }

      const instance = await agentIdentityService.updateRuntimeStatus(id, status);
      return reply.send({ code: 0, message: 'success', data: instance });
    } catch (error: any) {
      request.log.error(error);
      return reply.status(500).send({ code: 500, message: error.message || 'Internal error' });
    }
  });

  /**
   * POST /api/enterprise/agent-identity/instances/:id/task
   * 记录一次任务执行
   * Body: { success: boolean }
   */
  app.post('/instances/:id/task', async (request, reply) => {
    try {
      const { id } = request.params as { id: string };
      const body = request.body as any;

      const instance = await agentIdentityService.recordTask({
        agentInstanceId: id,
        taskType: body.taskType || 'manual_task',
        inputSummary: body.inputSummary,
        outputSummary: body.outputSummary,
        status: body.status || (body.success === false ? 'failed' : 'completed'),
        tokenInput: body.tokenInput,
        tokenOutput: body.tokenOutput,
        cost: body.cost,
        durationMs: body.durationMs,
      });
      return reply.send({ code: 0, message: 'success', data: instance });
    } catch (error: any) {
      request.log.error(error);
      return reply.status(500).send({ code: 500, message: error.message || 'Internal error' });
    }
  });

  // ───────────────── Employee Model Binding ─────────────────

  /**
   * POST /api/enterprise/agent-identity/model-bindings
   * 绑定员工模型（BYOK：使用企业 AIProviderConfig）
   * Body: { employeeId, providerConfigId, modelName?, temperature?, maxTokens? }
   */
  app.post('/model-bindings', async (request, reply) => {
    try {
      const user = request.user as any;
      const tenantId = user?.tenantId || user?.id;
      const { employeeId, providerConfigId, modelName, temperature, maxTokens } = request.body as any;

      if (!employeeId || !providerConfigId) {
        return reply.status(400).send({ code: 400, message: 'employeeId 和 providerConfigId 为必填' });
      }

      // 验证 providerConfig 属于该企业
      const providerConfig = await prisma.aIProviderConfig.findUnique({ where: { id: providerConfigId } });
      if (!providerConfig) {
        return reply.status(404).send({ code: 404, message: '模型配置不存在' });
      }

      const binding = await agentIdentityService.bindModel({
        tenantId,
        employeeId,
        providerConfigId,
        modelName,
        temperature,
        maxTokens,
      });

      return reply.send({ code: 0, message: 'success', data: binding });
    } catch (error: any) {
      request.log.error(error);
      return reply.status(500).send({ code: 500, message: error.message || 'Internal error' });
    }
  });

  /**
   * GET /api/enterprise/agent-identity/model-bindings/:employeeId
   * 获取员工的所有模型绑定
   */
  app.get('/model-bindings/:employeeId', async (request, reply) => {
    try {
      const { employeeId } = request.params as { employeeId: string };
      const bindings = await agentIdentityService.getModelBindings(employeeId);
      return reply.send({ code: 0, message: 'success', data: bindings });
    } catch (error: any) {
      request.log.error(error);
      return reply.status(500).send({ code: 500, message: error.message || 'Internal error' });
    }
  });

  /**
   * DELETE /api/enterprise/agent-identity/model-bindings/:id
   * 解绑模型
   */
  app.delete('/model-bindings/:id', async (request, reply) => {
    try {
      const { id } = request.params as { id: string };
      await agentIdentityService.unbindModel(id);
      return reply.send({ code: 0, message: 'success' });
    } catch (error: any) {
      request.log.error(error);
      return reply.status(500).send({ code: 500, message: error.message || 'Internal error' });
    }
  });

  /**
   * GET /api/enterprise/agent-identity/model-bindings/:employeeId/active
   * 获取员工当前有效模型绑定
   */
  app.get('/model-bindings/:employeeId/active', async (request, reply) => {
    try {
      const { employeeId } = request.params as { employeeId: string };
      const binding = await agentIdentityService.getActiveModelBinding(employeeId);
      return reply.send({ code: 0, message: 'success', data: binding });
    } catch (error: any) {
      request.log.error(error);
      return reply.status(500).send({ code: 500, message: error.message || 'Internal error' });
    }
  });

  /**
   * PATCH /api/enterprise/agent-identity/model-bindings/:id/enable
   * 设为默认模型（同员工其他绑定自动关闭）
   * Sprint 4.3.1 P0-2
   */
  app.patch('/model-bindings/:id/enable', async (request, reply) => {
    try {
      const { id } = request.params as { id: string };
      const user = request.user as any;
      const tenantId = user?.tenantId || user?.id;

      const binding = await agentIdentityService.enableModelBinding(id, tenantId);
      return reply.send({ code: 0, message: 'success', data: binding });
    } catch (error: any) {
      request.log.error(error);
      return reply.status(500).send({ code: 500, message: error.message || 'Internal error' });
    }
  });

  // ═══════════════════════════════════════════════
  // Sprint 4.3.1 P0-1: Enterprise Activation Flow
  // ═══════════════════════════════════════════════

  /**
   * GET /api/enterprise/agent-identity/activation/status
   * 获取企业激活状态（用于判断是否显示引导）
   */
  app.get('/activation/status', async (request, reply) => {
    try {
      const user = request.user as any;
      const tenantId = user?.tenantId || user?.id;
      const status = await agentIdentityService.getActivationStatus(tenantId);
      return reply.send({ code: 0, message: 'success', data: status });
    } catch (error: any) {
      request.log.error(error);
      return reply.status(500).send({ code: 500, message: error.message || 'Internal error' });
    }
  });

  /**
   * POST /api/enterprise/agent-identity/activation/complete-step
   * 完成一个激活步骤
   * Body: { step: 'profile' | 'model' | 'agent' | 'channel' | 'done' }
   */
  app.post('/activation/complete-step', async (request, reply) => {
    try {
      const user = request.user as any;
      const tenantId = user?.tenantId || user?.id;
      const { step } = request.body as any;

      const result = await agentIdentityService.completeActivationStep(tenantId, step);
      return reply.send({ code: 0, message: 'success', data: result });
    } catch (error: any) {
      request.log.error(error);
      return reply.status(500).send({ code: 500, message: error.message || 'Internal error' });
    }
  });

  // ───────────────── Task Timeline & Agent Detail ─────────────────

  /**
   * POST /api/enterprise/agent-identity/tasks
   * 记录一次任务执行（来自 Agent 运行时上报）
   * Body: { agentInstanceId, taskType, inputSummary?, outputSummary?, status?, tokenInput?, tokenOutput?, cost?, durationMs? }
   */
  app.post('/tasks', async (request, reply) => {
    try {
      const body = request.body as any;
      if (!body.agentInstanceId || !body.taskType) {
        return reply.status(400).send({ code: 400, message: 'agentInstanceId 和 taskType 为必填' });
      }
      const task = await agentIdentityService.recordTask(body);
      return reply.send({ code: 0, message: 'success', data: task });
    } catch (error: any) {
      request.log.error(error);
      return reply.status(500).send({ code: 500, message: error.message || 'Internal error' });
    }
  });

  /**
   * GET /api/enterprise/agent-identity/instances/:id/tasks
   * 获取 Agent 任务时间线
   */
  app.get('/instances/:id/tasks', async (request, reply) => {
    try {
      const { id } = request.params as { id: string };
      const { limit } = request.query as any;
      const tasks = await agentIdentityService.getTaskTimeline(id, limit ? parseInt(limit) : 20);
      return reply.send({ code: 0, message: 'success', data: tasks });
    } catch (error: any) {
      request.log.error(error);
      return reply.status(500).send({ code: 500, message: error.message || 'Internal error' });
    }
  });

  /**
   * GET /api/enterprise/agent-identity/employees/:employeeId/full
   * 获取 AI 员工完整详情（Agent 详情页）
   * 包含：身份 + 运行时 + 模型绑定 + 近期任务
   */
  app.get('/employees/:employeeId/full', async (request, reply) => {
    try {
      const { employeeId } = request.params as { employeeId: string };
      const detail = await agentIdentityService.getFullAgentDetail(employeeId);
      if (!detail) {
        return reply.status(404).send({ code: 404, message: 'AI员工不存在' });
      }
      return reply.send({ code: 0, message: 'success', data: detail });
    } catch (error: any) {
      request.log.error(error);
      return reply.status(500).send({ code: 500, message: error.message || 'Internal error' });
    }
  });

  /**
   * GET /api/enterprise/agent-identity/employees/:employeeId/health
   * 获取 AI 员工健康状态（仪表盘卡片用）
   */
  app.get('/employees/:employeeId/health', async (request, reply) => {
    try {
      const { employeeId } = request.params as { employeeId: string };
      const instance = await agentIdentityService.getByEmployeeId(employeeId);
      if (!instance) {
        return reply.send({ code: 0, data: { hasInstance: false, status: 'not_created' } });
      }
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const todayTasks = await prisma.enterpriseAgentTask.count({
        where: { agentInstanceId: instance.id, startedAt: { gte: today } },
      });
      return reply.send({
        code: 0,
        data: {
          hasInstance: true,
          status: instance.runtimeStatus,
          agentId: instance.agentId,
          namespace: instance.namespace,
          todayTasks,
          totalTasks: instance.totalTasks,
          totalErrors: instance.totalErrors,
          lastActiveAt: instance.lastActiveAt,
          healthScore: instance.totalTasks > 0
            ? Math.round((1 - instance.totalErrors / instance.totalTasks) * 100)
            : 100,
        },
      });
    } catch (error: any) {
      request.log.error(error);
      return reply.status(500).send({ code: 500, message: error.message || 'Internal error' });
    }
  });

  // ═══════════════════════════════════════════════
  // Sprint 4.2.9 Phase 4: Agent Channel Binding
  // ═══════════════════════════════════════════════

  /**
   * GET /api/enterprise/agent-identity/agents/:agentInstanceId/channels
   * 获取员工所有渠道绑定
   */
  app.get('/agents/:agentInstanceId/channels', async (request, reply) => {
    try {
      const user = request.user as any;
      const tenantId = user?.tenantId || user?.id;
      const { agentInstanceId } = request.params as { agentInstanceId: string };
      const bindings = await agentChannelBindingService.getBindingsByAgent(tenantId, agentInstanceId);
      return reply.send({ code: 0, message: 'success', data: bindings });
    } catch (error: any) {
      request.log.error(error);
      return reply.status(500).send({ code: 500, message: error.message || 'Internal error' });
    }
  });

  /**
   * POST /api/enterprise/agent-identity/agents/:agentInstanceId/channels
   * 绑定渠道到员工
   */
  app.post('/agents/:agentInstanceId/channels', async (request, reply) => {
    try {
      const user = request.user as any;
      const tenantId = user?.tenantId || user?.id;
      const { agentInstanceId } = request.params as { agentInstanceId: string };
      const { channelAccountId, permissions } = request.body as any;

      if (!channelAccountId) {
        return reply.status(400).send({ code: 400, message: 'channelAccountId 为必填' });
      }

      const binding = await agentChannelBindingService.createBinding({
        tenantId,
        agentInstanceId,
        channelAccountId,
        permissions,
      });
      return reply.send({ code: 0, message: 'success', data: binding });
    } catch (error: any) {
      request.log.error(error);
      if (error.message?.includes('已绑定') || error.message?.includes('不存在')) {
        return reply.status(400).send({ code: 400, message: error.message });
      }
      return reply.status(500).send({ code: 500, message: error.message || 'Internal error' });
    }
  });

  /**
   * PATCH /api/enterprise/agent-identity/channels/:bindingId
   * 更新绑定权限/状态
   */
  app.patch('/channels/:bindingId', async (request, reply) => {
    try {
      const user = request.user as any;
      const tenantId = user?.tenantId || user?.id;
      const { bindingId } = request.params as { bindingId: string };
      const { permissions, status } = request.body as any;

      const binding = await agentChannelBindingService.updateBinding(tenantId, bindingId, {
        permissions,
        status,
      });
      return reply.send({ code: 0, message: 'success', data: binding });
    } catch (error: any) {
      request.log.error(error);
      if (error.message?.includes('不存在')) {
        return reply.status(404).send({ code: 404, message: error.message });
      }
      return reply.status(500).send({ code: 500, message: error.message || 'Internal error' });
    }
  });

  /**
   * DELETE /api/enterprise/agent-identity/channels/:bindingId
   * 移除绑定
   */
  app.delete('/channels/:bindingId', async (request, reply) => {
    try {
      const user = request.user as any;
      const tenantId = user?.tenantId || user?.id;
      const { bindingId } = request.params as { bindingId: string };
      await agentChannelBindingService.removeBinding(tenantId, bindingId);
      return reply.send({ code: 0, message: 'success' });
    } catch (error: any) {
      request.log.error(error);
      if (error.message?.includes('不存在')) {
        return reply.status(404).send({ code: 404, message: error.message });
      }
      return reply.status(500).send({ code: 500, message: error.message || 'Internal error' });
    }
  });

  /**
   * GET /api/enterprise/agent-identity/channels/available
   * 获取企业中可绑定的渠道列表
   */
  app.get('/channels/available', async (request, reply) => {
    try {
      const user = request.user as any;
      const tenantId = user?.tenantId || user?.id;
      const channels = await agentChannelBindingService.getAvailableChannels(tenantId);
      return reply.send({ code: 0, message: 'success', data: channels });
    } catch (error: any) {
      request.log.error(error);
      return reply.status(500).send({ code: 500, message: error.message || 'Internal error' });
    }
  });

  // ═══════════════════════════════════════════════
  // Sprint 4.2.9 Phase 4.5: Channel Provider Registry
  // ═══════════════════════════════════════════════

  app.get('/providers', async (request, reply) => {
    try {
      const providers = await channelProviderService.listActive();
      return reply.send({ code: 0, message: 'success', data: providers });
    } catch (error: any) {
      request.log.error(error);
      return reply.status(500).send({ code: 500, message: error.message || 'Internal error' });
    }
  });

  app.get('/providers/seed', async (request, reply) => {
    try {
      const count = await channelProviderService.seedProviders();
      return reply.send({ code: 0, message: 'success', data: { seeded: count } });
    } catch (error: any) {
      request.log.error(error);
      return reply.status(500).send({ code: 500, message: error.message || 'Internal error' });
    }
  });

  // ═══════════════════════════════════════════════
  // Sprint 4.3.1 P0.5: Next Actions
  // ═══════════════════════════════════════════════

  app.get('/next-actions', async (request, reply) => {
    try {
      const user = request.user as any;
      const tenantId = user?.tenantId || user?.id;
      const actions = await agentIdentityService.getNextActions(tenantId);
      return reply.send({ code: 0, message: 'success', data: actions });
    } catch (error: any) {
      request.log.error(error);
      return reply.status(500).send({ code: 500, message: error.message || 'Internal error' });
    }
  });
}
