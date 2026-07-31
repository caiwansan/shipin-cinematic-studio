/**
 * enterprise-agent-runtime.routes.ts — BETA-06.1 Runtime Activation API
 * 
 * 提供 Agent 激活、任务执行、状态管理三大能力
 */

import type { FastifyInstance } from 'fastify';
import { getOrganizationIdForUser } from '../services/enterprise/organization/identity-bootstrap.service.js';
import { enterpriseAgentRuntime } from '../services/enterprise/enterprise-agent-runtime.service.js';
import { entitlementService } from '../services/enterprise/enterprise-entitlement.service.js';
import { prisma } from '../utils/index.js';

/**
 * Sprint-RECRUITMENT-REALITY-02-B Task 03: agentType → businessType 统一映射
 * 招聘域三个 AI 员工（recruiter/interview/talent_analyst）统一为 'recruitment'，
 * 与 career_agent 对齐：一个业务域一个 businessType，防止模型配置串业务。
 */
const RECRUITMENT_AGENT_TYPES = ['recruiter', 'interview', 'talent_analyst', 'recruitment_consultant', 'jd_optimizer', 'talent_searcher'];

export function agentTypeToBusinessType(agentType: string): string {
  if (agentType === 'career_advisor' || agentType === 'career_agent') return 'career_agent';
  if (RECRUITMENT_AGENT_TYPES.includes(agentType)) return 'recruitment';
  return agentType;
}

