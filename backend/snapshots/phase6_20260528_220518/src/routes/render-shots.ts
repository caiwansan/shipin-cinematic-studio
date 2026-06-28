import type { ApiResponse } from '../contracts/api/base.js';
/**
 * routes/render-shots.ts — 触发 CinematicBridge 渲染镜头
 *
 * 设计原则：
 *   - 只允许触发 CinematicBridge，不允许前端干预内容
 *   - 输入 = projectId（从 URL 取）
 *   - 输出 = RenderedShot[]
 *   - 可重放：同 project 重复调用仅覆盖 renderedShots
 *
 * 安全约束：
 *   - 必须经过 authenticate
 *   - 不接收任何"创作输入"（不塞 prompt/风格进 body）
 *   - 只接收 { source: "director_engine" | "recompile", force?: boolean }
 */

import { FastifyInstance } from 'fastify'
import { prisma } from '../utils/index.js'
import { DirectorEngine } from '../engine/director/director-engine.js'
import { CinematicBridge } from '../engine/director/cinematic-bridge.js'

export default async function renderShotsRoutes(fastify: FastifyInstance) {
  /**
   * POST /api/projects/:id/render-shots
   *
   * Body:
   *   { source: "director_engine", force?: boolean }
   *
   * 流程：
   *   1. 从 DB 加载 project 和 aiSceneSpec
   *   2. 重建 DirectorPlan（确定性）
   *   3. 调用 CinematicBridge.compile()（AI 渲染）
   *   4. 写入 renderedShots（通过 shotgraph-writer）
   *   5. 返回 renderedShots
   */
  fastify.post(
    '/api/projects/:id/render-shots',
    { preHandler: [fastify.authenticate] },
    async (request, reply) => {
      const { id: projectId } = request.params as any
      const body = request.body as any
      const source = body?.source || 'director_engine'

      // 1. 验证 project 存在
      const project = await prisma.project.findUnique({
        where: { id: projectId },
      })
      if (!project) {
        return reply.status(404).send({ success: false, error: 'Project not found' })
      }

      // 2. 从 aiSceneSpec 加载 scene 数据
      const sceneSpecs = await prisma.aiSceneSpec.findMany({
        where: { projectId },
        orderBy: { sortOrder: 'asc' },
      })
      if (!sceneSpecs.length) {
        return reply.status(400).send({ success: false, error: 'No scene specs found. Please submit the script first.' })
      }

      // 3. 将 aiSceneSpec 转换为 DirectorEngine 输入格式
      const engineInput = sceneSpecs.map(s => ({
        sceneId: s.sceneId,
        name: s.sceneName,
        mood: s.description || s.sceneName || 'neutral',
        duration: 10, // 默认 10s，未来可从 scene spec 读
      }))

      // 4. 重建 DirectorPlan（确定性）
      const engine = new DirectorEngine()
      const directorPlan = engine.build(engineInput, {})

      // 5. 从 V2 配置读取 API Key，注入到 process.env（CinematicBridge 需要）
      const v2cfg = await import('../config/v2.js')
      const v2 = await v2cfg.loadFullConfigV2((request.user as any)?.id)
      if (v2?.imageApiKey) {
        const { decryptKey } = await import('../services/crypto.service.js')
        try {
          const decrypted = decryptKey(v2.imageApiKey)
          process.env.DEEPSEEK_API_KEY = decrypted
          if (v2.baseUrl) {
            process.env.DEEPSEEK_BASE_URL = v2.baseUrl
          }
          if (v2.imageModel) {
            process.env.DEEPSEEK_MODEL = v2.imageModel
          }
        } catch (e: any) {
          console.warn('[RenderShots] key 解密失败:', e.message)
        }
      }
      
      // 6. 执行 CinematicBridge
      const bridge = new CinematicBridge()
      const rendered = await bridge.compile({
        directorPlan,
        executionContext: {
          projectId,
          userId: (request.user as any)?.id,
          renderPolicy: 'overwrite',
        },
      })

      return {
        success: true,
        data: {
          sceneCount: engineInput.length,
          abstractShots: directorPlan.shotGraph.abstractShots.length,
          renderedShots: rendered.length,
          shots: rendered,
        },
      }
    }
  )

  /**
   * GET /api/projects/:id/rendered-shots
   *
   * 获取已渲染的 shot 列表（只读查询）
   */
  fastify.get(
    '/api/projects/:id/rendered-shots',
    { preHandler: [fastify.authenticate] },
    async (request, reply) => {
      const { id: projectId } = request.params as any

      const project = await prisma.project.findUnique({
        where: { id: projectId },
      })
      if (!project) {
        return reply.status(404).send({ success: false, error: 'Project not found' })
      }

      const execResults = (project.executionResults || {}) as any
      const vp = execResults.videoProduction || {}
      const sg = vp.shotGraph || {}

      return {
        success: true,
        data: {
          abstractShots: sg.abstractShots || [],
          renderedShots: sg.renderedShots || [],
          mode: sg.mode || 'abstract',
          lineage: sg.lineage || null,
        },
      }
    }
  )
}
