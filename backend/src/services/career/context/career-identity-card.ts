// ─── Sprint-09E-05.1 Task 01: Career Identity Card ─────
// 运行时 DTO，非数据库表。
// 所有字段必须来自 Confirmed Facts Only。
// 禁止：LLM 补全、猜测、legacy_unknown 数据进入。
//
// 继承 09E-02.5 Data Reality Cleanup 的数据治理结果。
// 继承 09E-03 Career Planning Intelligence 的 Confirmed Facts Layer。

/**
 * 用户职业身份卡 — 运行时只读 DTO
 *
 * 这是 Career Agent 所有交互的隐形上下文卡片。
 * 用户职业事实不来自聊天历史，来自 CareerProfile Card。
 */
export interface CareerIdentityCard {
  userId: string

  /** 基本身份信息 */
  identity: {
    /** 用户全名（来自 CareerProfile.fullName，Confirmed） */
    name?: string
    /** 用户地理位置（用户明确提供） */
    location?: string
  }

  /** 职业基本信息 */
  career: {
    /** 当前角色/职位（来自 CareerProfile 或 WorkExperience 最新） */
    currentRole?: string
    /** 工作年限（Confirmed） */
    experienceYears: number
    /** 涉及的行业列表 */
    industries: string[]
    /** 当前职业方向 */
    direction?: string
    /** 当前级别 */
    level?: string
  }

  /** 技能列表（来自 CandidateSkill，Confirmed） */
  skills: Array<{
    name: string
    /** beginner | intermediate | advanced | expert */
    level: string
    /** 来源：resume_extraction | user_input | skill_assessment（09E-04 反馈升级） */
    source: string
  }>

  /** 教育背景（来自 Education 子表） */
  education: Array<{
    school: string
    degree?: string
    major?: string
  }>

  /** 工作经历摘要（来自 WorkExperience，Confirmed） */
  workHistory: Array<{
    company: string
    title: string
    startDate: Date
    endDate?: Date
    isCurrent: boolean
    skillsUsed: string[]
  }>

  /** Confirmed Facts 证据引用列表 */
  confirmedFacts: string[]

  /** 用户确认过的职业目标 */
  careerGoals: string[]
}

/**
 * 当前职业上下文 — 运行时动态信息
 *
 * 包含用户当前正在进行中的活动和最近的反馈，
 * 使 AI 能感知用户最近的行为状态。
 */
export interface CurrentCareerContext {
  /** 用户最新的职业目标（从 CareerProfile 或最近消息中读取） */
  currentGoal?: string

  /** 用户近期指定的约束条件 */
  constraints: string[]

  /** 缺失的关键信息（用于引导用户补充，与 dataQualityStatus 联动） */
  missingInformation: string[]
}

/**
 * Career Agent Context — 统一上下文输出
 *
 * 所有 Career Agent 入口使用此结构获取职业身份：
 * - Chat (POST /api/job/chat)
 * - Planning (POST /api/career/planning)
 * - Actions (POST /api/career/actions)
 * - Interview / Matching
 */
export interface CareerAgentContext {
  /** 用户职业身份卡 — 只读、永久、基于 Confirmed Facts */
  identityCard: CareerIdentityCard

  /** 当前职业上下文 — 动态、随用户行为变化 */
  currentContext: CurrentCareerContext

  /** 活跃中的 Action（进行中或待办的） */
  activeActions: Array<{
    id: string
    title: string
    phase: string
    status: string
    targetSkill?: string
  }>

  /** 最近反馈记录（最近3条） */
  recentFeedback: Array<{
    actionId: string
    actionTitle: string
    status: string
    feedback?: string
    updatedAt: Date
  }>
}
