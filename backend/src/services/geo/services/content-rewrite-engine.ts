// ============================================================
// Content Rewrite Engine — AI 员工自动改写知识内容
//
// 核心能力：根据诊断报告，用 LLM 生成/改写品牌知识内容
// 1. 知识缺口 → 生成全新知识条目
// 2. 内容过短 → 扩充至有效长度
// 3. 缺乏数据 → 添加可量化信息
// 4. 定位模糊 → 强化品牌差异化
// ============================================================

import { prisma } from '../../../utils/index.js'
import { genericLLM } from '../../deepseek-llm.provider.js'
import type { DiagnosisReport, KnowledgeGap, ContentIssue } from './diagnosis-engine.js'

// ── Types ──

export interface RewriteResult {
  success: boolean
  /** 新增的知识条目数 */
  itemsCreated: number
  /** 修改的知识条目数 */
  itemsUpdated: number
  /** 执行详情 */
  details: RewriteDetail[]
  /** 错误信息 */
  error?: string
}

export interface RewriteDetail {
  action: 'create' | 'update'
  topic: string
  content: string
  reason: string
  knowledgeId?: string
}

// ── Helpers ──

function isLLMAvailable(): boolean {
  return !!(process.env.DEEPSEEK_API_KEY || process.env.OPENAI_API_KEY || process.env.SILICONFLOW_API_KEY || process.env.LONGCAT_API_KEY)
}

function getLLMConfig() {
  if (process.env.LONGCAT_API_KEY) {
    return { provider: 'longcat', apiKey: process.env.LONGCAT_API_KEY, model: 'LongCat-2.0', baseUrl: 'https://api.longcat.chat/openai/v1' }
  }
  if (process.env.SILICONFLOW_API_KEY) {
    return { provider: 'siliconflow', apiKey: process.env.SILICONFLOW_API_KEY, model: 'deepseek-ai/DeepSeek-V3.2', baseUrl: 'https://api.siliconflow.cn/v1' }
  }
  if (process.env.DEEPSEEK_API_KEY) {
    return { provider: 'deepseek', apiKey: process.env.DEEPSEEK_API_KEY, model: 'deepseek-v4-flash', baseUrl: 'https://api.deepseek.com' }
  }
  return null
}

async function getBrandData(projectId: string) {
  const [brandSetting, brandProfile, existingKOs] = await Promise.all([
    prisma.geoBrandSetting.findFirst({ where: { projectId } }).catch(() => null),
    prisma.geoBrandProfile.findFirst({ where: { projectId } }).catch(() => null),
    prisma.knowledgeObject.findMany({ where: { projectId }, take: 50 }).catch(() => []),
  ])
  return { brandSetting, brandProfile, existingKOs }
}

// ── Main: Rewrite from Diagnosis ──

/**
 * 根据诊断报告执行内容改写
 * 
 * @param projectId 项目 ID
 * @param diagnosis 诊断报告
 * @returns RewriteResult
 */
