/**
 * generate-scroll.ts — 视频脚本 → 火柴人卷轴图生成
 *
 * 走标准图片生成链路：POST /api/tasks/ai-generate → 轮询任务状态 → 返回 COS URL
 * 跟其他图片生成（角色定妆、场景图、道具图）完全一样的路径
 */

import { FastifyInstance } from 'fastify'
import { buildGenericScrollPrompt } from '../services/scroll-generator.service.js'

interface GenerateScrollBody {
  narrative: string
  dialogue?: string
  effects?: string
  firstFrameDesc?: string
  lastFrameDesc?: string
  optimizedShots?: any[]
}

export default async function generateScrollRoute(fastify: FastifyInstance) {
  // 先注册一个获取 token 的辅助函数
  fastify.post<{ Body: GenerateScrollBody }>(
    '/api/ai/generate-scroll',
    { preHandler: [fastify.authenticate] },
    async (request, reply) => {
      const { narrative, dialogue, effects, firstFrameDesc, lastFrameDesc, optimizedShots } = request.body
      const userId = (request as any).user?.id || (request as any).user?.sub

      if (!narrative?.trim()) {
        return reply.status(400).send({ success: false, error: '视频脚本不能为空' })
      }
      if (!userId) {
        return reply.status(401).send({ success: false, error: '未登录' })
      }

      try {
        // 1. 构建卷轴 prompt
        const scrollPrompt = buildGenericScrollPrompt(narrative, dialogue, effects, firstFrameDesc, lastFrameDesc, optimizedShots)

        // 2. 获取有效 projectId（用用户已有项目的 ID 或临时生成）
        const { prisma } = await import('../utils/index.js')
        const projectId = await prisma.$transaction(async (tx: any) => {
          // 找一个最近的普通项目
          const recentProject = await tx.project.findFirst({
            where: { userId },
            orderBy: { createdAt: 'desc' },
          })
          if (recentProject) return recentProject.id
          // 创建临时项目
          const newProj = await tx.project.create({
            data: {
              id: crypto.randomUUID(),
              userId,
              name: '临时项目',
            },
          })
          return newProj.id
        })

        // 3. 通过标准队列提交图片生成任务
        const authHeader = request.headers.authorization || ''
        const port = process.env.PORT || 4000
        const genRes = await fetch(`http://localhost:${port}/api/tasks/ai-generate`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', authorization: authHeader },
          body: JSON.stringify({
            projectId,
            taskType: 'image',
            input: {
              prompt: scrollPrompt,
              aspectRatio: '21:9',
              n: 1,
              source: 'scroll_generation',
            },
          }),
        })

        if (!genRes.ok) {
          const errText = await genRes.text().catch(() => '')
          console.error(`[generate-scroll] ❌ 队列提交失败: ${genRes.status} ${errText}`)
          return reply.send({
            success: false,
            error: '图片生成任务提交失败，请检查大模型 API Key 配置是否正确',
          })
        }

        const genData = await genRes.json()
        const taskId = genData?.task?.id
        if (!taskId) {
          return reply.send({
            success: false,
            error: '未获取到任务 ID',
          })
        }

        // 3. 轮询等待任务完成
        let imageUrl = ''
        const baseUrl = `http://localhost:${port}`
        for (let i = 0; i < 60; i++) {
          await new Promise(r => setTimeout(r, 2000))
          const statusRes = await fetch(`${baseUrl}/api/tasks/${taskId}/status`, {
            headers: { authorization: authHeader },
          })
          if (!statusRes.ok) continue
          const statusData = await statusRes.json()
          const task = statusData?.task
          if (!task) continue
          if (task.status === 'completed') {
            const result = task.result || {}
            imageUrl = result?.data?.imageUrl || result?.data?.url || result?.imageUrl || result?.url || ''
            try {
              const err = JSON.parse(task.error || '{}')
              imageUrl = imageUrl || err?.output?.imageUrl || err?.output?.url || ''
            } catch { /* ignore */ }
            break
          }
          if (task.status === 'failed') {
            console.error(`[generate-scroll] ❌ 任务失败:`, task.error)
            return reply.send({
              success: false,
              error: `卷轴图生成失败：${task.error || '模型返回为空，请检查 API Key 和模型配置'}`,
            })
          }
        }

        if (!imageUrl) {
          return reply.send({
            success: false,
            error: '卷轴图生成超时，请检查模型配置和 API Key',
          })
        }

        // 4. 尝试上传到 COS，如果失败就返回原始 URL（走 proxyImageUrl 展示）
        let finalUrl = imageUrl
        try {
          const { cosService } = await import('../services/cos-service.js')
          const cosResult = await cosService.uploadFile(imageUrl, 'image', userId)
          if (cosResult?.cosUrl) {
            finalUrl = cosResult.cosUrl
            console.log(`[generate-scroll] ✅ 卷轴图已保存到 COS: ${cosResult.cosUrl.substring(0, 60)}`)
          }
        } catch (cosErr: any) {
          console.warn(`[generate-scroll] ⚠️ COS 上传失败，使用原始 URL: ${cosErr.message}`)
        }

        return reply.send({
          success: true,
          data: {
            scrollImageUrl: finalUrl,
            scrollDirective: `基于视频脚本生成的导演卷轴参考图`,
          },
        })
      } catch (err: any) {
        console.error('[generate-scroll] ❌ 卷轴图生成异常:', err.message)
        return reply.send({
          success: false,
          error: err.message || '卷轴图生成异常',
        })
      }
    },
  )
}
