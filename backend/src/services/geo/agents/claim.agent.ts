// ============================================================
// GEO Claim Agent — Sprint 1B Knowledge Quality
// ============================================================
// P0: ✅ No inline prompts — uses ctx.registry.getPrompt('geo.claim.extract')
// P0: ✅ Stateless — all input via AgentContext + input
// P0: ✅ No DB access — returns AgentOutput, no writes
// P0: ✅ No direct LLM call — uses ctx.capabilities.llm.generate()
// P0: ✅ AgentOutput has status + diagnostics + trace
// ============================================================

import type { AgentContext, AgentOutput, Claim } from '../types'
import { createAgentOutput, createProvenanceRecord, createLineageRecord } from '../types'

export interface ClaimAgentInput {
  entities: Array<{ id: string; name: string; type: string; description?: string }>
  relations: Array<{ sourceName: string; targetName: string; type: string }>
  config?: {
    maxClaimsPerEntity?: number
    minConfidence?: number
  }
}

export async function claimAgent(
  input: ClaimAgentInput,
  ctx: AgentContext
): Promise<AgentOutput<Partial<Claim>>> {
  const startedAt = Date.now()
  const stepStart = new Date().toISOString()
  const maxPerEntity = input.config?.maxClaimsPerEntity ?? 5
  const minConfidence = input.config?.minConfidence ?? 0.3

  // P0: Prompt resolved from registry, never inlined
  const prompt = ctx.registry.getPrompt('geo.claim.extract', {
    entities: JSON.stringify(input.entities, null, 2),
    relations: JSON.stringify(input.relations, null, 2),
    maxPerEntity: String(maxPerEntity),
    minConfidence: String(minConfidence),
  })

  const model = ctx.config.model || 'default'
  const provider = ctx.config.provider || 'default'

  let result: { content: string; tokens: number; latency: number; cost: number }
  try {
    result = await ctx.capabilities.llm.generate(prompt, {
      model,
      temperature: 0.3,
      maxTokens: 4096,
    })
  } catch (err: any) {
    const finishedAt = Date.now()
    return createAgentOutput({
      objectType: 'claim',
      data: [],
      status: 'FAILED',
      confidence: 0,
      error: err.message,
      diagnostics: { warnings: ['LLM call failed'], validationErrors: [], fallbackUsed: true, reason: err.message },
      trace: {
        executionId: ctx.executionId,
        workflowNodeId: ctx.workflowNodeId,
        parentNodeId: ctx.parentNodeId,
        agent: 'claimAgent',
        startedAt: stepStart,
        finishedAt: new Date().toISOString(),
        duration: finishedAt - startedAt,
      },
      executionMetrics: { latency: finishedAt - startedAt, tokens: 0, cost: 0, retryCount: 0 },
    })
  }

  const latency = Date.now() - startedAt
  let rawClaims: Array<{ text: string; claimType: string; confidence: number; entityName: string }> = []
  const warnings: string[] = []
  try {
    rawClaims = JSON.parse(result.content)
  } catch {
    warnings.push('LLM output was not valid JSON, treated as single claim')
    rawClaims = [{ text: result.content, claimType: 'fact', confidence: 0.5, entityName: input.entities[0]?.name || '' }]
  }

  const filtered = rawClaims.filter((c) => c.confidence >= minConfidence)
  if (filtered.length < rawClaims.length) {
    warnings.push(`${rawClaims.length - filtered.length} claims filtered by confidence threshold ${minConfidence}`)
  }

  const claims: Partial<Claim>[] = filtered.map((rc) => {
    const entity = input.entities.find((e) => e.name === rc.entityName)
    return {
      entityId: entity?.id || '',
      text: rc.text,
      claimType: rc.claimType || 'fact',
      confidence: Math.min(Math.max(rc.confidence, 0), 1),
      status: 'draft',
    }
  })

  const avgConfidence = claims.length > 0
    ? claims.reduce((s, c) => s + (c.confidence || 0), 0) / claims.length
    : 0

  const status = claims.length === 0 ? 'PARTIAL_SUCCESS' : 'SUCCESS'

  return createAgentOutput({
    objectType: 'claim',
    data: claims,
    status,
    confidence: avgConfidence,
    provenance: createProvenanceRecord({
      source: 'agent:geo.claim',
      action: 'created',
      actor: `execution:${ctx.executionId}`,
      reason: `Claim generation for ${input.entities.length} entities`,
    }),
    lineage: input.entities.map((e) =>
      createLineageRecord(e.name, 'claim', 'entity_has_claim')
    ),
    diagnostics: { warnings, validationErrors: [], fallbackUsed: rawClaims.length > 0 && warnings.length > 0 },
    trace: {
      executionId: ctx.executionId,
      workflowNodeId: ctx.workflowNodeId,
      parentNodeId: ctx.parentNodeId,
      agent: 'claimAgent',
      startedAt: stepStart,
      finishedAt: new Date().toISOString(),
      duration: Date.now() - startedAt,
    },
    runtimeMetadata: {
      agentVersion: '1.0.0', model, provider,
      executionId: ctx.executionId, workflowNodeId: ctx.workflowNodeId,
    },
    executionMetrics: { latency, tokens: result.tokens, cost: result.cost || 0, retryCount: 0 },
  })
}
