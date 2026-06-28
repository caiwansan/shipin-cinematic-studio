import { FastifyInstance } from 'fastify'
import { readFileSync } from 'fs'
import { join } from 'path'
import { PrismaClient } from '@prisma/client'
import { narrativeGateway } from '../runtime/narrative-gateway.js'
import { compilePrompt } from '../engine/prompt-compiler/prompt-compiler.js'
import { validateVPIRBatch } from '../engine/prompt-compiler/vp-ir-validator.js'

const prisma = new PrismaClient()

const MAX_TEXT_LENGTH = 4000

// shared helper: 从 VP-IR 编译自然语言视频描述
function buildVideoPrompt(ir: any): string {
  const parts: string[] = []
  if (ir.action?.details) parts.push(ir.action.details)
  const scene = [ir.scene?.environment, ir.scene?.timeOfDay, ir.scene?.atmosphere].filter(Boolean).join('，')
  if (scene) parts.push(`场景：${scene}`)
  if (ir.subject) parts.push(`角色：${ir.subject}`)
  const shotMap: Record<string,string> = { 'close-up':'特写','medium':'中景','wide':'全景','aerial':'航拍','over-the-shoulder':'过肩','extreme-close-up':'大特写' }
  const camera = [ir.camera?.shotType ? (shotMap[ir.camera.shotType] || ir.camera.shotType) : '', ir.camera?.angle, ir.camera?.lens, ir.camera?.movement].filter(Boolean).join('，')
  if (camera) parts.push(`镜头：${camera}`)
  const lightMap: Record<string,string> = { soft:'柔光',hard:'硬光',dramatic:'戏剧光',natural:'自然光',backlit:'背光',rim:'轮廓光' }
  const light = [ir.lighting?.type ? (lightMap[ir.lighting.type] || ir.lighting.type) : '', ir.lighting?.direction, ir.lighting?.intensity, ir.lighting?.colorTemp].filter(Boolean).join('，')
  if (light) parts.push(`灯光：${light}`)
  if (ir.effects?.description) parts.push(`特效：${ir.effects.description}`)
  if (ir.effects?.audioFile) parts.push(`音频：${ir.effects.audioFile}`)
  const style = [ir.style?.cinematicStyle, ir.style?.referenceAesthetic, ir.style?.colorPalette].filter(Boolean).join('，')
  if (style) parts.push(`风格：${style}`)
  return parts.join('\n')
}

/**
 * POST /api/v1/optimize-video-prompts
 * 根据项目 AIGC 规格数据 + 剧情，为每个分镜优化视频生成 prompt
 *
 * v6.6 Upgrade:
 *   - Agent 输出 VP-IR（结构化 Visual Prompt IR）
 *   - VP-IR Validator Gate（硬失败，防止污染编译链）
 *   - Prompt Compiler 编译为 model-ready prompt
 *   - 返回字段扩展：modelReadyPrompt + modelReadyNegative + summary
 */
