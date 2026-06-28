/**
 * triple-view-merger.ts — 三视定妆图工具
 *
 * 职责：将三个视角（正/侧/背）的角色图像合并为一张水平拼图，
 * 作为视频生成的参考图。
 *
 * 使用：sharp CLI（已全局可用）
 *
 * 输出格式：三张输入图像等高等比例缩放后水平拼接，
 * 中间用 4px 白色分割线隔开，底部加「正面/侧面/背面」文字标注。
 */

import { execSync } from 'child_process'
import * as path from 'path'
import * as fs from 'fs'
import { randomUUID } from 'crypto'

export interface TripleViewInput {
  frontImageUrl: string   // 正视图 URL
  sideImageUrl: string    // 侧视/¾面 URL
  backImageUrl: string    // 背视图 URL
  characterName: string   // 角色名（用于文件命名）
}

export interface TripleViewResult {
  mergedImageUrl: string               // 合并后的三视定妆图 URL
  faceCropUrl?: string                 // ⭐ 从合并图中裁剪出的正脸参考图 URL
  width: number
  height: number
}

// ⭐ 额外返回的裁剪信息
export interface FaceCropResult {
  faceCropUrl: string     // 裁剪后的正脸图 URL
  width: number
  height: number
}

/**
 * 下载远程图片到临时目录
 */
async function downloadImage(url: string, tmpDir: string, label: string): Promise<string> {
  const ext = path.posix.extname(new URL(url).pathname) || '.png'
  const localPath = path.join(tmpDir, `${label}${ext}`)
  const resp = await fetch(url)
  if (!resp.ok) throw new Error(`下载图片失败 (${label}): ${resp.status}`)
  const buffer = Buffer.from(await resp.arrayBuffer())
  fs.writeFileSync(localPath, buffer)
  return localPath
}

/**
 * 使用 sharp CLI 合并三张图
 * 命令格式：sharp 三张输入 --join-channel 不支持水平拼接，用 Python Pillow 代替
 */
async function mergeImagesWithPillow(
  frontPath: string,
  sidePath: string,
  backPath: string,
  outputPath: string,
  characterName: string,
): Promise<{ width: number; height: number }> {
  const pyScript = `
import sys
from PIL import Image, ImageDraw, ImageFont

# 加载三张图
front = Image.open('${frontPath}').convert('RGB')
side = Image.open('${sidePath}').convert('RGB')
back = Image.open('${backPath}').convert('RGB')

# 统一高度（以最高为准）
max_h = max(front.height, side.height, back.height)

def resize_to_height(img, target_h):
    ratio = target_h / img.height
    w = int(img.width * ratio)
    return img.resize((w, target_h), Image.LANCZOS)

front = resize_to_height(front, max_h)
side = resize_to_height(side, max_h)
back = resize_to_height(back, max_h)

# 分割线宽度
sep = 4
total_w = front.width + sep + side.width + sep + back.width

# 创建画布
canvas = Image.new('RGB', (total_w, max_h + 60), 'white')
canvas.paste(front, (0, 60))
canvas.paste(side, (front.width + sep, 60))
canvas.paste(back, (front.width + sep + side.width + sep, 60))

# 画分割线（纯白色，已经是白色背景所以不需要额外画线）

# 添加底部标注
draw = ImageDraw.Draw(canvas)
# 尝试加载中文字体
font = None
for fp in [
    '/usr/share/fonts/truetype/NotoSansCJK-Regular.ttc',
    '/usr/share/fonts/noto-cjk/NotoSansCJKsc-Regular.otf',
    '/usr/share/fonts/chinese/simsun.ttf',
    '/usr/share/fonts/truetype/wqy/wqy-zenhei.ttc',
    '/System/Library/Fonts/STHeiti Light.ttc',
    '/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf',
]:
    try:
        font = ImageFont.truetype(fp, 28)
        break
    except:
        continue

labels = ['正面', '侧面', '背面']
if font is None:
    font = ImageFont.load_default()

def get_center_x(img_width, text, font):
    # 无 getbbox 时用 textlength
    if hasattr(font, 'getlength'):
        tw = font.getlength(text)
    else:
        tw = font.getbbox(text)[2]
    return img_width // 2 - tw // 2

# 第一个标注
x_start = 0
label_text = labels[0]
x1 = x_start + get_center_x(front.width, label_text, font)
draw.text((x1, 5), label_text, fill='black', font=font)

# 第二个标注
x_start2 = front.width + sep
x2 = x_start2 + get_center_x(side.width, label_text.replace('正面', '侧面').replace('侧面',''), font)
draw.text((x_start2 + (side.width - (font.getlength(labels[1]) if hasattr(font,'getlength') else 56)) // 2, 5), labels[1], fill='black', font=font)

# 更稳健的方式：逐个写
texts = ['正面', '侧面', '背面']
positions = [front.width, side.width, back.width]
offsets = [0]
for i in range(1, 3):
    offsets.append(offsets[i-1] + positions[i-1] + sep)

for i, (text, offset) in enumerate(zip(texts, offsets)):
    tw = font.getlength(text) if hasattr(font, 'getlength') else len(text) * 20
    tx = offset + (positions[i] - int(tw)) // 2
    draw.text((max(0, tx), 5), text, fill='black', font=font)

canvas.save('${outputPath}')
print(f'merged: {canvas.width}x{canvas.height}', flush=True)
`
  const scriptPath = `/tmp/triple_merge_${randomUUID().slice(0, 8)}.py`
  fs.writeFileSync(scriptPath, pyScript)
  try {
    const output = execSync(`python3 ${scriptPath}`, { timeout: 30000, encoding: 'utf-8' })
    const match = output.trim().match(/merged:\s*(\d+)x(\d+)/)
    const width = match ? parseInt(match[1]) : 1024
    const height = match ? parseInt(match[2]) : 720
    return { width, height }
  } finally {
    fs.unlinkSync(scriptPath)
  }
}

