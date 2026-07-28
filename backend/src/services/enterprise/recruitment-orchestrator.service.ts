/**
 * recruitment-orchestrator.service.ts — Agent 协作编排服务
 * Sprint 10 Phase 2: 从人工点击升级为 AI Agent 自动协作
 *
 * 编排流程：
 * 1. JD Agent → 优化岗位描述
 * 2. Talent Agent → 搜索候选人
 * 3. Match Agent → AI 匹配筛选
 * 4. Director → 汇总推荐 TOP 人选
 * 5. Interview Agent → 为推荐人选创建面试计划
 *
 * 状态追踪：
 * - 每个招聘计划有明确的状态：planning → executing → reviewing → completed
 * - 每个子任务有独立状态：pending → running → completed | failed
 */

import { prisma } from '../../utils/index.js'
import { EnterpriseRecruitAgent } from '../../agents/job/enterprise-recruit-agent.js'
import { TalentSearchAgent } from '../../agents/job/talent-search-agent.js'
import { InterviewAgent } from '../../agents/job/interview-agent.js'

// ─── Types ───

export interface OrchestratorConfig {
  workspaceId: string
  enterpriseId: string
  autoExecute: boolean  // 是否自动执行（无需人工确认）
  matchThreshold: number  // 匹配度阈值
  maxCandidates: number  // 最大推荐人数
}

export interface OrchestrationResult {
  planId: string
  success: boolean
  stages: StageResult[]
  summary: string
}

export interface StageResult {
  stage: string
  status: 'completed' | 'failed' | 'skipped'
  duration: number  // ms
  result?: any
  error?: string
}

// ─── Orchestrator Service ───

export class RecruitmentOrchestratorService {

  private config: OrchestratorConfig

  constructor(config: OrchestratorConfig) {
    this.config = {
      ...config,
      matchThreshold: config.matchThreshold ?? 60,
      maxCandidates: config.maxCandidates ?? 5,
    }
  }

  /**
   * 执行完整的招聘编排流程
   */
  async executeOrchestration(planId: string): Promise<OrchestrationResult> {
    const stages: StageResult[] = []
    const startTime = Date.now()

    try {
      // 获取计划
      const plan = await prisma.recruitmentPlan.findUnique({
        where: { id: planId },
        include: { tasks: { orderBy: { sortOrder: 'asc' } }, workspace: true },
      })

      if (!plan) {
        return {
          planId,
          success: false,
          stages: [],
          summary: 'Plan not found',
        }
      }

      // Stage 1: JD 优化
      const jdResult = await this.executeJDStage(plan)
      stages.push(jdResult)

      // Stage 2: 人才搜索
      const talentResult = await this.executeTalentStage(plan)
      stages.push(talentResult)

      // Stage 3: AI 匹配
      const matchResult = await this.executeMatchStage(plan)
      stages.push(matchResult)

      // Stage 4: Director 汇总
      const summaryResult = await this.executeSummaryStage(plan, stages)
      stages.push(summaryResult)

      // Stage 5: 面试计划
      const interviewResult = await this.executeInterviewStage(plan, stages)
      stages.push(interviewResult)

      // 判断整体成功
      const allSuccess = stages.every(s => s.status === 'completed')
      const failedStages = stages.filter(s => s.status === 'failed')

      // 更新计划状态
      await prisma.recruitmentPlan.update({
        where: { id: planId },
        data: {
          status: allSuccess ? 'reviewing' : 'failed',
          completedSubtasks: stages.filter(s => s.status === 'completed').length,
          completedAt: new Date(),
        },
      })

      return {
        planId,
        success: allSuccess,
        stages,
        summary: allSuccess
          ? `招聘编排完成，${stages.length} 个阶段全部成功`
          : `招聘编排完成，${failedStages.length} 个阶段失败`,
      }
    } catch (error: any) {
      return {
        planId,
        success: false,
        stages,
        summary: `编排异常: ${error.message}`,
      }
    }
  }

