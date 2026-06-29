// ============================================================
// GEO FAQ Agent — Sprint 1B Knowledge Quality
// ============================================================
// P0: ✅ No inline prompts
// P0: ✅ Stateless | No DB | No direct LLM | Envelope with status+trace
// ============================================================

import type { AgentContext, AgentOutput, FAQ, Claim } from '../types'
import { createAgentOutput, createProvenanceRecord, createLineageRecord } from '../types'

export interface FAQAgentInput {
  entities: Array<{ id: string; name: string; type: string; description?: string }>
  claims: Partial<Claim>[]
  config?: {
    maxFAQPerEntity?: number
    schemaType?: string
  }
}

export async function faqAgent(
  input: FAQAgentInput,
  ctx: AgentContext
): Promise<AgentOutput<Partial<FAQ>>> {
  const startedAt = Date.now()
  const stepStart = new Date().toISOString()
  const maxPerEntity = input.config?.maxFAQPerEntity ?? 3
  const schemaType = input.config?.schemaType || 'FAQPage'
  const model = ctx.config.model || 'default'
  const provider = ctx.config.provider || 'default'

  const prompt = ctx.registry.getPrompt('geo.faq.generate', {
    entities: JSON.stringify(input.entities, null, 2),
    claims: JSON.stringify(input.claims.map((c) => ({ entityId: c.entityId, text: c.text, claimType: c.claimType })), null, 2),
    maxPerEntity: String(maxPerEntity),
  })

  let result: { content: string; tokens: number; latency: number; cost: number }
  try {
    result = await ctx.capabilities.llm.generate(prompt, { model, temperature: 0.4, maxTokens: 4096 })
  } catch (err: any) {
    const finishedAt = Date.now()
    return createAgentOutput({
      objectType: 'faq', data: [], status: 'FAILED', confidence: 0, error: err.message,
      diagnostics: { warnings: ['LLM call failed'], validationErrors: [], fallbackUsed: true, reason: err.message },
      trace: { executionId: ctx.executionId, workflowNodeId: ctx.workflowNodeId, parentNodeId: ctx.parentNodeId, agent: 'faqAgent', startedAt: stepStart, finishedAt: new Date().toISOString(), duration: finishedAt - startedAt },
      executionMetrics: { latency: finishedAt - startedAt, tokens: 0, cost: 0, retryCount: 0 },
    })
  }

  const latency = Date.now() - startedAt
  const warnings: string[] = []

  let rawFAQs: Array<{ entityName: string; question: string; answer: string; confidence: number; schemaType: string }> = []
  try {
    rawFAQs = JSON.parse(result.content)
  } catch {
    warnings.push('LLM output was not valid JSON')
  }

  const faqs: Partial<FAQ>[] = rawFAQs.map((rf) => {
    const entity = input.entities.find((e) => e.name === rf.entityName)
    return {
      entityId: entity?.id || '',
      question: rf.question,
      answer: rf.answer,
      schemaType: rf.schemaType || schemaType,
      confidence: Math.min(Math.max(rf.confidence || 0.5, 0), 1),
      status: 'draft',
    }
  })

  const avgConfidence = faqs.length > 0
    ? faqs.reduce((s, f) => s + (f.confidence || 0), 0) / faqs.length
    : 0

  const status = faqs.length === 0 ? 'PARTIAL_SUCCESS' : 'SUCCESS'

  return createAgentOutput({
    objectType: 'faq', data: faqs, status, confidence: avgConfidence,
    provenance: createProvenanceRecord({
      source: 'agent:geo.faq', action: 'created', actor: `execution:${ctx.executionId}`,
      reason: `FAQ generation for ${input.entities.length} entities`,
    }),
    lineage: input.entities.map((e) => createLineageRecord(e.name, 'faq', 'entity_has_faq')),
    diagnostics: { warnings, validationErrors: [], fallbackUsed: faqs.length === 0 },
    trace: { executionId: ctx.executionId, workflowNodeId: ctx.workflowNodeId, parentNodeId: ctx.parentNodeId, agent: 'faqAgent', startedAt: stepStart, finishedAt: new Date().toISOString(), duration: Date.now() - startedAt },
    runtimeMetadata: { agentVersion: '1.0.0', model, provider, executionId: ctx.executionId, workflowNodeId: ctx.workflowNodeId },
    executionMetrics: { latency, tokens: result.tokens, cost: result.cost || 0, retryCount: 0 },
  })
}
