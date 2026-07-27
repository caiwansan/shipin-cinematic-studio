/**
 * agent-runtime/brain/agent-brain.service.ts
 * Agent Brain — 推理能力实现
 *
 * 通过 AI Runtime Gateway 调用 LLM
 * 复用 cost-controller / rate-limit / provider_state
 */

import type { PrismaClient } from '@prisma/client';
import type { RuntimeContext } from '../types/agent-runtime.types.js';
import type { BrainRequest, BrainResult, IAgentBrain } from './agent-brain.interface.js';
import { executeViaGateway } from '../../runtime/runtime-gateway.js';

export class AgentBrainService implements IAgentBrain {
  constructor(private prisma: PrismaClient) {}

  async reason(request: BrainRequest, context: RuntimeContext): Promise<BrainResult> {
    const startTime = Date.now();

    // 1. 加载 Agent Brain 配置
    const agent = await (this.prisma as any).enterpriseAgentProfile.findUnique({
      where: { id: context.agentId },
      select: {
        id: true,
        name: true,
        role: true,
        goal: true,
        knowledgeScope: true,
        metadata: true,
      },
    });

    if (!agent) {
      throw new Error(`Agent not found: ${context.agentId}`);
    }

    // 2. 构建 System Prompt
    const systemPrompt = this.buildSystemPrompt(agent, request.systemPrompt);

    // 3. 解析 Provider 配置
    // Sprint-06A: 如果有 EmployeeModelBinding，传 provider+model 让 input 层命中
    // 否则只传 tenantId，让 gateway 从 EnterpriseLlmConfig 解析
    const providerInfo = await this.resolveProvider(context.organizationId, context.agentId)

    // 4. 通过 AI Runtime Gateway 调用 LLM
    // Sprint-06A: 统一走 executeViaGateway，tenantId 触发企业配置层
    const gatewayOptions: Record<string, string> = { userId: context.actorId ?? '' }
    if (context.organizationId) {
      gatewayOptions.tenantId = context.organizationId
    }
    // 仅当有 Agent 级绑定时传 provider/model（input 层）
    if (providerInfo.fromBinding) {
      gatewayOptions.provider = providerInfo.provider
      gatewayOptions.model = providerInfo.model
    }

    const result = await executeViaGateway('llm', {
      systemPrompt,
      prompt: request.input,
      temperature: 0.7,
    }, gatewayOptions);

    const durationMs = Date.now() - startTime;

    // 5. 更新最后执行时间
    await (this.prisma as any).enterpriseAgentProfile.update({
      where: { id: context.agentId },
      data: { lastExecutionAt: new Date() },
    });

    return {
      output: result.content || '',
      tokensUsed: result.totalTokens || 0,
      provider: result.provider || providerInfo.provider,
      model: (result as any).model || providerInfo.model,
      durationMs,
    };
  }

  /**
   * 解析 Agent 的 Provider 配置
   * 优先级：EmployeeModelBinding → EnterpriseLlmConfig(tenant) → 环境变量
   *
   * Sprint-06A: 返回 fromBinding 标记，供 gateway 调用决定传参方式
   *   - fromBinding=true: 传 provider+model（agent 级精确绑定）
   *   - fromBinding=false: 仅传 tenantId，gateway 从 EnterpriseLlmConfig 解析
   */
  private async resolveProvider(organizationId: string, agentId: string): Promise<{ provider: string; model: string; fromBinding: boolean }> {
    // 1. 尝试从 EmployeeModelBinding 获取（agent 级精确绑定）
    const binding = await (this.prisma as any).employeeModelBinding.findFirst({
      where: { employeeId: agentId, enabled: true },
    })
    if (binding) {
      return { provider: 'deepseek', model: binding.modelName || 'deepseek-v4-flash', fromBinding: true }
    }

    // 2. 企业租户级配置 → 不传 provider/model，让 gateway 从 EnterpriseLlmConfig 解析
    if (organizationId) {
      const llmConfig = await (this.prisma as any).enterpriseLlmConfig.findFirst({
        where: { tenantId: organizationId, status: 'active', enabled: true, credentialOwner: 'enterprise' },
      })
      if (llmConfig) {
        return { provider: llmConfig.provider, model: llmConfig.modelName, fromBinding: false }
      }
    }

    // 3. 环境变量 fallback（无企业配置时的开发后门）
    return {
      provider: process.env.DEFAULT_PROVIDER || 'deepseek',
      model: process.env.DEEPSEEK_MODEL || 'deepseek-v4-flash',
      fromBinding: false,
    }
  }

  /**
   * 构建 System Prompt
   */
  private buildSystemPrompt(agent: any, overridePrompt?: string): string {
    if (overridePrompt) return overridePrompt;

    const parts: string[] = [];

    parts.push(`你是 ${agent.name}，一名${agent.role}。`);

    if (agent.goal) {
      parts.push(`\n## 你的目标\n${agent.goal}`);
    }

    if (agent.knowledgeScope) {
      let scope: string[] = [];
      try {
        scope = JSON.parse(agent.knowledgeScope);
      } catch {
        // ignore
      }
      if (scope.length > 0) {
        parts.push(`\n## 你的知识范围\n${scope.map((s: string) => `- ${s}`).join('\n')}`);
      }
    }

    parts.push('\n## 输出规范\n- 使用中文\n- 结构化输出\n- 提供可执行建议');

    return parts.join('\n');
  }
}
