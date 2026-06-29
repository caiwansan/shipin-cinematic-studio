// ============================================================
// GEO Citation Agent — Sprint 1B Knowledge Quality
// ============================================================
// P0: ✅ No inline prompts
// P0: ✅ Stateless | No DB | No direct LLM | Envelope with status+trace
// ============================================================

import type { AgentContext, AgentOutput, Citation, Evidence } from '../types'
import { createAgentOutput, createProvenanceRecord, createLineageRecord } from '../types'

export interface CitationAgentInput {
  evidence: Partial<Evidence>[]
  format?: string
}

export async function citationAgent(
  input: CitationAgentInput,
  ctx: AgentContext
): Promise<AgentOutput<Partial<Citation>>> {
  const startedAt = Date.now()
  const stepStart = new Date().toISOString()
  const format = input.format || 'custom'
  const model = ctx.config.model || 'default'
  const provider = ctx.config.provider || 'default'

  const prompt = ctx.registry.getPrompt('geo.citation.format', {
    evidence: JSON.stringify(
      input.evidence.map((e) => ({ content: e.content, source: e.source, credibilityScore: e.credibilityScore, verificationMethod: e.verificationMethod })),
      null, 2
    ),
    format,
  })

  let result: { content: string; tokens: number; latency: number; cost: number }
  try {
    result = await ctx.capabilities.llm.generate(prompt, { model, temperature: 0.2, maxTokens: 4096 })
  } catch (err: any) {
    const finishedAt = Date.now()
    return createAgentOutput({
      objectType: 'citation', data: [], status: 'FAILED', confidence: 0, error: err.message,
      diagnostics: { warnings: ['LLM call failed'], validationErrors: [], fallbackUsed: true, reason: err.message },
      trace: { executionId: ctx.executionId, workflowNodeId: ctx.workflowNodeId, parentNodeId: ctx.parentNodeId, agent: 'citationAgent', startedAt: stepStart, finishedAt: new Date().toISOString(), duration: finishedAt - startedAt },
      executionMetrics: { latency: finishedAt - startedAt, tokens: 0, cost: 0, retryCount: 0 },
    })
  }

  const latency = Date.now() - startedAt
  const warnings: string[] = []

  let rawCitations: Array<{ evidenceIndex: number; citationText: string; sourceUrl?: string; publisher?: string; author?: string; datePublished?: string; authorityLevel: string }> = []
  try {
    rawCitations = JSON.parse(result.content)
  } catch {
    warnings.push('LLM output was not valid JSON')
  }

  const citations: Partial<Citation>[] = rawCitations.map((rc) => {
    const evidence = input.evidence[rc.evidenceIndex]
    return {
      evidenceId: evidence?.id || '',
      format,
      citationText: rc.citationText || '',
      sourceUrl: rc.sourceUrl,
      publisher: rc.publisher,
      author: rc.author,
      datePublished: rc.datePublished,
      authorityLevel: rc.authorityLevel || 'news',
    }
  })

  const status = citations.length === 0 ? 'PARTIAL_SUCCESS' : 'SUCCESS'

  return createAgentOutput({
    objectType: 'citation', data: citations, status, confidence: citations.length > 0 ? 0.85 : 0,
    provenance: createProvenanceRecord({
      source: 'agent:geo.citation', action: 'created', actor: `execution:${ctx.executionId}`,
      reason: `Citation formatting for ${input.evidence.length} evidence items in ${format} format`,
    }),
    lineage: input.evidence.map((e, i) => createLineageRecord(`evidence:${e.id || i}`, 'citation', 'evidence_has_citation')),
    diagnostics: { warnings, validationErrors: [], fallbackUsed: citations.length === 0 },
    trace: { executionId: ctx.executionId, workflowNodeId: ctx.workflowNodeId, parentNodeId: ctx.parentNodeId, agent: 'citationAgent', startedAt: stepStart, finishedAt: new Date().toISOString(), duration: Date.now() - startedAt },
    runtimeMetadata: { agentVersion: '1.0.0', model, provider, executionId: ctx.executionId, workflowNodeId: ctx.workflowNodeId },
    executionMetrics: { latency, tokens: result.tokens, cost: result.cost || 0, retryCount: 0 },
  })
}
