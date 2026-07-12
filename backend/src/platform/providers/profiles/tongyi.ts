import { ProviderProfile } from '../provider-profile.types.js'

export const tongyiProfile: ProviderProfile = {
  name: 'tongyi',
  displayName: '通义千问',
  baseUrl: 'https://dashscope.aliyuncs.com/compatible-mode/v1',
  models: ['qwen-plus', 'qwen-max', 'qwen-turbo'],
  authentication: {
    type: 'bearer',
    headerName: 'Authorization',
  },
  endpoints: {
    chat: '/chat/completions',
  },
  responseFormat: 'openai',
  tokenReporting: 'standard',
  notes: 'DashScope 兼容模式使用 OpenAI-compatible /chat/completions 端点',
}
