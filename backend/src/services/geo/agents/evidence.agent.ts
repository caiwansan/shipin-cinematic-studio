// ============================================================
// GEO Evidence Agent — Sprint 1B Knowledge Quality
// ============================================================
// P0: ✅ No inline prompts
// P0: ✅ Stateless
// P0: ✅ No DB access
// P0: ✅ No direct LLM call
// P0: ✅ AgentOutput with status + diagnostics + trace
// ============================================================

import type { AgentContext, AgentOutput, Evidence, Claim } from '../types'
import { createAgentOutput, createProvenanceRecord, createLineageRecord } from '../types'

export interface EvidenceAgentInput {
  claims: Partial<Claim>[]
  config?: {
    maxSourcesPerClaim?: number
    minCredibilityScore?: number
  }
}

export async function evidenceAgent(
  input: EvidenceAgentInput,
  ctx: AgentContext
): Promise<AgentOutput<Partial<Evidence>>> {
  const startedAt = Date.now()
  const stepStart = new Date().toISOString()
  const maxSources = input.config?.maxSourcesPerClaim ?? 3
  const minCredibility = input.config?.minCredibilityScore ?? 0.3

  // P0: Prompt resolved from registry
  const prompt = ctx.registry.getPrompt('geo.evidence.gather', {
    claims: JSON.stringify(
      input.claims.map((c) => ({ text: c.text, entityId: c.entityId, confidence: c.confidence, type: c.claimType })),
      null, 2
    ),
    maxPerClaim: String(maxSources),
    minCredibility: String(minCredibility),
  })

  const model = ctx.config.model || 'default'
  const provider = ctx.config.provider || 'default'

  let result: { content: string; tokens: number; latency: number; cost: number }
  try {
    result = await ctx.capabilities.llm.generate(prompt, {
      model, temperature: 0.3, maxTokens: 4096,
    })
  } catch (err: any) {
    const finishedAt = Date.now()
    return createAgentOutput({
      objectType: 'evidence', data: [], status: 'FAILED', confidence: 0, error: err.message,
      diagnostics: { warnings: ['LLM call failed'], validationErrors: [], fallbackUsed: true, reason: err.message },
      trace: { executionId: ctx.executionId, workflowNodeId: ctx.workflowNodeId, parentNodeId: ctx.parentNodeId, agent: 'evidenceAgent', startedAt: stepStart, finishedAt: new Date().toISOString(), duration: finishedAt - startedAt },
      executionMetrics: { latency: finishedAt - startedAt, tokens: 0, cost: 0, retryCount: 0 },
    })
  }

  const latency = Date.now() - startedAt
  const warnings: string[] = []

  let rawEvidence: Array<{ claimIndex: number; source: string; content: string; credibilityScore: number; verificationMethod: string }> = []
  try {
    rawEvidence = JSON.parse(result.content)
  } catch {
    warnings.push('LLM output was not valid JSON')
  }

  const filtered = rawEvidence.filter((e) => e.credibilityScore >= minCredibility)
  if (filtered.length < rawEvidence.length) {
    warnings.push(`${rawEvidence.length - filtered.length} evidence items filtered by credibility threshold ${minCredibility}`)
  }

  const evidence: Partial<Evidence>[] = filtered.map((re) => {
    const claim = input.claims[re.claimIndex]
    return {
      claimId: claim?.id || '',
      source: re.source,
      content: re.content,
      credibilityScore: Math.min(Math.max(re.credibilityScore, 0), 1),
      verificationMethod: re.verificationMethod || 'llm',
      collectedAt: new Date().toISOString(),
    }
  })

  const avgCredibility = evidence.length > 0
    ? evidence.reduce((s, e) => s + (e.credibilityScore || 0), 0) / evidence.length
    : 0

  const status = evidence.length === 0 ? (rawEvidence.length === 0 ? 'PARTIAL_SUCCESS' : 'FAILED') : 'SUCCESS'

  return createAgentOutput({
    objectType: 'evidence',
    data: evidence,
    status,
    confidence: avgCredibility,
    provenance: createProvenanceRecord({
      source: 'agent:geo.evidence', action: 'created',
      actor: `execution:${ctx.executionId}`,
      reason: `Evidence gathering for ${input.claims.length} claims`,
    }),
    lineage: input.claims.map((c, i) => createLineageRecord(`claim:${c.id || i}`, 'evidence', 'claim_has_evidence')),
    diagnostics: { warnings, validationErrors: [], fallbackUsed: evidence.length === 0 },
    trace: { executionId: ctx.executionId, workflowNodeId: ctx.workflowNodeId, parentNodeId: ctx.parentNodeId, agent: 'evidenceAgent', startedAt: stepStart, finishedAt: new Date().toISOString(), duration: Date.now() - startedAt },
    runtimeMetadata: { agentVersion: '1.0.0', model, provider, executionId: ctx.executionId, workflowNodeId: ctx.workflowNodeId },
    executionMetrics: { latency, tokens: result.tokens, cost: result.cost || 0, retryCount: 0 },
  })
}
