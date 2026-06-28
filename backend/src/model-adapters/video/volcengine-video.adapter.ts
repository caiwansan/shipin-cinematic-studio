/**
 * model-adapters/video/volcengine-video.adapter.ts
 *
 * 火山引擎视频适配器（豆包 Seedance）
 *
 * 支持的模型:
 *   doubao-seedance-1.0 豆包视频生成
 *   doubao-seedance-X 系列
 *
 * API: POST /api/v3/contents/generations/tasks
 * 格式: { model, content: [{type:"text",text}, {type:"image_url",image_url:{url}}] }
 *   content 元素当前版本要求传递 `--duration N --camerafixed false --watermark false` 等参数
 *
 * 种子视频 API 文档:
 *   POST https://ark.cn-beijing.volces.com/api/v3/contents/generations/tasks
 *   GET  https://ark.cn-beijing.volces.com/api/v3/contents/generations/tasks/:taskId
 *
 * 注: 异步轮询模式
 *   SDK 返回: ContentGenerationTask { id, status, content: { video_url, last_frame_url, file_url } }
 *
 * 验证时间: 2026-05-24 21:10（用户提供官方 curl 示例 + SDK 代码）
 */

import { ModelAdapter, ModelAdapterInput, ModelAdapterResult, RuntimePayload } from '../types.js'

// BASE_URL 由 execute 函数的 runtime.baseURL 传入，见 execute 内
// 此处不再设置全局 BASE_URL
let SUBMIT_URL = '' // 在 execute 中根据 runtime.baseURL 初始化

// 各 Seedance 模型支持的最大视频时长（秒）
// 根据火山引擎官方文档和 API 实际能力设定
const MODEL_MAX_DURATION: Record<string, number> = {
  'doubao-seedance-2-0-pro-260510': 12,
  'doubao-seedance-2-0-fast-260128': 5,
  'doubao-seedance-1-5-pro-251215': 12,
  'doubao-seedance-1-0-pro-fast-251015': 5,
  'doubao-seedance-1-0-pro-250528': 12,
  'Doubao-Seedance-1.0-lite-i2v': 12,
}

/** 获取模型支持的最大时长 */
function getVideoMaxDuration(model: string): number {
  // 优先精确匹配
  if (MODEL_MAX_DURATION[model]) return MODEL_MAX_DURATION[model]
  // 前缀匹配
  if (model.startsWith('doubao-seedance-2-0-pro') || model.startsWith('seedance-2-0-pro')) return 12
  if (model.startsWith('doubao-seedance-2-0') || model.startsWith('seedance-2-0')) return 5
  if (model.startsWith('doubao-seedance-1-5') || model.startsWith('seedance-1-5')) return 12
  if (model.startsWith('doubao-seedance-1-0') || model.startsWith('seedance-1-0')) return 5
  if (model.startsWith('doubao-seedance-1.0') || model.startsWith('seedance-1.0')) return 5
  return 12 // 默认最大 12 秒
}

/** 获取模型支持的最大参考图数量（根据火山引擎官方文档） */
function getMaxReferenceImages(model: string): number {
  // doubao-seedance-2-0-pro 系列官方支持最多9张参考图
  if (model.startsWith('doubao-seedance-2-0-pro') || model.startsWith('seedance-2-0-pro')) return 9
  // doubao-seedance-1-5-pro 系列实测 API 仅支持1张参考图，多图报 "role must be specified"
  if (model.startsWith('doubao-seedance-1-5') || model.startsWith('seedance-1-5')) return 1
  // Doubao-Seedance-1.0-lite-i2v 支持首帧/首尾帧图生视频 → 最多2张
  if (model.startsWith('Doubao-Seedance-1.0-lite') || model.startsWith('doubao-seedance-1.0-lite')) return 2
  // 其他模型默认只传首张
  return 1
}

