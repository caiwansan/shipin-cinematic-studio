/**
 * types/director-execution-plan.ts
 *
 * DirectorExecutionPlan — 昆仑镜执行计划 DTO
 *
 * 这是 昆仑镜（导演层）与 火麒麟（执行层）之间的单向执行契约。
 *
 * 设计原则：
 *   - 昆仑镜不知道 Provider — 只描述"要生成什么"
 *   - 火麒麟不知道导演逻辑 — 只负责"怎么生成"
 *   - 不绑定短剧业务 — 扩展字段支持小说/广告/营销 Agent
 *   - 不创建新 DB 表 — DTO/JSON 层，运行时构建
 *
 * 数据流：
 *   DirectorPlan (叙事)
 *     ↓ compileBlueprint
 *   VideoBlueprint (媒材结构)
 *     ↓ buildExecutionPlan (新增)
 *   DirectorExecutionPlan (执行计划) ← 你在看这里
 *     ↓ director-execution-adapter
 *   /api/tasks/ai-generate (逐个 Task 提交)
 *     ↓ BullMQ ai-runtime → Worker → Asset
 */

// ── 场景级别 ──

export interface SceneExecutionTask {
  /** 图片生成任务 */
  imageTasks: Array<{
    /** 生成 prompt */
    prompt: string
    /** 引用角色 ID 列表（用于角色一致性） */
    characterRefs?: string[]
    /** 风格标识 */
    style?: string
    /** 宽高比 (默认 16:9) */
    aspectRatio?: string
    /** 排序权重 */
    order?: number
  }>

  /** 视频生成任务 */
  videoTasks: Array<{
    /** 前置图片 Asset ID（如果有参考帧） */
    imageAssetId?: string
    /** 目标时长（秒） */
    duration: number
    /** 运动/运镜描述 */
    motion: string
    /** 额外 prompt 补充 */
    prompt?: string
    /** 排序权重 */
    order?: number
  }>

  /** 音频/TTS 任务 */
  audioTasks: Array<{
    /** 角色 voice ID */
    voice: string
    /** 配音文本 */
    text: string
    /** 预期时长（秒，用于对齐） */
    duration?: number
    /** 情感标记 */
    emotion?: string
  }>
}

// ── 场景执行单元 ──

export interface ExecutionScene {
  /** 场景 ID（与 AiSceneSpec.sceneId 或 scene.id 关联） */
  sceneId: string
  /** 场景显示名称 */
  sceneName?: string
  /** 该场景的图片/视频/TTS 任务 */
  tasks: SceneExecutionTask
  /** 任务间依赖：前序任务类型完成后才开始本场景 */
  dependsOn?: string[]
}

// ── 执行计划 ──

/**
 * DirectorExecutionPlan — 完整的执行计划
 *
 * 这是 昆仑镜 → 火麒麟 的唯一契约。
 * 所有字段均为纯数据，不包含执行逻辑。
 */
export interface DirectorExecutionPlan {
  /** 关联项目 ID */
  projectId: string

  /** 计划来源 — 扩展支持：kunlun-director | novel-agent | ad-agent | marketing-agent */
  source: 'kunlun-director' | 'novel-agent' | 'ad-agent' | 'marketing-agent' | string

  /** 场景执行列表 */
  scenes: ExecutionScene[]

  /** 计划元信息 */
  metadata: {
    /** 创建者标识 */
    createdBy: string
    /** 版本号（SemVer） */
    version: string
    /** 创建时间戳 */
    createdAt: number
    /** 来源 trace（用于追踪） */
    traceId?: string
    /** 扩展字段 */
    [key: string]: unknown
  }
}

// ── 构建函数（从 VideoBlueprint 构建） ──

import type { VideoBlueprint } from './video-blueprint.js'
import type { PreparedScene, PreparedCharacter } from './production-preparation.js'

/**
 * buildExecutionPlan — VideoBlueprint → DirectorExecutionPlan
 *
 * 编译 VideoBlueprint 到可执行的 Execution Plan。
 * 每个场景的 shots 被编排为 image/video 任务。
 *
 * @param projectId 目标项目 ID
 * @param blueprint compileBlueprint 输出的 VideoBlueprint
 * @param source 来源标识
 * @param characterRefs 可选的场景→角色映射 { sceneId → characterName[] }
 */
