// ============================================================
// compileIR — Director-V2 Canonical Narrative IR Generator
// Phase 1: 从用户输入生成 NarrativeIR（唯一语义输出）
//
// 铁律：
// 1. 输出的 NarrativeIR 不存任何"结果"（prompt/image/video）
// 2. Beat 是唯一时间轴
// 3. Intent Graph 驱动一切跳转
// ============================================================

import { v4 as uuid } from 'uuid'
import type {
  NarrativeIR,
  IRScene,
  IRSegment,
  IRBeat,
  IRCharacter,
  IRCharacterState,
  IRIntentNode,
  IRCausalEdge,
  IRGraph,
  CameraIntent,
  NarrativeFunction,
} from '../../types/narrative/ir/NarrativeIR.js'

import { narrativeGateway } from '../../runtime/narrative-gateway.js'

// ─── 时间常量 ─────────────────────────────────────────
const BEAT_INTERVAL_MS = 2000        // 每 Beat 2 秒
const MIN_BEATS_PER_SEGMENT = 3

// ─── Component 类型 ───────────────────────────────────
export interface CompileIRInput {
  script: string
  projectId: string
  title?: string
}

export interface CompileIROutput {
  narrativeIR: NarrativeIR
  trace: {
    stages: string[]
    characterCount: number
    sceneCount: number
    segmentCount: number
    beatCount: number
    intentNodeCount: number
    generatedAt: number
  }
}

// ─── LLM Prompt Helper ───────────────────────────────

/** 从 DB 读取剧情总指挥 prompt，否则用兜底 prompt */
async function getSupervisorPrompt(): Promise<string> {
  const { getPrompt } = await import('../../runtime/prompt/PromptRegistry.js')
  return getPrompt('plot-supervisor')
}

// ─── IR Builder ───────────────────────────────────────

/**
 * 从 LLM 输出的分析数据构建 NarrativeIR
 * 这是纯确定性函数（不调 LLM）
 */