export default async function optimizeVideoPromptRoutes(fastify: FastifyInstance) {
  // ⭐ 新增：单分镜独立优化路由（每个分镜一个 LLM 调用，避免 maxTokens 溢出）
  fastify.post('/api/v1/optimize-single-video-prompt', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    const { projectId, segmentId, storyText: bodyStoryText } = request.body as any

    if (!projectId || !segmentId) {
      return reply.status(400).send({ success: false, error: '缺少 projectId 或 segmentId' })
    }

    const project = await prisma.project.findUnique({
      where: { id: projectId },
      select: { id: true, name: true, description: true, executionResults: true },
    })
    if (!project) return reply.status(404).send({ success: false, error: '项目不存在' })

    // 只查这一个 segment 和对应的 frameDesign
    const [videoSegment, frameDesigns, videoProduction, characterSpecs, voiceConfigs, emotionSpecs] = await Promise.all([
      prisma.aiVideoSegment.findFirst({ where: { segmentId } }),
      prisma.aiFrameDesign.findMany({ where: { projectId, segmentId }, orderBy: { sortOrder: 'asc' } }),
      prisma.aiVideoProduction.findUnique({ where: { projectId } }),
      prisma.aiCharacterSpec.findMany({ where: { projectId }, orderBy: { sortOrder: 'asc' } }),
      prisma.aiVoiceConfig.findMany({ where: { projectId } }),
      prisma.aiEmotionSpec.findMany({ where: { projectId }, orderBy: { sortOrder: 'asc' } }),
    ])
    if (!videoSegment) return reply.status(404).send({ success: false, error: '分镜不存在' })

    // 根据分镜内容匹配主要角色
    const matchedChar = matchCharacterForSegment(videoSegment, characterSpecs, voiceConfigs)

    // 组装精简 contextJson（只含此 segment + 角色音色信息 + 情绪/表情规格）
    const contextJson = JSON.stringify({
      videoProduction: videoProduction ? {
        overallStyle: videoProduction.overallStyle,
        fps: videoProduction.fps, resolution: videoProduction.resolution,
        colorPalette: videoProduction.colorPalette,
        transitionStyle: videoProduction.transitionStyle,
      } : {},
      characterSpecs: characterSpecs.map(c => ({
        characterName: c.characterName,
        gender: c.gender,
        age: c.age,
        physicalDescription: c.physicalDescription,
        clothing: c.clothing,
        variant: (c as any).variant || "",
      })),
      voiceConfigs: voiceConfigs.map(v => ({
        characterName: v.characterName,
        voiceType: v.voiceType,
        speakingStyle: v.speakingStyle,
      })),
      emotionSpecs: emotionSpecs.map(e => ({
        characterName: e.characterName,
        emotionType: e.emotionType,
        intensity: e.intensity,
        facialDesc: e.facialDesc,
        bodyLanguage: e.bodyLanguage,
        voiceTone: e.voiceTone,
        triggerEvent: e.triggerEvent,
      })),
      videoSegments: [{
        segmentId: videoSegment.segmentId,
        title: videoSegment.title,
        narrativePurpose: videoSegment.narrativePurpose,
        shotPattern: videoSegment.shotPattern,
        emotionArc: videoSegment.emotionArc,
        duration: videoSegment.duration,
      }],
      frameDesigns: frameDesigns.map(f => ({
        segmentId: f.segmentId,
        firstFrame: { description: f.firstFrameDesc, imagePrompt: f.firstFramePrompt },
        lastFrame: { description: f.lastFrameDesc, imagePrompt: f.lastFramePrompt },
      })),
    }, null, 2)

    const systemPrompt = readFileSync(
      join(__dirname, '../prompts/agents/video-prompt-optimizer.txt'),
      'utf-8',
    )

    // 从 executionResults.plotBlueprint 提取场景摘要作为 storyText，优先于空壳 description
    const storyTextForSingle = extractStoryFromProject(project).slice(0, MAX_TEXT_LENGTH)
    const userPrompt = `项目标题：${project.name || '未命名'}

项目描述/故事文本：
${storyTextForSingle}

已有 AIGC 规格（视频段落 + 首尾帧 + 风格）：
${contextJson}

请根据上述数据，严格按 VisualPromptIR 格式输出**此分镜段落**的视觉指令。只需输出 1 个 segment。

## 核心原则
1. **聚焦画面每一秒的变化** — 不是描述角色长什么样，角色外貌已经在角色设计阶段定义过了
2. **所有动作描述必须以 0.5 秒为时间粒度**（第N~N+0.5秒），描述每一刻的具体动作变化
3. **保证物理自然感** — 动作前要有前摇过渡，不能突跳；人物不穿墙不穿桌
4. **表情同样 0.5 秒粒度** — 眼神、眉毛、嘴角、面部肌肉的渐变化
5. **环境也是动态的** — 光线强弱、阴影移动、天气渐变，同样 0.5 秒描述
6. **特效完整过程** — 从出现到扩散到消散的完整变化

## 每个字段的深度要求
- **action.details**: 必须以"第N~N+0.5秒"为粒度写完整动作轨迹，包含肢体动作 + 交互动作 + 幅度变化（加速/减速/回弹/前摇）
- **action.expression**: 同样 0.5 秒粒度，描述眼睛、眉毛、嘴部的渐变
- **camera.movement**: 具体运镜方式，按时间描述相机运动轨迹
- **scene.environment**: 环境元素随时间的变化（光线、阴影、物体位置）
- **effects.description**: 特效从出现到消散的完整过程，0.5 秒粒度
- **constraints.avoid**: 必须包含"扭曲、僵硬、抽搐、瞬移、突变、抖动、穿模"等负面词

## 输出 JSON 格式
{
  "segment": {
    "segmentId": "${segmentId}",
    "visualIR": {
      "subject": "主体描述",
      "scene": { "environment": "环境（0.5秒粒度）", "timeOfDay": "时间段", "atmosphere": "氛围" },
      "camera": { "shotType": "close-up", "angle": "视角", "lens": "焦距", "movement": "运镜" },
      "lighting": { "type": "dramatic", "direction": "光源方向", "intensity": "强度", "colorTemp": "色温" },
      "style": { "cinematicStyle": "电影风格", "referenceAesthetic": "美学参考", "colorPalette": "色调" },
      "action": { "type": "动作类型", "pacing": "slow", "details": "0.5秒粒度动作轨迹", "expression": "0.5秒粒度表情变化" },
      "effects": { "hasVFX": false, "description": "0.5秒粒度特效过程" },
      "constraints": { "avoid": ["扭曲","僵硬","抽搐","瞬移","突变","抖动","穿模","穿墙","肢体变形"], "mustInclude": [], "extraNegative": "扭曲、僵硬、抽搐、不自然、瞬移、突变" }
    }
  }
}

重要：不要加代码块标记，输出纯 JSON。每个字段都必须有值，不允许空字符串。`

    const result = await narrativeGateway.execute({
      systemPrompt,
      userMessage: userPrompt,
      userId: String((request.user as any)?.id || ''),
      timeoutTier: 'batch',
      maxTokens: 4096,
    })

    // 解析 segment 级别的 JSON
    const raw = result.content
    let segData: any = null
    try { segData = JSON.parse(raw) } catch {
      const match = raw.match(/```(?:json)?\s*([\s\S]*?)```/)
      if (match) try { segData = JSON.parse(match[1].trim()) } catch {}
      if (!segData) { const bm = raw.match(/\{[\s\S]*\}/); if (bm) try { segData = JSON.parse(bm[0]) } catch {} }
    }

    const visualIR = segData?.segment?.visualIR || segData?.visualIR
    if (!visualIR) {
      return reply.status(500).send({ success: false, error: 'Agent 返回数据无法解析', raw: raw.slice(0, 500) })
    }

    // 编译 prompt
    let compiled: any
    try {
      compiled = compilePrompt(visualIR, 'wan')
    } catch (compErr: any) {
      console.warn('[OptimizeSingleVideo] compilePrompt failed, fallback to raw:', compErr.message)
      compiled = { modelReadyPrompt: '', modelReadyNegative: '', humanReadableSummary: '' }
    }
    const promptMap: Record<string, any> = {}
    // 提取配音台词（从 visualIR 的动作描述中提取对话/旁白）
    const voiceDubbing = extractVoiceDubbing(visualIR, videoSegment)
    promptMap[segmentId] = {
      videoPrompt: buildVideoPrompt(visualIR),
      negativePrompt: (visualIR.constraints?.avoid || []).join(', '),
      voiceDubbing,
      characterNameForVoice: matchedChar?.characterName || '',
      voiceTypeForVoice: matchedChar?.voiceType || 'zh_female_warm',
      modelReadyPrompt: compiled?.modelReadyPrompt || '',
      modelReadyNegative: compiled?.modelReadyNegative || '',
      summary: compiled?.humanReadableSummary || '',
    }

    return { success: true, data: { prompts: promptMap, raw, vpIrCount: 1 } }
  })

  // ── 原有：全分镜批量优化（保留兼容） ──
  fastify.post('/api/v1/optimize-video-prompts', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    const { projectId, storyText: bodyStoryText } = request.body as any

    if (!projectId) {
      return reply.status(400).send({ success: false, error: '缺少 projectId' })
    }

    // 1. 获取项目数据
    const project = await prisma.project.findUnique({
      where: { id: projectId },
      select: { id: true, name: true, description: true, executionResults: true },
    })
    if (!project) {
      return reply.status(404).send({ success: false, error: '项目不存在' })
    }

    // 2. 查询 AIGC 规格数据
    const [videoSegments, frameDesigns, videoProduction, characterSpecs, voiceConfigs] = await Promise.all([
      prisma.aiVideoSegment.findMany({ where: { projectId }, orderBy: { sortOrder: 'asc' } }),
      prisma.aiFrameDesign.findMany({ where: { projectId }, orderBy: { sortOrder: 'asc' } }),
      prisma.aiVideoProduction.findUnique({ where: { projectId } }),
      prisma.aiCharacterSpec.findMany({ where: { projectId }, orderBy: { sortOrder: 'asc' } }),
      prisma.aiVoiceConfig.findMany({ where: { projectId } }),
    ])

    if (videoSegments.length === 0) {
      return reply.status(400).send({ success: false, error: '项目尚未生成分镜段落数据' })
    }

    // 为每个 segment 预匹配角色
    const segmentCharMap = new Map<string, { characterName: string; voiceType: string }>()
    for (const seg of videoSegments) {
      const matched = matchCharacterForSegment(seg, characterSpecs, voiceConfigs)
      if (matched) segmentCharMap.set(seg.segmentId, matched)
    }

    // 3. 组装 contextJson
    const contextJson = JSON.stringify({
      videoProduction: videoProduction ? {
        overallStyle: videoProduction.overallStyle,
        fps: videoProduction.fps,
        resolution: videoProduction.resolution,
        colorPalette: videoProduction.colorPalette,
        transitionStyle: videoProduction.transitionStyle,
        subtitleStyle: videoProduction.subtitleStyle,
      } : {},
      characterSpecs: characterSpecs.map(c => ({
        characterName: c.characterName,
        gender: c.gender,
        age: c.age,
        physicalDescription: c.physicalDescription,
        clothing: c.clothing,
        variant: (c as any).variant || "",
      })),
      voiceConfigs: voiceConfigs.map(v => ({
        characterName: v.characterName,
        voiceType: v.voiceType,
        speakingStyle: v.speakingStyle,
      })),
      videoSegments: videoSegments.map(s => ({
        segmentId: s.segmentId,
        title: s.title,
        narrativePurpose: s.narrativePurpose,
        shotPattern: s.shotPattern,
        emotionArc: s.emotionArc,
        duration: s.duration,
      })),
      frameDesigns: frameDesigns.map(f => ({
        segmentId: f.segmentId,
        firstFrame: { description: f.firstFrameDesc, imagePrompt: f.firstFramePrompt },
        lastFrame: { description: f.lastFrameDesc, imagePrompt: f.lastFramePrompt },
      })),
    }, null, 2)

    // 4. 调用 LLM（输出 VP-IR）
    const systemPrompt = readFileSync(
      join(__dirname, '../prompts/agents/video-prompt-optimizer.txt'),
      'utf-8',
    )

    // 从 executionResults.plotBlueprint 提取场景摘要作为 storyText，优先于空壳 description
    const storyTextForBatch = extractStoryFromProject(project).slice(0, MAX_TEXT_LENGTH)
    const userPrompt = `项目标题：${project.name || '未命名'}

项目描述/故事文本：
${storyTextForBatch}

已有 AIGC 规格（视频段落 + 首尾帧 + 风格）：
${contextJson}

请根据上述数据，严格按 VisualPromptIR 格式输出每个分镜段落的视觉指令。

## 核心原则

1. **聚焦画面每一秒的变化** — 不是描述角色长什么样，角色外貌已经在角色设计阶段定义过了
2. **所有动作描述必须以 0.5 秒为时间粒度**（第N~N+0.5秒），描述每一刻的具体动作变化
3. **保证物理自然感** — 动作前要有前摇过渡，不能突跳；人物不穿墙不穿桌
4. **表情同样 0.5 秒粒度** — 眼神、眉毛、嘴角、面部肌肉的渐变化
5. **环境也是动态的** — 光线强弱、阴影移动、天气渐变，同样 0.5 秒描述
6. **特效完整过程** — 从出现到扩散到消散的完整变化

## 每个字段的深度要求

- **action.details**: 必须以"第N~N+0.5秒"为粒度写完整动作轨迹，包含肢体动作 + 交互动作 + 幅度变化（加速/减速/回弹/前摇）
- **action.expression**: 同样 0.5 秒粒度，描述眼睛（眯起/瞪大/视线）、眉毛（微蹙/上扬）、嘴部（抿唇/微张）的渐变
- **camera.movement**: 具体运镜方式，按时间描述相机运动轨迹
- **scene.environment**: 环境元素随时间的变化（光线、阴影、物体位置）
- **effects.description**: 特效从出现到消散的完整过程，0.5 秒粒度，引用音频文件路径用于对口型
- **constraints.avoid**: 必须包含"扭曲、僵硬、抽搐、瞬移、突变、抖动、穿模、穿墙、肢体变形"等负面词，中英文都写

## 输出 JSON 格式

{
  "segments": [
    {
      "segmentId": "seg_0",
      "visualIR": {
        "subject": "主体描述（不重复角色外貌，只写当前姿态位置）",
        "scene": { "environment": "环境（随时间变化，0.5秒粒度）", "timeOfDay": "时间段", "atmosphere": "氛围" },
        "camera": { "shotType": "close-up", "angle": "视角", "lens": "焦距", "movement": "运镜（按时间描述）" },
        "lighting": { "type": "dramatic", "direction": "光源方向", "intensity": "强度", "colorTemp": "色温" },
        "style": { "cinematicStyle": "电影风格", "referenceAesthetic": "美学参考", "colorPalette": "色调" },
        "action": { "type": "动作类型", "pacing": "slow", "details": "0.5秒粒度动作轨迹", "expression": "0.5秒粒度表情变化" },
        "effects": { "hasVFX": false, "description": "0.5秒粒度特效过程" },
        "constraints": { "avoid": ["扭曲","僵硬","抽搐","瞬移","突变","抖动","穿模","穿墙","肢体变形","多指","limbs twisting","unnatural movement","jerkiness","teleport"], "mustInclude": [], "extraNegative": "扭曲、僵硬、抽搐、不自然、瞬移、突变" }
      }
    }
  ]
}

重要：不要加代码块标记，输出纯 JSON。每个字段都必须有值，不允许空字符串。`

    const result = await narrativeGateway.execute({
      systemPrompt,
      userMessage: userPrompt,
      userId: String((request.user as any)?.id || ''),
      timeoutTier: 'batch',
      maxTokens: 8192,
    })

    // 5. 解析结果 — 支持截断恢复
    const raw = result.content
    let parsed: any = null
    try {
      parsed = JSON.parse(raw)
    } catch {
      const match = raw.match(/```(?:json)?\s*([\s\S]*?)```/)
      if (match) { try { parsed = JSON.parse(match[1].trim()) } catch {} }
      if (!parsed) {
        const braceMatch = raw.match(/\{[\s\S]*\}/)
        if (braceMatch) { try { parsed = JSON.parse(braceMatch[0]) } catch {} }
      }
      if (!parsed) {
        try {
          const truncated = raw.substring(0, raw.lastIndexOf('}') + 1)
          const closed = truncated + '\n]}'
          parsed = JSON.parse(closed)
          console.log(`[OptimizeVideoPrompt] ✅ 截断恢复成功，从 ${raw.length} 字符恢复为 ${parsed.segments?.length || 0} 个 segments`)
        } catch {
          try {
            const closed = raw.substring(0, raw.lastIndexOf('}') + 1).replace(/,\s*$/, '') + '\n]}'
            parsed = JSON.parse(closed)
          } catch {}
        }
      }
    }

    if (!parsed || !Array.isArray(parsed.segments)) {
      console.warn('[OptimizeVideoPrompt] LLM returned unparseable JSON:', raw.slice(0, 200))
      return reply.status(500).send({
        success: false,
        error: 'Agent 返回数据无法解析',
        raw: raw.slice(0, 500),
      })
    }

    // 6. 提取 VP-IR
    const irSegments = parsed.segments.filter((seg: any) => seg && seg.segmentId && seg.visualIR)

    if (irSegments.length === 0) {
      return reply.status(422).send({
        success: false,
        error: '未找到有效的 VP-IR visualIR 字段',
        raw: raw.slice(0, 500),
      })
    }

    // 7. VP-IR Validator Gate（硬失败）
    try {
      validateVPIRBatch(irSegments.map((s: any) => s.visualIR))
    } catch (valErr: any) {
      console.warn('[OptimizeVideoPrompt] VP-IR 验证失败:', valErr.message)
      return reply.status(422).send({
        success: false,
        error: `VP-IR 格式验证失败: ${valErr.message}`,
        raw: raw.slice(0, 500),
      })
    }

 // 8. 从 VP-IR 编译视频描述 + model-ready prompt
    //    videoPrompt: 自然语言完整视频描述（用户可编辑）
    //    modelReadyPrompt: 模型方言（Wan 语法）
    const promptMap: Record<string, {
      videoPrompt: string
      negativePrompt: string
      voiceDubbing?: string
      characterNameForVoice?: string
      voiceTypeForVoice?: string
      modelReadyPrompt: string
      modelReadyNegative: string
      summary: string
    }> = {}
    for (const seg of irSegments) {
      if (!seg.segmentId) continue
      try {
        const ir = seg.visualIR
        const compiled = compilePrompt(ir, 'wan')
        // 诊断日志：检查 VP-IR 关键字段是否被 Agent 填充
        const subject = (ir.subject || '').substring(0, 80)
        const actionDetails = (ir.action?.details || '').substring(0, 60)
        const dressing = (ir.action?.characterDressing || '').substring(0, 60)
        const effectsDesc = (ir.effects?.description || '').substring(0, 60)
        if (!ir.action?.details) {
          console.warn(`[OptimizeVideoPrompt] ⚠️ ${seg.segmentId} action.details 为空！subject="${subject}"`)
        }
        console.log(`[OptimizeVideoPrompt] 📋 ${seg.segmentId} subject="${subject}" details="${actionDetails}" dressing="${dressing}" effects="${effectsDesc}"`)
        promptMap[seg.segmentId] = {
          videoPrompt: buildVideoPrompt(ir),
          negativePrompt: (ir.constraints?.avoid || []).join(', '),
          voiceDubbing: extractVoiceDubbing(ir),
          characterNameForVoice: segmentCharMap.get(seg.segmentId)?.characterName || '',
          voiceTypeForVoice: segmentCharMap.get(seg.segmentId)?.voiceType || 'zh_female_warm',
          modelReadyPrompt: compiled.modelReadyPrompt,
          modelReadyNegative: compiled.modelReadyNegative,
          summary: compiled.humanReadableSummary,
        }
      } catch (compErr: any) {
        console.warn(`[OptimizeVideoPrompt] Compile error ${seg.segmentId}:`, compErr.message)
        promptMap[seg.segmentId] = {
          videoPrompt: buildVideoPrompt(seg.visualIR || {}),
          negativePrompt: '',
          voiceDubbing: extractVoiceDubbing(seg.visualIR || {}),
          characterNameForVoice: segmentCharMap.get(seg.segmentId)?.characterName || '',
          voiceTypeForVoice: segmentCharMap.get(seg.segmentId)?.voiceType || 'zh_female_warm',
          modelReadyPrompt: (seg.visualIR?.subject || '') + '',
          modelReadyNegative: '',
          summary: '',
        }
      }
    }

    return {
      success: true,
      data: {
        prompts: promptMap,
        raw,
        vpIrCount: irSegments.length,
      },
    }
  })
}

