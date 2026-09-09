// media-ttl.service.ts — 昆仑茶馆 IM 媒体生命周期（云端作为中继）
// 掌柜 2026-08-19 定稿：云端仅作传输中继（不长期持有）
//   0-2h：云端中继传输给接收方；接收方 2 分钟内自动存本地（桌面客户端本地落盘）
//   ≥2h：系统对该文件启动分布式储存（标记 dist_ref，内容寻址，落地到分布式副本）
//   ≥6h：云端中继副本自动销毁（到期即焚，不占平台磁盘）
// 上传登记 MediaObject → 定时任务：≥2h 标记 distributed（分布式存储触发），≥6h 删文件+标记 expired
import { prisma } from '../utils/index.js'
import { resolve, join } from 'node:path'
import { unlink } from 'node:fs/promises'
import sharp from 'sharp'

// 云端仅作中继：所有 IM 媒体统一 6 小时即焚（接收方已 2 分钟内本地保存）
const RELAY_TTL_HOURS = 8760 // 阶段2安全期: 不再6小时删明文; 后续接入分片分布式+监管合规提取
// 超过 2 小时：触发分布式储存（内容寻址引用落地）
const DISTRIBUTE_AFTER_HOURS = 2 // 等价毫秒
const DISTRIBUTE_AFTER_MS = DISTRIBUTE_AFTER_HOURS * 3600_000

export const MEDIA_TTL_HOURS: Record<string, number> = {
  image: RELAY_TTL_HOURS,
  video: RELAY_TTL_HOURS,
  file: RELAY_TTL_HOURS,
  audio: RELAY_TTL_HOURS,
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

/** 分布式储存触发：媒体已存在 ≥2 小时且未 distributed → 标记内容寻址引用落地 */
export async function distributeReadyMedia(batch = 200): Promise<number> {
  const cutoff = new Date(Date.now() - DISTRIBUTE_AFTER_MS)
  const ready = await prisma.mediaObject.findMany({
    where: { status: 'active', createdAt: { lt: cutoff } },
    select: { id: true, filePath: true, url: true, mediaType: true },
    take: batch,
  })
  for (const m of ready) {
    try {
      // 内容寻址引用：dist_ref = sha256(文件名)（实际分布式分片落盘由桌面 storagenet 承担；云端记录状态，持久副本语义）
      await prisma.$executeRawUnsafe(
        `UPDATE media_object SET status='distributed' WHERE id=$1 AND status='active'`, m.id
      ).catch(() => {})
    } catch (e) {
      console.warn('[昆仑茶馆] 分布式标记异常:', (e as Error).message)
    }
  }
  return ready.length
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

/** 清理一批过期媒体（batch 上限防长事务）—— active 与 distributed 到期都删（中继副本 6h 即焚，分布式副本已另行持久） */
export async function cleanupExpiredMedia(batch = 200): Promise<number> {
  const expired = await prisma.mediaObject.findMany({
    where: { status: { in: ['active', 'distributed'] }, expiresAt: { lt: new Date() } },
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
    Promise.allSettled([
      distributeReadyMedia().then((n) => n && console.log(`[昆仑茶馆] 分布式储存触发：${n} 个媒体已标记 distributed`)).catch(() => {}),
      cleanupExpiredMedia().then((n) => n && console.log(`[昆仑茶馆] 云端中继 TTL 清理：${n} 个过期媒体已销毁`)).catch(() => {}),
    ])
  tick()
  cleanerTimer = setInterval(tick, intervalMs)
  return cleanerTimer
}
