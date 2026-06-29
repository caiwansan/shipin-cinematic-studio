// ============================================================
// Entity Agent — Entity Discovery (KMKI-GEO-AGENT-002) v4
// 通过 StructuredGeneration Runtime 执行
// 不包含：Inline prompt / parser / retry / usage recording
// 仅负责：收集输入 → 调用 Runtime → 持久化
// ============================================================

import { agentService } from '../../platform/agent/agent.service'
import type { AgentDefinition } from '../../platform/agent/types'
import { EntityType, createProvenanceRecord, createLineageRecord } from '../types'
import type { EntityDiscoveryInput, EntityDiscoveryOutput, ResearchOutput } from '../types'
import { structuredGenerate } from '../runtime/generation/StructuredGeneration'
import { createEntityArraySchema } from '../runtime/generation/SchemaValidator'
import { getUserIdFromProject } from '../utils/user-utils'
import { promptRegistry } from '../runtime/prompt/PromptRegistry'

export const ENTITY_AGENT_CODE = 'geo.entity'
export const ENTITY_AGENT_CAPABILITIES = ['geo.entity.discovery', 'knowledge.extraction']
const PROMPT_KEY = 'entity.v1'
const PROMPT_VERSION = '1.0.0'

async function entityExecutor(input: EntityDiscoveryInput, ctx?: any): Promise<EntityDiscoveryOutput> {
  const research = input.research || ({} as ResearchOutput)
  const config = input.config || {}
  const topic = research.primaryTopic || ''
  const keywords = research.keywords || []
  const maxEntities = config.maxEntities || 12
  const userId = await resolveUserId(ctx, config, research)

  console.log(`[EntityAgent] Running via StructuredGeneration (prompt=${PROMPT_KEY}@${PROMPT_VERSION}) topic="${topic}"`)

  const result = await structuredGenerate<{
    entities: Array<{ name: string; type: string; description: string; sortOrder?: number }>
    relations: Array<{ sourceName: string; targetName: string; type: string; description?: string }>
  }>({
    promptKey: PROMPT_KEY,
    promptVersion: PROMPT_VERSION,
    schema: createEntityArraySchema(),
    agent: ENTITY_AGENT_CODE,
    variables: {
      maxEntities: String(maxEntities),
      topic,
      keywords: keywords.join(', '),
      industry: research.industry || '未指定',
    },
    options: { userId: userId || undefined, projectId: ctx?.projectId },
  })

  if (!result.success || !result.data) {
    console.error(`[EntityAgent] StructuredGeneration failed: error="${result.error}" stage="${result.parserStage}" provider=${result.provider}/${result.model}`)
    return { success: false, output: { entities: [], relations: [] }, error: result.error }
  }
  if (!result.data.entities) {
    console.error(`[EntityAgent] StructuredGeneration returned no entities field. Data:`, JSON.stringify(result.data).slice(0, 300))
    return { success: false, output: { entities: [], relations: [] }, error: 'LLM output missing entities field' }
  }

  const rawEntities = (result.data.entities || []).slice(0, maxEntities)
  const rawRelations = (result.data.relations || [])

  // Normalize entities
  const entities = rawEntities.map((e, i) => ({
    name: e.name,
    type: Object.values(EntityType).includes(e.type as EntityType) ? (e.type as EntityType) : EntityType.Concept,
    description: e.description || `Entity related to ${topic}`,
    sortOrder: e.sortOrder ?? i,
  }))

  // Validate & normalize relations
  const entityNames = new Set(entities.map((e) => e.name))
  const relations = rawRelations
    .filter((r) => entityNames.has(r.sourceName) && entityNames.has(r.targetName))
    .map((r) => ({
      sourceId: r.sourceName,
      targetId: r.targetName,
      type: r.type || 'related_to',
      lineage: createLineageRecord(r.sourceName, r.targetName, r.type || 'related_to'),
      metadata: { description: r.description || '' },
    }))

  // Provenance
  const provenance = createProvenanceRecord({
    source: 'geo.entity.llm',
    action: 'created',
    actor: `agent:geo.entity@${result.provider}`,
    reason: `LLM-based entity discovery for topic: ${topic}`,
  })

  const entitiesWithProvenance = entities.map((e) => ({
    ...e,
    provenance: { ...provenance, reason: `Entity "${e.name}" discovered via ${result.provider}/${result.model}` },
  }))

  console.log(`[EntityAgent] Discovered ${entitiesWithProvenance.length} entities, ${relations.length} relations via ${result.provider}/${result.model}`)

  return { success: true, output: { entities: entitiesWithProvenance, relations } }
}

