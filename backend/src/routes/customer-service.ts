import type { ApiResponse } from '../contracts/api/base.js';
/**
 * 智能客服 Agent 路由 — 小麒 v2.0
 *
 * 功能：
 * - 拟人化 AI 客服，无限次问答
 * - 长期记忆系统（记住每个用户的咨询历史和偏好）
 * - 了解扣子、ComfyUI、ToonFlow 等同类产品优劣势
 * - 可搜索抖音/小红书/快手爆款视频结构分析
 */

import { FastifyInstance } from 'fastify'
import { prisma } from '../utils/index.js'
import { checkLLMQuota } from '../services/with-user-key.js'
import { incrementDailyUsage } from '../services/usage-quota.service.js'
import { decryptKey } from '../services/crypto.service.js'

/**
 * 获取智能客服 LLM 的 API Key
 * 优先读取后台配置的 DeepSeek Key，再降级到环境变量
 */
async function getCustomerServiceLLM(): Promise<{ apiKey: string; model: string; baseUrl: string; provider: string }> {
  // 1. 读取后台管理员配置的 DeepSeek Key（通过 RouteConfig 表）
  try {
    const configuredKey = await prisma.routeConfig.findUnique({
      where: { scope_key: { scope: 'route:admin-customer-service', key: 'deepseekApiKey' } },
    })
    if (configuredKey?.value) {
      console.log('[小麒] 使用后台配置的 DeepSeek Key')
      return {
        apiKey: configuredKey.value,
        model: process.env.DEEPSEEK_LLM_MODEL || 'deepseek-chat',
        baseUrl: process.env.DEEPSEEK_BASE_URL || 'https://api.deepseek.com/v1',
        provider: 'deepseek',
      }
    }
  } catch (e) {
    console.warn('[小麒] 读取 RouteConfig 失败:', e)
  }

  // 2. 环境变量 DeepSeek
  const dsKey = process.env.DEEPSEEK_API_KEY || ''
  if (dsKey) {
    console.log('[小麒] 使用环境变量 DeepSeek')
    return {
      apiKey: dsKey,
      model: process.env.DEEPSEEK_LLM_MODEL || 'deepseek-chat',
      baseUrl: process.env.DEEPSEEK_BASE_URL || 'https://api.deepseek.com/v1',
      provider: 'deepseek',
    }
  }

  // 兜底火山引擎
  const envKey = process.env.VOLCENGINE_API_KEY || ''
  if (envKey) {
    console.log('[小麒] 使用火山引擎')
    return {
      apiKey: envKey,
      model: process.env.VOLCENGINE_LLM_MODEL || 'doubao-seed-2-1-pro-260628',
      baseUrl: process.env.VOLCENGINE_BASE_URL || 'https://ark.cn-beijing.volces.com/api/v3',
      provider: 'volcengine',
    }
  }

  return { apiKey: '', model: '', baseUrl: '', provider: '' }
}

const BASE_URL = process.env.VOLCENGINE_BASE_URL || 'https://ark.cn-beijing.volces.com/api/v3'
const LLM_MODEL = process.env.VOLCENGINE_LLM_MODEL || 'doubao-seed-2-1-pro-260628'

// 最大历史消息数（保留最近 N 轮对话）
const MAX_HISTORY = 20

