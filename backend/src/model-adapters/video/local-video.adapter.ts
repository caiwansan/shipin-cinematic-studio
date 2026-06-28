/**
 * model-adapters/video/local-video.adapter.ts — 本地视频大模型引擎
 *
 * 支持主流开源视频大模型接入：
 *   - ComfyUI 工作流方案（通用）：覆盖 Wan2.1 / CogVideo / HunyuanVideo / Mochi / LTX-Video 等
 *   - Wan2.1 原生推理（直调 Python 脚本，性能最优）
 *
 * 模型前缀映射表：
 *   local-comfy/模型名.后缀  →  ComfyUI 通用工作流
 *   local-wan/*              →  Wan2.1 原生推理
 *   wan2.1-local*            →  Wan2.1 别名
 *   local-cogvideo/*         →  CogVideo ComfyUI 工作流
 *   local-hunyuan/*          →  HunyuanVideo ComfyUI 工作流
 *   local-mochi/*            →  Mochi ComfyUI 工作流
 *   local-ltx/*              →  LTX-Video ComfyUI 工作流
 *
 * 默认 ComfyUI API 地址: http://127.0.0.1:8188
 */

import { ModelAdapter, ModelAdapterInput, ModelAdapterResult } from '../types.js'
import type { RuntimePayload } from '../../runtime/runtime-payload.js'
import { readFileSync, existsSync, readdirSync, mkdirSync } from 'fs'
import { resolve, join } from 'path'
import { execSync } from 'child_process'

const COMFY_DEFAULT_URL = process.env.COMFY_URL || 'http://127.0.0.1:8188'
const WORKFLOW_DIR = '/root/shipin-cinematic-studio/workflows/comfy-video'
const WAN2_1_SCRIPT = process.env.WAN2_1_SCRIPT || '/opt/Wan2.1/infer.py'
const WAN2_1_OUTPUT = process.env.WAN2_1_OUTPUT || '/tmp/wan2_output'

// ===== 检测工具 =====

function execCmd(cmd: string, timeout = 5000): string {
  try {
    return execSync(cmd, { encoding: 'utf-8', timeout, stdio: 'pipe' }).toString().trim()
  } catch { return '' }
}

function isComfyRunning(): boolean {
  return !!execCmd(`curl -s -o /dev/null -w "%{http_code}" --connect-timeout 3 --max-time 3 ${COMFY_DEFAULT_URL}/queue`, 5000)
}

function isWanAvailable(): boolean {
  return existsSync(WAN2_1_SCRIPT)
}

/** 扫描 ComfyUI 视频模型 */
function getComfyVideoModels(): string[] {
  const dirs = [
    resolve(process.env.HOME || '/root', 'ComfyUI/models/checkpoints/'),
    '/opt/ComfyUI/models/checkpoints/',
    resolve(process.env.HOME || '/root', 'ComfyUI/models/diffusion_models/'),
  ]
  const models: Set<string> = new Set()
  for (const dir of dirs) {
    if (!existsSync(dir)) continue
    try {
      for (const f of readdirSync(dir)) {
        if (f.endsWith('.safetensors') || f.endsWith('.ckpt')) models.add(f)
      }
    } catch {}
  }
  return [...models].sort()
}

/** 获取可用引擎列表 */
function getAvailableEngines(): { name: string; available: boolean; label: string }[] {
  return [
    { name: 'comfyui', available: isComfyRunning(), label: 'ComfyUI (通用)' },
    { name: 'wan2.1', available: isWanAvailable(), label: 'Wan2.1 (原生)' },
  ]
}

// ===== ComfyUI 视频工作流 =====

/**
 * 根据模型类型选择 / 生成对应 ComfyUI workflow
 * 预置工作流模板加载自 workflows/comfy-video/ 目录
 */
async function loadWorkflow(workflowName: string): Promise<any> {
  const paths = [
    join(WORKFLOW_DIR, workflowName),
    join(WORKFLOW_DIR, `${workflowName}.json`),
  ]
  for (const p of paths) {
    if (existsSync(p)) {
      try {
        return JSON.parse(readFileSync(p, 'utf-8'))
      } catch (e) {
        console.warn(`[LocalVideo] 工作流模板解析失败: ${p}`)
      }
    }
  }
  return null
}