export async function rewriteFromDiagnosis(
  projectId: string,
  diagnosis: DiagnosisReport
): Promise<RewriteResult> {
  const details: RewriteDetail[] = []
  let itemsCreated = 0
  let itemsUpdated = 0

  if (!isLLMAvailable()) {
    return {
      success: false,
      itemsCreated: 0,
      itemsUpdated: 0,
      details: [],
      error: '未配置 AI 引擎 API Key',
    }
  }

  const brand = await getBrandData(projectId)
  const brandName = brand.brandSetting?.brandName || brand.brandProfile?.brandName || 'Brand'
  const industry = brand.brandSetting?.industry || brand.brandProfile?.industry || ''
  const website = brand.brandSetting?.website || brand.brandProfile?.website || ''
  const description = brand.brandSetting?.description || brand.brandProfile?.brandDesc || ''  
  const existingTopics = (brand.existingKOs || []).map((ko: any) => ko.topic).filter(Boolean)
  const existingKnowledge = (brand.existingKOs || []).map((ko: any) => {
    const meta = ko.metadata || {}
    return { id: ko.id, topic: ko.topic || '', content: meta.content || meta.text || '' }
  }).filter((k: any) => k.topic)

  // 1. 处理知识缺口 → 生成新知识
  for (const gap of diagnosis.knowledgeGaps.slice(0, 5)) { // 最多处理 5 个缺口
    try {
      const newKnowledge = await generateKnowledgeForGap(gap, {
        brandName,
        industry,
        website,
        description,
        existingTopics,
      })

      if (newKnowledge) {
        // Save to DB
        await prisma.knowledgeObject.create({
          data: {
            projectId,
            topic: newKnowledge.topic,
            status: 'GENERATED',
            confidence: 0.8,
            qualityScore: 0.7,
            metadata: {
              source: 'rewrite_engine',
              method: 'llm_diagnosis',
              content: newKnowledge.content,
              reason: `知识缺口填补: ${gap.description}`,
              relatedQuestions: gap.relatedQuestions,
            },
          },
        })
        details.push({
          action: 'create',
          topic: newKnowledge.topic,
          content: newKnowledge.content,
          reason: `填补知识缺口: ${gap.description}`,
        })
        itemsCreated++
      }
    } catch (err) {
      // skip this gap
    }
  }

  // 2. 处理内容质量问题 → 改写现有知识
  for (const issue of diagnosis.contentIssues) {
    if (issue.type === 'too_short') {
      // 找到对应的知识条目并改写
      const affectedItems = existingKnowledge.filter((k: any) => 
        issue.affectedKnowledgeIds.includes(k.id)
      )
      for (const item of affectedItems.slice(0, 3)) { // 最多改写 3 条
        try {
          const rewritten = await rewriteShortContent(item, {
            brandName,
            industry,
            description,
          })
          if (rewritten) {
            await prisma.knowledgeObject.update({
              where: { id: item.id },
              data: {
                metadata: {
                  content: rewritten.content,
                  source: 'rewrite_engine',
                  method: 'llm_expand',
                  reason: '内容过短扩充',
                  originalContent: item.content,
                },
                qualityScore: 0.7,
              },
            })
            details.push({
              action: 'update',
              topic: item.topic,
              content: rewritten.content,
              reason: '内容过短扩充至有效长度',
              knowledgeId: item.id,
            })
            itemsUpdated++
          }
        } catch {
          // skip
        }
      }
    }

    if (issue.type === 'no_data') {
      const affectedItems = existingKnowledge.filter((k: any) => 
        issue.affectedKnowledgeIds.includes(k.id)
      )
      for (const item of affectedItems.slice(0, 3)) {
        try {
          const enriched = await enrichWithData(item, {
            brandName,
            industry,
          })
          if (enriched) {
            await prisma.knowledgeObject.update({
              where: { id: item.id },
              data: {
                metadata: {
                  content: enriched.content,
                  source: 'rewrite_engine',
                  method: 'llm_enrich',
                  reason: '添加可量化数据',
                  originalContent: item.content,
                },
                qualityScore: 0.75,
              },
            })
            details.push({
              action: 'update',
              topic: item.topic,
              content: enriched.content,
              reason: '添加具体数据和量化指标',
              knowledgeId: item.id,
            })
            itemsUpdated++
          }
        } catch {
          // skip
        }
      }
    }
  }

  // 3. 处理定位模糊 → 强化差异化
  const weakPositioningRecs = diagnosis.recommendations.filter(r => r.action === 'enrich_content')
  for (const rec of weakPositioningRecs.slice(0, 2)) {
    try {
      const enriched = await enrichPositioning(rec, {
        brandName,
        industry,
        description,
        existingTopics,
      })
      if (enriched) {
        await prisma.knowledgeObject.create({
          data: {
            projectId,
            topic: enriched.topic,
            status: 'GENERATED',
            confidence: 0.75,
            qualityScore: 0.7,
            metadata: {
              source: 'rewrite_engine',
              method: 'llm_positioning',
              content: enriched.content,
              reason: `强化品牌差异化: ${rec.detail}`,
              relatedQuestions: rec.relatedQuestions,
            },
          },
        })
        details.push({
          action: 'create',
          topic: enriched.topic,
          content: enriched.content,
          reason: `强化品牌差异化定位`,
        })
        itemsCreated++
      }
    } catch {
      // skip
    }
  }

  return {
    success: itemsCreated > 0 || itemsUpdated > 0,
    itemsCreated,
    itemsUpdated,
    details,
  }
}

// ── LLM: Generate Knowledge for Gap ──

async function generateKnowledgeForGap(
  gap: KnowledgeGap,
  brand: { brandName: string; industry: string; website: string; description: string; existingTopics: string[] }
): Promise<{ topic: string; content: string } | null> {
  const config = getLLMConfig()
  if (!config) return null

  try {
    const resp = await genericLLM.chat({
      messages: [
        {
          role: 'system',
          content: `你是品牌知识内容创作专家。根据品牌信息和知识缺口，生成一段高质量的品牌知识内容。

要求：
1. 内容长度 80-150 字
2. 包含至少 1 个具体数据或量化指标（如年份、数量、百分比、排名等）
3. 突出品牌独特性和差异化优势
4. 语言专业、可信，适合 AI 引擎引用
5. 不要使用"最好""第一"等绝对化用语

返回 JSON 格式：{ "topic": "知识主题", "content": "知识内容" }
只返回 JSON，不要其他内容。`,
        },
        {
          role: 'user',
          content: `品牌名：${brand.brandName}
行业：${brand.industry}
官网：${brand.website}
品牌描述：${brand.description}
已有知识主题：${brand.existingTopics.join('、') || '无'}

知识缺口：${gap.description}
关联问题：${gap.relatedQuestions.join('\n')}

请生成一条全新的知识内容来填补这个缺口。`,
        },
      ],
      provider: config.provider,
      apiKey: config.apiKey,
      baseUrl: config.baseUrl,
      model: config.model,
    })

    const jsonMatch = resp.text.match(/\{[\s\S]*\}/)
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0])
      if (parsed.topic && parsed.content && parsed.content.length >= 50) {
        return { topic: parsed.topic, content: parsed.content }
      }
    }
  } catch {
    // LLM failed
  }

  return null
}

