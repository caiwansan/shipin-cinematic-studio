// ============================================================
// ActionPlanEngine — P0-T007 Action Plan Engine
// SSOT: 所有 Action Plan 操作通过此 Engine 执行
// ============================================================

import { ActionPlanBuilder } from './builder.js'
import { ActionPlanRepository } from './repository.js'
import type { ActionPlan, ActionPlanResult, ActionPlanSummary } from './types.js'
import { geoProjectRepository } from '../repositories/geo-project.repository.js'
import { geoScanHistoryRepository } from '../repositories/geo-scan-history.repository.js'
import { geoClaimRepository } from '../repositories/geo-claim.repository.js'
import crypto from 'crypto'

export class ActionPlanEngine {
  constructor(
    private builder: ActionPlanBuilder,
    private repo: ActionPlanRepository
  ) {}

  /**
   * 获取项目的 Action Plans（来自存储）
   */
  async getPlans(projectId: string): Promise<ActionPlanResult> {
    const plans = await this.repo.findByProjectId(projectId)
    return this.buildResult(projectId, plans)
  }

  /**
   * 刷新 Action Plans — 从 Recommendation Engine 重建
   * 1. 获取项目数据
   * 2. 生成 recommendations（同 geo-optimization route 逻辑）
   * 3. 构建 ActionPlans
   * 4. 保存
   */
  async refreshPlans(projectId: string): Promise<ActionPlanResult> {
    const project = await geoProjectRepository.findUnique({ id: projectId })
    if (!project) {
      throw new Error('Project not found')
    }

    // 1. 获取项目状态数据
    const adi = project.config?.adi || 0
    const entityCount = project.config?.entityCount || 0
    const scanRecords = await geoScanHistoryRepository.findMany({
      where: { projectId },
      orderBy: { createdAt: 'desc' },
    })

    const hasWebsite = !!(project.config?.website || project.website)
    const hasStructuredData = false
    const hasSearch = scanRecords.length > 0
    const evidenceCount = 0

    // 2. 生成 recommendations（同 explain/optimization route 逻辑）
    const recommendations = this.generateRecommendations(
      adi, hasWebsite, entityCount, hasSearch, evidenceCount
    )

    // 3. 构建 ActionPlans
    const plans = this.builder.buildFromRecommendations(recommendations, projectId)

    // 4. 保持已有的 running/completed 状态不变
    const existingPlans = await this.repo.findByProjectId(projectId)
    const existingMap = new Map<string, ActionPlan>()
    for (const p of existingPlans) {
      existingMap.set(p.title, p)
    }

    for (const plan of plans) {
      const existing = existingMap.get(plan.title)
      if (existing && (existing.status === 'running' || existing.status === 'completed')) {
        // 保持原有状态，但更新时间
        plan.status = existing.status
        plan.id = existing.id
        plan.createdAt = existing.createdAt
        plan.updatedAt = new Date().toISOString()
      }
    }

    // 5. 保存
    await this.repo.saveMany(plans)

    return this.buildResult(projectId, plans)
  }

  /**
   * 开始一个 Action Plan
   */
  async startPlan(planId: string): Promise<ActionPlan> {
    return this.repo.updateStatus(planId, 'running')
  }

  /**
   * 暂停一个 Action Plan
   */
  async pausePlan(planId: string): Promise<ActionPlan> {
    return this.repo.updateStatus(planId, 'todo')
  }

  /**
   * 完成一个 Action Plan
   */
  async completePlan(planId: string): Promise<ActionPlan> {
    return this.repo.updateStatus(planId, 'completed')
  }

  // ========== Private ==========

  private buildResult(projectId: string, plans: ActionPlan[]): ActionPlanResult {
    const todo = plans.filter((p) => p.status === 'todo').length
    const running = plans.filter((p) => p.status === 'running').length
    const completed = plans.filter((p) => p.status === 'completed').length
    const totalEstimatedGain = plans.reduce((sum, p) => sum + p.estimatedGain, 0)

    const summary: ActionPlanSummary = {
      total: plans.length,
      todo,
      running,
      completed,
      totalEstimatedGain,
    }

    return {
      projectId,
      plans,
      summary,
    }
  }

