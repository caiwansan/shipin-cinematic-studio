/**
 * u0-seed-schema.ts — Phase U-0 Universe Seeding Schema
 *
 * ============================================================
 * U-0 定义"世界的第一批事实"——人工编写的 semantic seeds。
 *
 * 每个 seed 包含：
 *   - 问题模式（queryPatterns）：哪些问题可以匹配此 seed
 *   - 证据模板（evidenceTemplates）：支撑决策的证据
 *   - 决策模板（decisionTemplate）：最终输出
 *   - 置信度规则（confidenceRule）：何时可信
 *
 * 不包含 AI/LLM，纯人工编写+维护。
 * 是给 B-4.6 frozen universe 注入的第一批原子事实。
 * ============================================================
 */

export interface U0Seed {
  /** 唯一标识 */
  id: string
  /** 领域 */
  domain: string
  /** 问题模式（关键词/短语，匹配即触发） */
  queryPatterns: string[]
  /** 证据模板（合成 FrameInvariant 的证据链） */
  evidenceTemplates: string[]
  /** 决策模板（自然语言） */
  decisionTemplate: string
  /** 置信度规则 */
  confidenceRule: {
    /** 最小匹配关键词数 */
    minMatchCount: number
    /** 全匹配时置信度 */
    fullConfidence: number
    /** 部分匹配时置信度 */
    partialConfidence: number
  }
  /** 禁止域（可选） */
  forbiddenPatterns?: string[]
  /** 标签 */
  tags: string[]
}

/**
 * 第一批 U-0 Seeds
 *
 * 按领域分组，覆盖常见生活场景。
 * 每个 seed 的人工判断基于通用常识，不保证绝对准确。
 */
