import { ProviderProfile } from '../provider-profile.types.js'

export const yuanbaoProfile: ProviderProfile = {
  name: 'yuanbao',
  displayName: '腾讯元宝',
  baseUrl: 'https://tokenhub.tencentmaas.com/v1',
  models: ['hy3-preview', 'hy3-turbo'],
  authentication: {
    type: 'bearer',
  },
  endpoints: {
    chat: '/chat/completions',
  },
  responseFormat: 'openai',
  tokenReporting: 'missing',
  notes: '腾讯混元 API，通过 tokenhub 网关接入',
}
