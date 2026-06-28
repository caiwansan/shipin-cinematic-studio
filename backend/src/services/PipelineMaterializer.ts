/**
 * PipelineMaterializer.ts — Narrative Constitution V3 → PipelineStage 桥接层
 *
 * ═══════════════════════════════════════════════════════════════
 * 宪法级别约定：
 *   P0 — 幂等（所有写操作为 UPSERT）
 *   P0 — PipelineVersion（每次 materialize 递增 Project.pipelineVersion）
 *   P0 — StageStatus 语义（script-analysis=completed，其余=ready）
 *   P1 — PipelineHash（内容 SHA256，用于缓存跳过）
 *   P1 — 不在 outputData 存 executionResults 副本
 *   P2 — PipelineStage 为唯一 Runtime Truth
 * ═══════════════════════════════════════════════════════════════
 *
 * 调用链：
 *   POST /api/v1/script-breakdown/:id/submit
 *   → NarrativeGateway.execute()                // LLM 调用
 *   → PipelineMaterializer.materialize()        // ← 此处
 *   → 前端九张流程卡片自动点亮
 *
 * @phase4-owner
 * @v1 2026-06-26
 */

import { prisma } from '../utils/index.js'
import { createHash } from 'crypto'
import type { NarrativeConstitutionV3 } from '../agents/narrative-schema-v3.js'

// ============================================================
// Constants
// ============================================================

const RUNTIME_VERSION = '0.5'

const STAGE_KEYS = [
  'script-analysis',
  'character',
  'scene',
  'storyboard',
  'voice',
  'video-generation',
  'music-generation',
  'final-render',
] as const

type StageKey = typeof STAGE_KEYS[number]

/**
 * materialize 之后，所有下游 stage 标记为 ready（等待 Agent 执行），
 * 只有 script-analysis 标记为 completed（已由 ScriptBreakdownMaster 完成）。
 */
const EXECUTION_STAGES: Record<StageKey, 'completed' | 'ready'> = {
  'script-analysis': 'completed',
  'character': 'ready',
  'scene': 'ready',
  'storyboard': 'ready',
  'voice': 'ready',
  'video-generation': 'ready',
  'music-generation': 'ready',
  'final-render': 'ready',
}

// ============================================================
// Output Schema 定义（稳定结构，供前端/Agent 读取）
// ============================================================

interface ScriptAnalysisOutput {
  pipelineVersion: number
  pipelineHash: string
  title: string
  summary: string
  storyArc: {
    setup: string
    conflict: string
    climax: string
    resolution: string
  }
  sceneCount: number
  segmentCount: number
  characterCount: number
  totalDuration: number
}

interface CharacterOutput {
  characters: Array<{
    id: string
    name: string
    alias: string
    age: string
    appearance: string
    personality: string[]
    voiceGuide: string
  }>
}

interface SceneOutput {
  scenes: Array<{
    id: string
    name: string
    location: string
    environment: {
      location: string
      lighting: string
      atmosphere: string
      colorPalette: string
    }
  }>
  segmentCount: number
}

interface StoryboardOutput {
  segments: Array<{
    id: string
    sceneId: string
    segmentNumber: number
    duration: number
    camera: { shot: string; movement: string; angle: string; lens: string }
    environment: { location: string; lighting: string; atmosphere: string }
    characters: Array<{ characterId: string; role: 'primary' | 'secondary' | 'background'; emotion: string; focus: number }>
    action: { primary: string }
    emotion: { type: string; intensity: number }
    visualDesc: string
    dialogue?: string
  }>
  totalSegments: number
  totalDuration: number
}

interface VoiceOutput {
  voices: Array<{
    characterId: string
    voiceType: string
    timbre: string
    speed: string
    speakingStyle: string
  }>
}

interface VideoGenerationOutput {
  segmentConfigs: Array<{
    segmentId: string
    sceneId: string
    duration: number
    camera: string
    environment: string
    characters: string[]
  }>
  totalSegments: number
  totalDuration: number
}

interface MusicGenerationOutput {
  soundDesign: Array<{ segmentId: string; ambient: string; music: string; effect: string }>
  effectsDesign: Array<{ segmentId: string; visualEffect: string; transition: string }>
}

interface FinalRenderOutput {
  pipelineVersion: number
  pipelineHash: string
  title: string
  totalSegments: number
  totalDuration: number
  hasStoryboard: boolean
  hasVoice: boolean
  hasVideo: boolean
  ready: boolean
}

