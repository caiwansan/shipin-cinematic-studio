/**
 * Enterprise Agent Profile Service v1.1
 * 
 * AI员工档案管理
 * 管理员工每日目标、工作时间、老板备注、权限配置
 */

export interface AgentProfileDetail {
  id: string;
  tenantId: string;
  name: string;
  role: string;
  agentType: string;
  goal?: string;
  knowledgeScope: string[];
  tools: string[];
  permissions: string[];
  capabilities: string[];
  kpiMetrics: Record<string, any>;
  status: string;
  isDefault: boolean;
  // Sprint 1 v1.1 新增
  dailyTarget?: number;
  workingHours?: string;
  managerNote?: string;
  // 今日统计
  todayProgress?: number;
  todayCompleted?: number;
}

export interface UpdateAgentProfileInput {
  dailyTarget?: number;
  workingHours?: string;
  managerNote?: string;
  status?: 'active' | 'paused';
  permissions?: string[];
}

// 5位核心AI员工默认配置
const DEFAULT_AGENTS = [
  {
    id: 'agent-growth-director',
    name: 'AI增长总监',
    role: 'growth_director',
    agentType: 'growth_director',
    goal: '每天发现10个商业机会',
    knowledgeScope: ['市场分析', '竞争格局', '增长策略', '行业趋势'],
    tools: ['网络搜索', 'GEO分析', '内容分析', '渠道监控'],
    permissions: ['market_analysis', 'content_planning', 'data_query', 'task_creation'],
    capabilities: ['市场分析', '策略制定', '团队协调'],
    dailyTarget: 10,
    workingHours: '09:00-18:00',
    managerNote: '核心增长负责人，重点关注新能源和AI领域',
    status: 'active',
    kpiMetrics: { opportunities_found: 0, tasks_created: 0 }
  },
  {
    id: 'agent-market-analyst',
    name: 'AI市场分析师',
    role: 'market_analyst',
    agentType: 'market_analyst',
    goal: '深度分析市场格局和竞争态势',
    knowledgeScope: ['竞争分析', '用户画像', '市场调研', '数据分析'],
    tools: ['数据挖掘', '报告生成', '图表分析', '趋势预测'],
    permissions: ['data_analysis', 'report_generation', 'data_query'],
    capabilities: ['数据驱动决策', '可视化报告'],
    dailyTarget: 3,
    workingHours: '09:00-17:00',
    managerNote: '数据驱动，产出深度分析报告',
    status: 'active',
    kpiMetrics: { reports_generated: 0, insights_found: 0 }
  },
  {
    id: 'agent-content-manager',
    name: 'AI内容经理',
    role: 'content_manager',
    agentType: 'content_manager',
    goal: '每天生成3篇行业精准内容',
    knowledgeScope: ['内容营销', '文案写作', '品牌传播', '新媒体'],
    tools: ['文案生成', '多渠道分发', '效果监测', 'SEO优化'],
    permissions: ['content_creation', 'publish_approved_content', 'schedule_posts'],
    capabilities: ['内容创作', '品牌调性把控'],
    dailyTarget: 3,
    workingHours: '10:00-19:00',
    managerNote: '内容质量把控，需审批后发布',
    status: 'active',
    kpiMetrics: { content_created: 0, engagement_generated: 0 }
  },
  {
    id: 'agent-customer-ops',
    name: 'AI客户运营',
    role: 'customer_ops',
    agentType: 'customer_ops',
    goal: '监控互动数据，及时响应客户咨询',
    knowledgeScope: ['客户管理', '互动策略', '客户服务', '用户运营'],
    tools: ['互动监控', '自动回复', '客户分层', '转化分析'],
    permissions: ['customer_messaging', 'response_automation', 'interaction_monitoring'],
    capabilities: ['用户体验优化', '留存提升'],
    dailyTarget: 20,
    workingHours: '08:00-22:00',
    managerNote: '客户第一，快速响应，实时在线',
    status: 'active',
    kpiMetrics: { interactions_handled: 0, satisfaction_score: 0 }
  },
  {
    id: 'agent-sales-assistant',
    name: 'AI销售助理',
    role: 'sales_assistant',
    agentType: 'sales_assistant',
    goal: '整理客户名单，准备跟进材料',
    knowledgeScope: ['销售话术', '客户画像', '成交策略', 'CRM管理'],
    tools: ['线索评分', '跟进提醒', '话术推荐', '客户档案管理'],
    permissions: ['lead_management', 'follow_up_scheduling', 'data_query'],
    capabilities: ['销售支持', '线索转化率提升'],
    dailyTarget: 8,
    workingHours: '14:00-22:00',
    managerNote: '精准跟进，提高转化',
    status: 'active',
    kpiMetrics: { leads_processed: 0, opportunities_created: 0 }
  }
];

