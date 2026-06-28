/**
 * four-view-merger.ts — 动态格数定妆图工具
 *
 * 根据角色是否持有武器，动态生成 4 格或 6 格定妆图：
 * - 4格（无武器）：大头特写 + 正面全身 + 侧面全身 + 背面全身
 * - 6格（有武器）：以上 4 格 + 持武器正面 + 持武器侧面
 *
 * 布局:
 * 4格（2×2）:
 * ┌──────────────┬──────────────┐
 * │ ① 大头特写    │ ② 正面全身    │
 * ├──────────────┼──────────────┤
 * │ ③ 侧面全身    │ ④ 背面全身    │
 * └──────────────┴──────────────┘
 *
 * 6格（3×2）:
 * ┌──────────────┬──────────────┐
 * │ ① 大头特写    │ ② 正面全身    │
 * ├──────────────┼──────────────┤
 * │ ③ 持武器正面  │ ④ 侧面全身    │
 * ├──────────────┼──────────────┤
 * │ ⑤ 持武器侧面  │ ⑥ 背面全身    │
 * └──────────────┴──────────────┘
 *
 * 与旧三视图的区别：
 * - 增加一张"大头特写"（面部特写半身照）
 * - 动态列数：2 列固定，行数 = ceil(视图数 / 2)
 * - 子图带编号标签①②③④⑤⑥
 */

import { execSync } from 'child_process'
import * as path from 'path'
import * as fs from 'fs'
import { randomUUID } from 'crypto'
import { fileURLToPath } from 'url'

export interface DynamicViewInput {
  portraitImageUrl: string  // 大头特写（面部特写半身照）URL
  frontImageUrl: string     // 正视图（正面全身立正）URL
  sideImageUrl: string      // 侧视图（右侧面全身立正）URL
  backImageUrl: string      // 背视图（背面全身立正）URL
  weaponFrontUrl?: string   // 持武器正面（有武器时）URL
  weaponSideUrl?: string    // 持武器侧面（有武器时）URL
  characterName: string     // 角色名
}

export interface DynamicViewResult {
  mergedImageUrl: string
  faceCropUrl?: string
  width: number
  height: number
  gridCount: number  // 4 或 6
}

export interface FaceCropResult {
  faceCropUrl: string
  width: number
  height: number
}

/**
 * 下载远程图片到临时目录
 */
async function downloadImage(url: string, tmpDir: string, label: string): Promise<string> {
  const urlObj = new URL(url)
  const ext = path.posix.extname(urlObj.pathname) || '.png'
  const localPath = path.join(tmpDir, `${label}${ext}`)
  const resp = await fetch(url)
  if (!resp.ok) throw new Error(`下载图片失败 (${label}): ${resp.status}`)
  const buffer = Buffer.from(await resp.arrayBuffer())
  fs.writeFileSync(localPath, buffer)
  return localPath
}

/**
 * 使用 Python Pillow 合并图片为 2 列网格，支持 4 格或 6 格
 */
