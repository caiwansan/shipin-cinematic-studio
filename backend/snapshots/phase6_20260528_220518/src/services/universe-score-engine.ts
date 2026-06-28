import { prisma } from '../utils/index.js'

/**
 * 宇宙评分引擎 — 为每个作品计算综合宇宙分
 *
 * universe_score =
 *   0.25 * cinematic_score
 * + 0.20 * retention_score
 * + 0.15 * consistency_score
 * + 0.15 * engagement_score
 * + 0.10 * freshness_score
 * + 0.10 * world_depth_score
 * + 0.05 * director_complexity
 */
export async function computeUniverseScore(assetId: string) {
  const asset = await prisma.userAsset.findUnique({
    where: { id: assetId },
    include: {
      likes: true,
      comments: true,
    },
  })
  if (!asset) return

  // 模拟评分引擎（后续接入 AI 分析）
  // 目前根据点赞数、评论数、新鲜度做粗略计算
  const likeCount = asset.likes?.length || 0
  const commentCount = asset.comments?.length || 0
  const ageHours = (Date.now() - asset.createdAt.getTime()) / 3600000

  // 用户互动分（0-100）
  const engagementScore = Math.min(100, (likeCount * 10 + commentCount * 15))
  const retentionScore = Math.min(100, engagementScore * 0.6)

  // 新鲜度分（越新越高，24h 内满分，之后逐步衰减）
  const freshnessScore = Math.max(0, 100 - ageHours * 2)

  // 基础评分（图片/视频差异）
  const baseScore = asset.type === 'video' ? 70 : 50

  // 综合计算
  const cinematicScore = Math.min(100, baseScore + engagementScore * 0.3)
  const narrativeScore = Math.min(100, baseScore + Math.random() * 20)
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
    where: { id: assetId },
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

  // 同步更新到分群
  await assignToCluster(assetId)
}

/**
 * 将作品分配到宇宙分群（基于 prompt/style）
 */
async function assignToCluster(assetId: string) {
  const asset = await prisma.userAsset.findUnique({ where: { id: assetId } })
  if (!asset) return

  const prompt = (asset.prompt || '').toLowerCase()
  const style = (asset.style || '').toLowerCase()

  // 根据关键词模糊分群
  let clusterName = '其他'
  let genre = 'other'

  const clusterRules: { name: string; genre: string; keywords: string[] }[] = [
    { name: '赛博朋克', genre: 'cyberpunk', keywords: ['赛博', '霓虹', '未来', '机械', '黑客', '机器人', '义体'] },
    { name: '仙侠武侠', genre: 'wuxia', keywords: ['剑', '仙侠', '武侠', '古装', '江湖', '侠', '侠客', '飞剑'] },
    { name: '科幻宇宙', genre: 'sci-fi', keywords: ['科幻', '飞船', '外星', '太空', '宇宙', '星际', '未来世界'] },
    { name: '情感剧场', genre: 'drama', keywords: ['爱情', '情感', '泪', '温暖', '治愈', '伤感', '感动'] },
    { name: '黑暗电影', genre: 'dark', keywords: ['黑暗', '恐怖', '悬疑', '惊悚', '阴影', '暗黑'] },
    { name: '自然风景', genre: 'nature', keywords: ['自然', '风景', '山水', '森林', '大海', '沙滩', '日落', '日出'] },
    { name: '动画次元', genre: 'anime', keywords: ['动漫', '二次元', '卡通', '动画', '日系', '萌'] },
  ]

  for (const rule of clusterRules) {
    if (rule.keywords.some(kw => prompt.includes(kw) || style.includes(kw))) {
      clusterName = rule.name
      genre = rule.genre
      break
    }
  }

  // 查找或创建分群
  let cluster = await prisma.universeCluster.findFirst({
    where: { name: clusterName },
  })

  if (!cluster) {
    cluster = await prisma.universeCluster.create({
      data: { name: clusterName, genre },
    })
  }

  // 更新作品的 cluster 关联
  await prisma.userAsset.update({
    where: { id: assetId },
    data: { universeClusterId: cluster.id },
  })

  // 更新分群的作品数
  await prisma.universeCluster.update({
    where: { id: cluster.id },
    data: { workCount: await prisma.userAsset.count({ where: { universeClusterId: cluster.id } }) },
  })
}

/**
 * 批量重新评分所有作品
 */
export async function recalculateAllScores() {
  const assets = await prisma.userAsset.findMany({ select: { id: true } })
  for (const asset of assets) {
    await computeUniverseScore(asset.id)
  }
  return { recalculated: assets.length }
}
