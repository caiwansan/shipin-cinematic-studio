import { BaseLLMProvider } from '../../providers/narrative/interface.js'
import { narrativeGateway } from '../../runtime/narrative-gateway.js'
import { prisma } from '../../utils/index.js'
import { decryptKey } from '../crypto.service.js'

// ═══════════════════════════════════════════════════════════════
// RAG Context Builder
// ═══════════════════════════════════════════════════════════════

// 中文法律关键词 → 类别映射
const LEGAL_CATEGORY_KEYWORDS: Record<string, string[]> = {
  '劳动纠纷': ['劳动','工资','社保','加班','试用期','劳动合同','辞退','裁员','工伤','赔偿金','经济补偿','离职','开除','仲裁','工龄','年假','失业','工伤保险','欠薪','不发工资','克扣工资','没发工资'],
  '合同纠纷': ['合同','违约','定金','违约金','合同解除','买卖合同','租赁合同','欠款','债务','欠钱','不履行','不付款','拖欠','付款'],
  '消费者权益': ['网购','退货','退款','假一赔三','消费者','产品','质量','保质期','三包','电商','平台','外卖','欺诈','虚假宣传','商品','买家','卖家','退换','七天无理由','假货','运费险','直播间','售后','差价','买到'],
  '侵权纠纷': ['侵权','伤害','赔偿','人身损害','精神损害','名誉权','肖像权','隐私','诽谤','车祸'],
  '婚姻家庭': ['离婚','结婚','彩礼','抚养权','抚养费','财产分割','继承','遗嘱','家暴','赡养','出轨','分居','外遇'],
  '知识产权': ['专利','商标','著作权','版权','侵权','盗版','山寨'],
  '房产纠纷': ['买房','卖房','房产','物业','租房','房东','租金','装修','拆迁'],
  '交通纠纷': ['车祸','交通事故','酒驾','剐蹭','车险','交通肇事'],
  '债权债务': ['债务','催收','欠钱','担保','担保人','借钱','高利贷','民间借贷','欠债','不还钱','讨债','不还','借'],
  '刑事诉讼': ['犯罪','盗窃','诈骗','抢劫','故意伤害','刑事','刑罚','拘留','逮捕'],
  '行政纠纷': ['行政复议','行政诉讼','行政处罚','拘留','罚款','许可证','征地'],
  '金融保险': ['保险','理赔','股票','基金','投资','贷款','银行','信用卡'],
  '公司商事': ['公司','股东','股权','法人','注册资本','董事','破产'],
  '环境资源': ['环境','污染','排放','废物','生态','自然资源','土地','水','大气'],
}

/** 中文法律同义词映射 — 把用户口语词映射到法律条文常用词 */
const LEGAL_SYNONYM_MAP: Record<string, string[]> = {
  '假货': ['欺诈','假冒','伪造','假','仿冒','山寨'],
  '假': ['欺诈','假冒','伪造'],
  '买到假的': ['欺诈','假冒'],
  '不退款': ['退货','履行','违约'],
  '不退钱': ['退货','退款','返还'],
  '不给退货': ['退货','更换','七天'],
  '质量有问题': ['质量','缺陷','不合格'],
  '坏了': ['质量','缺陷','不合格'],
  '伤人了': ['人身损害','伤害'],
  '要赔偿': ['赔偿','损失','三倍'],
  '被坑了': ['欺诈','欺骗','虚假'],
  '骗': ['欺诈','欺骗','虚假'],
  '出轨': ['离婚','感情破裂','与他人同居','分居','婚姻关系'],
  '不还': ['债务','欠款','违约','履行','债权'],
  '借': ['借款','债务','欠款','民间借贷'],
  '不还钱': ['债务','欠款','违约','债权'],
  '不付款': ['违约','债务','欠款','不履行'],
  '没发': ['不发','拖欠','欠薪','克扣'],
  '拖欠': ['不付','欠薪','克扣','迟延'],
  '不付钱': ['违约','债务','欠款','不履行'],
  '不给钱': ['违约','债务','欠款','不履行'],
  '收不到钱': ['违约','债务','欠款'],
  '拖欠': ['违约','债务','欠款','迟延'],
  '辞退': ['解除','终止','开除'],
  '被辞退': ['解除','终止','开除'],
  '开除': ['解除','终止','辞退'],
  '商家跑路': ['债务','清算','破产'],
}