  /**
   * 生成 Recommendations（同 explain/optimization route 逻辑，
   * 保持 SSOT — 这是 Recommendation Engine 的副本，未来应抽取为共享模块）
   */
  private generateRecommendations(
    score: number,
    hasWebsite: boolean,
    entityCount: number,
    hasSearch: boolean,
    evidenceCount: number
  ): any[] {
    const recommendations: any[] = []

    if (!hasWebsite) {
      recommendations.push({
        id: crypto.randomUUID(),
        action: '配置官网 URL 并确保可访问',
        priority: 'high',
        difficulty: 'easy',
        expectedImpact: '预计 +5~10',
        estimatedGain: 60,
        reason: '官网是品牌 AI 可见度的核心基础，未检测到官网信息',
      })
    }

    // Schema recommendation — always included since we can't verify without evidence table
    recommendations.push({
        id: crypto.randomUUID(),
        action: '在官网添加 Schema.org 结构化数据标记',
        priority: 'high',
        difficulty: 'medium',
        expectedImpact: '预计 +6~12',
        estimatedGain: 70,
        reason: '官网未检测到结构化数据标记，搜索引擎无法识别品牌信息',
      })

    if (entityCount === 0) {
      recommendations.push({
        id: crypto.randomUUID(),
        action: '运行实体提取，构建品牌知识图谱',
        priority: 'high',
        difficulty: 'medium',
        expectedImpact: '预计 +4~10',
        estimatedGain: 65,
        reason: '知识库为空，未提取到品牌相关实体',
      })
    }

    if (!hasSearch) {
      recommendations.push({
        id: crypto.randomUUID(),
        action: '运行 Quick Discovery 获取品牌基线评分',
        priority: 'high',
        difficulty: 'easy',
        expectedImpact: '预计 +0~2（获取基线）',
        estimatedGain: 30,
        reason: '尚未运行发现扫描，无法评估品牌可见度基线',
      })
    }

    if (score < 60 && hasWebsite) {
      recommendations.push({
        id: crypto.randomUUID(),
        action: '完善品牌描述与 FAQ 内容',
        priority: 'medium',
        difficulty: 'easy',
        expectedImpact: '预计 +3~6',
        estimatedGain: 50,
        reason: '品牌描述不够详细，无法提供足够的品牌上下文',
      })
    }

    if (score >= 60 && score < 80) {
      recommendations.push({
        id: crypto.randomUUID(),
        action: '扩展知识源：添加行业白皮书、案例研究等权威内容',
        priority: 'medium',
        difficulty: 'hard',
        expectedImpact: '预计 +5~8',
        estimatedGain: 55,
        reason: '品牌已具备基础可见度，可通过权威内容提升可信度',
      })
    }

    if (score >= 80) {
      recommendations.push({
        id: crypto.randomUUID(),
        action: '持续监控 ADI 趋势，设置评分漂移告警',
        priority: 'low',
        difficulty: 'easy',
        expectedImpact: '预计 +0~2（防止衰减）',
        estimatedGain: 25,
        reason: '品牌表现优秀，需持续监控防止评分衰减',
      })
    }

    // 保证至少 3 条
    const fallbacks = [
      {
        action: '运行 Quick Discovery 开始分析',
        priority: 'high',
        difficulty: 'easy',
        expectedImpact: '预计 +0~2（获取基线）',
        estimatedGain: 30,
        reason: '尚未运行分析，无法获取品牌基线数据',
      },
      {
        action: '完善品牌资料（名称、官网、行业）',
        priority: 'high',
        difficulty: 'easy',
        expectedImpact: '预计 +3~5',
        estimatedGain: 40,
        reason: '品牌资料不完整，影响 AI 对品牌的识别能力',
      },
      {
        action: '添加知识源（文档、FAQ、产品信息）',
        priority: 'medium',
        difficulty: 'medium',
        expectedImpact: '预计 +4~8',
        estimatedGain: 50,
        reason: '缺乏足够的品牌知识源，影响品牌 AI 可见度评分',
      },
    ]

    while (recommendations.length < 3) {
      const fb = fallbacks[recommendations.length % fallbacks.length]
      if (!recommendations.find((r: any) => r.action === fb.action)) {
        recommendations.push({ ...fb, id: crypto.randomUUID() })
      } else {
        break
      }
    }

    return recommendations.slice(0, 6)
  }
}
