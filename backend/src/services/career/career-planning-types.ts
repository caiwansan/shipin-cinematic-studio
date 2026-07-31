// ─── Sprint-09E-03 Career Planning Types ─────
// 基于 Confirmed Facts 的职业智能分析类型
// 所有输入型字段的 source 必须可追溯

/**
 * 确认的职业经历（仅来自 CareerProfile + 子表，dataQualityStatus=valid）
 */
export interface ConfirmedExperience {
  company: string
  title: string
  startDate: Date
  endDate?: Date
  isCurrent: boolean
  description?: string
  achievements: string[]
  skillsUsed: string[]
}

/**
 * 确认的技能（来自 CandidateSkill 表）
 */
export interface ConfirmedSkill {
  name: string
  level: string
  confidence: number
}

/**
 * 确认的教育背景（来自 Education 表）
 */
export interface ConfirmedEducation {
  school: string
  degree?: string
  major?: string
}

/**
 * 职业规划输入上下文
 *
 * 严格限制：只包含 dataQualityStatus=valid 的 Confirmed Facts
 * 禁止：legacy_unknown / review_required 数据参与分析
 */
export interface CareerPlanningContext {
  /** 用户全名 */
  fullName: string
  /** 当前职业方向（用户确认过的） */
  currentDirection?: string
  /** 当前行业（用户明确提供） */
  industry?: string
  /** 工作年限 */
  yearsExperience: number
  /** 当前级别 */
  currentLevel?: string
  /** 工作经历列表 */
  workHistory: ConfirmedExperience[]
  /** 技能列表 */
  skills: ConfirmedSkill[]
  /** 教育背景 */
  education: ConfirmedEducation[]
  /** 用户明确提出的职业目标 */
  userGoal?: string
  /** 用户约束（地域、薪资、行业限制等） */
  constraints: string[]
  /** 缺失的关键信息（用于引导用户补充） */
  missingInformation: string[]
  /** 数据追溯：哪些表提供了数据 */
  dataSources: string[]
  /** 数据质量状态 */
  dataQualityStatus: string
}

/**
 * 推荐职业路径
 */
export interface RecommendedPath {
  direction: string
  reason: string
  confidence: 'high' | 'medium' | 'low'
  /** 支撑该推荐的 Confirmed Facts 引用 */
  evidence: string[]
  /** 预估转型难度（1-5） */
  difficulty: number
}

/**
 * 技能缺口分析
 */
export interface SkillGap {
  skill: string
  importance: 'critical' | 'important' | 'nice_to_have'
  currentStatus: 'has' | 'basic' | 'missing'
  /** 学习建议 */
  suggestion: string
}

/**
 * 风险提示
 */
export interface Risk {
  description: string
  severity: 'high' | 'medium' | 'low'
  mitigation: string
}

/**
 * 三年行动计划
 */
export interface ThreeYearPlan {
  year1: string
  year2: string
  year3: string
}

/**
 * 职业智能分析输出
 */
export interface CareerIntelligenceOutput {
  /** 分析时间戳 */
  analyzedAt: string
  /** 上下文快照（数据溯源用） */
  contextSnapshot: {
    yearsExperience: number
    skillCount: number
    workHistoryCount: number
    hasGoal: boolean
  }
  /** 推荐路径列表 */
  recommendedPaths: RecommendedPath[]
  /** 技能缺口分析 */
  skillGapAnalysis: SkillGap[]
  /** 三年行动计划 */
  threeYearPlan: ThreeYearPlan
  /** 风险提示 */
  risks: Risk[]
  /** 缺失信息（引导用户补充） */
  missingInformation: string[]
  /** 数据质量标识 */
  dataQualityStatus: string
  /** 是否基于 legacy 数据（不参与分析） */
  isLegacy: boolean
}

// ─── Sprint-09E-04 Career Action Types ─────

/**
 * 一个可执行的行动建议
 * 每个 action 必须能追溯回规划依据和 Confirmed Facts
 */
export interface CareerAction {
  /** 唯一标识（用于 tracking） */
  id: string
  /** 行动标题 */
  title: string
  /** 为什么这个行动对用户有价值 */
  reason: string
  /** 支撑该行动的规划依据引用 */
  relatedEvidence: string[]
  /** 关联的技能（可选） */
  targetSkill?: string
  /** 优先级 */
  priority: 'high' | 'medium' | 'low'
  /** 所属阶段 */
  phase: '30days' | '90days' | '12months'
}

/**
 * 行动计划输出
 */
export interface CareerActionPlan {
  actions30Days: CareerAction[]
  actions90Days: CareerAction[]
  actions12Months: CareerAction[]
  /** 关联的规划 ID */
  planningId: string
  /** 生成时间戳 */
  generatedAt: string
}

/**
 * 用户行动进度
 */
export interface CareerActionProgress {
  id: string
  userId: string
  actionId: string
  actionTitle: string
  status: 'pending' | 'doing' | 'completed'
  /** 用户提供的完成证据 */
  evidence?: string
  createdAt: string
  updatedAt: string
}

/**
 * 行动反馈输入
 */
export interface ActionFeedbackInput {
  actionId: string
  status: 'doing' | 'completed' | 'rejected'
  feedback: string
  /** 如果拒绝，用户选择的新方向？ */
  alternativePath?: string
}
