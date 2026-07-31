// ─── Sprint-10C T04: ContextBuilder ───
// 从 CareerIdentityProfile 构建 LLM Prompt 上下文
// Profile → JSON → Context String

import { CareerIdentityProfile } from './types'

export interface LLMContext {
  /** 确认事实文本 */
  factsBlock: string
  /** 缺失字段文本 */
  missingBlock: string
  /** 当前状态 */
  statusBlock: string
  /** 拼接后的完整上下文 */
  fullContext: string
  /** 下一步推荐问什么 */
  suggestedNextField: string | null
}

/**
 * 从 Profile 构建 LLM 上下文
 */
export function buildLLMContext(profile: CareerIdentityProfile): LLMContext {
  const lines: string[] = []

  // ── 事实块 ──
  lines.push('[Confirmed Facts]')
  const facts: string[] = []
  if (profile.identity.name) facts.push(`姓名：${profile.identity.name}`)
  if (profile.identity.age) facts.push(`年龄：${profile.identity.age}岁`)
  if (profile.location.currentCity) facts.push(`城市：${profile.location.currentCity}`)
  if (profile.career.careerDirection) facts.push(`职业方向：${profile.career.careerDirection}`)
  if (profile.career.targetPosition) facts.push(`目标岗位：${profile.career.targetPosition}`)
  if (profile.career.targetIndustry) facts.push(`目标行业：${profile.career.targetIndustry}`)
  if (profile.career.yearsExperience) facts.push(`工作年限：${profile.career.yearsExperience}年`)
  if (profile.career.currentStatus) facts.push(`当前状态：${profile.career.currentStatus}`)
  if (profile.education.degree || profile.education.school || profile.education.major) {
    const eduParts = [profile.education.degree, profile.education.school, profile.education.major].filter(Boolean)
    facts.push(`教育背景：${eduParts.join(' ')}`)
  }
  if (profile.skills.length > 0) {
    facts.push(`技能：${profile.skills.map(s => s.name).join('、')}`)
  }
  if (profile.workExperience.length > 0) {
    for (const w of profile.workExperience) {
      facts.push(`工作经历：${w.company} ${w.position}${w.years ? ` (${w.years}年)` : ''}`)
    }
  }
  if (profile.jobPreference.salary) facts.push(`期望薪资：${profile.jobPreference.salary}`)
  if (profile.jobPreference.location) facts.push(`期望地点：${profile.jobPreference.location}`)
  if (profile.jobPreference.remote) facts.push('接受远程工作')

  if (facts.length === 0) {
    facts.push('（尚未采集）')
  }
  lines.push(facts.join('\n'))
  lines.push('')
  lines.push('注意：以上是已确认事实，禁止重复询问。')

  // ── 缺失块 ──
  lines.push('')
  lines.push('[Missing Fields]')
  const missing = profile.missingFields
  if (missing.length > 0) {
    lines.push(missing.join('\n'))
    lines.push('')
    lines.push('以上字段用户未提供，用开放式问题引导用户补充。')
    lines.push('每次最多问 1-2 个问题，不要一次性问全部。')
  } else {
    lines.push('无关键缺失')
  }

  // ── 状态块 ──
  lines.push('')
  lines.push(`[Status] ${profile.status}`)
  lines.push(`完成度：${profile.completionScore}%`)
  lines.push('')

  // ====== 推断下一步要问什么 ======
  const suggestedField = suggestNextField(profile)
  if (suggestedField) {
    lines.push(`[Next Suggestion] 建议询问：${suggestedField}`)
  }

  const fullContext = lines.join('\n')

  return {
    factsBlock: facts.join('\n'),
    missingBlock: missing.join('\n'),
    statusBlock: `Status: ${profile.status} | 完成度: ${profile.completionScore}%`,
    fullContext,
    suggestedNextField: suggestedField,
  }
}

/**
 * 根据 Profile 状态推荐下一个问题
 * 逻辑驱动，LLM 不参与决策
 */
function suggestNextField(profile: CareerIdentityProfile): string | null {
  const missing = profile.missingFields

  if (missing.length === 0) return null

  // 优先级排序
  const priority: Record<string, { label: string; order: number }> = {
    name: { label: '姓名', order: 1 },
    careerDirection: { label: '职业方向', order: 2 },
    targetPosition: { label: '目标岗位', order: 3 },
    experience: { label: '工作年限', order: 4 },
    skills: { label: '核心技能', order: 5 },
    city: { label: '城市', order: 6 },
    education: { label: '教育背景', order: 7 },
    targetIndustry: { label: '目标行业', order: 8 },
    salary: { label: '薪资期望', order: 9 },
  }

  // 按优先级排序
  const sorted = missing
    .filter(f => priority[f])
    .sort((a, b) => (priority[a]?.order || 99) - (priority[b]?.order || 99))

  if (sorted.length > 0) {
    const field = sorted[0]
    const info = priority[field]
    return info ? info.label : field
  }

  return missing[0]
}
