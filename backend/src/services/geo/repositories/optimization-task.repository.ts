// ============================================================
// Optimization Task Repository — Per-task status persistence
// Uses raw SQL for reliability (Prisma model might need client regen)
// ============================================================

import { prisma } from '../../../utils/index'

export interface TaskStatusRecord {
  projectId: string
  taskId: string
  status: string
  updatedAt: Date
  createdAt: Date
}

export const optimizationTaskRepository = {
  /**
   * Upsert a single task's status
   */
  async upsertStatus(projectId: string, taskId: string, status: string): Promise<void> {
    await prisma.$executeRawUnsafe(
      `INSERT INTO optimization_tasks (id, project_id, task_id, status, updated_at, created_at)
       VALUES (gen_random_uuid(), $1, $2, $3, NOW(), NOW())
       ON CONFLICT (project_id, task_id)
       DO UPDATE SET status = $3, updated_at = NOW()`,
      projectId, taskId, status
    )
  },

  /**
   * Batch upsert statuses for multiple tasks
   */
  async batchUpsertStatuses(projectId: string, entries: { taskId: string; status: string }[]): Promise<void> {
    for (const { taskId, status } of entries) {
      await prisma.$executeRawUnsafe(
        `INSERT INTO optimization_tasks (id, project_id, task_id, status, updated_at, created_at)
         VALUES (gen_random_uuid(), $1, $2, $3, NOW(), NOW())
         ON CONFLICT (project_id, task_id)
         DO UPDATE SET status = $3, updated_at = NOW()`,
        projectId, taskId, status
      )
    }
  },

  /**
   * Get all task statuses for a project
   */
  async getStatusesByProject(projectId: string): Promise<TaskStatusRecord[]> {
    const rows = await prisma.$queryRawUnsafe<Array<Record<string, any>>>(
      `SELECT project_id, task_id, status, updated_at, created_at
       FROM optimization_tasks
       WHERE project_id = $1`,
      projectId
    )
    return rows.map(r => ({
      projectId: r.project_id,
      taskId: r.task_id,
      status: r.status,
      updatedAt: new Date(r.updated_at),
      createdAt: new Date(r.created_at),
    }))
  },
}
