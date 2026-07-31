/**
 * services/hdz/orchestrator.service.ts — 混沌珠 Agent 编排器
 *
 * Enterprise 调用链：
 * Task → EnterpriseRuntimeContext → ModelRouter → callLLM → AgentAuditTrail
 *
 * BYOK 纪律：所有 LLM 调用走 Model Router → callLLM，不硬编码 Key
 */

import { prisma } from '../../utils/index.js'
import { getUserLLMConfig } from './llm.client.js'
import type { LLMConfig, OrchestratorContext, AgentType } from './llm.client.js'
import { plannerService } from './planner.service.js'
import { writerService } from './writer.service.js'
import { reviewerService, getReviewPassScore } from './reviewer.service.js'
import { characterService } from './character.service.js'
import { directorService } from './director.service.js'
import { consistencyVerifier } from './consistency-verifier.service.js'
import { recordHdzFailure, recordHdzSuccess } from './circuit-breaker.service.js'
import { emitEvent } from './event-log.service.js'
import { modelRouter } from '../enterprise/model-router.service.js'
import { agentAuditService } from '../enterprise/agent-audit.service.js'
import { buildEnterpriseRuntimeContext } from '../enterprise/enterprise-runtime.context.js'

class HdzOrchestrator {
  async executeTask(taskId: string): Promise<void> {
    console.log(`[HDZ] executeTask start: ${taskId}`)
    const task = await prisma.hdzAgentTask.findUnique({ where: { id: taskId } })
    if (!task) throw new Error(`任务 ${taskId} 不存在`)
    console.log(`[HDZ] Task ${taskId}: agentType=${task.agentType}, status=${task.status}`)

    const project = await prisma.hdzProject.findUnique({ where: { id: task.projectId } })
    if (!project) throw new Error('项目不存在')

    // ★ Enterprise Model Router 优先（企业员工调用链）
    let userCfg: LLMConfig | null = null
    let routeSource = 'user_byok'
    let enterpriseCtx = await buildEnterpriseRuntimeContext(
      project.userId, task.projectId, taskId, task.agentType, 'hdz_tasks'
    )

    if (enterpriseCtx) {
      const routeResult = await modelRouter.resolve({
        tenantId: enterpriseCtx.tenantId,
        agentType: task.agentType,
        taskType: 'hdz_tasks',
        organizationId: enterpriseCtx.organizationId,
        userId: project.userId,
      })
      if (routeResult) {
        userCfg = modelRouter.toLLMConfig(routeResult)
        routeSource = `enterprise_${routeResult.source}`
        console.log(`[HDZ] ✅ Enterprise Router: ${routeResult.provider}/${routeResult.modelName} (source=${routeResult.source})`)
      }
    }

    // Fallback 到个人 BYOK
    if (!userCfg) {
      userCfg = await getUserLLMConfig(project.userId)
      routeSource = 'user_byok'
      if (userCfg) console.log(`[HDZ] Task ${taskId}: LLM ${userCfg.provider}/${userCfg.modelName} (user BYOK)`)
    }

    if (!userCfg) {
      console.log(`[HDZ] Task ${taskId}: 用户 ${project.userId} 未配置 LLM`)
      await this.failTask(taskId, '请先在大模型设置中配置 LLM')
      return
    }
    console.log(`[HDZ] Task ${taskId}: LLM ${userCfg.provider}/${userCfg.modelName} (${routeSource})`)

    await prisma.$transaction(async (tx) => {
      await tx.hdzAgentTask.update({
        where: { id: taskId },
        data: { status: 'running', startedAt: new Date() },
      })
      await tx.eventLog.create({
        data: {
          entityType: 'task', entityId: taskId,
          eventType: 'TASK_STARTED',
          payload: { agentType: task.agentType, input: task.input },
        },
      })
    })

    try {
      const ctx: OrchestratorContext = {
        userId: project.userId,
        projectId: task.projectId,
        taskId,
        agentType: task.agentType as AgentType,
        mode: (task.input as any)?.mode || 'single',
        chapterNo: (task.input as any)?.chapterNo,
        chapterId: (task.input as any)?.chapterId,
        userInput: (task.input as any)?.userInput,
      }

      // ★ 02-B Task 4：附加 Usage Ledger 业务元数据（agentType/projectId/taskId）→ callLLM 统一记账
      if (userCfg) {
        userCfg.userId = project.userId
        userCfg.taskType = `hdz_${task.agentType}`
        userCfg.projectId = task.projectId
        userCfg.taskId = taskId
      }

      switch (task.agentType) {
        case 'planner':
          await plannerService.execute(ctx, userCfg)
          break
        case 'writer': {
          // ★ 02-B Task 1：生成前 Context Gate——主动防错，在错误产生前拦截
          // rewrite 模式跳过（重写是修复动作，且 G2 前置门会误伤）
          const writerInput = (task.input as any) || {}
          if (writerInput.mode !== 'rewrite') {
            const gate = await consistencyVerifier.verifyBeforeGeneration(task.projectId, writerInput.chapterNo || 1)
            if (!gate.ok) {
              await prisma.hdzAgentTask.update({
                where: { id: taskId },
                data: { status: 'blocked', output: { gate: { score: gate.score, gates: gate.gates, warnings: gate.warnings } } },
              })
              console.log(`[HDZ/Gate] ch${writerInput.chapterNo}: BLOCKED 生成（score=${gate.score}）— ${gate.warnings.join('; ')}`)
              break
            }
            console.log(`[HDZ/Gate] ch${writerInput.chapterNo}: PASS（score=${gate.score}）→ 放行生成`)
          }
          await writerService.execute(ctx, userCfg)
          break
        }
        case 'reviewer':
          await reviewerService.execute(ctx, userCfg)
          break
        case 'character':
          await characterService.execute(ctx, userCfg)
          break
        case 'director':
          await directorService.execute(ctx, userCfg)
          break
        default:
          throw new Error(`未知 agentType: ${task.agentType}`)
      }

      const updated = await prisma.hdzAgentTask.findUnique({ where: { id: taskId } })
      console.log(`[HDZ] Task ${taskId}: agentType=${task.agentType} done, status=${updated?.status}`)
      if (updated && updated.status === 'running') {
        await prisma.$transaction(async (tx) => {
          await tx.hdzAgentTask.update({
            where: { id: taskId },
            data: { status: 'completed', completedAt: new Date() },
          })
          await tx.eventLog.create({
            data: {
              entityType: 'task', entityId: taskId,
              eventType: 'TASK_COMPLETED',
              payload: { agentType: task.agentType, output: task.output },
            },
          })
        })
        console.log(`[HDZ] Task ${taskId}: completed`)
        // ★ 熔断保护：成功重置失败计数
        await recordHdzSuccess(task.projectId).catch(() => {})
      }

      // ★ Enterprise Audit Trail — 记录 Agent 执行日志
      if (enterpriseCtx && updated) {
        try {
          await agentAuditService.log({
            tenantId: enterpriseCtx.tenantId,
            agentId: enterpriseCtx.agentId,
            taskId: taskId,
            action: `hdz_${task.agentType}_executed`,
            resource: 'hdz_task',
            resourceId: taskId,
            outputSummary: `agentType=${task.agentType}, status=${updated.status}`,
            durationMs: undefined,
            cost: 0,
            approvalStatus: 'auto_executed',
            metadata: { routeSource, agentType: task.agentType },
          })
        } catch (auditErr: any) {
          console.warn(`[HDZ] Audit log skipped: ${auditErr.message}`)
        }
      }

      // ★ 质量飞轮自动化
      if (updated) {
        // ⚠️ 用 input.mode 而非 output.mode：Prisma JsonValue 反序列化 output.mode 可能返回 undefined
        const rewriteMode = (task.input as any)?.mode === 'rewrite'
        if (rewriteMode) console.log(`[HDZ] Task ${taskId}: rewrite mode detected, checking input.mode=${(task.input as any)?.mode}, output.mode=${(updated.output as any)?.mode}`)
        if (task.agentType === 'writer') {
          // Writer 完成后自动触发 Reviewer 审核（rewrite 与普通模式一致——百万字流水线需要自动质量门）
          const writerChapterNo = (updated.input as any)?.chapterNo || 1
          const existingReviewer = await prisma.hdzAgentTask.findFirst({
            where: {
              projectId: task.projectId,
              agentType: 'reviewer',
              status: { in: ['queued', 'running'] },
            },
          })
          if (!existingReviewer) {
            const ch = await prisma.hdzChapter.findFirst({ where: { projectId: task.projectId, chapterNo: writerChapterNo } })
            const reviewTask = await prisma.hdzAgentTask.create({
              data: {
                projectId: task.projectId,
                agentType: 'reviewer',
                status: 'queued',
                input: { mode: 'full', chapterNo: writerChapterNo, chapterId: ch?.id },
              },
            })
            console.log(`[HDZ] Writer ch${writerChapterNo} done → auto-reviewer (task=${reviewTask.id})`)
            this.executeTask(reviewTask.id).catch(err => console.error(`[HDZ] Review task ${reviewTask.id} failed:`, err))
          }
        } else if (task.agentType === 'reviewer') {
          // Reviewer 完成后：合格（completed）→ 自动标 reviewed；
          // 不合格（waiting_approval）→ 保持等待用户审批，禁止自动短路（质量飞轮修复）
          if (updated.status === 'waiting_approval') {
            console.log(`[HDZ] Reviewer ch${(updated.input as any)?.chapterNo || 1} 未达标 → 保持 waiting_approval，等待用户审批`)
          } else {
            this.continueChain(updated).catch(err => console.error(`[HDZ] Review chain ${taskId} failed:`, err))
          }
        }
      }
    } catch (err: any) {
      console.error(`[HDZ] Task ${taskId} FAILED:`, err.message, '\n', err.stack)
      // ★ Enterprise Audit — 记录失败
      if (enterpriseCtx) {
        try {
          await agentAuditService.log({
            tenantId: enterpriseCtx.tenantId,
            agentId: enterpriseCtx.agentId,
            taskId,
            action: `hdz_${task.agentType}_failed`,
            resource: 'hdz_task',
            resourceId: taskId,
            outputSummary: err.message?.slice(0, 200),
            approvalStatus: 'auto_executed',
            metadata: { error: err.message },
          })
        } catch { /* ignore */ }
      }
      await this.failTask(taskId, err.message)
      // ★ 熔断保护：连续失败 3 次 → 暂停该项目生产
      await recordHdzFailure(task.projectId, task.agentType).catch(() => {})
    }
  }

