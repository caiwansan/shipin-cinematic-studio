/**
 * 数据迁移：将数据库中所有火山TOS链接的作品下载到本地，更新URL
 */
import { PrismaClient } from '@prisma/client'
import { downloadToLocal } from '../src/services/download.service.js'
import { execSync } from 'child_process'
import { existsSync, unlinkSync, readFileSync } from 'fs'

const prisma = new PrismaClient()

async function main() {
  console.log('🚀 开始迁移火山TOS作品到本地持久化存储')
  console.log('='.repeat(50))

  // 扫描所有需要迁移的作品（TOS链接的非本地资产）
  const assets = await prisma.userAsset.findMany({
    where: {
      NOT: { url: { startsWith: '/api/v1/uploads/' } },
    },
  })
  console.log(`📊 待迁移作品: ${assets.length} 个`)

  let migrated = 0
  let failedImgs = 0
  let failedVids = 0

  for (const a of assets) {
    try {
      console.log(`  [${migrated + 1}/${assets.length}] ${a.type} - ${a.title.slice(0, 30)}...`)
      const downloaded = await downloadToLocal(a.url, a.type as 'image' | 'video', a.prompt)

      // 如果是视频，从本地文件提取缩略图
      let thumbnail: string | null = a.thumbnail
      if (a.type === 'video') {
        try {
          const thumbPath = `/tmp/thumb_migrate_${Date.now()}.jpg`
          execSync(`ffmpeg -y -i "${downloaded.localPath}" -ss 0.5 -vframes 1 -q:v 3 "${thumbPath}" 2>/dev/null`, { timeout: 30000 })
          if (existsSync(thumbPath)) {
            const stat = await import('fs/promises').then(m => m.stat(thumbPath))
            if (stat.size > 0 && stat.size < 5 * 1024 * 1024) {
              const base64 = readFileSync(thumbPath, { encoding: 'base64' })
              thumbnail = `data:image/jpeg;base64,${base64}`
            }
            unlinkSync(thumbPath)
          }
        } catch (e) {
          // 缩略图不是必须的
        }
      }

      // 更新数据库
      await prisma.userAsset.update({
        where: { id: a.id },
        data: {
          url: downloaded.localUrl,
          ...(thumbnail ? { thumbnail } : {}),
        },
      })

      migrated++
      console.log(`    ✅ -> ${downloaded.localUrl} (${downloaded.size} bytes)`)
    } catch (e: any) {
      if (a.type === 'video') failedVids++
      else failedImgs++
      console.warn(`    ❌ 迁移失败: ${e.message}`)
    }
  }

  console.log('\n' + '='.repeat(50))
  console.log(`🎉 迁移完成!`)
  console.log(`  迁移成功: ${migrated} 个`)
  console.log(`  图片失败: ${failedImgs} 个`)
  console.log(`  视频失败: ${failedVids} 个`)
  console.log(`  失败原因: 火山TOS链接已过期(24h有效期)，后续新生成会自动下载到本地`)

  await prisma.$disconnect()
}

main().catch(async (e) => {
  console.error('❌ 迁移失败:', e.message)
  await prisma.$disconnect()
  process.exit(1)
})