/** 推断用户消息所属的法律类别 */
function inferLegalCategories(message: string): string[] {
  const scores: Record<string, number> = {}
  const msg = message.toLowerCase()

  for (const [category, keywords] of Object.entries(LEGAL_CATEGORY_KEYWORDS)) {
    let score = 0
    for (const kw of keywords) {
      if (msg.includes(kw.toLowerCase())) {
        // 长词（>=4字）权重更高，更能精准反映领域
        score += kw.length >= 4 ? 2 : 1
      }
    }
    if (score > 0) {
      scores[category] = score
    }
  }

  // 特殊规则：如果消息中包含"工资"且非合同纠纷语境（完全不含"合同"），自动增强劳动纠纷权重
  if (msg.includes('工资') && !msg.includes('合同')) {
    scores['劳动纠纷'] = (scores['劳动纠纷'] || 0) + 1
  }

  // 按匹配权重排序，返回 top-3 类别
  return Object.entries(scores)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([cat]) => cat)
}

/** 从用户消息提取搜索关键词（含同义词扩展） */
function extractSearchKeywords(message: string): string[] {
  const rawTokens = message.split(/[\s,，。、；;：:！!？?()（）【】\[\]{}"'""''"\n\r\t]+/).filter(k => k.length >= 2)
  const keywordSet = new Set<string>()

  for (const token of rawTokens) {
    keywordSet.add(token)
    // 同义词扩展
    for (const [phrase, synonyms] of Object.entries(LEGAL_SYNONYM_MAP)) {
      if (token.includes(phrase)) {
        for (const syn of synonyms) {
          if (syn.length >= 2) keywordSet.add(syn)
        }
      }
    }

    // 长句（>6字）二次切分为更小的关键词
    if (token.length > 6) {
      // 按 2~4 字取有意义片段
      for (let i = 0; i < token.length; i++) {
        for (let len = 4; len >= 2; len--) {
          if (i + len <= token.length) {
            const sub = token.slice(i, i + len)
            if (sub.length >= 2) keywordSet.add(sub)
            // 一旦切出4字就不继续同起点更短词
            break
          }
        }
        if (keywordSet.size > 30) break
      }
    }
  }

  return [...keywordSet].slice(0, 12)
}

/** 构建 RAG 上下文（用于 LLM prompt）—— 先用关键词初筛类别，再让 LLM 从类别中选法规 */
async function buildRagContext(userMessage: string): Promise<string> {
  try {
    // 1. 关键词初筛法律类别
    const categories = inferLegalCategories(userMessage)
    if (categories.length === 0) {
      return '（无法确定法律领域，请根据 AI 通用法律知识回答，并说明"以下法律依据来自 AI 知识库，建议核实最新版本"）'
    }

    let categoryHint = `【法律领域推断】用户问题可能涉及：${categories.join('、')}\n`

    // 2. 从数据库读取这些类别的法规目录
    const { prisma } = await import('../../utils/index.js')
    const regulations = await prisma.legalRegulation.findMany({
      where: { enabled: true, category: { in: categories } },
      select: { id: true, title: true, category: true },
      orderBy: [{ category: 'asc' }, { title: 'asc' }],
    })

    if (regulations.length === 0) {
      return `${categoryHint}\n*（未找到匹配类别的法律依据，请参考 AI 通用法律知识）*`
    }

    // 3. 构建法规目录
    const catalog = regulations.map(r => `[${r.category}] ${r.title}`).join('\n')

    // 4. 返回格式化的上下文，让 LLM 自己判断
    return `

## 相关法律依据候选列表
${categoryHint}
以下是 ${categories.join('、')} 领域的法律法规目录，共 ${regulations.length} 部。请分析用户问题后，**自行判断**哪些法规与问题直接相关，并在回答中引用它们。

法规目录：
${catalog}

引用规则：
- 只引用与用户场景直接相关的法规，不要引用所有法规
- 引用格式：依据：《法规名称》第X条
- 如果目录中没有直接适用的法规，可以依据 AI 通用法律知识，但需注明
`
  } catch {
    return ''
  }
}