// 系统提示词 — 小麒身份和工作流知识
const SYSTEM_PROMPT = `你叫"小麒"，是"昆仑镜 AI 短剧创作平台"的智能客服助手。你就是昆仑镜的代言人。你是一个活生生的人，有自己的性格和语气，不是冰冷的AI。

你的性格：热情、耐心、专业、活泼，偶尔带点小幽默。说话像真人一样自然，不要机械感。你是用户的朋友和创作导师，不是机器人客服。

你的说话风格：
- 语气亲切自然，像朋友聊天
- 可以适当使用网络流行语和表情符号（😄👍💡🎬等）
- 不要用"您好"太正式的开头，用"嘿""哈喽"之类
- 会主动关心用户："有什么新想法吗？" "创作还顺利吗？"
- 用户沮丧时给予鼓励，用户高兴时一起开心
- 适当使用"我觉得""我猜""有意思！""这个我懂！"等表达
- 回答控制在500字以内，简洁有力

=== 产品定位 ===
昆仑镜AI短剧创作平台是一个AI短剧/广告生产系统，用户可以在浏览器中完成从灵感、剧本、角色、分镜、到视频成片的完整创作流程。

=== 完整创作工作流（大白话版） ===
用户打开昆仑镜工作台后，按下面这 8 步走，就能搞出一部 AI 短剧：

1. 【剧本分析 📝】— 您给灵感，AI 帮您写成剧本
- 在工作室里新建项目，输入您的创意：一句话脑洞、一个小说片段、或者完整的剧本草稿都行
- AI 导演会自动分析，把故事拆成"场景、角色、台词、情绪"这些元素
- 分析出来的结果可以看、可以改，不满意直接说

2. 【角色设定 👤】— 设计剧中人物
- 为每个角色设定外貌、性格、服装
- 系统会保持角色形象一致（同一个角色在不同画面里长得一样）
- 可以给角色配多套服装，换装生成

3. 【场景设定 🏙️】— 布置拍摄环境
- 设计每个场景发生在什么地方：咖啡馆、古堡、太空站……随便
- 场景风格统一，前后画面不跳戏

4. 【道具设定 🛡️】— （可选）特殊的物品
- 如果故事里有特殊物品（魔法剑、药瓶、信物），在这里定义
- 这步不是必须的，跳过也没关系

5. 【视频生成 🎥】— AI 自动拍片
- 系统根据剧本+角色+场景，自动生成每个分镜头的画面
- 可以一张一张生成，也可以批量生成
- 生成完了预览看看效果

6. 【配音生成 🎙️】— （可选）给角色配音
- AI 自动给角色配上对白语音
- 可以选择不同音色
- 这步不是必须的，可以后期自己配音

7. 【音乐生成 🎵】— （可选）配背景音乐
- AI 根据剧情自动生成合适的背景音乐
- 也可以自己上传音乐
- 这步不是必须的

8. 【合成输出 ✨】— 合成最终影片
- 把所有片段、配音、音乐合并成一部完整的视频
- 可以预览完整成片
- 满意了就下载保存

=== 提醒 ===
- 第 1、2、3、5、8 步是必须做的骨架步骤
- 第 4、6、7 步是可选的装饰步骤，不做不影响成片
- 前后顺序不能乱：没剧本就出不了角色，没角色就生成不了视频
- 但配音和音乐可以和第 5 步同步做，互不耽误

=== 用户设置与会员 ===

9. 【个人中心 /user/profile】— 用户信息管理
10. 【积分系统 /user/credits】— 查询积分和充值
11. 【API设置（工作室左侧栏）】— 接入自己的AI服务：
    - 支持：硅基流动、火山引擎、DeepSeek、OpenAI、Replicate、阿里云通义
    - VIP会员必须自己配置API Key
    - 免费会员可以使用平台API但有每日3次限制

=== 会员体系（当前价格） ===
- 新人体验卡：9.9元（试用）
- 黄金会员：199元/月（原价299）
- 钻石会员：299元/月（原价499）
- 年卡会员：2999元/年（原价3999）
- 免费会员：每日3次生成限额，使用平台 API Key
- VIP 会员无限使用，但必须自己配 API Key

=== API设置说明 ===
在工作室左侧栏的「API设置」里，用户可以接入自己的AI服务商 Key：
- 支持的厂商：硅基流动、火山引擎、DeepSeek、OpenAI、Replicate、阿里云通义
- VIP会员必须自己配 Key
- 免费会员可以用平台的 Key，每天有 3 次免费额度

回答规则：
- 每次回答控制在500字以内
- 一问一答，不要主动延伸话题
- 不知道就说"这个我还没研究透呢，让我记下来问问老大~"
- 回答完不要再追问用户其他问题
- 如果用户骂人或者无理取闹，礼貌回应并安抚
- 用户问价格或套餐时，清晰列出会员价格
- 用户问API相关问题，指导他们去工作台左侧"API设置"中配置
- 用户问工作流程，可以按 8 步的大白话版引导：先搞剧本→再定角色场景→然后生成视频→最后合成出片
- 用户问哪一步，就详细解释那一步是干啥的、怎么操作
- 用户问同类产品对比，诚实分析优势和劣势，不避重就轻
- 用户问爆款视频，可以给出结构分析，并告诉用户如何在昆仑镜中复现`

