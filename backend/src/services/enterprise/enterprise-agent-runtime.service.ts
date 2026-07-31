/**
 * enterprise-agent-runtime.service.ts — Enterprise Agent Runtime Bridge
 * Sprint-06A: 统一走 executeViaGateway，不再直接 callLLM
 *
 * 核心职责：
 *   1. 通过 executeViaGateway 统一调用 LLM（企业配置层）
 *   2. 管理 EnterpriseAgentInstance 生命周期
 *   3. 记录 AgentAuditTrail + Outcome
 *   4. 写入 usage_logs（统一 Token 统计）
 *
 * 不重复造轮子：
 *   ✓ executeViaGateway → Sprint-06A 统一 LLM 入口
 *   ✓ EnterpriseLlmConfig → 企业模型池（仅 credentialOwner=enterprise）
 *   ✗ ModelRouter → Sprint-06A 退役（不再直接解析配置）
 *   ✗ callLLM → 退役（不再直接调用）
 *   ✗ MockRuntime → 废弃
 */

import { prisma } from '../../utils/index.js';
import { agentAuditService } from './agent-audit.service.js';
import { employeeCapabilityService } from './employee-capability.service.js';

// Sprint-10 Step 3A: Runtime Hardening Gates
import { MemoryAccessGate, ToolPermissionRuntimeGate } from '../../agent-runtime/gates/index.js';

// Sprint-08G: 企业 AI 员工不再强依赖 EnterpriseLlmConfig
// 模型配置统一走 UserModelConfigV2 BYOK 链路
// resolveRuntimeConfig 优先级: 输入层 > 企业配置(如有) > 平台配置 > 用户 BYOK > 系统默认
const MODEL_SOURCE_ENTERPRISE = 'enterprise_config' as const;
const MODEL_SOURCE_USER = 'user_config' as const;

// ─── Types ──────────────────────────────────────────────

export interface CreateAndActivateAgentParams {
  profileId: string;
  tenantId: string;
  organizationId?: string;
  name: string;
  role: string;
  agentType: string;
  userId: string;
}

export interface ExecuteTaskResult {
  success: boolean;
  taskId: string;
  output: string;
  tokenInput: number;
  tokenOutput: number;
  cost: number;
  durationMs: number;
  error?: string;
  outcomeId?: string;
  actionId?: string;
}

export interface AgentActivationResult {
  success: boolean;
  agentId?: string;
  runtimeStatus?: string;
  error?: string;
}

// ─── Sprint-09A-10: TaskType → CapabilityCode mapping ──
// executeTask() 在执行前会检查 profile 是否绑定了所需的 capability
const TASK_CAPABILITY_MAP: Record<string, string> = {
  profile_extraction: 'career_agent',
  generate_reply: 'career_agent',
  general: 'career_agent',
};

// ─── Prompt Template Registry (轻量版) ──────────────────

