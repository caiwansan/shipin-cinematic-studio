/**
 * 视频合成拼接服务
 *
 * 将项目中的多段 AI 生成视频（AiVideoSegment.videoUrl）按 sortOrder 拼接为完整 MP4
 *
 * 支持能力（按阶段）：
 *   P0: 纯画面拼接（concat demuxer，不重新编码）
 *   P1: TTS 配音叠加
 *   P2: 字幕烧录
 *   P3: 转场效果
 */

import { prisma } from '../utils/index.js'
import { cosService } from './cos-service.js'
import { execSync } from 'child_process'
import { mkdir, writeFile, rm, readdir } from 'fs/promises'
import { existsSync, createWriteStream } from 'fs'
import { resolve } from 'path'
import { randomUUID } from 'crypto'
import { get as httpsGet } from 'https'
import { request as httpRequest } from 'http'

const MERGE_TMP_BASE = '/tmp/video-merge'

/**
 * 下载远程文件到本地
 */
function downloadFile(url: string, dest: string): Promise<void> {
  return new Promise((resolvePromise, reject) => {
    const protocol = url.startsWith('https') ? httpsGet : httpRequest
    const req = protocol(url, (res: any) => {
      // 处理重定向
      if (res.statusCode && res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        downloadFile(res.headers.location, dest).then(resolvePromise).catch(reject)
        return
      }
      if (!res.statusCode || res.statusCode >= 400) {
        reject(new Error(`下载失败: HTTP ${res.statusCode} (${url})`))
        return
      }
      const file = createWriteStream(dest)
      res.pipe(file)
      file.on('finish', () => file.close())
      file.on('error', reject)
      res.on('error', reject)
    })
    req.on('error', reject)
    req.end()
  })
}

/**
 * 执行 shell 命令
 */
function execCmd(cmd: string, opts?: { timeout?: number }): Promise<string> {
  return new Promise((resolvePromise, reject) => {
    try {
      const output = execSync(cmd, {
        timeout: opts?.timeout || 300000,
        stdio: ['pipe', 'pipe', 'pipe'],
        maxBuffer: 100 * 1024 * 1024,
      })
      resolvePromise(output.toString())
    } catch (e: any) {
      reject(new Error(e.stderr?.toString() || e.message))
    }
  })
}

/**
 * 获取视频时长（秒）
 * 使用 ffprobe 读取
 */
function getVideoDuration(filePath: string): number {
  try {
    const output = execSync(
      `ffprobe -v error -show_entries format=duration -of default=noprint_wrappers=1:nokey=1 "${filePath}"`,
      { timeout: 10000, stdio: ['pipe', 'pipe', 'pipe'] }
    ).toString().trim()
    return parseFloat(output) || 0
  } catch {
    return 0
  }
}

/**
 * 获取视频分辨率
 */
function getVideoResolution(filePath: string): { width: number; height: number } | null {
  try {
    const output = execSync(
      `ffprobe -v error -select_streams v:0 -show_entries stream=width,height -of csv=s=x:p=0 "${filePath}"`,
      { timeout: 10000, stdio: ['pipe', 'pipe', 'pipe'] }
    ).toString().trim()
    const parts = output.split('x')
    if (parts.length === 2) {
      return { width: parseInt(parts[0]), height: parseInt(parts[1]) }
    }
    return null
  } catch {
    return null
  }
}

/**
 * 获取文件大小（MB）
 */
function getFileSizeMb(filePath: string): number {
  try {
    const { stat } = require('fs/promises') as any
    // 使用同步 stat
    const fs = require('fs')
    const st = fs.statSync(filePath)
    return Math.round(st.size / (1024 * 1024) * 100) / 100
  } catch {
    return 0
  }
}

export interface MergeOptions {
  includeTTS?: boolean
  includeSubtitles?: boolean
  transitionType?: 'none' | 'crossfade'
}

/**
 * 执行视频合成拼接
 *
 * @param projectId  项目 ID
 * @param options    合成选项
 * @returns 合成结果
 */
