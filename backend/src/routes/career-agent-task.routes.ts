/**
 * career-agent-task.routes.ts — Sprint-10 Step 3B
 * Career Agent Autonomous Task API
 *
 * 端点：
 *   POST /api/career/agent/task      — 用户授权创建自治任务
 *   GET  /api/career/agent/tasks      — 查询用户自治任务列表
 *   POST /api/career/agent/task/:id/execute — 执行指定任务
 *
 * 执行链路（Task 04）：
 *   CareerAgentTask
 *     → Hermes Runtime
 *       → enterpriseAgentRuntime.executeTask()
 *         → Memory Gate (Step 3A)
 *         → Permission Gate (Step 3A)
 *         → Job Matching Tool (CareerToolRegistry)
 *       → 保存 Result (CareerAgentTask.result)
 *     → 下次对话注入 Agent 上下文
 */

import type { FastifyInstance } from 'fastify';
import { PrismaClient } from '@prisma/client';
import { careerAgentTaskService } from '../services/enterprise/career-agent-task.service.js';
import { enterpriseAgentRuntime } from '../services/enterprise/enterprise-agent-runtime.service.js';

export async function careerAgentTaskRoutes(fastify: FastifyInstance) {
  const prisma = new PrismaClient();
  fastify.addHook('preHandler', fastify.authenticate);

  /**
   * POST /api/career/agent/task
   * 用户授权创建自治任务
   *
   * Body:
   *   taskType: string  (e.g. job_watch)
   *   instruction: string (用户指令，如"帮我关注AI Agent岗位")
   *   agentInstanceId?: string (自动查找如果未传)
   */
  fastify.post('/api/career/agent/task', async (request, reply) => {
    const userId = (request as any).user?.id || (request as any).userId;
    if (!userId) {
      return reply.code(401).send({ error: 'UNAUTHORIZED', message: 'User identity required' });
    }

    const body = request.body as any;
    const { taskType, instruction, agentInstanceId: explicitAgentId } = body;

    if (!taskType || !instruction) {
      return reply.code(400).send({
        error: 'MISSING_FIELDS',
        message: 'taskType and instruction are required',
      });
    }

    try {
      // 1. 查找用户的 Career Agent Instance
      let agentInstanceId = explicitAgentId;

      if (!agentInstanceId) {
        const profile = await (prisma as any).enterpriseAgentProfile.findFirst({
          where: { userId, agentType: 'career_advisor' },
          select: { id: true },
          orderBy: { createdAt: 'desc' },
        });

        if (!profile) {
          return reply.code(404).send({
            error: 'NO_CAREER_AGENT',
            message: '尚未开通 AI 职业助理 — 请先开通',
            action: 'purchase_career_agent',
          });
        }

        const instance = await (prisma as any).enterpriseAgentInstance.findUnique({
          where: { employeeId: profile.id },
          select: { id: true, runtimeStatus: true },
        });

        if (!instance || instance.runtimeStatus !== 'active') {
          return reply.code(422).send({
            error: 'AGENT_NOT_ACTIVE',
            message: 'AI 职业助理未激活 — 请先激活',
          });
        }

        agentInstanceId = instance.id;
      }

      // 2. 创建自治任务
      const result = await careerAgentTaskService.createTask({
        userId,
        agentInstanceId,
        taskType,
        input: instruction,
      });

      return reply.send({
        code: 0,
        message: '任务已创建，即将开始关注',
        data: {
          taskId: result.id,
          status: result.status,
          taskType,
        },
      });

    } catch (error: any) {
      console.error('[CareerAgentTask] ❌ create error:', error.message);
      return reply.code(500).send({ error: 'INTERNAL_ERROR', message: error.message });
    }
  });

  /**
   * GET /api/career/agent/tasks
   * 查询用户自治任务列表
   */
  fastify.get('/api/career/agent/tasks', async (request, reply) => {
    const userId = (request as any).user?.id || (request as any).userId;
    if (!userId) {
      return reply.code(401).send({ error: 'UNAUTHORIZED' });
    }

    try {
      const tasks = await careerAgentTaskService.listUserTasks(userId);
      return reply.send({ code: 0, data: tasks });
    } catch (error: any) {
      return reply.code(500).send({ error: 'INTERNAL_ERROR', message: error.message });
    }
  });

  /**
   * POST /api/career/agent/task/:id/execute
   * 立即执行指定自治任务
   */
  fastify.post('/api/career/agent/task/:id/execute', async (request, reply) => {
    const userId = (request as any).user?.id || (request as any).userId;
    if (!userId) {
      return reply.code(401).send({ error: 'UNAUTHORIZED' });
    }

    const { id } = request.params as { id: string };

    try {
      const result = await careerAgentTaskService.executeTask(id);

      if (result.status === 'failed') {
        return reply.code(500).send({
          error: 'EXECUTION_FAILED',
          message: result.error,
          data: result,
        });
      }

      return reply.send({
        code: 0,
        message: '任务执行完成',
        data: result,
      });

    } catch (error: any) {
      return reply.code(500).send({ error: 'INTERNAL_ERROR', message: error.message });
    }
  });
}
