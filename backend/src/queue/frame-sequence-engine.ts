/**
 * queue/frame-sequence-engine.ts
 *
 * 帧序列引擎 — Frame Sequence Engine (FSE)
 *
 * ⭐ 当前实现：Shot Scheduler（镜头调度器）
 *   不是逐帧 img2img 生成器，而是把长 prompt (10-30秒) 拆成多个短 shot (每个3-5秒)，
 *   每个 shot 独立调用豆包视频模型生成，shot 间通过 prompt 约束保证继承连续性。
 *
 * 架构位置：
 *   Runtime Core 层 → innerGenerateSingleVideo → FSE → 多个短 shot → volcengine adapter → 拼接
 *
 * 输入：
 *   {
 *     optimizedShots: array of { second, camera, action, expression, dialogue?, fx },
 *     firstFrameUrl: string,
 *     referenceImages: { characters, scenes, props },
 *     model: string,
 *     duration: number,
 *     ratio: string,
 *   }
 *
 * 输出：
 *   {
 *     shots: Array<{
 *       prompt: string,           // 该shot 的完整 video prompt
 *       referenceImages: string[], // 该 shot 的参考图
 *       duration: number,         // 该 shot 时长(秒)
 *       second: number,           // 起始秒数
 *       camera: string,
 *       action: string,
 *       expression: string,
 *       dialogue: string,
 *       fx: string,
 *     }>,
 *     totalShots: number,
 *     duration: number,
 *   }
 *
 * 宪法约束：
 *   - 禁止硬编码 provider/model
 *   - 不感知具体 provider 实现
 *   - 保持事件溯源兼容
 */

// ─── 类型定义 ───────────────────────────────────────

export interface FrameShot {
  second: number
  camera: string
  action: string
  expression: string
  dialogue?: string
  fx: string
}

export interface FSEInput {
  optimizedShots: FrameShot[]
  firstFrameUrl: string
  referenceImages: {
    characters: string[]
    scenes: string[]
    props: string[]
  }
  model: string
  apiKey: string
  baseUrl?: string
  userId: string
  projectId: string
  duration: number
  ratio: string
  negativePrompt?: string
  narrative?: string
  dialogue?: string
  effects?: string
  firstFrameDesc?: string
  lastFrameDesc?: string
  lastFrameUrl?: string
  characters?: Array<{ name: string; gender?: string; age?: string; clothing?: string; appearance?: string; emotion?: string }>
  scenes?: Array<{ name: string; environment?: string; lighting?: string; mood?: string; timeOfDay?: string }>
  storyboard?: { shotPattern?: string; emotion?: string; narrativePurpose?: string; duration?: number }
  videoStyle?: string
  styleTokens?: string
  callImageProvider?: (taskType: string, userId: string, projectId: string, payload: any) => Promise<any>
}

export interface FSEOutputShot {
  prompt: string
  referenceImages: string[]
  duration: number
  second: number
  camera: string
  action: string
  expression: string
  dialogue: string
  fx: string
}

export interface FSEOutput {
  shots: FSEOutputShot[]
  totalShots: number
  duration: number
}

// ─── 常量 ────────────────────────────────────────────

/** 每个 shot 的推荐时长（秒）。3-5 秒豆包视频模型效果最佳 */
const SHOT_DURATION = 4

/** 最小激活 FSE 的总时长（秒） */
const MIN_DURATION_FOR_FSE = 8

// ─── 工具函数 ────────────────────────────────────────

/**
 * 将 optimizedShots 按 SHOT_DURATION 分组
 * 返回 chunk 数组，每个 chunk 包含该时间段内的 shots + 起止秒数
 */
function chunkShots(
  shots: FrameShot[],
  totalDuration: number
): Array<{ startSecond: number; endSecond: number; chunkShots: FrameShot[] }> {
  if (shots.length === 0) {
    // 没有逐秒镜头脚本时，按 duration 平均分
    const numChunks = Math.ceil(totalDuration / SHOT_DURATION)
    const actualShotDuration = totalDuration / numChunks
    const result: Array<{ startSecond: number; endSecond: number; chunkShots: FrameShot[] }> = []
    for (let i = 0; i < numChunks; i++) {
      const start = Math.round(i * actualShotDuration * 10) / 10
      const end = Math.round(Math.min((i + 1) * actualShotDuration, totalDuration) * 10) / 10
      result.push({ startSecond: start, endSecond: end, chunkShots: [] })
    }
    return result
  }

  const numChunks = Math.max(1, Math.ceil(totalDuration / SHOT_DURATION))
  const actualShotDuration = totalDuration / numChunks
  const chunks: Array<{ startSecond: number; endSecond: number; chunkShots: FrameShot[] }> = []

  for (let i = 0; i < numChunks; i++) {
    const start = Math.round(i * actualShotDuration * 10) / 10
    const end = Math.round(Math.min((i + 1) * actualShotDuration, totalDuration) * 10) / 10
    const chunkShotsInRange = shots.filter(s => s.second >= start && s.second < end)
    chunks.push({ startSecond: start, endSecond: end, chunkShots: chunkShotsInRange })
  }

  return chunks
}

