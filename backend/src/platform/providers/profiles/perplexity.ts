import { ProviderProfile } from '../provider-profile.types.js'

export const perplexityProfile: ProviderProfile = {
  name: 'perplexity',
  displayName: 'Perplexity',
  baseUrl: 'https://api.perplexity.ai',
  models: ['sonar-pro', 'sonar', 'llama-3.1-sonar-small-128k-online'],
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
