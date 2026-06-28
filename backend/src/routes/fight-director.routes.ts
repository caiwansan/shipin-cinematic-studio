// ============================================================
// fight-director.routes.ts — 打斗场景智能编排 API 路由
// ============================================================

import { FastifyInstance } from 'fastify'
import { generateFightStoryboard } from '../services/fight-director.service.js'
import { prisma } from '../utils/index.js'

interface ApiResponse<T> {
  success: boolean
  data?: T
  error?: string
}

// 简化的角色信息（从前端传过来）
interface CharInput {
  name: string
  description: string
  physicalDescription: string
  clothing: string
  weapon?: string
  fightingStyle?: string
  imageUrl: string
}

interface SceneInput {
  name: string
  description: string
  imageUrl?: string
}

export default async function fightDirectorRoutes(fastify: FastifyInstance) {
  // 生成战斗分镜图谱
  fastify.post('/api/fight-director/generate', {
    preHandler: [fastify.authenticate],
  }, async (request, reply) => {
    const body = request.body as any
    const { fightType, storyText, characters, scene, shotCount } = body || {}

    if (!fightType || !storyText || !characters?.length) {
      return reply.status(400).send({ success: false, error: '缺少必填参数: fightType, storyText, characters' } satisfies ApiResponse<unknown>)
    }

    const validTypes = ['duel', 'group-fight', 'chase', 'battle']
    if (!validTypes.includes(fightType)) {
      return reply.status(400).send({ success: false, error: `无效的战斗类型: ${fightType}，可选: ${validTypes.join(', ')}` } satisfies ApiResponse<unknown>)
    }

    // 尝试获取用户 LLM API Key（BYOK）
    let apiKey: string | undefined
    try {
      const uid = (request.user as any)?.id || ''
      if (uid) {
        const config = await prisma.userModelConfigV2.findFirst({
          where: { userId: uid },
        })
        if (config?.llmApiKey) {
          try {
            const { decryptKey } = await import('../services/crypto.service.js')
            apiKey = decryptKey(config.llmApiKey)
          } catch {
            // 明文 key（历史数据），直接使用
            apiKey = config.llmApiKey
          }
        }
      }
    } catch (e: any) {
      console.warn('[FightDirector] 获取 API Key 失败，使用模板模式:', e.message)
    }

    const result = await generateFightStoryboard({
      fightType,
      storyText,
      characters: characters.map((c: CharInput) => ({
        name: c.name,
        description: c.description || '',
        physicalDescription: c.physicalDescription || '',
        clothing: c.clothing || '',
        weapon: c.weapon || '',
        fightingStyle: c.fightingStyle || '',
        imageUrl: c.imageUrl || '',
      })),
      scene: scene ? {
        name: scene.name,
        description: scene.description || '',
        imageUrl: scene.imageUrl || '',
      } : undefined,
      shotCount: shotCount || undefined,
    }, apiKey)

    return {
      success: true,
      data: result,
      mode: apiKey ? 'llm' : 'template',
    }
  })

  // 获取可用模板列表
  fastify.get('/api/fight-director/templates', async () => {
    const { fightTemplates } = await import('./fight-templates-meta.js')
    return { success: true, data: fightTemplates }
  })
}
