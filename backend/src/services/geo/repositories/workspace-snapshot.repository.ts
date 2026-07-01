// ============================================================
// Workspace Snapshot Repository — CRUD for WorkspaceSnapshot
// ============================================================

import { prisma } from '../../../utils/index'

export const workspaceSnapshotRepository = {
  async create(data: any): Promise<any> {
    return prisma.workspaceSnapshot.create({ data })
  },
}
