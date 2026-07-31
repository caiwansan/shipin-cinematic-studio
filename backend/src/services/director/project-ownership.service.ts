/**
 * project-ownership.service.ts — 短剧工作台项目归属校验（Phase 6 安全隔离）
 *
 * 统一入口：所有短剧 projectId 路由必须调用本组件校验归属。
 * 禁止各 route 自行复制权限代码。
 *
 * 设计约束：
 *   - 只读 Project.userId，不修改任何数据
 *   - 兼容 Nuxt array index artifact（:1 后缀）
 *   - 返回统一结构，由路由层转换为 HTTP 响应
 */

import { prisma } from '../../utils/index.js'

export type OwnershipResult =
  | { ok: true }
  | { ok: false; status: number; error: string }

/**
 * 校验 projectId 是否属于当前认证用户
 * @param projectId 项目 ID（可能带 Nuxt :index 后缀）
 * @param userId 当前认证用户 ID（来自 authenticate 后的 request.user.id）
 */
export async function verifyProjectOwner(
  projectId: string | undefined | null,
  userId: string | undefined | null,
): Promise<OwnershipResult> {
  if (!projectId || typeof projectId !== 'string') {
    return { ok: false, status: 400, error: '无效的项目 ID' }
  }

  // 兼容 Nuxt array index artifact (:1)
  const id = projectId.split(':')[0]

  if (!userId) {
    return { ok: false, status: 401, error: '未认证' }
  }

  const project = await prisma.project.findUnique({
    where: { id },
    select: { userId: true },
  })

  if (!project) {
    return { ok: false, status: 404, error: '项目未找到' }
  }

  if (project.userId !== userId) {
    return { ok: false, status: 403, error: '无权访问该项目' }
  }

  return { ok: true }
}