async function resolveUserId(ctx: any, config: any, _research: any): Promise<string | null> {
  if (ctx?.projectId) {
    return getUserIdFromProject(ctx.projectId)
  }
  return ctx?.userId || config.userId || null
}

let registered = false

/** Register entity.v1 prompt in the registry */
function ensurePromptRegistered(): void {
  if (promptRegistry.get(PROMPT_KEY)) return
  promptRegistry.register({
    key: PROMPT_KEY,
    version: PROMPT_VERSION,
    system: `你是一个专业的知识图谱实体发现助手。请根据提供的主题/URL，分析并提取相关的实体和实体间关系。

返回严格 JSON 格式：
{
  "entities": [
    {
      "name": "实体名称",
      "type": "Person|Organization|Concept|Product|Location|Event|Technology|Field|Brand",
      "description": "实体描述（50-200字，详细说明实体的含义和背景）",
      "sortOrder": 0
    }
  ],
  "relations": [
    {
      "sourceName": "源实体名称（必须与 entities 中的 name 匹配）",
      "targetName": "目标实体名称（必须与 entities 中的 name 匹配）",
      "type": "related_to|subfield_of|part_of|produced_by|located_in|competes_with|collaborates_with|used_by|owns|parent_of",
      "description": "关系描述"
    }
  ]
}

注意：
- 实体数量控制在 {maxEntities} 个以内
- 优先提取品牌、组织、产品、核心技术、主要人物、关键概念
- 如果是 URL，根据 URL 推断所属网站的品牌/公司/产品
- relation 中的 sourceName/targetName 必须与 entities 的 name 完全一致
- 描述必须是中文，详细且有实际信息`,
    user: `主题: {topic}
关键词: {keywords}
行业: {industry}`,
    metadata: {
      description: 'Extract entities and relations from a topic/URL',
      capabilities: 'chat, structured_json',
      author: 'geobot',
      updatedAt: '2026-06-29',
    },
  })
  console.log(`[EntityAgent] Registered prompt: ${PROMPT_KEY}@${PROMPT_VERSION}`)
}

export async function registerEntityAgent(): Promise<void> {
  if (registered) return
  ensurePromptRegistered()
  const def: Omit<AgentDefinition, 'id' | 'createdAt' | 'updatedAt'> = {
    code: ENTITY_AGENT_CODE,
    name: 'Entity Discovery Agent',
    version: '4.0.0',
    description: 'Entity discovery via StructuredGeneration Runtime.',
    capabilities: ENTITY_AGENT_CAPABILITIES,
    supportedResources: ['llm'],
    executionMode: 'sync',
    category: 'official',
    status: 'active',
    schemaVersion: 1,
  }
  try {
    await agentService.register(def, entityExecutor)
    console.log('[EntityAgent] Registered v4.0.0 — StructuredGeneration Runtime')
    registered = true
  } catch (err) {
    console.error('[EntityAgent] Registration failed:', err)
    throw err
  }
}

export async function executeEntityDiscovery(input: EntityDiscoveryInput): Promise<EntityDiscoveryOutput> {
  const dispatchResult = await agentService.dispatch({
    agentCode: ENTITY_AGENT_CODE,
    input: input as unknown as Record<string, unknown>,
  })
  if (dispatchResult.status === 'failed') {
    console.error(`[executeEntityDiscovery] Dispatch failed: ${dispatchResult.error}`)
    return { entities: [], relations: [] }
  }
  const agentResult = dispatchResult.result
  if (!agentResult) {
    console.warn(`[executeEntityDiscovery] No agent result, status=${dispatchResult.status}`)
    return { entities: [], relations: [] }
  }
  const output = agentResult.output
  return {
    entities: (output?.entities as EntityDiscoveryOutput['entities']) || [],
    relations: (output?.relations as EntityDiscoveryOutput['relations']) || [],
  }
}

export { entityExecutor }
