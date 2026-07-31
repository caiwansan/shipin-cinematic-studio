/**
 * 混沌珠小说工作台 — 路由注册入口
 * 独立于昆仑镜短剧系统，零影响
 */
import type { FastifyInstance } from 'fastify'
import projectRoutes from './project.js'
import agentRoutes from './agent.js'
import memoryRoutes from './memory.js'
import manuscriptRoutes from './manuscript.js'
import styleDnaRoutes from './style-dna.js'
import characterRoutes from './character.js'
import chatRoutes from './chat.js'
import factionRoutes from './faction.js'
import ttsRoutes from './tts.js'
import phaseXRoutes from './phasex.js'
import uploadRoutes from './upload.js'
import libraryReaderRoutes from './library-reader.js'
import adminReviewRoutes from './admin-review.js'
import masterPlanRoutes from './master-plan.js'
import characterStateRoutes from './character-state.js'
import storyEventRoutes from './story-event.js'
import characterMindRoutes from './character-mind.js'

export default async function hdzRoutes(app: FastifyInstance) {
  // 图书馆管理员 health 检查（公开接口）
  // 图书馆管理员已改为用户 BYOK 模式，不再依赖系统内置模型
  app.get('/api/hdz/library-reader/health', async (_request, reply) => {
    return { success: true, data: { healthy: true, mode: 'byok' } }
  })

  await app.register(projectRoutes)
  await app.register(agentRoutes)
  await app.register(memoryRoutes)
  await app.register(manuscriptRoutes)
  await app.register(styleDnaRoutes)
  await app.register(characterRoutes)
  await app.register(chatRoutes)
  await app.register(factionRoutes)
  await app.register(ttsRoutes)
  await app.register(phaseXRoutes)
  await app.register(uploadRoutes)
  await app.register(libraryReaderRoutes)
  await app.register(adminReviewRoutes)
  await app.register(masterPlanRoutes)
  await app.register(characterStateRoutes)
  await app.register(storyEventRoutes)
  await app.register(characterMindRoutes)
}
