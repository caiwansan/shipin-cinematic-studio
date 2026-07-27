/**
 * agent-runtime/gateway/credential-resolver.interface.ts
 * Phase 3.1.3-A — Provider Credential Resolver Contract
 * 
 * 全系统唯一的 Provider 凭证解析入口
 * 
 * 调用方：
 *   - Agent Brain（推理时获取 Provider）
 *   - Workflow Engine（执行步骤时获取 Provider）
 *   - runtime-providers.ts（健康检查）
 *   - provider-management.ts（创建后验证）
 * 
 * 禁止：
 *   - 直接读取 ai_provider_config（旧表）
 *   - 直接读取 enterprise_provider_credential（必须经此接口）
 *   - 在 Gateway 以外解密 API Key
 */

export interface ProviderCredential {
  provider: string;
  model: string;
  apiKey: string;        // 解密后的明文（仅 Gateway 执行时使用）
  baseUrl: string;
  reasoningMode: string;
}

export interface ProviderCredentialResolver {
  /**
   * 解析 Agent 的 Provider 凭证
   * @param organizationId 组织 ID
   * @param agentId Agent ID（可选，不传则返回组织默认）
   */
  resolve(organizationId: string, agentId?: string): Promise<ProviderCredential>;

  /**
   * 获取组织默认 Provider（不设 Agent 绑定时使用）
   */
  resolveDefault(organizationId: string): Promise<ProviderCredential>;

  /**
   * 验证 Provider 可用性（ping 测试）
   */
  healthCheck(organizationId: string, provider: string): Promise<{
    status: 'healthy' | 'invalid_key' | 'missing_key' | 'error';
    message: string;
    latencyMs?: number;
  }>;
}
