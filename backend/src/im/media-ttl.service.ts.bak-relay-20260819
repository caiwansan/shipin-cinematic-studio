// media-ttl.service.ts — 昆仑茶馆 M4 媒体生命周期（IM-CHA-M10）
// 掌柜 2026-08-06 拍板 TTL：视频 72h / 图片 168h（7天） / 文档+语音 7 天
// 上传登记 MediaObject → 定时清理任务扫描 expires_at → 删文件 + 标记 expired
// 存储哲学：媒体不长期占用平台磁盘，到期即焚；文本合规留存（R4）
import { prisma } from '../utils/index.js'
import { resolve, join } from 'node:path'
import { unlink } from 'node:fs/promises'
import sharp from 'sharp'

export const MEDIA_TTL_HOURS: Record<string, number> = {
  image: 168, // R5：图片 168 小时（7 天）
  video: 72, //  R5：视频 72 小时
  file: 168, //  R5：文档 7 天
  audio: 168, // 语音按文档类 7 天（掌柜未单列，归入文件）
}

export const MEDIA_UPLOAD_DIR = resolve(process.cwd(), 'public/uploads/im')

/** 按 MIME/扩展名归类媒体类型（未知 → file） */
export function classifyMedia(mime: string, ext: string): { mediaType: string; ttlHours: number } {
  const m = (mime || '').toLowerCase()
  const e = (ext || '').toLowerCase()
  let mediaType = 'file'
  if (m.startsWith('image/')) mediaType = 'image'
  else if (m.startsWith('video/')) mediaType = 'video'
  else if (m.startsWith('audio/')) mediaType = 'audio'
  else if (['.mp4', '.webm', '.mov', '.mkv', '.avi'].includes(e)) mediaType = 'video'
  else if (['.jpg', '.jpeg', '.png', '.gif', '.webp', '.bmp'].includes(e)) mediaType = 'image'
  else if (['.mp3', '.wav', '.ogg', '.m4a', '.aac', '.flac'].includes(e)) mediaType = 'audio'
  return { mediaType, ttlHours: MEDIA_TTL_HOURS[mediaType] || 168 }
}

/** 图片生成缩略图（宽 ≤ 400px，jpeg），返回 thumb 文件名；失败返回空（非致命） */
export async function generateThumb(filePath: string): Promise<string> {
  try {
    const thumbName = `thumb_${Date.now()}_${Math.random().toString(36).slice(2, 8)}.jpg`
    const thumbPath = join(MEDIA_UPLOAD_DIR, thumbName)
    await sharp(filePath, { limitInputPixels: 40_000_000 })
      .rotate()
      .resize({ width: 400, withoutEnlargement: true })
      .jpeg({ quality: 80 })
      .toFile(thumbPath)
    return `/uploads/im/${thumbName}`
  } catch (e) {
    console.warn('[昆仑茶馆] 缩略图生成失败（非致命）:', (e as Error).message)
    return ''
  }
}

/** 上传登记：写 MediaObject + 返回 TTL 信息（供消息 content 携带 ttlHours/expiresAt） */
export async function registerMediaObject(opts: {
  url: string
  filePath: string
  mimeType?: string
  mediaType: string
  size: number
  thumbUrl?: string
}) {
  const ttlHours = MEDIA_TTL_HOURS[opts.mediaType] || 168
  const expiresAt = new Date(Date.now() + ttlHours * 3600_000)
  try {
    await prisma.mediaObject.create({
      data: {
        url: opts.url,
        filePath: opts.filePath,
        mimeType: opts.mimeType || '',
        mediaType: opts.mediaType,
        size: BigInt(opts.size || 0),
        thumbUrl: opts.thumbUrl || '',
        ttlHours,
        expiresAt,
        status: 'active',
      },
    })
  } catch (e) {
    console.warn('[昆仑茶馆] MediaObject 登记失败（非致命）:', (e as Error).message)
  }
  return { ttlHours, expiresAt: expiresAt.toISOString() }
}

/** 清理一个已过期媒体（删主文件 + 缩略图，标记 expired；失败仅标记不炸） */
async function expireMedia(m: { id: string; filePath: string; thumbUrl: string }) {
  const files = [m.filePath]
  if (m.thumbUrl) {
    const thumbFile = m.thumbUrl.startsWith('/uploads/im/') ? join(MEDIA_UPLOAD_DIR, m.thumbUrl.replace('/uploads/im/', '')) : ''
    if (thumbFile) files.push(thumbFile)
  }
  for (const f of files) {
    try {
      await unlink(f)
    } catch (e) {
      /* 文件可能已被手动删除，忽略 */
    }
  }
  await prisma.mediaObject.update({ where: { id: m.id }, data: { status: 'expired' } })
}

/** 清理一批过期媒体（batch 上限防长事务） */
export async function cleanupExpiredMedia(batch = 200): Promise<number> {
  const expired = await prisma.mediaObject.findMany({
    where: { status: 'active', expiresAt: { lt: new Date() } },
    select: { id: true, filePath: true, thumbUrl: true },
    take: batch,
  })
  for (const m of expired) {
    try {
      await expireMedia(m)
    } catch (e) {
      console.warn('[昆仑茶馆] 媒体过期清理异常:', (e as Error).message)
    }
  }
  return expired.length
}

let cleanerTimer: ReturnType<typeof setInterval> | null = null

/** 启动 TTL 清理定时任务（每 10 分钟；幂等，重复调用不重复起） */
export function startMediaTtlCleaner(intervalMs = 10 * 60_000) {
  if (cleanerTimer) return cleanerTimer
  const tick = () =>
    cleanupExpiredMedia()
      .then((n) => n && console.log(`[昆仑茶馆] 媒体 TTL 清理：${n} 个过期媒体已删除`))
      .catch((e) => console.warn('[昆仑茶馆] 媒体 TTL 清理异常:', (e as Error).message))
  tick()
  cleanerTimer = setInterval(tick, intervalMs)
  return cleanerTimer
}
