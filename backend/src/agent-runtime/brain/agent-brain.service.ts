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

// SPRINT-KMKI-AUDIT-02: 统一 Runtime Resolver（KMKI AI Runtime Principle 冻结）
// 企业 AI 员工一律走 modelResolver.resolveEnterpriseModel（OrgModelConfig + ProviderCredential 唯一权威）
// 禁止 agent-brain 自行读取 EmployeeModelBinding / EnterpriseLlmConfig 旧表（双轨断裂源）
const ENTERPRISE_MODEL_MISSING_MSG =
  '企业模型配置缺失 — 请企业管理员前往 企业工作台 → AI模型设置 配置模型与 API Key（企业提供算力，平台不托管企业 Key）'

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

    // 3. 解析 Provider 配置（KMKI 统一 Resolver：企业 BYOK 唯一权威，无配置显式阻断）
    // 旧实现读 EmployeeModelBinding/EnterpriseLlmConfig → 双轨断裂，已退役
    const providerInfo = await this.resolveProvider(context.organizationId || '', context.agentId || '')

    // 4. 通过 AI Runtime Gateway 调用 LLM
    // KMKI: 企业 AI 员工 → 统一 Resolver 解析（OrgModelConfig 权威）→ 企业 Key 显式注入（不落平台表）
    const gatewayOptions: Record<string, string> = { userId: context.actorId ?? '' }
    if (context.organizationId) {
      gatewayOptions.tenantId = context.organizationId
      // provider/model/apiKey 由 resolveProvider 给出（企业 BYOK，Input Override）
      if (providerInfo.provider && providerInfo.model) {
        gatewayOptions.provider = providerInfo.provider
        gatewayOptions.model = providerInfo.model
      }
      if (providerInfo.apiKey) {
        gatewayOptions.apiKey = providerInfo.apiKey
      }
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
   * KMKI AI Runtime Principle（冻结）: 统一 Runtime Resolver，企业 BYOK 唯一权威
   *   - 企业 AI 员工 → modelResolver.resolveEnterpriseModel（OrgModelConfig + ProviderCredential）
   *   - 未配置 → 显式阻断（G2 身份隔离，不 fallback 个人/平台 Key）
   *   - 非企业上下文 → 空配置，交给 executeViaGateway → resolveRuntimeConfig 统一链
   * 旧实现（EmployeeModelBinding → EnterpriseLlmConfig → env 开发后门）已退役：双轨断裂源
   */
  private async resolveProvider(organizationId: string, agentId: string): Promise<{ provider: string; model: string; apiKey: string; fromBinding: boolean }> {
    if (organizationId) {
      const { ModelResolverService } = await import('../../services/enterprise/model-resolver.service.js')
      const resolver = new ModelResolverService()
      const resolved = await resolver.resolveEnterpriseModel({ organizationId, tenantId: organizationId })
      if (!resolved) {
        throw new Error(ENTERPRISE_MODEL_MISSING_MSG)
      }
      return {
        provider: resolved.provider,
        model: resolved.model,
        apiKey: resolved.apiKey || '',
        fromBinding: false,
      }
    }

    // 非企业上下文：不传 provider/model，由 executeViaGateway 统一链解析（用户 BYOK → 平台默认）
    return { provider: '', model: '', apiKey: '', fromBinding: false }
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
