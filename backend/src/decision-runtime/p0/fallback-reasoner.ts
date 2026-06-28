/**
 * fallback-reasoner.ts — P-0 确定性推理回退器
 *
 * ============================================================
 * 当 Shadow Executor 的 D-1 找不到匹配的 proof 时，
 * 使用此回退器做确定性推理。
 *
 * 铁律：
 *   1. 纯确定性——同一问题永远同一答复
 *   2. 无 AI/LLM 调用
 *   3. 领域分类基于关键词匹配
 *   4. 不保证信息准确——只做领域映射
 * ============================================================
 */

export interface FallbackDecision {
  value: string
  domain: string
  sentiment: 'positive' | 'negative' | 'neutral'
  keywords: string[]
  confidence: number
}

/**
 * 生活领域关键词图谱
 * 每个领域一组关键词，匹配即归类
 */
const DOMAIN_MAP: Record<string, { keywords: string[]; templates: Record<string, string> }> = {
  '电子产品': {
    keywords: ['手机', '电脑', '平板', '耳机', '手表', '笔记本', '相机', '显示器', '键盘', '鼠标', '音响', 'iphone', 'ipad', 'mac', '华为', '小米', 'oppo', 'vivo', '三星', '索尼'],
    templates: {
      positive: '用户对 {topic} 的总体评价偏向正面。该产品在同类中表现稳定，建议根据个人需求选择具体型号。',
      negative: '用户对 {topic} 的反馈存在较多不确定因素。建议查看具体型号的详细评测，或考虑口碑更成熟的替代方案。',
      neutral: '关于 {topic} 的评价存在分歧，建议从使用场景出发做选择。如需具体型号建议，请提供预算和主要用途。',
    },
  },
  '生活建议': {
    keywords: ['推荐', '建议', '怎么样', '如何', '好不', '值得', '选择', '哪个', '对比', '比较', '评价', '体验', 'help', 'advice', 'recommend'],
    templates: {
      positive: '基于对 {topic} 的分析，该选择在常见场景下表现可靠。建议结合个人偏好做最终决定。',
      negative: '关于 {topic} 的建议缺乏足够确定性。建议多参考真实用户反馈，或缩小选择范围以获取更精准建议。',
      neutral: '关于 {topic} 的选择取决于具体场景和需求。请提供更多细节，以便给出更有针对性的参考。',
    },
  },
  '企业信息': {
    keywords: ['公司', '企业', '集团', '有限', '股份', '工作室', '品牌', '店铺', '平台', '网站', 'app'],
    templates: {
      positive: '关于 {topic} 的公开信息显示其运营正常。请注意：本系统不做投资建议，所有信息仅供参考。',
      negative: '关于 {topic} 的信息存在不确定性，建议通过官方渠道进一步核实。本系统不保证信息的完整性。',
      neutral: '关于 {topic} 的公开信息有限，无法做出明确判断。建议通过工商查询平台获取更多信息。',
    },
  },
  '健康生活': {
    keywords: ['运动', '跑步', '健身', '饮食', '睡眠', '瑜伽', '健康', '锻炼', '营养', '作息', '减肥', '增肌'],
    templates: {
      positive: '关于 {topic} 的通用建议显示其符合主流健康理念。请注意：本系统不提供医疗建议，严重健康问题请咨询专业医生。',
      negative: '关于 {topic} 的常见误区较多，建议查阅权威来源验证。本系统不提供医疗建议。',
      neutral: '关于 {topic} 的通用建议：适度、均衡、循序渐进。如有健康疑虑，请咨询专业医疗人士。',
    },
  },
  '日常知识': {
    keywords: ['什么', '怎么', '为什么', '是不是', '能不能', '是否', '哪些', '哪里', '何时', '如何', 'what', 'how', 'why', 'where', 'when'],
    templates: {
      positive: '关于 {topic} 的通用知识：根据现有公开信息，该问题有明确的参考方向。建议通过权威渠道核实。',
      negative: '关于 {topic} 的问题范围较广，建议缩小范围或明确具体场景以便获得更有用的参考信息。',
      neutral: '这是一个常见的 {topic} 问题。标准的做法是查阅该领域的权威资料。本系统仅提供方向性参考。',
    },
  },
}

/** 默认模板（未匹配任何领域） */
const DEFAULT_TEMPLATES = {
  positive: '关于"{topic}"，当前信息不足以做出确定性判断。建议进一步明确问题。',
  negative: '无法对"{topic}"做出有效推理。请换个角度描述您的问题。',
  neutral: '这是个一般性问题。如需精准回答，请提供更多背景或具体选项。',
}

export class FallbackReasoner {
  /**
   * classify(query) — 将用户问题映射到领域和情绪
   */
  classify(query: string): FallbackDecision {
    const lowerQuery = query.toLowerCase()
    const matchedKeywords: string[] = []

    // 1. 领域匹配（按领域顺序，取最先匹配的）
    for (const [domain, config] of Object.entries(DOMAIN_MAP)) {
      for (const kw of config.keywords) {
        if (lowerQuery.includes(kw.toLowerCase())) {
          matchedKeywords.push(kw)
        }
      }
      if (matchedKeywords.length > 0) {
        // 2. 情绪判断（简单问句 = neutral / 一般 = positive）
        const sentiment = this.detectSentiment(lowerQuery)
        // 3. 生成答复
        const value = this.buildResponse(domain, lowerQuery, sentiment, config.templates)
        return {
          value,
          domain,
          sentiment,
          keywords: [...new Set(matchedKeywords)],
          confidence: 0.3 + (matchedKeywords.length * 0.1), // 关键词越多越确定
        }
      }
    }

    // 4. 未匹配 → 默认
    const sentiment = this.detectSentiment(lowerQuery)
    const value = this.buildResponse('general', lowerQuery, sentiment, DEFAULT_TEMPLATES)
    return {
      value,
      domain: 'general',
      sentiment,
      keywords: [],
      confidence: 0.15,
    }
  }

  private detectSentiment(query: string): 'positive' | 'negative' | 'neutral' {
    const posWords = ['好', '推荐', '值得', '不错', '优秀', '靠谱', '喜欢', '值得买', '值得推荐', '好用']
    const negWords = ['差', '垃圾', '不好', '不推荐', '坑', '问题', '投诉', '不靠谱', '避雷', '翻车']

    const posCount = posWords.filter(w => query.includes(w)).length
    const negCount = negWords.filter(w => query.includes(w)).length

    if (posCount > negCount) return 'positive'
    if (negCount > posCount) return 'negative'
    return 'neutral'
  }

  private buildResponse(domain: string, query: string, sentiment: string, templates: Record<string, string>): string {
    // 提取话题关键词（去掉常用词）
    const stopWords = ['这个', '那个', '哪个', '什么', '怎么', '如何', '推荐', '评价', '怎么样', '是不是', '一个']
    const words = query.replace(/[？?！!，,。.、]/g, ' ').split(/\s+/)
    const topic = words.filter(w => w.length > 1 && !stopWords.includes(w)).slice(0, 3).join('、') || '该话题'

    const template = templates[sentiment] || templates.neutral
    return template.replace(/\{topic\}/g, topic)
  }
}