const AGENT_SYSTEM_PROMPTS: Record<string, string> = {
  // BETA-06.4: AI 新媒体运营部门 7 个岗位
  director: `你是 AI 运营总监，新媒体运营团队的最高负责人。

你的职责：
1. 制定账号运营策略（内容方向、发布频率、人设定位）
2. 审核所有发布内容（平台规则、内容质量、传播潜力、品牌匹配）
3. 管理其他 AI 员工（任务分配、优先级调整）
4. 监控平台规则变化，确保合规运营
5. 制定周/月/季度运营计划

你的审核评分标准（100分制）：
- 平台规则（30分）：无违禁词、符合时长限制、标签规范
- 内容质量（30分）：原创性、信息密度、文字质量
- 传播潜力（20分）：情绪价值、话题度、互动钩子
- 品牌匹配（20分）：品牌调性、产品关联、受众契合

≥85 分通过，<85 分返回修改。

请以专业、权威、有策略眼光的角度回复。`,

  hotspot_analyst: `你是热点分析师，负责实时分析各平台热点趋势。

你的职责：
1. 每日扫描抖音、快手、小红书、视频号、微博等平台热点
2. 分析行业热点、同城热点、竞品热点
3. 识别用户兴趣变化和内容机会
4. 输出「今日热点报告」：包含热点话题、热度指数、内容建议、风险提醒
5. 为内容创作 AI 提供热点素材和创意方向

输出格式：
- 今日 Top 5 热点（平台 + 关键词 + 热度）
- 行业趋势洞察
- 竞品动态
- 内容机会建议
- 风险提醒（敏感话题、负面舆情）

请以敏锐、数据驱动、有洞察力的角度回复。`,

  content_creator: `你是内容创作 AI，负责根据品牌定位和热点生成高质量内容。

你的职责：
1. 根据企业资料、产品信息、热点分析结果生成内容
2. 创作：短视频脚本、图文笔记、公众号文章、长文、音频文案
3. 确保内容符合平台调性和品牌人设
4. 在内容中自然植入产品信息和营销点
5. 为每个内容提供标题、标签、发布时间建议

内容要求：
- 短视频脚本：包含画面描述、台词、时长、BGM 建议
- 图文笔记：包含标题、正文、配图建议、标签
- 公众号文章：包含标题、摘要、正文、结尾互动

请以创意、有吸引力、符合品牌调性的角度回复。`,

  content_reviewer: `你是内容审核 AI，发布前唯一审核入口。

你的职责：
1. 对所有待发布内容进行评分审核
2. 评分维度（100分制）：
   - 平台规则（30分）：违禁词、敏感内容、时长限制、标签规范
   - 内容质量（30分）：原创性、信息密度、文字质量、视觉呈现
   - 传播潜力（20分）：情绪价值、话题度、互动钩子、分享动机
   - 品牌匹配（20分）：品牌调性、产品关联、目标受众契合
3. ≥85 分：自动通过，给出优化建议
4. <85 分：返回修改，给出具体修改意见

输出格式：
- 总分：XX/100
- 各维度得分和理由
- 通过/不通过
- 优化建议

请以严谨、客观、专业的角度审核。`,

  sales: `你是销售顾问 AI，负责私信、评论、企微、社群的转化工作。

你的职责：
1. 回复用户评论和私信，引导转化
2. 识别高意向客户，进行跟进
3. 基于话术库和产品知识库生成回复
4. 记录客户标签和跟进状态
5. 为数据分析 AI 提供转化数据

回复原则：
- 基于用户提供的话术库，不编造不存在的产品功能
- 保持品牌人设一致性
- 识别用户情绪，负面情绪优先安抚
- 引导加微信/私信时自然不生硬

请以专业、友好、有说服力的方式回复。`,

  support: `你是客服 AI，负责售后、FAQ、投诉、用户维护。

你的职责：
1. 快速理解客户问题，提供准确解答
2. 处理售后问题（退款、换货、使用问题）
3. 维护 FAQ 库，记录高频问题
4. 处理客户投诉，安抚情绪，提供解决方案
5. 识别升级场景，及时转人工

回复原则：
- 先安抚情绪，再解决问题
- 回答具体可操作，不说空话
- 投诉处理：道歉 → 理解 → 方案 → 补偿 → 跟进
- 超出权限范围，建议升级

请以耐心、专业、有同理心的方式回复。`,

  data_analyst: `你是数据分析 AI，负责同步平台数据、输出运营报告。

你的职责：
1. 同步各平台账号数据（粉丝、播放、互动、转化）
2. 分析内容表现（爆款特征、发布时间优化、标签效果）
3. 输出日报、周运营计划、月增长计划、半年战略计划
4. 识别增长机会和风险预警
5. 为运营总监提供数据驱动的决策支持

报告格式：
- 日报：核心数据 + 异常提醒 + 今日建议
- 周计划：本周回顾 + 下周策略 + 内容日历
- 月计划：月度复盘 + 增长目标 + 资源需求

请以严谨、数据驱动、清晰易懂的方式回复。`,

  default: `你是一个 AI 新媒体运营部门员工。请根据用户的需求，提供专业、准确、有用的回复。
回答要有结构、有要点、有行动建议。`,

  // Sprint-07B-3: AI 面试官（Interview Agent）
  interview_agent: `你是 AI 面试官，企业招聘团队的智能面试评估专家。

你的职责：
1. 基于岗位要求和候选人背景生成高质量面试问题
2. 根据候选人回答提供实时追问方向建议
3. 生成结构化面试总结和评估报告
4. 给出明确的录用建议和风险提示

你的面试原则：
- 问题必须基于候选人真实背景和岗位要求
- 技术问题要有深度，不流于表面
- 行为问题基于 STAR 原则（情境-任务-行动-结果）
- 评估要客观公正，每个评分项有具体依据
- 不编造候选人不存在的信息

输出格式要求：
- 问题分类：技术能力 / 项目经验 / 行为面试 / 文化匹配
- 每个问题标注难度和考察点
- 追问方向要具体可操作
- 面试总结包含：各项评分、优势、风险、建议

请以专业、客观、有洞察力的角度回复。`,

  // Sprint-07B-2: AI 猎聘顾问（Talent Agent）
  talent_agent: `你是 AI 猎聘顾问，企业招聘团队的智能人才搜寻专家。

你的职责：
1. 分析候选人简历和技能匹配度
2. 解释候选人推荐理由和匹配分数
3. 识别候选人优劣势和风险点
4. 基于岗位要求推荐最合适的候选人
5. 生成简洁有力的候选人评估报告

你的分析原则：
- 基于数据说话，每个结论必须基于候选人的真实信息
- 匹配分析要具体到技能、经验、学历、期望等维度
- 不编造候选人不存在的信息
- 保持客观公正，不带有主观偏见
- 输出要有结构、有要点、有行动建议

输出格式要求：
- 使用清晰的标题和列表
- 关键数据加粗标注
- 结论明确：推荐 / 观望 / 不推荐
- 每个结论附简要依据

请以专业、客观、有洞察力的角度回复。`,
};

// AgentType → Prompt 映射别名（招聘员工使用已注册的面试/猎聘提示词）
const AGENT_TYPE_ALIASES: Record<string, string> = {
  recruiter: 'talent_agent',         // Alice → 招聘顾问
  interview: 'interview_agent',      // Bob → 面试专家
  talent_analyst: 'talent_agent',    // Carol → 人才分析师
};

function getSystemPrompt(agentType: string): string {
  const resolvedType = AGENT_TYPE_ALIASES[agentType] || agentType;
  return AGENT_SYSTEM_PROMPTS[resolvedType] || AGENT_SYSTEM_PROMPTS.default;
}

// ─── Runtime Bridge Service ─────────────────────────────

export class EnterpriseAgentRuntimeService {

