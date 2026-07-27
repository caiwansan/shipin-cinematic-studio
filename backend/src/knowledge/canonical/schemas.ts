/**
 * Kunlun Knowledge Hub — Phase 3-A: Knowledge Schema冻结
 * 
 * 本文件定义所有 Canonical Object Schema。
 * 这是整个 Knowledge OS 的地基——任何修改必须经过评审。
 * 
 * 设计理念：
 * - 每个实体有且只有一个 Canonical Object
 * - 版本化（version）
 * - 可溯源（evidence + source）
 * - 可过期（updatedAt + confidence）
 * - 域无关（未来法律/音乐/媒体复用）
 */

// ─── 基础类型 ───

/** 薪资范围（单位：K/月） */
export interface SalaryRange {
  min: number
  max: number
  median: number
  currency: string      // CNY/USD
}

/** 薪资快照（带置信度） */
export interface SalarySnapshot {
  range: SalaryRange
  sampleCount: number
  confidence: number     // 0-1
  updatedAt: string
  source: string
}

/** 薪资趋势 */
export interface SalaryTrend {
  snapshots: SalarySnapshot[]   // 历史快照，最新在最后
  trend: 'rising' | 'stable' | 'declining'
  yearOverYearChange: number    // 百分比
}

/** 增长趋势 */
export interface GrowthTrend {
  level: 'explosive' | 'fast' | 'steady' | 'slow' | 'declining'
  demandGrowth: number          // 年需求增长率
  talentSupply: number          // 人才供给增长率
  outlook: string               // 未来3-5年展望
  updatedAt: string
}

/** 证据链 */
export interface Evidence {
  type: 'data' | 'report' | 'survey' | 'expert' | 'user_feedback'
  source: string
  url?: string
  date: string
  confidence: number
  rawData?: Record<string, unknown>
}

/** 地理位置 */
export interface GeoLocation {
  city: string
  province?: string
  country: string
  tier: 1 | 2 | 3 | 4 | 5    // 城市梯队
}

// ─── Career Canonical Object（CCO） ───

/** 职业标准对象 — 每种职业全局唯一 */
export interface CareerCanonicalObject {
  id: string              // UUID，永久标识
  version: string         // 语义版本，如 "1.0.0"
  name: string            // 标准名称："AI应用工程师"
  aliases: string[]       // 别名：["AI工程师","大模型应用开发"]
  category: string        // 大类："AI" | "前端" | "后端" | "产品"
  subcategory: string     // 子类："大模型应用"
  description: string     // 职业描述
  
  // 技能（必须引用 Skill Graph）
  requiredSkills: SkillRef[]     // 必备技能
  
  // 关联职业
  relatedCareers: CareerRef[]    // 关联职业
  
  // 薪资（按级别）
  salaryByLevel: SalaryReference[]
  
  // 增长趋势
  growthTrend: GrowthDataPoint[]
  
  // 能力画像
  fitProfile: CareerFit
  
  // 职业迁移
  transitions: CareerTrans[]
  
  // 学习资源
  learningLinks: LearningLink[]
  
  // 状态
  status: 'active' | 'deprecated' | 'draft'
  
  // 元数据
  evidence: Evidence[]
  source: string
  updatedAt: string
}

/** 职业引用 */
export interface CareerRef {
  careerId: string
  weight: number
  type: 'related' | 'parent' | 'child'
}

/** 薪资参考（按级别） */
export interface SalaryReference {
  level: 'entry' | 'mid' | 'senior' | 'lead'
  range: string           // e.g. "25K~35K"
  cityTier: 'tier1' | 'new-tier1' | 'tier2' | 'tier3'
  source: string
  confidence: number
  updatedAt: string
}

/** 增长趋势数据点 */
export interface GrowthDataPoint {
  year: number
  quarter: number
  demandIndex: number     // 需求指数 0-100
  salaryGrowth: number    // 薪资增长率 %
  source: string
}

/** 职业迁移 */
export interface CareerTrans {
  fromCareer: string
  toCareer: string
  difficulty: 1 | 2 | 3 | 4 | 5
  successRate: number     // 0-100
  estimatedMonths: number
  keyGapSkills: string[]  // Skill ID 列表
}