/**
 * 从 chunk 内的 shots 提取镜头运动描述
 */
function summarizeChunkAction(chunkShots: FrameShot[]): string {
  if (chunkShots.length === 0) return '场景持续'
  
  // 提取 camera 变化
  const cameras = [...new Set(chunkShots.map(s => s.camera).filter(Boolean))]
  // 提取 action
  const actions = [...new Set(chunkShots.map(s => s.action).filter(Boolean))]
  // 提取 expression
  const expressions = [...new Set(chunkShots.map(s => s.expression).filter(Boolean))]
  // 提取 fx
  const fxList = [...new Set(chunkShots.map(s => s.fx).filter(Boolean))]
  
  const parts: string[] = []
  if (cameras.length > 0) parts.push(`运镜: ${cameras.join(' → ')}`)
  if (actions.length > 0) parts.push(`动作: ${actions.join('，')}`)
  if (expressions.length > 0) parts.push(`表情: ${expressions.join(' → ')}`)
  if (fxList.length > 0) parts.push(`特效: ${fxList.join('，')}`)
  
  return parts.join(' | ') || '场景持续'
}

/**
 * 为每个 shot 构建它独有的视频 prompt
 */
function buildShotPrompt(
  chunkIndex: number,
  totalChunks: number,
  startSecond: number,
  endSecond: number,
  chunkShots: FrameShot[],
  firstFrameDesc: string,
  lastFrameDesc: string,
  narrative: string,
  dialogue: string,
  effects: string,
  characters: Array<{ name: string; gender?: string; age?: string; clothing?: string; appearance?: string; emotion?: string }> | undefined,
  scenes: Array<{ name: string; environment?: string; lighting?: string; mood?: string; timeOfDay?: string }> | undefined,
  storyboard: { shotPattern?: string; emotion?: string; narrativePurpose?: string; duration?: number } | undefined,
  videoStyle: string,
  styleTokens: string,
  isFirstShot: boolean,
  isLastShot: boolean,
  prevShotSummary: string,
): string {
  const parts: string[] = []

  // 视频时长
  parts.push(`视频时长：${Math.round(endSecond - startSecond)} 秒`)

  // 剧情描述（如果是多段，只取对应时间段）
  if (narrative) {
    // 对于中间的 shot，简化剧情描述以避免超出 token 限制
    if (totalChunks <= 1) {
      parts.push(`【剧情描述】\n${narrative}`)
    } else {
      // 多段模式：只传关键剧情，让模型自行补全
      const truncatedNarrative = narrative.length > 300
        ? narrative.substring(0, 300) + `...（第 ${chunkIndex + 1}/${totalChunks} 段）`
        : narrative
      parts.push(`【剧情描述】\n${truncatedNarrative}`)
    }
  }

  // 对话
  if (dialogue) {
    parts.push(`【对话】\n${dialogue}`)
  }

  // 特效音效
  if (effects) {
    parts.push(`【特效音效】\n${effects}`)
  }

  // 角色约束
  if (characters && characters.length > 0) {
    parts.push(`## [角色约束]
${characters.map((ch: any) => {
      const attrs = [`角色名：${ch.name || ''}`]
      if (ch.gender) attrs.push(`性别：${ch.gender}`)
      if (ch.age) attrs.push(`年龄：${ch.age}`)
      if (ch.clothing) attrs.push(`服装：${ch.clothing}`)
      if (ch.appearance) attrs.push(`外貌：${ch.appearance}`)
      return attrs.join(' | ')
    }).join('\n')}

⚠️ 角色约束优先级高于剧情描述。`)
  }

  // 场景约束
  if (scenes && scenes.length > 0) {
    parts.push(`## [场景约束]
${scenes.map((sc: any) => {
      const attrs = [`场景名：${sc.name || ''}`]
      if (sc.environment) attrs.push(`环境：${sc.environment}`)
      if (sc.lighting) attrs.push(`光照：${sc.lighting}`)
      if (sc.mood) attrs.push(`氛围：${sc.mood}`)
      if (sc.timeOfDay) attrs.push(`时间：${sc.timeOfDay}`)
      return attrs.join(' | ')
    }).join('\n')}

⚠️ 场景约束优先级高于剧情描述。`)
  }

  // 镜头语言
  if (storyboard) {
    parts.push(`## [镜头语言]
景别/拍摄模式：${storyboard.shotPattern || '未指定'}
情绪基调：${storyboard.emotion || '未指定'}
片段时长：${Math.round(endSecond - startSecond)} 秒`)
  }

  // 风格指令
  if (videoStyle) {
    if (styleTokens) {
      parts.push(`## 锁定视频风格
当前风格：【${videoStyle}】
风格特征：${styleTokens}
所有画面（光影、色彩、线条、材质、构图、渲染质感）都必须严格遵循此风格。`)
    } else {
      parts.push(`## 锁定视频风格
当前风格：【${videoStyle}】`)
    }
  }

  // 该 shot 的逐秒镜头描述
  const shotDescLines = chunkShots.map((shot: FrameShot) => {
    const sec = Math.round(shot.second - startSecond)
    const camera = shot.camera || ''
    const action = shot.action || ''
    const expression = shot.expression || ''
    const fx = shot.fx || ''
    const parts = [`【第${sec}秒】`]
    if (camera) parts.push(`运镜: ${camera}`)
    if (action) parts.push(`动作: ${action}`)
    if (expression) parts.push(`表情: ${expression}`)
    if (fx) parts.push(`特效: ${fx}`)
    return parts.join(' | ')
  }).join('\n')

  if (shotDescLines) {
    parts.push(`\n## 逐秒镜头脚本（${startSecond}-${endSecond} 秒）\n${shotDescLines}\n`)
  } else {
    // 没有逐秒描述时，用简短的动作摘要
    const actionSummary = summarizeChunkAction(chunkShots)
    parts.push(`\n## 镜头描述（${startSecond}-${endSecond} 秒）\n${actionSummary}\n`)
  }

  // ⭐ 帧间继承约束 — 这是 FSE 的核心价值
  if (!isFirstShot) {
    parts.push(`\n## [帧间继承约束]`)
    parts.push(`⚠️ 本段不是独立视频。它必须严格继承上一段的全部状态作为起始条件。`)
    parts.push(`上一段的状态摘要：${prevShotSummary || '场景持续、角色位置不变'}`)
    parts.push(`- 角色位置、姿势、朝向必须与上一段结尾完全一致。禁止角色重新出现或瞬移。`)
    parts.push(`- 角色服装、发型、体型、面部特征必须与上一段保持完全一致。`)
    parts.push(`- 场景环境、光照、氛围、物体位置必须与上一段结尾完全一致。`)
    parts.push(`- 手持物品、道具必须连续存在，不能消失或凭空出现。`)
    parts.push(`- 禁止：角色忽然变矮/变高、肢体扭曲、身体比例变化、角色穿透物体、背景跳变。`)
    parts.push(`- ⚠️ 物理规则：人体关节不可反向弯曲，物品不可悬浮，影子方向须符合光源位置。`)
  } else {
    parts.push(`\n## [物理一致性约束]`)
    parts.push(`- 保持人物、场景、道具在画面中的位置和形状稳定不变。`)
    parts.push(`- 角色身体比例不得突变，肢体不得变形或消失。`)
    parts.push(`- 禁止：角色忽然变矮/变高、肢体扭曲、手部物品消失、身体嵌入物体、角色穿透物体。`)
  }

  // 参考图片说明
  const refLines: string[] = []
  if (isFirstShot) refLines.push('首帧图（视频开头画面，必须严格以此图为起始画面）')
  if (isLastShot) refLines.push('尾帧图（视频结尾画面）')
  if (refLines.length > 0) {
    parts.push(`\n## 参考图片使用说明\n${refLines.join('\n')}\n请严格按以下规则使用参考图片：\n- 视频大模型需在参考图之间自动生成连贯的过渡动画\n- 保持人物、场景、道具连续\n- ⚠️ 物理规则同上`)
  }

  parts.push(`\n（注：这是视频的第 ${chunkIndex + 1}/${totalChunks} 段，要求在该时间段内独立生成一段连贯的视频片段）`)

  return parts.join('\n\n')
}

