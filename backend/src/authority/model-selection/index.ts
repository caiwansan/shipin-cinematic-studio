/**
 * authority/model-selection/index.ts — Single Authority Model Selection Protocol (SAMSP)
 *
 * MSAL = 全系统唯一模型选择决策点
 *
 * Authority Collapse Rule:
 *   ∀ model_selection: must_be_resolved_by = MSAL
 *
 * 三权收敛：
 *   Frontend → capability only (no model)
 *   SECS → plan only (no model)
 *   MSAL → model selection ONLY
 *   Adapter → execution ONLY
 */

import { prisma } from '../../utils/index.js'

// ================================================================
// Types
// ================================================================

export type CapabilityType = 'llm_generate' | 'image_generate' | 'video_generate' | 'tts'

export interface ModelSelectionInput {
  /** Capability from frontend */
  capability: CapabilityType
  /** User ID for UserModelConfig lookup */
  userId: string | number
  /** Optional: preferred model (untrusted hint) */
  preferredModel?: string
  /** Optional: preferred provider (untrusted hint) */
  preferredProvider?: string
}

export interface ModelSelectionResult {
  provider: string
  modelName: string
  /** Which config source was used */
  source: 'user_config' | 'model_provider' | 'error'
  /** Whether the frontend hint was used */
  usedPreferred: boolean
}

// ================================================================
// Capability → UserModelConfig field mapping
// ================================================================

const CAPABILITY_FIELDS: Record<CapabilityType, {
  modelColumn: 'llmModel' | 'imageModel' | 'videoModel' | 'ttsModel'
  enabledColumn: 'llmEnabled' | 'imageEnabled' | 'videoEnabled' | 'ttsEnabled'
  providerColumn: 'llmProvider' | 'imageProvider' | 'videoProvider' | 'ttsProvider'
  apiKeyColumn: null  // UserModelConfig uses a single apiKey, no per-type keys in the actual schema
}> = {
  llm_generate:   { modelColumn: 'llmModel',   enabledColumn: 'llmEnabled',   providerColumn: 'llmProvider',   apiKeyColumn: null },
  image_generate: { modelColumn: 'imageModel', enabledColumn: 'imageEnabled', providerColumn: 'imageProvider', apiKeyColumn: null },
  video_generate: { modelColumn: 'videoModel', enabledColumn: 'videoEnabled', providerColumn: 'videoProvider', apiKeyColumn: null },
  tts:            { modelColumn: 'ttsModel',   enabledColumn: 'ttsEnabled',   providerColumn: 'ttsProvider',   apiKeyColumn: null },
}

// ================================================================
// MSAL — Model Selection Authority Layer
//
// This is the ONLY function in the entire system that resolves
// "which model" from "what capability".
//
// No env-based fallback. No default model. No adapter-level routing.
// If no model is configured, it throws MSALResolutionError.
// ================================================================

export async function selectModel(
  ctx: ModelSelectionInput,
): Promise<ModelSelectionResult> {
  const fields = CAPABILITY_FIELDS[ctx.capability]

  // Step 1: Try UserModelConfig (user's own API key + model config)
  const userConfig = await tryLoadUserModelConfig(ctx.userId, fields)
  if (userConfig) {
    const provider = userConfig.providerColumn || userConfig.provider
    return {
      provider,
      modelName: userConfig.modelName,
      source: 'user_config',
      usedPreferred: false,
    }
  }

  // Step 2: Try preferredModel if given (frontend hint — validated against DB)
  if (ctx.preferredModel) {
    const dbEntry = await tryLookupModelProvider(ctx.preferredModel)
    if (dbEntry) {
      return {
        provider: dbEntry.provider,
        modelName: ctx.preferredModel,
        source: 'user_config',
        usedPreferred: true,
      }
    }
  }

  // Step 3: Try ModelProvider table (platform default models)
  const platformModel = await tryLoadModelProvider(ctx.capability)
  if (platformModel) {
    return {
      provider: platformModel.provider,
      modelName: platformModel.modelName,
      source: 'model_provider',
      usedPreferred: false,
    }
  }

  // If NOTHING is configured, throw. No fallback. No env-based default.
  // The user must configure a model in UserModelConfig or admin must set ModelProvider.
  throw new MSALResolutionError(
    `No model configured for capability "${ctx.capability}". ` +
    `User ${ctx.userId} has no UserModelConfig and no ModelProvider entry exists. ` +
    `Please configure a model in the settings.`,
  )
}