export const DEFAULT_SEEDS: U0Seed[] = [
  // ==================== 消费电子 ====================
  {
    id: 'phone-general-review',
    domain: 'consumer_electronics',
    queryPatterns: ['手机', '手机怎么样', '手机推荐', '手机评价', '手机好不好', '手机值得买', '买手机', '什么手机', '哪款手机'],
    evidenceTemplates: [
      '电子产品评价基于性能参数、价格区间、品牌口碑和用户反馈的综合分析',
      '不同品牌和价位的手机各有优势，建议根据预算和使用场景选择',
    ],
    decisionTemplate: '关于手机的评价因品牌和型号而异。请提供具体型号或预算范围，以便给出更有针对性的参考。',
    confidenceRule: { minMatchCount: 1, fullConfidence: 0.7, partialConfidence: 0.4 },
    tags: ['electronics', 'phone', 'shopping'],
  },
  {
    id: 'huawei-phone',
    domain: 'consumer_electronics',
    queryPatterns: ['华为手机', '华为', 'mate', 'pura', '华为怎么样'],
    evidenceTemplates: [
      '华为是知名手机品牌，产品线覆盖旗舰到中端，搭载鸿蒙OS',
      '华为手机以影像能力和系统生态为核心竞争力',
    ],
    decisionTemplate: '华为手机总体评价较好，旗舰系列（Mate/Pura）在影像、系统生态方面表现突出。建议根据具体型号和预算选择。',
    confidenceRule: { minMatchCount: 1, fullConfidence: 0.75, partialConfidence: 0.45 },
    forbiddenPatterns: ['mate60', 'pura70'],  // 具体型号需更精确的判断
    tags: ['electronics', 'phone', 'huawei'],
  },
  {
    id: 'iphone',
    domain: 'consumer_electronics',
    queryPatterns: ['iphone', '苹果手机', '苹果', 'apple手机'],
    evidenceTemplates: [
      'iPhone 搭载 iOS 系统，以系统流畅度和生态整合著称',
      '苹果产品线包括标准版和 Pro 版，差异主要在影像和屏幕',
    ],
    decisionTemplate: 'iPhone 在系统体验、生态整合和长期使用方面口碑稳定。Pro 系列影像能力更强，标准版性价比较高。建议根据预算和需求选择。',
    confidenceRule: { minMatchCount: 1, fullConfidence: 0.75, partialConfidence: 0.45 },
    tags: ['electronics', 'phone', 'apple'],
  },
  {
    id: 'computer-general',
    domain: 'consumer_electronics',
    queryPatterns: ['电脑', '笔记本', '笔记本电脑', '台式机', '买电脑', '什么电脑'],
    evidenceTemplates: [
      '电脑选择需考虑用途（办公/游戏/创作）、预算和便携需求',
      '主流品牌包括联想、惠普、华硕、戴尔、苹果等',
    ],
    decisionTemplate: '电脑的选择取决于使用场景：轻薄本适合移动办公，游戏本注重性能，Mac 适合创意工作。请提供预算和主要用途以便进一步建议。',
    confidenceRule: { minMatchCount: 1, fullConfidence: 0.65, partialConfidence: 0.4 },
    tags: ['electronics', 'computer'],
  },

  // ==================== 生活建议 ====================
  {
    id: 'book-recommend',
    domain: 'lifestyle',
    queryPatterns: ['推荐书', '推荐一本书', '看书', '什么书', '好书', '书籍推荐', '读书'],
    evidenceTemplates: [
      '书籍推荐基于类型偏好和阅读目的，不同类型的书籍价值各异',
    ],
    decisionTemplate: '推荐书籍需要知道你喜欢的类型（小说/非虚构/技术/历史等），或者你想通过阅读达到什么目的（学习/放松/提升技能）。',
    confidenceRule: { minMatchCount: 1, fullConfidence: 0.55, partialConfidence: 0.35 },
    tags: ['lifestyle', 'reading', 'recommendation'],
  },
  {
    id: 'movie-recommend',
    domain: 'lifestyle',
    queryPatterns: ['电影', '推荐电影', '好看的电影', '什么电影', '电影推荐', '看什么'],
    evidenceTemplates: [
      '电影推荐基于类型偏好、评分口碑和个人口味',
    ],
    decisionTemplate: '电影的选择很个人化。不同类型（剧情/喜剧/科幻/动作等）各有佳作。建议提供喜欢的类型或最近看过的电影，可以给你更有针对性的推荐。',
    confidenceRule: { minMatchCount: 1, fullConfidence: 0.5, partialConfidence: 0.3 },
    tags: ['lifestyle', 'movie', 'recommendation'],
  },
  {
    id: 'product-comparison',
    domain: 'lifestyle',
    queryPatterns: ['对比', '区别', '哪个好', 'vs', '比较', '怎么选', '选择'],
    evidenceTemplates: [
      '产品对比需要具体型号或品类、对比维度和使用场景',
    ],
    decisionTemplate: '要做出有效对比，请提供你想比较的具体产品/型号，以及你在意的维度（价格/性能/外观/续航等）。',
    confidenceRule: { minMatchCount: 1, fullConfidence: 0.5, partialConfidence: 0.3 },
    forbiddenPatterns: ['健身', '锻炼', '运动', '跑步'],  // 禁止误匹配到非比较场景
    tags: ['lifestyle', 'comparison', 'shopping'],
  },
  {
    id: 'fitness',  // 新增——明确健身专用 seed
    domain: 'lifestyle',
    queryPatterns: ['健身', '运动', '跑步', '锻炼', '减肥', '怎么练', '健身计划'],
    evidenceTemplates: [
      '运动健身的基本原则是循序渐进、持之以恒',
      '不同的运动目标（减脂/增肌/塑形）需要不同的训练方案',
    ],
    decisionTemplate: '运动健身建议根据个人目标和体质制定计划。一般原则：有氧+力量结合，控制饮食，保证休息。如需具体计划请提供你的目标和当前水平。',
    confidenceRule: { minMatchCount: 1, fullConfidence: 0.6, partialConfidence: 0.35 },
    tags: ['lifestyle', 'fitness', 'health'],
  },
  {
    id: 'fitness-advice',
    domain: 'lifestyle',
    queryPatterns: ['运动', '健身', '跑步', '减肥', '锻炼', '怎么练', '健身计划'],
    evidenceTemplates: [
      '运动健身的基本原则是循序渐进、持之以恒',
      '不同的运动目标（减脂/增肌/塑形）需要不同的训练方案',
    ],
    decisionTemplate: '运动健身建议根据个人目标和体质制定计划。一般原则：有氧+力量结合，控制饮食，保证休息。如需具体计划请提供你的目标和当前水平。',
    confidenceRule: { minMatchCount: 1, fullConfidence: 0.55, partialConfidence: 0.35 },
    tags: ['lifestyle', 'fitness', 'health'],
  },
  {
    id: 'diet-advice',
    domain: 'lifestyle',
    queryPatterns: ['吃', '饮食', '营养', '健康饮食', '吃什么', '食谱', '减肥餐'],
    evidenceTemplates: [
      '健康饮食的基本原则是均衡营养、适量多样',
    ],
    decisionTemplate: '健康饮食建议以均衡为原则，保证蛋白质、碳水、脂肪、维生素的合理搭配。如需具体建议请提供你的健康目标和饮食偏好。',
    confidenceRule: { minMatchCount: 1, fullConfidence: 0.5, partialConfidence: 0.3 },
    tags: ['lifestyle', 'diet', 'health'],
  },

  // ==================== 企业信息 ====================
  {
    id: 'company-general',
    domain: 'business_intel',
    queryPatterns: ['公司', '企业', '公司怎么样', '企业信息', '靠谱吗', '这家公司', '什么公司'],
    evidenceTemplates: [
      '企业信息评估基于公开可查的工商信息、行业地位和市场口碑',
      '本系统不做投资建议，不对企业的未来表现做预测',
    ],
    decisionTemplate: '关于企业的公开信息需要具体名称才能查询。请注意：本系统不做投资建议，所有企业信息仅供参考。',
    confidenceRule: { minMatchCount: 1, fullConfidence: 0.4, partialConfidence: 0.25 },
    tags: ['business', 'company', 'general'],
  },

  // ==================== 日常知识 ====================
  {
    id: 'greeting',
    domain: 'general_knowledge',
    queryPatterns: ['你好', '您好', 'hello', 'hi', '早上好', '晚上好', '下午好', '嗨', 'hey', '在吗', '在不在', '你叫什么'],
    evidenceTemplates: [
      '问候是社交礼仪的开端',
      '不同时间段的问候语可以不同',
    ],
    decisionTemplate: '你好呀！有什么我可以帮你的吗？😊',
    confidenceRule: { minMatchCount: 1, fullConfidence: 0.9, partialConfidence: 0.7 },
    tags: ['general_knowledge', 'greeting', 'social'],
  },
  {
    id: 'weather-related',
    domain: 'general_knowledge',
    queryPatterns: ['天气', '温度', '下雨', '明天', '周末', '今天天气'],
    evidenceTemplates: [
      '天气信息是动态数据，需要实时查询获取最新预报',
    ],
    decisionTemplate: '天气信息需要实时查询。建议查看天气应用或网站获取最新预报。',
    confidenceRule: { minMatchCount: 1, fullConfidence: 0.3, partialConfidence: 0.2 },
    tags: ['daily', 'weather'],
  },
  {
    id: 'time-related',
    domain: 'general_knowledge',
    queryPatterns: ['几点', '时间', '日期', '什么时候', '现在几点'],
    evidenceTemplates: [
      '时间信息可以从系统时钟获取',
    ],
    decisionTemplate: '当前时间取决于您的所在时区。如果您是北京时间（GMT+8），请查看系统时钟。',
    confidenceRule: { minMatchCount: 1, fullConfidence: 0.25, partialConfidence: 0.15 },
    tags: ['daily', 'time'],
  },
  {
    id: 'location-related',
    domain: 'general_knowledge',
    queryPatterns: ['哪里', '附近', '在哪', '怎么去', '地址', '位置'],
    evidenceTemplates: [
      '位置和地址信息需要具体名称或地点',
    ],
    decisionTemplate: '请提供具体的地点名称，以便给出更精确的参考信息。',
    confidenceRule: { minMatchCount: 1, fullConfidence: 0.25, partialConfidence: 0.15 },
    tags: ['daily', 'location'],
  },

  // ==================== P0 Seed Expansion V1 — 2026-06-22 ====================
  // 基于 AG-V1 Benchmark Gap Analysis，覆盖 local 48% gap queries
  // Batch: LOCAL_SEED_V1 — 增量写入，不修改现有 seed
  {
    id: 'local_food_recommendation',
    domain: 'local',
    queryPatterns: [
      '好吃的', '推荐餐厅', '必吃美食', '美食推荐', '夜市必吃',
      '好吃', '最正宗', '哪家好吃', '哪里吃', '值得吃',
      '美食攻略', '必吃', '特色美食', '当地美食',
      '好吃的菜', '特色小吃', '地道美食',
      '自助餐', '小龙虾', '烧烤', '臭豆腐', '鱼', '面',
      '菜馆', '餐厅推荐', '美食', '去哪吃', '吃东西',
    ],
    evidenceTemplates: [
      '本地美食推荐基于用户地理位置、美食类别偏好和公开口碑',
      '不同城市的特色美食各异，热门餐厅的评价信息可从本地生活平台获取',
    ],
    decisionTemplate: '本地美食推荐建议参考大众点评等平台的评价。不同的城市和地段口味差异较大，建议综合评分、人均消费和距离筛选。',
    confidenceRule: { minMatchCount: 1, fullConfidence: 0.6, partialConfidence: 0.35 },
    tags: ['local', 'food', 'recommendation', 'restaurant', 'cuisine'],
  },
  {
    id: 'local_travel_attraction',
    domain: 'local',
    queryPatterns: [
      '攻略', '门票', '旅游景点', '好玩的', '必去', '打卡',
      '最佳路线', '风景', '值得去', '游玩', '景点推荐',
      '旅游攻略', '一日游', '骑行路线', '景点预约',
    ],
    evidenceTemplates: [
      '旅游景点攻略可参考公开的旅行指南、游客评价和景区官方信息',
      '热门景点的最佳游览时间、门票价格和路线规划建议提前查询',
    ],
    decisionTemplate: '旅游景点的攻略信息建议参考携程/马蜂窝等平台的游客评价。热门时段需提前预约，避免节假日高峰。',
    confidenceRule: { minMatchCount: 1, fullConfidence: 0.6, partialConfidence: 0.35 },
    tags: ['local', 'travel', 'attraction', 'tourism', 'sightseeing'],
  },
  {
    id: 'local_travel_accommodation',
    domain: 'local',
    queryPatterns: [
      '酒店', '住宿', '民宿', '住', '哪里住', '住宿推荐',
      '酒店推荐', '房间', '旅馆', '入住',
      '签证', '自由行', '旅游多少钱', '旅游保险',
      '出国', '高原反应',
    ],
    evidenceTemplates: [
      '旅游住宿推荐基于位置、预算、评价综合考量',
      '出行费用因季节和行程而异，签证和保险信息以官方渠道为准',
    ],
    decisionTemplate: '住宿选择建议根据预算和地理位置筛选。出行前确认签证和保险要求，旺季建议提前预订。',
    confidenceRule: { minMatchCount: 1, fullConfidence: 0.55, partialConfidence: 0.3 },
    tags: ['local', 'travel', 'accommodation', 'hotel', 'lodging'],
  },
  {
    id: 'local_service_recommendation',
    domain: 'local',
    queryPatterns: [
      '哪家', '某个', '哪个', '怎么去',
      '附近', '排名', '靠谱', '好不好',
      '哪里找', '推荐服务', '推荐一个',
      '找修', '找医生', '找律师', '找师傅',
    ],
    evidenceTemplates: [
      '本地服务推荐基于公开评价、资质认证和用户反馈',
      '不同服务类型的评估维度不同，建议参考综合评价',
    ],
    decisionTemplate: '关于本地服务的推荐，建议参考大众点评/美团等平台的评价和排名。选择时关注资质认证、用户评价和性价比。',
    confidenceRule: { minMatchCount: 1, fullConfidence: 0.55, partialConfidence: 0.3 },
    tags: ['local', 'service', 'recommendation', 'directory'],
  },

  // ============================================================
  // P1.1: Enterprise + General Intent Seeds (Minimal — behavior validation only)
  // 2026-06-22: Intent Lattice → 7 intent nodes → 7 minimal seeds
  // 只包含 id + domain + queryPatterns + confidenceRule
  // 无 template — behavior validation pass 后再做 full spec
  // ============================================================

  // Enterprise: 企业公开商业情报
  {
    id: 'enterprise-company',
    domain: 'enterprise',
    queryPatterns: ['公司', '企业', '财报', '融资', '估值', '上市', '营收', '业务', '战略', '动态', '进展', '布局', '数字化', '全球化'],
    evidenceTemplates: [],
    decisionTemplate: '',
    confidenceRule: { minMatchCount: 1, fullConfidence: 0.7, partialConfidence: 0.4 },
    tags: ['enterprise', 'company', 'intelligence'],
  },

  // Enterprise: 产品/产能/市场数据
  {
    id: 'enterprise-product',
    domain: 'enterprise',
    queryPatterns: ['销量', '交付', '新品', '产能', '市场份额', '门店数量', '品牌', '产品'],
    evidenceTemplates: [],
    decisionTemplate: '',
    confidenceRule: { minMatchCount: 1, fullConfidence: 0.7, partialConfidence: 0.4 },
    tags: ['enterprise', 'product', 'market'],
  },

  // General: 概念解释
  {
    id: 'general-concept',
    domain: 'general',
    queryPatterns: ['什么是', '什么意思', '是什么意思', '原理', '技术原理', '是什么', '怎么理解', '本质'],
    evidenceTemplates: [],
    decisionTemplate: '',
    confidenceRule: { minMatchCount: 1, fullConfidence: 0.7, partialConfidence: 0.4 },
    tags: ['general', 'concept', 'explanation', 'definition'],
  },

  // General: 技能方法/学习路径
  {
    id: 'general-skill',
    domain: 'general',
    queryPatterns: ['怎么学', '怎么', '怎么样', '怎样', '学习路线', '学习方法', '怎么做', '做什么', '如何', '学习方法', '备考', '报考条件', '需要什么', '哪个好', '优缺点', '怎么选', '怎么操作', '学习'],
    evidenceTemplates: [],
    decisionTemplate: '',
    confidenceRule: { minMatchCount: 1, fullConfidence: 0.7, partialConfidence: 0.4 },
    tags: ['general', 'skill', 'guidance', 'learning'],
  },

  // General: 事实知识/数据查询
  {
    id: 'general-fact',
    domain: 'general',
    queryPatterns: ['是谁', '谁', '最新价格', '最新数据', '哪些', '有哪些'],
    evidenceTemplates: [],
    decisionTemplate: '',
    confidenceRule: { minMatchCount: 1, fullConfidence: 0.7, partialConfidence: 0.4 },
    tags: ['general', 'fact', 'knowledge', 'data'],
  },

  // General: 政策法规/金融操作
  {
    id: 'general-policy',
    domain: 'general',
    queryPatterns: ['政策', '利率', '怎么算', '怎么提取', '怎么查', '规则', '法规', '条件', '断缴', '影响'],
    evidenceTemplates: [],
    decisionTemplate: '',
    confidenceRule: { minMatchCount: 1, fullConfidence: 0.7, partialConfidence: 0.4 },
    tags: ['general', 'policy', 'finance', 'regulation'],
  },

  // General: 健康/生活指南
  {
    id: 'general-health',
    domain: 'general',
    queryPatterns: ['饮食', '症状', '减肥', '运动', '睡眠', '注意事项', '怎么预防'],
    evidenceTemplates: [],
    decisionTemplate: '',
    confidenceRule: { minMatchCount: 1, fullConfidence: 0.7, partialConfidence: 0.4 },
    tags: ['general', 'health', 'lifestyle'],
  },
]

