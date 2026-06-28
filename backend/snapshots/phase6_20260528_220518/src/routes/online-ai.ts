import { FastifyInstance } from 'fastify'

// ─── Mock Task Store ────────────────────────────────
const videoTasks = new Map<string, { prompt: string; duration?: number; status: string; video_url?: string }>()

// ─── Log Helper ─────────────────────────────────────
function logCall(endpoint: string, params: any, result: any) {
  const timestamp = new Date().toISOString()
  console.log(`[OnlineAI] ${timestamp} | ${endpoint} | params=${JSON.stringify(params)} | result=${JSON.stringify(result)}`)
}

// ─── Rules-based Prompt Classification ──────────────
const RISKY_KEYWORDS = ['暴力', '血腥', '色情', '政治', '赌博', '毒品', '武器', '杀戮', '恐怖']
const NEUTRAL_KEYWORDS = ['风景', '人物', '建筑', '静物', '城市', '自然']

function classifyPrompt(prompt: string): { bestPrompt: string; classification: 'risky' | 'neutral' | 'best'; alternatives?: string[] } {
  const lower = prompt.toLowerCase()
  for (const kw of RISKY_KEYWORDS) {
    if (lower.includes(kw)) {
      return {
        bestPrompt: prompt,
        classification: 'risky',
        alternatives: [
          `${prompt}（已过滤敏感内容）`,
          `风格化处理: ${prompt}`,
          `抽象表现: ${prompt}`,
        ],
      }
    }
  }
  for (const kw of NEUTRAL_KEYWORDS) {
    if (lower.includes(kw)) {
      return {
        bestPrompt: prompt,
        classification: 'neutral',
        alternatives: [
          `${prompt}，电影级光影`,
          `${prompt}，8K超高清`,
          `${prompt}，广角镜头`,
        ],
      }
    }
  }
  return {
    bestPrompt: prompt,
    classification: 'best',
    alternatives: [
      `${prompt}，电影级画质`,
      `${prompt}，高饱和度色彩`,
      `${prompt}，戏剧性光照`,
    ],
  }
}

// ─── Agent Advice ───────────────────────────────────
const ADVICE_POOL = [
  { recommendation: '使用更具体的场景描述，添加时间、光线、环境细节', confidence: 0.85, reasoning: '当前提示词过于抽象，缺乏视觉锚点' },
  { recommendation: '增加多镜头序列描述，提升故事连贯性', confidence: 0.72, reasoning: '单镜头难以传递完整叙事，建议扩展为3-5个镜头' },
  { recommendation: '降低情绪强度到70%以下，防止观众疲劳', confidence: 0.91, reasoning: '当前情绪曲线过陡，建议缓和高潮部分' },
  { recommendation: '添加环境音效描述，增强沉浸感', confidence: 0.68, reasoning: '视觉内容丰富但缺少氛围层次' },
  { recommendation: '使用高对比度调色方案突出主角', confidence: 0.78, reasoning: '角色在画面中不够突出，需要视觉引导' },
  { recommendation: '缩短开场镜头时长，快速进入剧情', confidence: 0.83, reasoning: '开场节奏偏慢，容易流失观众注意力' },
  { recommendation: '增加角色微表情细节，提升情感传达', confidence: 0.76, reasoning: '角色情感表现不足，需细化面部表情' },
  { recommendation: '采用动态镜头跟随主体运动', confidence: 0.81, reasoning: '静态镜头无法有效表现动作场景的张力' },
]

// ─── Router ─────────────────────────────────────────
export default async function registerOnlineAIRoutes(fastify: FastifyInstance) {
  // POST /api/v1/online/image — 图片生成（Mock）
  fastify.post('/api/v1/online/image', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    const { prompt, style, resolution, seed } = request.body as any

    if (!prompt) {
      return reply.status(400).send({ error: 'prompt is required' })
    }

    const image_url = `https://picsum.photos/seed/${seed || Date.now()}/${resolution || '1024x1024'}`

    const result = {
      image_url,
      style: style || 'default',
      resolution: resolution || '1024x1024',
      seed: seed || Date.now(),
      provider: 'mock-online-ai',
    }

    logCall('/api/v1/online/image', { prompt, style, resolution, seed }, result)
    return result
  })

  // POST /api/v1/online/video — 视频生成（异步 Mock）
  fastify.post('/api/v1/online/video', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    const { prompt, duration, resolution } = request.body as any

    if (!prompt) {
      return reply.status(400).send({ error: 'prompt is required' })
    }

    const taskId = `vid-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
    videoTasks.set(taskId, { prompt, duration, status: 'pending' })

    setTimeout(() => {
      const task = videoTasks.get(taskId)
      if (task) {
        task.status = 'completed'
        task.video_url = `https://example.com/videos/${taskId}.mp4`
      }
    }, 10000)

    const result = {
      taskId,
      status: 'pending',
      message: '视频任务已提交，请稍后查询',
    }

    logCall('/api/v1/online/video', { prompt, duration, resolution }, result)
    return result
  })

  // GET /api/v1/online/video/:taskId — 查询视频任务状态
  fastify.get('/api/v1/online/video/:taskId', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    const { taskId } = request.params as any
    const task = videoTasks.get(taskId)

    if (!task) {
      return reply.status(404).send({ error: '任务未找到', taskId })
    }

    const result = {
      taskId,
      status: task.status,
      video_url: task.video_url || null,
    }

    return result
  })

  // POST /api/v1/online/prompt-optimize — 提示词优化
  fastify.post('/api/v1/online/prompt-optimize', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    const { prompt, history } = request.body as any

    if (!prompt) {
      return reply.status(400).send({ error: 'prompt is required' })
    }

    const result = classifyPrompt(prompt)

    if (history && Array.isArray(history) && history.length > 0) {
      result.bestPrompt = `${result.bestPrompt}（参考历史: ${history.slice(-3).join('; ')}）`
    }

    logCall('/api/v1/online/prompt-optimize', { prompt, history: history?.length }, result)
    return result
  })

  // POST /api/v1/online/agent-advise — 智能体建议
  fastify.post('/api/v1/online/agent-advise', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    const { context, options } = request.body as any

    const advice = ADVICE_POOL[Math.floor(Math.random() * ADVICE_POOL.length)]

    const result = {
      ...advice,
      context: context || {},
      options: options || {},
    }

    logCall('/api/v1/online/agent-advise', { contextKeys: context ? Object.keys(context) : [], options }, result)
    return result
  })

  // GET /api/v1/online/status — 健康检查（无需鉴权）
  fastify.get('/api/v1/online/status', async () => {
    return {
      service: 'online-ai',
      status: 'ok',
      version: '1.0.0',
      timestamp: new Date().toISOString(),
    }
  })
}
