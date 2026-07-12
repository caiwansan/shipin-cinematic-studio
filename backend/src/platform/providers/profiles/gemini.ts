import { ProviderProfile } from '../provider-profile.types.js'
import { StandardLLMResponse } from '../../normalizer/types.js'

export const geminiProfile: ProviderProfile = {
  name: 'gemini',
  displayName: 'Gemini (Google)',
  baseUrl: 'https://generativelanguage.googleapis.com',
  models: ['gemini-2.5-pro-0325', 'gemini-2.0-flash', 'gemini-1.5-pro', 'gemini-1.5-flash'],
  authentication: {
    type: 'custom',
    // Gemini 使用 API Key 作为 URL query parameter: ?key=xxx
  },
  endpoints: {
    chat: '/v1beta/models/{model}:generateContent',
    stream: '/v1beta/models/{model}:streamGenerateContent',
  },
  responseFormat: 'gemini',
  tokenReporting: 'separate',
  responseMapper: (raw: any): StandardLLMResponse => {
    const text = raw?.candidates?.[0]?.content?.parts?.[0]?.text || ''
    return {
      content: text,
      finishReason: raw?.candidates?.[0]?.finishReason === 'STOP' ? 'stop' : 'unknown',
    }
  },
  notes: 'API Key 以 query parameter 方式传递，endpoint 中包含 {model} 占位符',
}