export async function mergeVideos(
  projectId: string,
  options: MergeOptions = {}
): Promise<{ outputUrl: string; duration: number; segments: number; fileSizeMb: number }> {
  const traceId = randomUUID().slice(0, 8)
  const tmpDir = resolve(MERGE_TMP_BASE, traceId)

  try {
    // 1. 查询所有已生成的视频段（按 sortOrder 排序）
    const segments = await prisma.aiVideoSegment.findMany({
      where: {
        projectId,
        videoUrl: { not: null },
      },
      orderBy: { sortOrder: 'asc' },
    })

    if (segments.length === 0) {
      throw new Error('项目没有已生成的视频段')
    }

    // 筛选有 videoUrl 的段
    const validSegments = segments.filter(s => s.videoUrl)
    if (validSegments.length === 0) {
      throw new Error('所有视频段均缺少 videoUrl')
    }

    // 2. 创建临时目录
    await mkdir(tmpDir, { recursive: true })

    // 3. 下载所有视频到本地
    const localFiles: string[] = []
    for (let i = 0; i < validSegments.length; i++) {
      const seg = validSegments[i]
      const ext = seg.videoUrl!.match(/\.(\w+)(\?|$)/)?.[1] || 'mp4'
      const localPath = resolve(tmpDir, `seg_${String(i).padStart(3, '0')}.${ext}`)
      console.log(`[VideoMerge] 下载 [${i + 1}/${validSegments.length}]: ${seg.videoUrl}`)
      await downloadFile(seg.videoUrl!, localPath)
      localFiles.push(localPath)
    }

    // 4. 检查各段分辨率是否一致（不一致时缩放对齐）
    const resolutions = localFiles.map(f => getVideoResolution(f)).filter(Boolean)
    const allSameRes = resolutions.every(
      r => r?.width === resolutions[0]?.width && r?.height === resolutions[0]?.height
    )
    if (!allSameRes) {
      console.log(`[VideoMerge] 分辨率不一致，自动对齐到 ${resolutions[0]?.width}x${resolutions[0]?.height}`)
      // 对齐分辨率后重新处理文件
      for (let i = 0; i < localFiles.length; i++) {
        const r = resolutions[i]
        if (r && (r.width !== resolutions[0]?.width || r.height !== resolutions[0]?.height)) {
          const alignedPath = localFiles[i].replace('.mp4', '_aligned.mp4')
          const targetRes = `${resolutions[0]?.width}:${resolutions[0]?.height}`
          await execCmd(
            `ffmpeg -i "${localFiles[i]}" -vf "scale=${targetRes}:force_original_aspect_ratio=decrease,pad=${targetRes}:(ow-iw)/2:(oh-ih)/2" -c:v libx264 -preset fast -crf 23 -c:a copy "${alignedPath}" -y`,
            { timeout: 120000 }
          )
          localFiles[i] = alignedPath
        }
      }
    }

    // 5. 生成 concat 文件列表
    const listPath = resolve(tmpDir, 'list.txt')
    // 使用相对路径或确保路径不包含特殊字符
    const fileListContent = localFiles.map(f => `file '${f.replace(/'/g, "'\\''")}'`).join('\n')
    await writeFile(listPath, fileListContent)

    // 6. 执行 FFmpeg concat 拼接
    const outputFilename = `merged_${traceId}.mp4`
    const outputPath = resolve(tmpDir, outputFilename)

    console.log(`[VideoMerge] 拼接 ${localFiles.length} 段视频...`)

    if (options.transitionType === 'crossfade' && localFiles.length > 1) {
      // 方案B: 带 crossfade 渐变效果的拼接（需要重新编码）
      await buildCrossfadeCommand(localFiles, outputPath)
    } else {
      // 方案A: 无损拼接（不重新编码）
      try {
        await execCmd(
          `ffmpeg -f concat -safe 0 -i "${listPath}" -c copy -movflags +faststart "${outputPath}" -y`,
          { timeout: 300000 }
        )
      } catch (e: any) {
        // 如果 concat demuxer 失败（编码参数不一致），降级为重新编码
        console.log(`[VideoMerge] concat demuxer 失败，降级为重新编码: ${e.message}`)
        await execCmd(
          `ffmpeg -f concat -safe 0 -i "${listPath}" -c:v libx264 -preset fast -crf 23 -c:a aac -b:a 192k -movflags +faststart "${outputPath}" -y`,
          { timeout: 300000 }
        )
      }
    }

    // 统计信息
    const totalDuration = validSegments.reduce((sum, s) => sum + (s.duration || 0), 0)
    let finalOutputPath = outputPath

    // ===== P1: TTS 配音叠加 =====
    if (options.includeTTS) {
      console.log(`[VideoMerge] 叠加 TTS 配音...`)
      try {
        const ttsAudioPath = await buildTTSAudio(projectId, tmpDir)
        if (ttsAudioPath) {
          const mixedPath = outputPath.replace('.mp4', '_tts.mp4')
          await overlayAudio(finalOutputPath, ttsAudioPath, mixedPath)
          finalOutputPath = mixedPath
          console.log(`[VideoMerge] TTS 配音叠加完成`)
        }
      } catch (e: any) {
        console.warn(`[VideoMerge] TTS 叠加失败（跳过）: ${e.message}`)
      }
    }

    // ===== P2: 字幕烧录 =====
    if (options.includeSubtitles) {
      console.log(`[VideoMerge] 烧录字幕...`)
      try {
        const srtPath = await buildSubtitles(projectId, validSegments, tmpDir)
        if (srtPath) {
          const subbedPath = finalOutputPath.replace('.mp4', '_sub.mp4')
          await burnSubtitles(finalOutputPath, srtPath, subbedPath)
          finalOutputPath = subbedPath
          console.log(`[VideoMerge] 字幕烧录完成`)
        }
      } catch (e: any) {
        console.warn(`[VideoMerge] 字幕烧录失败（跳过）: ${e.message}`)
      }
    }

    // 如果经过 TTS/字幕处理，重新计算文件大小
    const computedFileSize = getFileSizeMb(finalOutputPath)

    // 7. 上传到 COS
    console.log(`[VideoMerge] 上传 ${finalOutputPath} 到 COS...`)
    const cosResult = await cosService.uploadFile(finalOutputPath, 'video', projectId)

    // 8. 持久化结果到数据库
    await prisma.project.update({
      where: { id: projectId },
      data: {
        mergedVideoUrl: cosResult.cosUrl,
        mergeStatus: 'done',
      },
    })

    // 也可记录到 ExportTask
    await prisma.exportTask.create({
      data: {
        projectId,
        userId: '', // 后续从前端传递
        status: 'completed',
        exportType: 'video_merge',
        outputUrl: cosResult.cosUrl,
        progress: 100,
        completedAt: new Date(),
      },
    })

    console.log(`[VideoMerge] ✅ 合成完成: ${cosResult.cosUrl} (${computedFileSize}MB, ${totalDuration}s)`)

    return {
      outputUrl: cosResult.cosUrl,
      duration: totalDuration,
      segments: validSegments.length,
      fileSizeMb: computedFileSize,
    }
  } catch (e: any) {
    // 更新失败状态
    await prisma.project.update({
      where: { id: projectId },
      data: { mergeStatus: 'failed' },
    }).catch(() => {})

    throw e
  } finally {
    // 9. 清理临时文件（保留以便排查）
    rm(tmpDir, { recursive: true, force: true }).catch(() => {})
  }
}