// ================================================================
// Error type
// ================================================================

export class MSALResolutionError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'MSALResolutionError'
  }
}

// ================================================================
// DB access
// ================================================================

interface UserModelConfigResult {
  provider: string
  providerColumn: string | null
  modelName: string
  enabled: boolean
  apiKey?: string
}

interface ModelProviderResult {
  provider: string
  modelName: string
}

/**
 * Try to load user's model config for a given capability (V2 真相源)
 */
async function tryLoadUserModelConfig(
  userId: string | number,
  _fields: CapabilityFields,
): Promise<UserModelConfigResult | null> {
  try {
    // 迁移到 V2：直接从 UserModelConfigV2 读取
    const { decryptKey } = await import('../../services/crypto.service.js')
    const v2 = await prisma.userModelConfigV2.findUnique({
      where: { userId: String(userId) },
    })
    if (!v2) return null

    // 尝试找任意一个可用的 provider+key
    if (v2.llmApiKey && v2.llmEnabled) {
      try {
        return {
          provider: v2.llmProvider || 'volcengine',
          providerColumn: v2.llmProvider || 'volcengine',
          modelName: v2.llmModel || 'doubao-seed-2-0-plus-260428',
          enabled: true,
          apiKey: decryptKey(v2.llmApiKey),
        }
      } catch { /* fallthrough */ }
    }
    if (v2.imageApiKey && v2.imageEnabled) {
      try {
        return {
          provider: v2.imageProvider || 'volcengine',
          providerColumn: v2.imageProvider || 'volcengine',
          modelName: v2.imageModel || 'doubao-seedream-4-5-251128',
          enabled: true,
          apiKey: decryptKey(v2.imageApiKey),
        }
      } catch { /* fallthrough */ }
    }

    // Use _fields to determine which column to read from v2
    const modelVal = v2[_fields.modelColumn]
    const enabledVal = v2[_fields.enabledColumn]
    const providerVal = v2[_fields.providerColumn]
    if (modelVal && enabledVal) {
      return {
        provider: providerVal || 'volcengine',
        providerColumn: providerVal || 'volcengine',
        modelName: modelVal,
        enabled: enabledVal,
      }
    }

    return null
  } catch {
    return null
  }
}

type CapabilityFields = (typeof CAPABILITY_FIELDS)[CapabilityType]

/**
 * Try to load a specific model from ModelProvider table by name
 */
async function tryLookupModelProvider(
  modelName: string,
): Promise<ModelProviderResult | null> {
  try {
    const entry = await prisma.modelProvider.findFirst({
      where: { modelName },
    })

    if (entry) {
      return {
        provider: entry.provider,
        modelName: entry.modelName,
      }
    }

    return null
  } catch {
    return null
  }
}

/**
 * Try to load platform default model from ModelProvider table by capability
 */
async function tryLoadModelProvider(
  capability: CapabilityType,
): Promise<ModelProviderResult | null> {
  try {
    const typeMap: Record<CapabilityType, string> = {
      llm_generate: 'llm',
      image_generate: 'image',
      video_generate: 'video',
      tts: 'tts',
    }

    const type = typeMap[capability]

    const entries = await prisma.modelProvider.findMany({
      where: {
        modelType: type,
        isActive: true,
      },
      orderBy: { sortOrder: 'asc' },
      take: 1,
    })

    if (entries.length > 0) {
      return {
        provider: entries[0].provider,
        modelName: entries[0].modelName,
      }
    }

    return null
  } catch {
    return null
  }
}
