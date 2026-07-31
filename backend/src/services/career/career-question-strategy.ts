// ─── Sprint-10B T04: Dynamic Question Strategy ─────
//
// 废弃固定问卷式追问。
// 根据 CareerConversationProfile 的 missingInformation 动态生成下一问题。
//
// 这是一组策略函数，返回问题建议。
// LLM 最终决定是否采纳（LLM 有上下文理解，策略是参考）。
//
// 规则：
// 1. 一次只问 1-2 个问题
// 2. 不重复问已有的信息
// 3. 基于已有信息个性化提问
// 4. 禁止选择题（"你想做技术还是管理？" → ❌）
// 5. 需要上下文追问时，参考 lastMessage

import type { CareerConversationProfile } from './career-conversation-profile.js'
import { detectMissingInformation } from './career-conversation-profile.js'

// ─── 输出类型 ─────────────────────────────────────────

export interface QuestionSuggestion {
  /** 建议询问的字段 */
  targetField: string
  /** 建议的问题文本 */
  question: string
  /** 优先级（数字越小越优先） */
  priority: number
  /** 为什么问这个问题 */
  reason: string
}

// ─── 策略函数 ─────────────────────────────────────────

/**
 * 根据 Profile 和用户最后一条消息，生成下一条最合适的追问
 *
 * 核心逻辑：
 * 1. 检查用户最后一条消息是否包含新的可提取信息（由 extractCareerFacts 处理）
 * 2. 找出最关键的缺失字段
 * 3. 基于用户已有信息个性化询问
 *
 * @param profile 当前职业画像
 * @param lastMessage 用户最后一条消息
 * @returns 排序后的问题建议列表（推荐取第一个）
 */
