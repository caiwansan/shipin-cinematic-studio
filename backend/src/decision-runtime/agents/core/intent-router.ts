/**
 * intent-router.ts — Phase AG-2.2: Intent Router
 *
 * 将用户查询分类为 4 种意图：
 *   local       → 本地生活服务（律所/医院/餐厅）
 *   enterprise  → 企业/公司查询
 *   product     → 产品评测/对比
 *   general     → 通用知识
 *
 * 输出 ExpansionPolicy，控制 search.agent 的模板选择 + 输出预算
 *
 * 铁律:
 *   1. 只做规则分类，禁止 LLM
 *   2. policy 必须可解释（原因跟策略一起输出）
 *   3. 不参与 ranking
 *
 * @phase decision-runtime / ag-2.2
 */

export type Intent = 'local' | 'enterprise' | 'product' | 'general'

export interface ExpansionPolicy {
  includeBase: boolean     // 基础模板（5 条）
  includeLocal: boolean    // 地址/电话/位置模板
  includeEnterprise: boolean // 公司信息/可信度模板
  includeProduct: boolean  // 对比/优缺点模板
  maxQueries: number       // 输出预算（最终最多输出条数）
}

export interface RouterDecision {
  intent: Intent
  policy: ExpansionPolicy
  reason: string           // 为什么归为此类
  sourceBias: {
    web: number
    poi?: number
    enterprise?: number
  }
}

export function routeIntent(query: string): RouterDecision {
  const q = query.toLowerCase()

  // ========== LOCAL（本地生活服务）==========
  if (
    /附近|地址|电话|在哪|怎么去|营业时间|门牌|位置|店面/.test(q) ||
    /律师|律所|医院|诊所|餐厅|饭店|酒店|理发|美容|健身房/.test(q) ||
    /好吃的|好吃|必吃|美食|餐厅推荐|菜馆|小吃|自助|旅馆|民宿|门票|景点|景点|游览|旅游|驾校|幼儿园|律所/.test(q)
  ) {
    return {
      intent: 'local',
      policy: {
        includeBase: true,
        includeLocal: true,
        includeEnterprise: false,
        includeProduct: false,
        maxQueries: 5,
      },
      reason: '匹配本地生活服务类关键词（地址/电话/具体机构类型/美食/旅游）',
      sourceBias: { web: 0.3, poi: 0.7 },
    }

  }

  // ========== ENTERPRISE（企业/公司查询）==========
  if (
    /公司|靠谱吗|企业|法人|注册|老板|信用|资质|背景|工商|税务|旗下|销量|交付量|融资|上市|财报/.test(q)
  ) {
    return {
      intent: 'enterprise',
      policy: {
        includeBase: true,
        includeLocal: false,
        includeEnterprise: true,
        includeProduct: false,
        maxQueries: 8,
      },
      reason: '匹配企业/公司查询类关键词',
      sourceBias: { web: 0.4, enterprise: 0.6 },
    }
  }

  // ========== PRODUCT（产品对比/推荐）==========
  if (
    /推荐|哪个好|哪个牌子|买哪个|对比|值得|值得买|好不|好用|优缺点|评测|测评|性价比/.test(q)
  ) {
    return {
      intent: 'product',
      policy: {
        includeBase: true,
        includeLocal: false,
        includeEnterprise: false,
        includeProduct: true,
        maxQueries: 8,
      },
      reason: '匹配产品推荐/对比类关键词',
      sourceBias: { web: 0.8 },
    }
  }

  // ========== GENERAL（通用兜底）==========
  return {
    intent: 'general',
    policy: {
      includeBase: true,
      includeLocal: false,
      includeEnterprise: false,
      includeProduct: false,
      maxQueries: 5,
    },
    reason: '未匹配特定意图模式，按通用查询处理',
    sourceBias: { web: 1.0 },
  }
}