/** 能力画像（1-5分） */
export interface CareerFit {
  logicalThinking: number
  communication: number
  creativity: number
  execution: number
  leadership: number
  analyticalSkill: number
}

/** 学习资源 */
export interface LearningLink {
  type: 'course' | 'book' | 'project' | 'practice' | 'certification'
  name: string
  url?: string
  level: 'beginner' | 'intermediate' | 'advanced'
  free: boolean
  duration?: string
  description: string
}

// ─── Skill Canonical Object（SCO） ───

/** 技能标准对象 — 每种技能全局唯一 */
export interface SkillCanonicalObject {
  id: string
  version: string
  name: string                // "LangChain"
  aliases: string[]           // ["LangChain.js", "LangChain Python"]
  category: string            // "框架" | "语言" | "工具" | "理论" | "软技能"
  subcategory: string         // "LLM框架"
  description: string
  
  // 关系图（不是树）
  prerequisites: SkillEdge[]   // 前置技能
  relatedSkills: SkillEdge[]   // 关联技能
  nextSkills: SkillEdge[]       // 进阶技能
  complementary: SkillEdge[]    // 互补技能
  
  // 市场
  demandLevel: 'critical' | 'high' | 'medium' | 'low'
  learningCurve: 1 | 2 | 3 | 4 | 5   // 1=平缓, 5=陡峭
  timeToLearn: string                  // 如 "2-4周"
  
  // 关联职业
  relevantCareers: string[]            // CCO id 列表
  
  evidence: Evidence[]
  source: string
  updatedAt: string
}

/** 技能图中的边（带权重） */
export interface SkillEdge {
  skillId: string             // SCO id
  weight: number              // 关联强度 0-1
  type: 'prerequisite' | 'related' | 'next' | 'complementary'
}

/** 技能引用（用于CCO） */
export interface SkillRef {
  skillId: string
  weight: number              // 该职业下的重要程度 0-1
  proficiency?: 'beginner' | 'intermediate' | 'advanced' | 'expert'
  required?: boolean
}

// ─── Company Canonical Object（CCO-Comp） ───

/** 企业标准对象 — 每家企业全局唯一 */
export interface CompanyCanonicalObject {
  id: string
  version: string
  name: string
  aliases: string[]
  industry: string
  size: 'startup' | 'small' | 'medium' | 'large' | 'enterprise'
  description: string
  website?: string
  
  // 信用评分
  creditScore: CreditScore
  
  // 招聘活跃度
  recruitmentActivity: RecruitmentActivity
  
  // 薪资水平
  salaryLevel: SalarySnapshot
  
  // 员工评价
  employeeRating: EmployeeRating
  
  // 关联岗位
  activeJobIds: string[]
  
  evidence: Evidence[]
  source: string
  updatedAt: string
}

/** 企业信用评分 */
export interface CreditScore {
  score: number           // 0-100
  level: 'AAA' | 'AA' | 'A' | 'BBB' | 'BB' | 'B' | 'C'
  factors: string[]
  updatedAt: string
}

/** 招聘活跃度 */
export interface RecruitmentActivity {
  activeJobCount: number
  avgTimeToFill: number       // 平均招聘周期（天）
  offerAcceptanceRate: number // Offer接受率
  turnoverRate: number        // 离职率
  updatedAt: string
}

/** 员工评价 */
export interface EmployeeRating {
  overall: number          // 1-5
  culture: number
  compensation: number
  growth: number
  workLifeBalance: number
  sampleCount: number
  updatedAt: string
}

// ─── Job Canonical Object（CJO） ───

/** 岗位标准对象 — 每个岗位全局唯一 */
export interface JobCanonicalObject {
  id: string
  version: string
  title: string
  companyId: string
  careerId: string           // 对应 CCO
  
  location: GeoLocation
  salary: SalarySnapshot
  employmentType: 'full-time' | 'part-time' | 'contract' | 'intern'
  
  description: string
  responsibilities: string[]
  requirements: string[]
  benefits: string[]
  
  // 技能要求
  requiredSkills: SkillRef[]
  preferredSkills: SkillRef[]
  
  // 匹配因子
  matchFactors: MatchFactor[]
  