/**
 * 带 crossfade 效果的拼接命令
 * 使用 filter_complex 做交叉溶解
 */
async function buildCrossfadeCommand(localFiles: string[], outputPath: string): Promise<void> {
  const fadeDuration = 0.5 // 渐变时长（秒）

  // 构建 filter_complex
  const filters: string[] = []
  const inputs: string[] = []
  const streams: string[] = []

  localFiles.forEach((_, i) => {
    inputs.push(`-i "${localFiles[i]}"`)
    if (i === 0) {
      filters.push(`[0:v]fade=t=in:st=0:d=${fadeDuration}[v${i}]`)
      streams.push(`[v${i}]`)
    } else {
      const prevEnd = `prev_end_${i}`
      filters.push(
        `[${i}:v]fade=t=in:st=0:d=${fadeDuration},fade=t=out:st=${`${fadeDuration}`}:d=${fadeDuration}[v${i}]`
      )
      streams.push(`[v${i}]`)
    }
  })

  const concatInput = streams.map((s, i) => `${s}[${i}:a]`).join('')

  const cmd = [
    'ffmpeg',
    ...inputs,
    '-filter_complex',
    `"${filters.join(';')};${concatInput}concat=n=${localFiles.length}:v=1:a=1[v][a]"`,
    '-map "[v]"',
    '-map "[a]"',
    '-c:v libx264',
    '-preset fast',
    '-crf 23',
    '-c:a aac',
    '-b:a 192k',
    '-movflags +faststart',
    `"${outputPath}"`,
    '-y',
  ].join(' ')

  await execCmd(cmd, { timeout: 600000 })
}

/**
 * 检查项目是否符合合并条件
 */
export async function checkMergeEligibility(projectId: string): Promise<{
  eligible: boolean
  totalSegments: number
  readySegments: number
  missingSegments: string[]
  hasTTS: boolean
  message: string
}> {
  const segments = await prisma.aiVideoSegment.findMany({
    where: { projectId },
    orderBy: { sortOrder: 'asc' },
  })

  const ready = segments.filter(s => s.videoUrl)
  const missing = segments.filter(s => !s.videoUrl)

  const ttsCount = await prisma.tTSRecord.count({
    where: { projectId },
  })

  return {
    eligible: ready.length > 0,
    totalSegments: segments.length,
    readySegments: ready.length,
    missingSegments: missing.map(s => s.segmentId),
    hasTTS: ttsCount > 0,
    message: ready.length === 0
      ? '暂无已生成的视频'
      : missing.length > 0
        ? `尚有 ${missing.length} 段未生成视频（${missing.map(s => s.segmentId).join(', ')}）`
        : `所有 ${ready.length} 段视频已就绪`,
  }
}