export const volcengineVideoAdapter: ModelAdapter = {
  name: 'volcengine-video',
  supportedModels: ['doubao-seedance-1.0', 'doubao-seedance*', 'seedance*', 'doubao-video*', 'wan2.1-14b*'],
  taskTypes: ['video'],
  provider: 'volcengine',

  async execute(runtime: RuntimePayload, input: ModelAdapterInput): Promise<ModelAdapterResult> {
    const apiKey = runtime.apiKey || input.apiKey
    if (!apiKey) throw new Error('火山引擎 API Key 未配置')

    // 从 runtime.baseURL 动态读取，fallback 到环境变量或默认值
    const baseURL = runtime.baseURL || process.env.VOLCENGINE_BASE_URL || 'https://ark.cn-beijing.volces.com/api/v3'
    SUBMIT_URL = `${baseURL}/contents/generations/tasks`

    console.log(`[VolcVideo] apiKey 前10位: ${apiKey.substring(0, 10)}, 长度: ${apiKey.length}, baseURL: ${baseURL}`)

    const model = input.model || 'doubao-seedance-1.0'
    const prompt = input.prompt || ''
    const maxDuration = getVideoMaxDuration(model)
    // 若 input.duration 为默认 5 或未传，则使用该模型支持的最大时长
    // 若传了具体值，则做上限截断
    const duration = (input.duration && input.duration > 5) ? Math.min(input.duration, maxDuration) : maxDuration

    // ⭐ 从 input 读取可选参数（文档推荐的新方式：body 顶层传参）
    const seed = input.seed ?? undefined
    const cameraFixed = input.camera_fixed ?? false
    const generateAudio = input.generate_audio ?? true
    const returnLastFrame = input.return_last_frame ?? false
    const ratio = input.ratio || input.aspectRatio || undefined

    console.log(`[VolcVideo] model=${model}, hasImage=${!!input.imageUrl}, duration=${duration}, seed=${seed}, cameraFixed=${cameraFixed}, generateAudio=${generateAudio}, ratio=${ratio}`)

    // ⭐ 用 body 顶层参数代替旧方式的 `--` 字符串参数（文档推荐：强校验）
    // body 层已传 duration/watermark/seed/camera_fixed/resolution 等参数
    // text 中不再重复控制参数，token 留给画面描述

    // ⭐ 清理 prompt：去掉 Markdown 标题符号和特殊格式，避免火山 API 报 "Invalid content.text"
    let cleanPrompt = prompt
      .replace(/##\s*/g, '')     // 去掉 ## 标题
      .replace(/【([^】]+)】/g, '[$1]')  // 【】→ []
      .replace(/⚠️/g, '!')       // ⚠️ → !
      .replace(/[│┃]/g, ' | ')   // 竖线统一
      .replace(/\n{3,}/g, '\n\n')// 多空行缩减
      .trim()
    console.log(`[VolcVideo] prompt清理: ${prompt.length}字 → ${cleanPrompt.length}字`)

    // ⭐ 提取负面/需避免的指令，放入独立的 text 条
    let avoidDirective = ''
    const avoidMatch = cleanPrompt.match(/【需避免的内容】(.+)/)
    if (avoidMatch) {
      avoidDirective = avoidMatch[1].trim()
      cleanPrompt = cleanPrompt.replace(/【需避免的内容】.+/, '').trim()
    }

    // ⭐ prompt 处理策略分化：检测是否有分镜时间标记
    const hasStoryboard = /\[\d+[.-]\d+s\]/.test(cleanPrompt) || /## 逐秒镜头时间轴/.test(cleanPrompt)
    let sceneText = cleanPrompt

    if (hasStoryboard) {
      // ⭐ 分镜模式：保留时间标记和完整结构，不加额外指令
      // 模型需要看原文的时间轴、旁白、镜头切换指示
      sceneText = sceneText.replace(/\n{3,}/g, '\n\n').trim()
    } else {
      // ⭐ 普通模式：去掉分镜时间标记，保留纯画面描述
      sceneText = sceneText.replace(/\[\d+[.-]\d+s\]\s*/g, '').trim()
    }

    // 避免内容附加（如有）
    const avoidPart = avoidDirective ? ` | 避免: ${avoidDirective}` : ''
    // 禁止文字/字幕/水印出现的指令（仅非分镜模式附加）
    const noTextDirective = hasStoryboard ? '' : '画面中不能出现任何文字、字幕、LOGO、水印等视觉文字元素'
    // ⭐ 场景空间结构理解（非分镜模式附加）
    // ⭐ 场景物体物理结构描述（提高AI对物体交互的理解）
    const physicsRules = [
      '【空间规则】场景中的物体（门、窗、桌椅、道具等）都有固定的物理结构和空间位置，角色与物体交互时必须遵循现实物理规律。',
      '门是安装在门框上的固定结构，开门时门绕合页（铰链）旋转，不会整体移动或被"拉出"门框。',
      '双开木门：左右两扇门板各以侧边合页为轴向内或向外转动，门板始终连接在门框上。拉门时握住门把手向身体方向施力，门以合页轴为中心旋转打开。',
      '人体身高与参照物（门框、桌椅、建筑）的比例必须符合现实常理：成年人的高度约为单层门框高度的1/2至2/3，约为房屋总高的1/3至1/2。',
      '角色与物体交互时（如推门、拉门、坐下、倚靠、拿取物品），肢体位置必须与物体准确对齐，动作自然流畅不违背物理规律。',
    ].join('\n')
    const physicsDirective = hasStoryboard ? '' : physicsRules

    // 画面描述 + 避免指令 + 禁止文字指令 + 空间规则
    const combinedText = `${sceneText}${avoidPart ? `\n${avoidPart}` : ''}\n${noTextDirective}\n${physicsDirective}`.trim()

    const content: any[] = [
      { type: 'text', text: combinedText },
    ]

    // 图生视频：根据模型能力传入多张参考图
    // doubao-seedance-2-0-pro 官方支持最多 9 张参考图
    // doubao-seedance-1-5-pro 官方仅支持 2 张参考图
    const maxRefImages = getMaxReferenceImages(model)
    const refImages: string[] = []

    // 优先从 referenceImages 取，fallback 到 imageUrl
    if (input.referenceImages && Array.isArray(input.referenceImages) && input.referenceImages.length > 0) {
      const totalRefs = input.referenceImages.filter(r => r && typeof r === 'string' && r.trim()).length
      if (totalRefs > maxRefImages) {
        console.log(`[VolcVideo] ⚠️ 降级: ${model} 最多 ${maxRefImages} 张参考图，收到 ${totalRefs} 张，取前 ${maxRefImages} 张`)
      }
      for (const ref of input.referenceImages) {
        if (ref && typeof ref === 'string' && ref.trim()) {
          refImages.push(ref.trim())
          if (refImages.length >= maxRefImages) break
        }
      }
    } else if (input.imageUrl) {
      refImages.push(resolveImageUrl(input.imageUrl))
    }

    // ⭐ 过滤宽高比超限的图片：火山要求 0.40 ~ 2.50
    const filteredRefs: string[] = []
    for (const refUrl of refImages) {
      const isOk = await checkImageAspectRatio(refUrl)
      if (isOk) {
        filteredRefs.push(refUrl)
      } else {
        console.log(`[VolcVideo] ⚠️ 跳过宽高比超限的图片: ${refUrl.substring(0, 60)}`)
      }
    }
    if (filteredRefs.length === 0 && refImages.length > 0) {
      console.log(`[VolcVideo] ⚠️ 全部参考图宽高比超限，至少保留第一张`)
      filteredRefs.push(refImages[0])
    }

    for (const refUrl of filteredRefs) {
      content.push({
        type: 'image_url',
        image_url: { url: resolveImageUrl(refUrl) },
      })
    }

    console.log(`[VolcVideo] 提交: model=${model}, duration=${duration}s, prompt_len=${prompt.length}, refImages=${refImages.length}/${maxRefImages}`)
    const body: Record<string, any> = {
      model,
      content,
      duration,
      camera_fixed: cameraFixed,
      watermark: false,
    }
    // 按文档推荐的「新方式」将参数放在 body 顶层（强校验）而非写在 text 后面
    if (seed !== undefined) body.seed = seed
    if (generateAudio) body.generate_audio = true
    if (returnLastFrame) body.return_last_frame = true
    if (ratio) body.ratio = ratio

    // 打印实际请求体（前 500 字符）
    // ⭐ 重试机制：火山引擎 API 偶发 "role must be specified" 误报
    let lastError: Error | null = null
    for (let attempt = 0; attempt < 3; attempt++) {
      if (attempt > 0) {
        console.log(`[VolcVideo] 重试第 ${attempt + 1} 次...`)
        await new Promise(r => setTimeout(r, 1000))
      }
      try {
        // 打印完整请求体
        const bodyStr = JSON.stringify(body)
        console.log(`[VolcVideo] 完整请求体(${attempt+1}/3): ${bodyStr}`)
        console.log(`[VolcVideo] content 元素数: ${body.content?.length || 0}`)
        body.content?.forEach((c, i) => console.log(`  content[${i}]: type=${c.type}, has_role=${!!c.role}, text_len=${(c.text||'').length}, has_image_url=${!!c.image_url}`))
        const res = await fetch(SUBMIT_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
          body: JSON.stringify(body),
          signal: AbortSignal.timeout(30000),
        })
        if (res.ok) {
          const data = await res.json()
          const taskId = data?.id
          if (taskId) {
            console.log(`[VolcVideo] 任务已提交: ${taskId}`)
            return pollVolcVideoResult(taskId, apiKey, duration)
          }
          // 同步返回
          if (data?.data?.url) return { url: data.data.url, provider: 'volcengine' }
          if (data?.url) return { url: data.url, provider: 'volcengine' }
          throw new Error(`火山视频无 task_id: ${JSON.stringify(data).substring(0, 200)}`)
        }
        const errText = await res.text()
        lastError = new Error(`火山视频提交失败 (${res.status}): ${errText}`)
        // 如果是 429/限流/role 相关错误，重试
        if (errText.includes('role must be specified')) {
          console.log(`[VolcVideo] ⚠️ 捕获到 role 错误，保存完整 body 到文件用于调试`)
          const fs = require('fs')
          fs.writeFileSync('/tmp/volcvideo_debug_body.json', JSON.stringify(body, null, 2))
        }
        if (res.status === 429 || res.status >= 500 || errText.includes('role must be specified') || errText.includes('rate limit')) continue
        throw lastError
      } catch (e: any) {
        if (e.name === 'AbortError') { throw new Error('火山视频提交超时') }
        if (lastError && e !== lastError) { lastError = e; continue }
        throw e
      }
    }
    throw lastError || new Error('火山视频提交失败（多次重试后）')
  },
}