// ============================================================
// PipelineMaterializer
// ============================================================

export class PipelineMaterializer {
  /**
   * 幂等地将 NarrativeConstitutionV3 分配到九大 PipelineStage。
   *
   * 幂等性保证：
   *   - 使用 Prisma upsert（唯一键: projectId + stageKey）
   *   - 重复调用仅覆盖 outputData/status/version，不产生重复行
   *   - Project.pipelineVersion += 1（精准区分不同版本）
   *
   * @param projectId - 项目 ID（必填，UUID）
   * @param narrative - ScriptBreakdownMaster 产出的 V3 叙事方案
   * @returns materialize 结果
   */
  async materialize(
    projectId: string,
    narrative: NarrativeConstitutionV3,
  ): Promise<{
    success: boolean
    pipelineVersion: number
    pipelineHash: string
    stages: Record<string, string>
    errors: string[]
  }> {
    const errors: string[] = []
    const stageStatuses: Record<string, string> = {}

    // ─── 1. 计算 PipelineHash ───────────────────────────────
    const pipelineHash = computePipelineHash(narrative)

    // ─── 2. 获取并递增 PipelineVersion ──────────────────────
    const project = await prisma.project.findUnique({
      where: { id: projectId },
      select: { version: true },
    })
    const currentVersion = (project?.version || 0) + 1
    const pipelineVersion = currentVersion

    // ─── 3. 预计算 ──────────────────────────────────────────
    const totalDuration = narrative.segments?.reduce((sum, s) => sum + (s.duration || 0), 0) || 0

    // ─── 4. 批量写入九个 Stage（幂等 UPSERT） ──────────────
    const now = new Date()
    const writeOps = STAGE_KEYS.map((stageKey) => {
      const outputData = buildStageOutput(stageKey, narrative, { pipelineVersion, pipelineHash, totalDuration })
      const targetStatus = EXECUTION_STAGES[stageKey]
      return prisma.pipelineStage.upsert({
        where: {
          projectId_stageKey: { projectId, stageKey },
        },
        create: {
          projectId,
          stageKey,
          status: targetStatus,
          inputData: {},
          outputData: outputData as any,
          runtimeVersion: RUNTIME_VERSION,
          startedAt: now,
          completedAt: stageKey === 'script-analysis' ? now : undefined,
        },
        update: {
          status: targetStatus,
          outputData: outputData as any,
          runtimeVersion: RUNTIME_VERSION,
          completedAt: stageKey === 'script-analysis' ? now : undefined,
        },
      }).then(() => {
        stageStatuses[stageKey] = targetStatus
      }).catch((e: any) => {
        errors.push(`${stageKey}: ${e.message}`)
        stageStatuses[stageKey] = 'failed'
      })
    })

    await Promise.all(writeOps)

    // ─── 5. 回写 Project.pipelineVersion ────────────────────
    try {
      await prisma.project.update({
        where: { id: projectId },
        data: { version: pipelineVersion },
      })
    } catch (e: any) {
      errors.push(`project.version update: ${e.message}`)
    }

    return {
      success: errors.length === 0,
      pipelineVersion,
      pipelineHash,
      stages: stageStatuses,
      errors,
    }
  }
}

// ============================================================
// Stage Output Builder
// ============================================================

