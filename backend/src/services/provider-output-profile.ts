/**
 * ProviderOutputProfile — 每个 Provider 的输出特征画像
 *
 * 用于 StructuredOutputService 根据 Provider 特点进行针对性修复。
 * 不针对任何 Provider 写特判逻辑，只提供配置化数据。
 */

export interface ProviderOutputProfile {
  preferredLanguage: 'zh-CN' | 'en-US'
  jsonCompliance: 'high' | 'medium' | 'low'
  markdownTendency: 'always' | 'often' | 'rarely'
  /** 该 provider 特有的修复规则列表 */
  knownRepairRules: string[]
}

const providerProfiles: Record<string, ProviderOutputProfile> = {
  deepseek: {
    preferredLanguage: 'zh-CN',
    jsonCompliance: 'high',
    markdownTendency: 'rarely',
    knownRepairRules: [],
  },
  doubao: {
    preferredLanguage: 'zh-CN',
    jsonCompliance: 'medium',
    markdownTendency: 'often',
    knownRepairRules: ['remove_trailing_period'],
  },
  kimi: {
    preferredLanguage: 'zh-CN',
    jsonCompliance: 'medium',
    markdownTendency: 'often',
    knownRepairRules: [],
  },
  tongyi: {
    preferredLanguage: 'zh-CN',
    jsonCompliance: 'low',
    markdownTendency: 'often',
    knownRepairRules: ['fix_single_quotes'],
  },
  xinghuo: {
    preferredLanguage: 'zh-CN',
    jsonCompliance: 'medium',
    markdownTendency: 'rarely',
    knownRepairRules: [],
  },
  wenxin: {
    preferredLanguage: 'zh-CN',
    jsonCompliance: 'low',
    markdownTendency: 'often',
    knownRepairRules: ['fix_single_quotes', 'remove_chinese_punctuation'],
  },
  yuanbao: {
    preferredLanguage: 'zh-CN',
    jsonCompliance: 'low',
    markdownTendency: 'often',
    knownRepairRules: ['fix_single_quotes'],
  },
  'openai/chatgpt': {
    preferredLanguage: 'en-US',
    jsonCompliance: 'high',
    markdownTendency: 'rarely',
    knownRepairRules: [],
  },
  chatgpt: {
    preferredLanguage: 'en-US',
    jsonCompliance: 'high',
    markdownTendency: 'rarely',
    knownRepairRules: [],
  },
  openai: {
    preferredLanguage: 'en-US',
    jsonCompliance: 'high',
    markdownTendency: 'rarely',
    knownRepairRules: [],
  },
  claude: {
    preferredLanguage: 'en-US',
    jsonCompliance: 'high',
    markdownTendency: 'rarely',
    knownRepairRules: [],
  },
  gemini: {
    preferredLanguage: 'en-US',
    jsonCompliance: 'high',
    markdownTendency: 'rarely',
    knownRepairRules: [],
  },
  perplexity: {
    preferredLanguage: 'en-US',
    jsonCompliance: 'medium',
    markdownTendency: 'often',
    knownRepairRules: [],
  },
  copilot: {
    preferredLanguage: 'en-US',
    jsonCompliance: 'medium',
    markdownTendency: 'often',
    knownRepairRules: [],
  },
}

/**
 * 获取 Provider 的输出特征画像
 * @param provider Provider 名称（大小写不敏感）
 * @returns ProviderOutputProfile，如未找到返回默认画像
 */
export function getProviderProfile(provider: string): ProviderOutputProfile {
  if (!provider) return getDefaultProfile()

  const key = provider.toLowerCase().trim()
  return providerProfiles[key] || getDefaultProfile()
}

/**
 * 获取默认画像（适用于未知 Provider）
 */
function getDefaultProfile(): ProviderOutputProfile {
  return {
    preferredLanguage: 'en-US',
    jsonCompliance: 'medium',
    markdownTendency: 'often',
    knownRepairRules: [],
  }
}

/**
 * 注册/覆盖 Provider 画像
 */
export function registerProviderProfile(provider: string, profile: ProviderOutputProfile): void {
  providerProfiles[provider.toLowerCase().trim()] = profile
}