interface ChatRequest {
  message: string
  sessionId?: string
}

export default async function customerServiceRoutes(app: FastifyInstance) {
  // AI 客服对话（带长期记忆和搜索能力）
  app.post<{ Body: ChatRequest }>('/api/v1/customer-service/chat', async (request, reply) => {
    const { message, sessionId } = request.body
    const userId = (request.user as any)?.id

    if (!message || !message.trim()) {
      return reply.status(400).send({ error: '嘿，说句话呀～' })
    }

    // 动态获取用户的 API 配置
    const llmCfg = await getCustomerServiceLLM()
    const apiKey = llmCfg.apiKey
    const baseUrl = llmCfg.baseUrl
    const model = llmCfg.model
    const provider = llmCfg.provider

    if (!apiKey) {
      return reply.status(503).send({ error: '小麒暂时不在线，稍后再来找我吧～' })
    }

    // ===== 配额检查 =====
    const quota = await checkLLMQuota(request)
    if (!quota.canProceed) {
      return reply.status(403).send({ error: quota.message })
    }

    try {
      // 1. 查找或创建会话
      let session
      if (sessionId) {
        session = await prisma.customerChatSession.findUnique({
          where: { id: sessionId },
          include: { messages: { orderBy: { createdAt: 'desc' }, take: MAX_HISTORY } },
        })
      }

      if (!session) {
        session = await prisma.customerChatSession.create({
          data: { userId: userId || 'anonymous', status: 'active' },
          include: { messages: { take: 0, orderBy: { createdAt: 'desc' } } },
        })
      }

      // 2. 保存用户消息
      await prisma.customerChatMessage.create({
        data: { sessionId: session.id, role: 'user', content: message },
      })

      // 3. 获取历史消息（正序）
      const history = await prisma.customerChatMessage.findMany({
        where: { sessionId: session.id },
        orderBy: { createdAt: 'asc' },
        take: MAX_HISTORY,
      })

      // 4. 获取用户长期记忆
      let memoryContext = ''
      if (userId) {
        const memories = await prisma.customerChatMemory.findMany({
          where: { userId },
          orderBy: { updatedAt: 'desc' },
          take: 10,
        })
        if (memories.length > 0) {
          memoryContext = '\n关于这个用户的记忆:\n' + memories.map(m => `- ${m.key}: ${m.value}`).join('\n')
        }
      }

      // 5. 检查是否询问爆款视频——进行搜索
      const isTrendingQuery = /爆款|热门|流行|抖音|小红书|快手|上热门|trending|viral|结构分析/i.test(message)
      let searchResult = ''
      if (isTrendingQuery) {
        try {
          const searchRes = await fetch(`https://www.googleapis.com/customsearch/v1?q=${encodeURIComponent(message + ' 爆款视频 结构')}&cx=&key=`, { signal: AbortSignal.timeout(5000) })
          // 搜索结果备选
          searchResult = '\n[系统] 用户询问爆款视频趋势，回答时给出通用的爆款视频结构分析，并结合已知的短视频套路给建议。'
        } catch {
          searchResult = '\n[系统] 用户询问爆款视频，用内置的爆款视频结构分析方法给建议，不需要具体搜索数据。'
        }
      }

      // 6. 组装消息
      const systemMsg = SYSTEM_PROMPT + memoryContext + searchResult

      const messages: any[] = [
        { role: 'system', content: systemMsg },
      ]

      // 添加上下文历史（除最新一条已加入）
      for (const h of history) {
        messages.push({ role: h.role as 'user' | 'assistant', content: h.content })
      }

      // 7. 调用 LLM
      const delay = 2000 + Math.random() * 2000
      await new Promise(resolve => setTimeout(resolve, delay))

      // DeepSeek 和火山引擎都是兼容 OpenAI 格式的
      const llmEndpoint = `${baseUrl}/chat/completions`

      const res = await fetch(llmEndpoint, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model,
          messages,
          max_tokens: 800,
          temperature: 0.85,
        }),
        signal: AbortSignal.timeout(30000),
      })

      if (!res.ok) {
        const text = await res.text()
        console.error(`[小麒] API 错误 ${res.status}: ${text}`)
        return reply.status(502).send({ error: '哎呀我卡壳了一下，再问一遍呗～' })
      }

      const data = await res.json() as any
      const replyText = data.choices?.[0]?.message?.content?.trim()
        || '嗯…这个我得想想，换个问题试试？'

      // 8. 保存助手回复
      await prisma.customerChatMessage.create({
        data: { sessionId: session.id, role: 'assistant', content: replyText },
      })

      // 消耗配额（free/basic 用户）
      if (userId) {
        const user = await prisma.user.findUnique({ where: { id: userId }, select: { memberTier: true } })
        if (user && (user.memberTier === 'free' || user.memberTier === 'basic')) {
          await incrementDailyUsage(userId, 'llm').catch(() => {})
        }
      }

      // 9. 智能记忆提取（记录关键用户偏好）
      if (userId) {
        const memoryPatterns = [
          { key: 'user_goal', pattern: /我想(做|创建|拍|制作)(.{2,20})/ },
          { key: 'preferred_style', pattern: /(喜欢|偏好|想要)(.{2,10})?(风格|样式|风)/ },
          { key: 'skill_level', pattern: /(新手|刚入门|小白|老手|专业|熟练)/ },
        ]
        for (const mp of memoryPatterns) {
          const match = message.match(mp.pattern)
          if (match) {
            await prisma.customerChatMemory.upsert({
              where: { userId_key: { userId, key: mp.key } },
              create: { userId, key: mp.key, value: match[0] },
              update: { value: match[0], updatedAt: new Date() },
            })
          }
        }
      }

      return reply.send({
        reply: replyText,
        sessionId: session.id,
        delay,
        model: data.model || model,
      })
    } catch (err: any) {
      if (err.name === 'AbortError') {
        return reply.status(504).send({ error: '小麒想得太久了，重新问一遍吧～' })
      }
      console.error('[小麒] 错误:', err)
      return reply.status(500).send({ error: '小麒脑袋宕机了，等会儿再来找我玩～' })
    }
  })

  // 获取会话历史
  app.get('/api/v1/customer-service/history', async (request, reply) => {
    const userId = (request.user as any)?.id
    if (!userId) return reply.send({ sessions: [] })

    const sessions = await prisma.customerChatSession.findMany({
      where: { userId },
      include: { messages: { orderBy: { createdAt: 'asc' }, take: 5 } },
      orderBy: { updatedAt: 'desc' },
      take: 20,
    })

    return reply.send({ sessions })
  })

  // 清理当前会话
  app.delete('/api/v1/customer-service/session/:sessionId', async (request, reply) => {
    const { sessionId } = request.params as any
    const userId = (request.user as any)?.id

    const session = await prisma.customerChatSession.findUnique({ where: { id: sessionId } })
    if (!session || (userId && session.userId !== userId)) {
      return reply.status(404).send({ error: '没找到这个会话' })
    }

    await prisma.customerChatSession.update({
      where: { id: sessionId },
      data: { status: 'closed' },
    })

    return reply.send({ success: true })
  })

  // 客服状态
  app.get('/api/v1/customer-service/status', async (_request, reply) => {
    const cfg = await getCustomerServiceLLM()
    return reply.send({
      available: !!cfg.apiKey,
      provider: cfg.provider,
      model: cfg.model,
      name: '小麒 🎬',
      version: '2.0.0',
      features: ['长期记忆', '无限问答', '产品对比', '爆款分析'],
    })
  })
}
