// ============================================================
// GEO Schema Agent — Sprint 1B Knowledge Quality
// ============================================================
// P0: ✅ No inline prompts
// P0: ✅ Stateless | No DB | No direct LLM | Envelope with status+trace
// ============================================================

import type { AgentContext, AgentOutput, SchemaMarkup } from '../types'
import { createAgentOutput, createProvenanceRecord, createLineageRecord } from '../types'

export interface SchemaAgentInput {
  entities: Array<{ id: string; name: string; type: string; description?: string }>
  faqs: Array<{ entityId: string; question: string; answer: string; schemaType: string }>
  config?: {
    schemaTypes?: string[]
    includeClaims?: boolean
  }
}

export async function schemaAgent(
  input: SchemaAgentInput,
  ctx: AgentContext
): Promise<AgentOutput<Partial<SchemaMarkup>>> {
  const startedAt = Date.now()
  const stepStart = new Date().toISOString()
  const schemaTypes = input.config?.schemaTypes || ['Article']
  const model = ctx.config.model || 'default'
  const provider = ctx.config.provider || 'default'

  const prompt = ctx.registry.getPrompt('geo.schema.generate', {
    entities: JSON.stringify(input.entities, null, 2),
    faqs: JSON.stringify(input.faqs, null, 2),
    schemaTypes: JSON.stringify(schemaTypes),
  })

  let result: { content: string; tokens: number; latency: number; cost: number }
  try {
    result = await ctx.capabilities.llm.generate(prompt, { model, temperature: 0.2, maxTokens: 4096 })
  } catch (err: any) {
    const finishedAt = Date.now()
    return createAgentOutput({
      objectType: 'schema', data: [], status: 'FAILED', confidence: 0, error: err.message,
      diagnostics: { warnings: ['LLM call failed'], validationErrors: [], fallbackUsed: true, reason: err.message },
      trace: { executionId: ctx.executionId, workflowNodeId: ctx.workflowNodeId, parentNodeId: ctx.parentNodeId, agent: 'schemaAgent', startedAt: stepStart, finishedAt: new Date().toISOString(), duration: finishedAt - startedAt },
      executionMetrics: { latency: finishedAt - startedAt, tokens: 0, cost: 0, retryCount: 0 },
    })
  }

  const latency = Date.now() - startedAt
  const warnings: string[] = []
  const validationErrors: string[] = []

  let rawSchemas: Array<{ entityName: string; schemaType: string; markup: Record<string, unknown> }> = []
  try {
    rawSchemas = JSON.parse(result.content)
  } catch {
    warnings.push('LLM output was not valid JSON')
  }

  const schemas: Partial<SchemaMarkup>[] = rawSchemas.map((rs) => {
    const entity = input.entities.find((e) => e.name === rs.entityName)
    return {
      entityId: entity?.id || '',
      schemaType: rs.schemaType || 'Article',
      markup: rs.markup || {},
      validationStatus: 'pending',
      validationErrors: [],
    }
  })

  // Run basic validation on each markup
  let invalidCount = 0
  for (const schema of schemas) {
    const mk = schema.markup as Record<string, unknown>
    const errs: string[] = []
    if (!mk['@context']) errs.push('Missing @context')
    if (!mk['@type']) errs.push('Missing @type')
    if (errs.length > 0) {
      schema.validationStatus = 'invalid'
      schema.validationErrors = errs
      invalidCount++
      validationErrors.push(`Entity ${schema.entityId}: ${errs.join(', ')}`)
    } else {
      schema.validationStatus = 'valid'
      schema.validationErrors = []
    }
  }

  if (invalidCount > 0) {
    warnings.push(`${invalidCount}/${schemas.length} schemas failed basic validation`)
  }

  const status = schemas.length === 0 ? 'PARTIAL_SUCCESS' : (invalidCount === schemas.length ? 'FAILED' : 'SUCCESS')

  return createAgentOutput({
    objectType: 'schema', data: schemas, status,
    confidence: schemas.length > 0 ? schemas.filter((s) => s.validationStatus === 'valid').length / schemas.length : 0,
    provenance: createProvenanceRecord({
      source: 'agent:geo.schema', action: 'created', actor: `execution:${ctx.executionId}`,
      reason: `Schema markup generation for ${input.entities.length} entities`,
    }),
    lineage: input.entities.map((e) => createLineageRecord(e.name, 'schema_markup', 'entity_has_schema')),
    diagnostics: { warnings, validationErrors, fallbackUsed: schemas.length === 0 },
    trace: { executionId: ctx.executionId, workflowNodeId: ctx.workflowNodeId, parentNodeId: ctx.parentNodeId, agent: 'schemaAgent', startedAt: stepStart, finishedAt: new Date().toISOString(), duration: Date.now() - startedAt },
    runtimeMetadata: { agentVersion: '1.0.0', model, provider, executionId: ctx.executionId, workflowNodeId: ctx.workflowNodeId },
    executionMetrics: { latency, tokens: result.tokens, cost: result.cost || 0, retryCount: 0 },
  })
}
