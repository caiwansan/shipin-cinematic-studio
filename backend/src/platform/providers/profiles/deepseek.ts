import { ProviderProfile } from '../provider-profile.types.js'

export const deepseekProfile: ProviderProfile = {
  name: 'deepseek',
  displayName: 'DeepSeek',
  baseUrl: 'https://api.deepseek.com/v1',
  models: ['deepseek-chat', 'deepseek-reasoner'],
  authentication: {
    type: 'bearer',
  },
  endpoints: {
    chat: '/chat/completions',
  },
  responseFormat: 'openai',
  tokenReporting: 'standard',
  notes: 'OpenAI 兼容格式，支持 /chat/completions',
}
