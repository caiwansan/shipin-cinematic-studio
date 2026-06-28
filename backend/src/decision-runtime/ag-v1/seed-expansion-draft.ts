/**
 * seed-expansion-draft.ts — P0.3 Seed Expansion Draft v0
 *
 * 按陛下的要求，Seed 不是 cluster alias，而是 Query Generator System：
 *   Intent → Slot Filling → Query Generation → Retrieval Bias
 *
 * 只编译、不写入系统。用于 Seed Simulation 验证后再说。
 */

import { U0Seed } from '../p0/u0-seed-schema'

// ====== Slot 增强类型（纯 Draft，不修改 U0Seed 正式定义） ======
interface SlotDefinition {
  name: string
  type: 'string' | 'enum' | 'free'
  description: string
  examples?: string[]
}

interface SeedDraft {
  seed: U0Seed
  slots: SlotDefinition[]
  fixesGapClusters: string[]
  /** 预计覆盖的 gap queries（原文，用于 simulation） */
  expectedCoverage: string[]
}

// ====== P0 Seed Drafts ======

export const SEED_DRAFTS: SeedDraft[] = [

  // ====== 1. 本地美食推荐 ======
  {
    seed: {
      id: 'local_food_recommendation',
      domain: 'local',
      queryPatterns: [
        '{city}有什么好吃的{cuisine}',
        '{city}推荐餐厅',
        '{city}必吃美食',
        '{city}哪里吃{cuisine}比较划算',
        '{city}{place}附近有什么好吃的',
        '{city}{cuisine}哪家最正宗',
        '{city}{cuisine}推荐',
        '{city}夜市必吃',
        '{city}好吃的{cuisine}推荐',
        '{city}哪里吃{cuisine}',
      ],
      evidenceTemplates: [
        '本地美食推荐基于用户地理位置、美食类别偏好和公开口碑',
        '不同城市的特色美食各异，热门餐厅的口碑信息可从本地生活平台获取',
      ],
      decisionTemplate: '{city}的{cuisine}推荐可以参考本地美食平台上的评价。' +
        '建议根据评分、人均消费和距离筛选，不同地段的口味可能有差异。',
      confidenceRule: {
        minMatchCount: 2,
        fullConfidence: 0.7,
        partialConfidence: 0.4,
      },
      tags: ['local', 'food', 'recommendation'],
    },
    slots: [
      { name: 'city', type: 'string', description: '城市名', examples: ['杭州', '成都', '广州'] },
      { name: 'cuisine', type: 'string', description: '美食类别', examples: ['杭帮菜', '火锅', '热干面'] },
      { name: 'place', type: 'string', description: '具体地点', examples: ['西湖区', '春熙路', '新街口'] },
    ],
    fixesGapClusters: ['local_food_recommendation'],
    expectedCoverage: [
      '杭州西湖区最好吃的杭帮菜馆',
      '成都春熙路附近的火锅店推荐',
      '广州天河区好吃的粤菜餐厅',
      '武汉热干面哪家最正宗',
      '南京新街口有什么好吃的',
      '西安回民街必吃的美食有哪些',
      '长沙臭豆腐哪家最好吃',
      '青岛海鲜哪里吃比较划算',
      '苏州园林附近有什么好吃的',
      '大连海鲜自助餐厅推荐',
      '合肥哪家小龙虾好吃',
      '济南哪家烧烤最好',
      '福州三坊七巷附近的美食',
      '贵阳好吃的酸汤鱼推荐',
      '兰州拉面哪家最正宗',
      '南宁中山路夜市必吃',
      '呼和浩特蒙餐推荐',
      '昆明比较好吃的过桥米线',
      '南京夫子庙有什么好吃',
      '洛阳龙门石窟附近有啥好吃的',
      '天津狗不理包子值得吃吗',
    ],
  },

  // ====== 2. 旅游景点攻略 ======
  {
    seed: {
      id: 'local_travel_attraction',
      domain: 'local',
      queryPatterns: [
        '{city}旅游景点推荐',
        '{city}有什么好玩的',
        '{city}必去景点',
        '{attraction}攻略',
        '{attraction}门票',
        '{attraction}最佳路线',
        '{attraction}值得去吗',
        '{attraction}门票预约',
        '去{city}旅游攻略',
        '{attraction}一日游',
      ],
      evidenceTemplates: [
        '旅游景点攻略参考公开的旅行指南、游客评价和景区官方信息',
        '热门景点的最佳游览时间、门票价格和路线规划有成熟攻略',
      ],
      decisionTemplate: '{attraction}的攻略信息建议参考旅游平台和官方景区介绍。' +
        '热门时段需提前预约，建议避开节假日高峰。',
      confidenceRule: {
        minMatchCount: 2,
        fullConfidence: 0.7,
        partialConfidence: 0.4,
      },
      tags: ['local', 'travel', 'attraction'],
    },
    slots: [
      { name: 'city', type: 'string', description: '城市名', examples: ['黄山', '西安', '桂林'] },
      { name: 'attraction', type: 'string', description: '景点名', examples: ['黄山', '兵马俑', '阳朔'] },
    ],
    fixesGapClusters: ['local_travel_attraction'],
    expectedCoverage: [
      '黄山旅游最佳路线',
      '西湖旅游攻略一日游',
      '大理洱海骑行路线',
      '张家界玻璃桥攻略',
      '桂林阳朔漂流',
      '凤凰古城值得去吗',
      '西安兵马俑参观攻略',
      '成都大熊猫基地攻略',
      '珠海长隆海洋王国攻略',
      '敦煌莫高窟门票预约',
      '哈尔滨冰雪大世界门票怎么买',
    ],
  },

  // ====== 3. 旅游住宿/出行 ======
  {
    seed: {
      id: 'local_travel_accommodation',
      domain: 'local',
      queryPatterns: [
        '{city}酒店推荐',
        '{city}住宿哪里好',
        '{city}性价比住宿',
        '{city}民宿推荐',
        '去{city}旅游多少钱',
        '{country}签证',
        '旅游保险值得买',
        '出国旅游注意事项',
        '{city}自由行攻略',
        '{city}海滩',
      ],
      evidenceTemplates: [
        '旅游住宿推荐基于位置、预算、评价综合考量',
        '出行费用因季节和行程而异，签证和保险信息以官方渠道为准',
      ],
      decisionTemplate: '{city}的住宿选择较多，建议根据预算和地理位置筛选。' +
        '出行前确认签证和保险要求，旺季建议提前预订。',
      confidenceRule: {
        minMatchCount: 2,
        fullConfidence: 0.65,
        partialConfidence: 0.35,
      },
      tags: ['local', 'travel', 'accommodation'],
    },
    slots: [
      { name: 'city', type: 'string', description: '目的地', examples: ['重庆', '厦门', '丽江'] },
      { name: 'country', type: 'string', description: '国家/地区', examples: ['日本', '泰国'] },
    ],
    fixesGapClusters: ['local_travel_accommodation'],
    expectedCoverage: [
      '重庆解放碑附近住宿推荐',
      '厦门鼓浪屿民宿推荐',
      '丽江古城住宿推荐',
      '三亚海滩哪个人少',
      '泰国普吉岛自由行攻略',
      '马尔代夫旅游多少钱',
      '西双版纳旅游多少钱',
      '拉萨高原反应怎么预防',
      '日本签证怎么办理',
      '旅游保险有必要买吗',
      '出国旅游注意事项',
    ],
  },

  // ====== 4. 本地生活服务 ======
  {
    seed: {
      id: 'local_service_recommendation',
      domain: 'local',
      queryPatterns: [
        '{city}哪家{service}比较好',
        '{city}哪个{service}好',
        '{city}推荐{service}',
        '{city}排名',
        '{city}{service}推荐',
        '{city}靠谱{service}',
      ],
      evidenceTemplates: [
        '本地服务推荐基于公开评价、资质认证和用户反馈',
        '不同服务类型的评估维度不同，建议参考综合评价',
      ],
      decisionTemplate: '关于{city}的{service}推荐，建议参考本地生活服务平台的评价和排名。' +
        '选择时可以关注资质认证、用户评价和性价比。',
      confidenceRule: {
        minMatchCount: 2,
        fullConfidence: 0.65,
        partialConfidence: 0.35,
      },
      tags: ['local', 'service', 'recommendation'],
    },
    slots: [
      { name: 'city', type: 'string', description: '城市', examples: ['郑州', '上海', '深圳'] },
      { name: 'service', type: 'string', description: '服务类型', examples: ['律师事务所', '三甲医院', '驾校'] },
    ],
    fixesGapClusters: ['local_service_recommendation'],
    expectedCoverage: [
      '郑州哪家律师事务所比较好',
      '上海浦东三甲医院哪家好',
      '深圳南山区幼儿园排名',
      '北京海淀区哪个牙科诊所好',
      '深圳福田区哪个驾校好',
      '成都比较好的装修公司推荐',
    ],
  },
]