/**
 * 根据领域筛选 seed
 */
export function getSeedsByDomain(domain: string): U0Seed[] {
  return DEFAULT_SEEDS.filter(s => s.domain === domain)
}

/**
 * 根据 ID 获取 seed
 */
export function getSeedById(id: string): U0Seed | undefined {
  return DEFAULT_SEEDS.find(s => s.id === id)
}

/**
 * 查询种子匹配度
 * 返回匹配的 seed 列表（按匹配关键词数降序）
 */
export function matchSeeds(query: string): Array<{ seed: U0Seed; matchCount: number; score: number }> {
  const lowerQuery = query.toLowerCase()
  const results: Array<{ seed: U0Seed; matchCount: number; score: number }> = []

  for (const seed of DEFAULT_SEEDS) {
    // 检查禁止域
    if (seed.forbiddenPatterns) {
      const forbiddenHit = seed.forbiddenPatterns.some(p => lowerQuery.includes(p.toLowerCase()))
      if (forbiddenHit) continue
    }

    let matchCount = 0
    for (const pattern of seed.queryPatterns) {
      if (lowerQuery.includes(pattern.toLowerCase())) {
        matchCount++
      }
    }

    if (matchCount >= seed.confidenceRule.minMatchCount) {
      const score = matchCount / seed.queryPatterns.length
      results.push({ seed, matchCount, score })
    }
  }

  // 按匹配度降序
  results.sort((a, b) => b.score - a.score)
  return results
}

/** 获取所有领域列表 */
export function getDomains(): string[] {
  return [...new Set(DEFAULT_SEEDS.map(s => s.domain))]
}

/** 获取统计信息 */
export function getSeedStats(): { total: number; byDomain: Record<string, number> } {
  const byDomain: Record<string, number> = {}
  for (const seed of DEFAULT_SEEDS) {
    byDomain[seed.domain] = (byDomain[seed.domain] || 0) + 1
  }
  return { total: DEFAULT_SEEDS.length, byDomain }
}
