/**
 * routes/desktop-video.ts — 本地视频模型引擎检测与管理 API
 *
 * 检测 ComfyUI / Wan2.1 / CogVideo / HunyuanVideo 等本地视频能力
 * 支持多引擎路由
 */

import { FastifyInstance } from 'fastify'
import { getAvailableEngines, isComfyRunning, isWanAvailable, getComfyVideoModels } from '../model-adapters/video/local-video.adapter.js'
import { existsSync, readdirSync } from 'fs'
import { resolve } from 'path'

const WORKFLOW_DIR = '/root/shipin-cinematic-studio/workflows/comfy-video'

function getAvailableWorkflows(): string[] {
  try {
    return readdirSync(WORKFLOW_DIR).filter(f => f.endsWith('.json'))
  } catch { return [] }
}

function getRecommendedSetup(): any {
  return {
    engines: [
      {
        id: 'comfyui',
        name: 'ComfyUI',
        description: '通用视频生成引擎，支持 Wan2.1 / CogVideo / HunyuanVideo / Mochi / LTX-Video 等',
        url: 'https://github.com/comfyanonymous/ComfyUI',
        installGuide: 'git clone https://github.com/comfyanonymous/ComfyUI && pip install -r requirements.txt',
        defaultPort: 8188,
        minVRAM: '8GB (Wan2.1-1.3B) / 16GB+ (14B)',
      },
      {
        id: 'wan2.1',
        name: 'Wan2.1 (原生推理)',
        description: '阿里 Wan2.1 官方推理脚本，性能最优',
        url: 'https://github.com/Wan-Video/Wan2.1',
        installGuide: 'git clone https://github.com/Wan-Video/Wan2.1 && pip install -r requirements.txt',
        minVRAM: '8.19GB (1.3B) / 24GB+ (14B)',
      },
      {
        id: 'cogvideo',
        name: 'CogVideo (ComfyUI)',
        description: '智谱 CogVideo，通过 ComfyUI 节点接入',
        url: 'https://github.com/THUDM/CogVideo',
        installGuide: '通过 ComfyUI Manager 安装 CogVideo 节点',
        minVRAM: '12GB+',
      },
      {
        id: 'hunyuan',
        name: 'HunyuanVideo (ComfyUI)',
        description: '腾讯 HunyuanVideo，通过 ComfyUI 节点接入',
        url: 'https://github.com/Tencent/HunyuanVideo',
        installGuide: '通过 ComfyUI Manager 安装 HunyuanVideo 节点',
        minVRAM: '12GB+',
      },
    ],
    prebuiltWorkflows: getAvailableWorkflows(),
  }
}

export default async function desktopVideoRoutes(fastify: FastifyInstance) {

  // GET /api/desktop/comfyui/check — 兼容旧版前端 ComfyUI 检测
  fastify.get('/api/desktop/comfyui/check', async (_request, reply) => {
    reply.send({ running: false, engines: [] })
  })

  // GET /api/desktop/video/check — 检测本地视频引擎状态
  fastify.get('/api/desktop/video/check', async (_request, reply) => {
    const engines = getAvailableEngines()
    reply.send({
      running: engines.some(e => e.available),
      engines: getAvailableEngines(),
      comfyui: {
        running: isComfyRunning(),
        models: getComfyVideoModels(),
      },
      wan2_1: {
        available: isWanAvailable(),
      },
      recommended: getRecommendedSetup(),
      message: engines.some(e => e.available)
        ? `本地视频引擎可用: ${engines.filter(e => e.available).map(e => e.label).join(', ')}`
        : '未检测到本地视频引擎。请安装 ComfyUI 或 Wan2.1',
    })
  })

  // GET /api/desktop/video/models — 获取本地可用视频模型
  fastify.get('/api/desktop/video/models', async (_request, reply) => {
    reply.send({
      success: true,
      engines: getAvailableEngines().filter(e => e.available),
      comfyVideoModels: getComfyVideoModels(),
      recommended: getRecommendedSetup(),
    })
  })
}