  // 质量评分
  qualityScore: number       // 0-100
  
  // 状态
  status: 'active' | 'paused' | 'closed' | 'draft'
  postedAt: string
  expiresAt: string
  
  evidence: Evidence[]
  source: string
  updatedAt: string
}

/** 匹配因子 */
export interface MatchFactor {
  factor: string             // "skill_match" | "salary_fit" | "location_fit"
  weight: number
  value: number
  description: string
}

// ─── Candidate Canonical Object（CCO-Cand） ───

/** 候选人标准对象 — 每位用户全局唯一 */
export interface CandidateCanonicalObject {
  id: string
  version: string
  userId: string
  name: string
  
  // 基本信息
  education: Education[]
  experience: Experience[]
  skills: CandidateSkill[]
  
  // 偏好
  preferences: JobPreference
  
  // 职业目标
  careerGoal: string
  targetCareerIds: string[]
  
  // 匹配历史
  matchHistory: MatchHistoryEntry[]
  
  // 元数据
  completeness: number       // 画像完整度 0-100
  updatedAt: string
}

export interface Education {
  school: string
  degree: string
  major: string
  startYear: number
  endYear: number
}

export interface Experience {
  company: string
  title: string
  description: string
  startDate: string
  endDate: string
  skills: string[]
}

export interface CandidateSkill {
  skillId: string
  proficiency: 'beginner' | 'intermediate' | 'advanced' | 'expert'
  yearsOfExperience: number
  verified: boolean          // 是否通过测试/认证验证
}

export interface JobPreference {
  cities: string[]
  salaryMin: number
  salaryMax: number
  employmentTypes: string[]
  companySizes: string[]
  industries: string[]
  remotePreference: 'onsite' | 'hybrid' | 'remote' | 'flexible'
  avoidOvertime: boolean
}

export interface MatchHistoryEntry {
  jobId: string
  score: number
  timestamp: string
  action: 'viewed' | 'saved' | 'applied' | 'interviewed' | 'offered' | 'rejected'
}

// ─── Memory Canonical Object（MCO） ───

/** 记忆标准对象 — 每次记忆事件一条 */
export interface MemoryCanonicalObject {
  id: string
  userId: string
  
  // 记忆分层
  layer: 'working' | 'short' | 'long'
  type: 'preference' | 'fact' | 'decision' | 'feedback' | 'goal' | 'constraint'
  
  content: string
  confidence: number         // 0-1
  source: string             // 来源：对话/行为/外部数据
  
  // 时效性
  effectiveDate: string
  expirationDate?: string    // 可选过期时间
  
  // 关联
  relatedMemoryIds: string[]
  relatedEntityIds: string[] // 关联的 CCO/SCO/CJO id
  
  createdAt: string
  updatedAt: string
}

// ─── Schema 注册表（用于运行时校验） ───

export const SCHEMA_REGISTRY = {
  career: {
    version: '1.0.0',
    requiredFields: ['id', 'version', 'name', 'category', 'requiredSkills', 'salaryByLevel', 'fitProfile', 'transitions'],
    entityType: 'CareerCanonicalObject',
  },
  skill: {
    version: '1.0.0',
    requiredFields: ['id', 'version', 'name', 'category', 'prerequisites', 'relatedSkills'],
    entityType: 'SkillCanonicalObject',
  },
  company: {
    version: '1.0.0',
    requiredFields: ['id', 'version', 'name', 'industry', 'creditScore'],
    entityType: 'CompanyCanonicalObject',
  },
  job: {
    version: '1.0.0',
    requiredFields: ['id', 'version', 'title', 'companyId', 'careerId', 'requiredSkills'],
    entityType: 'JobCanonicalObject',
  },
  candidate: {
    version: '1.0.0',
    requiredFields: ['id', 'version', 'userId', 'skills', 'preferences'],
    entityType: 'CandidateCanonicalObject',
  },
  memory: {
    version: '1.0.0',
    requiredFields: ['id', 'userId', 'layer', 'type', 'content', 'confidence'],
    entityType: 'MemoryCanonicalObject',
  },
} as const

export type SchemaType = keyof typeof SCHEMA_REGISTRY