/**
 * 调度 shot：把长 prompt 拆成多个短 video prompt
 */
export function scheduleShots(input: FSEInput): FSEOutput {
  const {
    optimizedShots,
    duration,
    narrative,
    dialogue: dialogueText,
    effects,
    firstFrameDesc,
    lastFrameDesc,
    characters,
    scenes,
    storyboard,
    videoStyle,
    referenceImages,
  } = input

  console.log(`[FSE] 🎬 Shot Scheduler 启动: ${duration}s, ${optimizedShots.length} 帧镜头, videoStyle=${videoStyle || '无'}`)

  // 按 SHOT_DURATION 分组
  const chunks = chunkShots(optimizedShots, duration)

  console.log(`[FSE] 📦 拆分为 ${chunks.length} 个 shot`)

  // styleTokens 放在 videoStyle 之后，这里从 input 取
  const styleTokens = (input as any).styleTokens || ''

  const shots: FSEOutputShot[] = []
  let prevShotSummary = ''

  for (let i = 0; i < chunks.length; i++) {
    const chunk = chunks[i]
    const isFirstShot = i === 0
    const isLastShot = i === chunks.length - 1
    const chunkDuration = Math.round((chunk.endSecond - chunk.startSecond) * 10) / 10

    // 构建该 shot 的 prompt
    const prompt = buildShotPrompt(
      i,
      chunks.length,
      chunk.startSecond,
      chunk.endSecond,
      chunk.chunkShots,
      firstFrameDesc || '',
      lastFrameDesc || '',
      narrative || '',
      dialogueText || '',
      effects || '',
      characters,
      scenes,
      storyboard,
      videoStyle || '',
      styleTokens,
      isFirstShot,
      isLastShot,
      prevShotSummary,
    )

    // 分配参考图：首帧图只在第一 shot 使用；尾帧图只在最后 shot 使用；角色图全部使用
    const shotRefImages: string[] = []
    if (isFirstShot && input.firstFrameUrl) {
      shotRefImages.push(input.firstFrameUrl)
    }
    if (isLastShot && input.lastFrameUrl) {
      shotRefImages.push(input.lastFrameUrl)
    }
    // 角色/场景参考图只在第一 shot 传入，避免重复浪费
    if (isFirstShot) {
      for (const key of ['characters', 'scenes', 'props'] as const) {
        for (const url of referenceImages[key]) {
          if (url && !shotRefImages.includes(url)) {
            shotRefImages.push(url)
          }
        }
      }
    }

    // 合并 chunk 内的 shot 信息
    const combinedCamera = chunk.chunkShots.map(s => s.camera).filter(Boolean).join(' → ') || ''
    const combinedAction = chunk.chunkShots.map(s => s.action).filter(Boolean).join('，') || ''
    const combinedExpression = chunk.chunkShots.map(s => s.expression).filter(Boolean).join(' → ') || ''
    const combinedDialogue = chunk.chunkShots.map(s => s.dialogue || '').filter(Boolean).join(' ') || ''
    const combinedFx = chunk.chunkShots.map(s => s.fx).filter(Boolean).join('，') || ''

    shots.push({
      prompt,
      referenceImages: shotRefImages,
      duration: chunkDuration,
      second: chunk.startSecond,
      camera: combinedCamera,
      action: combinedAction,
      expression: combinedExpression,
      dialogue: combinedDialogue,
      fx: combinedFx,
    })

    // 更新 prevShotSummary 供下一 shot 继承
    prevShotSummary = summarizeChunkAction(chunk.chunkShots)
  }

  console.log(`[FSE] ✅ Shot 调度完成: ${shots.length} shots, ${duration}s 总时长`)

  return {
    shots,
    totalShots: shots.length,
    duration,
  }
}

/**
 * 判断是否应该使用 FSE shot 调度
 */
export function shouldUseFSE(duration: number, optimizedShots: any[]): boolean {
  return duration >= MIN_DURATION_FOR_FSE && (optimizedShots.length > 0 || duration > 8)
}

/**
 * 旧接口兼容：executeFrameSequence 现在委托给 scheduleShots
 * 保留导出以避免破坏调用方（如果有的话）
 */
export async function executeFrameSequence(input: FSEInput): Promise<{ frames: any[]; totalFrames: number; duration: number }> {
  console.log(`[FSE] ⚠️ executeFrameSequence 已弃用，使用 scheduleShots 替代`)
  const output = scheduleShots(input)
  return {
    frames: output.shots.map(s => ({
      second: s.second,
      imageUrl: '',
      camera: s.camera,
      action: s.action,
      expression: s.expression,
      dialogue: s.dialogue,
      fx: s.fx,
    })),
    totalFrames: output.totalShots,
    duration: output.duration,
  }
}
