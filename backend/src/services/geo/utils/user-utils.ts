// ============================================================
// User Utils — 辅助函数（避免动态 import 导致模块解析失败）
// ============================================================

import { geoProjectRepository } from '../repositories/geo-project.repository.js'

export async function getUserIdFromProject(projectId: string): Promise<string | null> {
  try {
    const project = await geoProjectRepository.findUnique({
      where: { id: projectId },
    })
    return project?.userId || null
  } catch {
    return null
  }
}
