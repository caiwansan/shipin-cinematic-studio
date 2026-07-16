/**
 * compatibility.service.ts — Provider 兼容性 Dashboard 数据源
 *
 * 提供各 Provider 兼容性状态查询。
 * 兼容性检查通过发送测试请求验证 JSON 响应是否可被 normalizer 正确处理。
 */

import { ProviderResponseNormalizer } from '../../platform/normalizer/response-normalizer.js'
import { ProviderRegistry, getAllNames } from '../../platform/providers/provider-registry.js'
import { platformProviderPool } from './platform-provider-pool.js'

export interface CompatibilityStatus {
  provider: string
  displayName: string
  enabled: boolean
  configured: boolean  // 平台是否有该 provider 的凭证配置
  model: string
  baseUrl: string
  responseFormat: string
  healthStatus: string
  compatibilityCheck: 'passed' | 'failed' | 'untested' | 'skipped'
  compatibilityError?: string
  lastCheckAt?: string
}

// Extend PlatformProviderStatus locally since model isn't in the interface
async function getCredentialModel(provider: string): Promise<string> {
  const { prisma } = await import('../../utils/index.js')
  const config = await prisma.aIProviderConfig.findUnique({
    where: { provider },
    select: { model: true },
  })
  return config?.model || ''
}

export class PlatformCompatibilityService {
  private normalizer = new ProviderResponseNormalizer()

  /**
   * 获取所有 Provider 的兼容性矩阵
   */
  async getCompatibilityMatrix(): Promise<CompatibilityStatus[]> {
    const providerNames = getAllNames()
    // 获取已配置的 providers
    const configuredProviders = await platformProviderPool.getAllStatuses()
    const configuredMap = new Map(configuredProviders.map(p => [p.provider, p]))

    const results: CompatibilityStatus[] = []

    for (const name of providerNames) {
      const profile = ProviderRegistry.get(name)
      if (!profile) continue

      const configured = configuredMap.get(name)
      // Get model from credential config or profile default
      const model = configured ? await getCredentialModel(name) || profile.models[0] || '' : profile.models[0] || ''
      results.push({
        provider: name,
        displayName: profile.displayName,
        enabled: configured?.isEnabled ?? false,
        configured: !!configured,
        model,
        baseUrl: profile.baseUrl,
        responseFormat: profile.responseFormat,
        healthStatus: configured?.healthStatus ?? 'unknown',
        compatibilityCheck: 'untested',
        lastCheckAt: configured?.lastHealthCheckAt ?? undefined,
      })
    }

    return results
  }

