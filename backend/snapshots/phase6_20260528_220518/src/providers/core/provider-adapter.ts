/**
 * P1 — ProviderConfig 和 ProviderAdapter Interface
 *
 * ═══ 宪法：Provider Config 必须成为显式 Runtime Data ═══
 * 禁止动态 process.env 注入 AI Provider 状态。
 * providerConfig 通过参数全链路显式传递。
 *
 * 唯一合法的静态 env：
 *   - DB_URL, COS_SECRET, REDIS_HOST (infra)
 *   - ENCRYPTION_KEY (解密用户 Key 需要)
 *
 * 禁止动态 env：
 *   - *_API_KEY
 *   - *_BASE_URL
 *   - *_MODEL
 */

/**
 * ProviderConfig — 运行时显式传递的 Provider 配置
 *
 * 所有 Provider 调用必须通过此数据结构传递，
 * 禁止通过 process.env 隐式传递。
 */
export interface ProviderConfig {
  provider: string       // 'deepseek' | 'siliconflow' | 'aliyun' | 'volcengine' | 'custom'
  modelName: string
  apiKey: string
  baseUrl?: string
}

/**
 * ProviderAdapter — 统一 Provider 执行接口
 *
 * 所有 Provider 必须实现此接口。
 * adapter.execute() 是 Runtime 唯一允许的 AI 调用入口。
 */
export interface ProviderAdapter {
  /**
   * 执行 LLM 调用（非流式）
   */
  execute(params: {
    providerConfig: ProviderConfig
    payload: {
      systemPrompt: string
      userMessage: string
      maxTokens?: number
      temperature?: number
    }
  }): Promise<{
    content: string
    totalTokens: number
    model: string
  }>

  /**
   * 执行 LLM 流式调用（可选）
   */
  stream?(params: {
    providerConfig: ProviderConfig
    payload: {
      systemPrompt: string
      userMessage: string
      maxTokens?: number
      temperature?: number
    }
  }): AsyncIterable<{
    content: string
    done?: boolean
    totalTokens?: number
  }>
}
