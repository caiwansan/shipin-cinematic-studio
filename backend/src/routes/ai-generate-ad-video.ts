/**
 * ai-generate-ad-video.ts — 广告视频生成 API
 *
 * POST /api/ai/generate-ad-video
 * 转发到 AI 任务队列（taskType: video）
 */

import { FastifyInstance } from 'fastify'
import { userModelResolver } from '../services/user-model-resolver.js'
import { prisma } from '../utils/index.js'

function extractUserId(request: any): string | null {
  try {
    const auth = request.headers.authorization as string
    if (!auth || !auth.startsWith('Bearer ')) return null
    const token = auth.slice(7).trim()
    const decoded: any = (request.server as any).jwt.verify(token)
    return decoded?.id || null
  } catch {
    return null
  }
}

export default async function aiGenerateAdVideoRoutes(app: FastifyInstance) {
  app.post('/api/ai/generate-ad-video', { preHandler: [app.authenticate] }, async (request, reply) => {
    const userId = extractUserId(request)
    const { prompt, negativePrompt, duration, referenceImage, referenceVideo, style, aspectRatio, provider, modelName } = request.body as any

    if (!prompt?.trim()) {
      return reply.status(400).send({ success: false, error: '缺少 prompt 参数' })
    }

    try {
      // 解析用户配置的视频模型
      const userCfg = await userModelResolver.resolve('video', userId || '')
      if (!userCfg) {
        return reply.status(400).send({ success: false, error: '请先在大模型设置中配置视频模型的 API Key' })
      }

      const model = modelName || userCfg.modelName || ''
      const apiKey = userCfg.apiKey
      // ⭐ 从 shots 计算总时长（如果传了分镜），否则用用户设置的 duration
      const shots = (request.body as any)?.shots || []
      const shotTotalTime = shots.length > 0 ? shots.reduce((a: number, s: any) => a + (s.time || 2), 0) : 0
      const dur = shotTotalTime || Number(duration) || 8

      // 整理参考视频和图片：传给 adapter 的 referenceImages 数组
      const refImages: string[] = []
      if (referenceImage) refImages.push(referenceImage)
      if (referenceVideo) refImages.push(referenceVideo)

      // ⭐ 构建带分镜时间轴的 videoPrompt
      const narrative = (request.body as any)?.narrative || ''
      const dialogue = (request.body as any)?.dialogue || ''
      const effects = (request.body as any)?.effects || ''
      const vfx = (request.body as any)?.vfx || ''

      let finalPrompt = prompt.trim()


      // 如果传了分镜数据，构建带时间轴的完整 prompt
      if (shots.length > 0) {
        const shotLines = shots.map((s: any, i: number) => {
          const t = s.time || 2
          const start = i === 0 ? 0 : shots.slice(0, i).reduce((a: number, x: any) => a + (x.time || 2), 0)
          const shotDialogue = s.dialogue || (i === 0 && dialogue ? dialogue : '')
          const shotEffects = s.effects || ''
          let line = `[${start}s-${start + t}s] 镜头：${s.camera || '固定'} | 画面：${s.scene || ''}`
          if (s.action) line += ` | 动作：${s.action}`
          if (s.branding) line += ` | 品牌露出：${s.branding}`
          if (shotDialogue) line += ` | 旁白：${shotDialogue}`
          if (shotEffects) line += ` | 音效：${shotEffects}`
          if (s.vfx) line += ` | 特效：${s.vfx}`
          return line
        }).join('\n')

        // 整段对话旁白 + 特效信息额外附加
        finalPrompt = `视频总时长：${dur} 秒

【剧情描述】
${narrative || prompt}

【旁白/对话全文】
${dialogue || '(无旁白)'}

【音效设计】
${effects || '(无)'}

${vfx ? `【视觉特效】\n${vfx}` : ''}

## 逐秒镜头时间轴
${shotLines}

请严格按照上述时间轴顺序生成视频，每段镜头的画面内容、运镜方式、旁白和音效必须与描述一致。
旁白应与画面同步——每个镜头内的旁白文字需在该镜头对应的时间段内以画外音朗读。`

        // ⭐ 注入风格指令
        if (style) {
          try {
            const { StyleProfileService } = await import('../services/style-profile.service.js')
            const profile = await StyleProfileService.getByName(style)
            if (profile?.promptOverrides?.['video']) {
              finalPrompt = profile.promptOverrides['video'].replace('{{prompt}}', finalPrompt)
            } else if (profile?.styleTokens) {
              finalPrompt += `\n\n【锁定视频风格】\n当前风格：【${style}】\n风格特征：${profile.styleTokens}\n所有画面必须严格遵循此风格。`
            }
          } catch {}
        }
      } else {
        // 没有分镜数据时，保留原有逻辑但不再截断 150 字
        // 如果不是图生视频，加上风格（仅 realistic 不加）
        if (style && style !== 'realistic' && !referenceImage) {
          const styleTags: Record<string, string> = {
            anime: '[anime style]',
            cyberpunk: '[cyberpunk style]',
            ink: '[ink wash style]',
            clay: '[clay style]',
            pixel: '[pixel style]',
          }
          finalPrompt = finalPrompt + ' ' + (styleTags[style] || '')
        }
        // 有参考图时，prompt 只写动态变化部分
        if (referenceImage && !referenceVideo) {
          finalPrompt = finalPrompt.replace(/水滴|产品|LOGO|品牌|场景/g, '').trim()
          if (!finalPrompt) finalPrompt = '画面自然运动'
        }
      }

      // 从请求中提取可选视频参数（文档推荐 body 顶层传参）
      const seed = request.body && (request.body as any).seed ? Number((request.body as any).seed) : undefined
      const cameraFixed = request.body && (request.body as any).camera_fixed !== undefined ? Boolean((request.body as any).camera_fixed) : false
      const generateAudio = request.body && (request.body as any).generate_audio !== undefined ? Boolean((request.body as any).generate_audio) : true

          // 构建视频任务记录
      // 从请求中获取 projectId，若不存在则使用占位 project
      let projectId = (request.body as any)?.projectId || null
      if (!projectId) {
        // 查找或创建占位 project（确保必填的外键约束不报错）
        let placeholder = await prisma.project.findFirst({ where: { name: '__ad_placeholder__' } })
        if (!placeholder) {
          placeholder = await prisma.project.create({
            data: {
              name: '__ad_placeholder__',
              userId: userId || '00000000-0000-0000-0000-000000000000',
            },
          })
        }
        projectId = placeholder.id
      }
      const task = await prisma.videoTask.create({
        data: {
          projectId,
          taskType: 'video',
          status: 'queued',
          priority: 1,
          error: JSON.stringify({
            userId,
            input: { prompt: finalPrompt, duration: dur, ratio: aspectRatio || '9:16', referenceImages: refImages, negativePrompt: negativePrompt || '', seed, cameraFixed, generateAudio },
            createdAt: new Date().toISOString(),
          }),
        },
      })

      // 创建后台任务异步执行
      executeVideoTask(task.id, model, apiKey, finalPrompt, dur, aspectRatio || '9:16', refImages, negativePrompt || '', seed, cameraFixed, generateAudio, provider || '').catch(err => {
        console.error(`[ad-video] task ${task.id} failed:`, err.message)
      })

      return { success: true, task: { id: task.id, status: 'queued' } }
    } catch (err: any) {
      console.error('[generate-ad-video] error:', err.message || err)
      return reply.status(500).send({ success: false, error: err.message || '视频生成失败' })
    }
  })
}

