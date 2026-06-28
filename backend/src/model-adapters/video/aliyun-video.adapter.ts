/**
 * model-adapters/video/aliyun-video.adapter.ts
 *
 * 阿里百炼万相视频适配器
 *
 * 支持的模型:
 *   wan2.7-i2v, wan2.7-t2v, wan2.7-r2v
 *   wan2.6-i2v, wan2.6-t2v, wan2.6-r2v
 *   wan2.5-i2v, wan2.5-t2v
 *   wan2.2-i2v, wan2.2-t2v, wan2.2-kf2v
 *   wanx2.1-i2v, wanx2.1-t2v, wanx2.1-kf2v
 *   happyhorse-1.0-*
 *
 * 端点: 原生百炼 task/sumbit 端点
 * body 格式按模型类型选择:
 *   wan2.7-i2v → input.media[{type:"first_frame"/"last_frame"}]
 *   wan2.6-i2v → input.img_url + audio_url + shot_type
 *   wan2.7-r2v → input.media[{type:"reference_image"/"reference_video"}]
 *   t2v → prompt only
 *
 * 注: 所有费时任务的端点都是异步 submit + task_id 轮询
 *
 * 图片处理策略:
 *   ┌─ 阿里可直接访问的公网 URL（如 aigc.fushtn.com）→ 保留原 URL 发给阿里
 *   ├─ 阿里不可直接访问的 URL（如 COS、火山 TOS）→ 下载到 public/uploads/ → 用公网 URL
 *   └─ 下载失败 → 回退 base64 data URI（阿里部分模型可能不认）
 */

import { readFileSync, writeFileSync } from 'fs'
import { ModelAdapter, ModelAdapterInput, ModelAdapterResult } from '../types.js'
import { RuntimePayload } from '../../runtime/runtime-payload.js'
import { providerMiddleware } from '../../runtime/provider-middleware.js'
import { randomUUID } from 'crypto'
import { mkdir } from 'fs/promises'
import path from 'path'

const SUBMIT_URL = 'https://dashscope.aliyuncs.com/api/v1/services/aigc/video-generation/video-synthesis'
// 阿里官方文档: POST/GET https://dashscope.aliyuncs.com/api/v1/tasks/{task_id}
const QUERY_URL = 'https://dashscope.aliyuncs.com/api/v1/tasks/'
const IMAGE_BASE = process.env.IMAGE_BASE_URL || 'https://aigc.fushtn.com'

/** 阿里百炼能直接访问的公网域名列表 */
const ALI_ACCESSIBLE_DOMAINS = [
  'aigc.fushtn.com',
  'aigc.fushtn.cn',
  // 阿里自家域名
  'aliyuncs.com',
  'oss-cn',
  'oss-',
  '.aliyuncs.com',
]

/** 是否阿里百炼可直接访问该 URL */
function isAliAccessible(url: string): boolean {
  if (!url) return false
  if (url.startsWith('/uploads/')) return true // 本地相对路径，前端会代理
  if (url.startsWith('data:')) return false // data URI 阿里部分模型不认
  return ALI_ACCESSIBLE_DOMAINS.some(d => url.includes(d))
}

/** wan2.7 以上多模态格式视频 */
const MODERN_MODELS = ['wan2.7', 'wan2.6', 'wanx2.1', 'wan2.5', 'happyhorse']

