import type { ApiResponse } from '../contracts/api/base.js';
/**
 * orchestrator.ts — AI Agent 编排路由
 *
 * ETFL-EDCL: ORCHESTRATION DOMAIN
 * - 禁止直接调用 model/provider/adapter
 * - 仅允许生成 execution plan
 * - 不得 bypass SECS/queue 执行
 *
 * 统筹剧本分析 → 分发到各专业 Agent → 二次创作 → 返回前端渲染
 *
 * 架构：
 *   1. 统筹步：aigcSpecAgent.generateSpec(script) 一次性产出全部 spec
 *   2. 细化步：对每个 stage 调 regenerateType 带上下文细化
 *   3. 返回结构：{ blueprint, character, scene, storyboard, voice, frame, video }
 *
 * 前端各面板直接从返回数据中取对应部分渲染卡片。
 */

import { FastifyInstance } from 'fastify'
import { aigcSpecAgent } from '../agents/aigc-spec-agent.js'
import { analyzeScript } from '../director/director-brain.agent.js'

interface RunRequest {
  projectId: string
  script: string
  /** 需要运行的阶段，留空则运行全部 */
  stages?: string[]
  /** 已有数据（重新生成时传入） */
  existingData?: Record<string, any>
}

interface RunResponse {
  success: boolean
  projectId: string
  data: {
    /** 剧情蓝图 — plot-supervisor 产出 */
    blueprint?: any
    /** 角色规格 + 提示词 */
    character?: any
    /** 场景规格 + 提示词 */
    scene?: any
    /** 分镜规划 */
    storyboard?: any
    /** 音色配置 */
    voice?: any
    /** 首尾帧设计 */
    frame?: any
    /** 视频制作规格 */
    video?: any
    /** 特效/动作/运镜/情绪规格 */
    action?: any
  }
  meta: {
    latencyMs: number
    stages: string[]
  }
  error?: string
}

