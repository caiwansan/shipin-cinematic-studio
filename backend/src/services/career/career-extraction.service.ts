// ─── Sprint-09E-02 Career Extraction Trust Layer ─────
// 单一 Extraction Authority: CareerProfile 只存 Confirmed Facts,
// AI 推断进入 Derived Insights.

import { prisma } from '../../utils/index.js'
import { CareerProfileService } from './career-profile.service.js'
import { writeExtractionAudit } from './career-extraction-audit.service.js'
import { getFieldPolicy, isActionAllowed } from './career-field-policy.js'

// ─── Types ──────────────────────────────────────────

export type ExtractionSource =
  | 'user_explicit'    // 用户明确说出（"我叫李大牛"）
  | 'user_confirmed'   // 用户确认过（"对，我是做SaaS销售的"）
  | 'ai_inferred'      // AI 基于上下文推断（"做了5年销售→可能在销售行业"）

export type ExtractionAction = 'write' | 'suggest' | 'ignore'

/**
 * 单个字段的提取结果（带信任元数据）
 */
export interface CareerExtractionField {
  field: string
  value: unknown
  source: ExtractionSource
  confidence: number    // 0-100
  evidence: string      // 原文引用，如 "我做SaaS销售5年"
  action: ExtractionAction
  /** 如果是纠正/更新旧字段，标注旧值 */
  replacesField?: string
  replacedValue?: unknown
}

/**
 * 一次提取操作的结果
 */
export interface CareerExtractionResult {
  fields: CareerExtractionField[]
  /** 信任过滤后：确定写入 CareerProfile 的事实 */
  confirmedFacts: CareerExtractionField[]
  /** 信任过滤后：建议进入 Derived Insights 的推断 */
  derivedSuggestions: CareerExtractionField[]
  /** 信任过滤后：被忽略的不可信字段 */
  ignored: CareerExtractionField[]
  /** 用户原始消息（用于校验） */
  rawMessage: string
}

// ─── Trust Filter Rules ────────────────────────────

const TRUST_RULES = {
  /** 年龄式表达 → 不可作为 yearsExperience */
  agePattern: /(\d{1,2})(?:岁|周岁|岁数|年龄)/,
  /** 明确的年限表达 */
  expPattern: /(\d{1,2})(?:年经验|年工作|年从业|年做|年开发|年了|年多|年之久)/,
  /** 推断性词语 */
  inferWords: /感觉|可能|应该|大概|估计|推测|看起来/,
  /** 公司名编造检测（常见虚构公司） */
  fakeCompanyWords: /某公司|某企业|某集团|某某|示例公司|测试公司/,
  /** 行业自动推断的非事实来源 */
  industryInferFrom: ['careerDirection', 'headline', 'skills'],
}

const MIN_CONFIDENCE_WRITE = 80 // 低于此值不进 CareerProfile

// ─── Service ─────────────────────────────────────

export class CareerExtractionService {
  private profileService: CareerProfileService

  constructor() {
    this.profileService = new CareerProfileService(prisma)
  }

  /**
   * 主入口：处理提取结果 → 信任过滤 → 分类
   * 
   * @param rawFields  从 LLM/COLLECT_START/JSON 抽取的原始字段
   * @param rawMessage 用户原始消息
   * @param existing   DB 中已有的 CareerProfile（可选，用于覆盖检测）
   */
  async processExtraction(
    rawFields: Array<{ name: string; value: unknown }>,
    rawMessage: string,
    existing?: Record<string, unknown> | null
  ): Promise<CareerExtractionResult> {
    const processed: CareerExtractionField[] = []
    const messageAge = this.detectAgeInMessage(rawMessage)

    for (const f of rawFields) {
      const field = await this.evaluateField(f.name, f.value, rawMessage, !!existing, messageAge)
      processed.push(field)
    }

    // 分类
    const confirmed = processed.filter(f => f.action === 'write')
    const suggested = processed.filter(f => f.action === 'suggest')
    const ignored = processed.filter(f => f.action === 'ignore')

    // 自动检测 industry 推断场景
    if (!rawFields.find(f => f.name === 'industry')) {
      const inferredIndustry = this.inferIndustryFromFields(processed, rawMessage)
      if (inferredIndustry) {
        suggested.unshift(inferredIndustry)
      }
    }

    const result: CareerExtractionResult = {
      fields: processed,
      confirmedFacts: confirmed,
      derivedSuggestions: suggested,
      ignored,
      rawMessage,
    }

    return result
  }