/** 将图片转存到本地 public/uploads/，返回公网 URL */
async function ensurePublicUrl(url: string): Promise<string> {
  if (!url) return url
  if (url.startsWith('/uploads/')) {
    return `${IMAGE_BASE}${url}`
  }
  if (isAliAccessible(url)) {
    return url // 阿里能访问，原样返回
  }
  if (url.startsWith('data:')) {
    // data URI → 写成本地文件再用公网 URL
    try {
      const matches = url.match(/^data:(image\/(\w+));base64,(.+)$/)
      if (!matches) return url
      const ext = matches[2] === 'jpeg' ? 'jpg' : matches[2]
      const data = Buffer.from(matches[3], 'base64')
      const filename = `ali_temp_${Date.now()}_${randomUUID().slice(0, 8)}.${ext}`
      const localPath = `/root/shipin-cinematic-studio/backend/public/uploads/${filename}`
      writeFileSync(localPath, data)
      console.log(`[AliyunVideo] ✅ data URI 写为本地文件: ${filename} (${data.length}B)`)
      return `${IMAGE_BASE}/uploads/${filename}`
    } catch (e: any) {
      console.warn(`[AliyunVideo] ⚠️ data URI 转存失败: ${e?.message || e}`)
      return url
    }
  }

  // 远程下载到本地 public/uploads/
  try {
    const resp = await fetch(url, { signal: AbortSignal.timeout(10000) })
    if (!resp.ok) throw new Error(`HTTP ${resp.status}`)
    const buf = Buffer.from(await resp.arrayBuffer())
    const ext = url.match(/\.(jpe?g|png|webp|gif|bmp)/i)?.[1] || 'jpg'
    const filename = `ali_temp_${Date.now()}_${randomUUID().slice(0, 8)}.${ext}`
    const localPath = `/root/shipin-cinematic-studio/backend/public/uploads/${filename}`
    writeFileSync(localPath, buf)
    console.log(`[AliyunVideo] ✅ 远程下载转存本地: ${filename} (${buf.length}B)`)
    return `${IMAGE_BASE}/uploads/${filename}`
  } catch (e: any) {
    console.warn(`[AliyunVideo] ⚠️ 远程下载失败: ${url.substring(0, 60)} - ${e?.message || e}`)
    // 兜底：base64
    return url
  }
}

export const aliyunVideoAdapter: ModelAdapter = {
  name: 'aliyun-video',
  supportedModels: [
    'wan2.7-i2v', 'wan2.7-t2v', 'wan2.7-r2v', 'wan2.7-videoedit',
    'wan2.6-i2v', 'wan2.6-t2v', 'wan2.6-r2v',
    'wan2.5-i2v', 'wan2.5-t2v',
    'wan2.2-i2v', 'wan2.2-t2v', 'wan2.2-kf2v',
    'wanx2.1-i2v', 'wanx2.1-t2v', 'wanx2.1-kf2v',
    'happyhorse-1.0-r2v', 'happyhorse-1.0-i2v', 'happyhorse-1.0-t2v', 'happyhorse-1.0-video-edit',
    'happyhorse*', 'wan2*', 'wanx*',
  ],
  taskTypes: ['video'],
  provider: 'aliyun',

  async execute(runtime: RuntimePayload, input: ModelAdapterInput): Promise<ModelAdapterResult> {
    const apiKey = runtime.apiKey || ''
    if (!apiKey) throw new Error('阿里百炼 API Key 未配置')

    const model = input.model || ''
    const prompt = input.prompt || ''
    const duration = input.duration || 5
    const ratio = input.ratio || await resolveRatio(input.aspectRatio || '9:16')

    console.log(`[AliyunVideo] model=${model}, prompt=${prompt.substring(0, 40)}...`)

    console.log(`[AliyunVideo] input: referenceImages=${input.referenceImages?.length ?? 0}张, r2vMedia=${input.r2vMedia?.length ?? 0}个, imageUrl=${!!input.imageUrl}`)
    const body = providerMiddleware.buildVideoBody({
      model,
      prompt,
      imageUrl: input.imageUrl,
      imageUrl2: input.imageUrl2,
      referenceImages: input.referenceImages,
      audioUrl: input.audioUrl,
      shotType: input.shotType,
      duration,
      ratio,
      r2vMedia: input.r2vMedia,
      negativePrompt: input.negativePrompt,
    })

    // 打印媒体信息
    const media = body?.input?.media
    if (media?.length) {
      console.log(`[AliyunVideo] media: ${media.length}项`)
      for (let i = 0; i < media.length; i++) {
        console.log(`  media[${i}]: type=${media[i].type}, url=${(media[i].url || '').substring(0, 80)}`)
      }
    } else {
      console.log(`[AliyunVideo] ⚠️ media 为空，body_input_keys=${Object.keys(body?.input || {}).join(',')}`)
    }

    // 将所有图片 URL 转为阿里百炼可访问的公网 URL
    // 策略：对阿里不可直接访问的 URL（COS、火山 TOS、data URI），下载到本地
    // public/uploads/ 目录，用 aigc.fushtn.com 公网 URL 替代
    const isModern = MODERN_MODELS.some(p => model.startsWith(p))

    // 处理 reference_urls（flash 系列）
    if (body?.input?.reference_urls?.length) {
      console.log(`[AliyunVideo] reference_urls: ${body.input.reference_urls.length}项`)
      body.input.reference_urls = await Promise.all(
        body.input.reference_urls.map((url: string) => ensurePublicUrl(url))
      )
    }

    // 处理 img_url / img_url2
    if (body?.input?.img_url) {
      body.input.img_url = await ensurePublicUrl(body.input.img_url)
    }
    if (body?.input?.img_url2) {
      body.input.img_url2 = await ensurePublicUrl(body.input.img_url2)
    }

    // 处理 media.url（非 modern 模型）
    if (!isModern) {
      if (body?.input?.media?.length) {
        await Promise.all(
          body.input.media.map(async (m: any) => {
            m.url = await ensurePublicUrl(m.url)
          })
        )
      }
    } else {
      console.log(`[AliyunVideo] wan2.7+ 模型，media 项也尝试转存公网 URL`)
      if (body?.input?.media?.length) {
        await Promise.all(
          body.input.media.map(async (m: any) => {
            m.url = await ensurePublicUrl(m.url)
          })
        )
      }
    }

    console.log(`[AliyunVideo] body 构建完成: model=${body.model}, input_keys=${Object.keys(body.input||{}).join(",")}, img_url=${(body.input?.img_url||"").substring(0,80)}, img_url2=${body.input?.img_url2 ? "YES" : "NO"}`)

    // 提交异步任务
    const res = await fetch(SUBMIT_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
        'X-DashScope-Async': 'enable',
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(30000),
    })

    if (!res.ok) throw new Error(`阿里视频提交失败 (${res.status}): ${await res.text()}`)

    const data = await res.json()
    const taskId = data?.output?.task_id || data?.task_id || data?.request_id

    if (!taskId) {
      // 可能有同步返回的情况
      if (data?.output?.video_url) return { url: data.output.video_url, provider: 'aliyun' }
      if (data?.data?.url) return { url: data.data.url, provider: 'aliyun' }
      throw new Error(`阿里视频无 task_id: ${JSON.stringify(data).substring(0, 200)}`)
    }

    console.log(`[AliyunVideo] 任务已提交: ${taskId}`)

    // 轮询结果
    return pollAliyunVideoResult(taskId, apiKey, model)
  },
}

