// ─── Sprint-10B T03: Career Conversation Context Builder ─────
//
// 从 CareerConversationProfile 构建 LLM Prompt 上下文。
//
// 每次调用 LLM 前执行。
// 输入：CareerConversationProfile
// 输出：{ identityCard, confirmedFacts, missingInformation, conversationStage }
//
// 注入到 System Prompt 中：
// "你是一名职业顾问。以下 JSON 是用户已经确认的信息..."
//
// 约束：
// 1. 不重复询问已有信息
// 2. 不创造用户没有提供的经历
// 3. 优先补充 missingInformation
// 4. 每次交流推动职业画像完善

import type { CareerConversationProfile } from './career-conversation-profile.js'
import { formatProfileForPrompt, detectMissingInformation } from './career-conversation-profile.js'

// ─── 对话阶段 ─────────────────────────────────────────

export type ConversationStage =
  | 'initial'        // 刚开始，需要了解基本信息
  | 'identity'       // 了解姓名/城市等基本信息
  | 'education'      // 教育背景
  | 'experience'     // 工作经验和年限
  | 'skills'         // 技能和项目
  | 'target'         // 职业目标和方向
  | 'job_search'     // 求职状态和期望
  | 'complete'       // 信息基本完整
  | 'consultation'   // 自由咨询/建议模式

// ─── 输出类型 ─────────────────────────────────────────

export interface CareerConversationContext {
  /** 格式化后的身份卡文本（注入 Prompt） */
  identityCard: string
  /** 已确认事实列表 */
  confirmedFacts: string[]
  /** 缺失信息 */
  missingInformation: string[]
  /** 当前对话阶段 */
  conversationStage: ConversationStage
  /** 完整 Profile JSON（用于系统处理） */
  profile: CareerConversationProfile
}

// ─── 阶段判断 ─────────────────────────────────────────

/**
 * 根据 Profile 数据丰富程度判断当前对话阶段
 */
export function determineConversationStage(profile: CareerConversationProfile): ConversationStage {
  // 完全空白 → initial
  if (!profile.identity.name && !profile.location.city && !profile.education.degree && profile.experienceYears === 0 && profile.skills.length === 0 && !profile.targetCareer.position) {
    return 'initial'
  }

  // 信息基本完整 → complete
  const hasBasicInfo = !!profile.identity.name
  const hasExperience = profile.experienceYears > 0 || profile.careerHistory.length > 0
  const hasSkills = profile.skills.length > 0
  const hasTarget = !!profile.targetCareer.position || !!profile.targetCareer.direction
  const hasEducation = !!profile.education.degree || !!profile.education.school

  if (hasBasicInfo && hasExperience && hasSkills && hasTarget && hasEducation) {
    return 'complete'
  }

  // 逐步判断缺什么
  if (!hasBasicInfo) return 'identity'
  if (!hasEducation) return 'education'
  if (!hasExperience) return 'experience'
  if (!hasSkills) return 'skills'
  if (!hasTarget) return 'target'

  // 有基本信息但还缺求职状态等
  return 'job_search'
}

// ─── 上下文构建 ───────────────────────────────────────

/**
 * 从 CareerConversationProfile 构建 LLM 上下文
 *
 * 调用时机：每次 LLM 推理前
 *
 * @param profile 当前职业画像
 * @returns 上下文数据包
 */
export function buildCareerConversationContext(profile: CareerConversationProfile): CareerConversationContext {
  const stage = determineConversationStage(profile)
  const missing = detectMissingInformation(profile)
  const card = formatProfileForPrompt(profile)

  // 根据阶段决定注入内容
  let identityCard = card

  // 在身份卡末尾附加阶段引导
  const stageGuide = buildStageGuide(stage, missing)
  if (stageGuide) {
    identityCard += '\n' + stageGuide
  }

  return {
    identityCard,
    confirmedFacts: profile.confirmedFacts,
    missingInformation: missing,
    conversationStage: stage,
    profile,
  }
}

// ─── 阶段引导生成 ─────────────────────────────────────

/**
 * 根据当前阶段生成引导文本（注入 Prompt）
 */
function buildStageGuide(stage: ConversationStage, missing: string[]): string {
  switch (stage) {
    case 'initial':
      return '\n当前处于初始阶段。请友好地问候用户，请用户介绍自己的基本情况。'

    case 'identity':
      return '\n用户基本身份信息不完整。优先了解用户的姓名和所在城市。不要一次性问太多问题。'

    case 'education':
      return '\n请了解用户的教育背景（最高学历、学校、专业）。如果用户已提供部分，只问缺失的。'

    case 'experience':
      return '\n请了解用户的工作经历和工作年限。避免编造或猜测具体公司/职位。'

    case 'skills':
      return '\n请了解用户的技能和项目经验。根据已提供的信息引导补充。'

    case 'target':
      return '\n请了解用户的职业目标、期望岗位和行业方向。'

    case 'job_search':
      return '\n信息已基本完整。可以补充了解求职状态、期望薪资等信息。\n同时可以开始提供职业建议、岗位方向推荐。'

    case 'complete':
      return '\n用户画像已基本完整。可以提供职业规划建议、简历修改建议、市场分析等。\n如果用户提供新信息，更新记录即可。'

    case 'consultation':
      return '\n自由咨询模式。回答用户的问题，根据已有画像提供有针对性的建议。'
  }
}

/**
 * 生成 "还需要了解的字段" 文本
 * 用于 LLM 知道下一步该问什么
 */
export function buildMissingPrompt(missing: string[]): string {
  if (missing.length === 0) return ''

  const fieldNames: Record<string, string> = {
    '姓名': '姓名',
    '城市': '所在城市',
    '学历': '最高学历',
    '学校': '毕业院校',
    '专业': '所学专业',
    '工作经历': '详细工作经历',
    '工作年限': '工作年限',
    '技能': '掌握技能',
    '项目经验': '项目/作品经历',
    '目标岗位': '目标岗位',
    '目标行业': '目标行业',
    '期望薪资': '期望薪资范围',
  }

  const readableMissing = missing.map(m => fieldNames[m] || m)

  return `\n还需要了解的信息：${readableMissing.join('、')}\n请根据以上列表，逐步引导用户补充。一次只问 1-2 个问题，不要一次性全列出来。`
}
