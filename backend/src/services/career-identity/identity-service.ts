// ─── Sprint-10C T06: CareerIdentityService ───
// Core Pipeline: Extract → Merge → Save → Context → LLM → Reply
// LLM 不记忆用户，Profile JSON 是唯一事实源

import { CareerIdentityProfile } from './types'
import { getOrCreateProfile, updateProfile } from './profile-repo'
import { extractFacts, FactExtractionResult } from './fact-extractor'
import { buildLLMContext } from './context-builder'
import { planNextQuestion, QuestionPlan } from './question-planner'


/** 合并提取结果至 Profile */
export function mergeExtraction(
  profile: CareerIdentityProfile,
  extraction: FactExtractionResult
): CareerIdentityProfile {
  const updated = { ...profile }
  const now = new Date()

  // 1. identity
  if (extraction.identity) {
    updated.identity = { ...updated.identity, ...extraction.identity }
  }

  // 2. location
  if (extraction.location) {
    updated.location = { ...updated.location, ...extraction.location }
  }

  // 3. education
  if (extraction.education) {
    updated.education = { ...updated.education, ...extraction.education }
  }

  // 4. career
  if (extraction.career) {
    updated.career = { ...updated.career, ...extraction.career }
  }

  // 5. skills (append, 带子串去重)
  if (extraction.skills && extraction.skills.length > 0) {
    // 构建所有已有技能名的集合（含子串检测）
    const existingNames = new Set(updated.skills.map(s => s.name))
    for (const skill of extraction.skills) {
      // 精确匹配跳过
      if (existingNames.has(skill.name)) continue
      // 子串匹配跳过：新技能是已有技能的子串，或已有技能是新技能的子串
      const isSubstring = updated.skills.some(
        s => s.name.includes(skill.name) || skill.name.includes(s.name)
      )
      if (isSubstring) continue

      updated.skills = [...updated.skills, {
        name: skill.name,
        level: skill.level,
        evidence: skill.evidence || '',
      }]
      existingNames.add(skill.name)
    }
  }

  // 6. work experience
  if (extraction.workExperience && extraction.workExperience.length > 0) {
    const existingKeys = new Set(
      updated.workExperience.map(w => `${w.company}:${w.position}`)
    )
    for (const w of extraction.workExperience) {
      const key = `${w.company}:${w.position}`
      if (!existingKeys.has(key)) {
        updated.workExperience = [
          ...updated.workExperience,
          {
            company: w.company,
            position: w.position,
            years: w.years,
            description: w.description || '',
            achievements: w.achievements || [],
          },
        ]
        existingKeys.add(key)
      }
    }
  }

  // 7. job preference
  if (extraction.jobPreference) {
    updated.jobPreference = { ...updated.jobPreference, ...extraction.jobPreference }
  }

  // 8. confirmed facts
  if (extraction.newFacts.length > 0) {
    updated.confirmedFacts = [
      ...updated.confirmedFacts,
      ...extraction.newFacts.map(f => ({
        field: f.field,
        value: f.value,
        source: 'user' as const,
        createdAt: now,
      })),
    ]
  }

  // 9. 重新计算 missingFields + completionScore
  recalculateProfileStatus(updated)

  return updated
}

/** 计算缺失字段和完成度 */
function recalculateProfileStatus(profile: CareerIdentityProfile): void {
  const missing: string[] = []

  // 检查各字段
  if (!profile.identity.name) missing.push('name')
  if (!profile.career.careerDirection && !profile.career.targetPosition) missing.push('careerDirection')
  if (!profile.career.yearsExperience) missing.push('experience')
  if (profile.skills.length === 0) missing.push('skills')
  if (!profile.location.currentCity) missing.push('city')
  if (!profile.education.school && !profile.education.degree) missing.push('education')
  if (!profile.career.targetIndustry) missing.push('targetIndustry')
  if (!profile.jobPreference.salary) missing.push('salary')

  profile.missingFields = missing

  // 完成度计算: 满分100，按字段权重
  const weights: Record<string, number> = {
    name: 15,
    careerDirection: 20,
    targetPosition: 15,
    experience: 15,
    skills: 15,
    city: 8,
    education: 7,
    targetIndustry: 3,
    salary: 2,
  }

  let score = 0
  const required = ['name', 'careerDirection', 'experience', 'skills']
  const requiredKeySet = new Set(required.map(f => f.replace('targetPosition', 'careerDirection')))

  // 核心字段
  if (profile.identity.name) score += weights.name
  if (profile.career.careerDirection || profile.career.targetPosition) {
    score += Math.max(weights.careerDirection, profile.career.targetPosition ? 10 : 0)
  }
  if (profile.career.yearsExperience) score += weights.experience
  if (profile.skills.length > 0) score += weights.skills
  if (profile.location.currentCity) score += weights.city
  if (profile.education.school || profile.education.degree) score += weights.education
  if (profile.career.targetIndustry) score += weights.targetIndustry
  if (profile.jobPreference.salary) score += weights.salary

  profile.completionScore = Math.min(100, Math.round(score))

  // 状态自动升级
  if (profile.completionScore >= 80) {
    profile.status = 'completed'
  } else if (profile.completionScore >= 40 && profile.status === 'collecting') {
    profile.status = 'draft'
  }
}

