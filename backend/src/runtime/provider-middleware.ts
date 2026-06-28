/**
 * runtime/provider-middleware.ts — 统一大模型中间件层
 *
 * 前端提交任务 → 中间件自动识别用户使用的 model/provider →
 * 选择已注册的兼容方法 → 提交给大模型
 *
 * 架构:
 *   registerProvider(name, handler) → 注册 provider 及其能力
 *   selectHandler(provider, model, taskType) → 自动路由
 *   execute(input) → 统一入口
 *
 * 已注册 providers:
 *   aliyun/bailian  → LLM, Image, Video, TTS (阿里原生 API)
 *   volcengine      → LLM, Image, Video, TTS (火山引擎)
 *   deepseek        → LLM (OpenAI 兼容)
 *   siliconflow     → LLM, Image, TTS (OpenAI 兼容)
 *   openai          → LLM, Image (OpenAI 原生)
 *   custom          → LLM, Image (任何 OpenAI 兼容端点, ollama/vLLM)
 *   local           → LLM, Image (VIP 本地模型, 同 custom)
 *   kling           → Video (待接入, API Key 已支持注入)
 *   replicate       → Image, Video (待接入, API Key 已支持注入)
 */

import { prisma } from '../utils/index.js'
import { loadFullConfigV2 } from '../config/v2.js'
import { getRuntimeContext } from '../services/runtime-context.js'
import { writeLedger } from '../services/runtime-event-ledger.js'

// ── 类型定义 ──

export type TaskType = 'llm' | 'image' | 'video' | 'tts' | 'frame'

export interface ProviderHandlerInput {
  prompt?: string
  text?: string
  systemPrompt?: string
  userMessage?: string
  negativePrompt?: string
  negative_prompt?: string
  imageUrl?: string
  referenceImage?: string
  referenceImages?: string[]
  referenceImage2?: string
  imageUrl2?: string
  mode?: string
  model?: string
  ttsModel?: string
  size?: string
  aspectRatio?: string
  n?: number
  duration?: number
  ratio?: string
  voiceId?: string
  speed?: number
  format?: string
  temperature?: number
  maxTokens?: number
  [key: string]: unknown
}

export interface ProviderHandlerResult {
  url?: string
  imageUrl?: string
  content?: string
  taskId?: string
  duration?: number
  resolution?: string
  seed?: number
  totalTokens?: number
  revised_prompt?: string
  provider?: string
  [key: string]: unknown
}

export type ProviderHandler = (
  taskType: TaskType,
  input: ProviderHandlerInput,
) => Promise<ProviderHandlerResult>

// ── 能力表 ──

export interface ProviderCapability {
  provider: string
  label: string
  llm: boolean
  image: boolean
  video: boolean
  tts: boolean
  /** 是否使用 OpenAI 兼容协议 */
  openaiCompat: boolean
  /** 原生端点 URL（非 OpenAI 时使用） */
  nativeEndpoint?: string
  /** 映射到 worker-runtime.ts 的 provider handler 名 */
  handlerName?: string
  /** 是否需要 API Key */
  needsKey: boolean
  /** 环境变量 key 名 */
  envKey?: string
}

/**
 * Provider 能力注册表
 * 前端选了什么 provider/model → 这里找到对应 handler → 自动提交
 */
