/**
 * agent-runtime/gateway/credential-resolver.service.ts
 * Phase 3.1.3-A — Provider Credential Resolver Implementation
 * 
 * 统一凭证解析链路：
 *   Agent → enterprise_agent_model_binding → enterprise_provider_credential → 解密 → Provider
 * 
 * 兜底策略：
 *   1. 优先使用 Agent 绑定的 Model + Credential
 *   2. 无绑定 → 使用组织默认 Credential
 *   3. 无默认 → 使用环境变量（仅开发模式）
 */

import type { PrismaClient } from '@prisma/client';
import type { ProviderCredential, ProviderCredentialResolver } from './credential-resolver.interface.js';
import { decryptApiKey } from '../../services/enterprise/organization/provider-credential.service.js';

// Provider → Base URL 映射（fallback only）
const PROVIDER_BASE_URLS: Record<string, string> = {
  deepseek: 'https://api.deepseek.com/v1',
  openai: 'https://api.openai.com/v1',
  qwen: 'https://dashscope.aliyuncs.com/compatible-mode/v1',
  bailian: 'https://dashscope.aliyuncs.com/compatible-mode/v1',
  aliyun: 'https://dashscope.aliyuncs.com/compatible-mode/v1',
  doubao: 'https://ark.cn-beijing.volces.com/v1',
  siliconflow: 'https://api.siliconflow.cn/v1',
  volcengine: 'https://ark.cn-beijing.volces.com/api/v3',
  anthropic: 'https://api.anthropic.com/v1',
  zhipu: 'https://open.bigmodel.cn/api/paas/v4',
  kimi: 'https://api.moonshot.cn/v1',
};

export class ProviderCredentialResolverImpl implements ProviderCredentialResolver {
  constructor(private prisma: PrismaClient) {}

  async resolve(organizationId: string, agentId?: string): Promise<ProviderCredential> {
    // 1. 尝试 Agent 绑定的 Model + Credential
    if (agentId) {
      const binding = await (this.prisma as any).enterpriseAgentModelBinding.findFirst({
        where: { agentId, organizationId, status: 'active' },
        include: { credential: true },
      });

      if (binding && binding.credential) {
        const cred = binding.credential;
        return {
          provider: cred.provider,
          model: cred.modelName,
          apiKey: decryptApiKey(cred.apiKeyEncrypted, cred.apiKeyIv, cred.apiKeyTag),
          baseUrl: cred.baseUrl || PROVIDER_BASE_URLS[cred.provider] || '',
          reasoningMode: binding.reasoningMode || 'analytical',
        };
      }
    }

    // 2. 兜底：组织默认 Credential
    return this.resolveDefault(organizationId);
  }

  async resolveDefault(organizationId: string): Promise<ProviderCredential> {
    // 查找组织默认 Provider
    const defaultCred = await (this.prisma as any).enterpriseProviderCredential.findFirst({
      where: { organizationId, status: 'active', isDefault: true },
    });

    if (defaultCred) {
      return {
        provider: defaultCred.provider,
        model: defaultCred.modelName,
        apiKey: decryptApiKey(defaultCred.apiKeyEncrypted, defaultCred.apiKeyIv, defaultCred.apiKeyTag),
        baseUrl: defaultCred.baseUrl || PROVIDER_BASE_URLS[defaultCred.provider] || '',
        reasoningMode: 'analytical',
      };
    }

    // 3. 兜底：任意活跃的 Credential
    const anyCred = await (this.prisma as any).enterpriseProviderCredential.findFirst({
      where: { organizationId, status: 'active' },
      orderBy: { createdAt: 'asc' },
    });

    if (anyCred) {
      return {
        provider: anyCred.provider,
        model: anyCred.modelName,
        apiKey: decryptApiKey(anyCred.apiKeyEncrypted, anyCred.apiKeyIv, anyCred.apiKeyTag),
        baseUrl: anyCred.baseUrl || PROVIDER_BASE_URLS[anyCred.provider] || '',
        reasoningMode: 'analytical',
      };
    }

    // 4. 开发模式 fallback
    const devProvider = process.env.DEFAULT_PROVIDER || 'deepseek';
    const devKey = process.env[`${devProvider.toUpperCase()}_API_KEY`] || '';
    
    if (!devKey) {
      throw new Error(
        `[PROVIDER_RESOLVER] 组织 ${organizationId} 未配置任何 Provider 凭证。` +
        `请在企业控制台 → AI Runtime → Provider 管理中配置 API Key。`
      );
    }

    return {
      provider: devProvider,
      model: process.env[`${devProvider.toUpperCase()}_MODEL`] || 'deepseek-v4-flash',
      apiKey: devKey,
      baseUrl: PROVIDER_BASE_URLS[devProvider] || '',
      reasoningMode: 'analytical',
    };
  }

  async healthCheck(organizationId: string, provider: string): Promise<{
    status: 'healthy' | 'invalid_key' | 'missing_key' | 'error';
    message: string;
    latencyMs?: number;
  }> {
    try {
      const cred = await (this.prisma as any).enterpriseProviderCredential.findFirst({
        where: { organizationId, provider, status: 'active' },
      });

      if (!cred) {
        return { status: 'missing_key', message: `未配置 ${provider} 凭证` };
      }

      const apiKey = decryptApiKey(cred.apiKeyEncrypted, cred.apiKeyIv, cred.apiKeyTag);
      const baseUrl = cred.baseUrl || PROVIDER_BASE_URLS[provider] || 'https://api.deepseek.com/v1';
      
      const start = Date.now();
      const response = await fetch(`${baseUrl.replace(/\/$/, '')}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model: cred.modelName,
          messages: [{ role: 'user', content: 'ping' }],
          max_tokens: 1,
        }),
      });
      const latencyMs = Date.now() - start;

      if (response.ok) {
        return { status: 'healthy', message: '连接正常', latencyMs };
      }
      if (response.status === 401) {
        return { status: 'invalid_key', message: '认证失败，请检查 API Key', latencyMs };
      }
      if (response.status === 429) {
        return { status: 'error', message: '配额已用完', latencyMs };
      }
      return { status: 'error', message: `HTTP ${response.status}`, latencyMs };
    } catch (error: any) {
      return { status: 'error', message: `网络错误: ${error.message}` };
    }
  }
}