/**
 * 获取项目的合成状态
 */
export async function getProjectMergeStatus(projectId: string) {
  const project = await prisma.project.findUnique({
    where: { id: projectId },
    select: {
      mergedVideoUrl: true,
      mergeStatus: true,
    },
  })
  return {
    mergeStatus: project?.mergeStatus || null,
    outputUrl: project?.mergedVideoUrl || null,
  }
}

// ─────────────── P1: TTS 配音合成 ───────────────

/**
 * 构建 TTS 配音音频
 * 
 * 查询项目的所有 TTS 录音，下载后拼接为单一音频文件
 */
async function buildTTSAudio(projectId: string, workDir: string): Promise<string | null> {
  const ttsRecords = await prisma.tTSRecord.findMany({
    where: { projectId },
    orderBy: [
      { characterName: 'asc' },
      { sequenceIndex: 'asc' },
    ],
  })

  if (ttsRecords.length === 0) {
    return null
  }

  // 下载所有 TTS 音频到本地
  const ttsDir = resolve(workDir, 'tts')
  await mkdir(ttsDir, { recursive: true })

  const localAudios: string[] = []
  for (let i = 0; i < ttsRecords.length; i++) {
    const tts = ttsRecords[i]
    if (!tts.audioUrl || tts.audioUrl.length < 10) continue

    const ext = tts.audioUrl.match(/\.(\w+)(\?|$)/)?.[1]?.toLowerCase() || 'wav'
    // 标准化扩展名
    const safeExt = ['mp3', 'wav', 'ogg', 'aac', 'm4a', 'flac'].includes(ext) ? ext : 'wav'
    const localPath = resolve(ttsDir, `tts_${String(i).padStart(3, '0')}.${safeExt}`)

    try {
      console.log(`[VideoMerge/TTS] 下载 [${i + 1}/${ttsRecords.length}]: ${tts.characterName} - ${tts.text?.slice(0, 30)}`)
      await downloadFile(tts.audioUrl, localPath)
      localAudios.push(localPath)
    } catch (e) {
      console.warn(`[VideoMerge/TTS] 下载失败（跳过）:`, (e as Error).message)
    }
  }

  if (localAudios.length === 0) return null

  // 如果只有一段音频，直接返回
  if (localAudios.length === 1) {
    return localAudios[0]
  }

  // 多段音频拼接为一个
  const outputPath = resolve(workDir, 'tts_merged.wav')
  const listPath = resolve(workDir, 'tts_list.txt')
  const fileList = localAudios.map(f => `file '${f.replace(/'/g, "'\\''")}'`).join('\n')
  await writeFile(listPath, fileList)

  try {
    await execCmd(
      `ffmpeg -f concat -safe 0 -i "${listPath}" -c copy "${outputPath}" -y`,
      { timeout: 120000 }
    )
    return outputPath
  } catch {
    // concat demuxer 对音频格式不一致兼容性差，降级为重新编码拼接
    await execCmd(
      `ffmpeg -f concat -safe 0 -i "${listPath}" -c:a pcm_s16le "${outputPath}" -y`,
      { timeout: 120000 }
    )
    return outputPath
  }
}

/**
 * 将配音音频叠加到视频上
 * 
 * 用 shortest 参数确保音视频长度对齐
 */
async function overlayAudio(videoPath: string, audioPath: string, outputPath: string): Promise<void> {
  try {
    // 方案A：直接替换视频音轨（如果原视频无音轨或音轨不重要）
    await execCmd(
      `ffmpeg -i "${videoPath}" -i "${audioPath}" -c:v copy -c:a aac -b:a 192k -map 0:v:0 -map 1:a:0 -shortest -movflags +faststart "${outputPath}" -y`,
      { timeout: 300000 }
    )
  } catch {
    // 方案B：混流（保留原音轨但降低音量，叠加配音）
    await execCmd(
      `ffmpeg -i "${videoPath}" -i "${audioPath}" -filter_complex "[1:a]adelay=0|0[a1];[0:a][a1]amix=inputs=2:duration=first:dropout_transition=2[a]" -c:v copy -map 0:v:0 -map "[a]" -c:a aac -b:a 192k -shortest -movflags +faststart "${outputPath}" -y`,
      { timeout: 300000 }
    )
  }
}

