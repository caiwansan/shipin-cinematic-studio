// ─── Sprint-09E-02 Task 03.1 CareerFieldPolicy ─────
// 声明式字段策略表：CareerProfile 的每个字段规定写入规则，
// 取代散落在 switch-case 中的隐式逻辑。

/**
 * 字段策略枚举
 *
 * user_only         — 仅用户亲口说才写（如姓名、公司）
 * user_confirmed    — 用户提及 + AI 确认才写（如技能、方向）
 * user_review       — 必须用户回检查看后才写（如完整简历）
 * derived_only      — 仅作为 AI 推断，不进 CareerProfile（如推荐方向）
 * system            — 系统管理字段（id、createdAt 等）
 */
export type FieldPolicy = 'user_only' | 'user_confirmed' | 'user_review' | 'derived_only' | 'system'

/**
 * 每一字段的完整策略定义
 */
export interface CareerFieldPolicyEntry {
  field: string
  policy: FieldPolicy
  /** 中文描述（产品/运营可读） */
  label: string
  /** 最小置信度阈值（低于此不进 Profile） */
  minConfidence: number
  /** 是否可被 AI 推断 */
  allowInfer: boolean
  /** 写入目标（CareerProfile 字段名 / sub-table / derived） */
  target: string
  /** 说明 */
  note: string
}

/**
 * 字段策略表（唯一真相源）
 *
 * 所有 CareerProfile 的写入决策必须查此表。
 */
export const CAREER_FIELD_POLICY: Record<string, CareerFieldPolicyEntry> = {
  // ── 基本信息 ──
  fullName: {
    field: 'fullName',
    policy: 'user_only',
    label: '姓名',
    minConfidence: 90,
    allowInfer: false,
    target: 'CareerProfile.fullName',
    note: '仅用户明确说"我叫/我是"时写入。AI 推断的姓名不进 Profiles。',
  },
  headline: {
    field: 'headline',
    policy: 'user_confirmed',
    label: '职业头衔',
    minConfidence: 80,
    allowInfer: true,
    target: 'CareerProfile.headline',
    note: '可从对话摘要。但建议用户确认后写入。',
  },
  bio: {
    field: 'bio',
    policy: 'user_review',
    label: '个人简介',
    minConfidence: 70,
    allowInfer: true,
    target: 'CareerProfile.bio',
    note: 'AI 可生成草稿，但用户必须确认。',
  },
  city: {
    field: 'city',
    policy: 'user_only',
    label: '所在城市',
    minConfidence: 90,
    allowInfer: false,
    target: 'CareerProfile.city',
    note: '用户明确说城市时写。不做 IP 推断。',
  },
  avatarUrl: {
    field: 'avatarUrl',
    policy: 'user_only',
    label: '头像',
    minConfidence: 95,
    allowInfer: false,
    target: 'CareerProfile.avatarUrl',
    note: '仅用户上传/选择时写入。AI 不产生。',
  },
  email: {
    field: 'email',
    policy: 'user_only',
    label: '邮箱',
    minConfidence: 95,
    allowInfer: false,
    target: 'CareerProfile.email',
    note: '隐私字段，必须用户主动提供。',
  },
  phone: {
    field: 'phone',
    policy: 'user_only',
    label: '电话',
    minConfidence: 95,
    allowInfer: false,
    target: 'CareerProfile.phone',
    note: '隐私字段，必须用户主动提供。',
  },

  // ── 职业方向 ──
  careerDirection: {
    field: 'careerDirection',
    policy: 'user_confirmed',
    label: '职业方向',
    minConfidence: 85,
    allowInfer: true,
    target: 'CareerProfile.careerDirection',
    note: '用户说"我做XX"时写。AI可基于上下文推断但做 suggest。',
  },
  industry: {
    field: 'industry',
    policy: 'user_confirmed',
    label: '所属行业',
    minConfidence: 85,
    allowInfer: false,
    target: 'CareerProfile.industry',
    note: '🔴 行业推断只作为 Derived Insights。用户明确说"在XX行业/做XX的"时才能写。',
  },
  yearsExperience: {
    field: 'yearsExperience',
    policy: 'user_only',
    label: '工作年限',
    minConfidence: 90,
    allowInfer: false,
    target: 'CareerProfile.yearsExperience',
    note: '🟡 年龄误判防护。仅用户说"X年经验/工作X年"时写。"我X岁"的年限提取 100%拒绝。',
  },
  currentLevel: {
    field: 'currentLevel',
    policy: 'user_confirmed',
    label: '当前职级',
    minConfidence: 80,
    allowInfer: true,
    target: 'CareerProfile.currentLevel',
    note: '用户说"我是高级/资深/总监"时写。AI 可建议但需确认。',
  },

  // ── 子表字段（通过 upsert 间接写入）──
  skills: {
    field: 'skills',
    policy: 'user_confirmed',
    label: '技能',
    minConfidence: 85,
    allowInfer: true,
    target: 'CandidateSkill.skillName',
    note: '用户提到的技能 → write。AI推断的技能 → suggest（需要用户确认）。',
  },
  workHistory: {
    field: 'workHistory',
    policy: 'user_only',
    label: '工作经历',
    minConfidence: 90,
    allowInfer: false,
    target: 'WorkExperience',
    note: '🟡 虚构公司检测。仅用户明确说出公司+岗位时写。"某公司"直接拒绝。',
  },
  education: {
    field: 'education',
    policy: 'user_only',
    label: '教育经历',
    minConfidence: 90,
    allowInfer: false,
    target: 'Education',
    note: '仅用户明确说出学校+专业+学历时写。',
  },

  // ── 衍生字段（不进 CareerProfile）──
  targetRole: {
    field: 'targetRole',
    policy: 'derived_only',
    label: '推荐岗位方向',
    minConfidence: 60,
    allowInfer: true,
    target: 'DerivedInsights',
    note: 'AI 基于分析给出的职业建议。不进 CareerProfile。',
  },
  recommendedDirection: {
    field: 'recommendedDirection',
    policy: 'derived_only',
    label: '建议发展路径',
    minConfidence: 60,
    allowInfer: true,
    target: 'DerivedInsights',
    note: 'AI 推断的建议方向。不进 CareerProfile。',
  },
  possibleLevel: {
    field: 'possibleLevel',
    policy: 'derived_only',
    label: '可能适合的职级',
    minConfidence: 55,
    allowInfer: true,
    target: 'DerivedInsights',
    note: 'AI 评估后给出的职级建议。不进 CareerProfile。',
  },
}

