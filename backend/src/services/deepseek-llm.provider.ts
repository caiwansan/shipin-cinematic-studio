/**
 * services/deepseek-llm.provider.ts — LLM Provider（OpenAI 兼容）
 *
 * 统一入口：支持 deepseek / volcengine / openai / aliyun。
 * 不再硬编码 deepseek 的 baseUrl，完全由调用方传入。
 *
 * 暴露 genericLLM.chat() 供 unifiedAIGateway 使用。
 */

interface ChatParams {
  messages: Array<{ role: string; content: string }>
  model?: string
  apiKey?: string
  baseUrl?: string
  provider?: string
}

const BASE_URL_MAP: Record<string, string> = {
  deepseek: 'https://api.deepseek.com',
  volcengine: 'https://ark.cn-beijing.volces.com/api/v3',
  openai: 'https://api.openai.com/v1',
  aliyun: 'https://dashscope.aliyuncs.com/compatible-mode/v1',
}

async function chat(params: ChatParams): Promise<{ text: string }> {
  const { messages, apiKey, model: modelInput } = params
  const provider = params.provider || 'deepseek'
  const model = modelInput || (provider === 'volcengine' ? 'doubao-seed-2-1-pro-260628' : 'deepseek-chat')
  const baseUrl = params.baseUrl || BASE_URL_MAP[provider] || 'https://api.deepseek.com'
  const url = `${baseUrl.replace(/\/+$/, '')}/chat/completions`

  if (!apiKey && !process.env.DEEPSEEK_API_KEY) {
    throw new Error('LLM API Key 未配置')
  }

  const resp = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey || process.env.DEEPSEEK_API_KEY || ''}`,
    },
    body: JSON.stringify({
      model,
      messages,
      max_tokens: 4096,
      temperature: 0.7,
    }),
  })

  if (!resp.ok) {
    const body = await resp.text()
    throw new Error(`LLM API ${resp.status} (${provider}/${model}): ${body.slice(0, 200)}`)
  }

  const data = await resp.json() as any
  const text = data.choices?.[0]?.message?.content || ''
  return { text }
}

export const genericLLM = { chat }
// 向后兼容别名
export const deepseekLLM = genericLLM
