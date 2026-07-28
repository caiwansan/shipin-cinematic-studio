/**
 * services/career/career-agent-runtime.service.ts
 * Sprint-06A: Career Agent BYOK Runtime
 *
 * 核心职责：
 *   个人 AI 职业助理执行 — 走 UserModelConfigV2 BYOK，不碰 EnterpriseLlmConfig
 *
 * 调用链：
 *   Career Agent Task → careerAgentRuntime.executeTask()
 *     → resolveRuntimeConfig(userId) → UserModelConfigV2
 *     → executeViaGateway() → DeepSeek/OpenAI/通义/豆包
 *
 * 与企业端的区别：
 *   - 企业端走 EnterpriseLlmConfig（tenantId）
 *   - Career Agent 走 UserModelConfigV2（userId）— BYOK
 */

import type { PrismaClient } from '@prisma/client';
import { executeViaGateway } from '../../runtime/runtime-gateway.js';
import { prisma } from '../../utils/index.js';

export class CareerAgentRuntimeService {
  constructor(private prisma: PrismaClient) {}

  /**
   * 执行 Career Agent 任务（BYOK 链路）
   * Sprint-06A: 不再走 ModelRouter → callLLM
   * 改为 resolveRuntimeConfig(userId) → executeViaGateway
   */
  async executeTask(params: {
    userId: string;
    systemPrompt: string;
    userMessage: string;
    taskType?: string;
    maxTokens?: number;
    temperature?: number;
  }): Promise<CareerTaskResult> {
    const { userId, systemPrompt, userMessage, maxTokens = 4096, temperature = 0.7 } = params;
    const startTime = Date.now();

    try {
      // Sprint-07A.3: 通过 executeViaGateway 统一调用
      // userId + businessType=career_agent 触发 resolveRuntimeConfig 能力级配置
      const result = await executeViaGateway('llm', {
        systemPrompt,
        prompt: userMessage,
        maxTokens,
        temperature,
      }, {
        userId,
        businessType: 'career_agent',
      });

      const durationMs = Date.now() - startTime;

      // Sprint-06A: 写入 usage_logs（统一 Token 统计）
      try {
        await (this.prisma as any).usageLog.create({
          data: {
            userId,
            tenantId: userId, // Career Agent: userId 作为 tenantId
            taskType: `career_agent_${params.taskType || 'task'}`,
            cost: 0, // 用户 BYOK，平台不计费
            provider: result.provider || 'unknown',
            tokens: JSON.stringify({
              total: result.totalTokens || 0,
              source: 'user_capability_config',
              businessType: 'career_agent',
            }),
            isPlatform: false,
          },
        });
      } catch { /* usageLog 表可能不存在 */ }

      return {
        success: true,
        output: result.content || '',
        tokensUsed: result.totalTokens || 0,
        durationMs,
      };
    } catch (error: any) {
      const durationMs = Date.now() - startTime;
      // Sprint-07A.2-AI-03: 未配置 Key 时返回明确错误
      if (error.message?.includes('NO_BYOK_CONFIG') || error.message?.includes('未配置')) {
        return {
          success: false,
          output: '',
          tokensUsed: 0,
          durationMs,
          error: 'NO_BYOK_CONFIG',
        };
      }
      return {
        success: false,
        output: '',
        tokensUsed: 0,
        durationMs,
        error: error.message || 'CAREER_AGENT_EXECUTION_FAILED',
      };
    }
  }
}

export const careerAgentRuntime = new CareerAgentRuntimeService(prisma);
