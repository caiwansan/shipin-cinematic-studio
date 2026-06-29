// ============================================================
// GEO Module — Knowledge Skeleton (Sprint 1A + Sprint 1B)
// ============================================================

export * from './types'
export * from './registry/geo-registry'
export * from './services/geo-project.service'
export * from './services/geo-entity.service'
export * from './services/geo-graph.service'
export * from './agents/research.agent'
export * from './agents/entity.agent'
export * from './agents/knowledge-graph.agent'

// Sprint 1B — Knowledge Quality Repositories
export * from './repositories/geo-claim.repository'
export * from './repositories/geo-evidence.repository'
export * from './repositories/geo-citation.repository'
export * from './repositories/geo-faq.repository'
export * from './repositories/geo-schema.repository'
export * from './repositories/geo-review.repository'
export * from './repositories/geo-quality.repository'
export * from './repositories/geo-freshness.repository'

// Sprint 1B — Knowledge Quality Services
export * from './services/geo-claim.service'
export * from './services/geo-evidence.service'
export * from './services/geo-citation.service'
export * from './services/geo-faq.service'
export * from './services/geo-schema.service'
export * from './services/geo-review.service'
export * from './services/geo-quality.service'
export * from './services/geo-freshness.service'

// Sprint 1B — Knowledge Quality Agents
export * from './agents/claim.agent'
export * from './agents/evidence.agent'
export * from './agents/citation.agent'
export * from './agents/faq.agent'
export * from './agents/schema.agent'

// Sprint 1B — Registry
export * from './registry/geo-prompt-registry'
export * from './registry/geo-workflow'
export * from './registry/geo-workflow-registration'

// Runtime — Prompt Registry
import { promptRegistry } from './runtime/prompt/PromptRegistry'

// Register default prompts on first import
promptRegistry.register({
  key: 'entity.v1',
  version: '1.0.0',
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

// Sprint 1B — Routes
export { default as geoKnowledgeQualityRoute } from './routes/geo-knowledge-quality.route'

// Sprint P1 — Brand GEO Routes
export { default as geoBrandRoute } from './routes/geo-brand.route'
export { default as geoKeywordRoute } from './routes/geo-keyword.route'
export { default as geoScanRoute } from './routes/geo-scan.route'
export { default as geoDashboardRoute } from './routes/geo-dashboard.route'
