import type { ApiResponse } from '../contracts/api/base.js';
/**
 * routes/self-check.ts — Phase 5.1
 *
 * Self-Verification Kernel endpoint.
 * Runs: state reconstruction → verification → drift analysis
 * Exposes the kernel's self-assessment with zero side effects.
 *
 * GET /api/v1/kernel/self-check — Full self-verification of current state
 *
 * @phase4-owner { entry: "narrative-gateway", mode: "OBSERVE" }
 */

import { FastifyInstance } from 'fastify'
import { buildExecutionState, formatExecutionState } from '../runtime/kernel/state-reconstructor.js'
import { verify, formatVerificationReport } from '../runtime/kernel/verifier.js'
import { analyzeDrift, formatDriftReport } from '../runtime/kernel/drift-engine.js'

export default async function selfCheckRoutes(app: FastifyInstance) {
  app.get('/api/v1/kernel/self-check', async (_req, _reply) => {
    const state = buildExecutionState()
    const verification = verify(state)
    const drift = analyzeDrift(state)

    return {
      success: true,
      timestamp: new Date().toISOString(),
      state: {
        totalEvents: state.totalEvents,
        entryPoint: state.entryPoint?.module ?? null,
        lastHop: state.lastHop?.module ?? null,
        activePath: state.activePath.map(e => ({ module: e.module, fn: e.function, domain: e.domain })),
        modulesByDomain: state.modulesByDomain,
      },
      verification: {
        passed: verification.passed,
        rules: verification.rules.map(r => ({
          rule: r.rule,
          passed: r.passed,
          message: r.message,
          violations: r.violations,
        })),
      },
      drift: {
        driftCount: drift.driftCount,
        missingCount: drift.missingCount,
        unexpectedCount: drift.unexpectedCount,
        domainViolationCount: drift.domainViolationCount,
        summary: drift.summary,
        items: drift.driftItems,
      },
    }
  })

  /**
   * GET /api/v1/kernel/report — Human-readable self-verification report
   */
  app.get('/api/v1/kernel/report', async (_req, reply) => {
    const state = buildExecutionState()
    const verification = verify(state)
    const drift = analyzeDrift(state)

    reply.type('text/plain')
    return [
      '=== Phase 5 — Self-Verification Kernel Report ===',
      '',
      formatExecutionState(state),
      '',
      formatVerificationReport(verification),
      '',
      formatDriftReport(drift),
      '',
      `--- End Report ---`,
    ].join('\n')
  })
}