export const PROVIDER_CAPABILITIES: ProviderCapability[] = [
  {
    provider: 'aliyun',
    label: '阿里百炼',
    llm: true, image: true, video: true, tts: true,
    openaiCompat: false,
    handlerName: 'bailian',
    needsKey: true, envKey: 'ALIYUN_API_KEY',
  },
  {
    provider: 'bailian',
    label: '阿里百炼(alias)',
    llm: true, image: true, video: true, tts: true,
    openaiCompat: false,
    handlerName: 'bailian',
    needsKey: true, envKey: 'ALIYUN_API_KEY',
  },
  {
    provider: 'volcengine',
    label: '火山引擎',
    llm: true, image: true, video: true, tts: true,
    openaiCompat: false,
    handlerName: 'volcengine',
    needsKey: true, envKey: 'VOLCENGINE_API_KEY',
  },
  {
    provider: 'deepseek',
    label: 'DeepSeek',
    llm: true, image: false, video: false, tts: false,
    openaiCompat: true,
    handlerName: 'deepseek',
    needsKey: true, envKey: 'DEEPSEEK_API_KEY',
  },
  {
    provider: 'siliconflow',
    label: '硅基流动',
    llm: true, image: true, video: false, tts: true,
    openaiCompat: true,
    handlerName: 'siliconflow',
    needsKey: true, envKey: 'SILICONFLOW_API_KEY',
  },
  {
    provider: 'openai',
    label: 'OpenAI',
    llm: true, image: true, video: false, tts: false,
    openaiCompat: true,
    handlerName: 'openai',
    needsKey: true, envKey: 'OPENAI_API_KEY',
  },
  {
    provider: 'custom',
    label: '自定义端点',
    llm: true, image: true, video: false, tts: false,
    openaiCompat: true,
    handlerName: 'custom',
    needsKey: false,
  },
  {
    provider: 'local',
    label: '本地大模型',
    llm: true, image: true, video: false, tts: false,
    openaiCompat: true,
    handlerName: 'custom',
    needsKey: false,
  },
  {
    provider: 'kling',
    label: '可灵',
    llm: false, image: false, video: true, tts: false,
    openaiCompat: false,
    needsKey: true, envKey: 'KLING_API_KEY',
  },
  {
    provider: 'replicate',
    label: 'Replicate',
    llm: false, image: true, video: true, tts: false,
    openaiCompat: false,
    needsKey: true, envKey: 'REPLICATE_API_KEY',
  },
]

// ── 模型名 → provider 自动映射规则 ──

interface ModelMapping {
  /** 模型名前缀匹配模式 */
  prefix: string
  /** 匹配到的 provider */
  provider: string
  /** 匹配到的 taskType */
  taskType: TaskType
}

/**
 * 模型名 → Provider 自动识别表
 * 前端只要传 model 名，系统自动识别用哪个 provider
 */
