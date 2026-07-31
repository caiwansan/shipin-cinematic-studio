// ─── Storyboard Display Adapter ────────────────────────────────────────────
// Sprint-ShortDrama-01.9.2 — Storyboard Reality Bridge Fix
// 职责：统一分镜展示数据来源，前端不需要推测 DB 字段
//
// 优先级链：
//   AiVideoSegment > AiSceneSpec > StoryboardImage > empty warning
// ────────────────────────────────────────────────────────────────────────────

import { prisma } from '../../utils/index.js'

export type DisplaySource =
  | 'AiVideoSegment'
  | 'AiSceneSpec'
  | 'StoryboardImage'
  | 'empty'

export interface StoryboardDisplaySegment {
  id: string
  segmentId: string
  title: string
  /** 画面描述 — 唯一 SSOT，前端只需读取它 */
  visualDescription: string
  characters: string[]
  location?: string
  shotPattern?: string
  emotion?: string
  /** 数据来源标识，用于调试和审计 */
  source: DisplaySource
  /** 原始数据，给前端按需使用 */
  raw: Record<string, unknown>
}

/**
 * 从项目加载分镜展示数据，按优先级链填充
 *
 * @param projectId 项目 UUID
 * @returns 分镜展示段列表
 */
export async function loadStoryboardDisplay(
  projectId: string
): Promise<StoryboardDisplaySegment[]> {
  // ── 1. 优先：AiVideoSegment ──
  const segments = await prisma.aiVideoSegment.findMany({
    where: { projectId },
    orderBy: { sortOrder: 'asc' },
  })

  if (segments.length > 0) {
    return segments.map((s) => {
      const desc = buildDescriptionFromSegment(s)
      return {
        id: s.id,
        segmentId: s.segmentId,
        title: s.title || s.segmentId,
        visualDescription: desc,
        characters: [], // AiVideoSegment 不直接关联角色
        location: undefined,
        shotPattern: s.shotPattern || undefined,
        emotion: s.emotionArc || undefined,
        source: 'AiVideoSegment',
        raw: s as unknown as Record<string, unknown>,
      }
    })
  }

  // ── 2. 次优先：AiSceneSpec → 虚拟段 ──
  const scenes = await prisma.aiSceneSpec.findMany({
    where: { projectId },
    orderBy: { sortOrder: 'asc' },
  })

  if (scenes.length > 0) {
    return scenes.map((s) => ({
      id: s.id,
      segmentId: s.sceneId,
      title: s.sceneName,
      visualDescription:
        s.description || s.imagePrompt || emptyWarning('scene'),
      characters: [],
      location: s.environment || undefined,
      shotPattern: undefined,
      emotion: s.mood || undefined,
      source: 'AiSceneSpec' as DisplaySource,
      raw: s as unknown as Record<string, unknown>,
    }))
  }

  // ── 3. 再优先：StoryboardImage → 虚拟段 ──
  const images = await prisma.storyboardImage.findMany({
    where: { projectId },
    orderBy: { sortOrder: 'asc' },
  })

  if (images.length > 0) {
    return images.map((img) => ({
      id: img.id,
      segmentId: img.segmentId,
      title: img.segmentId,
      visualDescription:
        img.description || emptyWarning('storyboard'),
      characters: [],
      location: undefined,
      shotPattern: undefined,
      emotion: undefined,
      source: 'StoryboardImage' as DisplaySource,
      raw: img as unknown as Record<string, unknown>,
    }))
  }

  // ── 4. 空项目 ──
  return []
}

/**
 * 异步加载并去重合并角色名（所有数据源共用）
 */
export async function loadProjectCharacters(
  projectId: string
): Promise<string[]> {
  const chars = await prisma.aiCharacterSpec.findMany({
    where: { projectId },
    select: { characterName: true },
    orderBy: { sortOrder: 'asc' },
  })
  return chars.map((c) => c.characterName)
}

// ─── 内部工具 ─────────────────────────────────────────────────────────────

/** 从 AiVideoSegment 构建画面描述文本 */
function buildDescriptionFromSegment(
  s: {
    fullText?: string | null
    narrative?: string | null
    shotPattern?: string | null
    emotionArc?: string | null
    dialogue?: string | null
  }
): string {
  // 优先 fullText——这是最完整的画面描述
  if (s.fullText) return s.fullText
  if (s.narrative) return s.narrative

  // 拼接 fallback
  const parts: string[] = []
  if (s.shotPattern) parts.push(`拍摄：${s.shotPattern}`)
  if (s.emotionArc) parts.push(`情绪：${s.emotionArc}`)
  return parts.length > 0 ? parts.join('，') : emptyWarning('segment')
}

/** 空值产品化提示文案 */
function emptyWarning(type: 'segment' | 'scene' | 'storyboard'): string {
  switch (type) {
    case 'segment':
      return '⚠️ 分镜描述待完善'
    case 'scene':
      return '⚠️ 场景描述待完善'
    case 'storyboard':
      return '⚠️ 分镜描述待完善'
  }
}

/**
 * 空项目页面提示（供 route 使用）
 */
export function getEmptyProjectWarning(): string {
  return '⚠️ 尚未生成分镜数据，请先完成剧本分析'
}