  /**
   * Stage 1: JD 优化
   */
  private async executeJDStage(plan: any): Promise<StageResult> {
    const start = Date.now()
    try {
      const agent = new EnterpriseRecruitAgent()
      const jdResult = agent.generateJD({
        companyName: plan.workspace?.name || '企业',
        position: plan.positionTitle,
        salaryRange: plan.salaryRange,
        location: plan.location,
      })

      // 更新任务状态
      await this.updateTaskStatus(plan.id, 'jd_optimizer', 'completed', {
        qualityScore: jdResult.qualityScore,
        improvements: jdResult.improvements,
      })

      return {
        stage: 'jd_optimizer',
        status: 'completed',
        duration: Date.now() - start,
        result: jdResult,
      }
    } catch (error: any) {
      await this.updateTaskStatus(plan.id, 'jd_optimizer', 'failed', null, error.message)
      return {
        stage: 'jd_optimizer',
        status: 'failed',
        duration: Date.now() - start,
        error: error.message,
      }
    }
  }

  /**
   * Stage 2: 人才搜索
   */
  private async executeTalentStage(plan: any): Promise<StageResult> {
    const start = Date.now()
    try {
      // 获取候选人
      const candidates = await prisma.candidateMatch.findMany({
        where: { workspaceId: plan.workspaceId },
        take: 20,
      })

      if (candidates.length === 0) {
        await this.updateTaskStatus(plan.id, 'talent_searcher', 'completed', {
          message: '暂无候选人数据',
          candidatesFound: 0,
        })
        return {
          stage: 'talent_searcher',
          status: 'completed',
          duration: Date.now() - start,
          result: { candidatesFound: 0 },
        }
      }

      const agent = new TalentSearchAgent()
      const searchResult = agent.searchTalents(
        {
          workspaceId: plan.workspaceId,
          enterpriseId: plan.enterpriseId,
          title: plan.positionTitle,
          limit: this.config.maxCandidates,
        },
        candidates.map((c: any) => ({
          id: c.id,
          name: c.candidateName,
          skills: c.skills || [],
          experience: c.experience || '',
          city: c.city || '',
          salaryMin: c.salaryMin || 0,
          salaryMax: c.salaryMax || 999,
          education: c.education || '',
          careerLevel: c.careerLevel || 'Middle',
        })),
      )

      await this.updateTaskStatus(plan.id, 'talent_searcher', 'completed', {
        candidatesFound: candidates.length,
        topMatches: searchResult.slice(0, 5),
      })

      return {
        stage: 'talent_searcher',
        status: 'completed',
        duration: Date.now() - start,
        result: { candidatesFound: candidates.length, topMatches: searchResult.slice(0, 5) },
      }
    } catch (error: any) {
      await this.updateTaskStatus(plan.id, 'talent_searcher', 'failed', null, error.message)
      return {
        stage: 'talent_searcher',
        status: 'failed',
        duration: Date.now() - start,
        error: error.message,
      }
    }
  }

  /**
   * Stage 3: AI 匹配
   */
  private async executeMatchStage(plan: any): Promise<StageResult> {
    const start = Date.now()
    try {
      const candidates = await prisma.candidateMatch.findMany({
        where: { workspaceId: plan.workspaceId },
        take: 10,
      })

      const agent = new EnterpriseRecruitAgent()
      const matchResults = agent.matchCandidates({
        jobId: plan.id,
        jobRequirements: [plan.description || ''],
        jobSkills: [],
        jobSalary: plan.salaryRange || '15-25K',
        jobLocation: plan.location || '不限',
        candidates: candidates.map((c: any) => ({
          id: c.id,
          name: c.candidateName,
          skills: c.skills || [],
          experience: c.experience || '',
          city: c.city || '',
          salaryMin: c.salaryMin || 0,
          salaryMax: c.salaryMax || 999,
          education: c.education || '',
        })),
      })

      // 过滤低于阈值的候选人
      const qualifiedCandidates = matchResults.filter(
        (r: any) => r.matchScore >= this.config.matchThreshold
      )

      await this.updateTaskStatus(plan.id, 'match_filter', 'completed', {
        analyzedCount: candidates.length,
        qualifiedCount: qualifiedCandidates.length,
        topMatches: qualifiedCandidates.slice(0, 5),
      })

      return {
        stage: 'match_filter',
        status: 'completed',
        duration: Date.now() - start,
        result: {
          analyzedCount: candidates.length,
          qualifiedCount: qualifiedCandidates.length,
          topMatches: qualifiedCandidates.slice(0, 5),
        },
      }
    } catch (error: any) {
      await this.updateTaskStatus(plan.id, 'match_filter', 'failed', null, error.message)
      return {
        stage: 'match_filter',
        status: 'failed',
        duration: Date.now() - start,
        error: error.message,
      }
    }
  }