/**
 * 执行完整处理管道
 * User Input → Extract → Merge → Save → Context → LLM → Reply
 */
export async function processUserInput(
  userId: string,
  message: string,
  historyMessages?: Array<{ role: string; content: string }>
): Promise<{
  reply: string
  profile: CareerIdentityProfile
  questionPlan: QuestionPlan
  context: string
}> {
  // Step 1: Get or create profile
  const profile = await getOrCreateProfile(userId)

  // Step 2: Extract facts
  const extraction = extractFacts(message, profile)

  // Step 3: Merge
  const updatedProfile = mergeExtraction(profile, extraction)

  // Step 4: Save to DB
  await updateProfile(userId, updatedProfile)

  // Step 5: Build context
  const ctx = buildLLMContext(updatedProfile)

  // Step 6: Plan next question
  const questionPlan = planNextQuestion(updatedProfile)

  // Step 7: Build LLM prompt
  const reply = await callLLM(
    updatedProfile,
    ctx.fullContext,
    questionPlan,
    historyMessages,
    message,
    userId
  )

  return {
    reply,
    profile: updatedProfile,
    questionPlan,
    context: ctx.fullContext,
  }
}

// ─── LLM 调用 ─────────────────────────────

const SYSTEM_PROMPT = `你是昆仑镜求职顾问。

【核心规则】
1. 你的任务不是聊天。你的任务是帮助用户建立完整的职业画像。
2. 你不会记忆用户。所有用户信息来自 [Confirmed Facts]。
3. 禁止重复询问已确认的事实。
4. 禁止假设、补全、美化用户经历。
5. 用开放式问题引导用户补充缺失信息。
6. 当信息完整后（完成度>=80），主动建议生成简历。

【表达风格】
- 自然、友好、专业
- 不要一次性问多个问题，每次 1-2 个
- 用户提供新信息后，先确认记录，再问下一个问题

【回复结构】
每次回复末尾 ===COLLECT=== 标记已在服务端处理，你不需要输出任何 JSON 标记。
只需要用自然语言对话即可。`

async function callLLM(
  profile: CareerIdentityProfile,
  context: string,
  questionPlan: QuestionPlan,
  historyMessages: Array<{ role: string; content: string }> | undefined,
  userMessage: string | undefined,
  userId: string
): Promise<string> {
  // Build the prompt parts
  const parts: string[] = []

  // Context: Profile JSON + facts
  parts.push('=== 用户职业画像 ===')
  parts.push(context)

  // History (last 6 turns)
  if (historyMessages && historyMessages.length > 0) {
    const recent = historyMessages.slice(-6)
    parts.push('')
    parts.push('=== 最近对话 ===')
    for (const msg of recent) {
      const prefix = msg.role === 'user' ? '用户' : '助手'
      parts.push(`${prefix}: ${msg.content}`)
    }
  }

  // Current user message
  parts.push('')
  parts.push('=== 用户最新消息 ===')
  parts.push(userMessage || '')

  // Question guidance
  if (questionPlan.action === 'ask' && questionPlan.question) {
    parts.push('')
    parts.push('=== 下一步建议 ===')
    parts.push(`建议询问：${questionPlan.question}`)
  } else if (questionPlan.action === 'resume') {
    parts.push('')
    parts.push('=== 提示 ===')
    parts.push('用户画像已完整，主动建议生成简历草稿。')
  }

  const fullPrompt = parts.join('\n')

  // Call LLM via gateway
  const { executeViaGateway } = require('../../runtime/runtime-gateway.js')
  const result = await executeViaGateway('llm', {
    systemPrompt: SYSTEM_PROMPT,
    prompt: fullPrompt,
    temperature: 0.7,
    maxTokens: 2000,
  }, { userId, businessType: 'career_advisor' } as any)

  let reply = result.content || ''
  // Clean formatting
  reply = reply.replace(/\\\\n/g, '\n').replace(/\*\*(.+?)\*\*/g, '$1').trim()

  // If questionPlan says ask something and reply doesn't ask it, append
  if (questionPlan.action === 'ask' && questionPlan.question) {
    // Only append if reply doesn't already contain a question
    if (!reply.includes('？') && !reply.includes('?')) {
      reply += '\n\n' + questionPlan.question
    }
  }

  return reply
}