// ── LLM: Rewrite Short Content ──

async function rewriteShortContent(
  item: { id: string; topic: string; content: string },
  brand: { brandName: string; industry: string; description: string }
): Promise<{ content: string } | null> {
  const config = getLLMConfig()
  if (!config) return null

  try {
    const resp = await genericLLM.chat({
      messages: [
        {
          role: 'system',
          content: `你是品牌内容扩充专家。将简短的品牌知识扩充为完整、专业的描述。

要求：
1. 扩充至 80-150 字
2. 保留原有核心信息
3. 添加品牌差异化描述和具体细节
4. 语言专业、可信

返回 JSON 格式：{ "content": "扩充后的内容" }
只返回 JSON，不要其他内容。`,
        },
        {
          role: 'user',
          content: `品牌：${brand.brandName}
行业：${brand.industry}
品牌描述：${brand.description}

知识主题：${item.topic}
当前内容（过短）：${item.content}

请将这条知识扩充为完整的描述。`,
        },
      ],
      provider: config.provider,
      apiKey: config.apiKey,
      baseUrl: config.baseUrl,
      model: config.model,
    })

    const jsonMatch = resp.text.match(/\{[\s\S]*\}/)
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0])
      if (parsed.content && parsed.content.length >= 50) {
        return { content: parsed.content }
      }
    }
  } catch {
    // LLM failed
  }

  return null
}

// ── LLM: Enrich with Data ──

async function enrichWithData(
  item: { id: string; topic: string; content: string },
  brand: { brandName: string; industry: string }
): Promise<{ content: string } | null> {
  const config = getLLMConfig()
  if (!config) return null

  try {
    const resp = await genericLLM.chat({
      messages: [
        {
          role: 'system',
          content: `你是品牌数据丰富专家。为品牌知识内容添加具体数据和量化指标。

要求：
1. 在现有内容基础上添加至少 2 个具体数据点
2. 数据可以是：年份、数量、百分比、排名、评分、价格区间等
3. 保持内容自然流畅，不是堆砌数字
4. 总长度 80-150 字

返回 JSON 格式：{ "content": "丰富后的内容" }
只返回 JSON，不要其他内容。`,
        },
        {
          role: 'user',
          content: `品牌：${brand.brandName}
行业：${brand.industry}

知识主题：${item.topic}
当前内容（缺少数据）：${item.content}

请为这段内容添加具体数据和量化指标。`,
        },
      ],
      provider: config.provider,
      apiKey: config.apiKey,
      baseUrl: config.baseUrl,
      model: config.model,
    })

    const jsonMatch = resp.text.match(/\{[\s\S]*\}/)
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0])
      if (parsed.content && parsed.content.length >= 50) {
        return { content: parsed.content }
      }
    }
  } catch {
    // LLM failed
  }

  return null
}

// ── LLM: Enrich Positioning ──

async function enrichPositioning(
  rec: { targetTopic: string; detail: string; relatedQuestions: string[] },
  brand: { brandName: string; industry: string; description: string; existingTopics: string[] }
): Promise<{ topic: string; content: string } | null> {
  const config = getLLMConfig()
  if (!config) return null

  try {
    const resp = await genericLLM.chat({
      messages: [
        {
          role: 'system',
          content: `你是品牌定位专家。根据品牌信息，生成一段突出品牌差异化的知识内容。

要求：
1. 内容长度 80-150 字
2. 突出品牌独特卖点（USP）和差异化优势
3. 包含至少 1 个具体数据支撑
4. 语言有说服力，适合 AI 引擎引用
5. 避免空泛的形容词，用事实说话

返回 JSON 格式：{ "topic": "知识主题", "content": "知识内容" }
只返回 JSON，不要其他内容。`,
        },
        {
          role: 'user',
          content: `品牌：${brand.brandName}
行业：${brand.industry}
品牌描述：${brand.description}
已有知识主题：${brand.existingTopics.join('、') || '无'}

定位问题：${rec.detail}
关联问题：${rec.relatedQuestions.join('\n')}

请生成一条突出品牌差异化定位的知识内容。`,
        },
      ],
      provider: config.provider,
      apiKey: config.apiKey,
      baseUrl: config.baseUrl,
      model: config.model,
    })

    const jsonMatch = resp.text.match(/\{[\s\S]*\}/)
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0])
      if (parsed.topic && parsed.content && parsed.content.length >= 50) {
        return { topic: parsed.topic, content: parsed.content }
      }
    }
  } catch {
    // LLM failed
  }

  return null
}
