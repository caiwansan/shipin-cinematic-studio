/**
 * CIR Validator — 验证 CIR v1.0 符合规范
 */

import { CirV1, CIR_VERSION } from './cir-v1.js'

export interface CirValidationResult {
  valid: boolean
  errors: CirValidationError[]
  warnings: CirValidationWarning[]
}

export interface CirValidationError {
  path: string
  message: string
}

export interface CirValidationWarning {
  path: string
  message: string
}

/**
 * 验证 CIR 对象是否符合 v1.0 规范。
 * - Agent 输出 CIR 后必须通过此验证才能进入下一阶段。
 * - 验证失败则拒绝该 CIR，禁止进入 Compiler。
 */
export function validateCir(cir: unknown): CirValidationResult {
  const errors: CirValidationError[] = []
  const warnings: CirValidationWarning[] = []

  if (!cir || typeof cir !== 'object') {
    errors.push({ path: '$', message: 'CIR must be a non-null object' })
    return { valid: false, errors, warnings }
  }

  const c = cir as Record<string, unknown>

  // 1. version
  if (c.version !== CIR_VERSION) {
    errors.push({ path: 'version', message: `Must be "${CIR_VERSION}", got "${c.version}"` })
  }

  // 2. scene
  if (!c.scene || typeof c.scene !== 'object') {
    errors.push({ path: 'scene', message: 'scene is required' })
  } else {
    const scene = c.scene as Record<string, unknown>
    if (!scene.title || typeof scene.title !== 'string') {
      errors.push({ path: 'scene.title', message: 'scene.title is required (string)' })
    }
    if (!scene.environment || typeof scene.environment !== 'object') {
      errors.push({ path: 'scene.environment', message: 'scene.environment is required' })
    } else {
      const env = scene.environment as Record<string, unknown>
      const requiredEnv = ['location', 'timeOfDay', 'weather', 'atmosphere']
      for (const field of requiredEnv) {
        if (!env[field] || typeof env[field] !== 'string') {
          errors.push({ path: `scene.environment.${field}`, message: `Required string field "${field}"` })
        }
      }
    }
  }

  // 3. storyIntent
  if (!c.storyIntent || typeof c.storyIntent !== 'object') {
    errors.push({ path: 'storyIntent', message: 'storyIntent is required' })
  } else {
    const si = c.storyIntent as Record<string, unknown>
    if (!si.story || typeof si.story !== 'string') {
      errors.push({ path: 'storyIntent.story', message: 'Required string field "story"' })
    }
    if (!si.cinematic || typeof si.cinematic !== 'string') {
      errors.push({ path: 'storyIntent.cinematic', message: 'Required string field "cinematic"' })
    }
  }

  // 4. shots
  if (!Array.isArray(c.shots)) {
    errors.push({ path: 'shots', message: 'shots must be a non-empty array' })
  } else if (c.shots.length === 0) {
    errors.push({ path: 'shots', message: 'shots must have at least one shot' })
  } else {
    for (let i = 0; i < c.shots.length; i++) {
      const shot = c.shots[i] as Record<string, unknown> | undefined
      if (!shot || typeof shot !== 'object') {
        errors.push({ path: `shots[${i}]`, message: 'Each shot must be an object' })
        continue
      }
      if (!shot.id) errors.push({ path: `shots[${i}].id`, message: 'shot.id is required' })
      if (!shot.description) errors.push({ path: `shots[${i}].description`, message: 'shot.description is required' })
      if (!shot.camera || typeof shot.camera !== 'object') {
        errors.push({ path: `shots[${i}].camera`, message: 'shot.camera is required' })
      }
      if (typeof shot.durationSeconds !== 'number' || shot.durationSeconds <= 0) {
        errors.push({ path: `shots[${i}].durationSeconds`, message: 'Must be a positive number' })
      }
    }
  }

  // 5. characters
  if (!Array.isArray(c.characters)) {
    errors.push({ path: 'characters', message: 'characters must be an array' })
  } else {
    for (let i = 0; i < c.characters.length; i++) {
      const ch = c.characters[i] as Record<string, unknown> | undefined
      if (!ch || !ch.id) errors.push({ path: `characters[${i}].id`, message: 'Character id is required' })
      if (!ch || !ch.name) errors.push({ path: `characters[${i}].name`, message: 'Character name is required' })
    }
  }

  // 6. metadata
  if (c.metadata && typeof c.metadata === 'object') {
    const meta = c.metadata as Record<string, unknown>
    if (!meta.generatedBy) {
      warnings.push({ path: 'metadata.generatedBy', message: 'metadata.generatedBy recommended' })
    }
  }

  // 7. Optional: check no prompt fields leaked
  if (c.prompt || (c as any).prompt) {
    warnings.push({ path: 'prompt', message: 'CIR should not contain prompt fields. Remove it before output.' })
  }

  return { valid: errors.length === 0, errors, warnings }
}