/** 构建 RAG 检索结果列表（用于前端"法律依据"卡片，不依赖关键词硬匹配） */
async function buildRagResults(userMessage: string): Promise<{ citation: string; score: number; content: string; category?: string }[]> {
  try {
    const categories = inferLegalCategories(userMessage)
    if (categories.length === 0) return []

    const { prisma } = await import('../../utils/index.js')
    const regulations = await prisma.legalRegulation.findMany({
      where: { enabled: true, category: { in: categories } },
      select: { id: true, title: true, category: true },
      orderBy: [{ category: 'asc' }, { title: 'asc' }],
    })

    if (regulations.length === 0) return []

    // 让 LLM 从目录中选出相关法规
    const catalog = regulations.map((r, i) => `${i + 1}. [${r.category}] ${r.title}`).join('\n')

    const selectPrompt = `你是一位严谨的中国法律专家。

用户的问题：${userMessage}

以下是法律目录（${categories.join('、')} 领域，共 ${regulations.length} 部法规）。请判断哪些法规与用户问题**有直接法律关系**，只输出它们的编号列表。

目录：
${catalog}

输出格式（只输出编号）：
1,3,5,7`

    const result = await narrativeGateway.execute({
      systemPrompt: selectPrompt,
      userMessage: '请输出编号列表。',
      temperature: 0.1,
      timeoutTier: 'fast',
    } as any)

    // 解析 LLM 输出
    const selectedIndices = new Set<number>()
    const numbers = result.content.match(/\d+/g)
    if (numbers) {
      for (const n of numbers) {
        const idx = parseInt(n, 10)
        if (idx >= 1 && idx <= regulations.length) {
          selectedIndices.add(idx)
        }
      }
    }

    if (selectedIndices.size === 0) return []

    const selected = [...selectedIndices].slice(0, 5).map(i => {
      const r = regulations[i - 1]
      return {
        citation: `《${r.title}》`,
        score: 0.7,
        content: '',
        category: r.category,
      }
    })

    return selected
  } catch (err) {
    console.error(`[LegalRAG] buildRagResults 异常:`, err)
    return []
  }
}

/** 构建案件记忆摘要 */
async function buildCaseMemory(caseId: string): Promise<string> {
  try {
    const caseData = await prisma.legalCase.findUnique({
      where: { id: caseId },
      select: { caseName: true, status: true, party: true, category: true, description: true },
    })
    if (!caseData) return ''

    // 获取最近对话
    const messages = await prisma.legalMessage.findMany({
      where: { caseId },
      orderBy: { createdAt: 'desc' as const },
      take: 10,
      select: { role: true, content: true },
    })

    // 获取文件/证据摘要
    const files = await prisma.legalCaseFile.findMany({
      where: { caseId },
      take: 5,
      select: { fileName: true, fileType: true },
    })

    const evidence = await prisma.legalEvidence.findMany({
      where: { caseId },
      take: 10,
      select: { name: true, status: true, category: true },
    })

    // 获取最新分析
    const latestAnalysis = await prisma.legalCaseAnalysis.findFirst({
      where: { caseId },
      orderBy: { createdAt: 'desc' as const },
      select: { conclusion: true, riskAssessment: true },
    })

    // 获取合同/文书
    const contracts = await prisma.legalContract.findMany({
      where: { caseId },
      select: { id: true, title: true },
    })

    const documents = await prisma.legalDocument.findMany({
      where: { caseId },
      select: { id: true, title: true },
    })

    const messagesText = messages.slice().reverse().map(m =>
      `${m.role === 'user' ? '用户' : 'AI'}: ${m.content.slice(0, 200)}`
    ).join('\n')

    const filesSummary = files.map(f => `- ${f.fileName} (${f.fileType})`).join('\n') || '暂无文件'
    const evidenceSummary = evidence.map(e => `- ${e.name} [${e.status}] ${e.category ? '('+e.category+')' : ''}`).join('\n') || '暂无证据'

    const latestAnalysisText = latestAnalysis
      ? `结论：${latestAnalysis.conclusion?.slice(0, 300) || '无'}\n风险评估：${latestAnalysis.riskAssessment || '无'}`
      : '暂无分析'

    return `
## 案件信息
- 名称：${caseData.caseName}
- 状态：${caseData.status}
- 当事人：${caseData.party || '未填写'}
- 分类：${caseData.category || '未分类'}
- 描述：${caseData.description || '无'}

## 最近对话
${messagesText || '暂无对话'}

## 文件
${filesSummary || '暂无文件'}

## 证据
${evidenceSummary || '暂无证据'}

## 最新分析
${latestAnalysisText}

## 合同/文书
合同数：${contracts.length} | 文书数：${documents.length}
`.trim()
  } catch {
    return ''
  }
}