export const MODEL_PROVIDER_MAP: ModelMapping[] = [
  // 阿里百炼 wan2.7 系列
  { prefix: 'wan2.7-i2v', provider: 'aliyun', taskType: 'video' },
  { prefix: 'wan2.7-t2v', provider: 'aliyun', taskType: 'video' },
  { prefix: 'wan2.7-r2v', provider: 'aliyun', taskType: 'video' },
  { prefix: 'wan2.7-videoedit', provider: 'aliyun', taskType: 'video' },
  { prefix: 'wan2.7-image', provider: 'aliyun', taskType: 'image' },
  { prefix: 'wan2.6-i2v', provider: 'aliyun', taskType: 'video' },
  { prefix: 'wan2.6-t2v', provider: 'aliyun', taskType: 'video' },
  { prefix: 'wan2.6-r2v', provider: 'aliyun', taskType: 'video' },
  { prefix: 'wan2.5-i2v', provider: 'aliyun', taskType: 'video' },
  { prefix: 'wan2.5-t2v', provider: 'aliyun', taskType: 'video' },
  { prefix: 'wan2.2-i2v', provider: 'aliyun', taskType: 'video' },
  { prefix: 'wan2.2-t2v', provider: 'aliyun', taskType: 'video' },
  { prefix: 'wan2.2-kf2v', provider: 'aliyun', taskType: 'video' },
  { prefix: 'wanx2.1-i2v', provider: 'aliyun', taskType: 'video' },
  { prefix: 'wanx2.1-t2v', provider: 'aliyun', taskType: 'video' },
  { prefix: 'wanx2.1-kf2v', provider: 'aliyun', taskType: 'video' },
  { prefix: 'qwen-image', provider: 'aliyun', taskType: 'image' },
  { prefix: 'wan2.6-t2i', provider: 'aliyun', taskType: 'image' },
  { prefix: 'wan2.5-t2i', provider: 'aliyun', taskType: 'image' },
  { prefix: 'wan2.2-t2i', provider: 'aliyun', taskType: 'image' },
  { prefix: 'wanx2.1-t2i', provider: 'aliyun', taskType: 'image' },
  { prefix: 'z-image', provider: 'aliyun', taskType: 'image' },
  // qwen 系列 LLM
  { prefix: 'qwen', provider: 'aliyun', taskType: 'llm' },
  { prefix: 'qwq', provider: 'aliyun', taskType: 'llm' },
  { prefix: 'qvq', provider: 'aliyun', taskType: 'llm' },
  { prefix: 'cosyvoice', provider: 'aliyun', taskType: 'tts' },
  { prefix: 'kimi', provider: 'aliyun', taskType: 'llm' },
  { prefix: 'glm', provider: 'aliyun', taskType: 'llm' },
  { prefix: 'deepseek', provider: 'deepseek', taskType: 'llm' },
  // happyhorse 视频
  { prefix: 'happyhorse-1.0-r2v', provider: 'aliyun', taskType: 'video' },
  { prefix: 'happyhorse-1.0-i2v', provider: 'aliyun', taskType: 'video' },
  { prefix: 'happyhorse-1.0-t2v', provider: 'aliyun', taskType: 'video' },
  { prefix: 'happyhorse-1.0-video-edit', provider: 'aliyun', taskType: 'video' },
  { prefix: 'happyhorse', provider: 'aliyun', taskType: 'video' },
  // 火山引擎
  { prefix: 'doubao', provider: 'volcengine', taskType: 'llm' },
  { prefix: 'Doubao', provider: 'volcengine', taskType: 'llm' },
  { prefix: 'doubao-seedream', provider: 'volcengine', taskType: 'image' },
  { prefix: 'Doubao-Seedream', provider: 'volcengine', taskType: 'image' },
  { prefix: 'doubao-seedance', provider: 'volcengine', taskType: 'video' },
  { prefix: 'Doubao-Seedance', provider: 'volcengine', taskType: 'video' },
  { prefix: 'doubao-tts', provider: 'volcengine', taskType: 'tts' },
  { prefix: 'seed', provider: 'volcengine', taskType: 'llm' },
  // 硅基流动
  { prefix: 'Pro/Qwen', provider: 'siliconflow', taskType: 'llm' },
  { prefix: 'Qwen', provider: 'siliconflow', taskType: 'llm' },
  { prefix: 'deepseek-ai', provider: 'siliconflow', taskType: 'llm' },
  { prefix: 'THUDM', provider: 'siliconflow', taskType: 'llm' },
  { prefix: 'fishaudio', provider: 'siliconflow', taskType: 'tts' },
  // OpenAI
  { prefix: 'gpt', provider: 'openai', taskType: 'llm' },
  { prefix: 'o1', provider: 'openai', taskType: 'llm' },
  { prefix: 'o3', provider: 'openai', taskType: 'llm' },
  { prefix: 'dall-e', provider: 'openai', taskType: 'image' },
]

// ── 视频模型格式路由表 ──
// 当 taskType=video 时，根据模型名前缀自动匹配 body 组装格式
// 格式模板名 → buildVideoBody() 中的 case 分支
export type VideoFormat = 'wan2.7-i2v' | 'wan2.6-legacy' | 'wan2.7-r2v' | 'r2v-flash' | 'i2v-flash' | 't2v-standard'

/**
 * 模型名前缀 → 视频格式映射
 * 新增视频模型只需在这加一行，不需要改 provider 代码
 */
