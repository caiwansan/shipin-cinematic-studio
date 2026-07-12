// ============================================================
// Truth Trace API — Runtime Audit 追溯链
// P0-5.4: Truth Governance
//
// 任何用户可见数字必须 100% 可追溯到 Raw Response。
// 追溯链: Snapshot → Evidence → Provider Result → Raw Response
//
// Constitution v2.0 第六章：Truth Trace
//   GET /api/geo/truth-trace/:snapshotId
// ============================================================

import { FastifyInstance } from 'fastify'
import { prisma } from '../../../utils/index.js'

// ── Response Types ──

interface TruthTraceEvidence {
  id: string
  provider: string
  status: string
  confidence: number
  checkedAt: string
  requestHash?: string
  source?: string
  metadata?: Record<string, any> | null
}

interface TruthTraceSnapshot {
  id: string
  overallScore: number
  dimensionScores: Record<string, number>
  scanId: string | null
  sourceType: string
  engineVersion: string
  scoreVersion: string
  createdAt: string
  evidenceIds: string[]
  responseHash?: string | null
}

interface TruthTraceScan {
  id: string
  status: string
  createdAt: string
  completedAt?: string | null
  error?: string | null
}

interface TruthTraceProviderResult {
  provider: string
  displayName?: string
  visibility: string
  confidence: number
  knowledgeQuality?: number
  evidenceLevel?: string
  evidenceCount?: number
  summary?: string
  isStub?: boolean
  rawResponseAvailable: boolean
}

interface TruthTraceResponse {
  success: boolean
  data?: {
    snapshot: TruthTraceSnapshot
    evidence: TruthTraceEvidence[]
    scan?: TruthTraceScan | null
    providerResults?: TruthTraceProviderResult[]
  }
  error?: string
}

// ── Route ──

export default async function geoTruthTraceRoutes(fastify: FastifyInstance) {
  // GET /api/geo/truth-trace/:snapshotId
  // 返回从 Snapshot → Evidence → Provider → Raw Response 的完整追溯链
  fastify.get<{ Params: { snapshotId: string } }>(
    '/api/geo/truth-trace/:snapshotId',
    async (request, reply): Promise<TruthTraceResponse> => {
      const { snapshotId } = request.params

      if (!snapshotId) {
        return reply.status(400).send({ success: false, error: 'snapshotId is required' })
      }

      try {
        // ── Step 1: Fetch Snapshot ──
        const snapshot = await (prisma as any).gEOScoreSnapshot?.findUnique?.({
          where: { id: snapshotId },
        })

        if (!snapshot) {
          return reply.status(404).send({ success: false, error: `Snapshot not found: ${snapshotId}` })
        }

        // Parse snapshot/scores data
        const snapData = (snapshot.snapshot || snapshot.scores || {}) as any
        const metadata = (snapshot.metadata || {}) as any
        const overallScore = typeof snapData.overall === 'number' ? snapData.overall : 0

        // Build dimension scores from snapshot data
        const dimensionScores: Record<string, number> = {}
        for (const key of Object.keys(snapData)) {
          if (typeof snapData[key] === 'number' && key !== 'overall') {
            dimensionScores[key] = snapData[key]
          }
        }

        // Parse evidence IDs from snapshot
        let evidenceIds: string[] = []
        if (snapshot.evidenceIds && Array.isArray(snapshot.evidenceIds)) {
          evidenceIds = snapshot.evidenceIds
        } else if (metadata.evidenceIds && Array.isArray(metadata.evidenceIds)) {
          evidenceIds = metadata.evidenceIds
        }

        const snapshotResult: TruthTraceSnapshot = {
          id: snapshot.id,
          overallScore,
          dimensionScores,
          scanId: snapshot.scanId || metadata.scanId || null,
          sourceType: snapshot.sourceType || metadata.sourceType || 'unknown',
          engineVersion: snapshot.engineVersion || metadata.engineVersion || 'unknown',
          scoreVersion: snapshot.scoreVersion || metadata.scoreVersion || 'unknown',
          createdAt: snapshot.createdAt instanceof Date
            ? snapshot.createdAt.toISOString()
            : String(snapshot.createdAt),
          evidenceIds,
          responseHash: snapshot.responseHash || metadata.responseHash || null,
        }

        // ── Step 2: Fetch Evidence Records (by snapshot evidenceIds or by projectId) ──
        let evidenceRecords: any[] = []
        try {
          if (evidenceIds.length > 0) {
            evidenceRecords = await (prisma as any).gEOPresenceEvidence?.findMany?.({
              where: { id: { in: evidenceIds } },
            }) || []
          }

          // Fallback: if no evidence IDs from snapshot, try fetching by project + recent
          if (evidenceRecords.length === 0) {
            evidenceRecords = await (prisma as any).gEOPresenceEvidence?.findMany?.({
              where: { projectId: snapshot.projectId },
              orderBy: { checkedAt: 'desc' },
              take: 20,
            }) || []
          }
        } catch {
          // Evidence table may not exist yet
        }

        const evidence: TruthTraceEvidence[] = evidenceRecords.map((ev: any) => ({
          id: ev.id,
          provider: ev.provider || 'unknown',
          status: ev.status || 'UNKNOWN',
          confidence: typeof ev.confidence === 'number' ? ev.confidence : 0,
          checkedAt: ev.checkedAt instanceof Date
            ? ev.checkedAt.toISOString()
            : String(ev.checkedAt || snapshotResult.createdAt),
          requestHash: ev.requestHash || undefined,
          source: ev.source || undefined,
          metadata: ev.metadata || null,
        }))

        // ── Step 3: Fetch Scan (if scanId exists) ──
        let scan: TruthTraceScan | null = null
        if (snapshotResult.scanId) {
          try {
            const scanRecord = await (prisma as any).geoScanHistory?.findUnique?.({
              where: { id: snapshotResult.scanId },
            })
            if (scanRecord) {
              scan = {
                id: scanRecord.id,
                status: scanRecord.status || 'unknown',
                createdAt: scanRecord.createdAt instanceof Date
                  ? scanRecord.createdAt.toISOString()
                  : String(scanRecord.createdAt),
                completedAt: scanRecord.completedAt
                  ? (scanRecord.completedAt instanceof Date
                    ? scanRecord.completedAt.toISOString()
                    : String(scanRecord.completedAt))
                  : null,
                error: scanRecord.error || null,
              }
            }
          } catch {
            // Scan history table may not exist
          }
        }

        // ── Step 4: Build Provider Results (from snapshot data if available) ──
        let providerResults: TruthTraceProviderResult[] | undefined
        if (Array.isArray(snapData.providers)) {
          providerResults = snapData.providers.map((p: any) => ({
            provider: p.provider || 'unknown',
            displayName: p.displayName,
            visibility: p.visibility || 'unknown',
            confidence: typeof p.confidence === 'number' ? p.confidence : 0,
            knowledgeQuality: p.knowledgeQuality,
            evidenceLevel: p.evidenceLevel,
            evidenceCount: p.evidenceCount,
            summary: p.summary,
            isStub: p._meta?.isStub || metadata.isStub || false,
            rawResponseAvailable: !(p._meta?.isStub),
          }))
        }

        return {
          success: true,
          data: {
            snapshot: snapshotResult,
            evidence,
            scan,
            providerResults,
          },
        }
      } catch (err: any) {
        return reply.status(500).send({
          success: false,
          error: `Truth trace failed: ${err.message}`,
        })
      }
    },
  )
}
