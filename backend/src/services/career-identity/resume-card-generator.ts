// ─── Sprint-10C T09: ResumeCardGenerator ───
// completionScore >= 80 时自动生成简历卡
// 输出结构化 Resume Card，可推送至人才市场

import { CareerIdentityProfile, IdentityProfileSkill, IdentityProfileWorkExperience } from './types'

export interface ResumeCard {
  title: string
  summary: string
  skills: string[]
  experience: string[]
  education: string
  targetPosition: string
  targetIndustry: string
  location: string
  highlight: string
}

/**
 * 从 Profile 生成简历卡文本
 */
export function generateResumeCard(profile: CareerIdentityProfile): ResumeCard {
  const name = profile.identity.name || '求职者'
  const exp = profile.career.yearsExperience || 0
  const dir = profile.career.careerDirection || ''
  const pos = profile.career.targetPosition || ''
  const ind = profile.career.targetIndustry || ''
  const city = profile.location.currentCity || ''

  // 技能列表
  const skills = profile.skills.map(s => s.name)

  // 亮点
  let highlight = ''
  if (exp >= 10 && skills.length > 0) {
    highlight = `${exp}年${dir ? dir + '经验' : '行业经验'}，精通${skills.slice(0, 3).join('、')}`
  } else if (skills.length > 0) {
    highlight = `擅长${skills.slice(0, 3).join('、')}${dir ? '，专注于' + dir : ''}`
  } else if (dir) {
    highlight = `${exp > 0 ? exp + '年' : ''}${dir}方向`
  } else {
    highlight = profile.confirmedFacts.map(f => f.value).join('、').slice(0, 60)
  }

  // 摘要
  const summaryParts: string[] = []
  if (dir || pos) summaryParts.push(dir || pos)
  if (ind) summaryParts.push(ind)
  if (exp > 0) summaryParts.push(`${exp}年经验`)
  if (city) summaryParts.push(city)
  const summary = summaryParts.length > 0 ? summaryParts.join(' · ') : '职业信息待完善'

  // 经历
  const experience = profile.workExperience.map(w => {
    let line = w.position ? `${w.position} @ ${w.company}` : w.company
    if (w.years > 0) line += `（${w.years}年）`
    return line
  })

  // 教育
  const eduParts = [profile.education.degree, profile.education.school, profile.education.major].filter(Boolean)
  const education = eduParts.length > 0 ? eduParts.join(' · ') : ''

  return {
    title: `${name} — ${dir || pos || '求职中'}${exp > 0 ? ` | ${exp}年经验` : ''}`,
    summary,
    skills,
    experience,
    education,
    targetPosition: pos,
    targetIndustry: ind,
    location: city,
    highlight,
  }
}

/**
 * 生成简历卡文本展示
 */
export function formatResumeCard(card: ResumeCard): string {
  const lines: string[] = [
    '📋 简历草稿',
    '',
    card.title,
    '',
    card.summary,
    '',
  ]

  if (card.skills.length > 0) {
    lines.push('▎核心技能')
    lines.push(card.skills.join('、'))
    lines.push('')
  }

  if (card.experience.length > 0) {
    lines.push('▎工作经历')
    for (const exp of card.experience) {
      lines.push(`· ${exp}`)
    }
    lines.push('')
  }

  if (card.education) {
    lines.push(`▎教育背景`)
    lines.push(card.education)
    lines.push('')
  }

  if (card.targetPosition) {
    lines.push(`目标岗位：${card.targetPosition}`)
  }
  if (card.targetIndustry) {
    lines.push(`目标行业：${card.targetIndustry}`)
  }
  if (card.location) {
    lines.push(`期望城市：${card.location}`)
  }

  lines.push('')
  lines.push('以上是根据你提供的信息生成的简历草稿。你看看需要调整或补充什么吗？')

  return lines.join('\n')
}