  /**
   * 测试单个 Provider 的兼容性
   * 发送测试请求并验证 normalizer 能否正确处理
   */
  async testCompatibility(provider: string): Promise<CompatibilityStatus> {
    const profile = ProviderRegistry.get(provider)
    if (!profile) {
      return {
        provider,
        displayName: provider,
        enabled: false,
        configured: false,
        model: '',
        baseUrl: '',
        responseFormat: 'unknown',
        healthStatus: 'unknown',
        compatibilityCheck: 'skipped',
        compatibilityError: 'Provider 未在注册表中找到',
      }
    }

    const credential = await platformProviderPool.getCredential(provider)
    if (!credential) {
      return {
        provider: provider,
        displayName: profile.displayName,
        enabled: false,
        configured: false,
        model: profile.models[0] || '',
        baseUrl: profile.baseUrl,
        responseFormat: profile.responseFormat,
        healthStatus: 'unknown',
        compatibilityCheck: 'skipped',
        compatibilityError: '未配置 API 凭证',
      }
    }

    try {
      // 发送最小测试请求
      const body = {
        model: credential.model || profile.models[0],
        messages: [{ role: 'user', content: 'Reply with one word: ok' }],
        max_tokens: 10,
        temperature: 0.1,
        stream: false,
      }

      const endpoint = `${(credential.baseUrl || profile.baseUrl).replace(/\/$/, '')}${profile.endpoints.chat}`
      const headers: Record<string, string> = { 'Content-Type': 'application/json' }

      if (profile.authentication.type === 'bearer') {
        headers['Authorization'] = `Bearer ${credential.apiKey}`
      } else if (profile.authentication.type === 'header' && profile.authentication.headerName) {
        headers[profile.authentication.headerName] = credential.apiKey
      }

      // 添加 extra headers
      if (profile.authentication.extraHeaders) {
        Object.assign(headers, profile.authentication.extraHeaders)
      }

      // Gemini 特殊处理：API key 在 URL 参数中
      let requestUrl = endpoint
      if (profile.name === 'gemini') {
        // Gemini 端点包含 {model} 占位符
        requestUrl = endpoint.replace('{model}', credential.model || profile.models[0])
        // 将 body 转为 gemini 格式
        delete (body as any).model
        const geminiBody = {
          contents: [{ role: 'user', parts: [{ text: 'Reply with one word: ok' }] }],
        }
        const resp = await fetch(`${requestUrl}?key=${credential.apiKey}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(geminiBody),
        })
        const data = await resp.json()
        const normalized = this.normalizer.normalize(provider, data)
        const status = normalized.content?.toLowerCase().includes('ok') ? 'passed' : 'failed'

        return {
          provider,
          displayName: profile.displayName,
          enabled: true,
          configured: true,
          model: credential.model || profile.models[0],
          baseUrl: credential.baseUrl || profile.baseUrl,
          responseFormat: profile.responseFormat,
          healthStatus: 'healthy',
          compatibilityCheck: status,
          compatibilityError: status === 'failed' ? `响应内容异常: ${normalized.content?.substring(0, 100)}` : undefined,
          lastCheckAt: new Date().toISOString(),
        }
      }

      // Standard /chat/completions 请求
      const resp = await fetch(requestUrl, {
        method: 'POST',
        headers,
        body: JSON.stringify(body),
      })

      if (!resp.ok) {
        const errText = await resp.text().catch(() => '')
        const err = this.normalizer.normalizeError(provider, resp.status, errText)
        return {
          provider,
          displayName: profile.displayName,
          enabled: true,
          configured: true,
          model: credential.model || profile.models[0],
          baseUrl: credential.baseUrl || profile.baseUrl,
          responseFormat: profile.responseFormat,
          healthStatus: resp.status >= 500 ? 'down' : 'degraded',
          compatibilityCheck: 'failed',
          compatibilityError: `${err.code}: ${err.message}`,
          lastCheckAt: new Date().toISOString(),
        }
      }

      const data = await resp.json()
      const normalized = this.normalizer.normalize(provider, data)
      const status = normalized.content?.toLowerCase().includes('ok') ? 'passed' : 'failed'

      return {
        provider,
        displayName: profile.displayName,
        enabled: true,
        configured: true,
        model: credential.model || profile.models[0],
        baseUrl: credential.baseUrl || profile.baseUrl,
        responseFormat: profile.responseFormat,
        healthStatus: 'healthy',
        compatibilityCheck: status,
        compatibilityError: status === 'failed' ? `响应内容异常: ${normalized.content?.substring(0, 100)}` : undefined,
        lastCheckAt: new Date().toISOString(),
      }
    } catch (err: any) {
      return {
        provider,
        displayName: profile.displayName,
        enabled: true,
        configured: true,
        model: credential.model || profile.models[0],
        baseUrl: credential.baseUrl || profile.baseUrl,
        responseFormat: profile.responseFormat,
        healthStatus: 'down',
        compatibilityCheck: 'failed',
        compatibilityError: `请求异常: ${err.message}`,
        lastCheckAt: new Date().toISOString(),
      }
    }
  }

  /**
   * 运行全部已配置 Provider 的兼容性检查
   */
  async runAllCompatibilityChecks(): Promise<CompatibilityStatus[]> {
    const matrix = await this.getCompatibilityMatrix()
    const results: CompatibilityStatus[] = []

    for (const item of matrix) {
      if (!item.configured) {
        results.push(item)
        continue
      }
      const result = await this.testCompatibility(item.provider)
      results.push(result)
    }

    return results
  }
}

export const platformCompatibilityService = new PlatformCompatibilityService()
