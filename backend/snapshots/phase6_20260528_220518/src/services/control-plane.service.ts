/**
 * F1 Control Plane Service — 统一控制面
 *
 * 收口 governance-controller + control-plane + queue system
 * 所有控制动作必须经过此 Service，所有变更写入 InvocationLog
 */

import { jobQueueManager } from './job-queue-manager.js'
import { prisma } from '../utils/index.js'

export class ControlPlaneService {
  /**
   * 暂停项目（阻止所有新 Job）
   */
  async pauseProject(projectId: string, userId: string): Promise<void> {
    await prisma.project.update({
      where: { id: projectId },
      data: { status: 'paused' } as any,
    })

    await this.writeAuditLog({
      action: 'pause_project',
      projectId,
      userId,
      payload: {},
    })
  }

  /**
   * 恢复项目
   */
  async resumeProject(projectId: string, userId: string): Promise<void> {
    await prisma.project.update({
      where: { id: projectId },
      data: { status: 'active' } as any,
    })

    await this.writeAuditLog({
      action: 'resume_project',
      projectId,
      userId,
      payload: {},
    })
  }

  /**
   * 终止 Job
   */
  async killJob(jobId: string, userId: string): Promise<boolean> {
    const job = jobQueueManager.getStatus(jobId)
    if (!job) return false

    // 强制标记为 completed 并记录错误
    await jobQueueManager.complete(jobId, { killed: true, killedBy: userId })

    await this.writeAuditLog({
      action: 'kill_job',
      projectId: job.payload?.projectId || '',
      userId,
      payload: { jobId, jobType: job.type },
    })

    return true
  }

  /**
   * 紧急停止（所有 worker + queue 暂停）
   */
  async emergencyStop(userId: string): Promise<void> {
    // 记录紧急停止标记到内存
    process.env.EMERGENCY_STOP = 'true'

    await this.writeAuditLog({
      action: 'emergency_stop',
      projectId: '__system__',
      userId,
      payload: { timestamp: Date.now() },
    })
  }

  /**
   * 恢复紧急停止
   */
  async emergencyRelease(userId: string): Promise<void> {
    process.env.EMERGENCY_STOP = ''

    await this.writeAuditLog({
      action: 'emergency_release',
      projectId: '__system__',
      userId,
      payload: { timestamp: Date.now() },
    })
  }

  /**
   * 获取紧急停止状态
   */
  isEmergencyStopped(): boolean {
    return process.env.EMERGENCY_STOP === 'true'
  }

  /**
   * 审计日志写入
   */
  private async writeAuditLog(params: {
    action: string
    projectId: string
    userId: string
    payload: Record<string, any>
  }) {
    try {
      await prisma.invocationLog.create({
        data: {
          traceId: `ctrl_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
          userId: params.userId,
          projectId: params.projectId,
          capability: 'system',
          provider: 'internal',
          model: 'control-plane',
          status: 'success',
          latencyMs: 0,
          agentType: 'routing_agent',
          operationType: `system:${params.action}`,
          errorMsg: null,
        },
      })
    } catch {
      // 审计日志写入失败不阻塞控制动作
    }
  }
}

export const controlPlaneService = new ControlPlaneService()
