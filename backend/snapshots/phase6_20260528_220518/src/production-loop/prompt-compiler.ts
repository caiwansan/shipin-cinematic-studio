// Prompt Compiler v1
// Storyboard → 可执行 Prompt (image/video/audio)
// 这是 AI Factory OS 的核心壁垒：把"描述"变成"机器可执行的指令"


// ── Shot Type Detection ──

import type { StoryboardShot } from './schema.js'
export { type StoryboardShot }
export type ShotType = 'scene_establishing' | 'character_closeup' | 'action_sequence' | 'dialogue_shot' | 'transition_shot' | 'detail_shot'

export function detectShotType(shot: StoryboardShot): ShotType {
  const desc = (shot.description || '').toLowerCase()
  const camera = (shot.camera || '').toLowerCase()
  const emotion = (shot.emotion || '').toLowerCase()

  if (camera.includes('wide') || desc.includes('establish') || desc.includes('setting')) return 'scene_establishing'
  if (camera.includes('close') || camera.includes('extreme') || emotion) return 'character_closeup'
  if (desc.includes('fight') || desc.includes('run') || desc.includes('move') || camera.includes('track')) return 'action_sequence'
  if (desc.includes('dialogue') || desc.includes('talk') || desc.includes('conversation')) return 'dialogue_shot'
  if (camera.includes('cut') || desc.includes('dissolve') || desc.includes('fade')) return 'transition_shot'
  if (desc.length < 20 && (camera.includes('detail') || desc.includes('close'))) return 'detail_shot'
  return 'scene_establishing'
}

// ── Scene Context (style/consistency token) ──

export interface SceneContext {
  projectId: string
  projectType: string
  artStyle: string            // e.g. 'cinematic', 'anime', '3d-render', 'line-art'
  visualConsistency: string   // e.g. 'same_character', 'consistent_lighting'
  colorPalette?: string
  aspectRatio: string
  characterRefs?: string[]    // character reference image URLs
  styleRef?: string           // style reference image URL
}

// ── Compiled Prompts ──

export interface CompiledPrompt {
  shotNumber: number
  sceneNumber: number
  description: string
  shotType: ShotType

  // Production Prompts
  imagePrompt: string         // For image gen models (Flux / SDXL)
  videoPrompt: string         // For video gen models (Runway / Sora)
  audioPrompt: string         // For audio gen / TTS

  // Technical params
  camera: string
  lighting: string
  mood: string
  duration: number            // seconds
  negativePrompt?: string

  // Temporal link (for video consistency across shots)
  temporalLink?: {
    previousCharacter: boolean
    sameLocation: boolean
    timeContinuity: boolean
  }
}

// ── Prompt Templates ──

const STYLE_TEMPLATES: Record<string, { image: string; video: string }> = {
  cinematic: {
    image: 'Cinematic {description}, {camera} shot, {lighting}, {mood} atmosphere, filmic color grading, professional lighting, {aspect_ratio}',
    video: 'Cinematic footage of {description}, {camera} movement, {lighting}, {mood}, film grain, consistent character appearance, smooth motion, 24fps',
  },
  anime: {
    image: 'Anime style illustration of {description}, {camera}, {lighting}, {mood}, detailed line work, vibrant colors, cel shading, {aspect_ratio}',
    video: 'Anime animation of {description}, {camera}, {lighting}, {mood}, keyframe quality, 2D animation, smooth interpolation, 24fps',
  },
  '3d-render': {
    image: '3D render of {description}, {camera}, {lighting}, {mood}, octane render, subsurface scattering, global illumination, photorealistic texture, {aspect_ratio}',
    video: '3D animated scene of {description}, {camera}, realistic physics, PBR materials, consistent geometry, ray-traced lighting, 24fps',
  },
  'line-art': {
    image: 'Line art sketch of {description}, {camera}, clean strokes, minimal, high contrast, {aspect_ratio}',
    video: 'Animated line art of {description}, {camera}, hand-drawn feel, 2D animation, sketch style, white background, 24fps',
  },
}

const SHOT_TYPE_MODIFIERS: Record<ShotType, { camera: string; lighting: string; mood: string }> = {
  scene_establishing: { camera: 'wide establishing shot', lighting: 'natural ambient light', mood: 'atmospheric' },
  character_closeup: { camera: 'close-up shot', lighting: 'soft diffused light', mood: 'emotional intimate' },
  action_sequence: { camera: 'dynamic tracking shot', lighting: 'high contrast dramatic', mood: 'intense energetic' },
  dialogue_shot: { camera: 'over-shoulder medium shot', lighting: 'soft three-point lighting', mood: 'conversational grounded' },
  transition_shot: { camera: 'transition cut', lighting: 'match cut blending', mood: 'narrative flowing' },
  detail_shot: { camera: 'extreme close-up macro', lighting: 'focused accent light', mood: 'detailed observant' },
}

// ── Compilers ──

