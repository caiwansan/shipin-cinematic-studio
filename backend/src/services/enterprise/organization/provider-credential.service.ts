/**
 * services/enterprise/organization/provider-credential.service.ts
 * Phase 3.1.2 — Provider Credential Management
 * 
 * 企业数字部门控制台 → 配置 API Key → AES-256-GCM 加密存储 → Gateway 读取
 */

import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from 'crypto';

// AES-256-GCM 加密配置
const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 16;
const TAG_LENGTH = 16;
const KEY_LENGTH = 32;

/**
 * 获取加密密钥（从环境变量 — 这是系统级密钥，不是 Provider API Key）
 */
function getMasterKey(): Buffer {
  const secret = process.env.CREDENTIAL_MASTER_KEY || process.env.JWT_SECRET || 'default-master-key-min-32-chars-long!';
  return scryptSync(secret, 'kunlun-salt', KEY_LENGTH);
}

/**
 * 加密 API Key
 */
export function encryptApiKey(plainText: string): { encrypted: string; iv: string; tag: string } {
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv(ALGORITHM, getMasterKey(), iv);
  
  let encrypted = cipher.update(plainText, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  
  const tag = cipher.getAuthTag();
  
  return {
    encrypted,
    iv: iv.toString('hex'),
    tag: tag.toString('hex'),
  };
}

/**
 * 解密 API Key
 */
export function decryptApiKey(encrypted: string, iv: string, tag: string): string {
  const decipher = createDecipheriv(
    ALGORITHM,
    getMasterKey(),
    Buffer.from(iv, 'hex')
  );
  decipher.setAuthTag(Buffer.from(tag, 'hex'));
  
  let decrypted = decipher.update(encrypted, 'hex', 'utf8');
  decrypted += decipher.final('utf8');
  
  return decrypted;
}

export interface ProviderCredentialInput {
  organizationId: string;
  provider: string;
  modelName: string;
  apiKey: '';
  baseUrl?: string;
  isDefault?: boolean;
  createdBy?: string;
}

export interface AgentModelBindingInput {
  organizationId: string;
  agentId: string;
  credentialId: string;
  provider: string;
  modelName: string;
  reasoningMode?: string;
}

export class ProviderCredentialService {
  constructor(private prisma: any) {}

  /**
   * 创建 Provider 凭证（加密存储）
   */
  async createCredential(input: ProviderCredentialInput): Promise<{ id: string; provider: string; modelName: string }> {
    const { encrypted, iv, tag } = encryptApiKey(input.apiKey);
    
    // Use upsert to handle duplicate provider+model for same organization
    const credential = await this.prisma.enterpriseProviderCredential.upsert({
      where: {
        organizationId_provider_modelName: {
          organizationId: input.organizationId,
          provider: input.provider,
          modelName: input.modelName,
        },
      },
      update: {
        apiKeyEncrypted: encrypted,
        apiKeyIv: iv,
        apiKeyTag: tag,
        baseUrl: input.baseUrl || null,
        isDefault: input.isDefault || false,
        status: 'active',
      },
      create: {
        organizationId: input.organizationId,
        tenantId: input.organizationId,
        provider: input.provider,
        modelName: input.modelName,
        apiKeyEncrypted: encrypted,
        apiKeyIv: iv,
        apiKeyTag: tag,
        baseUrl: input.baseUrl || null,
        isDefault: input.isDefault || false,
        createdBy: input.createdBy || null,
        status: 'active',
      },
    });

    return { id: credential.id, provider: credential.provider, modelName: credential.modelName };
  }

  /**
   * 获取组织的 Provider 凭证列表（不含密钥）
   */
  async listCredentials(organizationId: string): Promise<Array<{
    id: string; provider: string; modelName: string; baseUrl: string | null;
    isDefault: boolean; status: string; healthStatus: string; createdAt: Date;
  }>> {
    return this.prisma.enterpriseProviderCredential.findMany({
      where: { organizationId },
      select: {
        id: true, provider: true, modelName: true, baseUrl: true,
        isDefault: true, status: true, healthStatus: true, createdAt: true,
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  /**
   * 获取解密的 API Key（仅用于 Gateway 调用）
   */
  async getDecryptedApiKey(credentialId: string, organizationId: string): Promise<string | null> {
    const credential = await this.prisma.enterpriseProviderCredential.findFirst({
      where: { id: credentialId, organizationId, status: 'active' },
    });
    
    if (!credential) return null;
    
    return decryptApiKey(
      credential.apiKeyEncrypted,
      credential.apiKeyIv,
      credential.apiKeyTag
    );
  }

  /**
   * 获取组织默认 Provider 的解密 Key
   */
  async getDefaultCredential(organizationId: string, provider?: string): Promise<{
    id: string; apiKey: ''; modelName: string; baseUrl: string | null;
  } | null> {
    const where: any = { organizationId, status: 'active', isDefault: true };
    if (provider) where.provider = provider;
    
    const credential = await this.prisma.enterpriseProviderCredential.findFirst({ where });
    if (!credential) return null;
    
    const apiKey = decryptApiKey(
      credential.apiKeyEncrypted,
      credential.apiKeyIv,
      credential.apiKeyTag
    );
    
    return {
      id: credential.id,
      apiKey,
      modelName: credential.modelName,
      baseUrl: credential.baseUrl,
    };
  }

  /**
   * 绑定 Agent ↔ Model
   */
  async bindAgentModel(input: AgentModelBindingInput): Promise<{ id: string }> {
    const binding = await this.prisma.enterpriseAgentModelBinding.create({
      data: {
        organizationId: input.organizationId,
        tenantId: input.organizationId,
        agentId: input.agentId,
        credentialId: input.credentialId,
        provider: input.provider,
        modelName: input.modelName,
        reasoningMode: input.reasoningMode || 'analytical',
        isDefault: true,
        status: 'active',
      },
    });

    return { id: binding.id };
  }

  /**
   * 获取 Agent 绑定的 Model
   */
  async getAgentBinding(agentId: string): Promise<{
    id: string; credentialId: string; provider: string; modelName: string; reasoningMode: string;
  } | null> {
    return this.prisma.enterpriseAgentModelBinding.findFirst({
      where: { agentId, status: 'active' },
      orderBy: { isDefault: 'desc' },
    });
  }

  /**
   * 记录 Provider 使用量
   */
  async recordUsage(data: {
    organizationId: string;
    agentId: string;
    credentialId: string;
    provider: string;
    modelName: string;
    callType: string;
    tokenInput: number;
    tokenOutput: number;
    cost: number;
  }): Promise<void> {
    await this.prisma.enterpriseProviderUsage.create({
      data: {
        organizationId: data.organizationId,
        tenantId: data.organizationId,
        agentId: data.agentId,
        credentialId: data.credentialId,
        provider: data.provider,
        modelName: data.modelName,
        callType: data.callType,
        tokenInput: data.tokenInput,
        tokenOutput: data.tokenOutput,
        cost: data.cost,
      },
    });
  }

  /**
   * 删除凭证（软删除 → revoked）
   */
  async revokeCredential(credentialId: string, organizationId: string): Promise<boolean> {
    const result = await this.prisma.enterpriseProviderCredential.updateMany({
      where: { id: credentialId, organizationId },
      data: { status: 'revoked' },
    });
    return result.count > 0;
  }
}