export default async function orchestratorRoutes(fastify: FastifyInstance) {
  /**
   * POST /api/v1/orchestrator/run — 编排运行入口
   *
   * 一次调用完成全部 AI 分析：
   *   1. 统筹（aigc-spec-agent）分析剧本产出全部原始 spec
   *   2. 各 stage 二次创作细化
   *   3. 返回完整数据供前端各面板渲染
   */
  fastify.post('/api/v1/orchestrator/run', async (request, reply): Promise<RunResponse> => {
    const start = Date.now()
    const { projectId, script, stages, existingData } = request.body as RunRequest

    if (!projectId || !script) {
      return {
        success: false,
        projectId,
        data: {} as any,
        meta: { latencyMs: 0, stages: [] },
        error: 'projectId 和 script 不能为空',
      }
    }

    // 确定运行哪些 stage
    const allStages = ['character', 'scene', 'storyboard', 'voice', 'frame', 'video', 'action']
    const activeStages = stages?.length ? stages.filter(s => allStages.includes(s)) : allStages
    const needBlueprint = activeStages.length > 0

    try {
      // ============================================================
      // Step 1: 统筹分析 — 调 aigc-spec-agent 一次性产出全部原始 spec
      // ============================================================
      const userId = (request as any).userId || (request as any).user?.id || 'anonymous'
      // 将剧情总指挥分析出的角色 variants 信息附加到剧本文本后
      let enrichedScript = script
      if (rawData?.characters?.length) {
        const variantInfo = rawData.characters
          .filter((c: any) => c.variants?.length > 1)
          .map((c: any) => {
            const vNames = c.variants.map((v: any) => v.variant).join(' → ')
            return `[角色状态变化] ${c.name}: ${vNames}`
          })
        if (variantInfo.length > 0) {
          enrichedScript = script + '\n\n## 角色状态变化检测结果\n' + variantInfo.join('\n')
        }
      }
      const specResult = await aigcSpecAgent.generateSpec({
        text: enrichedScript,
        title: projectId,
        userId,
      })

      if (!specResult.success || !specResult.data) {
        return {
          success: false,
          projectId,
          data: {} as any,
          meta: { latencyMs: Date.now() - start, stages: [] },
          error: specResult.error || '统筹分析失败',
        }
      }

      const rawData = specResult.data

      // ============================================================
      // Step 2: 可选 — 用 director-brain 分析主题/情绪曲线增强蓝图
      // ============================================================
      let directorUnderstanding: any = null
      try {
        directorUnderstanding = await analyzeScript(script)
      } catch {
        // 非关键路径，不阻塞
      }

      // ============================================================
      // Step 3: 各 stage 二次创作 / 数据整理
      // ============================================================
      const result: RunResponse['data'] = {}

      // --- 剧情蓝图 ---
      if (needBlueprint) {
        result.blueprint = {
          theme: directorUnderstanding?.theme || rawData.theme || '',
          genre: directorUnderstanding?.genre || rawData.genre || [],
          mood: directorUnderstanding?.overallTone || '',
          storyStructure: rawData.storyStructure || [],
          characterOverview: (rawData.characterSpecs || []).map((c: any) => ({
            name: c.characterName,
            variant: c.variant || '',
            role: c.role || '配角',
            traits: c.personality || [],
          })),
          pacingNotes: directorUnderstanding?.pacing || '',
        }
      }

      // --- 角色设计（含提示词二次创作）---
      if (activeStages.includes('character')) {
        let characterData = rawData.characterSpecs || []

        // 如有已有数据，传给 LLM 做二次创作
        if (existingData?.character && characterData.length > 0) {
          try {
            const refined = await aigcSpecAgent.regenerateType({
              type: 'character',
              text: script,
              title: projectId,
              currentData: existingData.character,
              characterNames: characterData.map((c: any) => c.characterName).filter(Boolean),
            })
            if (refined.success && refined.data?.characterSpecs) {
              characterData = refined.data.characterSpecs
            }
          } catch {
            // 二次创作失败，用原始数据
          }
        }

        result.character = characterData.map((c: any) => ({
          characterId: c.characterId || `char_${Math.random().toString(36).slice(2, 6)}`,
          name: c.characterName || '未命名角色',
          variant: c.variant || '',  // 形象变体标记
          role: c.role || 'supporting',
          personality: c.personality || [],
          age: c.age || '',
          gender: c.gender || '',
          appearance: c.appearance || '',
          clothing: c.clothing || '',
          // AI 生成的 imagePrompt — 前端角色卡直接使用
          imagePrompt: c.imagePrompt || '',
          imagePromptFields: c.imagePromptFields || {},
          negativePrompt: c.negativePrompt || '',
          // 视觉特征（供 portrait-prompt agent 使用）
          visualSignature: c.visualSignature || '',
        }))
      }

      // --- 场景设计 ---
      if (activeStages.includes('scene')) {
        let sceneData = rawData.sceneSpecs || []

        if (existingData?.scene && sceneData.length > 0) {
          try {
            const refined = await aigcSpecAgent.regenerateType({
              type: 'scene',
              text: script,
              currentData: existingData.scene,
            })
            if (refined.success && refined.data?.sceneSpecs) {
              sceneData = refined.data.sceneSpecs
            }
          } catch {}
        }

        result.scene = sceneData.map((s: any) => ({
          sceneId: s.sceneId || `scene_${Math.random().toString(36).slice(2, 6)}`,
          sceneName: s.sceneName || '未命名场景',
          description: s.description || '',
          // AI 生成了表格格式的 imagePrompt
          imagePrompt: s.imagePrompt || '',
          negativePrompt: s.negativePrompt || '',
          emotion: s.emotion || '',
          atmosphere: s.atmosphere || '',
        }))
      }

      // --- 分镜 ---
      if (activeStages.includes('storyboard')) {
        let storyboardData = rawData.videoSegments || []

        if (existingData?.storyboard && storyboardData.length > 0) {
          try {
            const refined = await aigcSpecAgent.regenerateType({
              type: 'storyboard',
              text: script,
              currentData: existingData.storyboard,
            })
            if (refined.success && refined.data?.videoSegments) {
              storyboardData = refined.data.videoSegments
            }
          } catch {}
        }

        result.storyboard = storyboardData.map((seg: any) => ({
          segmentId: seg.segmentId || `seg_${Math.random().toString(36).slice(2, 6)}`,
          title: seg.title || '',
          duration: seg.duration || 8,
          narrativePurpose: seg.narrativePurpose || '',
          associatedScenes: seg.associatedScenes || [],
          shotPattern: seg.shotPattern || 'medium_medium',
          // AI 生成的镜头描述
          description: seg.description || '',
        }))
      }

      // --- 音色 ---
      if (activeStages.includes('voice')) {
        let voiceData = rawData.voiceConfigs || []

        if (existingData?.voice && voiceData.length > 0) {
          try {
            const refined = await aigcSpecAgent.regenerateType({
              type: 'voice',
              text: script,
              currentData: existingData.voice,
            })
            if (refined.success && refined.data?.voiceConfigs) {
              voiceData = refined.data.voiceConfigs
            }
          } catch {}
        }

        result.voice = voiceData.map((v: any) => ({
          characterName: v.characterName || '',
          voiceType: v.voiceType || 'zh_female_gentle',
          speakingStyle: v.speakingStyle || '',
          pitch: v.pitch || 1.0,
          speed: v.speed || 1.0,
          ttsPrompt: v.ttsPrompt || '',
        }))
      }

      // --- 首尾帧 ---
      if (activeStages.includes('frame')) {
        let frameData = rawData.frameDesign || rawData.frameSpecs || []

        if (existingData?.frame && frameData.length > 0) {
          try {
            const refined = await aigcSpecAgent.regenerateType({
              type: 'frame',
              text: script,
              currentData: existingData.frame,
            })
            if (refined.success && refined.data?.frameDesign) {
              frameData = refined.data.frameDesign
            }
          } catch {}
        }

        result.frame = Array.isArray(frameData) ? frameData : [frameData]
      }

      // --- 视频制作规格 ---
      if (activeStages.includes('video')) {
        result.video = {
          style: rawData.videoStyle || rawData.style || '',
          aspectRatio: rawData.aspectRatio || '16:9',
          fps: rawData.fps || 24,
          resolution: rawData.resolution || '1080p',
          colorGrade: rawData.colorGrade || '',
          segments: (rawData.videoSegments || []).map((seg: any) => ({
            segmentId: seg.segmentId,
            title: seg.title,
            duration: seg.duration,
            framePrompts: seg.framePrompts || [],
          })),
        }
      }

      // --- 特效/动作/运镜 ---
      if (activeStages.includes('action')) {
        result.action = {
          effects: rawData.effects || [],
          actionSequences: rawData.actionSequences || [],
          cameraMoves: rawData.cameraMoves || [],
          emotionalExpressions: rawData.emotionalExpressions || [],
        }
      }

      return {
        success: true,
        projectId,
        data: result,
        meta: {
          latencyMs: Date.now() - start,
          stages: activeStages,
        },
      }
    } catch (err: any) {
      return {
        success: false,
        projectId,
        data: {} as any,
        meta: { latencyMs: Date.now() - start, stages: activeStages.length ? activeStages : [] },
        error: err.message || '编排运行异常',
      }
    }
  })

  /**
   * GET /api/v1/orchestrator/stages — 查看可用的编排阶段
   */
  fastify.get('/api/v1/orchestrator/stages', async () => {
    return {
      stages: [
        { id: 'blueprint', name: '剧情蓝图', desc: '主题、类型、结构、角色概览', aiAgent: 'aigc-spec-agent + director-brain' },
        { id: 'character', name: '角色设计', desc: '角色形象规格 + AI 提示词', aiAgent: 'aigc-spec-agent (character)' },
        { id: 'scene', name: '场景设计', desc: '场景图规格 + AI 提示词', aiAgent: 'aigc-spec-agent (scene)' },
        { id: 'storyboard', name: '分镜制作', desc: '视频段落规划', aiAgent: 'aigc-spec-agent (storyboard)' },
        { id: 'voice', name: '音色设计', desc: '角色音色配置', aiAgent: 'aigc-spec-agent (voice)' },
        { id: 'frame', name: '首尾帧制作', desc: '首尾帧设计', aiAgent: 'aigc-spec-agent (frame)' },
        { id: 'video', name: '视频制作', desc: '视频生成规格', aiAgent: 'aigc-spec-agent' },
        { id: 'action', name: '特效/动作', desc: '动作指令、运镜、特效', aiAgent: 'aigc-spec-agent' },
      ],
    }
  })
}
