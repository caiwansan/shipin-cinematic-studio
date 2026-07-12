import { ProviderProfile } from '../provider-profile.types.js'

export const openaiProfile: ProviderProfile = {
  name: 'openai',
  displayName: 'OpenAI',
  baseUrl: 'https://api.openai.com/v1',
  models: ['gpt-4o', 'gpt-4o-mini', 'gpt-4-turbo', 'gpt-3.5-turbo'],
  authentication: {
    type: 'bearer',
  },
  endpoints: {
    chat: '/chat/completions',
  },
  responseFormat: 'openai',
  tokenReporting: 'standard',
  notes: '标准 OpenAI 格式，完全兼容 /chat/completions',
}
