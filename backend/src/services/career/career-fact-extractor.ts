// ─── Sprint-10B T02: Career Fact Extractor ─────
//
// 从用户自然语言输入中提取职业事实，输出到 CareerConversationProfile。
//
// 核心原则：
// 1. 只提取用户明确说的内容，不推断、不补全、不猜测
// 2. 每条提取记录 evidence（原文引用）
// 3. 不确定的内容标记 uncertainFacts，不进入 confirmedFacts
//
// 与 CareerExtractionService 的区别：
//   CareerExtractionService 处理 LLM 结构化输出 → CareerProfile DB 写入
//   CareerFactExtractor 处理 原始用户消息 → CareerConversationProfile JSON 更新
//
// 调用链：
//   userMessage → extractCareerFacts() → profile merge → detectMissingInformation

import type { CareerConversationProfile, CareerHistoryEntry, CareerSkill, ProjectEntry } from './career-conversation-profile.js'

// ─── 输出类型 ─────────────────────────────────────────

export interface FactExtractionOutput {
  /** 确定可以更新的字段（有足够证据） */
  fieldsToUpdate: Partial<CareerConversationProfile>
  /** 已确认的事实原文列表 */
  confirmedFacts: string[]
  /** 不确定的推断（不自动注入 profile） */
  uncertainFacts: Array<{ field: string; value: unknown; reason: string }>
  /** 检测到的仍然缺失的字段 */
  missingFields: string[]
}

// ─── 提取规则 ─────────────────────────────────────────

/** 姓名提取：我叫/我是/名字叫/姓名 后面跟的 2-4 字中文名 */
const NAME_PATTERNS = [
  /(?:我叫|我是|名字叫|名字是|姓名叫|姓名是)\s*([\u4e00-\u9fa5]{2,4})/,
  /^([\u4e00-\u9fa5]{2,4})(?:，|,|的|是|今年|做了|做)/,
]

/** 年龄提取 */
const AGE_PATTERN = /(\d{1,2})(?:岁|周岁|岁了)/

/** 工作年限提取 */
const EXP_YEARS_PATTERNS = [
  /(\d{1,2})(?:年经验|年工作|年从业|年做|年了|年多|年之久)/,
  /(?:工作|从业|做)(?:了)?(\d{1,2})(?:年|年多)/,
  /(\d{1,2})年(?:的开发|的经验|的经历)/,
]

/** 城市提取 */
const CITY_PATTERNS = [
  /(?:在|来自|坐标|base|人在)\s*([\u4e00-\u9fa5]{2,4})(?:的|，|,|。|工作|生活|发展)/,
  /^([\u4e00-\u9fa5]{2,4})(?:人|工作的|的)/,
]

