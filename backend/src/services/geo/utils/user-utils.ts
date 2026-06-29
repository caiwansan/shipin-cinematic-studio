// ============================================================
// User Utils — 辅助函数（避免动态 import 导致模块解析失败）
// ============================================================

import { prisma } from '../../../utils/index'

export async function getUserIdFromProject(projectId: string): Promise<string | null> {
  try {
    const project = await prisma.gEOProject.findUnique({
      where: { id: projectId },
      select: { userId: true },
    })
    return project?.userId || null
  } catch {
    return null
  }
}