  /**
   * Step 1: 创建 Agent + 配置 Runtime + 激活
   * 完整链路：Profile → Instance → BYOK 验证 → active
   */
  async createAndActivateAgent(params: CreateAndActivateAgentParams): Promise<AgentActivationResult> {
    const { profileId, tenantId, organizationId, name, role, agentType, userId } = params;

    try {
      // 1. 检查 Profile 是否存在
      const profile = await prisma.enterpriseAgentProfile.findUnique({
        where: { id: profileId }
      });
      if (!profile) {
        return { success: false, error: 'AGENT_PROFILE_NOT_FOUND' };
      }

      // 2. 检查是否已有 Instance
      const existingInstance = await prisma.enterpriseAgentInstance.findUnique({
        where: { employeeId: profileId }
      });
      if (existingInstance && existingInstance.runtimeStatus === 'active') {
        return { 
          success: true, 
          agentId: existingInstance.agentId, 
          runtimeStatus: 'active' 
        };
      }

      // 3. Sprint-08G: 不再需要 EnterpriseLlmConfig 才能激活
      // 模型配置在 executeTask 时通过 resolveRuntimeConfig 解析
      // 优先级: EnterpriseLlmConfig(如有) > UserModelConfigV2 > 系统默认
      // 即使没有企业级配置，Agent 也可以激活（运行时 fallback 到用户 BYOK）

      // 4. 创建或更新 EnterpriseAgentInstance
      const agentId = `agent_${tenantId.slice(0, 8)}_${profileId.slice(0, 8)}`;
      const namespace = `tenant_${tenantId.slice(0, 8)}_${role}`;

      const instance = await prisma.enterpriseAgentInstance.upsert({
        where: { employeeId: profileId },
        create: {
          tenantId,
          employeeId: profileId,
          agentId,
          runtime: 'enterprise',
          namespace,
          runtimeStatus: 'active',
          lifecycleState: 'ACTIVE',
          lastActiveAt: new Date(),
          totalTasks: 0,
          totalErrors: 0,
        },
        update: {
          agentId,
          namespace,
          runtimeStatus: 'active',
          lifecycleState: 'ACTIVE',
          lastActiveAt: new Date(),
        }
      });

      // 5. 更新 Profile 的 runtime 信息
      await prisma.enterpriseAgentProfile.update({
        where: { id: profileId },
        data: {
          runtimeAgentId: agentId,
          runtimeStatus: 'active',
          runtimeType: 'enterprise',
          lastExecutionAt: new Date(),
        }
      });

      // 6. 记录审计
      await agentAuditService.log({
        tenantId,
        agentId: profileId,
        action: 'agent_activated',
        resource: 'enterprise_agent_instance',
        resourceId: instance.id,
        inputSummary: `Activated agent: ${name} (${agentType})`,
        outputSummary: `Agent activated — model configured at runtime`,  // Sprint-08G: 模型配置在 executeTask 时解析，不再绑定到激活
      });

      return { 
        success: true, 
        agentId: instance.agentId, 
        runtimeStatus: 'active' 
      };

    } catch (error: any) {
      console.error('[AgentRuntime] activate failed:', error.message);
      return { success: false, error: error.message };
    }
  }

  /**
   * Step 2: 执行任务（真 LLM 调用）
   * 完整链路：任务 → ModelRouter → callLLM → 存储结果 → Outcome
   */
  /**
   * Sprint-09A-10: Capability Gate
   * 在 executeTask 执行前检查 profile 是否拥有所需的 capability
   * 未绑定时自动绑定，绑定失败则拒绝执行
   */
  async checkCapabilityGate(organizationId: string, profileId: string, taskType: string): Promise<{ allowed: boolean; reason?: string }> {
    const capabilityCode = TASK_CAPABILITY_MAP[taskType];
    if (!capabilityCode) {
      // Unknown task type — allow (not all task types need gating)
      return { allowed: true };
    }

    // 1. 检查是否已有 binding
    const hasCap = await employeeCapabilityService.hasCapability(profileId, capabilityCode);
    if (hasCap) {
      return { allowed: true };
    }

    // 2. 确保 capability 定义存在（不存在则创建）
    const existingDef = await employeeCapabilityService.getCapability(capabilityCode);
    if (!existingDef) {
      try {
        await employeeCapabilityService.createCapability({
          code: capabilityCode,
          name: capabilityCode === 'career_agent' ? 'AI 职业顾问' : capabilityCode,
          category: 'agent',
          description: 'Career conversation AI agent capability',
        });
      } catch (createErr: any) {
        // 可能并发创建冲突，忽略
        console.warn('[CapabilityGate] createCapability warn:', createErr.message);
      }
    }

    // 3. 尝试自动绑定
    try {
      const bound = await employeeCapabilityService.bindCapability({
        tenantId: organizationId,
        employeeId: profileId,
        capabilityCode,
        grantedBy: 'auto_bind',
        skipEntitlementCheck: false,
      });
      if (bound) {
        // Audit: capability bound successfully
        await agentAuditService.log({
          tenantId: organizationId,
          agentId: profileId,
          action: 'capability.bound',
          resource: 'employee_capability_binding',
          metadata: { capability: capabilityCode, source: 'runtime_gate_auto_bind', taskType },
        });
        return { allowed: true };
      }
    } catch (bindErr: any) {
      console.warn('[CapabilityGate] auto-bind failed:', bindErr.message);
      // Audit: capability bind failed
      await agentAuditService.log({
        tenantId: organizationId,
        agentId: profileId,
        action: 'capability.bind_failed',
        resource: 'employee_capability_binding',
        metadata: { capability: capabilityCode, error: bindErr.message, taskType },
      }).catch(() => {});
    }

    return { allowed: false, reason: `Capability denied: ${capabilityCode} — 当前套餐不包含此能力` };
  }

