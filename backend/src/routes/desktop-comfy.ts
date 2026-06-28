/**
 * routes/desktop-comfy.ts — 本地 ComfyUI 检测与管理 API
 *
 * 用于前端 ComfyUI 本地图片引擎面板
 */

import { FastifyInstance } from 'fastify'
import { execSync } from 'child_process'
import { existsSync, readdirSync } from 'fs'
import { join, resolve } from 'path'

const DEFAULT_COMFY_URL = 'http://127.0.0.1:8188'
const COMFY_MODEL_DIRS = [
  // 常见 ComfyUI 模型目录
  resolve(process.env.HOME || '/root', 'ComfyUI/models/checkpoints/'),
  resolve(process.env.HOME || '/root', 'ComfyUI/models/unet/'),
  '/opt/ComfyUI/models/checkpoints/',
  '/opt/ComfyUI/models/unet/',
]

function isComfyRunning(url: string): boolean {
  try {
    const out = execSync(`curl -s -o /dev/null -w "%{http_code}" --connect-timeout 3 --max-time 3 ${url}/queue`, {
      encoding: 'utf-8', timeout: 5000, stdio: 'pipe'
    })
    // ComfyUI 返回 text/html 不是 json 但能连通
    return true
  } catch {
    try {
      const out = execSync(`curl -s --connect-timeout 3 --max-time 3 ${url}/queue`, {
        encoding: 'utf-8', timeout: 5000, stdio: 'pipe'
      })
      return out.length > 0
    } catch {
      return false
    }
  }
}

function getAvailableModels(): string[] {
  const models: string[] = []
  for (const dir of COMFY_MODEL_DIRS) {
    if (existsSync(dir)) {
      try {
        const files = readdirSync(dir).filter(f => f.endsWith('.safetensors') || f.endsWith('.ckpt'))
        models.push(...files)
      } catch {}
    }
  }
  return [...new Set(models)].sort()
}

export default async function desktopComfyRoutes(fastify: FastifyInstance) {

  // GET /api/desktop/comfy/check — 检测 ComfyUI 状态
  fastify.get('/api/desktop/comfy/check', async (_request, reply) => {
    const running = isComfyRunning(DEFAULT_COMFY_URL)
    reply.send({
      running,
      url: DEFAULT_COMFY_URL,
      models: running ? getAvailableModels() : [],
      message: running
        ? `ComfyUI 运行中，发现 ${getAvailableModels().length} 个模型`
        : 'ComfyUI 未运行。请先启动 ComfyUI (默认端口 8188)',
    })
  })

  // GET /api/desktop/comfy/models — 获取可用模型列表
  fastify.get('/api/desktop/comfy/models', async (_request, reply) => {
    reply.send({
      success: true,
      running: isComfyRunning(DEFAULT_COMFY_URL),
      url: DEFAULT_COMFY_URL,
      models: getAvailableModels(),
    })
  })
}