// 内存Store (Future: 从Prisma enterprise_agent_profile读取)
const agentStore: Map<string, any> = new Map();

// 初始化默认Agent
function ensureDefaults(tenantId: string) {
  const key = `${tenantId}`;
  if (!agentStore.has(key)) {
    const agents = DEFAULT_AGENTS.map(a => ({ ...a, tenantId }));
    agentStore.set(key, agents);
  }
}

export class EnterpriseAgentProfileService {
  
  /**
   * 获取租户所有AI员工
   */
  async listAgents(tenantId: string): Promise<AgentProfileDetail[]> {
    ensureDefaults(tenantId);
    const agents = agentStore.get(tenantId) || agentStore.get('default') || [];
    return agents.map((a: any) => this.toDetail(a, tenantId));
  }
  
  /**
   * 获取单个AI员工详情
   */
  async getAgent(tenantId: string, agentId: string): Promise<AgentProfileDetail | null> {
    const agents = await this.listAgents(tenantId);
    const found = agents.find(a => a.id === agentId);
    return found || null;
  }
  
  /**
   * 更新AI员工配置 (目标/时间/备注/状态/权限)
   */
  async updateAgent(tenantId: string, agentId: string, input: UpdateAgentProfileInput): Promise<AgentProfileDetail | null> {
    const agents = await this.listAgents(tenantId);
    const agent = agents.find(a => a.id === agentId);
    if (!agent) return null;
    
    // 更新字段
    if (input.dailyTarget !== undefined) agent.dailyTarget = input.dailyTarget;
    if (input.workingHours !== undefined) agent.workingHours = input.workingHours;
    if (input.managerNote !== undefined) agent.managerNote = input.managerNote;
    if (input.permissions !== undefined) agent.permissions = input.permissions;
    if (input.status !== undefined) agent.status = input.status;
    
    return agent;
  }
  
  /**
   * 暂停/启用AI员工
   */
  async toggleAgentStatus(tenantId: string, agentId: string): Promise<AgentProfileDetail | null> {
    const agent = await this.getAgent(tenantId, agentId);
    if (!agent) return null;
    
    const newStatus = agent.status === 'active' ? 'paused' : 'active';
    return this.updateAgent(tenantId, agentId, { status: newStatus });
  }
  
  /**
   * 获取今日部门概览 (CEO驾驶舱用)
   */
  async getDepartmentOverview(tenantId: string): Promise<{
    agents: AgentProfileDetail[];
    totalAgents: number;
    activeAgents: number;
    totalTargetToday: number;
    totalCompletedToday: number;
  }> {
    const agents = await this.listAgents(tenantId);
    
    return {
      agents,
      totalAgents: agents.length,
      activeAgents: agents.filter(a => a.status === 'active').length,
      totalTargetToday: agents.reduce((sum, a) => sum + (a.dailyTarget || 0), 0),
      totalCompletedToday: agents.reduce((sum, a) => sum + (a.todayCompleted || 0), 0)
    };
  }
  
  private toDetail(agent: any, tenantId: string): AgentProfileDetail {
    return {
      id: agent.id,
      tenantId,
      name: agent.name,
      role: agent.role,
      agentType: agent.agentType,
      goal: agent.goal,
      knowledgeScope: agent.knowledgeScope || [],
      tools: agent.tools || [],
      permissions: agent.permissions || [],
      capabilities: agent.capabilities || [],
      kpiMetrics: agent.kpiMetrics || {},
      status: agent.status,
      isDefault: agent.isDefault || false,
      dailyTarget: agent.dailyTarget,
      workingHours: agent.workingHours,
      managerNote: agent.managerNote,
      // 模拟今日进度 (Future: 从实际task统计)
      todayProgress: Math.floor(Math.random() * (agent.dailyTarget || 10)),
      todayCompleted: Math.floor(Math.random() * (agent.dailyTarget || 5))
    };
  }
}

export const enterpriseAgentProfileService = new EnterpriseAgentProfileService();