  /**
   * 写入 CareerProfile（只写 action=write 的字段）
   */
  /**
   * 完整管线：process → write → audit
   */
  async processAndSave(
    userId: string,
    rawFields: Array<{ name: string; value: unknown }>,
    rawMessage: string,
    existing?: Record<string, unknown> | null,
    options?: { traceSource?: string; sessionId?: string }
  ): Promise<CareerExtractionResult> {
    const result = await this.processExtraction(rawFields, rawMessage, existing)

    // 写入 CareerProfile（只写 confirmed）
    const writeResult = await this.writeToProfile(userId, result, options)

    // 写入 Derived Insights
    await this.addDerivedInsights(userId, result)

    // 审计日志
    writeExtractionAudit({
      userId,
      sessionId: options?.sessionId,
      rawMessage,
      fields: result.fields.map(f => ({
        field: f.field,
        value: f.value,
        source: f.source,
        confidence: f.confidence,
        action: f.action,
        evidence: f.evidence,
      })),
      confirmedFacts: result.confirmedFacts.map(f => f.field),
      derivedSuggestions: result.derivedSuggestions.map(f => f.field),
      ignored: result.ignored.map(f => f.field),
      traceSource: options?.traceSource,
    })

    return result
  }

  async writeToProfile(
    userId: string,
    result: CareerExtractionResult,
    options?: { traceSource?: string }
  ): Promise<{ written: string[]; updated: boolean }> {
    const confirmed = result.confirmedFacts
    if (confirmed.length === 0) {
      return { written: [], updated: false }
    }

    // 构建写入数据（经过字段策略二次过滤）
    const updateData: Record<string, unknown> = {}
    const actuallyWritten: string[] = []
    const newConfirmed: typeof confirmed = []
    for (const f of confirmed) {
      // 字段策略二次拦截
      const policyCheck = isActionAllowed(f.field, f.source, f.confidence)
      if (!policyCheck.allowed) {
        // 策略拒绝 → 移入 ignored，从 confirmed 移除
        result.ignored.push({
          ...f,
          action: 'ignore',
          evidence: `[字段策略] ${policyCheck.reason}`,
        })
        continue
      }
      actuallyWritten.push(f.field)
      newConfirmed.push(f)
      this.applyFieldToUpdate(updateData, f)
    }

    // 更新 result.confirmedFacts 为真实写入集合
    result.confirmedFacts = newConfirmed

    // 如果策略过滤后没有可写字段，跳过
    if (Object.keys(updateData).length === 0) {
      return { written: [], updated: false }
    }

    // 通过 ProfileService 写入
    await this.profileService.upsert(userId, updateData)

    return {
      written: actuallyWritten,
      updated: true,
    }
  }

  /**
   * 写入 Derived Insights（action=suggest）
   */
  async addDerivedInsights(
    userId: string,
    result: CareerExtractionResult
  ): Promise<void> {
    const suggestions = result.derivedSuggestions
    if (suggestions.length === 0) return

    // Derived Insights 通过 profile service 写入 insight 表或 metadata
    // 不覆盖 CareerProfile 主字段
    const insights = suggestions.map(f => ({
      field: f.field,
      value: f.value,
      confidence: f.confidence,
      evidence: f.evidence,
      createdAt: new Date(),
    }))

    await this.profileService.appendInsights(userId, insights)
  }

  // ─── Private: 字段评估 ──────────────────────────

  private async evaluateField(
    name: string,
    value: unknown,
    rawMessage: string,
    hasExistingProfile: boolean,
    messageAge: number | null
  ): Promise<CareerExtractionField> {
    // 默认评估
    const base: Partial<CareerExtractionField> = {
      field: name,
      value,
      evidence: this.extractEvidence(rawMessage, value),
    }

    switch (name) {
      case 'fullName':
        return this.evaluateNameField(base, rawMessage)
      case 'yearsExperience':
        return this.evaluateYearsExpField(base, rawMessage, messageAge)
      case 'industry':
        return this.evaluateIndustryField(base, rawMessage)
      case 'workHistory':
      case 'workExperience':
        return this.evaluateWorkHistoryField(base, rawMessage)
      case 'skills':
        return this.evaluateSkillsField(base, rawMessage)
      case 'age':
        return { ...base, source: 'user_explicit', confidence: 95, action: 'ignore' } as CareerExtractionField
      default:
        return this.evaluateGenericField(base, rawMessage)
    }
  }

  // ─── 字段级评估函数 ─────────────────────────

  private evaluateNameField(
    base: Partial<CareerExtractionField>,
    rawMessage: string
  ): CareerExtractionField {
    // 姓名 → 必须是用户明确说的
    const hasNamePattern = /我叫|我是|名字|姓名/.test(rawMessage)
    if (hasNamePattern) {
      return {
        ...base,
        source: 'user_explicit',
        confidence: 95,
        action: 'write',
      } as CareerExtractionField
    }

    // AI 推断的姓名（从对话上下文）→ 低置信度
    return {
      ...base,
      source: 'ai_inferred',
      confidence: 60,
      action: 'suggest',
    } as CareerExtractionField
  }

