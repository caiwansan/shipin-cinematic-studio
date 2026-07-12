// ============================================================
// GEO Credential Provider — GEO Runtime 凭据统一入口
// SEC-002B-P1: GEO Runtime 接入 Credential Runtime
// SEC-004-T001: 接入 CredentialAuditService
//
// Engine 不直接调用 CredentialService，通过此封装层隔离。
// 未来扩展点（组织配置/缓存/Provider Override）只需修改此文件。
// ============================================================

import type { ProviderCredential } from './adapter.interface.js'
import { credentialService } from '../../../runtime/runtime-credential.js'
import { credentialAuditService, CredentialAuditEvent } from '../audit/credential-audit.js'

/**
 * GEO 凭据提供者
 *
 * 职责：
 *   1. 从 CredentialService 获取解密后的用户凭据
 *   2. 映射到 ProviderCredential（Adapter 协议）
 *   3. 记录审计事件（通过 CredentialAuditService）
 *   4. 抛出明确错误（不静默降级）
 *
 * 不做什么：
 *   ❌ 不缓存凭据
 *   ❌ 不 fallback 到 process.env
 *   ❌ 不修改数据库
 */
export class GeoCredentialProvider {
  /**
   * 解析 GEO 功能所需的 LLM 凭据
   *
   * GEO 统一复用 UserModelConfigV2.llm* 配置，
   * 不需要独立的 GEO 配置类型。
   *
   * @param userId 用户 ID
   * @param provider 目标 Provider（仅用于错误提示）
   * @returns ProviderCredential
   * @throws Error 如果用户未配置 LLM API Key
   */
  async resolve(userId: string, provider: string): Promise<ProviderCredential> {
    const startTime = Date.now()
    const userIdMasked = (userId || '').substring(0, 8) + '...'

    try {
      const runtime = await credentialService.resolve(userId, 'llm')

      // D7 Schema：统一事件
      const durationMs = Date.now() - startTime
      credentialAuditService.record({
        event: CredentialAuditEvent.CredentialResolved,
        timestamp: new Date().toISOString(),
        provider,
        capability: 'llm',
        source: 'UserModelConfigV2',
        userIdMasked,
        success: true,
        durationMs,
      })

      return {
        apiKey: runtime.apiKey,
        model: runtime.model,
        baseURL: runtime.baseURL,
      }
    } catch (err: any) {
      const durationMs = Date.now() - startTime
      const errorMessage = err.message || 'unknown error'

      // 错误分类
      let event = CredentialAuditEvent.CredentialResolveFailed
      if (errorMessage.includes('not found') || errorMessage.includes('no config') || errorMessage.includes('未配置')) {
        event = CredentialAuditEvent.CredentialMissing
      } else if (errorMessage.includes('decrypt') || errorMessage.includes('解密')) {
        event = CredentialAuditEvent.CredentialDecryptFailed
      } else if (errorMessage.includes('empty') || errorMessage.includes('invalid')) {
        event = CredentialAuditEvent.CredentialInvalid
      }

      credentialAuditService.record({
        event,
        timestamp: new Date().toISOString(),
        provider,
        capability: 'llm',
        source: 'UserModelConfigV2',
        userIdMasked,
        success: false,
        failureReason: errorMessage.substring(0, 200),
        durationMs,
      })

      throw new Error(
        `GEO 功能需要 LLM API Key。请前往「设置 → 大模型配置」添加 API Key。` +
        `（${provider}: ${errorMessage}）`
      )
    }
  }
}

/** 全局单例 */
export const geoCredentialProvider = new GeoCredentialProvider()