  /**
   * Stage 4: Director 汇总
   */
  private async executeSummaryStage(plan: any, previousStages: StageResult[]): Promise<StageResult> {
    const start = Date.now()
    try {
      // 汇总前3个阶段的结果
      const matchStage = previousStages.find(s => s.stage === 'match_filter')
      const talentStage = previousStages.find(s => s.stage === 'talent_searcher')

      const topCandidates = matchStage?.result?.topMatches || []
      const candidatesFound = talentStage?.result?.candidatesFound || 0

      // 更新计划的推荐结果
      await prisma.recruitmentPlan.update({
        where: { id: plan.id },
        data: {
          recommendedCandidates: topCandidates,
        },
      })

      await this.updateTaskStatus(plan.id, 'director_summary', 'completed', {
        recommendedCount: topCandidates.length,
        candidatesAnalyzed: candidatesFound,
      })

      return {
        stage: 'director_summary',
        status: 'completed',
        duration: Date.now() - start,
        result: {
          recommendedCount: topCandidates.length,
          candidatesAnalyzed: candidatesFound,
        },
      }
    } catch (error: any) {
      await this.updateTaskStatus(plan.id, 'director_summary', 'failed', null, error.message)
      return {
        stage: 'director_summary',
        status: 'failed',
        duration: Date.now() - start,
        error: error.message,
      }
    }
  }

  /**
   * Stage 5: 面试计划
   */
  private async executeInterviewStage(plan: any, previousStages: StageResult[]): Promise<StageResult> {
    const start = Date.now()
    try {
      const agent = new InterviewAgent()
      const interviewPlan = agent.generateInterviewPlan(
        {
          title: plan.positionTitle,
          skills: [],
          salary: plan.salaryRange || '15-25K',
          location: plan.location || '不限',
          requirements: [plan.description || ''],
          level: 'mid',
        },
        {
          name: '候选人',
          skills: [],
          experienceYears: 3,
          education: '本科',
          city: plan.location || '不限',
          careerGoal: '',
          projects: '',
        },
      )

      await this.updateTaskStatus(plan.id, 'interview_planner', 'completed', {
        totalQuestions: interviewPlan.totalQuestions,
        estimatedDuration: interviewPlan.estimatedDuration,
        focusAreas: interviewPlan.focusAreas,
      })

      return {
        stage: 'interview_planner',
        status: 'completed',
        duration: Date.now() - start,
        result: {
          totalQuestions: interviewPlan.totalQuestions,
          estimatedDuration: interviewPlan.estimatedDuration,
        },
      }
    } catch (error: any) {
      await this.updateTaskStatus(plan.id, 'interview_planner', 'failed', null, error.message)
      return {
        stage: 'interview_planner',
        status: 'failed',
        duration: Date.now() - start,
        error: error.message,
      }
    }
  }

  /**
   * 更新任务状态
   */
  private async updateTaskStatus(
    planId: string,
    agentType: string,
    status: string,
    result?: any,
    errorMessage?: string,
  ): Promise<void> {
    await prisma.recruitmentPlanTask.updateMany({
      where: { planId, agentType },
      data: {
        status,
        result: result || null,
        errorMessage: errorMessage || null,
        ...(status === 'running' ? { startedAt: new Date() } : {}),
        ...(status === 'completed' || status === 'failed' ? { completedAt: new Date() } : {}),
      },
    })
  }
}

// ─── Singleton ───

export const recruitmentOrchestratorService = new RecruitmentOrchestratorService({
  workspaceId: '',
  enterpriseId: '',
  autoExecute: true,
  matchThreshold: 60,
  maxCandidates: 5,
})