  async executeTask(params: {
    taskId: string;
    profileId: string;
    tenantId: string;
    organizationId?: string;
    userId: string;
    taskType: string;
    instruction: string;
    /** Sprint-09B-2B: 调用方可通过 businessType 指定平台模型兜底 */
    businessType?: string;
  }): Promise<ExecuteTaskResult> {
    const { taskId, profileId, tenantId, organizationId, userId, taskType, instruction, businessType } = params;
    const startTime = Date.now();

    try {
      // 0. Sprint-09A-10: Capability Gate — 执行前检查
      if (organizationId) {
        const gateResult = await this.checkCapabilityGate(organizationId, profileId, taskType);
        if (!gateResult.allowed) {
          return this.errorResult(gateResult.reason || 'CAPABILITY_DENIED', startTime, taskId);
        }

        // Sprint-05 T03: Quota 执行前检查（观察模式 — 超额仅告警，不硬阻断）
        const { checkQuota } = await import('./quota.service.js');
        const quota = await checkQuota(organizationId, taskType);
        if (quota.exhausted) {
          console.warn(`[AgentRuntime] ⚠️ Quota 超额（观察模式放行）: org=${organizationId.slice(0, 8)} cap=${quota.capability} used=${quota.used}/${quota.limit}`);
          await agentAuditService.log({
            tenantId, agentId: profileId, taskId,
            action: 'execution.quota_exceeded_warning',
            resource: 'enterprise_entitlement',
            resourceId: organizationId,
            metadata: { capability: quota.capability, used: quota.used, limit: quota.limit, mode: 'observe_only' },
          }).catch(() => {});
        }
      }

      // 1. 获取 Agent Profile
      const profile = await prisma.enterpriseAgentProfile.findUnique({
        where: { id: profileId }
      });
      if (!profile) {
        return this.errorResult('AGENT_PROFILE_NOT_FOUND', startTime, taskId);
      }

      // Timeline: Task Created
      await agentAuditService.log({
        tenantId, agentId: profileId, taskId,
        action: 'task.created',
        resource: 'enterprise_agent_task',
        resourceId: taskId,
        inputSummary: instruction.slice(0, 200),
      });

      // 2. 获取 Runtime 配置
      const instance = await prisma.enterpriseAgentInstance.findUnique({
        where: { employeeId: profileId }
      });
      if (!instance || instance.runtimeStatus !== 'active') {
        return this.errorResult('AGENT_NOT_ACTIVATED', startTime, taskId);
      }

      // Hardening-01: Lifecycle State Machine — 紧急停止检查
      if (instance.lifecycleState === 'EMERGENCY_STOP') {
        await agentAuditService.log({
          tenantId, agentId: profileId, taskId,
          action: 'execution.blocked_emergency',
          resource: 'enterprise_agent_instance',
          resourceId: instance.id,
          metadata: { reason: 'emergency_stop_active', lifecycleState: instance.lifecycleState },
        });
        return this.errorResult('EMERGENCY_STOP_ACTIVE', startTime, taskId);
      }

      // Hardening-01: PAUSED/STOPPED 状态也阻止执行
      if (instance.lifecycleState === 'PAUSED') {
        return this.errorResult('AGENT_PAUSED', startTime, taskId);
      }
      if (instance.lifecycleState === 'STOPPED') {
        return this.errorResult('AGENT_STOPPED', startTime, taskId);
      }

      // Timeline: Agent Assigned
      await agentAuditService.log({
        tenantId, agentId: profileId, taskId,
        action: 'agent.assigned',
        resource: 'enterprise_agent_instance',
        resourceId: instance.id,
        metadata: { agentName: profile.name, agentType: profile.agentType },
      });

      // Sprint-10 Step 3A: Memory Access Gate — 强制 validateAccess()
      // 在读取 HermesProfileBinding 后立即验证 memory namespace 归属权
      const binding = await (prisma as any).hermesProfileBinding.findUnique({
        where: { agentInstanceId: instance.id }
      });

      if (binding) {
        // T1: Memory Access Gate — 验证 namespace 租户隔离
        const memGate = await MemoryAccessGate.validate({
          tenantId,
          organizationId,
          agentInstanceId: instance.id,
          profileId,
          taskId,
          hermesAgentId: binding.hermesAgentId,
          memoryNamespace: binding.memoryNamespace,
        });
        if (!memGate.allowed) {
          return this.errorResult(`MEMORY_ACCESS_DENIED: ${memGate.reason}`, startTime, taskId);
        }

        // T2: ToolPermissionRuntimeGate — 统一工具权限校验
        let allowedTools: string[] = [];
        if (binding.toolAllowList && binding.toolAllowList !== '[]' && binding.toolAllowList !== '') {
          allowedTools = JSON.parse(binding.toolAllowList);
        }

        const toolGate = await ToolPermissionRuntimeGate.check({
          taskType,
          profileId,
          agentInstanceId: instance.id,
          tenantId,
          taskId,
          toolAllowList: allowedTools,
        });
        if (!toolGate.allowed) {
          return this.errorResult(`TOOL_PERMISSION_DENIED: ${taskType} — ${toolGate.reason}`, startTime, taskId);
        }

        // 记录 binding 身份到 audit trail
        await agentAuditService.log({
          tenantId, agentId: profileId, taskId,
          action: 'identity.bound',
          resource: 'hermes_profile_binding',
          resourceId: binding.id,
          metadata: {
            hermesAgentId: binding.hermesAgentId,
            memoryNamespace: binding.memoryNamespace,
            identityProvider: binding.identityProvider,
            toolCount: allowedTools.length,
            memoryAccessGate: memGate.code,
            toolPermissionGate: toolGate.code,
          },
        });
        console.log(`[AgentRuntime] ✅ Gates passed: identity=${binding.hermesAgentId?.slice(0, 8)} ns=${binding.memoryNamespace} mem=${memGate.code} tool=${toolGate.code}`);
      } else {
        console.warn(`[AgentRuntime] HermesProfileBinding 缺失: instanceId=${instance.id.slice(0, 8)}, profileId=${profileId.slice(0, 8)} — legacy 兼容`);
        // 不阻断 — legacy 兼容
      }

      // 3. SPRINT-IDENTITY-REALITY-FIX-01: 企业 AI 员工模型解析（BYOK 唯一原则）
      // 昆仑镜 = AI 员工操作系统：企业提供算力，平台不托管企业 Key。
      // 解析链: Runtime Input Override → OrgModelConfig + ProviderCredential（企业资产）→ EnterpriseLlmConfig（deprecated 兼容）
      // 无企业配置 → 显式阻断（G2：提示「企业模型配置缺失」，不是「平台模型错误」）
      const { modelResolver } = await import('./model-resolver.service.js')
      const resolvedModel = organizationId
        ? await modelResolver.resolveEnterpriseModel({ organizationId, tenantId })
        : null

      if (!resolvedModel) {
        await agentAuditService.log({
          tenantId, agentId: profileId, taskId,
          action: 'execution.blocked_model_config_missing',
          resource: 'org_model_config',
          resourceId: instance.id,
          metadata: { reason: 'enterprise_model_config_missing', organizationId },
        })
        return this.errorResult(
          `ENTERPRISE_MODEL_CONFIG_MISSING: 企业模型配置缺失 — 请企业管理员前往 企业工作台 → AI模型设置 配置模型与 API Key（企业提供算力，平台不托管企业 Key）`,
          startTime, taskId,
        )
      }

      if (resolvedModel.healthStatus === 'failed' || resolvedModel.healthStatus === 'decrypt_error' || resolvedModel.healthStatus === 'disabled') {
        const reason =
          resolvedModel.healthStatus === 'decrypt_error'
            ? '企业模型密钥解密失败（CRYPTO_ENCRYPTION_KEY 变更或数据损坏）'
            : resolvedModel.healthStatus === 'failed'
              ? '企业模型密钥已失效（认证失败/余额不足/模型不存在）'
              : '企业模型配置已停用'
        await agentAuditService.log({
          tenantId, agentId: profileId, taskId,
          action: 'execution.blocked_model_health',
          resource: 'provider_credential',
          resourceId: resolvedModel.credentialId || instance.id,
          metadata: { healthStatus: resolvedModel.healthStatus, provider: resolvedModel.provider, model: resolvedModel.model },
        })
        return this.errorResult(`MODEL_HEALTH_BLOCKED: ${reason} — 请在企业工作台重新配置模型密钥后重试`, startTime, taskId)
      }

      // 4. Sprint-08G: 构建 System Prompt
      const systemPrompt = getSystemPrompt(profile.agentType);

      // Timeline: Runtime Started
      const modelSource = resolvedModel.source === 'org_byok' ? 'org_byok' : resolvedModel.source === 'compat_enterprise' ? 'compat_enterprise' : 'input'
      const modelLabel = `${resolvedModel.sourceLabel} ${resolvedModel.provider}/${resolvedModel.model}`
      await agentAuditService.log({
        tenantId, agentId: profileId, taskId,
        action: 'runtime.started',
        resource: 'runtime_bridge',
        resourceId: instance.id,
        metadata: { modelSource, modelLabel },
      });

      // 5. SPRINT-IDENTITY-REALITY-FIX-01: 显式传入企业模型（Runtime Input Override）
      // resolveRuntimeConfig 第 1 层命中 → 不再经过 EnterpriseLlmConfig 平台层
      // Timeline: LLM Request Sent
      await agentAuditService.log({
        tenantId, agentId: profileId, taskId,
        action: 'llm.request_sent',
        resource: 'llm',
        resourceId: resolvedModel.configId || instance.id,
        metadata: { modelSource, modelLabel, systemPromptLen: systemPrompt.length, instructionLen: instruction.length },
      });

      const { executeViaGateway } = await import('../../runtime/runtime-gateway.js');
      // 企业模型显式覆盖（Input Override）：provider/model/apiKey 从企业设置解析，不落平台表
      const bt = businessType || 'recruitment';
      const gatewayCtx: Record<string, any> = {
        userId,
        tenantId,
        businessType: bt,
        model: resolvedModel.model,
        provider: resolvedModel.provider,
        apiKey: resolvedModel.apiKey,
        baseUrl: resolvedModel.baseUrl || undefined,
        modelSource,
      };
      if (binding) {
        gatewayCtx.agentInstanceId = instance.id;
        gatewayCtx.hermesAgentId = binding.hermesAgentId;
        gatewayCtx.memoryNamespace = binding.memoryNamespace;
      }
      const result = await executeViaGateway('llm', {
        systemPrompt,
        prompt: instruction,
        maxTokens: 4096,
        temperature: 0.7,
      }, gatewayCtx);

      const output = result.content || '';
      const gatewayTotalTokens = result.totalTokens || 0;
      const durationMs = Date.now() - startTime;

      // Timeline: LLM Response Received
      await agentAuditService.log({
        tenantId, agentId: profileId, taskId,
        action: 'llm.response_received',
        resource: 'llm',
        resourceId: resolvedModel.configId || instance.id,
        metadata: { modelSource, outputLen: output.length },
      });

      // 7. 估算 Token 用量（Sprint-06A: 优先使用 Gateway 返回的 totalTokens）
      const tokenInput = gatewayTotalTokens > 0 ? Math.ceil(gatewayTotalTokens * 0.6) : Math.ceil((systemPrompt.length + instruction.length) / 4);
      const tokenOutput = gatewayTotalTokens > 0 ? Math.ceil(gatewayTotalTokens * 0.4) : Math.ceil(output.length / 4);
      const providerForCost = resolvedModel.provider || 'volcengine';
      const cost = this.estimateCost(providerForCost, tokenInput, tokenOutput);

      // Sprint-06A: 写入 usage_logs（统一 Token 统计）— G5: 成本归属企业 + AI 员工维度 + 实际模型
      try {
        await prisma.usageLog.create({
          data: {
            userId,
            tenantId,
            organizationId: organizationId ? (organizationId as any) : null,
            agentId: profileId,
            taskId,
            cost,
            taskType: `enterprise_agent_${taskType}`,
            provider: resolvedModel.provider,
            model: resolvedModel.model,
            tokens: JSON.stringify({
              input: tokenInput,
              output: tokenOutput,
              total: tokenInput + tokenOutput,
              source: resolvedModel.source,
              businessType: bt,
              tenantId,
              organizationId,
              agentId: profileId,
            }),
            isPlatform: false,
          },
        })
      } catch { /* usageLog 表可能不存在于所有部署环境 */ }

      // Sprint-05 T03: Quota 消费链（观察模式）— 成功任务实时累加配额（fire-and-forget）
      if (organizationId) {
        const { recordUsage } = await import('./quota.service.js');
        recordUsage(organizationId, taskType, 'success').catch(() => {});
      }

      // 8. 更新任务状态
      await prisma.enterpriseAgentTask.update({
        where: { id: taskId },
        data: {
          status: 'completed',
          outputSummary: output.slice(0, 1000),
          tokenInput,
          tokenOutput,
          cost,
          durationMs,
          completedAt: new Date(),
        }
      });

      // Timeline: Execution Completed
      await agentAuditService.log({
        tenantId, agentId: profileId, taskId,
        action: 'execution.completed',
        resource: 'enterprise_agent_task',
        resourceId: taskId,
        tokenUsage: tokenInput + tokenOutput,
        cost,
        durationMs,
        inputSummary: instruction.slice(0, 200),
        outputSummary: output.slice(0, 500),
      });

      // 9. 更新 Instance 统计
      await prisma.enterpriseAgentInstance.update({
        where: { id: instance.id },
        data: {
          totalTasks: { increment: 1 },
          lastActiveAt: new Date(),
        }
      });

      // 10. 更新 Profile
      await prisma.enterpriseAgentProfile.update({
        where: { id: profileId },
        data: { lastExecutionAt: new Date() }
      });

      // 11. 记录审计
      await agentAuditService.log({
        tenantId,
        agentId: profileId,
        taskId,
        action: 'task_executed',
        resource: 'enterprise_agent_task',
        resourceId: taskId,
        llmConfigId: resolvedModel.configId || undefined,
        tokenUsage: tokenInput + tokenOutput,
        cost,
        durationMs,
        inputSummary: instruction.slice(0, 200),
        outputSummary: output.slice(0, 500),
      });

      // BETA-06.1: 创建 Action + Outcome（Golden Case 验证）
      // 先创建 EnterpriseRecommendation（满足 FK 约束）
      let action
      try {
        const decisionId = `dec_${taskId.slice(0, 8)}`
        // Check if recommendation exists
        let rec = await prisma.enterpriseRecommendation.findUnique({ where: { id: decisionId } })
        if (!rec) {
          rec = await prisma.enterpriseRecommendation.create({
            data: {
              id: decisionId,
              tenantId,
              category: 'agent_execution',
              title: `AI员工任务: ${instruction.slice(0, 50)}`,
              status: 'completed',
              priority: 2,
            },
          })
        }
        action = await prisma.enterpriseAction.create({
          data: {
            tenantId,
            decisionId,
            title: `AI员工任务: ${instruction.slice(0, 50)}`,
            description: output.slice(0, 200),
            status: 'completed',
            ownerType: 'agent',
            ownerId: profileId,
          },
        })
      } catch (actionErr: any) {
        console.error('[AgentRuntime] Action/Recommendation creation failed:', actionErr.message)
        // Non-critical: skip action/outcome creation but keep task completed
        return {
          success: true,
          taskId,
          output,
          tokenInput,
          tokenOutput,
          cost,
          durationMs,
        }
      }

      const outcome = await prisma.enterpriseOutcome.create({
        data: {
          tenantId,
          governanceTenantId: tenantId,
          actionId: action.id,
          outcomeType: 'business_insight',
          sourceType: 'agent',
          status: 'VERIFIED',
          summary: output.slice(0, 500),
          evidence: JSON.stringify([{
            taskId,
            agentId: profileId,
            tokenInput,
            tokenOutput,
            cost,
            durationMs,
            provider: resolvedModel.provider,
            model: resolvedModel.model,
          }]),
          occurredAt: new Date(),
          verifiedAt: new Date(),
        },
      })

      console.log(`[AgentRuntime] ✅ Outcome created: id=${outcome.id}, type=business_insight, status=VERIFIED, actionId=${action.id}`)

      // BETA-06.2 P2: 同步创建 OutcomeRecord（供 CEO Dashboard 使用）
      // Note: outcomeRecord 表可能不存在于所有部署环境，使用 raw SQL 兼容
      try {
        await prisma.$executeRaw`
          INSERT INTO outcome_record (id, organization_id, action_id, agent_id, type, status, description, occurred_at, created_at)
          VALUES (gen_random_uuid()::text, ${tenantId}, ${action.id}, ${profileId}, 'business_insight', 'VERIFIED', ${output.slice(0, 500)}, ${new Date()}, ${new Date()})
        `
      } catch (e: any) {
        // outcomeRecord 表可能不存在，静默跳过
        console.warn(`[AgentRuntime] OutcomeRecord sync warning: ${e.message}`)
      }

      // Timeline: Outcome Generated
      await agentAuditService.log({
        tenantId, agentId: profileId, taskId,
        action: 'outcome.generated',
        resource: 'enterprise_outcome',
        resourceId: outcome.id,
        metadata: { outcomeType: 'business_insight', status: 'VERIFIED', actionId: action.id },
      });

      return {
        success: true,
        taskId,
        output,
        tokenInput,
        tokenOutput,
        cost,
        durationMs,
        outcomeId: outcome.id,
        actionId: action.id,
      };

    } catch (error: any) {
      const durationMs = Date.now() - startTime;
      
      // 更新任务为失败
      await prisma.enterpriseAgentTask.update({
        where: { id: taskId },
        data: {
          status: 'failed',
          outputSummary: error.message.slice(0, 500),
          durationMs,
          completedAt: new Date(),
        }
      }).catch(() => {/* ignore if task not found */});

      return this.errorResult(error.message, startTime, taskId);
    }
  }



