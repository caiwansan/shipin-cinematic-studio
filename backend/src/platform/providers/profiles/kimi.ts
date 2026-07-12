import { ProviderProfile } from '../provider-profile.types.js'

export const kimiProfile: ProviderProfile = {
  name: 'kimi',
  displayName: 'Kimi (月之暗面)',
  baseUrl: 'https://api.moonshot.cn/v1',
  models: ['moonshot-v1-8k', 'moonshot-v1-32k', 'moonshot-v1-128k'],
  authentication: {
    type: 'bearer',
  },
  endpoints: {
    chat: '/chat/completions',
  },
  responseFormat: 'openai',
  tokenReporting: 'standard',
  notes: 'Moonshot API 完全兼容 OpenAI /chat/completions 格式',
}