  async handleApproval(taskId: string, action: 'approved' | 'rejected' | 'modified', note?: string, modifiedOutput?: any): Promise<void> {
    const task = await prisma.hdzAgentTask.findUnique({ where: { id: taskId } })
    if (!task || task.status !== 'waiting_approval') throw new Error('任务当前状态不可审批')

    if (action === 'rejected') {
      await prisma.$transaction(async (tx) => {
        await tx.hdzAgentTask.update({ where: { id: taskId }, data: { status: 'rejected', approvalStatus: 'rejected', approvalNote: note || '' } })
        await tx.eventLog.create({
          data: {
            entityType: 'task', entityId: taskId,
            eventType: 'TASK_REJECTED',
            payload: { approvalNote: note || '', agentType: task.agentType },
          },
        })
      })
      // ★ 拒绝 = 退回重写，带上批评意见警告 AI
      await this.continueChain(task, note, true /* isRejected */)
      return
    }

    const finalOutput = action === 'modified' && modifiedOutput ? modifiedOutput : task.output
    await prisma.$transaction(async (tx) => {
      await tx.hdzAgentTask.update({ where: { id: taskId }, data: { status: 'approved', approvalStatus: 'approved', approvalNote: note || '', output: finalOutput ?? undefined } })
      await tx.eventLog.create({
        data: {
          entityType: 'task', entityId: taskId,
          eventType: 'TASK_APPROVED',
          payload: { approvalNote: note || '', agentType: task.agentType, action },
        },
      })
    })
    // ★ 将审批意见作为 userInput 传入下一链
    await this.continueChain(task, note)
  }

