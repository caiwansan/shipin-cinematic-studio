/**
 * runtime/runtime-credential.ts — RuntimeCredential Pipeline
 *
 * 统一运行时凭据接口。
 *
 * 设计原则：
 *   1. Provider 只消费 RuntimeCredential，不关心来源
 *   2. RuntimeCredential 由 CredentialService 装配
 *   3. 所有 Provider（LLM/Image/Video/TTS/Music）统一走同一套
 *   4. 零读取 process.env，零读取数据库
 *
 * ── Credential Flow ──
 *   UserModelConfigV2 (AES encrypted)
 *     ↓ CredentialService.resolve()
 *   RuntimeCredential (plaintext, scoped)
 *     ↓ WorkerRuntime
 *     ↓ ModelAdapter.execute(runtime, input)
 *     ↓ Provider call with credential.apiKey
 *
 * ── 新增 Provider 流程 ──
 *   1. 在 ModelAdapter 中实现 execute(runtime, input)
 *   2. 从 runtime.apiKey / runtime.baseURL 获取凭据
 *   3. 调用 API
 *   4. register() 到 ModelAdapterRegistry
 *   无需修改 CredentialService 或 WorkerRuntime
 */

/**
 * 运行时凭据 — Provider 唯一依赖
 *
 * 所有模型提供商（LLM/Image/Video/TTS/Music）共用此结构。
 * Provider 不应访问 process.env、数据库或用户会话。
 */
export interface RuntimeCredential {
  /** 提供商标识，如 volcengine / deepseek / aliyun */
  provider: string

  /** 解密后的 API Key */
  apiKey: string

  /** 模型名称 */
  model: string

  /** API 端点 */
  baseURL: string

  /** 可选：区域 */
  region?: string

  /** 可选：组织 ID (OpenAI 用) */
  organization?: string

  /** 可选：扩展字段 */
  extra?: Record<string, string>
}

/**
 * CredentialService — 凭据装配服务
 *
 * 职责：
 *   1. 从 UserModelConfigV2 读取加密凭据
 *   2. 解密
 *   3. 按 taskType 装配 RuntimeCredential
 *   4. 抛出明确的错误（不静默降级）
 *
 * 不做什么：
 *   ❌ 不缓存凭据（每次请求重新解密）
 *   ❌ 不 fallback 到 process.env
 *   ❌ 不修改数据库
 */
export class CredentialService {
  /**
   * 为指定用户和 taskType 解析凭据
   *
   * @param userId 用户 ID
   * @param taskType llm | image | video | tts | music
   * @param model 可选，模型名覆盖
   * @returns RuntimeCredential
   * @throws Error 如果用户未配置相应凭据
   */
  async resolve(
    userId: string,
    taskType: 'llm' | 'image' | 'video' | 'tts' | 'music',
    model?: string
  ): Promise<RuntimeCredential> {
    const { prisma } = await import('../utils/index.js')
    const { decryptKey } = await import('../services/crypto.service.js')

    const v2 = await prisma.userModelConfigV2.findUnique({
      where: { userId },
    })

    if (!v2) {
      throw new Error(
        `用户未配置大模型 API Key。请前往「设置 → 大模型配置」添加至少一个 Provider。`
      )
    }

    // 按 taskType 选择配置字段
    const configMap: Record<string, {
      provider: string | null;
      apiKey: string | null;
      model: string | null;
      baseUrl: string | null;
    }> = {
      llm:   { provider: v2.llmProvider,   apiKey: v2.llmApiKey,   model: v2.llmModel,   baseUrl: v2.llmBaseUrl },
      image: { provider: v2.imageProvider, apiKey: v2.imageApiKey, model: v2.imageModel, baseUrl: v2.imageBaseUrl },
      video: { provider: v2.videoProvider, apiKey: v2.videoApiKey, model: v2.videoModel, baseUrl: v2.videoBaseUrl },
      tts:   { provider: v2.ttsProvider,   apiKey: v2.ttsApiKey,   model: v2.ttsModel,   baseUrl: v2.ttsBaseUrl },
      music: { provider: v2.musicProvider, apiKey: v2.musicApiKey, model: v2.musicModel, baseUrl: v2.musicBaseUrl },
    }

    const cfg = configMap[taskType]
    if (!cfg) {
      throw new Error(`未知的任务类型: ${taskType}`)
    }

    if (!cfg.provider || !cfg.apiKey) {
      throw new Error(
        `你还没有配置 ${this.taskTypeLabel(taskType)} 的 API Key。` +
        `请前往「设置 → 大模型配置」添加 ${this.providerLabel(cfg.provider || '')} 的 Key。`
      )
    }

    // 解密
    let decryptedKey: string
    try {
      decryptedKey = decryptKey(cfg.apiKey)
    } catch (e) {
      throw new Error(
        `API Key 解密失败，请重新保存 ${cfg.provider} 的 Key（加密密钥可能已变更）`
      )
    }

    if (!decryptedKey) {
      throw new Error(`无法解密 ${cfg.provider} 的 API Key`)
    }

    // 模型名：优先使用传入的 model，否则用用户配置的默认模型
    const resolvedModel = model || cfg.model || ''
    if (!resolvedModel) {
      throw new Error(`请配置 ${this.taskTypeLabel(taskType)} 的模型名称`)
    }

    // 基础 URL
    const baseURL = cfg.baseUrl || this.defaultBaseURL(cfg.provider)

    return {
      provider: cfg.provider,
      apiKey: decryptedKey,
      model: resolvedModel,
      baseURL,
    }
  }

  private taskTypeLabel(taskType: string): string {
    const labels: Record<string, string> = {
      llm: '大语言模型',
      image: '图片生成',
      video: '视频生成',
      tts: '语音合成',
      music: '音乐生成',
    }
    return labels[taskType] || taskType
  }

  private providerLabel(provider: string): string {
    const labels: Record<string, string> = {
      volcengine: '火山引擎',
      aliyun: '阿里云通义',
      deepseek: 'DeepSeek',
      openai: 'OpenAI',
      siliconflow: '硅基流动',
      moonshot: '月之暗面',
      zhipu: '智谱AI',
      baidu: '百度文心',
    }
    return labels[provider] || provider
  }

  private defaultBaseURL(provider: string | null): string {
    const urls: Record<string, string> = {
      volcengine: 'https://ark.cn-beijing.volces.com/api/v3',
      aliyun: 'https://dashscope.aliyuncs.com/compatible-mode/v1',
      deepseek: 'https://api.deepseek.com/v1',
      openai: 'https://api.openai.com/v1',
      siliconflow: 'https://api.siliconflow.cn/v1',
      moonshot: 'https://api.moonshot.cn/v1',
    }
    return urls[provider || ''] || ''
  }
}

/** 全局单例 */
export const credentialService = new CredentialService()