/** 构建通用 ComfyUI T2V 工作流（动态生成，无模板文件时用） */
function buildT2VWorkflow(prompt: string, negativePrompt: string, duration: number, modelName: string): any {
  const frameRate = 8
  const totalFrames = Math.max(1, Math.floor(duration * frameRate))
  const steps = Math.min(Math.max(Math.floor(duration * 6), 20), 100)

  return {
    "3": {
      "class_type": "KSampler",
      "inputs": {
        "seed": Math.floor(Math.random() * 1000000),
        "steps": steps, "cfg": 7.0,
        "sampler_name": "euler", "scheduler": "normal", "denoise": 1.0,
        "model": ["4", 0], "positive": ["6", 0], "negative": ["7", 0],
        "latent_image": ["5", 0]
      }
    },
    "4": { "class_type": "CheckpointLoaderSimple", "inputs": { "ckpt_name": modelName } },
    "5": { "class_type": "EmptyLatentImage", "inputs": { "width": 640, "height": 384, "batch_size": totalFrames } },
    "6": { "class_type": "CLIPTextEncode", "inputs": { "text": prompt, "clip": ["4", 1] } },
    "7": { "class_type": "CLIPTextEncode", "inputs": { "text": negativePrompt || "blurry, low quality", "clip": ["4", 1] } },
    "8": { "class_type": "VAEDecode", "inputs": { "samples": ["3", 0], "vae": ["4", 2] } },
    "9": {
      "class_type": "VideoCombine",
      "inputs": { "frame_rate": frameRate, "loop_count": 0, "filename_prefix": "video_gen", "format": "video/mp4", "pingpong": false, "save_output": true, "images": ["8", 0] }
    }
  }
}

/** 根据模型类型选择对应 workflow */
async function resolveWorkflow(modelPrefix: string, prompt: string, negativePrompt: string, duration: number, modelName: string): Promise<any> {
  // 优先加载预置工作流模板
  const templateName = `${modelPrefix}_t2v.json`
  const template = await loadWorkflow(templateName)
  if (template) {
    console.log(`[LocalVideo] 加载预置工作流: ${templateName}`)
    // 替换工作流中的 prompt 文本节点
    return injectPrompt(template, prompt, negativePrompt)
  }
  // fallback: 动态生成通用工作流
  console.log(`[LocalVideo] 使用动态生成的工作流 (model=${modelName})`)
  return buildT2VWorkflow(prompt, negativePrompt, duration, modelName)
}

/** 注入 prompt 到工作流模板 */
function injectPrompt(workflow: any, prompt: string, negativePrompt: string): any {
  const wf = JSON.parse(JSON.stringify(workflow))
  for (const [nodeId, node] of Object.entries(wf)) {
    const n = node as any
    if (n?.class_type === 'CLIPTextEncode') {
      if (!n.inputs || !n.inputs.text) continue
      // positive 节点: 如果 text 包含占位符 {prompt} 才替换
      if (n.inputs.text.includes('{prompt}')) {
        n.inputs.text = n.inputs.text.replace('{prompt}', prompt)
      }
      // negative 节点
      if (n.inputs.text.includes('{negative}')) {
        n.inputs.text = n.inputs.text.replace('{negative}', negativePrompt || '')
      }
    }
    // 替换 seed 节点
    if (n?.class_type?.includes('KSampler') && n?.inputs?.seed === 0) {
      n.inputs.seed = Math.floor(Math.random() * 1000000)
    }
  }
  return wf
}

/** 提交 ComfyUI 任务并轮询结果 */
async function submitComfyJob(workflow: any): Promise<string> {
  const res = await fetch(`${COMFY_DEFAULT_URL}/prompt`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ prompt: workflow }),
    signal: AbortSignal.timeout(60000),
  })
  if (!res.ok) throw new Error(`ComfyUI 提交失败: ${res.status}`)
  const data = await res.json()
  const promptId = data.prompt_id
  if (!promptId) throw new Error(`ComfyUI 未返回 prompt_id: ${JSON.stringify(data)}`)

  for (let i = 0; i < 600; i++) {  // 最长等 10 分钟
    await new Promise(r => setTimeout(r, 1000))
    try {
      const histRes = await fetch(`${COMFY_DEFAULT_URL}/history/${promptId}`, { signal: AbortSignal.timeout(5000) })
      if (!histRes.ok) continue
      const hist = await histRes.json()
      const outputs = hist[promptId]?.outputs
      if (!outputs) continue

      for (const nodeId of Object.keys(outputs)) {
        const nodeOutput = outputs[nodeId]
        if (nodeOutput?.videos?.length) {
          const v = nodeOutput.videos[0]
          return `${COMFY_DEFAULT_URL}/view?filename=${v.filename}&subfolder=${v.subfolder || ''}&type=${v.type || 'output'}`
        }
        if (nodeOutput?.gifs?.length) {
          const g = nodeOutput.gifs[0]
          return `${COMFY_DEFAULT_URL}/view?filename=${g.filename}&subfolder=${g.subfolder || ''}&type=${g.type || 'output'}`
        }
      }
    } catch {}
  }
  throw new Error('ComfyUI 视频生成超时')
}

// ===== Wan2.1 原生推理 =====

