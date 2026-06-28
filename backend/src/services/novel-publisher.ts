/**
 * services/novel-publisher.ts — 小说自动发布引擎
 *
 * 定时扫描 HdzProject：
 * 1. 所有 status !== 'completed' && isPublished === false 的项目
 * 2. 统计所有章节总字数
 * 3. 如果总字数 >= 50000，自动发布到 NovelPost
 * 4. 新书标识 isNewBook = true，newBookUntil = now + 5h
 */

import { prisma } from '../utils/index.js'

const MIN_WORD_COUNT = 50000

export async function autoPublishNovels(): Promise<{ published: number; errors: number }> {
  let published = 0
  let errors = 0

  try {
    // 找所有未发布且符合条件的项目
    const candidates = await prisma.hdzProject.findMany({
      where: {
        isPublished: false,
        status: { notIn: ['draft'] },
      },
      select: {
        id: true,
        title: true,
        authorNickname: true,
        genre: true,
        styleDesc: true,
        coverImgUrl: true,
        isPublished: true,
      },
    })

    for (const project of candidates) {
      try {
        // 计算总字数
        const wordAgg = await prisma.hdzChapter.aggregate({
          where: { projectId: project.id },
          _sum: { wordCount: true },
        })
        const wordCount = wordAgg._sum.wordCount || 0

        if (wordCount < MIN_WORD_COUNT) continue

        // 检查是否已在 NovelPost
        const existing = await prisma.novelPost.findUnique({
          where: { projectId: project.id },
        })
        if (existing) continue

        // 创建 NovelPost
        const newBookUntil = new Date(Date.now() + 5 * 60 * 60 * 1000) // 5h later
        await prisma.novelPost.create({
          data: {
            projectId: project.id,
            userId: '', // 从项目查询
            title: project.title,
            authorNick: project.authorNickname || '匿名作者',
            coverUrl: project.coverImgUrl,
            genre: project.genre,
            intro: project.styleDesc,
            wordCount,
            status: 'pending', // 等待后台审核
            isNewBook: true,
            newBookUntil,
          },
        })

        // 标记项目为已发布
        await prisma.hdzProject.update({
          where: { id: project.id },
          data: {
            isPublished: true,
            publishedAt: new Date(),
            publishWordCount: wordCount,
            status: 'completed',
          },
        })

        published++
        console.log(`[NovelPublisher] ✅ 自动发布: ${project.title} (${wordCount}字)`)
      } catch (e) {
        errors++
        console.error(`[NovelPublisher] ❌ 发布失败: ${project.id}`, e)
      }
    }
  } catch (e) {
    console.error('[NovelPublisher] ❌ 扫描失败', e)
  }

  // 清理过期的新书标识
  try {
    await prisma.novelPost.updateMany({
      where: { isNewBook: true, newBookUntil: { lte: new Date() } },
      data: { isNewBook: false },
    })
  } catch (_) {}

  return { published, errors }
}
