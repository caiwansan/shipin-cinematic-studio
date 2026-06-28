// ============================================================
// jobs/asset-guard.ts
//
// R8 — Asset Guardian
// 职责：
//   1. 扫描 character_images 确认所有 URL 均为 COS 地址
//   2. 非 COS URL（volces 临时链接、本地路径）重新上传并替换
//   3. 检查 orphan 记录（project 已删除但图片残留）
//   4. 输出健康报告
//
// 运行方式：
//   npx tsx src/jobs/asset-guard.ts
//   或 cron 定时执行
// ============================================================

import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

const COS_PATTERNS = [
  /^https:\/\/[a-z0-9-]+\.cos\.[a-z-]+\.myqcloud\.com/,
]

function isCosUrl(url: string): boolean {
  if (!url || url.startsWith('PENDING_REGEN')) return false
  return COS_PATTERNS.some((p) => p.test(url))
}

function getDownloadAndUpload(url: string, userId: string, type: string, name: string): Promise<any> {
  return new Promise((resolve, reject) => {
    import('../services/cos-service.js').then(async ({ cosService }) => {
      try {
        let buf: Buffer

        // 本地路径修复：/uploads/... → 从文件系统读取
        if (url.startsWith('/uploads/')) {
          const fs = await import('fs')
          const path = await import('path')
          const localPath = path.resolve(process.cwd(), 'public', url.replace(/^\//, ''))
          if (fs.existsSync(localPath)) {
            buf = fs.readFileSync(localPath)
          } else {
            console.warn(`[AssetGuard] 本地文件不存在: ${localPath}`)
            resolve(null)
            return
          }
        } else {
          const response = await fetch(url)
          if (!response.ok) {
            console.warn(`[AssetGuard] 无法下载 ${url.substring(0, 40)}: ${response.status}`)
            resolve(null)
            return
          }
          buf = Buffer.from(await response.arrayBuffer())
        }

        const ext = url.split('.').pop() || 'jpg'
        const sanitizedName = name.replace(/[^a-zA-Z0-9_\u4e00-\u9fa5]/g, '_').substring(0, 20)
        const result = await cosService.uploadBuffer(buf, `${type}_${sanitizedName}_${Date.now()}.${ext}`, userId)
        resolve(result)
      } catch (e: any) {
        console.warn(`[AssetGuard] 上传失败 ${url.substring(0, 40)}: ${e.message}`)
        resolve(null)
      }
    })
  })
}

async function run() {
  console.log('='.repeat(60))
  console.log('[AssetGuard] 🛡️ 启动资产守护扫描')
  console.log('='.repeat(60))

  // ── 1. 扫描 character_images ──
  const chars = await prisma.characterImage.findMany({
    where: { NOT: { imageUrl: '' } },
  })
  console.log(`[AssetGuard] character_images 总数: ${chars.length}`)

  let orphanCount = 0
  let nonCosCount = 0
  let fixedCount = 0

  for (const c of chars) {
    // 检查 project 是否存在
    const project = await prisma.project.findUnique({ where: { id: c.projectId }, select: { id: true } })
    if (!project) {
      console.warn(`[AssetGuard] ❌ Orphan character_image: id=${c.id}, name=${c.characterName}, project已失效`)
      orphanCount++
      continue
    }

    // 检查 URL 是否为 COS
    if (!isCosUrl(c.imageUrl)) {
      nonCosCount++
      // 跳过已过期的 volces 链接（403 不可恢复）
      if (c.imageUrl.includes('volces.com') || c.imageUrl.includes('tos-')) {
        console.warn(`[AssetGuard] ⏳ 已过期的 volces 链接，跳过修复: ${c.imageUrl.substring(0, 50)}`)
        continue
      }
      const uid = c.projectId // projectId 可推导 userId
      const proj = await prisma.project.findUnique({ where: { id: c.projectId }, select: { userId: true } })
      const userId = proj?.userId || 'unknown'
      const result = await getDownloadAndUpload(c.imageUrl, userId, 'characters', c.characterName)
      if (result?.cosUrl) {
        console.log(`[AssetGuard] ✅ 修复非 COS URL: ${c.imageUrl.substring(0, 40)} → COS`)
        await prisma.characterImage.update({
          where: { id: c.id },
          data: { imageUrl: result.cosUrl },
        })
        fixedCount++
      } else {
        console.warn(`[AssetGuard] ⚠️ 修复失败: ${c.imageUrl.substring(0, 40)}`)
      }
    }
  }

  // ── 2. 扫描 scene_images ──
  const scenes = await prisma.sceneImage.findMany({
    where: { NOT: { imageUrl: '' } },
  })
  let sceneNonCos = 0
  let sceneFixed = 0
  for (const s of scenes) {
    const project = await prisma.project.findUnique({ where: { id: s.projectId }, select: { id: true } })
    if (!project) { orphanCount++; continue }
    if (!isCosUrl(s.imageUrl)) {
      sceneNonCos++
      if (s.imageUrl.includes('volces.com') || s.imageUrl.includes('tos-')) {
        console.warn(`[AssetGuard] ⏳ 已过期 volces 场景链接，跳过: ${s.imageUrl.substring(0, 50)}`)
        continue
      }
      const proj = await prisma.project.findUnique({ where: { id: s.projectId }, select: { userId: true } })
      const userId = proj?.userId || 'unknown'
      const result = await getDownloadAndUpload(s.imageUrl, userId, 'scenes', s.sceneName)
      if (result?.cosUrl) {
        await prisma.sceneImage.update({
          where: { id: s.id },
          data: { imageUrl: result.cosUrl },
        })
        sceneFixed++
      }
    }
  }

  // ── 3. 扫描 storyboard_images ──
  const sbs = await prisma.storyboardImage.findMany({
    where: { NOT: { imageUrl: '' } },
  })
  let sbNonCos = 0
  let sbFixed = 0
  for (const sb of sbs) {
    const project = await prisma.project.findUnique({ where: { id: sb.projectId }, select: { id: true } })
    if (!project) { orphanCount++; continue }
    if (!isCosUrl(sb.imageUrl)) {
      sbNonCos++
      if (sb.imageUrl.includes('volces.com') || sb.imageUrl.includes('tos-')) {
        console.warn(`[AssetGuard] ⏳ 已过期 volces 分镜链接，跳过: ${sb.imageUrl.substring(0, 50)}`)
        continue
      }
      const proj = await prisma.project.findUnique({ where: { id: sb.projectId }, select: { userId: true } })
      const userId = proj?.userId || 'unknown'
      const result = await getDownloadAndUpload(sb.imageUrl, userId, 'storyboard', sb.segmentId)
      if (result?.cosUrl) {
        await prisma.storyboardImage.update({
          where: { id: sb.id },
          data: { imageUrl: result.cosUrl },
        })
        sbFixed++
      }
    }
  }

  // ── 报告 ──
  console.log('='.repeat(60))
  console.log('[AssetGuard] 📊 扫描报告')
  console.log('='.repeat(60))
  console.log(`  Orphan 记录:          ${orphanCount}`)
  console.log(`  character_images 非COS: ${nonCosCount} (修复 ${fixedCount})`)
  console.log(`  scene_images 非COS:    ${sceneNonCos} (修复 ${sceneFixed})`)
  console.log(`  storyboard_images 非COS: ${sbNonCos} (修复 ${sbFixed})`)
  console.log('='.repeat(60))
  console.log('[AssetGuard] ✅ 扫描完成')
}

run()
  .catch((e) => console.error('[AssetGuard] 执行失败:', e))
  .finally(() => prisma.$disconnect())