/**
 * 根据字段名获取策略
 */
export function getFieldPolicy(field: string): CareerFieldPolicyEntry | undefined {
  // 直接匹配
  const direct = CAREER_FIELD_POLICY[field]
  if (direct) return direct

  // 别名匹配（如 workExperience → workHistory）
  const aliasMap: Record<string, string> = {
    workExperience: 'workHistory',
    currentTitle: 'headline',
    targetIndustry: 'industry',
    targetRole: 'targetRole',
    recommendedRole: 'recommendedDirection',
  }
  const canonical = aliasMap[field]
  return canonical ? CAREER_FIELD_POLICY[canonical] : undefined
}

/**
 * 判断某个 action 在当前字段策略下是否允许
 */
export function isActionAllowed(
  field: string,
  source: string,
  confidence: number
): { allowed: boolean; reason?: string } {
  const policy = getFieldPolicy(field)
  if (!policy) {
    // 无策略的字段按保守原则处理
    return { allowed: source === 'user_explicit', reason: '无策略定义，保守拒绝' }
  }

  // 策略：system 字段不允许写入
  if (policy.policy === 'system') {
    return { allowed: false, reason: '系统管理字段' }
  }

  // 策略：derived_only 不允许写入
  if (policy.policy === 'derived_only') {
    return { allowed: false, reason: `策略为 derived_only，不进 CareerProfile` }
  }

  // 信任度门槛
  if (confidence < policy.minConfidence) {
    return { allowed: false, reason: `置信度${confidence}%低于门槛${policy.minConfidence}%` }
  }

  // 策略：user_only 且非 user_explicit/user_confirmed 源 → 拒绝
  if (policy.policy === 'user_only' && source !== 'user_explicit' && source !== 'user_confirmed') {
    return { allowed: false, reason: `仅用户明确提供(${policy.policy}), 当前来源=${source}` }
  }

  // 策略：不允许 AI 推断但 source 是 ai_inferred → 拒绝
  if (!policy.allowInfer && source === 'ai_inferred') {
    return { allowed: false, reason: `不允许 AI 推断` }
  }

  return { allowed: true }
}