/**
 * 从 VP-IR 视觉指令中提取配音台词
 * 优先从 action.details 中提取含对话描述的行
 * 若无精确对话，则根据 subject + action.type 推断角色在此分镜该说什么
 */
function extractVoiceDubbing(visualIR: any, videoSegment?: any): string {
  if (!visualIR) return ''

  // 1. 尝试从 action.details 中提取对话
  const details = visualIR.action?.details || ''
  if (details) {
    // 匹配 "说"、"道"、"问"、"喊"、"叫" 等对话行为
    const dialogueLines: string[] = []
    const lines = details.split(/[,，。！？\n]/)
    for (const line of lines) {
      const trimmed = line.trim()
      if (/说|道|问|喊|叫|吼|念|读|念白|对白|台词/i.test(trimmed)) {
        dialogueLines.push(trimmed)
      }
    }
    if (dialogueLines.length > 0) {
      return dialogueLines.join('。')
    }
  }

  // 2. 如果分镜有 narrativePurpose，基于它生成默认旁白提示
  const narrativePurpose = videoSegment?.narrativePurpose || ''
  if (narrativePurpose) {
    return `（此分镜配音：根据分镜「${narrativePurpose}」生成角色对应的台词或旁白）`
  }

  // 3. 从 subject 和 action type 推断
  const subject = visualIR.subject || ''
  const actionType = visualIR.action?.type || ''
  if (subject && actionType) {
    return `（分镜内容：${subject}，${actionType}。请根据剧本填充此分镜的配音台本）`
  }

  return ''
}

