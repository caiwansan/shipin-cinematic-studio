/**
 * agent-runtime/execution/step-executor.service.ts
 * Step Executor — 单个 Step 执行器
 *
 * 职责：
 *   1. 根据 nodeType 分发到不同执行逻辑
 *   2. Brain Step → 调用 Agent Brain
 *   3. Approval Step → 等待人工审批
 *   4. Tool Step → 预留（Mock）
 */

import type { PrismaClient } from '@prisma/client';
import type { IAgentBrain } from '../brain/agent-brain.interface.js';
import type { RuntimeContext } from '../types/agent-runtime.types.js';

export interface StepExecutionResult {
  status: 'completed' | 'failed' | 'waiting_approval';
  output?: string;
  error?: string;
}

export class StepExecutorService {
  constructor(
    private prisma: PrismaClient,
    private brain: IAgentBrain,
  ) {}

  /**
   * 执行单个 Step
   */
  async executeStep(
    stepId: string,
    nodeType: string,
    nodeConfig: any,
    input: string,
    context: RuntimeContext
  ): Promise<StepExecutionResult> {
    switch (nodeType) {
      case 'brain':
        return this.executeBrainStep(nodeConfig, input, context);
      case 'generate':
        return this.executeGenerateStep(nodeConfig, input, context);
      case 'approval':
        return this.executeApprovalStep(stepId);
      case 'tool':
        return this.executeToolStep(nodeConfig, input, context);
      default:
        return { status: 'failed', error: `Unknown node type: ${nodeType}` };
    }
  }

  /**
   * Brain Step — 调用 Agent Brain 推理
   */
  private async executeBrainStep(
    config: any,
    input: string,
    context: RuntimeContext
  ): Promise<StepExecutionResult> {
    try {
      const result = await this.brain.reason({
        input,
        systemPrompt: config?.systemPrompt,
        context: config?.context,
      }, context);

      return {
        status: 'completed',
        output: result.output,
      };
    } catch (error: any) {
      return {
        status: 'failed',
        error: error.message,
      };
    }
  }

  /**
   * Generate Step — 生成结构化输出
   */
  private async executeGenerateStep(
    config: any,
    input: string,
    context: RuntimeContext
  ): Promise<StepExecutionResult> {
    try {
      const generatePrompt = config?.prompt || '请根据以下信息生成一份结构化报告：\n\n';
      const result = await this.brain.reason({
        input: `${generatePrompt}${input}`,
        systemPrompt: '你是一个专业的报告生成专家。请生成结构化的Markdown格式报告。',
      }, context);

      return {
        status: 'completed',
        output: result.output,
      };
    } catch (error: any) {
      return {
        status: 'failed',
        error: error.message,
      };
    }
  }

  /**
   * Approval Step — 人工审批节点
   */
  private async executeApprovalStep(stepId: string): Promise<StepExecutionResult> {
    // 设置为等待审批状态
    await (this.prisma as any).enterpriseAgentWorkflowStep.update({
      where: { id: stepId },
      data: {
        status: 'waiting_approval',
        approvalStatus: 'pending',
      },
    });

    return {
      status: 'waiting_approval',
      output: '等待人工审批',
    };
  }

  /**
   * Tool Step — 预留接口（Mock）
   */
  private async executeToolStep(
    config: any,
    input: string,
    context: RuntimeContext
  ): Promise<StepExecutionResult> {
    // Sprint 2.2.3: Mock Tool Step
    return {
      status: 'completed',
      output: `[Tool Mock] Tool execution placeholder for: ${config?.toolName || 'unknown'}`,
    };
  }
}