  private evaluateYearsExpField(
    base: Partial<CareerExtractionField>,
    rawMessage: string,
    messageAge: number | null
  ): CareerExtractionField {
    const value = Number(base.value)
    if (isNaN(value)) {
      return { ...base, source: 'ai_inferred', confidence: 30, action: 'ignore' } as CareerExtractionField
    }

    // 🟡 CRITICAL: 年龄误判保护
    // 如果消息同时包含年龄表达，且提取的工龄接近年龄值，拒绝
    if (messageAge !== null) {
      // 用户说"我30岁"→ 消息年龄=30；如果工龄也≥25，拦截
      if (value >= messageAge - 5) {
        return {
          ...base,
          source: 'ai_inferred',
          confidence: 20,
          action: 'ignore',
          evidence: `⚠️ 消息中检测到年龄表达(${messageAge}岁)，提取的工龄(${value}年)可能混淆了年龄与工龄`,
        } as CareerExtractionField
      }
    }

    const hasExpPattern = /年经验|年工作|年从业|年了|年多/.test(rawMessage)
    if (hasExpPattern) {
      return {
        ...base,
        source: 'user_explicit',
        confidence: 95,
        action: 'write',
      } as CareerExtractionField
    }

    return {
      ...base,
      source: 'ai_inferred',
      confidence: 60,
      action: 'suggest',
    } as CareerExtractionField
  }

  private evaluateIndustryField(
    base: Partial<CareerExtractionField>,
    rawMessage: string
  ): CareerExtractionField {
    // 🔴 CRITICAL: industry 不要自动写
    const userExplicitIndustry = /行业|做.*的|从事/.test(rawMessage)

    if (userExplicitIndustry) {
      return {
        ...base,
        source: 'user_explicit',
        confidence: 90,
        action: 'write',
      } as CareerExtractionField
    }

    // 推断 → suggest 不 write
    return {
      ...base,
      source: 'ai_inferred',
      confidence: 60,
      action: 'suggest',
    } as CareerExtractionField
  }

  private evaluateWorkHistoryField(
    base: Partial<CareerExtractionField>,
    rawMessage: string
  ): CareerExtractionField {
    const workHistory = base.value

    // 如果是数组，检查每一条
    if (Array.isArray(workHistory)) {
      for (const wh of workHistory) {
        // 🟡 检测编造的公司名
        if (typeof wh === 'object' && wh !== null) {
          const company = (wh as Record<string, unknown>).company
          if (typeof company === 'string' && this.isFakeCompany(company)) {
            return {
              ...base,
              source: 'ai_inferred',
              confidence: 20,
              action: 'ignore',
              evidence: `疑似编造公司名: "${company}"`,
            } as CareerExtractionField
          }
        }
      }
    }

    const hasExplicitExp = /在.*公司|从事.*工作|曾在|任职/.test(rawMessage)
    if (hasExplicitExp) {
      return {
        ...base,
        source: 'user_explicit',
        confidence: 85,
        action: 'write',
      } as CareerExtractionField
    }

    return {
      ...base,
      source: 'ai_inferred',
      confidence: 50,
      action: 'suggest',
    } as CareerExtractionField
  }

  private evaluateSkillsField(
    base: Partial<CareerExtractionField>,
    rawMessage: string
  ): CareerExtractionField {
    const skills = base.value
    const skillArray = Array.isArray(skills) ? skills : [skills]

    // 检查每个技能是否在消息中出现过
    const userMentionedSkills = skillArray.filter((s: unknown) => {
      if (typeof s !== 'string') return false
      return rawMessage.includes(s) || rawMessage.toLowerCase().includes(s.toLowerCase())
    })

    const aiInferredSkills = skillArray.filter((s: unknown) => {
      if (typeof s !== 'string') return false
      return !rawMessage.includes(s)
    })

    // 用户明确提到的技能 → write
    if (userMentionedSkills.length > 0 && aiInferredSkills.length === 0) {
      return {
        ...base,
        source: 'user_explicit',
        confidence: 90,
        action: 'write',
      } as CareerExtractionField
    }

    // 混合 → 给个中等的建议
    if (userMentionedSkills.length > 0 && aiInferredSkills.length > 0) {
      return {
        ...base,
        source: 'ai_inferred',
        confidence: 70,
        action: 'suggest',
        evidence: `用户明确提到: ${userMentionedSkills.join(',')}; AI推断: ${aiInferredSkills.join(',')}`,
      } as CareerExtractionField
    }

    // 全部 AI 推断 → 不写
    return {
      ...base,
      source: 'ai_inferred',
      confidence: 40,
      action: 'suggest',
    } as CareerExtractionField
  }

