/**
 * B2-1 Unified AI Gateway — 统一 AI 执行入口
 *
 * 所有 AI 调用必须走此入口，不可直接调 provider。
 *
 * invokeAI(envelope) 流程：
 *   1. 验证信封
 *   2. 解析用户模型配置
 *   3. 解析/解密 API Key
 *   4. 选择 provider adapter
 *   5. 执行 + 超时 + 重试
 *   6. 绑定 AssetVersion（如涉及）
 *   7. 写 InvocationLog
 *   8. 返回结果
 */

import { AIInvocationEnvelope, createEnvelope, completeEnvelope, failEnvelope } from './ai-invocation-envelope.js'
import { invocationLogService } from './invocation-log.service.js'
import { userModelResolver } from './user-model-resolver.js'
import { gatewayGuard } from './gateway-guard.js'
import { assetVersionService } from './asset-version.service.js'
import { prisma } from '../utils/index.js'

// ─── Provider Adapter 接口 ───

export interface AIProviderAdapter {
  name: string
  invoke(input: any, config: { apiKey: string; model: string; baseUrl?: string }): Promise<any>
}

// ─── LLM Provider Adapter（包装现有 aliyun-llm） ───

const aliyunLLMAdapter: AIProviderAdapter = {
  name: 'aliyun-llm',
  async invoke(input, config) {
    const { aliyunLLM } = await import('./aliyun-llm.provider.js')
    const messages = input.messages || (Array.isArray(input) ? input : [{ role: 'user', content: typeof input === 'string' ? input : JSON.stringify(input) }])
    return aliyunLLM.chat({
      messages,
      model: config.model,
    })
  },
}

const builtInAdapters: Record<string, AIProviderAdapter> = {
  aliyun: aliyunLLMAdapter,
  volcengine: {
    name: 'volcengine',
    async invoke(input, config) {
      const { volcengineLLM } = await import('./volcengine-llm.provider.js')
      const messages = input.messages || (Array.isArray(input) ? input : [{ role: 'user', content: typeof input === 'string' ? input : JSON.stringify(input) }])
      return volcengineLLM.chat({
        messages,
        model: config.model || 'doubao-seed-2-0-plus-260428',
      })
    },
  },
  deepseek: {
    name: 'deepseek',
    async invoke(input, config) {
      const { genericLLM } = await import('./deepseek-llm.provider.js')
      const messages = input.messages || (Array.isArray(input) ? input : [{ role: 'user', content: typeof input === 'string' ? input : JSON.stringify(input) }])
      return genericLLM.chat({
        messages,
        model: config.model || 'deepseek-v4-flash',
        apiKey: config.apiKey,
        baseUrl: config.baseUrl,
        provider: 'deepseek',
      })
    },
  },
  openai: {
    name: 'openai',
    async invoke(input, config) {
      const baseUrl = config.baseUrl || 'https://api.openai.com/v1'
      const resp = await fetch(`${baseUrl}/chat/completions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${config.apiKey}` },
        body: JSON.stringify({ model: config.model || 'gpt-4o', messages: input.messages || input, max_tokens: 4096 }),
      })
      return resp.json()
    },
  },
}

// ─── Unified Gateway ───

export class UnifiedAIGateway {
  private adapters: Record<string, AIProviderAdapter> = { ...builtInAdapters }

  registerAdapter(name: string, adapter: AIProviderAdapter) {
    this.adapters[name] = adapter
  }

