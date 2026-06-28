/**
 * prompt-compiler.ts — 生产环节 Prompt 编译器
 *
 * 所有风格模板从 StyleProfile 表读取（禁止硬编码）。
 * artStyle 参数与 style_profiles.name 一一对应。
 *
 * 通过 injectStyle() 获取对应风格的 prompt 模板，
 * 替代原有的 STYLE_TEMPLATES 硬编码映射。
 */

import { StyleProfileService } from '../services/style-profile.service.js'

// ── 类型定义 ──

export interface StoryboardShot {
  shotNumber: number
  sceneNumber: number
  description: string
  camera?: string
  lighting?: string
  emotion?: string      // mood
  duration?: string
  sceneId?: string
  characterName?: string
  dialogue?: string
  characterRefs?: string[]   // character reference image URLs
}

export interface SceneContext {
  projectId: string
  projectType: string
  artStyle: string              // 对应 style_profiles.name
  visualConsistency: string
  aspectRatio: string
  colorPalette?: string
  characterRefs?: string[]
  styleRef?: string              // 画风参考图 URL
}

export interface CompiledPrompt {
  shotNumber: number
  sceneNumber: number
  description: string
  shotType: ShotType
  imagePrompt: string
  videoPrompt: string
  audioPrompt: string
  camera: string
  lighting: string
  mood: string
  duration: number
  temporalLink?: {
    previousCharacter: boolean
    sameLocation: boolean
    timeContinuity: boolean
  }
}

export type ShotType = 'scene_establishing' | 'character_closeup' | 'action_sequence' | 'dialogue_shot' | 'transition_shot' | 'detail_shot'

export interface CompileResult {
  shots: CompiledPrompt[]
  sceneContext: SceneContext
  errors: string[]
}

export interface FormattedBatch {
  imagePrompts: string[]
  videoPrompts: string[]
  audioPrompts: string[]
  metadata: {
    totalShots: number
    totalDuration: number
    aspectRatio: string
    artStyle: string
  }
}

// ── Shot Type Detection ──

const SHOT_TYPE_MODIFIERS: Record<ShotType, { camera: string; lighting: string; mood: string }> = {
  scene_establishing: { camera: 'wide establishing shot', lighting: 'natural ambient light', mood: 'atmospheric' },
  character_closeup: { camera: 'close-up shot', lighting: 'soft diffused light', mood: 'emotional intimate' },
  action_sequence: { camera: 'dynamic tracking shot', lighting: 'high contrast dramatic', mood: 'intense energetic' },
  dialogue_shot: { camera: 'over-shoulder medium shot', lighting: 'soft three-point lighting', mood: 'conversational grounded' },
  transition_shot: { camera: 'transition cut', lighting: 'match cut blending', mood: 'narrative flowing' },
  detail_shot: { camera: 'extreme close-up macro', lighting: 'focused accent light', mood: 'detailed observant' },
}

function detectShotType(shot: StoryboardShot): ShotType {
  const desc = (shot.description || '').toLowerCase()
  if (desc.includes('close') || desc.includes('close-up') || desc.includes('表情') || desc.includes('特写')) return 'character_closeup'
  if (desc.includes('action') || desc.includes('fight') || desc.includes('chase') || desc.includes('爆炸') || desc.includes('打斗') || desc.includes('追逐')) return 'action_sequence'
  if (desc.includes('wide') || desc.includes('establish') || desc.includes('远景') || desc.includes('全景') || desc.includes('空镜')) return 'scene_establishing'
  if (desc.includes('detail') || desc.includes('detail of') || desc.includes('细节')) return 'detail_shot'
  if (desc.includes('transition') || desc.includes('cut to') || desc.includes('转场')) return 'transition_shot'
  return 'dialogue_shot'
}

// ── Compilers ──

/**
 * 从 StyleProfile 获取风格的 prompt 模板
 */
async function getStyleTemplates(artStyle: string): Promise<{ image: string; video: string }> {
  const profile = await StyleProfileService.getByName(artStyle)
  const overrides = profile?.promptOverrides || {}
  const styleTokens = profile?.styleTokens || ''
  const refUrl = profile?.referenceImageUrl || ''

  // 使用 style_profile 中的 cover 模板，或自动生成
  const image = overrides.image || overrides.storyboard || overrides.character ||
    `[{description}], {camera}, {lighting}, {mood}, ${styleTokens}, {aspect_ratio}`

  const video = overrides.video ||
    `{description}, {camera} movement, {lighting}, {mood}, ${styleTokens}, consistent character appearance, {aspect_ratio}`

  return { image, video }
}

export async function compileImagePromptAsync(
  shot: StoryboardShot,
  ctx: SceneContext,
): Promise<string> {
  const shotInfo = SHOT_TYPE_MODIFIERS[detectShotType(shot)] || SHOT_TYPE_MODIFIERS.scene_establishing
  const templates = await getStyleTemplates(ctx.artStyle)

  const camera = shot.camera || shotInfo.camera
  const lighting = shot.lighting || shotInfo.lighting
  const mood = shot.emotion || shotInfo.mood

  // 构建 negative prompt
  const negativeProfile = await StyleProfileService.getByName(ctx.artStyle)
  const negatives = [
    negativeProfile?.negativeTokens || '',
    'blurry faces, deformed hands, extra fingers, distorted proportions, ugly, duplicate character, mutation, low quality, watermark, text, logo',
  ].filter(Boolean).join(', ')

  // 应用模板
  const prompt = templates.image
    .replace(/\{description\}/g, shot.description)
    .replace(/\{camera\}/g, camera)
    .replace(/\{lighting\}/g, lighting)
    .replace(/\{mood\}/g, mood)
    .replace(/\{aspect_ratio\}/g, ctx.aspectRatio || '9:16')

  return prompt
}

