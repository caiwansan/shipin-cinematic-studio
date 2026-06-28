/**
 * style-injector.ts — 后端风格注入工具
 *
 * 在 narrative-llm.ts、execution-images.ts、prompt-compiler.ts 等路由中，
 * 用此工具替代硬编码的 styleSuffixMap / STYLE_KEYWORDS。
 *
 * 所有风格配置从 style_profiles 表读取，禁止硬编码。
 */

import { StyleProfileService } from '../services/style-profile.service.js'

export interface StyleInjectOptions {
  styleName?: string | null
  stage: string       // 'character' | 'scene' | 'storyboard' | 'video' | 'narrative' | 'portrait' | 'image'
  userPrompt?: string
  userNegative?: string
}

export interface StyleInjectResult {
  prompt: string
  negative: string
  modelRoute: { provider: string; model: string } | null
  profileStyleTokens: string
  profileNegativeTokens: string
}

/**
 * 统一的风格注入入口
 * 调用方只需传入 styleName + stage，自动获取对应的 prompt 样式
 */
export async function injectStyle(opts: StyleInjectOptions): Promise<StyleInjectResult> {
  const { styleName, stage, userPrompt = '', userNegative = '' } = opts

  const prompt = await StyleProfileService.buildPrompt(styleName, stage, userPrompt)
  const negative = await StyleProfileService.buildNegative(styleName, userNegative)

  let modelRoute: { provider: string; model: string } | null = null
  if (stage === 'video') {
    const mr = await StyleProfileService.getModelRoute(styleName, 'video')
    if (mr) modelRoute = mr
  } else if (stage === 'image' || stage === 'portrait') {
    const mr = await StyleProfileService.getModelRoute(styleName, 'image')
    if (mr) modelRoute = mr
  }

  // 获取原始 tokens 供调用方使用（如需要在 prompt 中插入）
  let profileStyleTokens = ''
  let profileNegativeTokens = ''
  const profile = await StyleProfileService.getByName(styleName || 'default')
  if (profile) {
    profileStyleTokens = profile.styleTokens
    profileNegativeTokens = profile.negativeTokens
  }

  return { prompt, negative, modelRoute, profileStyleTokens, profileNegativeTokens }
}

/**
 * 获取某环节的 prompt 覆盖模板（如果存在）
 */
export async function getStagePromptOverride(styleName: string | null | undefined, stage: string): Promise<string | null> {
  const profile = await StyleProfileService.getByName(styleName || 'default')
  if (!profile) return null
  return profile.promptOverrides[stage] || null
}

/**
 * 获取某风格的模型路由（快速版，不加载完整 profile）
 */
export async function getStyleModelRoute(styleName: string | null | undefined, type: 'image' | 'video' | 'llm'): Promise<{ provider: string; model: string } | null> {
  return StyleProfileService.getModelRoute(styleName, type)
}