export async function registerEnterpriseAgentRuntimeRoutes(app: FastifyInstance) {
  
  // 认证
  app.addHook('preHandler', app.authenticate);

  /**
   * POST /api/enterprise/agent-profiles/:id/activate
   * 激活 AI 员工：创建 Runtime Instance + 验证 BYOK
   */
  app.post('/agent-profiles/:id/activate', async (request, reply) => {
    try {
      const user = request.user as any;
      const orgId = await getOrganizationIdForUser(user?.id);
      if (!orgId) {
        return reply.status(400).send({ code: 400, message: 'ORGANIZATION_NOT_FOUND' });
      }

      const { id: profileId } = request.params as { id: string };

      // 验证 Profile 存在且属于该组织
      const profile = await prisma.enterpriseAgentProfile.findFirst({
        where: { id: profileId, organizationId: orgId }
      });
      if (!profile) {
        return reply.status(404).send({ code: 404, message: 'AGENT_PROFILE_NOT_FOUND' });
      }

      const result = await enterpriseAgentRuntime.createAndActivateAgent({
        profileId,
        tenantId: profile.tenantId,
        organizationId: orgId,
        name: profile.name,
        role: profile.role,
        agentType: profile.agentType,
        userId: user?.id,
      });

      if (!result.success) {
        const statusCode = result.error === 'NO_LLM_CONFIG' ? 422 : 500;
        return reply.status(statusCode).send({ 
          code: statusCode, 
          message: result.error,
          runtimeStatus: result.runtimeStatus 
        });
      }

      return reply.send({
        code: 0,
        data: {
          agentId: result.agentId,
          runtimeStatus: result.runtimeStatus,
        }
      });

    } catch (error: any) {
      console.error('[AgentRuntime] activate route error:', error.message);
      return reply.status(500).send({ code: 500, message: 'INTERNAL_ERROR' });
    }
  });

  /**
   * POST /api/enterprise/agent-runtime/provision
   * 开通 AI 员工：创建 EnterpriseAgentProfile + 激活 Runtime Instance
   */
  app.post('/agent-runtime/provision', async (request, reply) => {
    try {
      const user = request.user as any;
      const userId = user?.id;

      // Identity Debt: provision 用 Organization.id 写 organization_id
      // 但 GET list (enterprise-agent-profiles.ts resolveOrgId) 查询 tenant_id
      // resolveOrgId 优先级: user.tenantId(JWT) > getOrganizationIdForUser > userId
      // 所以 write 时的 tenantId 必须使用完全相同的解析逻辑
      let orgId: string | null = null;
      let governanceOrgId: string | null = null;

      if (userId) {
        // [organization_id] 从 OrgMember 获取 Organization.id
        const member = await prisma.orgMember.findFirst({
          where: { userId },
          select: { organizationId: true },
        });
        if (member?.organizationId) {
          orgId = member.organizationId;
        }

        // [tenant_id] 与 resolveOrgId 完全对齐:
        // path 1: JWT tenantId（优先）
        if (user?.tenantId && user.tenantId !== userId) {
          governanceOrgId = user.tenantId;
        }
        // path 2: getOrganizationIdForUser（DB 查询）
        if (!governanceOrgId) {
          try {
            governanceOrgId = await getOrganizationIdForUser(userId);
          } catch {}
        }
        // path 3: userId fallback
        if (!governanceOrgId) {
          governanceOrgId = userId;
        }
      }

      if (!orgId) {
        return reply.status(400).send({ code: 400, message: 'ORGANIZATION_NOT_FOUND' });
      }
      // final fallback: orgId = Organization.id
      if (!governanceOrgId) {
        governanceOrgId = orgId;
      }

      const body = request.body as {
        agentType: string;
        shortName: string;
        name: string;
      };

      if (!body.agentType || !body.shortName) {
        return reply.status(400).send({ code: 400, message: 'MISSING_REQUIRED_FIELDS' });
      }

      // 检查是否已存在同名 Profile
      const existing = await prisma.enterpriseAgentProfile.findFirst({
        where: { organizationId: orgId, name: body.name || body.shortName }
      });
      if (existing) {
        // 已存在 → 修正 tenantId 对齐 + 直接激活
        if (existing.tenantId !== governanceOrgId) {
          await prisma.enterpriseAgentProfile.update({
            where: { id: existing.id },
            data: { tenantId: governanceOrgId },
          });
          existing.tenantId = governanceOrgId;
        }
        const result = await enterpriseAgentRuntime.createAndActivateAgent({
          profileId: existing.id,
          tenantId: existing.tenantId,
          organizationId: orgId,
          name: existing.name,
          role: existing.role,
          agentType: existing.agentType,
          userId: user?.id,
        });
        if (!result.success) {
          return reply.status(422).send({ code: 422, message: result.error });
        }
        return reply.send({ code: 0, data: { agentId: result.agentId, profileId: existing.id, runtimeStatus: result.runtimeStatus } });
      }

      // 创建新的 Profile
      const tenantId = governanceOrgId
      const role = body.agentType === 'talent_analyst' ? '人才分析师'
        : body.agentType === 'recruiter' ? '招聘经理'
        : body.agentType === 'interview' ? '面试官'
        : 'AI 员工'

      const profile = await prisma.enterpriseAgentProfile.create({
        data: {
          organization: { connect: { id: orgId } },
          tenantId,
          name: body.name || body.shortName,
          role,
          agentType: body.agentType,
          description: `AI ${role} — ${body.shortName}`,
          status: 'active',
        }
      });

      // 激活 Runtime
      const result = await enterpriseAgentRuntime.createAndActivateAgent({
        profileId: profile.id,
        tenantId,
        organizationId: orgId,
        name: profile.name,
        role: profile.role,
        agentType: profile.agentType,
        userId: user?.id,
      });

      if (!result.success) {
        // 创建成功但激活失败 — 返回部分成功
        return reply.status(422).send({ code: 422, message: result.error, data: { profileId: profile.id } });
      }

      return reply.send({
        code: 0,
        data: {
          agentId: result.agentId,
          profileId: profile.id,
          runtimeStatus: result.runtimeStatus,
        }
      });

    } catch (error: any) {
      console.error('[AgentRuntime] provision route error:', error.message);
      return reply.status(500).send({ code: 500, message: 'INTERNAL_ERROR', detail: error.message });
    }
  });

  /**
   * POST /api/enterprise/agent-tasks
   * 创建并执行任务（同步返回结果）
   */
  app.post('/agent-tasks', async (request, reply) => {
    try {
      const user = request.user as any;
      const orgId = await getOrganizationIdForUser(user?.id);
      if (!orgId) {
        return reply.status(400).send({ code: 400, message: 'ORGANIZATION_NOT_FOUND' });
      }

      const body = request.body as {
        agentId: string;       // EnterpriseAgentProfile.id
        instruction: string;
        taskType?: string;
      };

      if (!body.agentId || !body.instruction) {
        return reply.status(400).send({ code: 400, message: 'MISSING_REQUIRED_FIELDS' });
      }

      // 验证 Agent 存在
      const profile = await prisma.enterpriseAgentProfile.findFirst({
        where: { id: body.agentId, organizationId: orgId }
      });
      if (!profile) {
        return reply.status(404).send({ code: 404, message: 'AGENT_NOT_FOUND' });
      }

      // 检查 Agent 是否 active
      const instance = await prisma.enterpriseAgentInstance.findUnique({
        where: { employeeId: body.agentId }
      });
      if (!instance || instance.runtimeStatus !== 'active') {
        return reply.status(422).send({ code: 422, message: 'AGENT_NOT_ACTIVATED' });
      }

      // 创建 Task 记录（只用模型中存在的字段）
      const task = await prisma.enterpriseAgentTask.create({
        data: {
          tenantId: profile.tenantId,
          agentInstanceId: instance.id,
          taskType: body.taskType || 'general',
          inputSummary: body.instruction.slice(0, 500),
          status: 'running',
          startedAt: new Date(),
        }
      });

      // Sprint-09E-04.5B + Sprint-RECRUITMENT-REALITY-02-B Task 03: businessType 统一映射
      // career_advisor → 'career_agent'（用户 BYOK 身份隔离）
      // recruiter / interview / talent_analyst 等招聘域 → 'recruitment'（业务域统一标识）
      // 其它 agentType → 保留原始类型
      const careerAgentBizType = agentTypeToBusinessType(profile.agentType)

      // 执行（真实 LLM 调用）
      const result = await enterpriseAgentRuntime.executeTask({
        taskId: task.id,
        profileId: body.agentId,
        tenantId: profile.tenantId,
        organizationId: orgId,
        userId: user?.id,
        taskType: body.taskType || 'general',
        instruction: body.instruction,
        businessType: careerAgentBizType,
      });

      if (!result.success) {
        return reply.status(500).send({
          code: 500,
          message: result.error || 'EXECUTION_FAILED',
          data: { taskId: task.id, status: 'failed' }
        });
      }

      return reply.send({
        code: 0,
        data: {
          taskId: task.id,
          status: 'completed',
          output: result.output,
          tokenInput: result.tokenInput,
          tokenOutput: result.tokenOutput,
          cost: result.cost,
          durationMs: result.durationMs,
        }
      });

    } catch (error: any) {
      console.error('[AgentRuntime] execute route error:', error.message);
      return reply.status(500).send({ code: 500, message: 'INTERNAL_ERROR' });
    }
  });

  /**
   * GET /api/enterprise/agent-profiles/:id/status
   * 获取 Agent 完整状态（Profile + Instance + Audit）
   */
  app.get('/agent-profiles/:id/status', async (request, reply) => {
    try {
      const user = request.user as any;
      const orgId = await getOrganizationIdForUser(user?.id);
      if (!orgId) {
        return reply.status(400).send({ code: 400, message: 'ORGANIZATION_NOT_FOUND' });
      }

      const { id: profileId } = request.params as { id: string };

      const status = await enterpriseAgentRuntime.getAgentStatus(profileId);
      if (!status) {
        return reply.status(404).send({ code: 404, message: 'AGENT_NOT_FOUND' });
      }

      return reply.send({ code: 0, data: status });

    } catch (error: any) {
      console.error('[AgentRuntime] status route error:', error.message);
      return reply.status(500).send({ code: 500, message: 'INTERNAL_ERROR' });
    }
  });

  /**
   * POST /api/enterprise/agent-profiles/:id/pause
   */
  app.post('/agent-profiles/:id/pause', async (request, reply) => {
    try {
      const { id: profileId } = request.params as { id: string };
      const success = await enterpriseAgentRuntime.pauseAgent(profileId);
      
      if (!success) {
        return reply.status(500).send({ code: 500, message: 'PAUSE_FAILED' });
      }

      return reply.send({ code: 0, data: { runtimeStatus: 'paused' } });

    } catch (error: any) {
      return reply.status(500).send({ code: 500, message: 'INTERNAL_ERROR' });
    }
  });

  /**
   * POST /api/enterprise/agent-profiles/:id/resume
   */
  app.post('/agent-profiles/:id/resume', async (request, reply) => {
    try {
      const { id: profileId } = request.params as { id: string };
      const success = await enterpriseAgentRuntime.resumeAgent(profileId);
      
      if (!success) {
        return reply.status(500).send({ code: 500, message: 'RESUME_FAILED' });
      }

      return reply.send({ code: 0, data: { runtimeStatus: 'active' } });

    } catch (error: any) {
      return reply.status(500).send({ code: 500, message: 'INTERNAL_ERROR' });
    }
  });

  // ─── Hardening-01: Startup Recovery Endpoint ───

  /**
   * POST /api/enterprise/agent-runtime/startup-recovery
   * 手动触发启动恢复（用于运维场景）
   */
  app.post('/agent-runtime/startup-recovery', async (request, reply) => {
    try {
      const result = await enterpriseAgentRuntime.startupRecovery()
      return reply.send({ code: 0, data: result })
    } catch (error: any) {
      return reply.status(500).send({ code: 500, message: 'RECOVERY_FAILED', detail: error.message })
    }
  })

  /**
   * GET /api/enterprise/agent-runtime/status
   * 获取 Runtime 整体状态（所有 Agent 的生命周期汇总）
   */
  app.get('/agent-runtime/status', async (request, reply) => {
    try {
      const user = request.user as any
      const orgId = await getOrganizationIdForUser(user?.id)
      if (!orgId) {
        return reply.status(400).send({ code: 400, message: 'ORGANIZATION_NOT_FOUND' })
      }

      const emergencyStatus = await enterpriseAgentRuntime.getEmergencyStatus(orgId)
      return reply.send({ code: 0, data: emergencyStatus })
    } catch (error: any) {
      return reply.status(500).send({ code: 500, message: 'INTERNAL_ERROR' })
    }
  })

  /**
   * POST /api/enterprise/agent-profiles/:id/stop
   * 停止 Agent（→ STOPPED）
   */
  app.post('/agent-profiles/:id/stop', async (request, reply) => {
    try {
      const { id: profileId } = request.params as { id: string }
      const success = await enterpriseAgentRuntime.stopAgent(profileId)
      if (!success) {
        return reply.status(500).send({ code: 500, message: 'STOP_FAILED' })
      }
      return reply.send({ code: 0, data: { lifecycleState: 'STOPPED' } })
    } catch (error: any) {
      return reply.status(500).send({ code: 500, message: 'INTERNAL_ERROR' })
    }
  })

  /**
   * GET /api/enterprise/agent-tasks
   * 获取组织的所有任务列表
   */
  /**
   * GET /api/enterprise/agent-tasks/:taskId/timeline
   * 获取任务执行时间线（真实事件）
   */
  app.get('/agent-tasks/:taskId/timeline', async (request, reply) => {
    try {
      const user = request.user as any;
      const orgId = await getOrganizationIdForUser(user?.id);
      if (!orgId) {
        return reply.status(400).send({ code: 400, message: 'ORGANIZATION_NOT_FOUND' });
      }

      const { taskId } = request.params as { taskId: string };

      // 验证 task 属于该组织
      const task = await prisma.enterpriseAgentTask.findFirst({
        where: { id: taskId, tenantId: orgId },
        select: { id: true },
      });
      if (!task) {
        return reply.status(404).send({ code: 404, message: 'TASK_NOT_FOUND' });
      }

      // 获取审计事件（时间线）
      const events = await prisma.agentAuditTrail.findMany({
        where: { taskId },
        orderBy: { createdAt: 'asc' },
        select: {
          id: true,
          action: true,
          resource: true,
          resourceId: true,
          tokenUsage: true,
          durationMs: true,
          createdAt: true,
          metadata: true,
        },
      });

      // 格式化时间线事件
      const timeline = events.map((e: any) => ({
        id: e.id,
        action: e.action,
        resource: e.resource,
        resourceId: e.resourceId,
        tokenUsage: e.tokenUsage,
        durationMs: e.durationMs,
        timestamp: e.createdAt,
        metadata: e.metadata ? (typeof e.metadata === 'string' ? JSON.parse(e.metadata) : e.metadata) : {},
      }));

      return reply.send({ code: 0, data: timeline });
    } catch (error: any) {
      request.log.error('GET /agent-tasks/:taskId/timeline error: ' + error.message);
      return reply.status(500).send({ code: 500, message: 'INTERNAL_ERROR' });
    }
  });

  // ─── BETA-06.4: AI 新媒体运营部门 API ───

  /**
   * GET /api/enterprise/media-department/employees
   * 获取组织的所有 AI 员工
   */
  app.get('/media-department/employees', async (request, reply) => {
    try {
      const user = request.user as any
      const orgId = await getOrganizationIdForUser(user?.id)
      if (!orgId) {
        return reply.status(400).send({ code: 400, message: 'ORGANIZATION_NOT_FOUND' })
      }

      const profiles = await prisma.enterpriseAgentProfile.findMany({
        where: { organizationId: orgId },
        select: {
          id: true, name: true, role: true, agentType: true,
          status: true, lastExecutionAt: true, createdAt: true,
        },
        orderBy: { createdAt: 'asc' },
      })

      const instances = await prisma.enterpriseAgentInstance.findMany({
        where: { tenantId: orgId },
        select: { employeeId: true, agentId: true, runtimeStatus: true, lifecycleState: true, totalTasks: true, lastRecoveredAt: true },
      })
      const instanceMap = new Map(instances.map(i => [i.employeeId, i]))

      const employees = profiles.map((p: any) => {
        const inst = instanceMap.get(p.id)
        return {
          id: p.id,
          name: p.name,
          role: p.role,
          agentType: p.agentType,
          status: p.status,
          runtimeStatus: p.runtimeStatus,
          lifecycleState: inst?.lifecycleState || 'ACTIVE',
          totalTasks: inst?.totalTasks || 0,
          lastRecoveredAt: inst?.lastRecoveredAt,
          lastExecutionAt: p.lastExecutionAt,
          createdAt: p.createdAt,
        }
      })

      return reply.send({ code: 0, data: employees })
    } catch (error: any) {
      return reply.status(500).send({ code: 500, message: 'INTERNAL_ERROR' })
    }
  })

  /**
   * POST /api/enterprise/media-department/employees
   * 创建 AI 员工（含岗位类型）
   */
  app.post('/media-department/employees', async (request, reply) => {
    try {
      const user = request.user as any
      const orgId = await getOrganizationIdForUser(user?.id)
      if (!orgId) {
        return reply.status(400).send({ code: 400, message: 'ORGANIZATION_NOT_FOUND' })
      }

      const body = request.body as {
        name: string
        role: string
        agentType: string
        goal?: string
        knowledge?: string[]
        memory?: string[]
      }

      if (!body.name || !body.agentType) {
        return reply.status(400).send({ code: 400, message: 'MISSING_REQUIRED_FIELDS' })
      }

      // 验证 agentType 合法
      const validAgentTypes = ['director', 'hotspot_analyst', 'content_creator', 'content_reviewer', 'sales', 'support', 'data_analyst']
      if (!validAgentTypes.includes(body.agentType)) {
        return reply.status(400).send({ code: 400, message: 'INVALID_AGENT_TYPE' })
      }

      // Sprint-03: Entitlement 检查 — 创建 Agent 前验证套餐限额
      const check = await entitlementService.checkAgentCapability(orgId)
      if (!check.allowed) {
        return reply.status(403).send({
          code: 403,
          message: 'AGENT_LIMIT_REACHED',
          detail: check.reason,
          current: check.current,
          limit: check.limit,
        })
      }

      // 创建 Profile
      const profile = await prisma.enterpriseAgentProfile.create({
        data: {
          tenantId: orgId,
          organizationId: orgId,
          name: body.name,
          role: body.role || body.agentType,
          agentType: body.agentType,
          goal: body.goal || '',
          knowledgeScope: JSON.stringify(body.knowledge || []),
          status: 'active',
        },
      })

      return reply.send({
        code: 0,
        data: {
          id: profile.id,
          name: profile.name,
          agentType: profile.agentType,
        }
      })
    } catch (error: any) {
      return reply.status(500).send({ code: 500, message: 'INTERNAL_ERROR' })
    }
  })

  /**
   * POST /api/enterprise/media-department/emergency-stop
   * 紧急停止全部 AI 操作
   */
  app.post('/media-department/emergency-stop', async (request, reply) => {
    try {
      const user = request.user as any
      const orgId = await getOrganizationIdForUser(user?.id)
      if (!orgId) {
        return reply.status(400).send({ code: 400, message: 'ORGANIZATION_NOT_FOUND' })
      }

      const count = await enterpriseAgentRuntime.emergencyStopAll(orgId)
      return reply.send({ code: 0, data: { stopped: count, emergencyActive: true } })
    } catch (error: any) {
      return reply.status(500).send({ code: 500, message: 'INTERNAL_ERROR' })
    }
  })

  /**
   * POST /api/enterprise/media-department/emergency-resume
   * 解除紧急停止
   */
  app.post('/media-department/emergency-resume', async (request, reply) => {
    try {
      const user = request.user as any
      const orgId = await getOrganizationIdForUser(user?.id)
      if (!orgId) {
        return reply.status(400).send({ code: 400, message: 'ORGANIZATION_NOT_FOUND' })
      }

      const count = await enterpriseAgentRuntime.emergencyResumeAll(orgId)
      return reply.send({ code: 0, data: { resumed: count, emergencyActive: false } })
    } catch (error: any) {
      return reply.status(500).send({ code: 500, message: 'INTERNAL_ERROR' })
    }
  })

  /**
   * GET /api/enterprise/media-department/emergency-status
   * 获取紧急停止状态
   */
  app.get('/media-department/emergency-status', async (request, reply) => {
    try {
      const user = request.user as any
      const orgId = await getOrganizationIdForUser(user?.id)
      if (!orgId) {
        return reply.status(400).send({ code: 400, message: 'ORGANIZATION_NOT_FOUND' })
      }

      const status = await enterpriseAgentRuntime.getEmergencyStatus(orgId)
      return reply.send({ code: 0, data: status })
    } catch (error: any) {
      return reply.status(500).send({ code: 500, message: 'INTERNAL_ERROR' })
    }
  })

  app.get('/agent-tasks', async (request, reply) => {
    try {
      const user = request.user as any;
      const orgId = await getOrganizationIdForUser(user?.id);
      if (!orgId) {
        return reply.status(400).send({ code: 400, message: 'ORGANIZATION_NOT_FOUND' });
      }

      // 查询该组织的所有任务
      const tasks = await prisma.enterpriseAgentTask.findMany({
        where: { tenantId: orgId },
        orderBy: { startedAt: 'desc' },
        take: 50,
      });

      // 查询 Agent Instance + Profile 信息
      const instances = await prisma.enterpriseAgentInstance.findMany({
        where: { tenantId: orgId },
        select: { id: true, agentId: true, employeeId: true },
      });
      const profiles = await prisma.enterpriseAgentProfile.findMany({
        where: { organizationId: orgId },
        select: { id: true, name: true, role: true },
      });
      const profileMap = new Map<string, any>()
      profiles.forEach(p => profileMap.set(p.id, p))

      const instanceByTaskId = new Map<string, any>()
      instances.forEach(i => {
        (i as any).prof = profileMap.get(i.employeeId)
        instanceByTaskId.set(i.id, i)
      })

      // 查询 Outcome（通过 decisionId 关联任务）
      const outcomes = await prisma.enterpriseOutcome.findMany({
        where: { tenantId: orgId },
        select: { id: true, actionId: true },
      });
      const actions = await prisma.enterpriseAction.findMany({
        where: { tenantId: orgId },
        select: { id: true, decisionId: true },
      });
      const actionByDecisionId = new Map<string, string>()
      actions.forEach(a => { if (a.decisionId) actionByDecisionId.set(a.decisionId, a.id) })
      const outcomeByActionId = new Map<string, string>()
      outcomes.forEach(o => { if (o.actionId) outcomeByActionId.set(o.actionId, o.id) })

      // 组装响应
      const enrichedTasks = tasks.map((t: any) => {
        const inst = instanceByTaskId.get(t.agentInstanceId)
        const decisionId = `dec_${t.id.slice(0, 8)}`
        const actionId = actionByDecisionId.get(decisionId)
        const outcomeId = actionId ? outcomeByActionId.get(actionId) : null
        return {
          id: t.id,
          tenantId: t.tenantId,
          agentInstanceId: t.agentInstanceId,
          agentName: (inst as any)?.prof?.name || 'AI',
          agentRole: (inst as any)?.prof?.role || '',
          agentId: inst?.agentId || '',
          taskType: t.taskType,
          inputSummary: t.inputSummary || '',
          outputSummary: t.outputSummary || '',
          status: t.status,
          tokenInput: t.tokenInput,
          tokenOutput: t.tokenOutput,
          cost: t.cost,
          durationMs: t.durationMs,
          startedAt: t.startedAt,
          completedAt: t.completedAt,
          outcomeId: outcomeId || null,
          actionId: actionId || null,
        }
      })

      return reply.send({ code: 0, data: enrichedTasks })

    } catch (error: any) {
      request.log.error('GET /agent-tasks error: ' + (error.message || JSON.stringify(error)));
      return reply.status(500).send({ code: 500, message: 'INTERNAL_ERROR', detail: error.message });
    }
  });
}
