/**
 * director-runtime/director-to-blueprint-compiler.ts
 *
 * ⚔️ Phase 4 — Director → Blueprint Compiler + Style Injection
 *
 * 职责：
 *   DirectorPlan + NarrativeGraph + StyleProfile → VideoBlueprint
 *
 * Style Injection 规则：
 *   ✅ 只影响 render attributes（lightingBias/colorPalette/lensPreference/pacingModifier）
 *   ❌ 不改变叙事结构（sceneSegmentation/causalGraph/emotionalArc）
 *
 * 宪法规则（不变）：
 *   - 纯结构映射，无创造行为
 *   - 确定性输出（same input → same blueprint）
 *   - 不生成 prompt 文本
 *   - 不包含叙事残留
 */

import type { DirectorPlan, NarrativeGraph } from './types.js'
import type { VideoBlueprint, BlueprintShotGraph, BlueprintEffectSpec } from '../types/video-blueprint.js'
import type { StyleProfile } from '../style-runtime/style-registry.js'

// ── 种子结构 ──

export interface BlueprintSeed {
  sceneId: string
  keyEvents: Array<{ label: string; emotion: string; weight: number }>
  emotionalArc: string[]
  causalChain?: string[]
  pacingHint: string
}

// ── 编译配置 ──

export interface CompilerConfig {
  defaultSceneDirection?: string
}

// ── 核心编译函数 ──

/**
 * compileBlueprint — DirectorPlan + NarrativeGraph → VideoBlueprint
 *
 * 这是唯一合法的转换入口。
 * 输入纯叙事结构，输出纯媒体结构（不含叙事残留）。
 */
export function compileBlueprint(
  plan: DirectorPlan,
  graph: NarrativeGraph
): VideoBlueprint {
  return compileWithStyle(plan, graph, undefined)
}

/**
 * compileWithStyle — DirectorPlan + NarrativeGraph + StyleProfile → VideoBlueprint
 *
 * Phase 4 新增。在编译时应用风格修饰。
 * Style 只影响 render 属性，不改叙事结构。
 */
export function compileWithStyle(
  plan: DirectorPlan,
  graph: NarrativeGraph,
  style?: StyleProfile
): VideoBlueprint {
  // Step 1: compiledPrompt（可被 style 修饰）
  const compiledPrompt = buildPromptFromIntent(plan, style)

  // Step 2: shotGraph（可被 style 修饰）
  const shotGraph = buildShotGraphFromArc(plan, graph, style)

  // Step 3: promptSpec（可被 style 修饰）
  const promptSpec = buildPromptSpec(plan, style)

  // Step 4: effectSpecs（可被 style 修饰）
  const effectSpecs = buildEffectSpecs(plan, style)

  // Step 5: 组装 Blueprint
  const blueprint: VideoBlueprint = {
    compiledPrompt,
    promptSpec,
    shotGraph,
    effectSpecs,
    promptSource: 'compiled',
  }

  return blueprint
}

// ── Style 修饰函数 ──

function applyStyleToPrompt(prompt: string, style?: StyleProfile): string {
  if (!style) return prompt
  return [
    prompt,
    `【风格指示】${style.displayName} — ${style.description}`,
    `【灯光】${style.lightingBias.description}`,
    `【色彩】${style.colorPalette.description}`,
    `【镜头】${style.lensPreference.description}`,
  ].join('\n')
}

function applyStyleToShotGraph(shotGraph: BlueprintShotGraph, style?: StyleProfile): BlueprintShotGraph {
  if (!style) return shotGraph
  return {
    ...shotGraph,
    shots: shotGraph.shots.map(shot => ({
      ...shot,
      camera: {
        ...shot.camera,
        type: style.lensPreference.dominant === 'wide' ? '广角' :
              style.lensPreference.dominant === 'tele' ? '长焦' :
              shot.camera.type,
        movement: style.lensPreference.movement === 'dynamic' ? '运镜丰富' :
                  style.lensPreference.movement === 'smooth' ? '流畅运镜' :
                  '固定机位',
      },
    })),
  }
}

function applyStyleToPromptSpec(spec: VideoBlueprint['promptSpec'], style?: StyleProfile): VideoBlueprint['promptSpec'] {
  if (!style || !spec) return spec
  return {
    ...spec,
    environment: {
      ...spec.environment,
      atmosphere: spec.environment?.atmosphere
        ? `${spec.environment.atmosphere}，${style.lightingBias.description}`
        : style.lightingBias.description,
    },
    style: {
      ...spec.style,
      cinematic: true,
      keywords: [
        ...(spec.style?.keywords ?? []),
        style.displayName,
        style.colorPalette.description,
      ],
    },
  }
}

