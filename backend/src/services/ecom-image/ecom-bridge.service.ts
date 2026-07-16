/**
 * EcomImage — PrismPix Python 服务的 Node.js 桥接层
 * 
 * 通过 subprocess 调用 PrismPix 的 stage1/stage2/stage3 + image_gen。
 * 所有 Python 依赖在 PrismPix 的 venv 中。
 */

import { execSync } from 'child_process'
import path from 'path'
import fs from 'fs'

const PRISMPIX_DIR = '/tmp/prismpix-source/PrismPix-main'
const PYTHON = 'python3'

/** 用户的 LLM 配置（从 UserModelConfigV2 读取后传入） */
export interface UserLLMConfig {
  apiKey: string
  baseUrl?: string
  modelName?: string
  provider?: string
}

export interface UserVisionConfig {
  apiKey: string
  baseUrl?: string
  modelName: string
}

export interface AnalyzeResult {
  product: any      // Stage1 产出
  campaign: any     // Stage2 产出
  prompts: any      // Stage3 产出
}

export interface GenerateResult {
  generated: number
  skipped: number
  failed: number
  images: string[]  // 生成的图片 URL 列表
}

/**
 * 用用户的 LLM 配置构造 Python 子进程的环境变量
 */
function buildPythonEnv(config?: {
  llm?: UserLLMConfig
  vision?: UserVisionConfig
}): NodeJS.ProcessEnv {
  const env: any = { ...process.env, PYTHONIOENCODING: 'utf-8' }

  // ── 文本 LLM 配置（Stage2/3）──
  if (config?.llm?.apiKey) {
    env.OPENAI_API_KEY = config.llm.apiKey
    env.API_KEY = config.llm.apiKey
    if (config.llm.baseUrl) {
      env.OPENAI_BASE_URL = config.llm.baseUrl
      env.BASE_URL = config.llm.baseUrl
    }
    if (config.llm.modelName) {
      env.OPENAI_MODEL_NAME = config.llm.modelName
      env.MODEL_NAME = config.llm.modelName
    }
  }

  // ── Vision 配置（Stage1 视觉分析）──
  if (config?.vision?.apiKey) {
    env.VISION_API_KEY = config.vision.apiKey
    env.OPENAI_VISION_API_KEY = config.vision.apiKey
    if (config.vision.baseUrl) {
      env.VISION_BASE_URL = config.vision.baseUrl
      env.OPENAI_VISION_BASE_URL = config.vision.baseUrl
    }
    if (config.vision.modelName) {
      env.VISION_MODEL = config.vision.modelName
      env.OPENAI_VISION_MODEL = config.vision.modelName
    }
  }

  return env
}

/**
 * 调用 PrismPix 的 CLI 分析流程（Stage1 + Stage2 + Stage3）
 * 
 * 通过一个 Python 脚本统一编排，返回 JSON。
 */
export async function runAnalysis(params: {
  imageUrl: string           // 产品图片 URL（绝对路径或公网 URL）
  category: string
  style: string
  language: string
  modelAttrs: string
  modelScene: string
  shootingStyle: string
  faceVisible: string
  skuName: string
  llmConfig?: UserLLMConfig   // 文本 LLM 配置（Stage2/3）
  visionConfig?: UserVisionConfig  // 视觉模型配置（Stage1）
}): Promise<AnalyzeResult> {
  const { imageUrl, category, style, language, modelAttrs, modelScene, shootingStyle, faceVisible, skuName, llmConfig, visionConfig } = params

  // 下载远程图片到临时目录（如果是 URL）
  let localImagePath = imageUrl
  if (imageUrl.startsWith('http://') || imageUrl.startsWith('https://')) {
    const tmpDir = '/tmp/ecom_analyze'
    fs.mkdirSync(tmpDir, { recursive: true })
    const ext = path.extname(imageUrl.split('?')[0]) || '.png'
    localImagePath = path.join(tmpDir, `product_${Date.now()}${ext}`)
    execSync(`curl -sL -o "${localImagePath}" "${imageUrl}"`, { timeout: 30000 })
  } else if (!imageUrl.startsWith('/')) {
    // 相对路径 — 转成 public/ 下绝对路径
    localImagePath = path.resolve(process.cwd(), 'public', imageUrl)
  }

  // 构建 JSON 输入
  const inputJson = JSON.stringify({
    image: localImagePath,
    sku: skuName,
    product_hint: {
      category,
      style,
      model_attrs: modelAttrs,
      additional_requirements: modelScene ? `拍摄场景: ${modelScene}` : '',
    },
    generation_mode: 'full',
    platform: '',
    language,
    model_attrs: modelAttrs,
    model_scene: modelScene,
    shooting_style: shootingStyle,
    face_visible: faceVisible,
  })

  // 调用 Python 分析脚本
  const script = path.join(PRISMPIX_DIR, 'cli_analyze.py')
  // 如果脚本不存在则动态生成
  if (!fs.existsSync(script)) {
    fs.writeFileSync(script, getAnalyzeScriptContent())
  }

  try {
    const stdout = execSync(`cd "${PRISMPIX_DIR}" && ${PYTHON} cli_analyze.py`, {
      input: inputJson,
      timeout: 120000,      // 最多 2 分钟
      maxBuffer: 10 * 1024 * 1024,
      env: buildPythonEnv({ llm: llmConfig, vision: visionConfig }),
    })

    const result = JSON.parse(stdout.toString())
    return result
  } catch (err: any) {
    // 如果 stdout 里有部分 JSON，尝试提取
    const stderr = err.stderr?.toString() || ''
    const stdout = err.stdout?.toString() || ''
    console.error('[Ecom Analyze] stderr:', stderr.substring(0, 1000))
    
    // 尝试从 stdout 中提取 JSON
    const jsonMatch = stdout.match(/\{[\s\S]*\}/)
    if (jsonMatch) {
      try {
        return JSON.parse(jsonMatch[0])
      } catch {}
    }
    
    throw new Error(`分析失败: ${err.message}\n${stderr.substring(0, 500)}`)
  }
}