export function generateNextCareerQuestion(
  profile: CareerConversationProfile,
  lastMessage?: string
): QuestionSuggestion[] {
  const missing = detectMissingInformation(profile)
  const suggestions: QuestionSuggestion[] = []

  // 如果用户最后一条消息含有新信息，不做追问（等 LLM 处理回复）
  if (lastMessage && hasNewFacts(lastMessage, profile)) {
    return []
  }

  // ─── 策略 1: 基础身份信息 ───
  if (missing.includes('姓名') && missing.includes('城市')) {
    suggestions.push({
      targetField: 'identity',
      question: '你好！我是你的职业顾问 😊 先简单介绍一下自己吧——怎么称呼你？目前在哪个城市？',
      priority: 1,
      reason: '新用户首次对话，需要基本信息',
    })
  } else if (missing.includes('姓名')) {
    suggestions.push({
      targetField: 'identity',
      question: '还没请教你怎么称呼呢？',
      priority: 1,
      reason: '需要知道用户姓名',
    })
  } else if (missing.includes('城市')) {
    const name = profile.identity.name || '您'
    suggestions.push({
      targetField: 'location',
      question: `${name}目前在哪个城市发展？`,
      priority: 2,
      reason: '需要了解用户所在地',
    })
  }

  // ─── 策略 2: 教育背景 ───
  if (missing.includes('学历') || missing.includes('学校')) {
    const name = profile.identity.name || '您'
    if (!profile.education.degree && !profile.education.school && !profile.education.major) {
      suggestions.push({
        targetField: 'education',
        question: `${name}的教育背景是怎样的？方便说说最高学历、学校和专业吗？`,
        priority: 3,
        reason: '教育背景是基础信息',
      })
    } else if (!profile.education.degree) {
      suggestions.push({
        targetField: 'education',
        question: `${name}的最高学历是什么？`,
        priority: 3,
        reason: '缺学历信息',
      })
    } else if (!profile.education.school) {
      suggestions.push({
        targetField: 'education',
        question: `${name}毕业于哪所院校？`,
        priority: 3,
        reason: '缺学校信息',
      })
    }
  }

  // ─── 策略 3: 工作经历（基于方向个性化） ───
  if (missing.includes('工作年限') || missing.includes('工作经历')) {
    const name = profile.identity.name || '您'
    const direction = profile.targetCareer.direction || profile.targetCareer.position

    if (direction) {
      suggestions.push({
        targetField: 'experience',
        question: `${name}在${direction}方面有多久的工作经验？能简单介绍一下经历吗？`,
        priority: 4,
        reason: `用户提过方向(${direction})，针对方向询问`,
      })
    } else if (profile.skills.length > 0) {
      const skillStr = profile.skills.slice(0, 3).map(s => s.name).join('、')
      suggestions.push({
        targetField: 'experience',
        question: `你掌握了${skillStr}这些技能，在实际工作中是怎么应用的？`,
        priority: 4,
        reason: `用户提到技能(${skillStr})，结合实际询问`,
      })
    } else {
      suggestions.push({
        targetField: 'experience',
        question: `${name}工作多少年了？可以简单介绍下职业经历吗？`,
        priority: 4,
        reason: '基本工作经历询问',
      })
    }
  }

  // ─── 策略 4: 技能（基于经历个性化） ───
  if (missing.includes('技能')) {
    if (profile.careerHistory.length > 0) {
      const lastRole = profile.careerHistory[profile.careerHistory.length - 1].role
      suggestions.push({
        targetField: 'skills',
        question: `在做${lastRole}期间，你主要使用了哪些技能或工具？`,
        priority: 5,
        reason: '基于工作经历询问技能',
      })
    } else if (profile.experienceYears > 0) {
      suggestions.push({
        targetField: 'skills',
        question: `你${profile.experienceYears}年工作经验中，掌握了哪些核心技能？`,
        priority: 5,
        reason: '基于工作年限询问技能',
      })
    } else {
      suggestions.push({
        targetField: 'skills',
        question: '你擅长哪些方面的技能？可以列举一下。',
        priority: 5,
        reason: '基本技能询问',
      })
    }
  }

  // ─── 策略 5: 项目经验（基于技能个性化） ───
  if (missing.includes('项目经验')) {
    if (profile.skills.length > 0) {
      const topSkills = profile.skills.slice(0, 2).map(s => s.name).join('和')
      suggestions.push({
        targetField: 'projects',
        question: `能介绍一个你用${topSkills}做过的项目或作品吗？`,
        priority: 6,
        reason: `基于技能(${topSkills})询问项目`,
      })
    } else {
      suggestions.push({
        targetField: 'projects',
        question: '你过去做过最有成就感的项目是什么？简单介绍一下。',
        priority: 6,
        reason: '基本项目询问',
      })
    }
  }

  // ─── 策略 6: 职业目标 ───
  const targetMissing = !profile.targetCareer.position && !profile.targetCareer.direction
  if (targetMissing && missing.includes('目标岗位') === false) {
    // 有技能/经历但无目标
    if (profile.skills.length > 0 || profile.careerHistory.length > 0) {
      suggestions.push({
        targetField: 'target',
        question: '了解了你的背景。你接下来想往什么方向发展？有没有具体想做的岗位？',
        priority: 7,
        reason: '有背景无目标，需要了解方向',
      })
    }
  }
  if (missing.includes('目标岗位')) {
    suggestions.push({
      targetField: 'target',
      question: '你有具体想做什么岗位吗？或者有什么方向比较感兴趣？',
      priority: 7,
      reason: '缺目标岗位',
    })
  }

  // ─── 策略 7: 求职状态 ───
  if (missing.includes('期望薪资')) {
    suggestions.push({
      targetField: 'jobSearch',
      question: '你的期望薪资大概在什么范围？',
      priority: 8,
      reason: '缺薪资信息',
    })
  }

  // 按优先级排序
  suggestions.sort((a, b) => a.priority - b.priority)

  // 只返回前 3 条（给 LLM 参考）
  return suggestions.slice(0, 3)
}

/**
 * 检查用户消息是否包含新的事实
 * 如果有新事实，不应该问问题，应该处理新信息
 */
function hasNewFacts(message: string, profile: CareerConversationProfile): boolean {
  const indicators = [
    /我叫|我是|名字|姓名/,
    /年经验|年工作|年从业/,
    /在.*(?:城市|人|工作)/,
    /会|懂|擅长|做过|用过|熟悉|掌握|精通/,
    /本科|硕士|博士|大专|学历/,
    /想做|想找|目标|期望|打算/,
    /在.*公司/,
    /薪资|薪水|工资/,
  ]

  for (const pattern of indicators) {
    if (pattern.test(message)) {
      // 但如果 profile 已有对应字段，可能是在重复/确认
      return true
    }
  }

  return false
}
