/**
 * career-agent-task.service.ts — Sprint-10 Step 3B
 * Career Agent Autonomous Task Service
 *
 * 职责：
 *   1. 用户授权创建自治任务（CareerAgentTask）
 *   2. 任务执行协调（通过 Hermes Runtime → enterpriseAgentRuntime.executeTask）
 *   3. 执行结果持久化，供下次 Agent 聊天上下文注入
 *
 * 架构：
 *   不是业务服务 → 是 Task 生命周期管理
 *   Hermes Task → Career Agent → Job Matching Capability
 *
 * 不做的：
 *   ❌ 自动投递
 *   ❌ 通用工作流引擎
 *   ❌ CareerOpportunityWatcherService
 */

import { prisma } from '../../utils/index.js';
import { enterpriseAgentRuntime } from './enterprise-agent-runtime.service.js';
import { agentAuditService } from './agent-audit.service.js';

// ─── Types ──────────────────────────────────────────────

export interface CreateTaskParams {
  userId: string;
  agentInstanceId: string;
  taskType: string;
  input: string;
}

export interface TaskResult {
  id: string;
  status: string;
  result?: any;
  error?: string;
}

// ─── Task Service ───────────────────────────────────────

export class CareerAgentTaskService {

  /**
   * Step 2: 用户授权创建任务
   * 用户说"帮我关注AI Agent岗位" → 创建 pending CareerAgentTask
   */
  async createTask(params: CreateTaskParams): Promise<{ id: string; status: string }> {
    const { userId, agentInstanceId, taskType, input } = params;

    const task = await (prisma as any).careerAgentTask.create({
      data: {
        agentInstanceId,
        userId,
        taskType,
        status: 'pending',
        input,
        createdAt: new Date(),
      },
    });

    console.log(`[CareerAgentTask] ✅ Task created: id=${task.id.slice(0, 8)} type=${taskType} userId=${userId.slice(0, 8)}`);

    return { id: task.id, status: 'pending' };
  }

  /**
   * 查询用户已创建的自治任务
   */
  async listUserTasks(userId: string, limit = 10): Promise<any[]> {
    return (prisma as any).careerAgentTask.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });
  }

  /**
   * 查询 Agent 最近的自治任务（按 taskType）
   */
  async getLatestTaskByType(agentInstanceId: string, taskType: string): Promise<any | null> {
    return (prisma as any).careerAgentTask.findFirst({
      where: { agentInstanceId, taskType },
      orderBy: { createdAt: 'desc' },
    });
  }

  /**
   * 查询 Agent 所有已完成任务（用于 Agent 上下文注入）
   */
  async getRecentCompletedTasks(agentInstanceId: string, limit = 5): Promise<any[]> {
    return (prisma as any).careerAgentTask.findMany({
      where: { agentInstanceId, status: 'completed' },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });
  }

  /**
   * Step 4+5: 执行自治任务 + 写回结果
   *
   * 调用链路：
   *   CareerAgentTask → Hermes Runtime
   *     → enterpriseAgentRuntime.executeTask()
   *       → Memory Gate → Permission Gate → Tool → Result
   *     → 保存结果到 CareerAgentTask.result
   *     → 下次对话注入 Agent 上下文
   */
  async executeTask(taskId: string): Promise<TaskResult> {
    const task = await (prisma as any).careerAgentTask.findUnique({
      where: { id: taskId },
    });

    if (!task) {
      return { id: taskId, status: 'failed', error: 'TASK_NOT_FOUND' };
    }

    if (task.status !== 'pending') {
      return { id: taskId, status: task.status, error: `Task already ${task.status}` };
    }

    // 标记为 running
    await (prisma as any).careerAgentTask.update({
      where: { id: taskId },
      data: { status: 'running' },
    });

    // 获取 Agent Instance
    const instance = await (prisma as any).enterpriseAgentInstance.findUnique({
      where: { id: task.agentInstanceId },
      select: { id: true, tenantId: true, organizationId: true, employeeId: true },
    });
    if (!instance) {
      await this.failTask(taskId, 'AGENT_INSTANCE_NOT_FOUND');
      return { id: taskId, status: 'failed', error: 'AGENT_INSTANCE_NOT_FOUND' };
    }

    const profile = await (prisma as any).enterpriseAgentProfile.findUnique({
      where: { id: instance.employeeId },
      select: { id: true, agentType: true },
    });
    if (!profile) {
      await this.failTask(taskId, 'AGENT_PROFILE_NOT_FOUND');
      return { id: taskId, status: 'failed', error: 'AGENT_PROFILE_NOT_FOUND' };
    }

    const startTime = Date.now();

    try {
      // executeTask 内部经过：Memory Gate → Permission Gate → LLM/Tool
      const execResult = await enterpriseAgentRuntime.executeTask({
        taskId,
        profileId: instance.employeeId,
        tenantId: instance.tenantId,
        organizationId: instance.organizationId || undefined,
        userId: task.userId,
        taskType: task.taskType,
        instruction: task.input || '',
        businessType: 'career_agent',
      });

      if (!execResult.success) {
        await this.failTask(taskId, execResult.error || 'EXECUTION_FAILED');
        return { id: taskId, status: 'failed', error: execResult.error };
      }

      // 保存结构化结果到 CareerAgentTask.result
      const resultPayload = {
        output: execResult.output,
        summary: execResult.output?.slice(0, 500), // 对话注入用摘要
        tokens: {
          input: execResult.tokenInput,
          output: execResult.tokenOutput,
        },
        durationMs: execResult.durationMs,
        completedAt: new Date().toISOString(),
      };

      await (prisma as any).careerAgentTask.update({
        where: { id: taskId },
        data: {
          status: 'completed',
          result: JSON.stringify(resultPayload),
          completedAt: new Date(),
        },
      });

      // 审计: task 执行完成
      await agentAuditService.log({
        tenantId: task.userId,
        taskId,
        action: 'task.executed',
        resource: 'career_agent_task',
        resourceId: taskId,
        metadata: {
          taskType: task.taskType,
          durationMs: execResult.durationMs,
          tokens: `${execResult.tokenInput}+${execResult.tokenOutput}`,
        },
      });

      console.log(`[CareerAgentTask] ✅ Task completed: id=${taskId.slice(0, 8)} type=${task.taskType} duration=${execResult.durationMs}ms`);

      return {
        id: taskId,
        status: 'completed',
        result: resultPayload,
      };

    } catch (error: any) {
      console.error(`[CareerAgentTask] ❌ executeTask failed: taskId=${taskId.slice(0, 8)} error=${error.message}`);
      await this.failTask(taskId, error.message);
      return { id: taskId, status: 'failed', error: error.message };
    }
  }

  /**
   * 标记任务失败
   */
  private async failTask(taskId: string, error: string): Promise<void> {
    await (prisma as any).careerAgentTask.update({
      where: { id: taskId },
      data: {
        status: 'failed',
        error,
        completedAt: new Date(),
      },
    });
  }
}

// ─── Singleton ──────────────────────────────────────────

export const careerAgentTaskService = new CareerAgentTaskService();