async function mergeImagesWithPillow(
  imagePaths: string[],
  labels: string[],
  outputPath: string,
  characterName: string,
): Promise<{ width: number; height: number }> {
  const safeName = characterName.replace(/'/g, "\\'")
  const TARGET_CELL_H = 480

  // 生成 Python 脚本：支持 2-6 张图按 2 列排列
  const pathsStr = imagePaths.map(p => `'${p}'`).join(', ')
  const labelsStr = labels.map(l => `'${l.replace(/'/g, "\\'")}'`).join(', ')

  const pyScript = `
import sys
from PIL import Image, ImageDraw, ImageFont

# 加载所有图片
image_paths = [${pathsStr}]
labels = [${labelsStr}]
images = [Image.open(p).convert('RGB') for p in image_paths]

def resize_to_height(img, target_h):
    ratio = target_h / img.height
    w = int(img.width * ratio)
    return img.resize((w, target_h), Image.LANCZOS)

# 统一高度
images = [resize_to_height(img, ${TARGET_CELL_H}) for img in images]

# 统一所有单元格宽度（以最宽为准）
cell_w = max(img.width for img in images)

def pad_to_width(img, target_w, bg_color=(255, 255, 255)):
    if img.width >= target_w:
        return img
    result = Image.new('RGB', (target_w, img.height), bg_color)
    result.paste(img, (0, 0))
    return result

images = [pad_to_width(img, cell_w) for img in images]

# 布局参数
sep = 3
title_h = 40
cols = 2
rows = (len(images) + 1) // 2  # ceil division

grid_w = cell_w * cols + sep
grid_h = ${TARGET_CELL_H} * rows + sep * (rows - 1) + title_h

canvas = Image.new('RGB', (grid_w, grid_h), 'white')

# 左上→从左上开始按行填充：先第一列 top→bottom，再第二列 top→bottom
# 实际上: col0=(0,title_h), col1=(cell_w+sep,title_h); 下一行 y+=cell_h+sep
positions = []
for r in range(rows):
    for c in range(cols):
        idx = r * cols + c
        if idx < len(images):
            x = c * (cell_w + sep)
            y = title_h + r * (${TARGET_CELL_H} + sep)
            canvas.paste(images[idx], (x, y))
            positions.append((x, y, idx))

# 绘制标题
draw = ImageDraw.Draw(canvas)
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
        font = ImageFont.truetype(fp, 22)
        break
    except:
        continue
if font is None:
    font = ImageFont.load_default()

for i, (x, y, idx) in enumerate(positions):
    draw.text((x + 6, y + 5), labels[idx], fill='black', font=font)

# 用 JPEG 保存
jpg_output = '${outputPath}'.replace('.png', '.jpg')
canvas.save(jpg_output, 'JPEG', quality=85)
print(f'merged: {canvas.width}x{canvas.height}', flush=True)
print(f'output: {jpg_output}', flush=True)
print(f'rows: {rows}', flush=True)
`
  const scriptPath = `/tmp/view_merge_${randomUUID().slice(0, 8)}.py`
  fs.writeFileSync(scriptPath, pyScript)
  try {
    const output = execSync(`python3 ${scriptPath}`, { timeout: 60000, encoding: 'utf-8' })
    const match = output.trim().match(/merged:\s*(\d+)x(\d+)/)
    const width = match ? parseInt(match[1]) : 800
    const height = match ? parseInt(match[2]) : 1060
    return { width, height }
  } finally {
    fs.unlinkSync(scriptPath)
  }
}

/**
 * 从合并图的第一个像素区域（左上角大头特写）裁剪面部参考图
 */
export async function extractFaceFromFourView(
  mergedLocalPath: string,
  outputDir: string,
  characterName: string,
): Promise<FaceCropResult> {
  const safeName = characterName.replace(/[^a-zA-Z0-9\u4e00-\u9fff_-]/g, '_')
  const outputFileName = `face_${safeName}_${randomUUID().slice(0, 8)}.png`
  const outputPath = path.join(outputDir, outputFileName)

  const pyScript = `
from PIL import Image
img = Image.open('${mergedLocalPath}').convert('RGB')
w, h = img.size
title_h = 40
cell_w = w // 2
cell_h = (h - title_h) // (2 if abs(h - 1060) < 100 else 3)  # 检测是 4格还是6格
# 裁剪大头照区域（左上格），取上半部分 60%
crop = img.crop((0, title_h, cell_w, title_h + int(cell_h * 0.6)))
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
 * 核心入口：生成动态格数定妆图
 *
 * @param input 角色各视角（含武器附加视角）
 * @param outputDir 输出目录
 * @returns 合并图 + 正脸裁剪 + 格数信息
 */
export async function generateDynamicViewCharacterSheet(
  input: DynamicViewInput,
  outputDir: string = path.resolve(process.cwd(), 'public/uploads/characters'),
): Promise<DynamicViewResult> {
  const tmpDir = `/tmp/dynamic_view_${randomUUID().slice(0, 8)}`
  fs.mkdirSync(tmpDir, { recursive: true })
  fs.mkdirSync(outputDir, { recursive: true })

  try {
    // ⭐ R7 — Schema Validation：合并器 fail-fast
    // 验证必需视图存在，缺任何一张就不合并
    const requiredFields: Array<keyof DynamicViewInput> = ['frontImageUrl', 'portraitImageUrl']
    for (const field of requiredFields) {
      if (!input[field] || !(input[field] as string).startsWith('http')) {
        console.error(`[R7] 合并器：${field} 缺失或无效，废弃合并`)
        throw new Error(`[R7] MERGE_REJECTED: ${field} is missing or invalid`)
      }
    }

    // 判断是否有武器视角
    const hasWeapon = !!(input.weaponFrontUrl && input.weaponSideUrl)

    // 构建图片列表和标签
    const imageUrls: string[] = []
    const labels: string[] = []

    // 基础四视图 — 必须有 front 和 portrait，且必须是有效 URL
    // side/back 允许 fallback 到 front（但前端不会展示不完整的图）
    const effectiveSideUrl = input.sideImageUrl && input.sideImageUrl.startsWith('http')
      ? input.sideImageUrl
      : input.frontImageUrl  // 侧脸兜底
    const effectiveBackUrl = input.backImageUrl && input.backImageUrl.startsWith('http')
      ? input.backImageUrl
      : effectiveSideUrl

    imageUrls.push(input.portraitImageUrl) // 0: 大头特写
    labels.push('① 大头特写（面部参考）')

    if (hasWeapon) {
      // 6格模式：大头 + 正面全身 + 持武器正面 + 侧面全身 + 持武器侧面 + 背面全身
      imageUrls.push(input.frontImageUrl) // 1: 正面全身
      labels.push('② 正面全身立正')

      imageUrls.push(input.weaponFrontUrl!) // 2: 持武器正面
      labels.push('③ 持武器正面')

      imageUrls.push(effectiveSideUrl) // 3: 侧面全身
      labels.push('④ 侧面全身立正')

      imageUrls.push(input.weaponSideUrl!) // 4: 持武器侧面
      labels.push('⑤ 持武器侧面')

      imageUrls.push(effectiveBackUrl) // 5: 背面全身
      labels.push('⑥ 背面全身立正')
    } else {
      // 4格模式：大头 + 正面 + 侧面 + 背面
      imageUrls.push(input.frontImageUrl) // 1: 正面全身
      labels.push('② 正面全身立正')

      imageUrls.push(effectiveSideUrl) // 2: 侧面全身
      labels.push('③ 侧面全身立正')

      imageUrls.push(effectiveBackUrl) // 3: 背面全身
      labels.push('④ 背面全身立正')
    }

    // 1. 下载所有图片
    const downloadLabels = ['portrait', 'front', 'side', 'back']
    if (hasWeapon) {
      downloadLabels.push('weapon_front', 'weapon_side')
    }
    const downloadPromises = imageUrls.map((url, i) =>
      downloadImage(url, tmpDir, downloadLabels[i] || `img_${i}`)
    )
    const localPaths = await Promise.all(downloadPromises)

    // 2. 合并网格
    const safeName = input.characterName.replace(/[^a-zA-Z0-9\u4e00-\u9fff_-]/g, '_')
    const outputFileName = `view_${safeName}_${randomUUID().slice(0, 8)}.png`
    const outputPath = path.join(outputDir, outputFileName)

    await mergeImagesWithPillow(localPaths, labels, outputPath, input.characterName)

    // 实际输出是 jpg（脚本自动转）
    const jpgPath = outputPath.replace('.png', '.jpg')
    const actualPath = fs.existsSync(jpgPath) ? jpgPath : outputPath
    const publicFileName = actualPath === jpgPath ? outputFileName.replace('.png', '.jpg') : outputFileName
    const publicUrl = `/uploads/characters/${publicFileName}`

    // 3. ⭐ 自动裁剪面部参考图
    let faceCropUrl: string | undefined
    try {
      const faceResult = await extractFaceFromFourView(actualPath, outputDir, input.characterName)
      faceCropUrl = faceResult.faceCropUrl
      console.log(`[DynamicView] 正脸裁剪完成: ${faceCropUrl} (${faceResult.width}x${faceResult.height})`)
    } catch (e: any) {
      console.warn('[DynamicView] 正脸裁剪失败:', e.message)
    }

    // 4. 检测图片尺寸
    const sizeScript = `
from PIL import Image
img = Image.open('${actualPath}')
print(f'size: {img.width}x{img.height}', flush=True)
`
    const sizeScriptPath = `/tmp/size_check_${randomUUID().slice(0, 8)}.py`
    fs.writeFileSync(sizeScriptPath, sizeScript)
    let width = 800, height = 1060
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
      gridCount: hasWeapon ? 6 : 4,
    }
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true })
  }
}

/**
 * 兼容旧接口：generateFourViewCharacterSheet
 * 保持向后兼容
 */
export const generateFourViewCharacterSheet = generateDynamicViewCharacterSheet