/**
 * 根据分镜内容匹配主要角色和音色
 * 通过分镜的 title / narrativePurpose / shotPattern 中是否包含角色名来判断
 */
function matchCharacterForSegment(
  segment: { title?: string | null; narrativePurpose?: string | null; shotPattern?: string | null; emotionArc?: string | null },
  characters: Array<{ characterName: string }>,
  voiceConfigs: Array<{ characterName: string; voiceType: string | null; speakingStyle: string | null }>,
): { characterName: string; voiceType: string } | null {
  if (!characters.length) return null

  // 将分镜相关的文本拼起来搜索
  const segmentText = [
    segment.title || '',
    segment.narrativePurpose || '',
    segment.shotPattern || '',
    segment.emotionArc || '',
  ].join(' ')

  // 按角色在文本中出现的顺序打分（优先匹配长名字）
  const scored = characters
    .map(c => {
      const name = c.characterName
      let score = 0
      if (segmentText.includes(name)) {
        score += name.length // 名字越长匹配越精确
        // 出现在 title 加分
        if (segment.title?.includes(name)) score += 5
        if (segment.narrativePurpose?.includes(name)) score += 3
      }
      return { ...c, score }
    })
    .filter(c => c.score > 0)
    .sort((a, b) => b.score - a.score)

  const bestChar = scored.length > 0 ? scored[0] : characters[0] // 没匹配到就用第一个角色

  // 找该角色的音色配置
  const voice = voiceConfigs.find(v => v.characterName === bestChar.characterName)
  return {
    characterName: bestChar.characterName,
    voiceType: voice?.voiceType || 'zh_female_warm',
  }
}