function applyStyleToEffectSpecs(specs: BlueprintEffectSpec[] | undefined, style?: StyleProfile): BlueprintEffectSpec[] | undefined {
  if (!style || !specs) return specs

  const paceOffset = style.pacingModifier.offset
  const paceDesc = style.pacingModifier.description

  // 如果 pacing offset 非零，添加节奏修饰特效
  if (Math.abs(paceOffset) > 0.01) {
    return [
      ...specs,
      {
        type: '风格节奏修饰',
        description: paceDesc,
        timing: 'throughout',
        duration: 0,
        intensity: Math.abs(paceOffset) > 0.1 ? 'high' : 'low',
      },
    ]
  }

  return specs
}

// ── 编译子函数（升级支持 style） ──

function buildPromptFromIntent(plan: DirectorPlan, style?: StyleProfile): string {
  const sceneDesc = plan.sceneSegmentation
    .map(s => `${s.id}: ${s.summary}（${s.emotionalTone}）`)
    .join('\n')

  const prompt = [
    `【叙事意图】${plan.narrativeIntent}`,
    `【情绪曲线】${plan.emotionalArc.join(' → ')}`,
    `【场景序列】`,
    sceneDesc,
    `【节奏控制】${plan.narrativeLogic.pacingModel}`,
  ].join('\n')

  return applyStyleToPrompt(prompt, style)
}

function buildShotGraphFromArc(
  plan: DirectorPlan,
  graph: NarrativeGraph,
  style?: StyleProfile
): BlueprintShotGraph {
  const orderedNodes = [...graph.nodes].sort((a, b) => a.position - b.position)
  const climaxPos = plan.narrativeConstraints?.climaxPosition ?? 0.75

  const shots = orderedNodes.map((node, idx) => {
    const isClimax = Math.abs(node.position - climaxPos) < 0.1
    const prevNode = idx > 0 ? orderedNodes[idx - 1] : null

    return {
      id: `shot_${node.id}`,
      intent: node.description,
      spatialFrame: isClimax ? '聚焦核心冲突' : node.emotion,
      camera: {
        type: isClimax ? '特写' : '中景',
        movement: isClimax ? '推镜' : '平稳',
      },
      subject: [node.label],
      action: node.description,
      vfx: isClimax ? ['情绪强化'] : [],
      continuity: prevNode ? {
        previousRelation: graph.edges.find(
          e => e.sourceId === prevNode.id && e.targetId === node.id
        )?.relation ?? '顺序',
        description: `${prevNode.emotion} → ${node.emotion}`,
      } : undefined,
    }
  })

  const baseGraph: BlueprintShotGraph = {
    shots,
    meta: {
      totalShots: shots.length,
      narrativeSummary: plan.narrativeIntent,
    },
  }

  return applyStyleToShotGraph(baseGraph, style)
}

function buildPromptSpec(plan: DirectorPlan, style?: StyleProfile): VideoBlueprint['promptSpec'] {
  if (plan.sceneSegmentation.length === 0) return undefined

  const firstScene = plan.sceneSegmentation[0]

  const spec: VideoBlueprint['promptSpec'] = {
    camera: {
      shot_type: '中景',
      movement: '平稳',
    },
    subject: {
      main: firstScene.summary,
    },
    action: firstScene.narrativePurpose,
    environment: {
      location: firstScene.id,
      atmosphere: firstScene.emotionalTone,
    },
    style: {
      cinematic: true,
      keywords: plan.narrativeConstraints?.themeKeywords ?? [],
    },
  }

  return applyStyleToPromptSpec(spec, style)
}

function buildEffectSpecs(plan: DirectorPlan, style?: StyleProfile): BlueprintEffectSpec[] | undefined {
  const specs: BlueprintEffectSpec[] = []

  const climaxPos = plan.narrativeConstraints?.climaxPosition ?? 0.75
  if (climaxPos > 0) {
    specs.push({
      type: '高潮强化',
      description: `在 ${Math.round(climaxPos * 100)}% 位置强化情绪冲击`,
      timing: 'climax',
      duration: 2,
      intensity: 'high',
    })
  }

  if (plan.narrativeLogic.pacingModel) {
    specs.push({
      type: '节奏控制',
      description: plan.narrativeLogic.pacingModel,
      timing: 'throughout',
      duration: 0,
      intensity: 'medium',
    })
  }

  return applyStyleToEffectSpecs(specs.length > 0 ? specs : undefined, style)
}

// ── 接口导出 ──

export interface DirectorToBlueprintCompiler {
  compile(plan: DirectorPlan, graph: NarrativeGraph, config?: CompilerConfig): VideoBlueprint
  compileWithStyle(plan: DirectorPlan, graph: NarrativeGraph, style?: StyleProfile): VideoBlueprint
}

export const compilerAPI: DirectorToBlueprintCompiler = {
  compile: compileBlueprint,
  compileWithStyle,
}