function buildIRFromAnalysis(
  irId: string,
  projectId: string,
  script: string,
  analysis: any,
  globalTone: string,
): NarrativeIR {
  const scenes: IRScene[] = []
  const characters: IRCharacter[] = []
  const segments: IRSegment[] = []
  const intentNodes: IRIntentNode[] = []
  const edges: IRCausalEdge[] = []
  const entryPoints: string[] = []
  const exitPoints: string[] = []

  // 1. 构建角色
  const roleList = analysis['人物角色设计'] || analysis.roleList || []
  for (const r of roleList) {
    const charId = `char-${r.roleName || r.roleName || 'unknown'}-${uuid().slice(0, 8)}`
    characters.push({
      id: charId,
      name: r.roleName || r.characterName || '未命名角色',
      state: {
        emotion: r.emotion || 'neutral',
        objective: r.objective || r.roleType || '',
        tensionLevel: 0.3,
      },
    })
  }

  // 2. 构建场景
  const sceneList = analysis['剧中场景图设计'] || analysis.sceneList || []
  for (let i = 0; i < sceneList.length; i++) {
    const s = sceneList[i]
    scenes.push({
      id: `scene-${i}`,
      order: i,
      location: s.sceneName || s.sceneName || `场景${i + 1}`,
      purpose: s.purpose || s.mood || s.description || `scene-${i}-purpose`,
    })
  }
  // fallback：如果 LLM 没返回场景，创建默认
  if (scenes.length === 0) {
    scenes.push({
      id: 'scene-0',
      order: 0,
      location: 'main-stage',
      purpose: 'narrative-stage',
    })
  }

  // 3. 从分镜数据构建 segments + beats
  const segmentList = analysis['剧情分镜图分析'] || analysis.segmentList || analysis.videoSegments || []
  let beatGlobalTime = 0
  let segmentIdx = 0

  for (const seg of segmentList) {
    // 计算 beats 数量（基于 duration，至少 MIN_BEATS）
    const durationMs = (seg.duration || 5) * 1000
    const beatCount = Math.max(MIN_BEATS_PER_SEGMENT, Math.ceil(durationMs / BEAT_INTERVAL_MS))

    // 确定场景归属
    const sceneMatch = scenes.find(s => s.location === seg.scene)
    const sceneId = sceneMatch?.id || scenes[0]?.id || 'scene-0'

    // 确定叙事功能
    const narrativeFunction = inferNarrativeFunction(segmentIdx, segmentList.length, seg.description || seg.narrativePurpose || '')

    // 确定该段的角色参与
    const segmentCharacters: string[] = []
    if (seg.characters) {
      const charNames = Array.isArray(seg.characters) ? seg.characters : [seg.characters]
      for (const cn of charNames) {
        const match = characters.find(c => c.name === cn)
        if (match) segmentCharacters.push(match.id)
      }
    }

    // 构建 beats
    const beats: IRBeat[] = []
    for (let b = 0; b < beatCount; b++) {
      const beatT = beatGlobalTime + b * BEAT_INTERVAL_MS
      const progression = b / beatCount  // 0~1 在该段内的进度
      beats.push({
        t: beatT,
        action: seg.description || seg.narrativePurpose || `segment-${segmentIdx}-action`,
        emotion: inferEmotion(seg.emotionArc || '', progression),
        visualHint: seg.shotPattern || seg.description || '',
        cameraIntent: inferCameraIntent(seg.shotPattern || '', progression),
      })
    }

    // 构建 intent nodes（段间因果链）
    if (segmentIdx > 0) {
      const intentId = `intent-${segmentIdx}`
      intentNodes.push({
        id: intentId,
        type: segmentIdx === segmentList.length - 1 ? 'revelation' : 'conflict',
        sourceBeatId: `seg-${segmentIdx-1}-beat-${MIN_BEATS_PER_SEGMENT - 1}`,
        targetBeatId: `seg-${segmentIdx}-beat-0`,
        weight: 0.7 + (segmentIdx / segmentList.length) * 0.3,
        polarity: 1,
      })
      edges.push({
        sourceId: `seg-${segmentIdx-1}`,
        targetId: `seg-${segmentIdx}`,
        intentId,
      })
    }

    segments.push({
      id: `seg-${segmentIdx}`,
      sceneId,
      narrativeFunction,
      beats,
    })

    beatGlobalTime += beatCount * BEAT_INTERVAL_MS
    segmentIdx++
  }

  // fallback：如果 LLM 没返回分镜数据，创建默认 segment
  if (segments.length === 0) {
    const beats: IRBeat[] = []
    for (let b = 0; b < 5; b++) {
      beats.push({
        t: b * BEAT_INTERVAL_MS,
        action: 'narrative-progression',
        emotion: 'neutral',
        visualHint: 'default-scene',
        cameraIntent: 'steady-contemplation',
      })
    }
    segments.push({
      id: 'seg-0',
      sceneId: scenes[0].id,
      narrativeFunction: 'setup',
      beats,
    })
  }

  // 标记 entry / exit points
  if (segments.length > 0 && segments[0].beats.length > 0) {
    entryPoints.push(segments[0].beats[0].t.toString())
  }
  const lastSeg = segments[segments.length - 1]
  if (lastSeg && lastSeg.beats.length > 0) {
    exitPoints.push(lastSeg.beats[lastSeg.beats.length - 1].t.toString())
  }

  const graph: IRGraph = {
    nodes: intentNodes,
    edges,
    entryPoints,
    exitPoints,
  }

  return {
    id: irId,
    projectId,
    version: 'v1',
    scenes,
    characters,
    segments,
    graph,
    globalTone,
    createdAt: Date.now(),
  }
}

// ─── 启发式推断辅助函数 ───────────────────────────

const NARRATIVE_FUNCTIONS: NarrativeFunction[] = [
  'setup', 'rising-tension', 'climax-building', 'climax',
  'falling-action', 'resolution', 'transition',
]

function inferNarrativeFunction(idx: number, total: number, _desc: string): NarrativeFunction {
  const progress = total > 1 ? idx / (total - 1) : 0.5
  const fnIdx = Math.min(
    NARRATIVE_FUNCTIONS.length - 1,
    Math.floor(progress * NARRATIVE_FUNCTIONS.length),
  )
  return NARRATIVE_FUNCTIONS[fnIdx]
}

function inferEmotion(emotionArc: string, progression: number): string {
  if (emotionArc) return emotionArc
  if (progression < 0.3) return 'calm'
  if (progression < 0.7) return 'rising-tension'
  return 'climax'
}