  // ─── Hardening-01: Agent Lifecycle State Machine ───

  /**
   * 紧急停止（全部 AI 员工）→ EMERGENCY_STOP
   */
  async emergencyStopAll(tenantId: string): Promise<number> {
    const result = await prisma.enterpriseAgentInstance.updateMany({
      where: { tenantId, lifecycleState: 'ACTIVE' },
      data: { lifecycleState: 'EMERGENCY_STOP' }
    });
    console.log(`[AgentRuntime] 🛑 Emergency stop: ${result.count} agents stopped`)
    return result.count
  }

  /**
   * 解除紧急停止 → 恢复到 ACTIVE
   */
  async emergencyResumeAll(tenantId: string): Promise<number> {
    const result = await prisma.enterpriseAgentInstance.updateMany({
      where: { tenantId, lifecycleState: 'EMERGENCY_STOP' },
      data: { lifecycleState: 'ACTIVE', lastActiveAt: new Date() }
    })
    console.log(`[AgentRuntime] ✅ Emergency resume: ${result.count} agents resumed`)
    return result.count
  }

  /**
   * 获取紧急停止状态
   */
  async getEmergencyStatus(tenantId: string): Promise<{
    emergencyActive: boolean
    activeAgents: number
    stoppedAgents: number
    pausedAgents: number
    lifecycleSummary: Record<string, number>
  }> {
    const allInstances = await prisma.enterpriseAgentInstance.findMany({
      where: { tenantId },
      select: { lifecycleState: true }
    })
    const stateCounts: Record<string, number> = {}
    for (const inst of allInstances) {
      stateCounts[inst.lifecycleState] = (stateCounts[inst.lifecycleState] || 0) + 1
    }
    return {
      emergencyActive: (stateCounts['EMERGENCY_STOP'] || 0) > 0,
      activeAgents: stateCounts['ACTIVE'] || 0,
      stoppedAgents: stateCounts['STOPPED'] || 0,
      pausedAgents: stateCounts['PAUSED'] || 0,
      lifecycleSummary: stateCounts
    }
  }

