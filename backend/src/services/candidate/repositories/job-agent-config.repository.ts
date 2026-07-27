// ============================================================
// JobAgentConfigRepository — 求职管家 Agent 模型配置
// 平台 SaaS 服务，API Key 加密存储，不走用户 BYOK
// ============================================================

import { prisma } from '../../../utils/index.js';
import { encryptKey, decryptKey } from '../../../services/crypto.service.js';

export interface CreateJobAgentConfigInput {
  agentType?: string;
  agentName?: string;
  provider: string;
  model: string;
  apiKey: string;
  baseUrl?: string;
  systemPrompt?: string;
  temperature?: number;
  maxTokens?: number;
  enabled?: boolean;
}

export interface UpdateJobAgentConfigInput {
  agentName?: string;
  provider?: string;
  model?: string;
  apiKey?: string;
  baseUrl?: string;
  systemPrompt?: string;
  temperature?: number;
  maxTokens?: number;
  enabled?: boolean;
}

function toDTO(record: any, revealKey = false) {
  if (!record) return null;
  return {
    id: record.id,
    agentType: record.agentType,
    agentName: record.agentName,
    provider: record.provider,
    model: record.model,
    apiKeyEncrypted: revealKey
      ? record.apiKeyEncrypted
      : (record.apiKeyEncrypted ? '••••' + record.apiKeyEncrypted.slice(-4) : ''),
    baseUrl: record.baseUrl ?? null,
    systemPrompt: record.systemPrompt ?? null,
    temperature: record.temperature,
    maxTokens: record.maxTokens,
    enabled: record.enabled,
    totalCalls: record.totalCalls,
    totalTokens: record.totalTokens,
    createdAt: record.createdAt?.toISOString() ?? null,
    updatedAt: record.updatedAt?.toISOString() ?? null,
  };
}

export const jobAgentConfigRepository = {
  /**
   * 创建 Agent 配置
   */
  async create(input: CreateJobAgentConfigInput) {
    const record = await prisma.jobAgentConfig.create({
      data: {
        agentType: input.agentType ?? 'career_assistant',
        agentName: input.agentName ?? '求职管家',
        provider: input.provider,
        model: input.model,
        apiKeyEncrypted: input.apiKey ? encryptKey(input.apiKey) : '',
        baseUrl: input.baseUrl ?? null,
        systemPrompt: input.systemPrompt ?? null,
        temperature: input.temperature ?? 0.7,
        maxTokens: input.maxTokens ?? 2000,
        enabled: input.enabled ?? true,
      },
    });
    return toDTO(record);
  },

  /**
   * 获取所有配置
   */
  async listAll() {
    const records = await prisma.jobAgentConfig.findMany({
      orderBy: { createdAt: 'desc' },
    });
    return records.map(r => toDTO(r));
  },

  /**
   * 按 agentType 获取启用的配置
   */
  async getActiveByType(agentType: string) {
    const record = await prisma.jobAgentConfig.findFirst({
      where: { agentType, enabled: true },
      orderBy: { createdAt: 'asc' },
    });
    return toDTO(record);
  },

  /**
   * 通过 ID 获取配置
   */
  async getById(id: string) {
    const record = await prisma.jobAgentConfig.findUnique({
      where: { id },
    });
    return toDTO(record);
  },

  /**
   * 获取解密的 API Key（仅供 Agent Runtime 内部使用）
   */
  async getDecryptedApiKey(id: string): Promise<string | null> {
    const record = await prisma.jobAgentConfig.findUnique({
      where: { id },
      select: { apiKeyEncrypted: true },
    });
    if (!record || !record.apiKeyEncrypted) return null;
    try {
      return decryptKey(record.apiKeyEncrypted);
    } catch {
      return null;
    }
  },

  /**
   * 更新配置
   */
  async update(id: string, input: UpdateJobAgentConfigInput) {
    const data: any = {};
    if (input.agentName !== undefined) data.agentName = input.agentName;
    if (input.provider !== undefined) data.provider = input.provider;
    if (input.model !== undefined) data.model = input.model;
    if (input.apiKey !== undefined) data.apiKeyEncrypted = encryptKey(input.apiKey);
    if (input.baseUrl !== undefined) data.baseUrl = input.baseUrl;
    if (input.systemPrompt !== undefined) data.systemPrompt = input.systemPrompt;
    if (input.temperature !== undefined) data.temperature = input.temperature;
    if (input.maxTokens !== undefined) data.maxTokens = input.maxTokens;
    if (input.enabled !== undefined) data.enabled = input.enabled;

    const record = await prisma.jobAgentConfig.update({
      where: { id },
      data,
    });
    return toDTO(record);
  },

  /**
   * 删除配置
   */
  async delete(id: string) {
    await prisma.jobAgentConfig.delete({ where: { id } });
  },

  /**
   * 切换启用/禁用
   */
  async toggleEnabled(id: string) {
    const existing = await prisma.jobAgentConfig.findUnique({
      where: { id },
      select: { enabled: true },
    });
    if (!existing) return null;
    const record = await prisma.jobAgentConfig.update({
      where: { id },
      data: { enabled: !existing.enabled },
    });
    return toDTO(record);
  },

  /**
   * 记录调用统计
   */
  async recordCall(id: string, tokens: number) {
    const record = await prisma.jobAgentConfig.update({
      where: { id },
      data: {
        totalCalls: { increment: 1 },
        totalTokens: { increment: tokens },
      },
    });
    return toDTO(record);
  },
};