export function buildExecutionPlan(
  projectId: string,
  blueprint: VideoBlueprint,
  source: DirectorExecutionPlan['source'] = 'kunlun-director',
  characterRefs?: Record<string, string[]>,
): DirectorExecutionPlan {
  const scenes: ExecutionScene[] = []
  const shots = blueprint.shotGraph?.shots ?? []

  // 归并 shots 到场景组
  // 由于 VideoBlueprint 的场景信息有限，按 shot.id 前缀或位置分组
  if (shots.length > 0) {
    // 简单分组：每 3-4 个 shot 为一场景
    const groupSize = Math.max(1, Math.ceil(shots.length / 3))

    for (let i = 0; i < shots.length; i += groupSize) {
      const group = shots.slice(i, i + groupSize)
      const sceneId = `scene-${Math.floor(i / groupSize) + 1}`
      const refs = characterRefs?.[sceneId]

      scenes.push({
        sceneId,
        sceneName: group[0]?.intent?.slice(0, 30) || `场景 ${sceneId}`,
        tasks: {
          imageTasks: group.map((shot, idx) => ({
            prompt: `[${shot.camera?.type || '中景'}] ${shot.intent}。${shot.action}`,
            characterRefs: refs,
            order: idx,
          })),
          videoTasks: group.map((shot, idx) => ({
            duration: 4,
            motion: shot.camera?.movement || '平稳',
            prompt: shot.intent,
            order: idx,
          })),
          audioTasks: [],
        },
      })
    }
  }

  // 如果没有 shots（仅有 compiledPrompt），创建一个默认场景
  if (scenes.length === 0 && blueprint.compiledPrompt) {
    scenes.push({
      sceneId: 'scene-1',
      sceneName: '默认场景',
      tasks: {
        imageTasks: [{ prompt: blueprint.compiledPrompt, order: 0 }],
        videoTasks: [{ duration: 4, motion: '平稳', order: 0 }],
        audioTasks: [],
      },
    })
  }

  return {
    projectId,
    source,
    scenes,
    metadata: {
      createdBy: 'compiled-blueprint',
      version: '1.0.0',
      createdAt: Date.now(),
    },
  }
}

// ── 从已有 DB 数据构建 ──

/**
 * buildPlanFromDbData — 从 PreparedProductionAsset 构建执行计划
 *
 * ⚠️ 收敛后的版本：只接受 PreparedScene[]，保证 imagePrompt 非空。
 *
 * 前置条件（必须在调用前完成）：
 *   ProductionPreparationService.prepare()
 *   → DirectorProductionQualityGate.validate()
 *
 * @param projectId 项目 ID
 * @param scenes PreparedScene 数组（经过 Preparation 加工，保证字段完整）
 * @param characters PreparedCharacter 数组（经过 Preparation 加工，可选）
 */
export function buildPlanFromDbData(
  projectId: string,
  scenes: PreparedScene[],
  characters?: PreparedCharacter[],
): DirectorExecutionPlan {
  // 断言：PreparedScene 必须含有非空 imagePrompt
  for (const scene of scenes) {
    if (!scene.imagePrompt || scene.imagePrompt.length < 20) {
      console.error(
        `[buildPlanFromDbData] ❌ 契约断裂: scene「${scene.sceneName}」(id=${scene.sceneId}) ` +
        `通过不合格 imagePrompt「${scene.imagePrompt?.slice(0, 30) || '(empty)'}」` +
        `— 这不应该发生。必须经过 ProductionPreparationService。`
      )
    }
  }

  return {
    projectId,
    source: 'kunlun-director',
    scenes: scenes.map((scene) => ({
      sceneId: scene.sceneId,
      sceneName: scene.sceneName,
      tasks: {
        // imageTasks: 使用 PreparedScene.imagePrompt（保证非空）
        imageTasks: [
          {
            prompt: scene.imagePrompt,
            order: 0,
          },
          ...(characters?.map((c, i) => ({
            prompt: c.imagePrompt,
            characterRefs: [c.characterName],
            order: i + 1,
          })) ?? []),
        ],
        // videoTasks: 使用场景描述作为视频 prompt
        videoTasks: [
          {
            prompt: scene.sceneDescription,
            duration: 4,
            motion: '平稳',
            order: 0,
          },
        ],
        // audioTasks: 角色语音
        audioTasks: [
          ...(characters?.filter(c => c.voiceType).map(c => ({
            voice: c.voiceType!,
            text: `${c.characterName} 的台词`,
            emotion: 'neutral',
          })) ?? []),
        ],
      },
    })),
    metadata: {
      createdBy: 'db-data',
      version: '1.0.0',
      createdAt: Date.now(),
      promptSource: 'production-preparation',
      preparedBy: 'production-preparation-service',
      preparedAt: new Date().toISOString(),
    },
  }
}