export async function compileVideoPromptAsync(
  shot: StoryboardShot,
  ctx: SceneContext,
  prevShot?: CompiledPrompt,
): Promise<string> {
  const shotInfo = SHOT_TYPE_MODIFIERS[detectShotType(shot)] || SHOT_TYPE_MODIFIERS.scene_establishing
  const templates = await getStyleTemplates(ctx.artStyle)

  const camera = shot.camera || shotInfo.camera
  const lighting = shot.lighting || shotInfo.lighting
  const mood = shot.emotion || shotInfo.mood

  const temporal = prevShot ? buildTemporalContext(shot, prevShot) : ''
  const characterConsistency = ctx.characterRefs?.length
    ? `Maintaining consistent character appearance: characters in this scene. `
    : ''

  const prompt = templates.video
    .replace(/\{description\}/g, shot.description)
    .replace(/\{camera\}/g, camera)
    .replace(/\{lighting\}/g, lighting)
    .replace(/\{mood\}/g, mood)
    .replace(/\{aspect_ratio\}/g, ctx.aspectRatio || '9:16')

  return `${characterConsistency}${prompt}${temporal}`
}

export async function compileStoryboardAsync(
  shots: StoryboardShot[],
  ctx?: Partial<SceneContext>,
): Promise<CompileResult> {
  const errors: string[] = []
  const results: CompiledPrompt[] = []

  // 如果 artStyle 是中文或空的，尝试用默认
  let artStyle = ctx?.artStyle || 'realistic'
  const profile = await StyleProfileService.getByName(artStyle)
  if (!profile) {
    // 尝试匹配：如果是中文名字
    const all = await StyleProfileService.getAll()
    const match = all.find(p => p.displayName === artStyle || p.name === artStyle)
    if (match) artStyle = match.name
  }

  const defaultCtx: SceneContext = {
    projectId: ctx?.projectId || 'unknown',
    projectType: ctx?.projectType || 'short_drama',
    artStyle,
    visualConsistency: ctx?.visualConsistency || 'same_character',
    aspectRatio: ctx?.aspectRatio || '9:16',
    colorPalette: ctx?.colorPalette,
    characterRefs: ctx?.characterRefs,
    styleRef: ctx?.styleRef || profile?.referenceImageUrl || undefined,
  }

  for (const shot of shots) {
    const shotType = detectShotType(shot)
    try {
      const compiled: CompiledPrompt = {
        shotNumber: shot.shotNumber,
        sceneNumber: shot.sceneNumber,
        description: shot.description,
        shotType,
        imagePrompt: await compileImagePromptAsync(shot, defaultCtx),
        videoPrompt: await compileVideoPromptAsync(shot, defaultCtx, results[results.length - 1]),
        audioPrompt: compileAudioPrompt(shot, defaultCtx),
        camera: shot.camera || SHOT_TYPE_MODIFIERS[shotType].camera,
        lighting: shot.lighting || SHOT_TYPE_MODIFIERS[shotType].lighting,
        mood: shot.emotion || SHOT_TYPE_MODIFIERS[shotType].mood,
        duration: parseInt(shot.duration || '8'),
        temporalLink: results.length > 0 ? {
          previousCharacter: true,
          sameLocation: shot.sceneNumber === results[results.length - 1].sceneNumber,
          timeContinuity: shot.emotion === results[results.length - 1].mood,
        } : undefined,
      }
      results.push(compiled)
    } catch (e: any) {
      errors.push(`Shot ${shot.shotNumber}: ${e.message}`)
    }
  }

  return { shots: results, sceneContext: defaultCtx, errors }
}

// ── Audio Compiler ──

export function compileAudioPrompt(
  shot: StoryboardShot,
  ctx: SceneContext,
): string {
  const parts: string[] = []
  if (shot.dialogue) parts.push(`Dialogue: "${shot.dialogue}"`)
  if (shot.emotion) parts.push(`Mood: ${shot.emotion}`)
  parts.push('Background music style matching the scene')
  return parts.join('. ')
}

// ── Temporal Context Builder ──

function buildTemporalContext(shot: StoryboardShot, prevShot: CompiledPrompt): string {
  const contexts: string[] = []
  if (prevShot.shotNumber) contexts.push(`Previous shot: shot ${prevShot.shotNumber}`)
  if (prevShot.mood && shot.emotion !== prevShot.mood) contexts.push(`Mood change from ${prevShot.mood} to ${shot.emotion}`)
  return contexts.length ? `. Continuity: ${contexts.join(', ')}.` : ''
}

// ── Format Compiler Output ──

export function formatProductionBatch(result: CompileResult): FormattedBatch {
  return {
    imagePrompts: result.shots.map(s => s.imagePrompt),
    videoPrompts: result.shots.map(s => s.videoPrompt),
    audioPrompts: result.shots.map(s => s.audioPrompt),
    metadata: {
      totalShots: result.shots.length,
      totalDuration: result.shots.reduce((sum, s) => sum + s.duration, 0),
      aspectRatio: result.sceneContext.aspectRatio,
      artStyle: result.sceneContext.artStyle,
    },
  }
}

// ── V1 backward-compatible wrappers ──
// Existing callers import compileStoryboard / compileImagePrompt etc.
// These now delegate to the async versions.

export const compileImagePrompt = compileImagePromptAsync
export const compileVideoPrompt = compileVideoPromptAsync
export const compileStoryboard = compileStoryboardAsync