// ─────────────── P2: 字幕烧录 ───────────────

/**
 * 构建 SRT 字幕文件
 * 
 * 从 AiSegmentEdit 表中读取每段的 narrative/dialogue，
 * 按视频段时长分配时间轴
 */
async function buildSubtitles(
  projectId: string,
  segments: Array<{ segmentId: string; duration: number | null }>,
  workDir: string
): Promise<string | null> {
  // 获取每段的编辑文本
  const edits: Array<{ segmentId: string; narrative: string | null; dialogue: string | null }> = await (prisma as any).aISegmentEdit.findMany({
    where: { projectId },
  })
  const editMap = new Map(edits.map(e => [e.segmentId, e]))

  let currentTime = 0 // 当前时间偏移（秒）
  const srtLines: string[] = []
  let subtitleIndex = 0

  for (const seg of segments) {
    const edit = editMap.get(seg.segmentId)
    const segDuration = seg.duration || 5 // 默认 5 秒
    const narrative = edit?.narrative?.trim()
    const dialogue = edit?.dialogue?.trim()

    // 优先用对白，其次叙事描述
    let text = dialogue || narrative || ''
    if (!text) {
      currentTime += segDuration
      continue
    }

    // 将文本拆分为多行（每行不超过 40 字）
    const lines = textToLines(text, 40)
    if (lines.length === 0) {
      currentTime += segDuration
      continue
    }

    // 分配字幕显示时间：整个段时长 / 行数
    const lineDuration = segDuration / Math.max(lines.length, 1)
    for (const line of lines) {
      subtitleIndex++
      const start = currentTime
      const end = currentTime + lineDuration
      srtLines.push(
        `${subtitleIndex}`,
        `${formatSrtTime(start)} --> ${formatSrtTime(end)}`,
        line,
        ''
      )
      currentTime += lineDuration
    }
  }

  if (srtLines.length === 0) return null

  const srtPath = resolve(workDir, 'subtitles.srt')
  await writeFile(srtPath, srtLines.join('\n'))
  return srtPath
}

/**
 * 将文本按最大长度拆行为多行
 * 在标点处断开，避免在中间切割
 */
function textToLines(text: string, maxLen: number): string[] {
  if (!text) return []
  if (text.length <= maxLen) return [text]

  const lines: string[] = []
  const chars = text.split('')

  while (chars.length > 0) {
    if (chars.length <= maxLen) {
      lines.push(chars.join(''))
      break
    }

    // 找到最近的标点或空格断开
    let cutPos = maxLen
    for (let i = maxLen; i > Math.floor(maxLen * 0.6); i--) {
      const c = chars[i]
      if (c === '，' || c === '。' || c === '！' || c === '？' || c === '、' ||
          c === ',' || c === '.' || c === '!' || c === '?' || c === ' ' || c === ';') {
        cutPos = i + 1
        break
      }
    }

    lines.push(chars.splice(0, cutPos).join(''))
  }

  return lines
}

/**
 * 格式化 SRT 时间（秒 → HH:MM:SS,mmm）
 */
function formatSrtTime(seconds: number): string {
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  const s = Math.floor(seconds % 60)
  const ms = Math.floor((seconds % 1) * 1000)
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')},${String(ms).padStart(3, '0')}`
}

/**
 * 烧录字幕到视频（硬字幕，使用 libass 或 srt）
 */
async function burnSubtitles(videoPath: string, srtPath: string, outputPath: string): Promise<void> {
  // 方案A：使用 libass（需要先将 srt 转为 ass）
  const assPath = srtPath.replace('.srt', '.ass')
  try {
    // 先将 srt 转为 ass（添加基础样式）
    await execCmd(
      `ffmpeg -i "${srtPath}" "${assPath}" -y`,
      { timeout: 30000 }
    )
    // 再用 ass 字幕烧录
    await execCmd(
      `ffmpeg -i "${videoPath}" -vf "ass=${assPath.replace(/'/g, "'\\''")}" -c:a copy -movflags +faststart "${outputPath}" -y`,
      { timeout: 300000 }
    )
  } catch {
    // 方案B：直接用 drawtext 滤镜（更兼容但效果简陋）
    console.log(`[VideoMerge/Sub] ass 字幕失败，降级为 drawtext`)
    await execCmd(
      `ffmpeg -i "${videoPath}" -vf "subtitles=${srtPath.replace(/'/g, "'\\''")}" -c:a copy -movflags +faststart "${outputPath}" -y`,
      { timeout: 300000 }
    )
  }
}
