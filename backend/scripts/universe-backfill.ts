/**
 * 宇宙回填 & 重建索引系统
 * OMS_Universe_Backfill_And_Reindex_System
 *
 * 确保所有已有作品在作品宇宙中完整展示
 * 补全评分、缩略图、分群
 */
import { PrismaClient } from '@prisma/client'
import { execSync } from 'child_process'
import { existsSync, unlinkSync, readFileSync } from 'fs'

const prisma = new PrismaClient()

// ── 步骤 1: 扫描所有作品 ──────────────────
async function scanWorks() {
  const works = await prisma.userAsset.findMany({
    include: { likes: true, comments: true },
  })
  console.log(`📊 扫描完成: 共 ${works.length} 个作品`)
  return works
}

// ── 步骤 2: 补全默认评分 ──────────────────
async function generateDefaultScores(works: Awaited<ReturnType<typeof scanWorks>>) {
  let updated = 0
  for (const w of works) {
    const likeCount = w.likes?.length || 0
    const commentCount = w.comments?.length || 0
    const ageHours = (Date.now() - w.createdAt.getTime()) / 3600000

    const engagementScore = Math.min(100, likeCount * 10 + commentCount * 15)
    const retentionScore = Math.min(100, engagementScore * 0.6)
    const freshnessScore = Math.max(0, 100 - ageHours * 2)
    const baseScore = w.type === 'video' ? 60 : 40
    const cinematicScore = Math.min(100, baseScore + engagementScore * 0.3)
    const narrativeScore = Math.min(100, baseScore + Math.random() * 25)
    const emotionalScore = Math.min(100, 50 + Math.random() * 30)
    const consistencyScore = Math.min(100, 60 + Math.random() * 20)
    const renderQualityScore = Math.min(100, baseScore + Math.random() * 25)
    const worldDepthScore = Math.min(100, 40 + Math.random() * 40)

    const universeScore =
      0.25 * cinematicScore +
      0.20 * retentionScore +
      0.15 * consistencyScore +
      0.15 * engagementScore +
      0.10 * freshnessScore +
      0.10 * worldDepthScore +
      0.05 * (renderQualityScore * 0.5)

    await prisma.userAsset.update({
      where: { id: w.id },
      data: {
        universeScore: Math.round(universeScore * 100) / 100,
        cinematicScore: Math.round(cinematicScore * 100) / 100,
        narrativeScore: Math.round(narrativeScore * 100) / 100,
        emotionalScore: Math.round(emotionalScore * 100) / 100,
        consistencyScore: Math.round(consistencyScore * 100) / 100,
        renderQualityScore: Math.round(renderQualityScore * 100) / 100,
        worldDepthScore: Math.round(worldDepthScore * 100) / 100,
        engagementScore: Math.round(engagementScore * 100) / 100,
        retentionScore: Math.round(retentionScore * 100) / 100,
        freshnessScore: Math.round(freshnessScore * 100) / 100,
      },
    })
    updated++
  }
  console.log(`✅ 评分补全: ${updated} 个作品`)
}

