import { ProviderProfile } from '../provider-profile.types.js'

export const xinghuoProfile: ProviderProfile = {
  name: 'xinghuo',
  displayName: '讯飞星火',
  baseUrl: 'https://spark-api.xf-yun.com/v3.5/chat',
  models: ['spark-4.0', 'spark-3.5', 'spark-lite'],
  authentication: {
    type: 'custom',
    extraHeaders: {},
  },
  endpoints: {
    chat: '',
  },
  responseFormat: 'custom',
  tokenReporting: 'missing',
  notes: '讯飞星火使用 WebSocket 协议（非标准 HTTP），通过 xinghuo-ws.provider.ts 适配。通过 SiliconFlow 兼容代理时可用标准格式。',
}