export const VIDEO_FORMAT_MAP: { prefix: string; format: VideoFormat }[] = [
  // wan2.7+ 图生视频: input.media[{type:"first_frame"/"last_frame"}]
  { prefix: 'wan2.7-i2v', format: 'wan2.7-i2v' },
  // wan2.6 i2v: input.img_url + audio_url（含音频）
  { prefix: 'wan2.6-i2v-flash', format: 'wan2.6-legacy' },
  { prefix: 'wan2.6-i2v', format: 'wan2.6-legacy' },
  // wan2.5及以下 i2v: 走旧版 img_url 格式（不含 audio）
  { prefix: 'wan2.5-i2v', format: 'wan2.6-legacy' },
  { prefix: 'wan2.4-i2v', format: 'wan2.6-legacy' },
  { prefix: 'wan2.3-i2v', format: 'wan2.6-legacy' },
  { prefix: 'wan2.2-i2v', format: 'wan2.6-legacy' },
  { prefix: 'wan2.1-i2v', format: 'wan2.6-legacy' },
  { prefix: 'wanx2.1-i2v', format: 'wan2.6-legacy' },
  { prefix: 'wan2.2-kf2v', format: 'wan2.6-legacy' },
  { prefix: 'wanx2.1-kf2v', format: 'wan2.6-legacy' },
  // wan2.7-r2v 参考图+视频: input.media[{type:"reference_image"/"reference_video"}]
  { prefix: 'wan2.7-r2v', format: 'wan2.7-r2v' },
  { prefix: 'wan2.6-r2v-flash', format: 'r2v-flash' },
  { prefix: 'wan2.6-r2v', format: 'wan2.7-r2v' },
  { prefix: 'wan2.2-r2v', format: 'wan2.7-r2v' },
  // happyhorse 系列: input.media 通用（多类型: first_frame / reference_image / video）
  { prefix: 'happyhorse-1.0-r2v', format: 'wan2.7-r2v' },
  { prefix: 'happyhorse-1.0-i2v', format: 'wan2.7-i2v' },
  { prefix: 'happyhorse-1.0-t2v', format: 't2v-standard' },
  { prefix: 'happyhorse-1.0-video-edit', format: 'wan2.7-r2v' },
  // doubao/seedance 系列: input.media 通用格式（多图 reference_image）
  { prefix: 'Doubao-', format: 'wan2.7-r2v' },
  { prefix: 'doubao-', format: 'wan2.7-r2v' },
  // 文生视频 (t2v): input 无 media/img_url
  { prefix: 'wan2.7-t2v', format: 't2v-standard' },
  { prefix: 'wan2.6-t2v', format: 't2v-standard' },
  { prefix: 'wan2.5-t2v', format: 't2v-standard' },
  { prefix: 'wan2.2-t2v', format: 't2v-standard' },
  { prefix: 'wanx2.1-t2v', format: 't2v-standard' },
]

// ── 中间件核心 ──