  private async continueChain(completedTask: any, approvalNote?: string, isRejected = false): Promise<void> {
    console.log(`[HDZ] continueChain: agentType=${completedTask.agentType}, projectId=${completedTask.projectId}, isRejected=${isRejected}`)

    if (completedTask.agentType === 'planner') {
      if (isRejected) {
        // Planner 被拒绝 → 重写大纲，带上批评意见
        const nextTask = await prisma.hdzAgentTask.create({
          data: {
            projectId: completedTask.projectId,
            agentType: 'planner',
            status: 'queued',
            input: {
              mode: 'full',
              userInput: `【⚠️ 退回归档 — 评审意见】\n您的上一版输出被驳回，原因如下：\n${approvalNote || '质量未达标'}\n\n请认真阅读以上意见，从头重新规划，务必达到 95 分以上的顶尖网文水准。`,
            },
          },
        })
        console.log(`[HDZ] Planner rejected → rewrite (task=${nextTask.id})`)
        this.executeTask(nextTask.id).catch(err => console.error(`[HDZ] Rejected rewrite ${nextTask.id} failed:`, err))
        return
      }
      // ★ Planner 审批通过 → 找第1章，如果已有正文则不再触发 Writer
      const firstChapter = await prisma.hdzChapter.findFirst({
        where: { projectId: completedTask.projectId },
        orderBy: { chapterNo: 'asc' },
      })
      if (!firstChapter) return
      // 如果已有正文（status 非 outline），跳过自动写正文
      if (firstChapter.content && firstChapter.status !== 'outline') {
        console.log(`[HDZ] Planner done → ch${firstChapter.chapterNo} 已有正文，跳过自动 Writer`)
        return
      }
      const nextTask = await prisma.hdzAgentTask.create({
        data: { projectId: completedTask.projectId, agentType: 'writer', status: 'queued', input: { mode: 'full', chapterNo: firstChapter.chapterNo } },
      })
      console.log(`[HDZ] Planner done → Writer ch${firstChapter.chapterNo} (task=${nextTask.id})`)
      this.executeTask(nextTask.id).catch(err => console.error(`[HDZ] Chain ${nextTask.id} failed:`, err))
      return
    }

    if (completedTask.agentType === 'writer') {
      if (isRejected) {
        // Writer 被拒绝 → 重写本章，带上批评意见
        const apiNote = approvalNote || '质量未达到 95 分顶尖水准，内容质量不够好'
        const chapterNo = ((completedTask.input as any)?.chapterNo as number) || 1
        const nextTask = await prisma.hdzAgentTask.create({
          data: {
            projectId: completedTask.projectId,
            agentType: 'writer',
            status: 'queued',
            input: {
              mode: 'rewrite',
              chapterNo,
              userInput: `【⚠️ 严重警告 — 质量不达标，退回重写】\n评审意见：${apiNote}\n\n请深刻吸取教训，从头重写本章。严格要求：\n1. 字数必须达到 3500 字（±200），不足字数的输出将被再次驳回\n2. 每句话都要符合指定的大师风格，不得偏离\n3. 这是重写任务，不是润色任务——用全新的文字重新创作，确保情节紧凑、文笔精湛\n4. 目标 95 分以上，达不到不要提交`,
            },
          },
        })
        console.log(`[HDZ] Writer rejected → rewrite ch${chapterNo} (task=${nextTask.id})`)
        this.executeTask(nextTask.id).catch(err => console.error(`[HDZ] Rejected rewrite ${nextTask.id} failed:`, err))
        return
      }
      // ★ Writer 审批通过 → 更新章节状态为 reviewed
      const chapterNo = (completedTask.input as any)?.chapterNo || 1
      const writerOutput = completedTask.output as any
      await prisma.$transaction(async (tx) => {
        await tx.hdzChapter.update({
          where: { projectId_chapterNo: { projectId: completedTask.projectId, chapterNo } },
          data: { status: 'reviewed' },
        })
        await tx.eventLog.create({
          data: {
            entityType: 'chapter', entityId: `${completedTask.projectId}:${chapterNo}`,
            eventType: 'CHAPTER_STATUS_CHANGED',
            payload: { status: 'reviewed', source: 'writer_approved' },
          },
        })
      })
      console.log(`[HDZ] Writer approved → ch${chapterNo} marked reviewed`)
    }

    if (completedTask.agentType === 'reviewer') {
      // ★ Reviewer 审批处理：
      //   - 自动路径（合格 completed）→ 标记 reviewed
      //   - 用户审批「通过」（handleApproval approved）→ 标记 reviewed（source: user_approved，真实）
      //   - 用户审批「拒绝」（handleApproval rejected）→ 触发 writer 重写（带批评意见）
      const currentChapterNo = (completedTask.input as any)?.chapterNo || 1
      const reviewResult = completedTask.output as any
      const score = reviewResult?.score ?? 0
      const passScore = getReviewPassScore()

      if (isRejected) {
        // ★ 用户拒绝 → 退回重写，带上用户批评意见
        const apiNote = approvalNote || '用户对本章不满意，请重写'
        const nextTask = await prisma.hdzAgentTask.create({
          data: {
            projectId: completedTask.projectId,
            agentType: 'writer',
            status: 'queued',
            input: {
              mode: 'rewrite',
              chapterNo: currentChapterNo,
              userInput: `【⚠️ 用户拒绝 — 评审意见】\n${apiNote}\n\n请深刻吸取教训，从头重写本章。严格要求：\n1. 字数必须达到 3500 字（±200）\n2. 每句话都要符合指定的大师风格\n3. 这是重写任务，不是润色任务——用全新的文字重新创作\n4. 目标 95 分以上，达不到不要提交`,
            },
          },
        })
        console.log(`[HDZ] Reviewer rejected by user → rewrite ch${currentChapterNo} (task=${nextTask.id})`)
        this.executeTask(nextTask.id).catch(err => console.error(`[HDZ] User-rejected rewrite ${nextTask.id} failed:`, err))
        return
      }

      if (score >= passScore) {
        // ★ 自动合格 → 标记 reviewed
        await prisma.$transaction(async (tx) => {
          await tx.hdzChapter.update({
            where: { projectId_chapterNo: { projectId: completedTask.projectId, chapterNo: currentChapterNo } },
            data: { status: 'reviewed' },
          })
          await tx.eventLog.create({
            data: {
              entityType: 'chapter', entityId: `${completedTask.projectId}:${currentChapterNo}`,
              eventType: 'CHAPTER_STATUS_CHANGED',
              payload: { status: 'reviewed', source: 'reviewer_pass', score },
            },
          })
        })
        console.log(`[HDZ] Reviewer ch${currentChapterNo} PASS (${score}) → marked reviewed`)
      } else {
        // ★ 用户审批「通过」了一个未达标章节 → 用户行使最终决定权，标记 reviewed（真实 user_approved）
        await prisma.$transaction(async (tx) => {
          await tx.hdzChapter.update({
            where: { projectId_chapterNo: { projectId: completedTask.projectId, chapterNo: currentChapterNo } },
            data: { status: 'reviewed' },
          })
          await tx.eventLog.create({
            data: {
              entityType: 'chapter', entityId: `${completedTask.projectId}:${currentChapterNo}`,
              eventType: 'CHAPTER_STATUS_CHANGED',
              payload: { status: 'reviewed', source: 'user_approved', score, note: approvalNote || '' },
            },
          })
        })
        console.log(`[HDZ] User approved ch${currentChapterNo} (score ${score} < ${passScore}) → marked reviewed (real user approval)`)
      }
      return
    }
  }

  /**
   * 统计第 N 章已经写了几轮（查找已完成/等待审批的 writer 任务数量）
   */
  private async getRewriteCount(projectId: string, chapterNo: number): Promise<number> {
    const writerTasks = await prisma.hdzAgentTask.findMany({
      where: {
        projectId,
        agentType: 'writer',
        status: { in: ['completed', 'waiting_approval'] },
      },
    })
    // 统计输入中 chapterNo 与目标章节匹配的任务数
    const count = writerTasks.filter(t => {
      const input = t.input as any
      return input?.chapterNo === chapterNo
    }).length
    return count
  }

  private async failTask(taskId: string, error: string) {
    await prisma.$transaction(async (tx) => {
      await tx.hdzAgentTask.update({ where: { id: taskId }, data: { status: 'failed', output: { error } } })
      await tx.eventLog.create({
        data: {
          entityType: 'task', entityId: taskId,
          eventType: 'TASK_FAILED',
          payload: { error },
        },
      })
    })
  }
}

export const hdzOrchestrator = new HdzOrchestrator()