const CAMERA_INTENTS: CameraIntent[] = [
  'wide-establishing',
  'slow-push-in',
  'over-the-shoulder',
  'close-up-reveal',
  'tracking-follow',
  'handheld-instability',
  'dutch-angle-instability',
  'rapid-cut-action',
  'steady-contemplation',
  'aerial-establishing',
]

function inferCameraIntent(shotPattern: string | undefined, progression: number): CameraIntent {
  // 从 shotPattern 推断
  if (shotPattern) {
    const sp = shotPattern.toLowerCase()
    if (sp.includes('wide') || sp.includes('全景') || sp.includes('远')) return 'wide-establishing'
    if (sp.includes('close') || sp.includes('特写') || sp.includes('近')) return 'close-up-reveal'
    if (sp.includes('push') || sp.includes('推')) return 'slow-push-in'
    if (sp.includes('hand') || sp.includes('手持')) return 'handheld-instability'
    if (sp.includes('dutch') || sp.includes('斜')) return 'dutch-angle-instability'
    if (sp.includes('track') || sp.includes('跟')) return 'tracking-follow'
    if (sp.includes('over') || sp.includes('过肩')) return 'over-the-shoulder'
    if (sp.includes('action') || sp.includes('动作') || sp.includes('快')) return 'rapid-cut-action'
  }
  // fallback：基于叙事进度
  if (progression < 0.2) return 'wide-establishing'
  if (progression < 0.4) return 'slow-push-in'
  if (progression < 0.6) return 'over-the-shoulder'
  if (progression < 0.8) return 'handheld-instability'
  return 'close-up-reveal'
}

// ─── 主入口 ──────────────────────────────────────

/**
 * compileIR: 从用户输入的剧本生成 NarrativeIR
 *
 * 流程：
 * 1. 调 LLM（剧情总指挥 prompt）分析剧本
 * 2. 结构化输出 → IR Builder（纯确定性）
 * 3. 返回 NarrativeIR（不存储到 DB，由调用方决定持久化）
 */
export async function compileIR(input: CompileIRInput): Promise<CompileIROutput> {
  const irId = uuid()

  // Step 1: 获取 prompt
  const supervisorPrompt = await getSupervisorPrompt()

  // Step 2: 调 LLM 分析剧本
  let analysis: any = {}
  let globalTone = 'neutral'

  try {
    const llmResult = await narrativeGateway.execute({
      systemPrompt: supervisorPrompt,
      userMessage: `【剧本名称】\n${input.title || input.projectId}\n\n【剧本全文】\n${input.script.slice(0, 6000)}`,
      userId: 'director-v2-ir-compiler',
      timeoutTier: 'batch' as any,
      maxTokens: 8192,
    })

    const raw = llmResult.content.trim()
    // 提取 JSON
    let jsonText = raw
    const codeBlockMatch = raw.match(/```(?:json)?\s*([\s\S]*?)\s*```/)
    if (codeBlockMatch) {
      jsonText = codeBlockMatch[1].trim()
    }
    const firstBrace = jsonText.indexOf('{')
    const lastBrace = jsonText.lastIndexOf('}')
    if (firstBrace >= 0 && lastBrace > firstBrace) {
      jsonText = jsonText.slice(firstBrace, lastBrace + 1)
    }
    const parsed = JSON.parse(jsonText)
    analysis = parsed.plotBlueprint || parsed

    // 提取全局调性
    if (analysis.plotBlueprint?.tone) {
      globalTone = analysis.plotBlueprint.tone
    }
  } catch (err: any) {
    console.warn(`[compileIR] LLM analysis failed, using fallback: ${err.message}`)
    // LLM 失败时生成最小 IR
  }

  // Step 3: 确定性构建 IR
  const narrativeIR = buildIRFromAnalysis(
    irId,
    input.projectId,
    input.script,
    analysis,
    globalTone,
  )

  // Step 4: Trace
  const beatCount = narrativeIR.segments.reduce((sum, seg) => sum + seg.beats.length, 0)

  return {
    narrativeIR,
    trace: {
      stages: ['prompt-load', 'llm-analysis', 'ir-build'],
      characterCount: narrativeIR.characters.length,
      sceneCount: narrativeIR.scenes.length,
      segmentCount: narrativeIR.segments.length,
      beatCount,
      intentNodeCount: narrativeIR.graph.nodes.length,
      generatedAt: Date.now(),
    },
  }
}
