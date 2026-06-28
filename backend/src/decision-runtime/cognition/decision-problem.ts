/**
 * decision-problem.ts — Decision Problem Decomposition Model
 *
 * ═══════════════════════════════════════════════════════════════
 * Phase A-1.5: Decision Cognition Schema Layer
 * ═══════════════════════════════════════════════════════════════
 *
 * DecisionProblem 是"认知分解"的第一层。
 * 它将用户的自由文本输入，拆解为可计算的决策单元。
 *
 * 宪法：
 *   1. 所有 Agent 的第一个输入必须是 DecisionProblem
 *   2. 禁止 Agent 直接消费 string
 *   3. domain 是全局分类，决定后续 evalautionAxes
 *      （医疗推荐 vs 房产推荐 vs 法律服务 → 不同 Axes）
 *
 * @phase decision-runtime
 */

// ============================================================
// 1. 问题分解模型
// ============================================================

export interface DecisionProblem {
  /** 原始用户输入 */
  rawInput: string

  /** 决策领域（全局分类，决定评估轴） */
  domain: string

  /** 用户意图（一句话总结） */
  intent: string

  /** 客观约束（预算/时间/地点/政策等） */
  constraints: string[]

  /** 主观目标（用户希望达成的效果） */
  objectives: string[]

  /** 需求优先级排序（数组下标从高到低） */
  priorityOrder: string[]
}

// ============================================================
// 2. 领域分类器（固定第一版）
// ============================================================

/**
 * 支持的领域类型
 * 宪法：新增领域必须在此枚举注册
 */
export enum DecisionDomain {
  /** 房产购买/租赁 */
  REAL_ESTATE = 'real_estate',

  /** 法律服务（找律师） */
  LEGAL = 'legal',

  /** 医疗服务（找医生/医院） */
  MEDICAL = 'medical',

  /** 教育服务（找学校/培训机构） */
  EDUCATION = 'education',

  /** 旅游出行 */
  TRAVEL = 'travel',

  /** 企业服务（找供应商/工厂） */
  ENTERPRISE = 'enterprise',

  /** 美容/生活服务 */
  LIFESTYLE = 'lifestyle',

  /** 加盟/创业 */
  FRANCHISE = 'franchise',

  /** 情感/命理 */
  CONSULTING = 'consulting',

  /** 一般决策（无法确定领域时的兜底） */
  GENERAL = 'general',
}

// ============================================================
// 3. 领域评估轴声明
// ============================================================

/**
 * 每个领域专属的评估轴
 * 不同决策领域关注不同维度
 */
export const DOMAIN_EVALUATION_AXES: Record<DecisionDomain, string[]> = {
  [DecisionDomain.REAL_ESTATE]: ['credibility', 'reputation', 'service_quality', 'risk', 'value_for_money', 'location', 'appreciation_potential'],
  [DecisionDomain.LEGAL]: ['credibility', 'reputation', 'service_quality', 'risk', 'value_for_money', 'expertise', 'success_rate'],
  [DecisionDomain.MEDICAL]: ['credibility', 'reputation', 'service_quality', 'risk', 'value_for_money', 'expertise', 'equipment'],
  [DecisionDomain.EDUCATION]: ['credibility', 'reputation', 'service_quality', 'risk', 'value_for_money', 'teaching_quality', 'employment_rate'],
  [DecisionDomain.TRAVEL]: ['credibility', 'reputation', 'service_quality', 'risk', 'value_for_money', 'accessibility', 'experience'],
  [DecisionDomain.ENTERPRISE]: ['credibility', 'reputation', 'service_quality', 'risk', 'value_for_money', 'capacity', 'delivery_reliability'],
  [DecisionDomain.LIFESTYLE]: ['credibility', 'reputation', 'service_quality', 'risk', 'value_for_money', 'accessibility', 'hygiene'],
  [DecisionDomain.FRANCHISE]: ['credibility', 'reputation', 'service_quality', 'risk', 'value_for_money', 'support_quality', 'roi_potential'],
  [DecisionDomain.CONSULTING]: ['credibility', 'reputation', 'risk', 'value_for_money', 'empathy'],
  [DecisionDomain.GENERAL]: ['credibility', 'reputation', 'service_quality', 'risk', 'value_for_money'],
}

// ============================================================
// 4. 领域检测启发式
// ============================================================

/**
 * 根据用户输入判断最可能的决策领域
 * 用于 RequirementAgent 的预处理阶段
 */
export function detectDomain(rawInput: string): DecisionDomain {
  const text = rawInput.toLowerCase()

  // 房产
  if (/买房|购房|楼盘|房价|学区房|租房|房产|公寓|别墅|real estate|house|apartment|property/i.test(text)) {
    return DecisionDomain.REAL_ESTATE
  }

  // 法律
  if (/律师|法律|诉讼|官司|合同|纠纷|起诉|仲裁|legal|lawyer|attorney/i.test(text)) {
    return DecisionDomain.LEGAL
  }

  // 医疗
  if (/医院|医生|看病|治疗|手术|体检|诊所|medical|doctor|hospital|clinic|surgery/i.test(text)) {
    return DecisionDomain.MEDICAL
  }

  // 教育
  if (/学校|培训|课程|教育|留学|补习|老师|大学|education|school|training|course/i.test(text)) {
    return DecisionDomain.EDUCATION
  }

  // 旅游
  if (/旅游|酒店|机票|景点|旅行|度假|travel|hotel|flight|vacation/i.test(text)) {
    return DecisionDomain.TRAVEL
  }

  // 企业服务
  if (/供应商|工厂|供应链|代工|enterprise|supplier|factory|manufacturing/i.test(text)) {
    return DecisionDomain.ENTERPRISE
  }

  // 加盟
  if (/加盟|创业|开店|连锁|franchise|startup|chain/i.test(text)) {
    return DecisionDomain.FRANCHISE
  }

  // 生活服务
  if (/美容|美发|健身|家政|理发|装修|beauty|salon|fitness|renovation/i.test(text)) {
    return DecisionDomain.LIFESTYLE
  }

  // 咨询/情感
  if (/情感|婚姻|心理|算命|占卜|咨詢|relationship|psychology|fortune/i.test(text)) {
    return DecisionDomain.CONSULTING
  }

  return DecisionDomain.GENERAL
}