  private evaluateGenericField(
    base: Partial<CareerExtractionField>,
    rawMessage: string
  ): CareerExtractionField {
    // 通用判断：用户消息中是否包含字段名或值
    const strValue = String(base.value)
    const userExplicit = rawMessage.includes(strValue) || /明确说|确认|是的|对/.test(rawMessage)

    if (userExplicit) {
      return {
        ...base,
        source: 'user_explicit',
        confidence: 85,
        action: 'write',
      } as CareerExtractionField
    }

    return {
      ...base,
      source: 'ai_inferred',
      confidence: 55,
      action: 'suggest',
    } as CareerExtractionField
  }

  // ─── 辅助函数 ──────────────────────────────────

  /**
   * 检测消息中是否包含年龄表达
   */
  private detectAgeInMessage(message: string): number | null {
    const match = message.match(/(\d{1,2})(?:岁|周岁|岁数|年龄)/)
    return match ? parseInt(match[1]) : null
  }

  /**
   * 检测疑似编造的公司名
   */
  private isFakeCompany(name: string): boolean {
    return TRUST_RULES.fakeCompanyWords.test(name)
  }

  /**
   * 提取证据原文
   * 从用户消息中找到与提取值相关的上下文
   */
  private extractEvidence(message: string, value: unknown): string {
    if (typeof value === 'string' && message.includes(value)) {
      return message
    }
    if (Array.isArray(value)) {
      for (const item of value) {
        if (typeof item === 'string' && message.includes(item)) {
          return message
        }
      }
    }
    // 返回消息前 100 字作为上下文
    return message.slice(0, 100)
  }

  /**
   * 从已有字段推断 industry
   * 仅在无显式 industry 提取时自动生成 suggest
   */
  private inferIndustryFromFields(
    processed: CareerExtractionField[],
    rawMessage: string
  ): CareerExtractionField | null {
    // 寻找 careerDirection 或 headline 来推断
    const dirField = processed.find(f => f.field === 'careerDirection')
    if (!dirField || typeof dirField.value !== 'string') return null

    const direction = dirField.value as string

    // 确定性映射（白名单）
    const industryMap: Record<string, string> = {
      '厨师': '餐饮',
      '销售': '销售/市场',
      '前端': '互联网/IT',
      '后端': '互联网/IT',
      '全栈': '互联网/IT',
      '产品经理': '互联网/IT',
      '运营': '互联网/IT',
      '数据分析': '互联网/IT',
      'UI设计': '互联网/IT',
      '设计师': '设计/创意',
      '会计': '财务/审计',
      '教师': '教育/培训',
      '医生': '医疗健康',
      '护士': '医疗健康',
      '建筑师': '建筑/房地产',
      '法务': '法律/合规',
    }

    for (const [key, industry] of Object.entries(industryMap)) {
      if (direction.includes(key)) {
        return {
          field: 'industry',
          value: industry,
          source: 'ai_inferred',
          confidence: 70,
          evidence: `根据"${direction}"推断行业`,
          action: 'suggest',
        }
      }
    }

    return null
  }

  /**
   * 将字段写入 updateData（供 CareerProfile upsert 使用）
   */
  private applyFieldToUpdate(
    updateData: Record<string, unknown>,
    field: CareerExtractionField
  ): void {
    switch (field.field) {
      case 'fullName':
        updateData.fullName = String(field.value)
        break
      case 'headline':
      case 'currentTitle':
        updateData.headline = String(field.value)
        break
      case 'bio':
        updateData.bio = String(field.value)
        break
      case 'city':
        updateData.city = String(field.value)
        break
      case 'careerDirection':
      case 'targetRole':
        updateData.careerDirection = String(field.value)
        break
      case 'industry':
      case 'targetIndustry':
        updateData.industry = String(field.value)
        break
      case 'yearsExperience':
        updateData.yearsExperience = Number(field.value)
        break
      case 'skills': {
        const skills = Array.isArray(field.value) ? field.value : [field.value]
        updateData._skills = skills
        break
      }
      case 'workHistory':
      case 'workExperience': {
        const works = Array.isArray(field.value) ? field.value : [field.value]
        updateData._workHistory = works
        break
      }
      case 'education': {
        const eduArr = Array.isArray(field.value) ? field.value : [field.value]
        updateData._education = eduArr
        break
      }
      default:
        // 未知字段直接写入
        updateData[field.field] = field.value
    }
  }
}