/** 获取用户自己的 LLM 配置（优先用户配置，回退平台默认） */
async function getUserLLMConfig(userId: string): Promise<{
  apiKey: string
  baseUrl: string
  model: string
  provider?: string
}> {
  // 1. 从 UserModelConfigV2 表读取用户配置
  if (userId) {
    try {
      const userConfig = await prisma.userModelConfigV2?.findFirst({
        where: { userId },
        orderBy: { createdAt: 'desc' as const },
      })
      if (userConfig?.llmApiKey) {
        // UserModelConfigV2 中的 llmApiKey 是加密的，需解密
        const decrypted = decryptKey(userConfig.llmApiKey)
        if (decrypted) {
          // 字段兼容：优先 llmModel，回退 modelName；llmBaseUrl 优先于 baseUrl
          const model = userConfig.llmModel || userConfig.modelName || ''
          const baseUrl = userConfig.llmBaseUrl || userConfig.baseUrl || ''
          return {
            apiKey: decrypted,
            baseUrl,
            model,
            provider: userConfig.llmProvider || '',
          }
        }
      }
    } catch {
      // 静默失败，回退平台默认
    }
  }

  // 2. 回退：从 legal_system_configs 表读取 LLM 配置（若用户未配置）
  try {
    const sysConfig = await prisma.legalSystemConfigs?.findFirst({
      where: { key: 'LLM_ENV_KEYS' },
    })
    if (sysConfig?.value) {
      const parsed = JSON.parse(sysConfig.value)
      if (parsed.apiKey) {
        return {
          apiKey: parsed.apiKey,
          baseUrl: parsed.baseUrl || '',
          model: parsed.model || '',
        }
      }
    }
  } catch {
    // 静默失败
  }

  // 3. 最终回退：使用平台 LLM 路由
  return {
    apiKey: '',
    baseUrl: '',
    model: '',
  }
}

/** 根据 provider 获取默认 baseUrl */
function getDefaultBaseUrl(provider?: string): string {
  const providers: Record<string, string> = {
    volcengine: 'https://ark.cn-beijing.volces.com/api/v3',
    aliyun: 'https://dashscope.aliyuncs.com/compatible-mode/v1',
    deepseek: 'https://api.deepseek.com',
    zhipu: 'https://open.bigmodel.cn/api/paas/v4',
    siliconflow: 'https://api.siliconflow.cn/v1',
  }
  return providers[provider || ''] || ''
}

/** LLM 调用（优先用户配置，回退平台 gateway） */
async function callLLM(opts: {
  systemPrompt: string
  userMessage: string
  userId: string
  timeoutTier?: 'fast' | 'normal' | 'deep'
}): Promise<string> {
  const { systemPrompt, userMessage, userId, timeoutTier = 'normal' } = opts

  // 1. 尝试用户自配置 LLM
  const userConfig = await getUserLLMConfig(userId)
  if (userConfig.apiKey) {
    try {
      console.log(`[LegalAgent] 使用用户 LLM 配置: provider=${userConfig.provider}, model=${userConfig.model}, baseUrl=${userConfig.baseUrl}`)
      // 用户没填 baseUrl 时，根据 provider 推断默认地址
      const effectiveBaseUrl = userConfig.baseUrl || getDefaultBaseUrl(userConfig.provider)
      const { OpenAIProvider } = await import('../../runtime/providers/openai.provider.js')
      const provider = new OpenAIProvider({
        name: 'user-llm',
        apiKey: userConfig.apiKey,
        baseUrl: effectiveBaseUrl,
      })
      const result = await provider.call({
        model: userConfig.model,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userMessage },
        ],
        temperature: 0.5,
        maxTokens: 4096,
      })
      return result.content
    } catch (err: any) {
      console.error(`[LegalAgent] 用户 LLM 调用失败，回退平台: ${err.message}`)
    }
  }

  // 2. 回退平台 gateway
  try {
    const result = await narrativeGateway.execute({
      systemPrompt,
      userMessage,
      temperature: 0.5,
      timeoutTier,
    } as any)
    return result.content
  } catch (err: any) {
    throw new Error(`LLM 调用失败: ${err.message}`)
  }
}

// ═══════════════════════════════════════════════════════════════
// Legal Agent — 核心接口
// ═══════════════════════════════════════════════════════════════

export class LegalAgent {

  /**
   * 聊天 — 最常用入口
   */
  async chat(
    caseId: string,
    sessionId: string,
    userMessage: string,
    userId: string,
  ): Promise<{ content: string; ragSources: { citation: string; score: number; content: string; category?: string }[] }> {
    const [caseMemory, ragContext, ragResults] = await Promise.all([
      buildCaseMemory(caseId),
      buildRagContext(userMessage),
      buildRagResults(userMessage),
    ])

    const systemPrompt = `
## 当前案件上下文
${caseMemory}

## 法律依据候选
${ragContext}

## 回答要求
请分析用户问题后，自行判断以上法律依据候选列表中哪些法规直接适用。

回答结构：
1. **问题类型判断**：简要说明用户问题属于哪个法律领域
2. **咨询或追问**：如信息不足，追问关键细节
3. **法律依据与分析**：引用选中的法规具体条款
4. **行动建议**：给出具体可操作的维权步骤

引用格式：依据：《法规名称》第X条

禁止：保证胜诉、替代律师、编造不存在条款`

    const content = await callLLM({
      systemPrompt,
      userMessage,
      userId,
      timeoutTier: 'normal',
    })

    // 异步更新案件摘要
    this.updateCaseSummary(caseId, { caseMemory, userMessage, aiReply: content }).catch(() => {})

    return { content, ragSources: ragResults }
  }

