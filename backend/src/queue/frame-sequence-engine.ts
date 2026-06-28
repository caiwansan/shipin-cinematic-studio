/**
 * queue/frame-sequence-engine.ts
 *
 * 帧序列引擎 — Frame Sequence Engine (FSE)
 *
 * 职责：
 *   把 optimizedShots[]（0.5 秒级逐帧描述）转化为关键帧图像序列。
 *   每帧基于前一帧做增量 img2img 生成，确保微表情/动作/特效的连贯性。
 *
 * 架构位置：
 *   Runtime Core 层 → processVideo → FSE → 图像 adapter → 视频合成器
 *
 * 输入：
 *   {
 *     optimizedShots: Array<{
 *       second: number        // 0, 0.5, 1, 1.5, ...
 *       camera: string        // 镜头语言
 *       action: string        // 角色动作
 *       expression: string    // 微表情
 *       dialogue: string      // 台词（如有）
 *       fx: string            // 特效音效
 *     }>,
 *     firstFrameUrl: string,  // 分镜图 URL（第 0 秒的图片）
 *     referenceImages: {
 *       characters: string[], // 角色引用图
 *       scenes: string[],     // 场景引用图
 *       props: string[],      // 道具引用图
 *     },
 *     model: string,          // 图像生成模型
 *     apiKey: string,
 *     baseUrl?: string,
 *     userId: string,
 *     projectId: string,
 *     duration: number,        // 总时长（秒）
 *     ratio: string,           // 画面比例 9:16
 *   }
 *
 * 输出：
 *   {
 *     frames: Array<{
 *       second: number,
 *       imageUrl: string,        // 生成的图片 URL
 *       camera: string,
 *       action: string,
 *       expression: string,
 *       dialogue: string,
 *       fx: string,
 *     }>,
 *     totalFrames: number,
 *     duration: number,
 *   }
 *
 * 宪法约束：
 *   - 禁止硬编码 provider/model，全部从 runtime payload 读取
 *   - 不感知具体 provider 实现（只通过 modelAdapterRegistry 调用）
 *   - 事件溯源记录每一步
 */

import { modelAdapterRegistry } from '../model-adapters/index.js'

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
  /** 图像生成的 callProvider 回调，复用 worker-runtime.ts 的 callProvider */
  callImageProvider: (taskType: string, userId: string, projectId: string, payload: any) => Promise<any>
}

export interface FSEResult {
  frames: Array<{
    second: number
    imageUrl: string
    camera: string
    action: string
    expression: string
    dialogue?: string
    fx: string
  }>
  totalFrames: number
  duration: number
}

/**
 * 生成单帧的图像 prompt
 * 基于首帧（第 0s 分镜图）的描述和当前帧需要的变化，生成 img2img prompt
 * 所有帧独立基于首帧，支持并发生成
 */
function buildFramePrompt(
  currentShot: FrameShot,
  firstShot: FrameShot,
  referenceImages: { characters: string[]; scenes: string[]; props: string[] }
): string {
  const parts: string[] = []

  // 镜头语言
  parts.push(`【镜头】${currentShot.camera}`)

  // 角色动作
  parts.push(`【动作】${currentShot.action}`)

  // 微表情（如果有）
  if (currentShot.expression) {
    parts.push(`【微表情】${currentShot.expression}`)
  }

  // 特效
  if (currentShot.fx) {
    parts.push(`【特效】${currentShot.fx}`)
  }

  // 相对于首帧的变化说明
  const changes: string[] = []
  if (firstShot.camera !== currentShot.camera) {
    changes.push(`镜头从"${firstShot.camera}"变为"${currentShot.camera}"`)
  }
  if (firstShot.expression !== currentShot.expression && firstShot.expression && currentShot.expression) {
    changes.push(`微表情从"${firstShot.expression}"变为"${currentShot.expression}"`)
  }
  if (firstShot.action !== currentShot.action && firstShot.action && currentShot.action) {
    changes.push(`动作从"${firstShot.action}"变为"${currentShot.action}"`)
  }
  if (changes.length > 0) {
    parts.push(`【变化】${changes.join('；')}`)
  }

  // 引用角色/场景/道具
  const refs: string[] = []
  if (referenceImages.characters.length > 0) refs.push('保持角色一致性')
  if (referenceImages.scenes.length > 0) refs.push('保持场景一致性')
  if (referenceImages.props.length > 0) refs.push('道具出现在对应位置')
  if (refs.length > 0) {
    parts.push(`【一致性】${refs.join('，')}`)
  }

  // 通用稳定性
  parts.push('保持人物、场景、道具在画面中的位置和形状稳定不变。仅按以上描述做出精确变化。人物面部特征、服装、发型保持一致。')

  return parts.join('\n')
}

/**
 * 调用图像 adapter 生成单帧
 * 通过 callProvider('image', ...) 复用现有的 provider 路由和事件溯源
 */