/**
 * 从三视定妆图中裁剪出正脸区域作为角色参考图
 *
 * 合并图布局：[正面(33%) | 侧面(33%) | 背面(33%)]
 * 底部 60px 为标注文字区域。
 * 我们裁剪正面区域（左侧 33%），去掉底部文字标注（底部 60px），
 * 只保留角色正脸全身像作为"正脸参考图"。
 */
export async function extractFrontFaceFromTripleView(
  tripleViewLocalPath: string,
  outputDir: string,
  characterName: string,
): Promise<FaceCropResult> {
  const safeName = characterName.replace(/[^a-zA-Z0-9\u4e00-\u9fff_-]/g, '_')
  const outputFileName = `face_${safeName}_${randomUUID().slice(0, 8)}.png`
  const outputPath = path.join(outputDir, outputFileName)

  // 用 Python/Pillow 裁剪
  const pyScript = `
from PIL import Image
img = Image.open('${tripleViewLocalPath}').convert('RGB')
w, h = img.size
# 正面区域 = 左侧 33%，去掉底部 60px 标注区
panel_w = w // 3
# 底部留 60px 标注，标注在上面（顶部 60px），所以裁剪区域是 y=60 到 panel_h
# 实际上标注在顶部 60px（title area），角色图从 y=60 开始
crop = img.crop((0, 60, panel_w, h))
crop.save('${outputPath}')
print(f'face_crop: {crop.width}x{crop.height}', flush=True)
`
  const scriptPath = `/tmp/face_crop_${randomUUID().slice(0, 8)}.py`
  fs.writeFileSync(scriptPath, pyScript)
  try {
    const output = execSync(`python3 ${scriptPath}`, { timeout: 30000, encoding: 'utf-8' })
    const match = output.trim().match(/face_crop:\s*(\d+)x(\d+)/)
    const cw = match ? parseInt(match[1]) : 0
    const ch = match ? parseInt(match[2]) : 0
    return {
      faceCropUrl: `/uploads/characters/${outputFileName}`,
      width: cw,
      height: ch,
    }
  } finally {
    fs.unlinkSync(scriptPath)
  }
}

/**
 * 核心入口：生成三视定妆图（带正脸自动裁剪）
 *
 * @param input 三张角色视图的 URL
 * @param outputDir 输出目录
 * @returns 合并后的图片 + 正脸裁剪图 URL
 */
export async function generateTripleViewCharacterSheet(
  input: TripleViewInput,
  outputDir: string = '/root/shipin-cinematic-studio/backend/public/uploads/characters',
): Promise<TripleViewResult> {
  const tmpDir = `/tmp/triple_view_${randomUUID().slice(0, 8)}`
  fs.mkdirSync(tmpDir, { recursive: true })
  fs.mkdirSync(outputDir, { recursive: true })

  try {
    // 1. 下载三张图（侧脸/背脸缺失时用正脸代替）
    const effectiveSideImageUrl = input.sideImageUrl || input.frontImageUrl
    const effectiveBackImageUrl = input.backImageUrl || effectiveSideImageUrl
    const [frontPath, sidePath, backPath] = await Promise.all([
      downloadImage(input.frontImageUrl, tmpDir, 'front'),
      downloadImage(effectiveSideImageUrl, tmpDir, 'side'),
      downloadImage(effectiveBackImageUrl, tmpDir, 'back'),
    ])

    // 2. 合并
    const safeName = input.characterName.replace(/[^a-zA-Z0-9\u4e00-\u9fff_-]/g, '_')
    const outputFileName = `triple_${safeName}_${randomUUID().slice(0, 8)}.png`
    const outputPath = path.join(outputDir, outputFileName)

    await mergeImagesWithPillow(frontPath, sidePath, backPath, outputPath, input.characterName)

    const publicUrl = `/uploads/characters/${outputFileName}`

    // ⭐ 自动裁剪正脸参考图
    let faceCropUrl: string | undefined
    try {
      const faceResult = await extractFrontFaceFromTripleView(outputPath, outputDir, input.characterName)
      faceCropUrl = faceResult.faceCropUrl
      console.log(`[TripleView] 正脸裁剪完成: ${faceCropUrl} (${faceResult.width}x${faceResult.height})`)
    } catch (e: any) {
      console.warn('[TripleView] 正脸裁剪失败（不影响三视图本身）:', e.message)
    }

    // 3. 检测图片尺寸
    const sizeScript = `
from PIL import Image
img = Image.open('${outputPath}')
print(f'size: {img.width}x{img.height}', flush=True)
`
    const sizeScriptPath = `/tmp/size_check_${randomUUID().slice(0, 8)}.py`
    fs.writeFileSync(sizeScriptPath, sizeScript)
    let width = 1024, height = 720
    try {
      const sizeOutput = execSync(`python3 ${sizeScriptPath}`, { timeout: 10000, encoding: 'utf-8' })
      const sizeMatch = sizeOutput.trim().match(/size:\s*(\d+)x(\d+)/)
      if (sizeMatch) { width = parseInt(sizeMatch[1]); height = parseInt(sizeMatch[2]) }
    } catch {}
    fs.unlinkSync(sizeScriptPath)

    return {
      mergedImageUrl: publicUrl,
      faceCropUrl,
      width,
      height,
    }
  } finally {
    // 清理临时文件
    fs.rmSync(tmpDir, { recursive: true, force: true })
  }
}