export const providerMiddleware = {
  /**
   * 根据 model 名自动识别 provider 和 taskType
   * 例: "wan2.7-i2v" → { provider: "aliyun", taskType: "video" }
   *      "gpt-4o" → { provider: "openai", taskType: "llm" }
   */
  identify(model: string): { provider: string; taskType: TaskType } | null {
    for (const m of MODEL_PROVIDER_MAP) {
      if (model.startsWith(m.prefix)) {
        return { provider: m.provider, taskType: m.taskType }
      }
    }
    return null
  },

  /**
   * 获取 provider 的能力信息
   */
  getCapability(provider: string): ProviderCapability | undefined {
    return PROVIDER_CAPABILITIES.find(c => c.provider === provider)
  },

  /**
   * 检查 provider 是否支持指定的 taskType
   */
  supports(provider: string, taskType: TaskType): boolean {
    const cap = this.getCapability(provider)
    if (!cap) return false
    return cap[taskType] === true
  },

  /**
   * 列出所有支持指定 taskType 的 provider
   */
  listProviders(taskType: TaskType): string[] {
    return PROVIDER_CAPABILITIES
      .filter(c => c[taskType])
      .map(c => c.provider)
  },

  /**
   * 根据模型名获取视频 body 组装格式
   */
  getVideoFormat(model: string): VideoFormat {
    for (const m of VIDEO_FORMAT_MAP) {
      if (model.startsWith(m.prefix)) return m.format
    }
    // 默认兼容 wan2.7-i2v 格式
    return 'wan2.7-i2v'
  },

  /**
   * 构建视频请求 body（根据模型格式）
   * 统一入口：所有视频模型的 body 都在这里组装
   * 新增视频模型时，加 VIDEO_FORMAT_MAP 条目 + 此方法新 case
   */
  buildVideoBody(input: {
    model: string
    prompt: string
    imageUrl?: string
    imageUrl2?: string
    audioUrl?: string
    shotType?: string
    r2vMedia?: Array<{ type: string; url: string; reference_voice?: string }>
    referenceImages?: string[]
    duration?: number
    ratio?: string
    negativePrompt?: string
    seed?: number
  }): Record<string, any> {
    const format = this.getVideoFormat(input.model)
    const duration = Math.min(15, Math.max(2, Math.round(Number(input.duration || 5))))

    const body: Record<string, any> = {
      model: input.model,
      input: { prompt: input.prompt },
      parameters: {
        resolution: input.ratio === '9:16' ? '720P' : '720P',
        prompt_extend: true,
        watermark: false,
      },
    }

    // duration: t2v 和 wan2.2/wanx 等旧模型固定时长不支持自定义
    if (format !== 't2v-standard' && !(format === 'wan2.6-legacy' && input.model.match(/wan2\.[12]|wanx/))) {
      body.parameters.duration = duration
    }
    switch (format) {
      case 'wan2.7-r2v': {
        // 参考图+参考视频: input.media[{type:"reference_image"/"reference_video", url, reference_voice}]
        if (input.r2vMedia?.length) {
          const hasVideo = input.r2vMedia.some((m: any) => m.type === 'reference_video')
          if (!hasVideo) {
            // ⭐ 没有参考视频 → 降级为 i2v（仅传 reference_image）
            console.log(`[MediaBuild] wan2.7-r2v 无 reference_video，降级为 i2v 模式`)
            const media: Array<{ type: string; url: string }> = []
            for (const m of input.r2vMedia) {
              media.push({ type: m.type === 'reference_video' ? 'reference_image' : m.type, url: m.url })
            }
            body.input.media = media
          } else {
            body.input.media = input.r2vMedia.map((m: any) => ({
              type: m.type,
              url: m.url,
              ...(m.reference_voice ? { reference_voice: m.reference_voice } : {}),
            }))
          }
        } else if (input.referenceImages?.length) {
          // ⭐ 无 r2vMedia 但有参考图 → 降级为 i2v
          console.log(`[MediaBuild] r2vMedia为空，降级到i2v: ${input.referenceImages.length}张`)
          body.input.media = input.referenceImages.map((url: string) => ({
            type: 'reference_image',
            url: url.startsWith('http') ? url : new URL(url, process.env.IMAGE_BASE_URL || 'https://aigc.fushtn.com').href,
          }))
          // 同时修改 task type 为 i2v（适配器根据 model 判断，不修改 model name）
        } else {
          console.log(`[MediaBuild] ⚠️ r2vMedia和referenceImages都为空，无media`)
        }
        break
      }
      case 'r2v-flash': {
        // wan2.6-r2v-flash: input.reference_urls[] + prompt 即可
        // 参考阿里官方示例: reference_urls 是 URL 数组（图片+视频混用，自动识别）
        const allUrls = new Set<string>()
        // 收集所有图片和视频 URL
        if (input.r2vMedia?.length) {
          for (const m of input.r2vMedia) {
            if (m.url && !allUrls.has(m.url)) allUrls.add(m.url)
          }
        }
        if (input.referenceImages?.length) {
          for (const url of input.referenceImages) {
            if (url && !allUrls.has(url)) allUrls.add(url)
          }
        }
        if (input.imageUrl && !allUrls.has(input.imageUrl)) allUrls.add(input.imageUrl)
        if (input.imageUrl2 && !allUrls.has(input.imageUrl2)) allUrls.add(input.imageUrl2)
        body.input.reference_urls = [...allUrls]
        // shot_type 参数
        if (input.shotType) body.parameters.shot_type = input.shotType
        console.log(`[MediaBuild] r2v-flash: ${body.input.reference_urls.length}个参考资源`)
        break
      }
      case 'i2v-flash': {
        // wan2.6-i2v-flash: img_url + 参考图 → reference_urls（阿里新格式）
        // 参考阿里官方 i2v API: input.reference_urls[] 数组
        const allUrls: string[] = []
        if (input.imageUrl) allUrls.push(input.imageUrl)
        if (input.imageUrl2) allUrls.push(input.imageUrl2)
        if (input.referenceImages?.length) {
          input.referenceImages.forEach(url => { if (url && !allUrls.includes(url)) allUrls.push(url) })
        }
        if (input.r2vMedia?.length) {
          input.r2vMedia.forEach(m => { if (m.url && !allUrls.includes(m.url)) allUrls.push(m.url) })
        }
        if (allUrls.length > 0) body.input.reference_urls = allUrls
        if (input.audioUrl) body.input.audio_url = input.audioUrl
        if (input.shotType) body.parameters.shot_type = input.shotType
        console.log(`[MediaBuild] i2v-flash: ${allUrls.length}张参考图`)
        break
      }
      case 'wan2.7-i2v': {
        // 新版图生视频: input.media[{type:"first_frame"/"last_frame"/"reference_image", url}]
        const media: Array<{ type: string; url: string }> = []
        if (input.imageUrl) media.push({ type: 'first_frame', url: input.imageUrl })
        if (input.imageUrl2) media.push({ type: 'last_frame', url: input.imageUrl2 })
        // 多余的参考图也传入（如中帧图）
        if (input.r2vMedia?.length) {
          const seen = new Set([input.imageUrl, input.imageUrl2].filter(Boolean))
          for (const ref of input.r2vMedia) {
            if (!seen.has(ref.url)) {
              media.push({ type: 'reference_image', url: ref.url })
              seen.add(ref.url)
            }
          }
        }
        if (media.length > 0) body.input.media = media
        break
      }
      case 'wan2.6-legacy': {
        // 旧版: input.img_url + audio_url + shot_type
        if (input.imageUrl) body.input.img_url = input.imageUrl
        if (input.imageUrl2 && !input.model.includes('flash')) body.input.img_url2 = input.imageUrl2
        if (input.audioUrl) body.input.audio_url = input.audioUrl
        if (input.shotType) body.parameters.shot_type = input.shotType
        break
      }
      case 't2v-standard': {
        // 文生视频: prompt only，无图片
        break
      }
    }

    // 负面提示词：自动合并 AI 优化 + 默认动作相关负面词，保证动作自然
    const defaultNegative = '扭曲,僵硬,抽搐,不自然,瞬移,突变,闪切,抖动,抽风,limbs twisting,unnatural movement,twitching,jerkiness,teleport,肢体变形,多指,指节错位,面部扭曲,嘴型乱动,anime,卡通,cartoon,变形'
    const userNeg = input.negativePrompt || ''
    const combinedNeg = userNeg
      ? `${userNeg},${defaultNegative}`
      : defaultNegative
    body.input.negative_prompt = combinedNeg

    if (input.seed !== undefined) body.parameters.seed = input.seed

    return body
  },

  /**
   * 注册 handler 到 provider
   * 后续可以扩展到 kling/replicate 等
   */
  _handlers: new Map<string, ProviderHandler>(),

  register(provider: string, handler: ProviderHandler): void {
    this._handlers.set(provider, handler)
  },

  getHandler(provider: string): ProviderHandler | undefined {
    return this._handlers.get(provider)
  },

  /**
   * 统一入口：提交任务
   * 1. 通过 model 名自动识别 provider 和 taskType
   * 2. 通过用户配置确认
   * 3. 找到对应 handler 执行
   */
  async execute(input: {
    provider?: string
    model?: string
    taskType?: TaskType
    userId?: string
    prompt?: string
    text?: string
    systemPrompt?: string
    imageUrl?: string
    referenceImage?: string
    referenceImage2?: string
    referenceImages?: string[]
    negativePrompt?: string
    size?: string
    aspectRatio?: string
    n?: number
    duration?: number
    ratio?: string
    voiceId?: string
    speed?: number
    temperature?: number
    maxTokens?: number
    mode?: string
    [key: string]: unknown
  }): Promise<ProviderHandlerResult> {
    let { provider, model, taskType, userId } = input

    // Step 1: 没指定 provider 但有 model → 自动识别
    if (!provider && model) {
      const identified = this.identify(model)
      if (identified) {
        provider = identified.provider
        taskType = taskType || identified.taskType
        console.log(`[ProviderMiddleware] 自动识别: model=${model} → provider=${provider}, taskType=${taskType}`)
      }
    }

    // Step 2: 没识别到 → 用 userId 查用户配置（V2 单行）
    if (!provider && userId) {
      try {
        const v2 = await loadFullConfigV2(userId)
        if (v2) {
          // 根据 taskType 找到对应 provider
          const providerMap: Record<string, string> = { image: 'imageProvider', video: 'videoProvider', tts: 'ttsProvider' }
          const enabledMap: Record<string, string> = { image: 'imageEnabled', video: 'videoEnabled', tts: 'ttsEnabled' }
          const pField = providerMap[taskType || 'image']
          const eField = enabledMap[taskType || 'image']
          if (pField && eField) {
            const v = v2[pField as keyof typeof v2] as string
            const enabled = v2[eField as keyof typeof v2] as boolean
            if (v && enabled) {
              provider = v
            }
          }
          // 如果没匹配到 taskType 或没有 enabled，用第一个可用的
          if (!provider) {
            for (const cap of ['image', 'video', 'tts'] as const) {
              const p = v2[`${cap}Provider` as keyof typeof v2] as string
              const en = v2[`${cap}Enabled` as keyof typeof v2] as boolean
              if (p && en) { provider = p; break }
            }
          }
        }
      } catch { /* ignore */ }
    }

    // Step 3: 仍然没有 → fallback 到 aliyun/bailian
    if (!provider) {
      provider = 'aliyun'
      taskType = taskType || 'llm'
    }

    taskType = taskType || 'llm'

    // Step 4: 验证能力
    if (!this.supports(provider, taskType)) {
      throw new Error(`Provider ${provider} 不支持 ${taskType} 类型任务`)
    }

    // Step 5: 获取 handler
    const cap = this.getCapability(provider)
    const handlerName = cap?.handlerName || provider
    let handler = this._handlers.get(handlerName)

    if (!handler) {
      // fallback: 看看 worker-runtime.ts 的 providerHandlers 是否已注册
      // 由外部注入，这里留空
      throw new Error(`Provider ${provider} (${handlerName}) 的 handler 未注册`)
    }

    // Step 6: 执行
    const handlerInput: ProviderHandlerInput = { ...input, model: model || input.model }
    const result = await handler(taskType, handlerInput)

    // Runtime Event Ledger: 记录 provider 调用（非侵入，不阻塞主流程）
    writeLedger({
      userId: input.userId || 'unknown',
      projectId: input.projectId as string | undefined,
      traceId: input.traceId as string | undefined,
      executionId: input.executionId as string | undefined,
      stageId: input.stageId as string | undefined,
      capability: (false || taskType === 'llm') ? 'llm' 
                : taskType === 'image' ? 'image'
                : taskType === 'video' ? 'video'
                : 'tts',
      provider: provider || 'unknown',
      model: model || input.model || 'unknown',
      status: result.error ? 'failed' : 'success',
      latencyMs: input._startTime ? Date.now() - (input._startTime as number) : null,
      tokenUsage: result.totalTokens || null,
      errorMsg: result.error as string | undefined || null,
      sourcePath: 'provider-middleware',
      agentType: input.agentType as string | undefined,
      operationType: taskType?.toString(),
    })

    return result
  },
}

export default providerMiddleware
