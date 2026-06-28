/**
 * onChapterCompleted.ts — Integration Layer
 *
 * 旧的 chapter hook 适配器。
 * 在 Writer 写完一章后触发，内部调用 runY1Pipeline。
 *
 * ⚠️ 这不是 pipeline 核心，只是事件适配器。
 * Y.1 pipeline 可以独立运行，不依赖 chapter hook。
 */

import { runY1Pipeline, initY1Pipeline } from '../core/pipeline.js'

let initialized = false

/**
 * 章节完成后的异步回调
 * 由 Writer 写完后触发
 */
export async function onChapterCompleted(projectId: string, chapterNo: number): Promise<void> {
  if (!initialized) {
    await initY1Pipeline()
    initialized = true
  }

  const { prisma } = await import('../../../utils/index.js')

  const chapter = await prisma.hdzChapter.findUnique({
    where: { projectId_chapterNo: { projectId, chapterNo } },
  })

  if (!chapter || !chapter.content) {
    console.log(`[Y1/Integration] ch${chapterNo}: no content, skipping`)
    return
  }

  const docId = projectId
  const chunkPrefix = `${docId}-ch${String(chapterNo).padStart(3, '0')}`

  await runY1Pipeline(chapter.content, docId, chunkPrefix)
}
