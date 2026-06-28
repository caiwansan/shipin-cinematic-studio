/**
 * story/story-compiler.ts — Phase 2 故事级主编译器
 *
 * 职责：接收外部 StoryGraph，调用已有管线，编译故事级输出包
 *
 * Pipeline：
 *   StoryGraph (external input)
 *     ↓ expandSceneGraph
 *   SceneGraph
 *     ↓ for each scene: normalizeShot → toDirectorIR → compileCinematicPrompt → compileSceneTimeline
 *   per-scene IR + Timeline 完成
 *     ↓ compileGlobalArc
 *   GlobalArc (emotion/camera/character continuity)
 *     ↓
 *   StoryBundle (最终输出)
 *
 * 宪法：
 *   1. 不修改 IR schema
 *   2. 不修改 Timeline system
 *   3. 不调 LLM
 *   4. StoryGraph 是权威输入契约，系统不自动生成场景
 */

import type { DirectorIR } from '../prompt/director-ir.js'
import type { SceneTimeline } from '../timeline/scene-timeline.js'
import type { StoryGraph, SceneNode } from './scene-graph.js'
import type { GlobalArc } from './global-arc.js'
import { expandSceneGraph } from './scene-graph.js'
import { compileGlobalArc } from './global-arc.js'

// ─── 类型 ─────────────────────────────────────────────────────────

export interface StoryBundle {
  story: StoryGraph
  scenes: StorySceneResult[]
  globalArc: GlobalArc
  meta: {
    sceneCount: number
    elapsedMs: number
    version: string
  }
}

export interface StorySceneResult {
  scene: SceneNode
  index: number
  ir: DirectorIR
  timeline: SceneTimeline
  prompt: string
  compileTimeMs: number
}

// ─── 编译配置 ─────────────────────────────────────────────────

interface StoryCompilerOptions {
  /** 是否跳过 LLM 调用（强制 deterministic） */
  noLLM: boolean
}

const DEFAULT_OPTIONS: StoryCompilerOptions = {
  noLLM: true,
}

// ─── compileStory ───────────────────────────────────────────

/**
 * 故事级主入口：从外部 StoryGraph 编译完整故事包
 *
 * 每个 scene 走现有 pipeline（normalize → IR → prompt → timeline），
 * 最后跨场景推导 global arc。
 */
export function compileStory(
  story: StoryGraph,
  options?: Partial<StoryCompilerOptions>
): StoryBundle {
  const start = Date.now()
  const opts = { ...DEFAULT_OPTIONS, ...options }

  // 1. 展开 SceneGraph
  const graph = expandSceneGraph(story)

  // 2. 逐个场景编译
  const scenes: StorySceneResult[] = []
  const sceneIRs: Record<string, DirectorIR> = {}

  // 延迟加载避免主入口循环依赖
  const { normalizeShot } = require('../prompt/shot-normalizer.js')
  const { toDirectorIR } = require('../prompt/director-ir.js')
  const { compileCinematicPrompt } = require('../prompt/cinematic-compiler.js')
  const { compileSceneTimeline } = require('../timeline/scene-timeline.js')

  for (let i = 0; i < graph.sequence.length; i++) {
    const sceneId = graph.sequence[i]
    const scene = graph.index[sceneId]
    const sceneStart = Date.now()

    // 使用 scene.shotGraph 或从 description 构造最小 shot
    const shotInput = scene.shotGraph ?? {
      subject: [],
      action: scene.description ?? `${scene.type} scene`,
      camera: {},
      spatialFrame: scene.description ?? '',
    }

    const normalized = normalizeShot(shotInput)
    const ir = toDirectorIR(normalized)
    const prompt = compileCinematicPrompt(ir)
    const timeline = compileSceneTimeline(ir, sceneId)

    sceneIRs[sceneId] = ir

    scenes.push({
      scene,
      index: i,
      ir,
      timeline,
      prompt,
      compileTimeMs: Date.now() - sceneStart,
    })
  }

  // 3. 全局弧线
  const globalArc = compileGlobalArc(graph, sceneIRs, story.title)

  return {
    story,
    scenes,
    globalArc,
    meta: {
      sceneCount: graph.sequence.length,
      elapsedMs: Date.now() - start,
      version: 'director-v2.0',
    },
  }
}

export default { compileStory }