/**
 * 从项目 executionResults.plotBlueprint 提取场景摘要作为 storyText
 * 如果 executionResults 有 rawScript/storyText 优先使用，否则用 plotBlueprint.scenes 的场景摘要
 */
function extractStoryFromProject(project: any): string {
  try {
    const er = project.executionResults
    if (!er) {
      const desc = project.description || project.name || ''
      if (desc.startsWith('{')) {
        try {
          const parsed = JSON.parse(desc)
          if (parsed.designSpec) {
            const chars = parsed.designSpec.characterSpecs || []
            const scenes = parsed.designSpec.sceneSpecs || []
            const parts: string[] = []
            for (const c of chars) {
              if (c.characterName) parts.push(`角色：${c.characterName}，${c.gender || ''}，${c.age || ''}，${(c.physicalDescription || '').slice(0, 60)}`)
            }
            for (const s of scenes) {
              if (s.sceneName) parts.push(`场景：${s.sceneName}，${(s.description || '').slice(0, 60)}`)
            }
            return parts.join('\n') || project.name || ''
          }
        } catch {}
      }
      return desc
    }

    const erObj = typeof er === 'string' ? JSON.parse(er) : er

    // ⭐ 首要：plotBlueprint 有 scenes[].script 时输出完整剧本（下游 Agent 的唯一剧情事实源）
    if (erObj.plotBlueprint?.scenes?.length) {
      const scenes = erObj.plotBlueprint.scenes
      const hasFullScript = scenes.some((s: any) => s.script && s.script.length > 20)
      if (hasFullScript) {
        const scriptParts: string[] = []
        for (const scene of scenes) {
          scriptParts.push(`【场景 ${scene.sceneId || '?'}】${scene.name || ''}（${scene.env || ''}，${scene.time || ''}，${scene.weather || ''}）`)
          if (scene.characterVariants && Object.keys(scene.characterVariants).length > 0) {
            const variantInfo = Object.entries(scene.characterVariants)
              .map(([char, varName]) => `${char}（${(varName as string) || '默认状态'}）`)
              .join('，')
            scriptParts.push(`出场角色：${variantInfo}`)
          }
          scriptParts.push(scene.summary || '')
          scriptParts.push(`【剧本正文】${scene.script}`)
          scriptParts.push('')
        }
        return scriptParts.join('\n')
      }

      // 无 script 字段时回退到 summary
      const sceneParts: string[] = []
      for (const scene of scenes) {
        const summary = scene.summary || scene.description || ''
        if (summary) sceneParts.push(summary)
      }
      if (sceneParts.length > 0) {
        return sceneParts.join('\n')
      }
    }

    // 2. rawScript
    if (erObj.rawScript && typeof erObj.rawScript === 'string') {
      return erObj.rawScript
    }

    // 3. plotBlueprint 摘要
    if (erObj.plotBlueprint) {
      const bp = erObj.plotBlueprint
      const parts: string[] = []
      if (bp.theme) parts.push(`主题：${bp.theme}`)
      if (bp.mood) parts.push(`氛围：${bp.mood}`)
      if (bp.timeline) parts.push(`时间线：${bp.timeline}`)
      if (bp.worldView) parts.push(`世界观：${bp.worldView}`)
      if (bp.tags?.length) parts.push(`标签：${bp.tags.join('、')}`)
      return parts.join('\n')
    }

    return project.description || project.name || ''
  } catch {
    return project.description || project.name || ''
  }
}