// ====== P1 概念补全 Seed Draft ======

export const P1_SEED_DRAFTS: SeedDraft[] = [
  // 通用概念解释（唯一高覆盖率的 P1 seed）
  {
    seed: {
      id: 'general_concept_explain',
      domain: 'general',
      queryPatterns: [
        '什么是{concept}',
        '{concept}是什么意思',
        '{concept}和{other}有什么区别',
        '什么是{concept}和{other}的区别',
        '{concept}怎么用',
      ],
      evidenceTemplates: [
        '概念解释基于通用知识库和公开资料',
        '不同技术概念的发展背景和应用场景各异',
      ],
      decisionTemplate: '{concept}是一个{context}概念。' +
        '如需详细了解，建议查阅相关专业资料或百科。',
      confidenceRule: {
        minMatchCount: 2,
        fullConfidence: 0.6,
        partialConfidence: 0.35,
      },
      tags: ['general', 'concept', 'explanation'],
    },
    slots: [
      { name: 'concept', type: 'string', description: '概念/术语', examples: ['碳中和', 'NFT', '量子计算'] },
      { name: 'other', type: 'string', description: '对比概念', examples: ['4G', '基金'] },
      { name: 'context', type: 'string', description: '概念所属领域', examples: ['科技', '金融', '医疗'] },
    ],
    fixesGapClusters: ['general_concept_explain'],
    expectedCoverage: [
      '碳中和是什么意思', '什么是通货膨胀',
      '什么是NFT', 'ChatGPT怎么用',
      '什么是量子计算', '什么是云计算',
      '什么是人工智能', '5G和4G有什么区别',
      '什么是大数据', '什么是物联网',
      '什么是元宇宙', '什么是Web3',
      '什么是自动驾驶', '什么是ETF',
      '什么是CPI', '什么是GDP',
      '什么是重疾险', '什么是惠民保',
      '什么是商业医疗保险', '什么是定期寿险',
      '年金险值得买吗', '什么是基金定投',
      '什么是ESG投资',
    ],
  },
]

console.log(`
✅ Seed Expansion Draft v0 已编译

P0 Seeds: ${SEED_DRAFTS.length}
  1. local_food_recommendation — 覆盖 ${SEED_DRAFTS[0].expectedCoverage.length} 条 gap
  2. local_travel_attraction — 覆盖 ${SEED_DRAFTS[1].expectedCoverage.length} 条 gap
  3. local_travel_accommodation — 覆盖 ${SEED_DRAFTS[2].expectedCoverage.length} 条 gap
  4. local_service_recommendation — 覆盖 ${SEED_DRAFTS[3].expectedCoverage.length} 条 gap

P1 Seeds: ${P1_SEED_DRAFTS.length}
  5. general_concept_explain — 覆盖 ${P1_SEED_DRAFTS[0].expectedCoverage.length} 条 gap

总计预期覆盖: ${
  SEED_DRAFTS.reduce((s, d) => s + d.expectedCoverage.length, 0) +
  P1_SEED_DRAFTS.reduce((s, d) => s + d.expectedCoverage.length, 0)
} / 125 gap queries
`)

export {}