async function runWan2_1(prompt: string, imageUrl?: string, duration: number = 5): Promise<string> {
  if (!existsSync(WAN2_1_SCRIPT)) throw new Error(`Wan2.1 未安装: ${WAN2_1_SCRIPT}`)
  mkdirSync(WAN2_1_OUTPUT, { recursive: true })

  const mode = imageUrl ? 'i2v' : 't2v'
  const cmd = imageUrl
    ? `python3 ${WAN2_1_SCRIPT} --task i2v --image_path "${imageUrl}" --prompt "${prompt.replace(/"/g, '\\"')}" --output ${WAN2_1_OUTPUT}`
    : `python3 ${WAN2_1_SCRIPT} --task t2v --prompt "${prompt.replace(/"/g, '\\"')}" --duration ${duration} --output ${WAN2_1_OUTPUT}`

  console.log(`[Wan2.1] ${mode} 开始推理...`)
  try {
    execSync(cmd, { timeout: 600000, encoding: 'utf-8', stdio: 'pipe' })
  } catch (e: any) {
    throw new Error(`Wan2.1 推理失败: ${e.message}`)
  }

  const files = readdirSync(WAN2_1_OUTPUT).filter(f => f.endsWith('.mp4') || f.endsWith('.gif'))
  if (!files.length) throw new Error('Wan2.1 未生成视频文件')
  return `file://${WAN2_1_OUTPUT}/${files.sort().reverse()[0]}`
}

// ===== 模型路由 =====

/** 模型前缀 → { engine, workflowType, label } */
const MODEL_ROUTES: Record<string, { engine: 'comfyui' | 'wan2.1'; label: string }> = {
  'local-comfy': { engine: 'comfyui', label: 'ComfyUI 通用' },
  'local-cogvideo': { engine: 'comfyui', label: 'CogVideo' },
  'local-hunyuan': { engine: 'comfyui', label: 'HunyuanVideo' },
  'local-mochi': { engine: 'comfyui', label: 'Mochi' },
  'local-ltx': { engine: 'comfyui', label: 'LTX-Video' },
  'local-wan': { engine: 'wan2.1', label: 'Wan2.1 原生' },
}

/** 解析模型前缀 */
function resolveRoute(model: string): { prefix: string; modelName: string; route: typeof MODEL_ROUTES[string] | undefined } {
  for (const prefix of Object.keys(MODEL_ROUTES)) {
    if (model.startsWith(prefix)) {
      return { prefix, modelName: model.replace(`${prefix}/`, ''), route: MODEL_ROUTES[prefix] }
    }
  }
  return { prefix: '', modelName: model, route: undefined }
}

// ===== 导出 =====

export const localVideoAdapter: ModelAdapter = {
  name: 'local-video',
  supportedModels: [
    'local-comfy/*',     // ComfyUI 视频通用
    'local-cogvideo/*',  // 智谱 CogVideo
    'local-hunyuan/*',   // 腾讯 HunyuanVideo
    'local-mochi/*',     // Genmo Mochi
    'local-ltx/*',       // LTX-Video
    'local-wan/*',       // Wan2.1 原生推理
    'wan2.1-local*',      // Wan2.1 别名
  ],
  taskTypes: ['video'],
  provider: 'local-video',

  async execute(runtime: RuntimePayload, input: ModelAdapterInput): Promise<ModelAdapterResult> {
    const model = input.model || 'local-comfy/default'
    const prompt = input.prompt || ''
    const duration = input.duration || 5
    const { prefix, modelName, route } = resolveRoute(model)

    // Wan2.1 别名
    if (model.startsWith('wan2.1') || prefix === 'local-wan') {
      if (!isWanAvailable()) throw new Error('Wan2.1 环境未就绪')
      const url = await runWan2_1(prompt, input.imageUrl, duration)
      return { url, duration, provider: 'Wan2.1 (本地)', metadata: { engine: 'wan2.1', mode: input.imageUrl ? 'i2v' : 't2v' } }
    }

    // 其他都走 ComfyUI
    if (!isComfyRunning()) throw new Error(`ComfyUI 未运行。请先启动 ComfyUI (${COMFY_DEFAULT_URL})`)
    const engineLabel = route?.label || 'ComfyUI 通用'
    const resolvedModelName = modelName || 'wan2.1_i2v_480p_14B_bf16.safetensors'
    const workflow = await resolveWorkflow(prefix, prompt, input.negativePrompt || '', duration, resolvedModelName)

    const videoUrl = await submitComfyJob(workflow)
    return {
      url: videoUrl, duration, provider: `${engineLabel} (本地)`,
      metadata: { engine: route?.engine || 'comfyui', model: resolvedModelName },
    }
  },
}

export { getAvailableEngines, isComfyRunning, isWanAvailable, getComfyVideoModels }