  /**
   * 触发 AI 全量分析
   */
  async analyze(caseId: string, userId: string, version: number = 1): Promise<any> {
    const caseMemory = await buildCaseMemory(caseId)
    const searchQuery = caseMemory.replace(/[#*\n]/g, '').slice(0, 300)
    const ragContext = await buildRagContext(searchQuery)
    const systemPrompt = `你是一位专业的中国法律分析专家，请对以下案件进行全面分析。`

    const analysisPrompt = `请对以下案件进行全面分析，输出 JSON 格式的分析报告，包含：案件摘要、法律依据、风险点、证据需求和行动建议。\n\n${caseMemory}\n\n${ragContext}`

    const content = await callLLM({
      systemPrompt,
      userMessage: analysisPrompt,
      userId,
      timeoutTier: 'deep',
    })

    // 解析 LLM 返回的 JSON/AI 分析结果
    let parsed: any = content
    try { parsed = JSON.parse(content) } catch {}

    // 返回结果（路由负责更新记录）
    return {
      status: 'done',
      summary: typeof parsed === 'string' ? parsed : parsed.案件摘要 || parsed.summary || content.slice(0, 500),
      riskAnalysis: typeof parsed === 'object' && parsed.风险点 ? JSON.stringify(parsed.风险点) : typeof parsed === 'object' && parsed.riskAnalysis ? JSON.stringify(parsed.riskAnalysis) : null,
      missingEvidence: typeof parsed === 'object' && parsed.证据需求 ? JSON.stringify(parsed.证据需求) : typeof parsed === 'object' && parsed.missingEvidence ? JSON.stringify(parsed.missingEvidence) : null,
    }
  }

  /**
   * 生成合同
   */
  async generateContract(caseId: string, userId: string, prompt: string): Promise<string> {
    const caseMemory = await buildCaseMemory(caseId)
    const ragContext = await buildRagContext(prompt)

    const fullPrompt = `请根据以下要求生成合同。\n\n案件背景：\n${caseMemory}\n\n相关法律依据：\n${ragContext}\n\n用户要求：${prompt}\n\n请生成完整的合同文本。`

    return callLLM({
      systemPrompt: '你是一位中国合同法律师，擅长起草各类商业合同。请输出清晰、规范的合同文本。',
      userMessage: fullPrompt,
      userId,
      timeoutTier: 'deep',
    })
  }

  /**
   * 生成法律文书
   */
  async generateDocument(caseId: string, userId: string, prompt: string): Promise<string> {
    const caseMemory = await buildCaseMemory(caseId)
    const ragContext = await buildRagContext(prompt)

    const fullPrompt = `请根据以下要求生成法律文书。\n\n案件背景：\n${caseMemory}\n\n相关法律依据：\n${ragContext}\n\n用户要求：${prompt}\n\n请生成完整的法律文书。`

    return callLLM({
      systemPrompt: '你是一位中国律师，擅长撰写各类法律文书。请输出格式规范、条理清晰的法律文书。',
      userMessage: fullPrompt,
      userId,
      timeoutTier: 'deep',
    })
  }

  /**
   * 更新案件摘要
   */
  private async updateCaseSummary(caseId: string, context: { caseMemory: any; userMessage: string; aiReply: string }): Promise<void> {
    try {
      const existing = await prisma.legalCase.findUnique({ where: { id: caseId }, select: { summary: true } })
      const newSummary = existing?.summary
        ? `${existing.summary}\n\n用户: ${context.userMessage.slice(0, 200)}\nAI: ${context.aiReply.slice(0, 200)}`
        : `用户: ${context.userMessage.slice(0, 200)}\nAI: ${context.aiReply.slice(0, 200)}`

      await prisma.legalCase.update({
        where: { id: caseId },
        data: { summary: newSummary.slice(0, 2000) },
      })
    } catch {}
  }
}

// Singleton instance
export const legalAgent = new LegalAgent()
