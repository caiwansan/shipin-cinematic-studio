import { ProviderProfile } from '../provider-profile.types.js'
import { StandardLLMResponse } from '../../normalizer/types.js'

export const claudeProfile: ProviderProfile = {
  name: 'claude',
  displayName: 'Claude (Anthropic)',
  baseUrl: 'https://api.anthropic.com',
  models: ['claude-sonnet-4-20250514', 'claude-3-opus-20240229', 'claude-3-sonnet-20240229', 'claude-3-haiku-20240307'],
  authentication: {
    type: 'header',
    headerName: 'x-api-key',
    extraHeaders: {
      'anthropic-version': '2023-06-01',
    },
  },
  endpoints: {
    chat: '/v1/messages',
  },
  responseFormat: 'anthropic',
  tokenReporting: 'standard',
  responseMapper: (raw: any): StandardLLMResponse => {
    const content = raw?.content?.[0]?.text || ''
    const inputTokens = raw?.usage?.input_tokens
    const outputTokens = raw?.usage?.output_tokens
    return {
      content,
      finishReason: raw?.stop_reason === 'end_turn' ? 'stop' : 'unknown',
      tokens: inputTokens !== undefined || outputTokens !== undefined
        ? {
            input: inputTokens ?? 0,
            output: outputTokens ?? 0,
            total: (inputTokens ?? 0) + (outputTokens ?? 0),
            inputDetail: 'provider_reported',
            outputDetail: 'provider_reported',
          }
        : undefined,
    }
  },
}
