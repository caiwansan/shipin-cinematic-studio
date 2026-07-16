/**
 * Enterprise Planner Service v1.1
 * 
 * CEO Intent → Execution Plan
 * 将老板的自然语言指令解析为结构化的Agent执行计划
 */

export interface PlannerAgentTask {
  agentType: string;       // growth_director / market_analyst / content_manager / customer_ops / sales_assistant
  taskTitle: string;
  taskDescription: string;
  priority: number;        // 1=最高
  dependencies?: string[]; // 依赖的其他agent任务
}

export interface CommandIntent {
  goal: string;
  industry?: string;
  region?: string;
  expectedOutput?: string;
  commandType: 'growth' | 'research' | 'content' | 'customer' | 'sales' | 'analysis' | 'custom';
  assignedAgents: PlannerAgentTask[];
}

export class EnterprisePlannerService {
  
  /**
   * 解析CEO自然语言指令 → 结构化意图
   * MVP: 关键词匹配 + 规则引擎（后续可升级为LLM）
   */
  parseIntent(content: string): CommandIntent {
    const lower = content.toLowerCase();
    
    // 1. 确定指令类型
    const commandType = this.detectCommandType(lower);
    
    // 2. 提取行业关键词
    const industry = this.extractIndustry(lower);
    
    // 3. 提取地区关键词
    const region = this.extractRegion(lower);
    
    // 4. 确定期望输出
    const expectedOutput = this.extractExpectedOutput(lower);
    
    // 5. 生成执行计划
    const assignedAgents = this.assignAgents(content, commandType, industry, region);
    
    return {
      goal: content,
      industry,
      region,
      expectedOutput,
      commandType,
      assignedAgents
    };
  }
  
  private detectCommandType(content: string): CommandIntent['commandType'] {
    if (/增长|获客|拉新|营销|推广|增长/.test(content)) return 'growth';
    if (/研究|分析|调研|市场|竞争/.test(content)) return 'research';
    if (/内容|文案|写作|文章|发布/.test(content)) return 'content';
    if (/客户|互动|沟通|回答|跟进/.test(content)) return 'customer';
    if (/销售|成交|报价|签单|合同/.test(content)) return 'sales';
    if (/数据|报告|报表|指标|看板/.test(content)) return 'analysis';
    return 'custom';
  }
  
  private extractIndustry(content: string): string | undefined {
    const industries: Record<string, RegExp> = {
      '新能源': /新能源/,
      '新能源物流': /新能源.{0,3}物流/,
      '物流': /物流/,
      '人工智能': /人工智能|AI/,
      '金融': /金融|银行|保险/,
      '教育': /教育|培训/,
      '医疗': /医疗|健康|医药/,
      '电商': /电商|零售|商城/,
      '房地产': /房地产|房产|物业/,
      '汽车': /汽车|车辆|车企/,
      '制造业': /制造|工厂|生产/,
    };
    
    for (const [name, regex] of Object.entries(industries)) {
      if (regex.test(content)) {
        // 返回更具体的匹配
        if (name.includes('新能源') && industries['新能源物流'].test(content)) continue;
        return name;
      }
    }
    return undefined;
  }
  
  private extractRegion(content: string): string | undefined {
    const regions: Record<string, RegExp> = {
      '华东': /华东|上海|江苏|浙江|安徽/,
      '华南': /华南|广东|广西|海南/,
      '华北': /华北|北京|天津|河北|山西/,
      '华中': /华中|湖北|湖南|河南/,
      '西南': /西南|四川|重庆|云南|贵州/,
      '西北': /西北|陕西|甘肃|青海|宁夏/,
      '东北': /东北|辽宁|吉林|黑龙江/,
      '全国性': /全国|中国|全域/,
    };
    
    for (const [name, regex] of Object.entries(regions)) {
      if (regex.test(content)) return name;
    }
    return undefined;
  }
  
  private extractExpectedOutput(content: string): string {
    if (/[0-9]+个(?:客户|线索|潜客)/.test(content)) {
      const match = content.match(/([0-9]+个(?:客户|线索|潜客))/);
      return match ? match[1] : '30个潜客';
    }
    return '30个潜客';
  }
  
  /**
   * 基于指令类型智能分配Agent
   * Future: 升级为LLM智能决策
   */
  private assignAgents(
    content: string,
    commandType: string,
    industry?: string,
    region?: string
  ): PlannerAgentTask[] {
    const agentMap: Record<string, string[]> = {
      growth: ['growth_director', 'market_analyst', 'content_manager', 'customer_ops', 'sales_assistant'],
      research: ['market_analyst', 'growth_director', 'content_manager'],
      content: ['content_manager', 'market_analyst', 'customer_ops'],
      customer: ['customer_ops', 'sales_assistant', 'growth_director'],
      sales: ['sales_assistant', 'customer_ops', 'growth_director'],
      analysis: ['market_analyst', 'growth_director'],
      custom: ['growth_director', 'content_manager']
    };
    
    const taskTemplates: Record<string, (agent: string) => { title: string; desc: string }> = {
      default: (agent) => {
        const agentNames: Record<string, string> = {
          growth_director: 'AI增长总监',
          market_analyst: 'AI市场分析师',
          content_manager: 'AI内容经理',
          customer_ops: 'AI客户运营',
          sales_assistant: 'AI销售助理'
        };
        const actions: Record<string, string> = {
          growth_director: '扫描商业机会，制定获客策略',
          market_analyst: '深度分析市场格局和竞争态势',
          content_manager: '生成行业精准内容',
          customer_ops: '监控并响应客户互动',
          sales_assistant: '整理客户名单，准备跟进材料'
        };
        return {
          title: `${agentNames[agent] || agent}执行任务`,
          desc: actions[agent] || '执行企业增长任务'
        };
      }
    };
    
    const agents = agentMap[commandType] || agentMap['custom'];
    const template = taskTemplates['default'];
    
    return agents.map((agent, index) => {
      const taskInfo = template(agent);
      return {
        agentType: agent,
        taskTitle: taskInfo.title,
        taskDescription: `${taskInfo.desc} | 目标: ${industry || '全行业'} ${region || '全国范围'}`,
        priority: index + 1,
        dependencies: index > 0 ? [agents[index - 1]] : undefined
      };
    });
  }
  
  /**
   * 生成执行进度摘要（任务完成后调用）
   */
  generateResultSummary(commandId: string, plan: CommandIntent, executionResults: any): string {
    const agentCount = plan.assignedAgents.length;
    return `✅ 任务完成: 参与${agentCount}位AI员工 ${plan.region || '全国范围'} ${plan.industry || '全行业'}增长任务`;
  }
}

export const enterprisePlannerService = new EnterprisePlannerService();
