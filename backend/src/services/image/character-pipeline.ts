// ============================================================
// services/image/character-pipeline.ts
//
// 职责：角色四视图/六视图生成的业务编排层
//   - 夹在 route 和 submit-task.ts 之间
//   - 包含：四视图 prompt 组装、seed 管理、参考图传递、
//     merge 合成、COS 上传
//   - 不包含：网络请求（通过 submit-task.ts pipeline）
// ============================================================

import { executeImageTask } from './submit-task.js'
import type { PipelineOutput, ValidationHook } from './pipeline/types.js'

// ─── 输入 ──────────────────────────────────────────────

export interface CharacterViewInput {
  character: any
  imagePrompt: string
  negativePrompt: string
  tripleView: boolean
  styleTokens: string
  negativeTokens: string
  pid: string
  userId: string
  authHeader: string
  baseUrl: string
  storyText?: string
}

export interface CharacterViewResult {
  imageUrl: string
  viewUrls: string[]
  meta: {
    portraitUrl?: string
    frontUrl?: string
    sideUrl?: string
    backUrl?: string
    weaponFrontUrl?: string
    weaponSideUrl?: string
    faceCropUrl?: string
    gridCount: number
  }
}

// ─── 核心函数 ──────────────────────────────────────────

export async function generateCharacterViews(
  input: CharacterViewInput,
  validators?: ValidationHook[],
): Promise<CharacterViewResult> {
  const { character, imagePrompt, negativePrompt, tripleView, styleTokens, negativeTokens, pid, userId, authHeader, baseUrl } = input

  const baseNegative = buildNegative(negativePrompt, negativeTokens)

  if (!tripleView) {
    // ── 单张模式 ──
    const forcedPrompt = forceCharacterPrompt(imagePrompt)
    const fullPrompt = `${forcedPrompt}\n${styleTokens}`.trim()

    const result = await executeImageTask(
      {
        prompt: fullPrompt,
        negativePrompt: baseNegative,
        projectId: pid,
        source: 'character_execution',
        characterName: character.name,
      },
      {
        projectId: pid,
        stage: 'character',
        traceId: `char_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
        identityLockId: character.characterId || character.name,
      },
      { baseUrl, authHeader, userId, validators },
    )

    return {
      imageUrl: result.imageUrl,
      viewUrls: [result.imageUrl],
      meta: { gridCount: 1 },
    }
  }

  // ── 四视图/六视图模式 ──
  const { viewTemplates, weaponNames } = resolveViewTemplates(character)
  const charDesc = cleanCharacterDescription(imagePrompt, character.name)
  const styleTag = styleTokens ? `, ${styleTokens}` : ''
  const addStyle = (p: string) => `${charDesc}, ${p}${styleTag}`

  // ⚠️ 肖像用面部特征描述，不是全家桶 charDesc（含"全身立正"等覆盖性描述）
  const faceOnly = extractFaceDescription(charDesc)
  const portraitPrompt = `${faceOnly}, ${viewTemplates.portrait}${styleTag}`
  const frontPrompt = addStyle(viewTemplates.front)
  const sidePrompt = addStyle(viewTemplates.side)
  const backPrompt = addStyle(viewTemplates.back)

  const hasWeapon = weaponNames.length > 0
  const weaponFrontPrompt = hasWeapon
    ? `${charDesc}, full body shot front view, standing straight, holding ${weaponNames.join(' and ')}, weapon clearly visible, both hands on weapon, head to toe, looking at camera, plain white background, single person${styleTag}`
    : ''
  const weaponSidePrompt = hasWeapon
    ? `${charDesc}, full body shot pure profile right side, standing, holding ${weaponNames.join(' and ')}, weapon clearly visible, both hands on weapon, head to toe, 90 degree right side view, plain white background, single person${styleTag}`
    : ''

  const seed = Math.floor(Math.random() * 2147483647)
  const userRefImage: string | undefined = character.referenceImage

  const baseTraceId = `char_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`

  // ⭐ 大头照 — 永远 Text2Image，禁止传参考图！
  // 图生图时 Seedream 会优先保持参考图构图，导致"extreme close-up portrait"输出全身照
  const portraitNegative = baseNegative + ', full body, full-body, full_length, standing, whole_body, legs, torso, arms, body, half_body, upper_body, below_chest, 全身, 站立, 站姿, 腿部, 躯干, 手臂, 半身, 下半身, 超过胸部, two people, multiple people, group'

  const portraitResult = await executeImageTask(
    { prompt: portraitPrompt, negativePrompt: portraitNegative, projectId: pid, source: 'character_execution', characterName: character.name, seed },
    { projectId: pid, stage: 'character', traceId: `${baseTraceId}_portrait` },
    { baseUrl, authHeader, userId, validators },
  ).catch(() => ({ imageUrl: '', taskId: '', validation: { passed: true, issues: [], score: 1 }, traceId: '' }))

  // ⭐ 正脸 — 用上传参考图
  const frontNegative = baseNegative + ', side view, back view, profile, close up, close-up, headshot, 大头, 特写, three-quarter view, 仰视, 俯视, 坐姿, 蹲, 多人, two person'
  const frontResult = await executeImageTask(
    { prompt: frontPrompt, negativePrompt: frontNegative, projectId: pid, source: 'character_execution', characterName: character.name, seed: seed + 1, referenceImage: userRefImage, referenceImages: userRefImage ? [userRefImage] : undefined },
    { projectId: pid, stage: 'character', traceId: `${baseTraceId}_front` },
    { baseUrl, authHeader, userId, validators },
  ).catch(() => ({ imageUrl: '', taskId: '', validation: { passed: true, issues: [], score: 1 }, traceId: '' }))

  // ⭐ 侧脸 — 用正脸作参考图（保一致性）
  const sideNegative = baseNegative + ', front view, back view, looking at camera, 正面, 正脸, 正面全身, 背面, back of head, three-quarter view, portrait, close up, facing camera'
  const sideResult = frontResult.imageUrl
    ? await executeImageTask(
        { prompt: sidePrompt, negativePrompt: sideNegative, projectId: pid, source: 'character_execution', characterName: character.name, seed: seed + 2, referenceImage: frontResult.imageUrl, referenceImages: [frontResult.imageUrl] },
        { projectId: pid, stage: 'character', traceId: `${baseTraceId}_side` },
        { baseUrl, authHeader, userId, validators },
      ).catch(() => ({ imageUrl: '', taskId: '', validation: { passed: true, issues: [], score: 1 }, traceId: '' }))
    : { imageUrl: '', taskId: '', validation: { passed: true, issues: [], score: 1 }, traceId: '' }

  // ⭐ 背脸 — 纯文生图，不传任何参考图
  const backNegative = baseNegative + ', face, front view, side view, looking at camera, facing viewer, turning head, profile, portrait, close up, headshot, facial features, eyes, nose, mouth, 正面, 面部, 正脸, 脸部, 人脸'
  const backResult = await executeImageTask(
    { prompt: backPrompt, negativePrompt: backNegative, projectId: pid, source: 'character_execution', characterName: character.name, seed: seed + 3 },
    { projectId: pid, stage: 'character', traceId: `${baseTraceId}_back` },
    { baseUrl, authHeader, userId, validators },
  ).catch(() => ({ imageUrl: '', taskId: '', validation: { passed: true, issues: [], score: 1 }, traceId: '' }))

  // ⭐ 持武器（可选）
  let weaponFrontResult: PipelineOutput = { imageUrl: '', taskId: '', validation: { passed: true, issues: [], score: 1 }, traceId: '' }
  let weaponSideResult: PipelineOutput = { imageUrl: '', taskId: '', validation: { passed: true, issues: [], score: 1 }, traceId: '' }

  if (hasWeapon && weaponFrontPrompt) {
    weaponFrontResult = await executeImageTask(
      { prompt: weaponFrontPrompt, negativePrompt: baseNegative, projectId: pid, source: 'character_execution', characterName: character.name, seed, referenceImage: userRefImage || frontResult.imageUrl, referenceImages: [userRefImage || frontResult.imageUrl] },
      { projectId: pid, stage: 'character', traceId: `${baseTraceId}_weapon_front` },
      { baseUrl, authHeader, userId, validators },
    ).catch(() => ({ imageUrl: '', taskId: '', validation: { passed: true, issues: [], score: 1 }, traceId: '' }))
  }
  if (hasWeapon && weaponSidePrompt) {
    weaponSideResult = await executeImageTask(
      { prompt: weaponSidePrompt, negativePrompt: baseNegative, projectId: pid, source: 'character_execution', characterName: character.name, seed, referenceImage: userRefImage || frontResult.imageUrl, referenceImages: [userRefImage || frontResult.imageUrl] },
      { projectId: pid, stage: 'character', traceId: `${baseTraceId}_weapon_side` },
      { baseUrl, authHeader, userId, validators },
    ).catch(() => ({ imageUrl: '', taskId: '', validation: { passed: true, issues: [], score: 1 }, traceId: '' }))
  }

  // ── 合并定妆图 ──
  const { generateDynamicViewCharacterSheet } = await import('../four-view-merger.js')
  const merged = await generateDynamicViewCharacterSheet({
    portraitImageUrl: portraitResult.imageUrl || frontResult.imageUrl,
    frontImageUrl: frontResult.imageUrl,
    sideImageUrl: sideResult.imageUrl,
    backImageUrl: backResult.imageUrl,
    weaponFrontUrl: weaponFrontResult.imageUrl || undefined,
    weaponSideUrl: weaponSideResult.imageUrl || undefined,
    characterName: character.name,
  })

  // ⭐ 合并图上传 COS
  const fs = await import('fs/promises')
  const { resolve } = await import('path')
  const { existsSync, readFileSync } = await import('fs')
  const { cosService } = await import('../cos-service.js')

  let finalMergedUrl = merged.mergedImageUrl
  let finalFaceCropUrl = merged.faceCropUrl || ''
  const cwdPath = resolve(process.cwd(), 'public', finalMergedUrl.replace(/^\//, ''))
  const backendPath = resolve(__dirname, '../../public', finalMergedUrl.replace(/^\//, ''))
  const mergeLocalPath = existsSync(cwdPath) ? cwdPath : (existsSync(backendPath) ? backendPath : null)
  if (mergeLocalPath) {
    const mergeBuf = readFileSync(mergeLocalPath)
    const cosResult = await cosService.uploadBuffer(mergeBuf, 'merged_view.jpg', userId)
    if (cosResult.cosUrl) finalMergedUrl = cosResult.cosUrl
  }
  if (finalFaceCropUrl && finalFaceCropUrl.startsWith('/uploads/')) {
    const faceCwd = resolve(process.cwd(), 'public', finalFaceCropUrl.replace(/^\//, ''))
    const faceBack = resolve(__dirname, '../../public', finalFaceCropUrl.replace(/^\//, ''))
    const faceLocal = existsSync(faceCwd) ? faceCwd : (existsSync(faceBack) ? faceBack : null)
    if (faceLocal) {
      const faceBuf = readFileSync(faceLocal)
      const faceCosResult = await cosService.uploadBuffer(faceBuf, 'face_ref.png', userId)
      if (faceCosResult.cosUrl) finalFaceCropUrl = faceCosResult.cosUrl
    }
  }

  // 收集视图 URLs
  const viewUrls = [
    portraitResult.imageUrl,
    frontResult.imageUrl,
    sideResult.imageUrl,
    backResult.imageUrl,
    weaponFrontResult.imageUrl,
    weaponSideResult.imageUrl,
  ].filter(Boolean)

  let finalImageUrl = finalMergedUrl
  if (viewUrls.length < 2) {
    // 回退到单张
    finalImageUrl = viewUrls[0] || finalMergedUrl
  }

  return {
    imageUrl: finalImageUrl,
    viewUrls,
    meta: {
      portraitUrl: portraitResult.imageUrl,
      frontUrl: frontResult.imageUrl,
      sideUrl: sideResult.imageUrl,
      backUrl: backResult.imageUrl,
      weaponFrontUrl: weaponFrontResult.imageUrl,
      weaponSideUrl: weaponSideResult.imageUrl,
      faceCropUrl: finalFaceCropUrl,
      gridCount: hasWeapon ? 6 : 4,
    },
  }
}

// ─── 辅助函数 ──────────────────────────────────────────

function buildNegative(prompt: string, styleNegative: string): string {
  return (prompt + '\n' + styleNegative + ', 多人, 人群, 两人以上, 多人群组, 肢体变形, 多出的手臂, 多出的腿, 多出的手指, 多格画面, 网格图, 拼贴图, 多视角, 对比图, 多图, 九宫格, 拼图, 对比图, 网格, 文字, 书写, 字母, 字词, 字符, 标签, 标题, 签名, 标志, 印章, 水印, 排版文字').trim()
}

function forceCharacterPrompt(prompt: string): string {
  let result = prompt
  if (!result.includes('纯白') && !result.includes('纯白色') && !result.includes('白色背景')) result += '，纯白色背景'
  if (!result.includes('全身') && !result.includes('完整全身')) result += '，完整全身正面立正站姿，面对镜头，双脚并拢，双臂自然垂于两侧'
  if (!result.includes('从头到脚') && !result.includes('双脚')) result += '，从头到脚完全可见'
  return result
}

function resolveViewTemplates(character: any): { viewTemplates: Record<string, string>; weaponNames: string[] } {
  const viewTemplates: Record<string, string> = {
    portrait: 'extreme close-up portrait, face only, headshot from shoulders up, passport photo style, head centered filling 90 percent of frame, detailed facial features, looking at viewer, plain white background, soft uniform lighting, natural expression, no body visible, no torso, no arms, no legs, crop at chest level',
    front: 'full body shot front view, standing straight, facing camera directly, head to toe completely visible, both feet together on ground, arms at sides, plain white background, soft uniform lighting, single person, no side view, no back view, no three-quarter view',
    side: 'full body shot pure profile, standing, right side view 90 degrees, body rotated completely to the right, facing right edge of frame, head to toe visible, plain white background, soft uniform lighting, single person, no front view, no back view, no face visible',
    back: 'full body shot from behind, back view only, model standing with back facing camera, completely facing away, only back of head and back of body visible, absolutely no face visible, no facial features, no turning head, head to toe fully visible, plain white background, soft uniform lighting, single person, no front view, no side view, no profile',
  }

  // 前端自定义 prompt 最高优先级
  const frontendViewPrompts: Record<string, string> | undefined = character.fourViewPrompts
  if (frontendViewPrompts) {
    if (frontendViewPrompts.portrait) viewTemplates.portrait = frontendViewPrompts.portrait
    if (frontendViewPrompts.front) viewTemplates.front = frontendViewPrompts.front
    if (frontendViewPrompts.side) viewTemplates.side = frontendViewPrompts.side
    if (frontendViewPrompts.back) viewTemplates.back = frontendViewPrompts.back
  }

  const weaponNames: string[] = character.weaponNames || []
  return { viewTemplates, weaponNames }
}

function cleanCharacterDescription(prompt: string, charName: string): string {
  let desc = (prompt || charName || '').trim()
  if (charName) {
    desc = desc.replace(new RegExp(`角色名[「『]${charName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}[」』]`, 'g'), '')
    desc = desc.replace(new RegExp(`[「『]${charName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}[」』]`, 'g'), '')
    desc = desc.replace(new RegExp(`\\b${charName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'g'), '')
    desc = desc.replace(/\s*角色名[:：]\s*/g, '').trim()
  }
  return desc
}

/**
 * 从 charDesc 提取面部相关描述（去掉"全身站姿"等 body 描述）
 */
function extractFaceDescription(desc: string): string {
  if (desc.length < 40) return desc
  const keepPatterns = [
    /年龄\s*:?\s*\d+[^。\n]*/,
    /面[部容孔][^。\n]*/,
    /[发头][^。\n]*/,
    /五[官][^。\n]*/,
    /眼[睛神眸][^。\n]*/,
    /眉[毛目宇][^。\n]*/,
    /鼻[梁子][^。\n]*/,
    /嘴[唇巴角][^。\n]*/,
    /气[质场息][^。\n]*/,
    /表[情][^。\n]*/,
    /神[态色情][^。\n]*/,
    /脸[型蛋形][^。\n]*/,
    /皮[肤][^。\n]*/,
    /肤[色质][^。\n]*/,
    /[刘海][^。\n]*/,
    /[辫髻][^。\n]*/,
    /鬓[角][^。\n]*/,
    /轮[廓][^。\n]*/,
    /下[巴颌][^。\n]*/,
  ]
  const kept: string[] = []
  for (const p of keepPatterns) {
    const m = desc.match(p)
    if (m) kept.push(m[0].trim())
  }
  if (kept.length === 0) {
    const first = desc.split(/[。\n]/)[0]
    return first ? first.trim() : desc
  }
  return [...new Set(kept)].join('，').slice(0, 300)
}