function buildStageOutput(
  stageKey: StageKey,
  narrative: NarrativeConstitutionV3,
  meta: { pipelineVersion: number; pipelineHash: string; totalDuration: number },
): Record<string, any> {
  switch (stageKey) {
    case 'script-analysis': {
      return {
        pipelineVersion: meta.pipelineVersion,
        pipelineHash: meta.pipelineHash,
        title: narrative.title,
        summary: narrative.storyArc?.setup || '',
        storyArc: narrative.storyArc,
        sceneCount: narrative.scenes?.length || 0,
        segmentCount: narrative.segments?.length || 0,
        characterCount: narrative.characters?.length || 0,
        totalDuration: meta.totalDuration,
      } satisfies ScriptAnalysisOutput
    }

    case 'character': {
      return {
        characters: (narrative.characters || []).map(c => ({
          id: c.id,
          name: c.name,
          alias: c.alias,
          age: c.age,
          appearance: c.appearance,
          personality: c.personality,
          voiceGuide: c.voiceGuide,
        })),
      } satisfies CharacterOutput
    }

    case 'scene': {
      return {
        scenes: (narrative.scenes || []).map(s => ({
          id: s.id,
          name: s.name,
          location: s.location,
          environment: {
            location: s.environment?.location || s.location,
            lighting: s.environment?.lighting || '',
            atmosphere: s.environment?.atmosphere || '',
            colorPalette: s.environment?.colorPalette || '',
          },
        })),
        segmentCount: narrative.segments?.length || 0,
      } satisfies SceneOutput
    }

    case 'storyboard': {
      return {
        segments: (narrative.segments || []).map(seg => ({
          id: seg.id,
          sceneId: seg.sceneId,
          segmentNumber: seg.segmentNumber,
          duration: seg.duration,
          camera: {
            shot: seg.camera?.shot || '',
            movement: seg.camera?.movement || '',
            angle: seg.camera?.angle || '',
            lens: seg.camera?.lens || '',
          },
          environment: {
            location: seg.environment?.location || '',
            lighting: seg.environment?.lighting || '',
            atmosphere: seg.environment?.atmosphere || '',
          },
          characters: (seg.characters || []).map(cp => ({
            characterId: cp.characterId,
            role: cp.role,
            emotion: cp.emotion,
            focus: cp.focus,
          })),
          action: { primary: seg.action?.primary || '' },
          emotion: { type: seg.emotion?.type || '', intensity: seg.emotion?.intensity || 0 },
          visualDesc: seg.visualDesc || '',
          dialogue: seg.dialogue,
        })),
        totalSegments: narrative.segments?.length || 0,
        totalDuration: meta.totalDuration,
      } satisfies StoryboardOutput
    }

    case 'voice': {
      return {
        voices: (narrative.voices || []).map(v => ({
          characterId: v.characterId,
          voiceType: v.voiceType,
          timbre: v.timbre,
          speed: v.speed,
          speakingStyle: v.speakingStyle,
        })),
      } satisfies VoiceOutput
    }

    case 'video-generation': {
      const charMap: Record<string, string> = {}
      for (const c of narrative.characters || []) charMap[c.id] = c.name
      return {
        segmentConfigs: (narrative.segments || []).map(seg => ({
          segmentId: seg.id,
          sceneId: seg.sceneId,
          duration: seg.duration,
          camera: `${seg.camera?.shot || ''} ${seg.camera?.movement || ''}`.trim(),
          environment: seg.environment?.location || '',
          characters: (seg.characters || []).map(cp => charMap[cp.characterId] || cp.characterId),
        })),
        totalSegments: narrative.segments?.length || 0,
        totalDuration: meta.totalDuration,
      } satisfies VideoGenerationOutput
    }

    case 'music-generation': {
      return {
        soundDesign: (narrative.soundDesign || []).map(sd => ({
          segmentId: sd.segmentId,
          ambient: sd.ambient,
          music: sd.music,
          effect: sd.effect,
        })),
        effectsDesign: (narrative.effectsDesign || []).map(ed => ({
          segmentId: ed.segmentId,
          visualEffect: ed.visualEffect,
          transition: ed.transition,
        })),
      } satisfies MusicGenerationOutput
    }

    case 'final-render': {
      const hasStoryboard = (narrative.segments?.length || 0) > 0
      const hasVoice = (narrative.voices?.length || 0) > 0
      return {
        pipelineVersion: meta.pipelineVersion,
        pipelineHash: meta.pipelineHash,
        title: narrative.title,
        totalSegments: narrative.segments?.length || 0,
        totalDuration: meta.totalDuration,
        hasStoryboard,
        hasVoice,
        hasVideo: hasStoryboard,
        ready: hasStoryboard && hasVoice,
      } satisfies FinalRenderOutput
    }
  }
}

// ============================================================
// PipelineHash — 内容摘要用于缓存跳过
// ============================================================

function computePipelineHash(narrative: NarrativeConstitutionV3): string {
  const input = [
    JSON.stringify(narrative.characters || []),
    JSON.stringify(narrative.scenes || []),
    JSON.stringify(narrative.segments || []),
    JSON.stringify(narrative.voices || []),
    JSON.stringify(narrative.props || []),
    JSON.stringify(narrative.soundDesign || []),
    JSON.stringify(narrative.effectsDesign || []),
  ].join('|')
  return createHash('sha256').update(input).digest('hex').substring(0, 16)
}

// ============================================================
// Singleton
// ============================================================

export const pipelineMaterializer = new PipelineMaterializer()