async function pollAliyunVideoResult(taskId: string, apiKey: string, model?: string): Promise<ModelAdapterResult> {
  const maxPoll = 300  // 最长等 5分钟（300次×1s）
  for (let i = 0; i < maxPoll; i++) {
    const res = await fetch(`${QUERY_URL}${taskId}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({}),
      signal: AbortSignal.timeout(15000),
    })

    if (!res.ok) throw new Error(`阿里视频任务查询失败 (${res.status}): ${await res.text()}`)

    const data = await res.json()
    const status = data?.output?.task_status || data?.status || ''

    if (status === 'SUCCEEDED' || status === 'succeeded') {
      const url = data?.output?.video_url || data?.data?.url || data?.url
      const duration = data?.output?.video_duration || undefined
      const resolution = data?.output?.video_resolution || data?.output?.resolution || undefined
      if (url) return { url, duration, resolution, provider: 'aliyun' }
      throw new Error(`阿里视频任务成功但无 URL: ${JSON.stringify(data).substring(0, 200)}`)
    }

    if (status === 'FAILED' || status === 'failed') {
      throw new Error(`阿里视频任务失败: ${data?.output?.message || data?.error || 'Unknown'}`)
    }

    if (i % 30 === 0) {
      console.log(`[AliyunVideo] 轮询中: ${i}s, status=${status}`)
    }

    await new Promise(r => setTimeout(r, 1000))
  }

  throw new Error(`阿里视频任务超时 (taskId=${taskId})`)
}

async function resolveRatio(aspectRatio: string | undefined): Promise<string> {
  if (!aspectRatio) return '9:16'
  if (aspectRatio === '9:16' || aspectRatio === '16:9') return aspectRatio
  return '9:16'
}
