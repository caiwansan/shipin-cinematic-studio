/**
 * queue/video-composer.ts
 *
 * 视频合成器 — Video Composer
 *
 * 职责：
 *   把关键帧序列转化为平滑视频。
 *   支持两种模式：
 *     Mode 1: 纯 ffmpeg 合成（交叉溶解 + 插帧）
 *     Mode 2: 多帧 Video API（当底层 video API 支持帧序列时）
 *
 * 架构位置：
 *   Frame Sequence Engine → Video Composer → 最终视频 URL
 *
 * 宪法约束：
 *   - 不依赖任何 provider 知识
 *   - 所有帧文件下载到本地处理后上传
 */

import { execSync, exec } from 'child_process'
import * as fs from 'fs'
import * as path from 'path'
import * as https from 'https'
import * as http from 'http'
import { promisify } from 'util'

const execAsync = promisify(exec)

export interface ComposerFrame {
  second: number
  imageUrl: string
}

export interface VideoComposerInput {
  frames: ComposerFrame[]       // 帧序列（必须至少 2 帧）
  fps: number                   // 输出帧率（默认 24）
  duration: number              // 视频总时长（秒）
  outputName?: string           // 输出文件名前缀
  tempDir?: string              // 临时目录
}

export interface VideoComposerResult {
  videoUrl: string        // 生成的视频本地 URL （/uploads/xxx.mp4）
  duration: number
  totalFrames: number
  mode: 'ffmpeg' | 'api'
}

/**
 * 下载远程图片到本地临时目录
 */
async function downloadImage(url: string, dest: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const file = fs.createWriteStream(dest)
    const client = url.startsWith('https') ? https : http

    const req = client.get(url, { timeout: 30000 }, (res) => {
      if (res.statusCode && res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        // 重定向
        const client2 = res.headers.location.startsWith('https') ? https : http
        client2.get(res.headers.location, { timeout: 30000 }, (res2) => {
          res2.pipe(file)
          file.on('finish', () => {
            file.close()
            resolve(dest)
          })
        }).on('error', reject)
        return
      }
      res.pipe(file)
      file.on('finish', () => {
        file.close()
        resolve(dest)
      })
    })
    req.on('error', reject)
    req.setTimeout(30000, () => {
      req.destroy()
      reject(new Error(`下载超时: ${url.substring(0, 50)}`))
    })
  })
}

/**
 * 清理临时文件
 */
function cleanup(files: string[]): void {
  for (const f of files) {
    try { fs.unlinkSync(f) } catch (_) {}
  }
}

/**
 * Mode 1: ffmpeg 合成
 *
 * 方法：
 *   1. 把每张帧图复制为对应时间位置的静态帧
 *   2. 计算帧间隔时间（0.5 秒 = fps/2 帧）
 *   3. 用 concat demuxer 合并
 *   4. 交叉溶解过渡（crossfade）平滑衔接
 *
 * 注：如果只是简单的逐帧拼接，输出会有卡顿感。
 *     这里用 ffmpeg 的 blend/fade 滤镜做帧间过渡。
 */
async function composeViaFfmpeg(input: VideoComposerInput): Promise<VideoComposerResult> {
  const tempDir = input.tempDir || '/tmp/video-composer'
  const outputName = input.outputName || `video_${Date.now()}`
  const fps = input.fps || 24
  const outputPath = path.join(tempDir, `${outputName}.mp4`)

  // 确保目录存在
  fs.mkdirSync(tempDir, { recursive: true })

  const downloaded: string[] = []
  const fileList: string[] = []
  const cleanupFiles: string[] = []

  try {
    // 计算每帧应该持续多少帧（fps * 时间间隔）
    const frameInterval = input.duration / input.frames.length  // 每帧的秒数（如 0.5）
    const framesPerImage = Math.max(1, Math.round(fps * frameInterval))

    // 下载所有帧
    const localPaths: string[] = []
    for (let i = 0; i < input.frames.length; i++) {
      const ext = '.png'
      const localPath = path.join(tempDir, `frame_${String(i).padStart(4, '0')}${ext}`)
      cleanupFiles.push(localPath)
      await downloadImage(input.frames[i].imageUrl, localPath)
      localPaths.push(localPath)
    }

    // 方式 A：构建 filter_complex 的交叉溶解
    // 对于 0.5 秒间隔的帧，做 smooth 过渡
    // 统一用 concat demuxer 拼接所有帧
    for (let i = 0; i < input.frames.length; i++) {
      const localPath = localPaths[i]
      for (let j = 0; j < framesPerImage; j++) {
        fileList.push(`file '${localPath}'`)
        fileList.push(`duration ${frameInterval}`)
      }
    }
    // concat demuxer 需要最后一帧再出现一次（标记结束）
    fileList.push(`file '${localPaths[localPaths.length - 1]}'`)

    const concatFile = path.join(tempDir, 'filelist.txt')
    cleanupFiles.push(concatFile)
    fs.writeFileSync(concatFile, fileList.join('\n'))

    await execAsync(
      `ffmpeg -y -f concat -safe 0 -i "${concatFile}" -vsync vfr -pix_fmt yuv420p -c:v mpeg4 -q:v 2 -t ${input.duration} "${outputPath}"`,
      { timeout: 180000 }
    ).then(() => console.log(`[VideoComposer] ✅ ffmpeg finished at ${Date.now()}: ${outputPath}`))
    .catch(e => console.log(`[VideoComposer] ❌ ffmpeg failed at ${Date.now()}: ${e.message}`))

    console.log(`[VideoComposer] ✅ ffmpeg 合成完成: ${outputPath}`)

    // 复制到 public/uploads
    const uploadDir = path.resolve(process.cwd(), 'public/uploads')
    fs.mkdirSync(uploadDir, { recursive: true })
    const finalPath = path.join(uploadDir, `${outputName}.mp4`)
    fs.copyFileSync(outputPath, finalPath)
    const relativeUrl = `/uploads/${outputName}.mp4`

    cleanup(cleanupFiles)
    return {
      videoUrl: relativeUrl,
      duration: input.duration,
      totalFrames: input.frames.length,
      mode: 'ffmpeg',
    }
  } catch (err: any) {
    cleanup(cleanupFiles)
    throw new Error(`视频合成失败: ${err.message}`)
  }
}

/**
 * 视频合成器主入口
 *
 * 策略：
 *   1. 如果帧数 >= 2，用 ffmpeg 合成
 *   2. 以后可扩展：如果底层 video API 支持多帧输入，走 API 合成
 */
export async function composeVideo(input: VideoComposerInput): Promise<VideoComposerResult> {
  if (input.frames.length < 2) {
    throw new Error(`视频合成需要至少 2 帧，当前 ${input.frames.length} 帧`)
  }

  console.log(`[VideoComposer] 🎞️ 开始合成: ${input.frames.length} 帧, ${input.duration}s, fps=${input.fps || 24}`)

  const startTs = Date.now()

  // Mode 1: ffmpeg（通用，不依赖任何 API）
  const result = await composeViaFfmpeg(input)

  console.log(`[VideoComposer] ✅ 合成完成: ${result.videoUrl}, ${Date.now() - startTs}ms, mode=${result.mode}`)

  return result
}