  /**
   * 执行 AI 调用（完整流程）
   */
  async invokeAI(params: {
    userId: string
    projectId: string
    agentType: AIInvocationEnvelope['agentType']
    capability: string  // 'llm' | 'text_to_image' | 'image_to_video' | 'text_to_video'
    input: any
    assetRegistryId?: string
    assetVersionId?: string
    parentTraceId?: string
  }): Promise<AIInvocationEnvelope> {
    const { userId, projectId, agentType, capability, input, assetRegistryId, assetVersionId, parentTraceId } = params

    // 1. 速率控制
    const allowed = await gatewayGuard.checkRateLimit(userId)
    if (!allowed) {
      const env = createEnvelope({ userId, projectId, agentType, provider: 'system', modelName: 'rate-limit', input })
      return failEnvelope(env, '请求过于频繁，请稍后重试')
    }

    // 2. 并发控制
    const concurrencyOk = await gatewayGuard.checkConcurrency(projectId)
    if (!concurrencyOk) {
      const env = createEnvelope({ userId, projectId, agentType, provider: 'system', modelName: 'concurrency-limit', input })
      return failEnvelope(env, '项目并发请求数已满')
    }

    try {
      // 3. 解析用户模型配置
      const resolved = await userModelResolver.resolve(capability, userId)
      if (!resolved) {
        const env = createEnvelope({
          userId,
          projectId,
          agentType,
          provider: 'system',
          modelName: 'no-config',
          input,
          assetRegistryId,
          assetVersionId,
          parentTraceId,
        })
        return failEnvelope(env, `用户 ${userId} 未配置 ${capability} 模型，请在「大模型设置」中配置`)
      }
      const providerName = resolved.provider
      const modelName = resolved.modelName

      // 4. 创建信封
      const envelope = createEnvelope({
        userId,
        projectId,
        agentType,
        provider: providerName,
        modelName,
        input,
        assetRegistryId,
        assetVersionId,
        parentTraceId,
      })

      // 5. 选择 adapter
      const adapter = this.adapters[providerName]
      if (!adapter) {
        return failEnvelope(envelope, `不支持的服务商: ${providerName}`)
      }

      // 6. 执行（带超时 + 重试）
      let lastError: string = ''
      for (let attempt = 0; attempt <= gatewayGuard.getConfig().maxRetries; attempt++) {
        try {
          const output = await gatewayGuard.withTimeout(
            adapter.invoke(input, { apiKey: resolved.apiKey, model: modelName, baseUrl: resolved.baseUrl }),
          )
          const completed = completeEnvelope(envelope, output)

          // 7. 绑定 AssetVersion（如涉及资产）
          if (assetRegistryId) {
            await this.bindVersion(assetRegistryId, completed)
          }

          // 8. 写日志
          await invocationLogService.writeLog(completed)
          return completed
        } catch (err: any) {
          lastError = err.message
          if (attempt < gatewayGuard.getConfig().maxRetries) {
            await new Promise(r => setTimeout(r, 1000 * (attempt + 1)))
          }
        }
      }

      const failed = failEnvelope(
        createEnvelope({ userId, projectId, agentType, provider: providerName, modelName, input, assetRegistryId, assetVersionId, parentTraceId }),
        `重试 ${gatewayGuard.getConfig().maxRetries} 次后失败: ${lastError}`,
      )
      await invocationLogService.writeLog(failed)
      return failed
    } finally {
      // 释放并发槽位
      gatewayGuard.releaseConcurrency(projectId)
    }
  }

  /**
   * 绑定 AssetVersion：每次 AI 调用结果生成版本
   */
  private async bindVersion(assetRegistryId: string, envelope: AIInvocationEnvelope): Promise<void> {
    try {
      // 只在有 AI 产出时才创建版本
      if (!envelope.output) return

      await assetVersionService.createVersion({
        assetRegistryId,
        content: { aiOutput: envelope.output },
        prompt: { input: envelope.input },
        optimizationType: envelope.agentType,
        agent: `ai:${envelope.agentType}`,
        diffSummary: `AI ${envelope.agentType} 调用 (trace:${envelope.traceId.slice(0, 16)})`,
      })
    } catch {
      // 版本绑定失败不阻断主流程
    }
  }

  /**
   * 获取调用链（按 traceId）
   */
  async getTraceChain(traceId: string) {
    return invocationLogService.getLogs({ traceId })
  }
}

export const unifiedAIGateway = new UnifiedAIGateway()
