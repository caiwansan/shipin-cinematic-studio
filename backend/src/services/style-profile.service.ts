/**
 * style-profile.service.ts — 视觉风格配置档案服务
 *
 * 所有 prompt/模型路由/风格参数均从数据库 `style_profiles` 表读取，禁止硬编码。
 * 前端选择视频风格 → 后端全链路自动注入对应的风格 prompt。
 *
 * 使用：
 *   const profile = await StyleProfileService.getActiveStyle('anime')
 *   const prompt = profile.buildPrompt('video', userPrompt)
 *   const negative = profile.buildNegative(userNegative)
 */

import { prisma } from '../utils/index.js'

// ─── 类型定义 ───

export interface ModelRoute {
  provider: string
  model: string
  /** 额外参数，如 { "strength": 0.85, "cfgScale": 7 } */
  params?: Record<string, any>
}

export interface StyleProfileData {
  id: string
  name: string
  displayName: string
  icon: string
  description: string
  /** 正面风格修饰词 */
  styleTokens: string
  /** 负面风格修饰词 */
  negativeTokens: string
  /** 各环节 prompt 模板覆盖 */
  promptOverrides: Record<string, string>
  /** 推荐模型路由 */
  modelRoutes: {
    image?: ModelRoute
    video?: ModelRoute
    llm?: ModelRoute
  }
  /** 画风参考图 URL */
  referenceImageUrl: string | null
  /** 额外参数 */
  parameters: Record<string, any>
  /** 是否为默认风格 */
  isDefault: boolean
  sortOrder: number
}

// ─── 缓存 ───

let profileCache: StyleProfileData[] | null = null
let lastFetch = 0
const CACHE_TTL = 60_000 // 1 分钟

function invalidateCache() {
  profileCache = null
  lastFetch = 0
}

async function loadProfiles(): Promise<StyleProfileData[]> {
  const now = Date.now()
  if (profileCache && now - lastFetch < CACHE_TTL) return profileCache

  const rows = await prisma.styleProfile.findMany({
    where: { enabled: true },
    orderBy: [{ sortOrder: 'asc' }, { isDefault: 'desc' }],
  })

  profileCache = rows.map(r => ({
    id: r.id,
    name: r.name,
    displayName: r.displayName,
    icon: r.icon,
    description: r.description,
    styleTokens: r.styleTokens,
    negativeTokens: r.negativeTokens,
    promptOverrides: (r.promptOverrides as Record<string, string>) || {},
    modelRoutes: (r.modelRoutes as any) || {},
    referenceImageUrl: r.referenceImageUrl,
    parameters: (r.parameters as Record<string, any>) || {},
    isDefault: r.isDefault,
    sortOrder: r.sortOrder,
  }))

  lastFetch = now
  return profileCache
}

// ─── 主服务 ───

export const StyleProfileService = {
  /** 获取所有风格档案 */
  async getAll(): Promise<StyleProfileData[]> {
    return loadProfiles()
  },

  /** 按名称获取单个风格 */
  async getByName(name: string): Promise<StyleProfileData | null> {
    if (!name || name === 'default') {
      const all = await loadProfiles()
      return all.find(p => p.isDefault) || all[0] || null
    }
    // 先拿缓存
    const all = await loadProfiles()
    const found = all.find(p => p.name === name)
    if (found) return found

    // 缓存没有时查数据库
    const row = await prisma.styleProfile.findUnique({ where: { name } })
    if (!row || !row.enabled) return null

    return {
      id: row.id,
      name: row.name,
      displayName: row.displayName,
      icon: row.icon,
      description: row.description,
      styleTokens: row.styleTokens,
      negativeTokens: row.negativeTokens,
      promptOverrides: (row.promptOverrides as Record<string, string>) || {},
      modelRoutes: (row.modelRoutes as any) || {},
      referenceImageUrl: row.referenceImageUrl,
      parameters: (row.parameters as Record<string, any>) || {},
      isDefault: row.isDefault,
      sortOrder: row.sortOrder,
    }
  },

  /** 获取默认风格 */
  async getDefault(): Promise<StyleProfileData | null> {
    return this.getByName('default')
  },

  /** 构建某环节的完整 prompt */
  async buildPrompt(styleName: string | null | undefined, stage: string, userPrompt: string): Promise<string> {
    const profile = await this.getByName(styleName || 'default')
    if (!profile) return userPrompt

    // 如果有环节覆盖模板
    const override = profile.promptOverrides[stage]
    if (override) {
      return override.replace('{{prompt}}', userPrompt)
    }

    // 默认行为：追加 styleTokens
    const tokens = profile.styleTokens.trim()
    if (!tokens) return userPrompt

    // 根据环节类型智能拼接
    if (stage === 'video' || stage === 'storyboard') {
      return `${userPrompt}，${tokens}`
    }
    return `${userPrompt}。${tokens}`
  },

  /** 构建某环节的 negative prompt */
  async buildNegative(styleName: string | null | undefined, userNegative: string): Promise<string> {
    const profile = await this.getByName(styleName || 'default')
    if (!profile) return userNegative

    const tokens = profile.negativeTokens.trim()
    if (!tokens) return userNegative

    return userNegative ? `${userNegative}，${tokens}` : tokens
  },

  /** 获取某风格的模型路由 */
  async getModelRoute(styleName: string | null | undefined, type: 'image' | 'video' | 'llm'): Promise<ModelRoute | null> {
    const profile = await this.getByName(styleName || 'default')
    if (!profile?.modelRoutes?.[type]) return null
    return profile.modelRoutes[type]!
  },

  /** 创建新风格 */
  async create(data: {
    name: string
    displayName: string
    icon?: string
    description?: string
    styleTokens?: string
    negativeTokens?: string
    promptOverrides?: Record<string, string>
    modelRoutes?: Record<string, ModelRoute>
    referenceImageUrl?: string
    parameters?: Record<string, any>
    sortOrder?: number
    isDefault?: boolean
  }): Promise<StyleProfileData> {
    const row = await prisma.styleProfile.create({
      data: {
        name: data.name,
        displayName: data.displayName,
        icon: data.icon || '🎨',
        description: data.description || '',
        styleTokens: data.styleTokens || '',
        negativeTokens: data.negativeTokens || '',
        promptOverrides: (data.promptOverrides || {}) as any,
        modelRoutes: (data.modelRoutes || {}) as any,
        referenceImageUrl: data.referenceImageUrl || null,
        parameters: (data.parameters || {}) as any,
        sortOrder: data.sortOrder || 0,
        isDefault: data.isDefault || false,
      },
    })
    invalidateCache()
    return (await this.getByName(row.name))!
  },

  /** 更新风格 */
  async update(name: string, data: Partial<{
    displayName: string
    icon: string
    description: string
    styleTokens: string
    negativeTokens: string
    promptOverrides: Record<string, string>
    modelRoutes: Record<string, ModelRoute>
    referenceImageUrl: string | null
    parameters: Record<string, any>
    sortOrder: number
    enabled: boolean
    isDefault: boolean
  }>): Promise<StyleProfileData | null> {
    const updateData: any = {}
    for (const [k, v] of Object.entries(data)) {
      if (v !== undefined) updateData[k] = v
    }
    const row = await prisma.styleProfile.update({
      where: { name },
      data: updateData,
    })
    invalidateCache()
    return this.getByName(row.name)
  },

  /** 删除风格 */
  async delete(name: string): Promise<boolean> {
    try {
      await prisma.styleProfile.delete({ where: { name } })
      invalidateCache()
      return true
    } catch {
      return false
    }
  },

  /** 刷新缓存 */
  invalidateCache() {
    invalidateCache()
  },
}