/**
 * 调用 PrismPix 的 CLI 生成图片
 */
export async function runGeneration(params: {
  projectId: string
  imageUrl: string
  prompts: any
  category: string
  language: string
  modelAttrs: string
  modelScene: string
  shootingStyle: string
  faceVisible: string
  llmConfig?: UserLLMConfig
  visionConfig?: UserVisionConfig
}): Promise<GenerateResult> {
  const { projectId, imageUrl, prompts, category, language, modelAttrs, modelScene, shootingStyle, faceVisible, llmConfig, visionConfig } = params

  // 准备输出目录 — 统一到 backend/public/uploads/ecom/gen/{projectId}
  const outputDir = path.resolve(process.cwd(), 'public', 'uploads', 'ecom', 'gen', projectId)
  fs.mkdirSync(outputDir, { recursive: true })

  // 图片本地路径 — 同 runAnalysis 的修复策略
  let localImagePath = imageUrl
  if (imageUrl.startsWith('/')) {
    // 图片 URL 如 /uploads/ecom/xxx/xxx/product_xxx.png → 本地 public/ 目录
    localImagePath = path.resolve(process.cwd(), 'public', imageUrl.replace(/^\//, ''))
  } else if (imageUrl.startsWith('http://') || imageUrl.startsWith('https://')) {
    const tmpDir = '/tmp/ecom_gen'
    fs.mkdirSync(tmpDir, { recursive: true })
    const ext = path.extname(imageUrl.split('?')[0]) || '.png'
    localImagePath = path.join(tmpDir, `gen_${Date.now()}${ext}`)
    execSync(`curl -sL -o "${localImagePath}" "${imageUrl}"`, { timeout: 30000 })
  }

  const inputJson = JSON.stringify({
    image: localImagePath,
    output_dir: outputDir,
    prompts,
    category,
    language,
    model_attrs: modelAttrs,
    model_scene: modelScene,
    shooting_style: shootingStyle,
    face_visible: faceVisible,
    generation_mode: 'full',
  })

  const script = path.join(PRISMPIX_DIR, 'cli_generate.py')
  if (!fs.existsSync(script)) {
    fs.writeFileSync(script, getGenerateScriptContent())
  }

  try {
    const stdout = execSync(`cd "${PRISMPIX_DIR}" && ${PYTHON} cli_generate.py`, {
      input: inputJson,
      timeout: 600000,      // 最多 10 分钟
      maxBuffer: 10 * 1024 * 1024,
      env: buildPythonEnv({ llm: llmConfig, vision: visionConfig }),
    })

    const result = JSON.parse(stdout.toString())

    // 将生成图片的本地绝对路径转为公网可访问的相对路径
    // 本地路径: /root/shipin-cinematic-studio/backend/public/uploads/ecom/gen/{projectId}/xxx.png
    // 公网路径: /uploads/ecom/gen/{projectId}/xxx.png
    if (result.images) {
      const publicDir = path.resolve(process.cwd(), 'public')
      result.images = result.images.map((imgPath: string) => {
        const rel = path.relative(publicDir, imgPath)
        return '/' + rel.replace(/\\/g, '/')
      })
    }

    return result
  } catch (err: any) {
    const stderr = err.stderr?.toString() || ''
    console.error('[Ecom Generate] stderr:', stderr.substring(0, 1000))
    throw new Error(`图片生成失败: ${err.message}\n${stderr.substring(0, 500)}`)
  }
}

// ─── Python 脚本 ───

function getAnalyzeScriptContent(): string {
  return `#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
cli_analyze.py — PrismPix 分析流程 CLI
输入: stdin JSON
输出: stdout JSON { product, campaign, prompts }
"""
import sys, json, os
sys.path.insert(0, os.path.dirname(__file__))

import openai as openai_module
from ecom_image_gen.config import Config, ProductInput, load_config
from ecom_image_gen.stage1 import stage1_analyze_image
from ecom_image_gen.stage2 import stage2_generate_campaign
from ecom_image_gen.stage3 import stage3_generate_prompts
from ecom_image_gen.client import build_client as create_client
from ecom_image_gen.logging_setup import setup_logging

import logging
setup_logging(level=logging.WARNING)

def build_vision_client():
    """从环境变量 VISION_* 创建专门用于视觉分析的 OpenAI client"""
    api_key = os.environ.get("VISION_API_KEY") or os.environ.get("OPENAI_VISION_API_KEY") or ""
    base_url = os.environ.get("VISION_BASE_URL") or os.environ.get("OPENAI_VISION_BASE_URL") or ""
    if not api_key:
        raise RuntimeError("缺少 VISION_API_KEY (请在大模型设置中配置图片模型的 API Key)")
    kwargs = {"api_key": api_key}
    if base_url:
        kwargs["base_url"] = base_url
    return openai_module.OpenAI(**kwargs)

def main():
    raw = sys.stdin.read()
    params = json.loads(raw)
    
    # ── 文本 LLM client（Stage2/3） ──
    cfg = load_config()
    client = create_client(cfg)

    # ── Vision client（Stage1 视觉分析） ──
    vision_client = build_vision_client()
    vision_model = (os.environ.get("VISION_MODEL") or os.environ.get("OPENAI_VISION_MODEL") or "").strip()
    if not vision_model:
        # 回退到文本模型
        vision_model = cfg.model_name
    cfg.vision_model = vision_model

    # 临时替换 client 里的 vision_model 调用
    # stage1_analyze_image 内部用 cfg.vision_model 和传进去的 client 调用
    
    product_hint = ProductInput(
        sku=params.get("sku", ""),
        image=params.get("image", ""),
        category=params.get("product_hint", {}).get("category", ""),
        style=params.get("product_hint", {}).get("style", ""),
        model_attrs=params.get("product_hint", {}).get("model_attrs", ""),
        additional_requirements=params.get("product_hint", {}).get("additional_requirements", ""),
    )
    
    # Stage1: 产品分析（用 vision client 和 vision model）
    product = stage1_analyze_image(vision_client, cfg, params["image"], product_hint)
    
    # Stage2: 营销策略（用文本 client）
    campaign = stage2_generate_campaign(client, cfg, product)
    
    # Stage3: Prompt 生成（用文本 client）
    prompts = stage3_generate_prompts(
        client, cfg, product, campaign,
        category=params.get("product_hint", {}).get("category", ""),
        style=params.get("product_hint", {}).get("style", ""),
        generation_mode=params.get("generation_mode", "full"),
        language=params.get("language", ""),
        model_attrs=params.get("model_attrs", ""),
        model_scene=params.get("model_scene", ""),
        shooting_style=params.get("shooting_style", ""),
        face_visible=params.get("face_visible", "show"),
    )
    
    result = {
        "product": product,
        "campaign": campaign,
        "prompts": prompts,
    }
    
    print(json.dumps(result, ensure_ascii=False, default=str))

if __name__ == "__main__":
    main()
`
}

function getGenerateScriptContent(): string {
  return `#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
cli_generate.py — PrismPix 图片生成 CLI
输入: stdin JSON { image, output_dir, prompts, ... }
输出: stdout JSON { generated, skipped, failed, images }
"""
import sys, json, os, glob
sys.path.insert(0, os.path.dirname(__file__))

from ecom_image_gen.config import Config, load_config
from ecom_image_gen.client import build_client as create_client
from ecom_image_gen.image_gen import generate_all_images, generate_lookbook
from ecom_image_gen.logging_setup import setup_logging
from pathlib import Path

import logging
setup_logging(level=logging.WARNING)

def main():
    raw = sys.stdin.read()
    params = json.loads(raw)
    cfg = load_config()          # ← 从环境变量读 key 和 base_url
    client = create_client(cfg)
    
    ws = Path(params["output_dir"])
    ws.mkdir(parents=True, exist_ok=True)
    
    # 生成主图+详情图
    result = generate_all_images(
        client, cfg, params.get("prompts", {}),
        params["image"], ws,
        category=params.get("category", ""),
    )
    
    # 如果有 lookbook prompt, 也生成
    lookbook_result = None
    has_lookbook = any(k.startswith("M") for k in params.get("prompts", {}).keys())
    if has_lookbook:
        lookbook_result = generate_lookbook(
            client, cfg, params.get("prompts", {}),
            params["image"], ws,
            model_attrs=params.get("model_attrs", ""),
            model_scene=params.get("model_scene", ""),
            shooting_style=params.get("shooting_style", ""),
            face_visible=params.get("face_visible", "show"),
        )
    
    # 收集所有生成的图片
    images = sorted(glob.glob(str(ws / "*.png")))
    
    output = {
        "generated": result.get("generated", 0) + (lookbook_result.get("generated", 0) if lookbook_result else 0),
        "skipped": result.get("skipped", 0) + (lookbook_result.get("skipped", 0) if lookbook_result else 0),
        "failed": result.get("failed", 0) + (lookbook_result.get("failed", 0) if lookbook_result else 0),
        "images": images,
        "product_ref": result.get("product_ref", ""),
    }
    
    print(json.dumps(output, ensure_ascii=False, default=str))

if __name__ == "__main__":
    main()
`
}