async function generateFrame(
  prompt: string,
  referenceImage: string,
  model: string,
  apiKey: string,
  baseUrl: string | undefined,
  userId: string,
  projectId: string,
  ratio: string,
  second: number,
  shot: FrameShot,
  /** callProvider 的回调 */
  callImageProvider: (taskType: string, userId: string, projectId: string, payload: any) => Promise<any>
): Promise<string> {
  const framePrompt = `【第 ${second} 秒】\n${prompt}\n\n注意：这是视频关键帧生成。请精确按照以上描述生成图像。人脸、场景、道具必须与上一帧保持高度一致，仅按描述变化。`

  try {
    // 事件溯源
    try {
      const { appendExecutionEvent } = await import('../kernel/event-sourcing/execution-event-store.js')
      appendExecutionEvent({
        taskId: `fse-${projectId}-${second}`,
        type: 'frame_generate',
        runtime: { userId, model },
        input: { second, model },
      })
    } catch (_) {}

    // ⭐ 复用 callProvider('image') 走完整的 provider 路由
    const result = await callImageProvider('image', userId, projectId, {
      model,
      apiKey,
      baseUrl,
      runtime: {
        model,
        apiKey,
        baseURL: baseUrl || '',
        userId,
        taskType: 'image',
        provider: '',
      },
      input: {
        prompt: framePrompt,
        imageUrl: referenceImage,
        ratio,
        size: ratio === '9:16' ? '1080x1920' : '1920x1080',
        n: 1,
        temperature: 0.01,
      },
      traceId: `fse-${projectId}-${second}`,
      projectId,
    })

    const url = result?.url || result?.imageUrl || result?.images?.[0] || ''
    if (!url) {
      throw new Error(`帧序列引擎：第 ${second} 秒生成返回空 URL`)
    }

    console.log(`[FSE] ✅ 第 ${second}s 帧生成成功: ${url.substring(0, 50)}...`)
    return url
  } catch (err: any) {
    console.error(`[FSE] ❌ 第 ${second}s 帧生成失败: ${err.message}`)

    // 事件溯源失败
    try {
      const { appendExecutionEvent } = await import('../kernel/event-sourcing/execution-event-store.js')
      appendExecutionEvent({
        taskId: `fse-${projectId}-${second}`,
        type: 'frame_failed',
        runtime: { userId, model },
        error: err.message,
      })
    } catch (_) {}

    throw err
  }
}

/**
 * 帧序列引擎主入口
 *
 * 逐帧生成流程：
 *   第 0s → 用分镜图作为首帧（不额外生成）
 *   第 0.5s+n → 全部基于第 0s 分镜图并发做 img2img
 */
export async function executeFrameSequence(input: FSEInput): Promise<FSEResult> {
  const { optimizedShots, firstFrameUrl, model, apiKey, baseUrl, userId, projectId, ratio } = input

  console.log(`[FSE] 🎬 帧序列引擎启动: ${optimizedShots.length} 帧, model=${model}, ratio=${ratio}`)

  const startTs = Date.now()
  const frames: FSEResult['frames'] = []

  // 第 0 秒用分镜图（不生成）
  frames.push({
    second: optimizedShots[0].second,
    imageUrl: firstFrameUrl,
    camera: optimizedShots[0].camera,
    action: optimizedShots[0].action,
    expression: optimizedShots[0].expression || '',
    dialogue: optimizedShots[0].dialogue || '',
    fx: optimizedShots[0].fx,
  })
  console.log(`[FSE] 📷 第 0s 使用分镜图: ${firstFrameUrl.substring(0, 50)}...`)

  // 第 1~N 帧基于第 0s 帧并发生成
  const remainingShots = optimizedShots.slice(1)
  const concurrentTasks = remainingShots.map(async (shot) => {
    const framePrompt = buildFramePrompt(shot, optimizedShots[0], input.referenceImages)
    const imageUrl = await generateFrame(
      framePrompt,
      firstFrameUrl,  // 全部基于第 0s 分镜图
      model,
      apiKey,
      baseUrl,
      userId,
      projectId,
      ratio,
      shot.second,
      shot,
      input.callImageProvider
    )
    return {
      second: shot.second,
      imageUrl,
      camera: shot.camera,
      action: shot.action,
      expression: shot.expression || '',
      dialogue: shot.dialogue || '',
      fx: shot.fx,
    }
  })

  // 并发等待所有帧完成
  const concurrentResults = await Promise.all(concurrentTasks)
  // 按 second 排序后追加
  concurrentResults.sort((a, b) => a.second - b.second)
  frames.push(...concurrentResults)

  const latency = Date.now() - startTs
  console.log(`[FSE] ✅ 帧序列完成: ${frames.length} 帧, ${latency}ms, 首帧=${frames[0]?.imageUrl?.substring(0, 40)}...`)

  return {
    frames,
    totalFrames: frames.length,
    duration: input.duration,
  }
}