async function pollVolcVideoResult(taskId: string, apiKey: string, requestedDuration: number): Promise<ModelAdapterResult> {
  const queryUrl = `${SUBMIT_URL}/${taskId}`

  for (let i = 0; i < 300; i++) {
    const res = await fetch(queryUrl, {
      headers: { Authorization: `Bearer ${apiKey}` },
      signal: AbortSignal.timeout(15000),
    })

    if (!res.ok) throw new Error(`火山视频任务查询失败 (${res.status}): ${await res.text()}`)

    const data = await res.json()
    const status: string = data?.status || ''

    if (status === 'succeeded' || status === 'completed') {
      // 种子 API SDK 返回: { id, status, content: { video_url, last_frame_url, file_url }, ... }
      // 后端可能返回 output.url 或 data.contents[].video_url
      let url = ''
      if (data?.content?.video_url) {
        url = data.content.video_url
      } else if (data?.content?.file_url) {
        url = data.content.file_url
      } else if (data?.output?.url) {
        url = data.output.url
      } else if (data?.data?.contents?.[0]?.video_url) {
        url = data.data.contents[0].video_url
      } else if (data?.data?.url) {
        url = data.data.url
      } else if (data?.url) {
        url = data.url
      }
      if (url) return { url, duration: requestedDuration, resolution: data.resolution, provider: 'volcengine' }
      console.log(`[VolcVideo] 任务完成但无视频 URL，继续重试`)
    }

    if (status === 'failed' || data?.status === 'error') {
      const errMsg = data?.error?.message || data?.error?.code || data?.message || 'Unknown'
      throw new Error(`火山视频任务失败: ${errMsg}`)
    }

    if (i % 30 === 0) console.log(`[VolcVideo] 轮询中: ${i}s, status=${status}`)
    await new Promise(r => setTimeout(r, 1000))
  }

  // ⭐ 自救：300 秒超时后，火山视频可能仍在生成
  // 多等 90 秒（每 10 秒查一次），确保不因短暂波动而失败
  console.log(`[VolcVideo] ⚠️ 300 次轮询未完成，进入急救模式（额外等待 90s）`)
  for (let i = 0; i < 9; i++) {
    await new Promise(r => setTimeout(r, 10000))
    try {
      const res = await fetch(queryUrl, {
        headers: { Authorization: `Bearer ${apiKey}` },
        signal: AbortSignal.timeout(15000),
      })
      if (!res.ok) continue
      const data = await res.json()
      const status: string = data?.status || ''
      console.log(`[VolcVideo] 急救轮询: ${(i+1)*10}s, status=${status}`)
      if (status === 'succeeded' || status === 'completed') {
        let url = ''
        if (data?.content?.video_url) url = data.content.video_url
        else if (data?.content?.file_url) url = data.content.file_url
        else if (data?.output?.url) url = data.output.url
        else if (data?.data?.contents?.[0]?.video_url) url = data.data.contents[0].video_url
        else if (data?.data?.url) url = data.data.url
        else if (data?.url) url = data.url
        if (url) {
          console.log(`[VolcVideo] ✅ 急救模式成功获取视频: ${url.substring(0, 80)}...`)
          return { url, duration: requestedDuration, resolution: data.resolution, provider: 'volcengine' }
        }
      }
      if (status === 'failed' || data?.status === 'error') {
        const errMsg = data?.error?.message || data?.error?.code || data?.message || 'Unknown'
        throw new Error(`火山视频任务失败: ${errMsg}`)
      }
    } catch (e: any) {
      if (e.message?.includes('火山视频任务失败')) throw e
      console.log(`[VolcVideo] 急救轮询出错: ${e.message}，继续等待`)
    }
  }

  throw new Error('火山视频任务轮询超时 (急救模式也未恢复)')
}

