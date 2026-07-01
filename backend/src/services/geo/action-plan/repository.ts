// ============================================================
// ActionPlanRepository — P0-T007 Action Plan Engine
// 存储方式：存入 project.config.actionPlans[] 数组
// ============================================================

import { ActionPlan } from './types.js'
import { geoProjectRepository } from '../repositories/geo-project.repository.js'

export class ActionPlanRepository {
  /**
   * 根据 projectId 查找所有 ActionPlan
   * 从 project.config.actionPlans 中读取
   */
  async findByProjectId(projectId: string): Promise<ActionPlan[]> {
    const project = await geoProjectRepository.findUnique({ id: projectId })
    if (!project) return []
    return (project.config?.actionPlans as ActionPlan[]) || []
  }

  /**
   * 保存单个 ActionPlan
   */
  async save(plan: ActionPlan): Promise<void> {
    const project = await geoProjectRepository.findUnique({ id: plan.projectId })
    if (!project) throw new Error(`Project ${plan.projectId} not found`)

    const plans: ActionPlan[] = (project.config?.actionPlans as ActionPlan[]) || []
    const idx = plans.findIndex((p) => p.id === plan.id)
    if (idx >= 0) {
      plans[idx] = plan
    } else {
      plans.push(plan)
    }

    await geoProjectRepository.update(
      { id: plan.projectId },
      {
        config: {
          ...(project.config || {}),
          actionPlans: plans,
        },
      }
    )
  }

  /**
   * 批量保存 ActionPlan（全量替换）
   */
  async saveMany(plans: ActionPlan[]): Promise<void> {
    if (plans.length === 0) return
    const projectId = plans[0].projectId
    const project = await geoProjectRepository.findUnique({ id: projectId })
    if (!project) throw new Error(`Project ${projectId} not found`)

    await geoProjectRepository.update(
      { id: projectId },
      {
        config: {
          ...(project.config || {}),
          actionPlans: plans,
        },
      }
    )
  }

  /**
   * 更新 ActionPlan 状态
   */
  async updateStatus(planId: string, status: 'todo' | 'running' | 'completed'): Promise<ActionPlan> {
    // 查找所有项目中的 plan
    // 由于不知道 projectId，需要遍历搜索
    // 优化：通过 project.config.actionPlans 查找
    const allProjects = await geoProjectRepository.findMany({})
    for (const project of allProjects) {
      const plans: ActionPlan[] = (project.config?.actionPlans as ActionPlan[]) || []
      const idx = plans.findIndex((p) => p.id === planId)
      if (idx >= 0) {
        const updatedPlan: ActionPlan = {
          ...plans[idx],
          status,
          updatedAt: new Date().toISOString(),
        }
        plans[idx] = updatedPlan
        await geoProjectRepository.update(
          { id: project.id },
          {
            config: {
              ...(project.config || {}),
              actionPlans: plans,
            },
          }
        )
        return updatedPlan
      }
    }
    throw new Error(`ActionPlan ${planId} not found`)
  }
}