/** 技能关键词检测 */
const SKILL_TRIGGERS = /(?:会|懂|擅长|做过|用过|熟悉|了解|掌握|精通|熟练)([\u4e00-\u9fa5a-zA-Z+#.]+)/g

/** 行业检测 */
const INDUSTRY_PATTERNS = [
  /(?:在|从事|属于)([\u4e00-\u9fa5]{2,10})(?:行业|领域|产业)/,
  /做([\u4e00-\u9fa5]{2,10})的/,
]

/** 目标岗位检测 */
const TARGET_ROLE_PATTERNS = [
  /(?:想做|想找|目标|期望|打算做|想当|想成为)([\u4e00-\u9fa5a-zA-Z]{2,20})(?:的岗位|的工作|方向)?/,
  /(?:(?:想|要|去)(做|搞|干))([\u4e00-\u9fa5a-zA-Z]{2,20})/,
]

/**
 * 从用户消息中提取职业事实
 *
 * @param message 用户原始输入
 * @param currentProfile 当前的 profile（用于检测已有字段，避免重复提取）
 * @returns 提取结果
 */
export function extractCareerFacts(
  message: string,
  currentProfile: CareerConversationProfile
): FactExtractionOutput {
  const fieldsToUpdate: Partial<CareerConversationProfile> = {}
  const confirmedFacts: string[] = []
  const uncertainFacts: Array<{ field: string; value: unknown; reason: string }> = []
  const missingFields: string[] = []

  // 1. 提取姓名
  const name = extractName(message)
  if (name && !currentProfile.identity.name) {
    fieldsToUpdate.identity = {
      ...(currentProfile.identity || {}),
      name,
    }
    confirmedFacts.push(`姓名：${name}（来源："${message.slice(0, 50)}"）`)
  }

  // 2. 提取年龄（不进 profile，仅辅助判断）
  const age = extractAge(message)

  // 3. 提取工作年限
  const expYears = extractExperienceYears(message)
  if (expYears !== null && currentProfile.experienceYears === 0) {
    // 防混淆：如果年龄 = 工龄 + 3 以内，可能是年龄误判
    if (age !== null && Math.abs(age - expYears) <= 3) {
      uncertainFacts.push({
        field: 'experienceYears',
        value: expYears,
        reason: `消息中检测到年龄(${age}岁)，提取的工龄(${expYears}年)与年龄接近，可能混淆`,
      })
    } else {
      fieldsToUpdate.experienceYears = expYears
      confirmedFacts.push(`工作年限：${expYears}年（来源："${message.slice(0, 50)}"）`)
    }
  }

  // 4. 提取城市
  const city = extractCity(message)
  if (city && !currentProfile.location.city) {
    fieldsToUpdate.location = {
      ...currentProfile.location,
      city,
    }
    confirmedFacts.push(`城市：${city}（来源："${message.slice(0, 50)}"）`)
  }

  // 5. 提取教育背景
  const education = extractEducation(message)
  if (education && !currentProfile.education.degree && !currentProfile.education.school) {
    fieldsToUpdate.education = {
      ...currentProfile.education,
      ...education,
    }
    const eduParts = [education.degree, education.school, education.major].filter(Boolean).join(' ')
    confirmedFacts.push(`教育：${eduParts}（来源："${message.slice(0, 50)}"）`)
  }

  // 6. 提取技能
  const skills = extractSkills(message, currentProfile)
  if (skills.length > 0) {
    const newSkills = skills.filter(s => !currentProfile.skills.some(existing => existing.name === s.name))
    if (newSkills.length > 0) {
      fieldsToUpdate.skills = [...currentProfile.skills, ...newSkills]
      for (const s of newSkills) {
        confirmedFacts.push(`技能：${s.name}（${s.level}，来源："${message.slice(0, 50)}"）`)
      }
    }
  }

  // 7. 提取行业
  const industry = extractIndustry(message)
  if (industry && !currentProfile.targetCareer.industry) {
    fieldsToUpdate.targetCareer = {
      ...currentProfile.targetCareer,
      industry,
    }
    confirmedFacts.push(`行业：${industry}（来源："${message.slice(0, 50)}"）`)
  }

  // 8. 提取目标岗位
  const targetRole = extractTargetRole(message)
  if (targetRole && !currentProfile.targetCareer.position) {
    fieldsToUpdate.targetCareer = {
      ...(fieldsToUpdate.targetCareer || currentProfile.targetCareer),
      position: targetRole,
    }
    confirmedFacts.push(`目标岗位：${targetRole}（来源："${message.slice(0, 50)}"）`)
  }

  // 9. 提取工作经历（简单处理）
  const workHistory = extractWorkHistory(message)
  if (workHistory.length > 0) {
    const newEntries = workHistory.filter(
      h => !currentProfile.careerHistory.some(
        existing => existing.company === h.company && existing.role === h.role
      )
    )
    if (newEntries.length > 0) {
      fieldsToUpdate.careerHistory = [...currentProfile.careerHistory, ...newEntries]
      for (const h of newEntries) {
        confirmedFacts.push(`工作：${h.role} @ ${h.company}（${h.years}，来源："${message.slice(0, 50)}"）`)
      }
    }
  }

  // 10. 提取项目经验
  const projects = extractProjects(message)
  if (projects.length > 0) {
    const newProjects = projects.filter(
      p => !currentProfile.projects.some(existing => existing.name === p.name)
    )
    if (newProjects.length > 0) {
      fieldsToUpdate.projects = [...currentProfile.projects, ...newProjects]
      for (const p of newProjects) {
        confirmedFacts.push(`项目：${p.name}（${p.description}，来源："${message.slice(0, 50)}"）`)
      }
    }
  }

  // 11. 提取求职状态/薪资
  const salary = extractSalary(message)
  if (salary && !currentProfile.jobSearch.salary) {
    fieldsToUpdate.jobSearch = {
      ...currentProfile.jobSearch,
      salary,
    }
    confirmedFacts.push(`期望薪资：${salary}`)
  }

  // 12. 计算缺失字段
  const profileAfter = applyPartialUpdate(currentProfile, fieldsToUpdate)
  missingFields.push(...computeMissingFields(profileAfter))

  return {
    fieldsToUpdate,
    confirmedFacts,
    uncertainFacts,
    missingFields,
  }
}

// ─── 私有提取函数 ───────────────────────────────────

function extractName(message: string): string | null {
  for (const pattern of NAME_PATTERNS) {
    const match = message.match(pattern)
    if (match) {
      return match[1]
    }
  }
  return null
}

function extractAge(message: string): number | null {
  const match = message.match(AGE_PATTERN)
  return match ? parseInt(match[1]) : null
}

function extractExperienceYears(message: string): number | null {
  for (const pattern of EXP_YEARS_PATTERNS) {
    const match = message.match(pattern)
    if (match) {
      return parseInt(match[1])
    }
  }
  return null
}

function extractCity(message: string): string | null {
  for (const pattern of CITY_PATTERNS) {
    const match = message.match(pattern)
    if (match) {
      return match[1]
    }
  }
  return null
}

function extractEducation(message: string): { degree?: string; major?: string; school?: string } | null {
  const result: { degree?: string; major?: string; school?: string } = {}

  // 学历检测
  const degreeMap: Record<string, string> = {
    '博士': '博士',
    '硕士': '硕士',
    '研究生': '硕士',
    '本科': '本科',
    '大专': '大专',
    '专科': '大专',
    '高中': '高中',
    '初中': '初中',
  }
  for (const [key, val] of Object.entries(degreeMap)) {
    if (message.includes(key)) {
      result.degree = val
      break
    }
  }

  // 学校检测：XX学校/XX大学/XX学院
  const schoolMatch = message.match(/([\u4e00-\u9fa5]{2,10})(?:大学|学院|学校|职校|技校)/)
  if (schoolMatch) {
    result.school = schoolMatch[0]
  }

  // 专业检测
  const majorMatch = message.match(/(?:专业是|学的|就读|主修|专业为)\s*([\u4e00-\u9fa5]{2,10})/)
  if (majorMatch) {
    result.major = majorMatch[1]
  }

  return Object.keys(result).length > 0 ? result : null
}

function extractSkills(message: string, currentProfile: CareerConversationProfile): CareerSkill[] {
  const skills: CareerSkill[] = []

  // 模式1：会/懂/擅长/做过/用过/熟悉/了解/掌握/精通/熟练 + 技能名
  const skillMatches = message.matchAll(SKILL_TRIGGERS)
  for (const match of skillMatches) {
    const skillName = match[1].trim()
    if (skillName && skillName.length >= 1 && skillName.length <= 30) {
      // 排除非技能词
      const nonSkillWords = ['这些', '那个', '什么', '哪些', '很多', '一点', '一些']
      if (!nonSkillWords.includes(skillName)) {
        skills.push({
          name: skillName,
          level: mapSkillLevel(match[0]),
          evidence: message.slice(0, 100),
        })
      }
    }
  }

  // 模式2：显式列出的技能（逗号/空格分隔的列表）
  if (skills.length === 0) {
    const listMatch = message.match(/(?:技能|会的|掌握|技术栈)[：:]\s*([\u4e00-\u9fa5a-zA-Z+#./]+(?:[,，、/\s][\u4e00-\u9fa5a-zA-Z+#./]+){0,10})/)
    if (listMatch) {
      const items = listMatch[1].split(/[,，、/\s]+/).filter(s => s.trim().length > 0 && s.trim().length <= 20)
      for (const item of items) {
        skills.push({
          name: item.trim(),
          level: 'confirmed',
          evidence: message.slice(0, 100),
        })
      }
    }
  }

  return skills.filter(s => !currentProfile.skills.some(existing => existing.name === s.name))
}

function mapSkillLevel(trigger: string): string {
  if (/精通|非常熟悉|专家/.test(trigger)) return 'expert'
  if (/熟练|熟悉|掌握/.test(trigger)) return 'advanced'
  if (/了解|知道|接触/.test(trigger)) return 'basic'
  if (/做过|用过|会/.test(trigger)) return 'intermediate'
  return 'confirmed'
}

function extractIndustry(message: string): string | null {
  for (const pattern of INDUSTRY_PATTERNS) {
    const match = message.match(pattern)
    if (match) return match[1]
  }
  return null
}

function extractTargetRole(message: string): string | null {
  for (const pattern of TARGET_ROLE_PATTERNS) {
    const match = message.match(pattern)
    if (match) {
      // 取最右的捕获组（非空的那个）
      for (let i = match.length - 1; i >= 1; i--) {
        if (match[i] && match[i].trim().length >= 2) return match[i].trim()
      }
    }
  }
  return null
}

function extractWorkHistory(message: string): CareerHistoryEntry[] {
  const entries: CareerHistoryEntry[] = []

  // 模式：在XX公司做XX（X年）
  const companyPattern = /在([\u4e00-\u9fa5a-zA-Z]{2,20})(?:公司|企业|集团|单位)?(?:做|担任|干了|工作了|负责|任职)?\s*([\u4e00-\u9fa5a-zA-Z]{2,20})?(?:的)?(?:工作|岗位|职位)?(?:，|,)?(?:干[了]?)?(\d{1,2})?(?:年|年多|年之久)?/
  const match = message.match(companyPattern)
  if (match) {
    entries.push({
      company: match[1] + (match[1].includes('公司') ? '' : (message.includes(match[1] + '公司') ? '公司' : '')),
      role: match[2] || '',
      years: match[3] ? `${match[3]}年` : '',
      description: message.slice(0, 100),
      evidence: message.slice(0, 100),
    })
  }

  return entries
}

function extractProjects(message: string): ProjectEntry[] {
  const entries: ProjectEntry[] = []

  // 模式：做过/负责/开发了 XX项目/系统
  const projectPattern = /(?:做过|负责|参与|开发了|设计了|主导|完成)(?:一个|过|了)?\s*([\u4e00-\u9fa5a-zA-Z]{2,30})(?:项目|系统|平台|工具|产品)?/
  const match = message.match(projectPattern)
  if (match) {
    entries.push({
      name: match[1] + (message.includes(match[1] + '项目') ? '项目' : message.includes(match[1] + '系统') ? '系统' : ''),
      description: message.slice(0, 100),
      technology: '',
      evidence: message.slice(0, 100),
    })
  }

  return entries
}

function extractSalary(message: string): string | null {
  // 薪资模式：期望XX-XXK / 月薪X万 / 薪资XX
  const patterns = [
    /期望(?:薪资|薪水|工资)[：:]?\s*(\d+[Kk万wW]?\s*[-–~至]+\s*\d+[Kk万wW]?)/,
    /(\d+[Kk万wW]?\s*[-–~至]+\s*\d+[Kk万wW]?)\s*(?:的)?(?:薪资|薪水|工资|期望)/,
    /月薪[：:]?\s*(\d+[Kk万wW]?)/,
    /(?:薪资|薪水|工资)[：:]?\s*(\d+[Kk万wW]?\s*[-–~至]+\s*\d+[Kk万wW]?)/,
    /(\d+)[Kk]\s*[-–~至]+\s*(\d+)[Kk]/,
  ]

  for (const pattern of patterns) {
    const match = message.match(pattern)
    if (match) return match[1]
  }

  return null
}

/**
 * 对 profile 应用部分更新（不修改原对象）
 * 用于计算更新后的缺失字段
 */
function applyPartialUpdate(
  current: CareerConversationProfile,
  updates: Partial<CareerConversationProfile>
): CareerConversationProfile {
  return {
    ...current,
    identity: updates.identity ? { ...current.identity, ...updates.identity } : current.identity,
    location: updates.location ? { ...current.location, ...updates.location } : current.location,
    education: updates.education ? { ...current.education, ...updates.education } : current.education,
    careerHistory: updates.careerHistory || current.careerHistory,
    experienceYears: updates.experienceYears ?? current.experienceYears,
    skills: updates.skills || current.skills,
    projects: updates.projects || current.projects,
    achievements: updates.achievements || current.achievements,
    targetCareer: updates.targetCareer ? { ...current.targetCareer, ...updates.targetCareer } : current.targetCareer,
    jobSearch: updates.jobSearch ? { ...current.jobSearch, ...updates.jobSearch } : current.jobSearch,
    confirmedFacts: updates.confirmedFacts || current.confirmedFacts,
    missingInformation: updates.missingInformation || current.missingInformation,
  }
}

function computeMissingFields(profile: CareerConversationProfile): string[] {
  const missing: string[] = []
  if (!profile.identity.name) missing.push('姓名')
  if (!profile.location.city) missing.push('城市')
  if (!profile.education.degree) missing.push('学历')
  if (!profile.education.school) missing.push('学校')
  if (!profile.education.major) missing.push('专业')
  if (profile.careerHistory.length === 0) missing.push('工作经历')
  if (profile.experienceYears === 0) missing.push('工作年限')
  if (profile.skills.length === 0) missing.push('技能')
  if (profile.projects.length === 0) missing.push('项目经验')
  if (!profile.targetCareer.position) missing.push('目标岗位')
  if (!profile.targetCareer.industry) missing.push('目标行业')
  if (!profile.jobSearch.salary) missing.push('期望薪资')
  return missing
}
