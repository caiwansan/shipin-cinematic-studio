// ============================================================
// Workspace Runtime Repository — CRUD for WorkspaceRuntime
// ============================================================

import { prisma } from '../../../utils/index'

export const workspaceRuntimeRepository = {
  async create(data: any): Promise<any> {
    return prisma.workspaceRuntime.create({ data })
  },
}
