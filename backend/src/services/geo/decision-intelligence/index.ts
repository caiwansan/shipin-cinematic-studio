// ─────────────────────────────────────────────────
// Decision Intelligence — Index (统一出口)
// A1.1 — FROZEN
// ─────────────────────────────────────────────────

import type { FastifyInstance } from 'fastify'
import { registerDIIssueGraphRoutes } from './routes'

export { IssueGraphBuilder } from './issue-graph-builder'
export { GraphRootCauseStrategy } from './graph.strategy'
export type { Issue, IssueGraph, IssueEdge, IssueKind, IssueStatus, DependencyRelationship, GraphSummary, RootCauseStrategy } from './types'

export function registerDecisionIntelligenceRoutes(fastify: FastifyInstance): void {
  registerDIIssueGraphRoutes(fastify)
}
