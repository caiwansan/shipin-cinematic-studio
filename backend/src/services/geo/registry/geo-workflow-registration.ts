// ============================================================
// GEO Workflow Registration — Sprint 1B
// ============================================================
// Registers all GEO workflows at startup.
// ============================================================

import { WorkflowBuilder, workflowDispatcher } from './geo-workflow'
import { claimAgent } from '../agents/claim.agent'
import { evidenceAgent } from '../agents/evidence.agent'
import { citationAgent } from '../agents/citation.agent'
import { faqAgent } from '../agents/faq.agent'
import { schemaAgent } from '../agents/schema.agent'

export function registerGEOWorkflows(): void {
  // ─── Knowledge Quality Pipeline ───
  // DAG:
  //   claim
  //   ├── evidence → citation
  //   └── faq → schema
  //
  // Parallel execution layers:
  //   L1: claim
  //   L2: evidence, faq         (parallel)
  //   L3: citation, schema      (parallel)
  //   L4: (quality, freshness)  — future

  const kqWorkflow = new WorkflowBuilder()
    .setVersion('1.0.0')
    .add(
      'claim',
      claimAgent,
      (ctx) => ({
        entities: ctx.inputs.entities as any[] || [],
        relations: ctx.inputs.relations as any[] || [],
        config: ctx.inputs.config || {},
      }),
      [],
      { retry: 1, timeout: 30000 },
    )
    .add(
      'evidence',
      evidenceAgent,
      (ctx) => {
        const claims = ctx.outputs.get('claim')?.data || []
        return { claims, config: { maxSourcesPerClaim: 3, minCredibilityScore: 0.3 } }
      },
      ['claim'],
      { retry: 1, timeout: 30000, continueOnFailure: true },
    )
    .add(
      'citation',
      citationAgent,
      (ctx) => {
        const evidence = ctx.outputs.get('evidence')?.data || []
        return { evidence, format: 'custom' }
      },
      ['evidence'],
      { retry: 0, timeout: 20000, continueOnFailure: true },
    )
    .add(
      'faq',
      faqAgent,
      (ctx) => {
        const entities = ctx.inputs.entities as any[]
        const claims = ctx.outputs.get('claim')?.data || []
        return { entities: entities || [], claims, config: { maxFAQPerEntity: 3 } }
      },
      ['claim'],
      { retry: 1, timeout: 30000, continueOnFailure: true },
    )
    .add(
      'schema',
      schemaAgent,
      (ctx) => {
        const entities = ctx.inputs.entities as any[]
        const faqs = ctx.outputs.get('faq')?.data || []
        return { entities: entities || [], faqs, config: { schemaTypes: ['Article', 'FAQPage'] } }
      },
      ['faq'],
      { retry: 1, timeout: 30000, continueOnFailure: true },
    )
    .build('geo.knowledge-quality', 'Knowledge Quality Pipeline')

  workflowDispatcher.register(kqWorkflow)
}
