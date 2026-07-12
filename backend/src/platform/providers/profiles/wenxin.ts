import { ProviderProfile } from '../provider-profile.types.js'

export const wenxinProfile: ProviderProfile = {
  name: 'wenxin',
  displayName: '文心一言',
  baseUrl: 'https://aip.baidubce.com/rpc/2.0/ai_custom',
  models: ['ernie-4.0', 'ernie-3.5', 'ernie-lite'],
  authentication: {
    type: 'bearer',
  },
  endpoints: {
    chat: '/v1/wenxinworkshop/chat',
  },
  responseFormat: 'openai',
  tokenReporting: 'missing',
  notes: '百度文心需要通过 OAuth 获取 access_token，当前经 SiliconFlow 兼容代理接入',
}