export function compileImagePrompt(
  shot: StoryboardShot,
  ctx: SceneContext,
): string {
  const shotInfo = SHOT_TYPE_MODIFIERS[detectShotType(shot)] || SHOT_TYPE_MODIFIERS.scene_establishing
  const template = STYLE_TEMPLATES[ctx.artStyle]?.image || STYLE_TEMPLATES.cinematic.image

  const camera = shot.camera || shotInfo.camera
  const lighting = shot.lighting || shotInfo.lighting
  const mood = shot.emotion || shotInfo.mood

  // Build negative prompt for common AI video artifacts
  const negatives = [
    'blurry faces',
    'deformed hands',
    'extra fingers',
    'distorted proportions',
    'ugly',
    'duplicate character',
    'mutation',
    'low quality',
    'watermark',
    'text',
    'logo',
  ]

  return template
    .replace('{description}', shot.description)
    .replace('{camera}', camera)
    .replace('{lighting}', lighting)
    .replace('{mood}', mood)
    .replace('{aspect_ratio}', ctx.aspectRatio || '16:9')
}

export function compileVideoPrompt(
  shot: StoryboardShot,
  ctx: SceneContext,
  prevShot?: CompiledPrompt,
): string {
  const shotInfo = SHOT_TYPE_MODIFIERS[detectShotType(shot)] || SHOT_TYPE_MODIFIERS.scene_establishing
  const template = STYLE_TEMPLATES[ctx.artStyle]?.video || STYLE_TEMPLATES.cinematic.video

  const camera = shot.camera || shotInfo.camera
  const lighting = shot.lighting || shotInfo.lighting
  const mood = shot.emotion || shotInfo.mood

  // Temporal context: if previous shot exists, link them
  const temporal = prevShot ? buildTemporalContext(shot, prevShot) : ''
  const characterConsistency = ctx.characterRefs?.length ? `Maintaining consistent character appearance: characters in this scene. ` : ''

  return `${characterConsistency}${template
    .replace('{description}', shot.description)
    .replace('{camera}', camera)
    .replace('{lighting}', lighting)
    .replace('{mood}', mood)}${temporal}`
}

export function compileAudioPrompt(
  shot: StoryboardShot,
  ctx: SceneContext,
): string {
  const mood = shot.emotion || 'neutral'
  const shotType = detectShotType(shot)
  const duration = shot.duration || 8

  const moodToAudio: Record<string, string> = {
    peaceful: 'Soft ambient pads, gentle nature sounds, slow tempo',
    gentle: 'Warm piano arpeggios, soft string ensemble, melodic',
    disappointed: 'Minor key piano, sparse arrangement, melancholic cello',
    happy: 'Bright acoustic guitar, cheerful percussion, uplifting melody',
    tense: 'Low frequency drone, sharp staccato strings, building tension',
    sad: 'Slow violin solo, reverb-heavy piano, emotional depth',
    energetic: 'Driving electronic beat, layered synths, 120bpm',
    intense: 'Aggressive percussion, dissonant brass, rhythmic pulse',
    detailed: 'Minimal ambient texture, precise sound design, focused',
    narrative: 'Cinematic orchestral swell, narrative flow, thematic',
  }

  const audioDescription = moodToAudio[mood.toLowerCase()] || 'Neutral ambient background, soft atmospheric, unobtrusive'
  const shotDescription = shot.description || `Scene ${shot.sceneNumber} shot ${shot.shotNumber}`

  return `${audioDescription}. Duration: ${duration}s. Scene: ${shotDescription}. Type: ${shotType}.`
}

export function buildTemporalContext(shot: StoryboardShot, prev: CompiledPrompt): string {
  const sameLocation = prev.camera.includes('wide') && prev.description.includes(shot.description.slice(0, 20))
  const continuity = [`Previous scene: ${prev.description}.`]

  if (sameLocation) continuity.push('Same location - maintain consistent layout.')
  if (shot.emotion === prev.mood) continuity.push('Emotional continuity maintained.')
  else continuity.push(`Mood shift from ${prev.mood} to ${shot.emotion || 'unknown'}.`)

  return ` Temporal continuity: ${continuity.join(' ')}`
}

// ── Main Compiler ──

export interface CompileResult {
  shots: CompiledPrompt[]
  sceneContext: SceneContext
  errors: string[]
}

export function compileStoryboard(
  shots: StoryboardShot[],
  ctx?: Partial<SceneContext>,
): CompileResult {
  const errors: string[] = []
  const results: CompiledPrompt[] = []
  const defaultCtx: SceneContext = {
    projectId: ctx?.projectId || 'unknown',
    projectType: ctx?.projectType || 'short_drama',
    artStyle: ctx?.artStyle || 'cinematic',
    visualConsistency: ctx?.visualConsistency || 'same_character',
    aspectRatio: ctx?.aspectRatio || '16:9',
    colorPalette: ctx?.colorPalette,
    characterRefs: ctx?.characterRefs,
    styleRef: ctx?.styleRef,
  }

  for (const shot of shots) {
    const shotType = detectShotType(shot)
    try {
      const compiled: CompiledPrompt = {
        shotNumber: shot.shotNumber,
        sceneNumber: shot.sceneNumber,
        description: shot.description,
        shotType,
        imagePrompt: compileImagePrompt(shot, defaultCtx),
        videoPrompt: compileVideoPrompt(shot, defaultCtx, results[results.length - 1]),
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

// ── Format Compiler Output ──

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