// ─── 后台执行视频生成 ───

async function executeVideoTask(
  taskId: string,
  model: string,
  apiKey: string,
  prompt: string,
  duration: number,
  ratio: string,
  referenceImages: string[],
  negativePrompt = '',
  seed?: number,
  cameraFixed = false,
  generateAudio = true,
  provider = '',
) {
  try {
    // 根据 provider 动态选择 adapter
    let videoAdapter: any
    if (provider === 'aliyun') {
      throw new Error('广告视频暂不支持阿里云')
    } else {
      const { volcengineVideoAdapter } = await import('../model-adapters/video/volcengine-video.adapter.js')
      videoAdapter = volcengineVideoAdapter
    }
    const result = await videoAdapter.execute(
      { userId: 'system', apiKey, model, provider: 'volcengine', taskType: 'video', baseURL: '' } as any,
      { model, prompt, duration, ratio, apiKey, seed, camera_fixed: cameraFixed, generate_audio: generateAudio, return_last_frame: true, referenceImages } as any,
    )

    if (result.url) {
      await prisma.videoTask.update({
        where: { id: taskId },
        data: {
          status: 'completed',
          error: JSON.stringify({ output: { videoUrl: result.url } }),
          completedAt: new Date(),
        },
      })
      console.log(`[ad-video] ✅ task ${taskId} completed: ${result.url.substring(0, 60)}`)
    } else if (result.taskId) {
      // 异步任务，轮询等待
      const pollResult = await pollVolcVideo(taskId, result.taskId, apiKey)
      await prisma.videoTask.update({
        where: { id: taskId },
        data: {
          // 将 'timeout' 映射为 'failed'，适配 VideoTaskStatus 枚举
          status: (pollResult.status === 'timeout' ? 'failed' : pollResult.status) as any,
          error: JSON.stringify({ output: { videoUrl: pollResult.url } }),
          completedAt: pollResult.url ? new Date() : undefined,
        },
      })
      if (pollResult.url) {
        console.log(`[ad-video] ✅ task ${taskId} completed via poll: ${pollResult.url.substring(0, 60)}`)
      }
    }
  } catch (err: any) {
    console.error(`[ad-video] task ${taskId} execution error:`, err.message)
    await prisma.videoTask.update({
      where: { id: taskId },
      data: { status: 'failed', error: JSON.stringify({ output: { error: err.message } }) },
    }).catch(() => {})
  }
}

async function pollVolcVideo(taskId: string, volcTaskId: string, apiKey: string): Promise<{ status: string; url: string }> {
  const POLL_URL = 'https://ark.cn-beijing.volces.com/api/v3/contents/generations/tasks'
  for (let i = 0; i < 300; i++) {
    await new Promise(r => setTimeout(r, 2000))
    try {
      const pollRes = await fetch(`${POLL_URL}/${volcTaskId}`, {
        headers: { Authorization: `Bearer ${apiKey}` },
      })
      const data: any = await pollRes.json()
      const status = data?.status || ''
      if (status === 'succeeded' || status === 'completed') {
        const url = data?.content?.video_url || data?.output?.video_url || ''
        if (url) return { status: 'completed', url }
      } else if (status === 'failed') {
        return { status: 'failed', url: '' }
      }
      if (i % 30 === 29) {
        console.log(`[ad-video] 轮询 ${Math.floor((i+1)*2/60)}分... status=${status}`)
      }
    } catch {}
  }
  return { status: 'timeout', url: '' }
}