  /**
   * Hardening-01: 暂停 Agent → PAUSED
   */
  async pauseAgent(profileId: string): Promise<boolean> {
    try {
      await prisma.enterpriseAgentInstance.update({
        where: { employeeId: profileId },
        data: { lifecycleState: 'PAUSED', runtimeStatus: 'paused' }
      });
      await prisma.enterpriseAgentProfile.update({
        where: { id: profileId },
        data: { runtimeStatus: 'paused' }
      });
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Hardening-01: 恢复 Agent → ACTIVE
   */
  async resumeAgent(profileId: string): Promise<boolean> {
    try {
      await prisma.enterpriseAgentInstance.update({
        where: { employeeId: profileId },
        data: { lifecycleState: 'ACTIVE', runtimeStatus: 'active', lastActiveAt: new Date() }
      });
      await prisma.enterpriseAgentProfile.update({
        where: { id: profileId },
        data: { runtimeStatus: 'active' }
      });
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Hardening-01: 停止 Agent → STOPPED
   */
  async stopAgent(profileId: string): Promise<boolean> {
    try {
      await prisma.enterpriseAgentInstance.update({
        where: { employeeId: profileId },
        data: { lifecycleState: 'STOPPED', runtimeStatus: 'stopped' }
      });
      await prisma.enterpriseAgentProfile.update({
        where: { id: profileId },
        data: { runtimeStatus: 'stopped' }
      });
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Step 6: 获取 Agent 状态
   */
  async getAgentStatus(profileId: string): Promise<{
    profile: any;
    instance: any;
    canExecute: boolean;
  } | null> {
    const profile = await prisma.enterpriseAgentProfile.findUnique({
      where: { id: profileId },
      include: {
        modelBindings: true,
        auditTrails: { orderBy: { createdAt: 'desc' }, take: 10 }
      }
    });

    if (!profile) return null;

    const instance = await prisma.enterpriseAgentInstance.findUnique({
      where: { employeeId: profileId }
    });

    return {
      profile: {
        id: profile.id,
        name: profile.name,
        role: profile.role,
        agentType: profile.agentType,
        status: profile.status,
        runtimeStatus: profile.runtimeStatus,
        lastExecutionAt: profile.lastExecutionAt,
      },
      instance: instance ? {
        id: instance.id,
        agentId: instance.agentId,
        runtime: instance.runtime,
        runtimeStatus: instance.runtimeStatus,
        lifecycleState: instance.lifecycleState,
        totalTasks: instance.totalTasks,
        totalErrors: instance.totalErrors,
        lastActiveAt: instance.lastActiveAt,
        lastRecoveredAt: instance.lastRecoveredAt,
      } : null,
      canExecute: instance?.lifecycleState === 'ACTIVE',
    };
  }

  // ─── Hardening-01: Startup Recovery ─────────────────

  /**
   * Startup Recovery: PM2/服务重启后自动恢复所有 Agent Instance
   * 在 index.ts 的 main() 中调用
   *
   * 恢复流程：
   *   1. 加载所有 EnterpriseAgentInstance（DB 持久化）
   *   2. 将 EMERGENCY_STOP 状态重置为 PAUSED（安全恢复）
   *   3. 更新 lastRecoveredAt 时间戳
   *   4. 记录审计日志
   */
  async startupRecovery(): Promise<{
    recovered: number
    emergencyReset: number
    totalInstances: number
    details: Array<{ employeeId: string; agentId: string; lifecycleState: string }>
  }> {
    console.log('[AgentRuntime] 🔄 Startup Recovery: loading instances from DB...')

    // 1. 加载所有 Instance
    const allInstances = await prisma.enterpriseAgentInstance.findMany({
      select: {
        id: true, tenantId: true, employeeId: true, agentId: true,
        namespace: true, lifecycleState: true, runtimeStatus: true,
        totalTasks: true, totalErrors: true,
      }
    })

    if (allInstances.length === 0) {
      console.log('[AgentRuntime] 🔄 Startup Recovery: no instances found, skipping')
      return { recovered: 0, emergencyReset: 0, totalInstances: 0, details: [] }
    }

    // 2. 安全恢复：EMERGENCY_STOP → PAUSED（不能自动恢复到 ACTIVE）
    const emergencyInstances = allInstances.filter(i => i.lifecycleState === 'EMERGENCY_STOP')
    if (emergencyInstances.length > 0) {
      await prisma.enterpriseAgentInstance.updateMany({
        where: { lifecycleState: 'EMERGENCY_STOP' },
        data: { lifecycleState: 'PAUSED', runtimeStatus: 'paused' }
      })
      console.log(`[AgentRuntime] 🔄 Startup Recovery: reset ${emergencyInstances.length} EMERGENCY_STOP → PAUSED`)
    }

    // 3. 更新所有实例的 lastRecoveredAt
    await prisma.enterpriseAgentInstance.updateMany({
      where: { id: { in: allInstances.map(i => i.id) } },
      data: { lastRecoveredAt: new Date() }
    })

    // 4. 记录审计（不绑定 agentId 避免外键约束冲突）
    if (allInstances.length > 0) {
      await agentAuditService.log({
        tenantId: allInstances[0]?.tenantId || 'system',
        agentId: undefined,
        action: 'system.startup_recovery',
        resource: 'enterprise_agent_runtime',
        resourceId: 'startup',
        inputSummary: `Recovered ${allInstances.length} agents, reset ${emergencyInstances.length} emergency`,
        outputSummary: `Total: ${allInstances.length}, Emergency→Paused: ${emergencyInstances.length}`,
      })
    }

    const details = allInstances.map(i => ({
      employeeId: i.employeeId,
      agentId: i.agentId,
      lifecycleState: i.lifecycleState === 'EMERGENCY_STOP' ? 'PAUSED' : i.lifecycleState,
    }))

    console.log(`[AgentRuntime] ✅ Startup Recovery complete: ${allInstances.length} agents recovered`)

    return {
      recovered: allInstances.length,
      emergencyReset: emergencyInstances.length,
      totalInstances: allInstances.length,
      details,
    }
  }

  // ─── Helpers ────────────────────────────────────────

  private errorResult(error: string, startTime: number, taskId?: string): ExecuteTaskResult {
    return {
      success: false,
      taskId: taskId || '',
      output: '',
      tokenInput: 0,
      tokenOutput: 0,
      cost: 0,
      durationMs: Date.now() - startTime,
      error,
    };
  }

  /**
   * 简化成本估算（各 Provider 近似价格）
   */
  private estimateCost(provider: string, inputTokens: number, outputTokens: number): number {
    const prices: Record<string, { input: number; output: number }> = {
      deepseek: { input: 0.001, output: 0.002 },    // 每 1K tokens, RMB
      openai: { input: 0.015, output: 0.06 },         // gpt-4o 近似
      volcengine: { input: 0.002, output: 0.004 },    // 火山引擎
      aliyun: { input: 0.002, output: 0.004 },        // 通义千问
      default: { input: 0.001, output: 0.002 },
    };
    const p = prices[provider] || prices.default;
    return (inputTokens / 1000 * p.input) + (outputTokens / 1000 * p.output);
  }

}

// ─── Singleton ──────────────────────────────────────────

export const enterpriseAgentRuntime = new EnterpriseAgentRuntimeService();
