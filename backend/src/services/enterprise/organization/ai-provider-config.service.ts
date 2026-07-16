// AI Provider Config Service — API 密钥与模型配置服务
// 企业管理自己的 AI 模型接入 (DeepSeek, GPT-4, Claude...)
// 密钥加密存储，支持多模型切换

import { PrismaClient } from '@prisma/client';
import { randomUUID } from 'crypto';

const prisma = new PrismaClient();

// Simple AES encryption for API keys (use KMS in production)
import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from 'crypto';
const ENCRYPTION_KEY = process.env.API_KEY_ENCRYPTION_KEY || 'kunlun-mirror-enterprise-key-32bytes!!';

function encrypt(text: string): string {
  const iv = randomBytes(16);
  const key = scryptSync(ENCRYPTION_KEY, 'salt', 32);
  const cipher = createCipheriv('aes-256-gcm', key, iv);
  const encrypted = Buffer.concat([cipher.update(text, 'utf8'), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return `${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted.toString('hex')}`;
}

function decrypt(encryptedData: string): string {
  const parts = encryptedData.split(':');
  if (parts.length !== 3) throw new Error('Invalid encrypted data format');
  const iv = Buffer.from(parts[0], 'hex');
  const authTag = Buffer.from(parts[1], 'hex');
  const encrypted = Buffer.from(parts[2], 'hex');
  const key = scryptSync(ENCRYPTION_KEY, 'salt', 32);
  const decipher = createDecipheriv('aes-256-gcm', key, iv);
  decipher.setAuthTag(authTag);
  return decipher.update(encrypted) + decipher.final('utf8');
}

export interface CreateAIProviderInput {
  organizationId: string;
  provider: string;
  apiKey: string;
  baseUrl?: string;
  model: string;
  maxTokensPerDay?: number;
}

export class AIProviderConfigService {

  /**
   * 列出企业已配置的 AI 提供者（不返回密钥）
   */
  async listForOrganization(organizationId: string) {
    const configs = await prisma.aIProviderConfig.findMany({
      where: { organizationId },
      orderBy: { createdAt: 'desc' }
    });

    return configs.map(c => ({
      id: c.id,
      provider: c.provider,
      model: c.model,
      baseUrl: c.baseUrl,
      maxTokensPerDay: c.maxTokensPerDay,
      enabled: c.enabled,
      status: c.status,
      createdAt: c.createdAt,
      updatedAt: c.updatedAt,
      // Masked key for display (show only first 8 and last 4 chars)
      apiKeyMasked: 'sk-****' + '••••••••',
    }));
  }

  /**
   * 添加 AI 提供者
   */
  async create(data: CreateAIProviderInput) {
    const encryptedApiKey = encrypt(data.apiKey);

    return prisma.aIProviderConfig.create({
      data: {
        organizationId: data.organizationId,
        provider: data.provider,
        encryptedApiKey,
        baseUrl: data.baseUrl,
        model: data.model,
        maxTokensPerDay: data.maxTokensPerDay || 0,
      }
    });
  }

  /**
   * 获取并解密 API Key (internal use only)
   */
  async getDecrypted(id: string) {
    const config = await prisma.aIProviderConfig.findUnique({ where: { id } });
    if (!config) return null;
    return { ...config, apiKey: decrypt(config.encryptedApiKey) };
  }

  /**
   * 更新状态
   */
  async updateStatus(id: string, status: string) {
    return prisma.aIProviderConfig.update({
      where: { id },
      data: { status }
    });
  }

  /**
   * 切换启用状态
   */
  async toggleEnabled(id: string) {
    const current = await prisma.aIProviderConfig.findUnique({ where: { id } });
    if (!current) return null;
    return prisma.aIProviderConfig.update({
      where: { id },
      data: { enabled: !current.enabled }
    });
  }

  /**
   * 删除配置
   */
  async remove(id: string) {
    return prisma.aIProviderConfig.delete({ where: { id } });
  }

  /**
   * 获取企业默认活跃模型
   */
  async getDefaultProvider(organizationId: string) {
    return prisma.aIProviderConfig.findFirst({
      where: { organizationId, enabled: true, status: 'active' },
      orderBy: { createdAt: 'asc' }
    });
  }

  /**
   * 获取支持的模型提供商列表
   */
  getSupportedProviders() {
    return [
      { id: 'deepseek', name: 'DeepSeek', models: ['deepseek-chat', 'deepseek-coder', 'deepseek-reasoner'], defaultBaseUrl: 'https://api.deepseek.com/v1' },
      { id: 'openai', name: 'OpenAI', models: ['gpt-4o', 'gpt-4o-mini', 'gpt-4-turbo', 'o1-preview'], defaultBaseUrl: 'https://api.openai.com/v1' },
      { id: 'claude', name: 'Anthropic Claude', models: ['claude-3-5-sonnet', 'claude-3-opus', 'claude-3-haiku'], defaultBaseUrl: 'https://api.anthropic.com/v1' },
      { id: 'qwen', name: '通义千问', models: ['qwen-max', 'qwen-plus', 'qwen-turbo'], defaultBaseUrl: 'https://dashscope.aliyuncs.com/compatible-mode/v1' },
      { id: 'zhipu', name: '智谱 GLM', models: ['glm-4-plus', 'glm-4', 'glm-4-flash'], defaultBaseUrl: 'https://open.bigmodel.cn/api/paas/v4' },
      { id: 'kimi', name: '月之暗面 Kimi', models: ['moonshot-v1-8k', 'moonshot-v1-32k'], defaultBaseUrl: 'https://api.moonshot.cn/v1' },
    ];
  }

  /**
   * Decrypt API Key (exposed for route-level use)
   */
  decryptKey(encryptedKey: string): string {
    return decrypt(encryptedKey)
  }
}

/**
 * Test provider connection with a minimal chat completion request
 */
export async function testProviderConnection(
  provider: string,
  apiKey: string,
  baseUrl?: string | null,
  model?: string,
): Promise<{ success: boolean; latencyMs: number; error?: string }> {
  const start = Date.now()
  try {
    const base = baseUrl || 'https://api.deepseek.com/v1'
    const url = `${base.replace(/\/$/, '')}/chat/completions`
    const testModel = model || 'deepseek-chat'

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: testModel,
        messages: [{ role: 'user', content: 'Hello' }],
        max_tokens: 5,
        temperature: 0,
      }),
    })

    const latencyMs = Date.now() - start
    if (!response.ok) {
      const body = await response.text().catch(() => '')
      return { success: false, latencyMs, error: `HTTP ${response.status}: ${body.slice(0, 200)}` }
    }

    return { success: true, latencyMs }
  } catch (err: any) {
    const latencyMs = Date.now() - start
    return { success: false, latencyMs, error: err.message }
  }
}

export const aiProviderConfigService = new AIProviderConfigService();
