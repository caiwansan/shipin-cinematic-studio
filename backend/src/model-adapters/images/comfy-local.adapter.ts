/**
 * model-adapters/image/comfy-local.adapter.ts — Phase 2: 本地 ComfyUI 图片生成
 *
 * 连接本地 ComfyUI API (默认 http://127.0.0.1:8188) 生成图片。
 * 通过 workflow 模板 + prompt 注入实现。
 *
 * 依赖：本地 ComfyUI 服务运行
 */

import { ModelAdapter, ModelAdapterInput, ModelAdapterResult } from '../types.js'
import { execSync } from 'child_process'
import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'fs'
import { join, resolve } from 'path'
import { randomUUID } from 'crypto'

const COMFY_DEFAULT_URL = 'http://127.0.0.1:8188'
const OUTPUT_DIR = resolve(process.cwd(), 'runtime', 'comfy-output')

/** 检测 ComfyUI 是否运行 */
function isComfyRunning(url: string): boolean {
  try {
    execSync(`curl -s -o /dev/null -w "%{http_code}" --connect-timeout 3 --max-time 3 ${url}`, {
      encoding: 'utf-8', timeout: 5000, stdio: 'pipe'
    })
    return true
  } catch {
    return false
  }
}

/** 构建 T2I workflow（文生图） */
function buildT2IWorkflow(prompt: string, modelName: string = 'sd3.5_large.safetensors'): any {
  return {
    "3": {
      "class_type": "KSampler",
      "inputs": {
        "seed": Math.floor(Math.random() * 1000000),
        "steps": 20,
        "cfg": 7.0,
        "sampler_name": "euler",
        "scheduler": "normal",
        "denoise": 1.0,
        "model": ["4", 0],
        "positive": ["6", 0],
        "negative": ["7", 0],
        "latent_image": ["5", 0]
      }
    },
    "4": {
      "class_type": "CheckpointLoaderSimple",
      "inputs": { "ckpt_name": modelName }
    },
    "5": {
      "class_type": "EmptyLatentImage",
      "inputs": { "width": 1024, "height": 1024, "batch_size": 1 }
    },
    "6": {
      "class_type": "CLIPTextEncode",
      "inputs": { "text": prompt, "clip": ["4", 1] }
    },
    "7": {
      "class_type": "CLIPTextEncode",
      "inputs": { "text": "", "clip": ["4", 1] }
    },
    "8": {
      "class_type": "VAEDecode",
      "inputs": { "samples": ["3", 0], "vae": ["4", 2] }
    },
    "9": {
      "class_type": "SaveImage",
      "inputs": { "filename_prefix": "comfy_output", "images": ["8", 0] }
    }
  }
}

/** 提交 ComfyUI 任务并等待结果 */
async function submitComfyWorkflow(workflow: any, baseUrl: string): Promise<string[]> {
  const res = await fetch(`${baseUrl}/prompt`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ prompt: workflow }),
    signal: AbortSignal.timeout(60000),
  })
  if (!res.ok) throw new Error(`ComfyUI prompt 失败: ${res.status}`)
  const data = await res.json()
  const promptId = data.prompt_id

  // 轮询等待输出
  for (let i = 0; i < 120; i++) {
    await new Promise(r => setTimeout(r, 1000))
    const histRes = await fetch(`${baseUrl}/history/${promptId}`, { signal: AbortSignal.timeout(5000) })
    if (!histRes.ok) continue
    const hist = await histRes.json()
    const outputs = hist[promptId]?.outputs
    if (outputs) {
      const images: string[] = []
      for (const nodeId of Object.keys(outputs)) {
        const nodeOutput = outputs[nodeId]
        if (nodeOutput?.images) {
          for (const img of nodeOutput.images) {
            images.push(`${baseUrl}/view?filename=${img.filename}&subfolder=${img.subfolder || ''}&type=${img.type || 'output'}`)
          }
        }
      }
      return images
    }
  }
  throw new Error('ComfyUI 超时未生成图片')
}

export const comfyLocalImageAdapter: ModelAdapter = {
  name: 'comfy-local-image',
  supportedModels: [
    'comfy/*',  // 本地 ComfyUI 模型前缀
    'sd3*', 'sdxl*', 'sd/*',
    'custom-comfy*',
  ],
  taskTypes: ['image'],
  provider: 'comfy-local',

  async execute(runtime: any, input: ModelAdapterInput): Promise<ModelAdapterResult> {
    const baseUrl = input.perCapabilityBaseUrl?.image || input.baseUrl || COMFY_DEFAULT_URL
    const model = input.model.replace('comfy/', '')

    if (!isComfyRunning(baseUrl)) {
      throw new Error(`ComfyUI 未运行 (${baseUrl})。请先启动 ComfyUI。`)
    }

    const prompt = input.prompt || ''
    if (!prompt) throw new Error('ComfyUI 图片生成需要 prompt')

    const workflow = buildT2IWorkflow(prompt, model)
    const imageUrls = await submitComfyWorkflow(workflow, baseUrl)

    return {
      content: imageUrls[0] || '',
      images: imageUrls,
      provider: 'ComfyUI 本地',
      metadata: { imageUrls, source: 'comfy-local' },
    }
  },
}