/** 解析图片 URL：支持本地路径、相对路径 */
function resolveImageUrl(url: string): string {
  if (url.startsWith('http://') || url.startsWith('https://') || url.startsWith('data:')) return url
  if (url.startsWith('/')) {
    return (process.env.IMAGE_BASE_URL || 'https://aigc.fushtn.com') + url
  }
  return url
}

/**
 * 检测图片宽高比是否在火山引擎允许范围内（0.40 ~ 2.50）
 * 下载图片头部，解析 JPEG/SOF 或 PNG/IEND 获取尺寸
 * 如果检测失败（非图片/网络问题），默认通过以免阻塞流程
 */
async function checkImageAspectRatio(url: string): Promise<boolean> {
  const MIN_RATIO = 0.40
  const MAX_RATIO = 2.50
  try {
    const absUrl = resolveImageUrl(url)
    let fetchUrl = absUrl
    if (absUrl.startsWith('/')) {
      fetchUrl = (process.env.IMAGE_BASE_URL || 'https://aigc.fushtn.com') + absUrl
    }
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), 5000)
    const res = await fetch(fetchUrl, {
      signal: controller.signal,
      headers: { Range: 'bytes=0-65535' },
    })
    clearTimeout(timer)
    if (!res.ok) return true // 无法获取，默认通过
    const buffer = await res.arrayBuffer()
    const bytes = new Uint8Array(buffer)

    // JPEG: 查找 SOF0 (0xFF 0xC0) 或 SOF2 (0xFF 0xC2) 标记
    for (let i = 0; i < bytes.length - 9; i++) {
      if ((bytes[i] === 0xFF && (bytes[i+1] === 0xC0 || bytes[i+1] === 0xC2))) {
        const h = (bytes[i+5] << 8) | bytes[i+6]
        const w = (bytes[i+7] << 8) | bytes[i+8]
        if (w > 0 && h > 0) {
          const ratio = w / h
          const ok = ratio >= MIN_RATIO && ratio <= MAX_RATIO
          if (!ok) console.log(`[VolcVideo] 🚫 宽高比 ${ratio.toFixed(2)} 超出 [${MIN_RATIO}-${MAX_RATIO}]: ${url.substring(0, 60)} (${w}x${h})`)
          return ok
        }
      }
    }

    // PNG: IHDR 前 8 字节后第 4-7 字节宽，8-11 字节高
    // PNG signature: 89 50 4E 47 0D 0A 1A 0A, then IHDR at offset 16
    if (bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4E && bytes[3] === 0x47) {
      const w = (bytes[16] << 24) | (bytes[17] << 16) | (bytes[18] << 8) | bytes[19]
      const h = (bytes[20] << 24) | (bytes[21] << 16) | (bytes[22] << 8) | bytes[23]
      if (w > 0 && h > 0) {
        const ratio = w / h
        const ok = ratio >= MIN_RATIO && ratio <= MAX_RATIO
        if (!ok) console.log(`[VolcVideo] 🚫 宽高比 ${ratio.toFixed(2)} 超出 [${MIN_RATIO}-${MAX_RATIO}]: ${url.substring(0, 60)} (${w}x${h})`)
        return ok
      }
    }

    // WebP/其他格式或无法检测，默认通过
    return true
  } catch (e: any) {
    console.log(`[VolcVideo] ⚠️ 图片比例检测失败: ${url.substring(0, 60)} -> ${e.message}`)
    return true // 检测失败不阻塞
  }
}