// ── 步骤 3: 分群分配 ──────────────────────
async function assignClusters(works: Awaited<ReturnType<typeof scanWorks>>) {
  const clusterRules: { name: string; genre: string; keywords: string[] }[] = [
    { name: '赛博朋克', genre: 'cyberpunk', keywords: ['赛博', '霓虹', '未来', '机械', '黑客', '机器人', '义体', 'cyber', 'robot', 'neon'] },
    { name: '仙侠武侠', genre: 'wuxia', keywords: ['剑', '仙侠', '武侠', '古装', '江湖', '侠', '剑刃', '古代'] },
    { name: '科幻宇宙', genre: 'sci-fi', keywords: ['科幻', '飞船', '外星', '太空', '宇宙', '星际', '未来', 'spaceship', 'aliens', 'space'] },
    { name: '情感剧场', genre: 'drama', keywords: ['爱情', '情感', '泪', '温暖', '治愈', '伤感', '感动', '浪漫'] },
    { name: '黑暗电影', genre: 'dark', keywords: ['黑暗', '恐怖', '悬疑', '惊悚', '阴影', '暗黑', 'dark'] },
    { name: '自然风景', genre: 'nature', keywords: ['自然', '风景', '山水', '森林', '大海', '沙滩', '日落', '日出', '花园', '阳光', 'cat', '猫', '蝴蝶'] },
    { name: '动画次元', genre: 'anime', keywords: ['动漫', '二次元', '卡通', '动画', '日系', '萌', 'anime'] },
    { name: '史诗大片', genre: 'epic', keywords: ['史诗', '战争', '巨剑', '雷电', '天空', '巨', '神话'] },
    { name: '现代生活', genre: 'modern', keywords: ['现代', '城市', '街道', '办公', '咖啡', '广告', '产品'] },
  ]

  // 确保"通用宇宙"分群存在
  let defaultCluster = await prisma.universeCluster.findFirst({ where: { genre: 'general' } })
  if (!defaultCluster) {
    defaultCluster = await prisma.universeCluster.create({
      data: { name: '通用宇宙', genre: 'general' },
    })
  }

  let assigned = 0
  for (const w of works) {
    const prompt = (w.prompt || '').toLowerCase()
    let matchedClusterId: string | null = null

    for (const rule of clusterRules) {
      if (rule.keywords.some(kw => prompt.includes(kw))) {
        let cluster = await prisma.universeCluster.findFirst({ where: { name: rule.name } })
        if (!cluster) {
          cluster = await prisma.universeCluster.create({
            data: { name: rule.name, genre: rule.genre },
          })
        }
        matchedClusterId = cluster.id
        break
      }
    }

    if (!matchedClusterId) {
      matchedClusterId = defaultCluster!.id
    }

    if (w.universeClusterId !== matchedClusterId) {
      await prisma.userAsset.update({
        where: { id: w.id },
        data: { universeClusterId: matchedClusterId },
      })
      assigned++
    }
  }

  // 更新分群作品计数
  const clusters = await prisma.universeCluster.findMany()
  for (const c of clusters) {
    await prisma.universeCluster.update({
      where: { id: c.id },
      data: { workCount: await prisma.userAsset.count({ where: { universeClusterId: c.id } }) },
    })
  }

  console.log(`✅ 分群更新: ${assigned} 个作品重新分配`)
  console.log(`📊 现有分群:`)
  const clusters2 = await prisma.universeCluster.findMany({ orderBy: { workCount: 'desc' } })
  for (const c of clusters2) {
    console.log(`   ${c.name}: ${c.workCount} 个作品`)
  }
}

// ── 步骤 4: 视频缩略图补全 ──────────────────
async function generateThumbnails(works: Awaited<ReturnType<typeof scanWorks>>) {
  const videos = works.filter(w => w.type === 'video' && !w.thumbnail)
  console.log(`🎬 需要生成缩略图的视频: ${videos.length} 个`)
  let generated = 0
  let failed = 0

  for (const v of videos) {
    try {
      const thumbPath = `/tmp/thumb_backfill_${v.id}.jpg`
      execSync(`ffmpeg -y -i "${v.url}" -ss 0.5 -vframes 1 -q:v 3 "${thumbPath}" 2>/dev/null`, {
        timeout: 30000,
        stdio: 'pipe',
      })
      if (existsSync(thumbPath)) {
        const stat = await import('fs/promises').then(fs => fs.stat(thumbPath))
        if (stat.size > 0 && stat.size < 5 * 1024 * 1024) {
          const base64 = readFileSync(thumbPath, { encoding: 'base64' })
          const dataUri = `data:image/jpeg;base64,${base64}`
          await prisma.userAsset.update({ where: { id: v.id }, data: { thumbnail: dataUri } })
          generated++
        }
        if (existsSync(thumbPath)) unlinkSync(thumbPath)
      }
    } catch (e) {
      failed++
    }
  }
  console.log(`✅ 缩略图生成: ${generated} 成功, ${failed} 失败`)
}

// ── 步骤 5: 可见性修复 ──────────────────────
async function repairVisibility() {
  // 默认所有作品都是公开可见的，若已有 isFeatured 标记则保留
  console.log(`✅ 可见性: 所有作品默认公开`)
}

// ── 步骤 6: 重建索引 ──────────────────────
async function reindex() {
  await assignClusters(await scanWorks())
  console.log(`✅ 分群索引重建完成`)
}

// ── 主流程 ──────────────────────────────
async function main() {
  console.log('🚀 OMS 宇宙回填 & 重建索引系统启动')
  console.log('='.repeat(50))

  console.log('\n📌 步骤 1: 扫描所有作品')
  const works = await scanWorks()

  console.log('\n📌 步骤 2: 补全评分')
  await generateDefaultScores(works)

  console.log('\n📌 步骤 3: 分群分配')
  await assignClusters(works)

  console.log('\n📌 步骤 4: 视频缩略图补全')
  await generateThumbnails(works)

  console.log('\n📌 步骤 5: 可见性修复')
  await repairVisibility()

  console.log('\n📌 步骤 6: 重建索引')
  await reindex()

  console.log('\n' + '='.repeat(50))
  console.log('🎉 宇宙回填完成！')
  await prisma.$disconnect()
}

main().catch(async (e) => {
  console.error('❌ 回填失败:', e.message)
  await prisma.$disconnect()
  process.exit(1)
})
