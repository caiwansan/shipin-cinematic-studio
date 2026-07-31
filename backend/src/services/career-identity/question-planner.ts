// ─── Sprint-10C T05: QuestionPlanner ───
// 逻辑驱动，决定下一轮问什么问题。
// LLM 不参与问题决策。LLM 只负责自然语言表达。

import { CareerIdentityProfile } from './types'

export interface QuestionPlan {
  /** 要问的字段 */
  targetField: string | null
  /** 自然语言问题 */
  question: string
  /** 是否已无问题可问（画像完成） */
  isComplete: boolean
  /** 推荐行为 */
  action: 'ask' | 'summarize' | 'suggest' | 'resume'
}

const QUESTION_TEMPLATES: Record<string, string[]> = {
  name: [
    '怎么称呼你？',
    '方便告诉我你的名字吗？',
  ],
  careerDirection: [
    '你希望从事什么类型的工作或行业？',
    '你目前的方向是什么？方便介绍一下吗？',
  ],
  targetPosition: [
    '你理想的岗位是什么？',
    '你希望做什么样的职位？',
  ],
  experience: [
    '你在相关领域有多少年工作经验？',
    '方便说说你工作多少年了吗？',
  ],
  skills: [
    '你有哪些核心技能或技术特长？',
    '你擅长哪些技术或领域？',
  ],
  city: [
    '你目前在哪个城市？或者期望在哪个城市工作？',
    '你的工作地点是在哪里？',
  ],
  education: [
    '你的教育背景是什么？比如学校、专业？',
    '方便说说你的学历和专业吗？',
  ],
  targetIndustry: [
    '你希望进入什么行业？',
    '你对哪个行业比较感兴趣？',
  ],
  salary: [
    '你对薪资有什么期望？',
    '期望的薪资范围大概是多少？',
  ],
}

const FIELD_PRIORITY: Record<string, number> = {
  name: 1,
  careerDirection: 2,
  targetPosition: 3,
  experience: 4,
  skills: 5,
  city: 6,
  education: 7,
  targetIndustry: 8,
  salary: 9,
}

/**
 * 根据 Profile 决定下一问题
 */
export function planNextQuestion(profile: CareerIdentityProfile): QuestionPlan {
  const missing = profile.missingFields

  // 已无缺失 → 画像完成
  if (missing.length === 0) {
    return {
      targetField: null,
      question: generateCompletionMessage(profile),
      isComplete: true,
      action: profile.completionScore >= 80 ? 'resume' : 'summarize',
    }
  }

  // 按优先级排序
  const sortedMissing = [...missing].sort(
    (a, b) => (FIELD_PRIORITY[a] || 99) - (FIELD_PRIORITY[b] || 99)
  )

  const targetField = sortedMissing[0]
  const templates = QUESTION_TEMPLATES[targetField]
  if (!templates || templates.length === 0) {
    // 无模板，用通用问法
    return {
      targetField,
      question: `方便说一下你的${getFieldLabel(targetField)}吗？`,
      isComplete: false,
      action: 'ask',
    }
  }

  // 选择模板（根据已有信息量决定用哪个版本）
  const hasSomeInfo = profile.confirmedFacts.length > 0
  const templateIndex = hasSomeInfo ? Math.floor(Math.random() * templates.length) : 0
  let question = templates[templateIndex]

  // 如果有姓名，加个性化前缀
  if (profile.identity.name) {
    question = `${profile.identity.name}，${question}`
  }

  return {
    targetField,
    question,
    isComplete: false,
    action: 'ask',
  }
}

function getFieldLabel(field: string): string {
  const labels: Record<string, string> = {
    name: '姓名',
    careerDirection: '职业方向',
    targetPosition: '目标岗位',
    experience: '工作年限',
    skills: '技能',
    city: '城市',
    education: '教育背景',
    targetIndustry: '目标行业',
    salary: '薪资期望',
  }
  return labels[field] || field
}

/**
 * 生成画像完成时的引导语
 */
function generateCompletionMessage(profile: CareerIdentityProfile): string {
  const hasName = profile.identity.name
  const hasExperience = profile.career.yearsExperience
  const hasSkills = profile.skills.length > 0
  const hasTarget = profile.career.targetPosition || profile.career.careerDirection

  const intro = hasName ? `${profile.identity.name}，` : ''

  if (profile.completionScore >= 80) {
    return `${intro}你的职业画像已经比较完整了${getProfileSummary(profile)}。要不要我帮你生成一份简历草稿？`
  }

  return `${intro}我已经了解了你的基本情况${getProfileSummary(profile)}。还有什么想聊的吗？`
}

/**
 * 生成画像摘要
 */
function getProfileSummary(profile: CareerIdentityProfile): string {
  const parts: string[] = []
  if (profile.career.careerDirection) parts.push(profile.career.careerDirection)
  if (profile.career.yearsExperience) parts.push(`${profile.career.yearsExperience}年经验`)
  if (profile.skills.length > 0) parts.push(`擅长${profile.skills.slice(0, 3).map(s => s.name).join('、')}`)
  return parts.length > 0 ? `（${parts.join('，')}）` : ''
}
