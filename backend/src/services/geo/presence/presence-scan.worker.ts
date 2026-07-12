// ============================================================
// Presence Scan Worker — Scan Job → Queue → Worker → AI Query
//                 → Snapshot → Repository → Presence Engine
//
// P0-5: Scan Runtime Recovery — bridges the scan-request to
// presence-engine pipeline. Executes all registered Provider
// Adapters, persists results to Evidence + Snapshot, and
// records timeline events.
// ============================================================

import { PresenceEngine } from './engine.js'
import { providerAdapterRegistry, presenceEngine } from './index.js'
import { presenceRepository } from './presence.repository.js'
import { geoScoreSnapshotRepository } from '../repositories/geo-score-snapshot.repository.js'
import { geoScanHistoryRepository } from '../repositories/geo-scan-history.repository.js'
import { geoProjectRepository } from '../repositories/geo-project.repository.js'
import { snapshotBuilder } from '../workspace/snapshot-builder.js'
import { timelineEngine } from '../workspace/timeline.js'
import { createHash } from 'node:crypto'
import type { PresenceContext, AIPresenceResult, ProviderResult } from './types.js'

// ─── Types ───

export interface ScanJob {
  scanId: string
  projectId: string
  userId: string
  context: PresenceContext
  startedAt: Date
}

export interface ScanResult {
  scanId: string
  projectId: string
  status: 'completed' | 'failed'
  overallScore: number
  providerCount: number
  visibleCount: number
  checkedAt: string
  snapshotId: string | null
  error?: string
  providerResults: ProviderResult[]
}

// ─── In-memory scan tracker (for polling APIs) ───

const runningScans = new Map<string, ScanJob>()

export function getRunningScan(scanId: string): ScanJob | undefined {
  return runningScans.get(scanId)
}

function computeRequestHash(provider: string, entity: string, payload: unknown): string {
  return createHash('md5')
    .update(`${provider}:${entity}:${JSON.stringify(payload)}`)
    .digest('hex')
}

// ─── Timeline Event Helper (Unified — uses timelineEngine.record) ───

async function recordTimelineEvent(
  projectId: string,
  type: string,
  detail: Record<string, unknown>,
): Promise<string> {
  const engine = 'presence'
  const entity = 'project'
  return timelineEngine.record(type, {
    projectId,
    engine,
    entity,
    payload: detail,
  })
}

// ─── Main Worker ───

export class PresenceScanWorker {
  private engine: PresenceEngine

  constructor() {
    this.engine = new PresenceEngine(providerAdapterRegistry)
  }

  /**
   * Execute a full presence scan for a project.
   * 1. Run all Provider Adapters
   * 2. Store results in GEOPresenceEvidence
   * 3. Create GEOScoreSnapshot
   * 4. Update scan history
   * 5. Record timeline events
   */
  async execute(scanId: string, projectId: string, userId: string): Promise<ScanResult> {
    const startTime = Date.now()
    let scan: ScanJob | undefined

    try {
      // ── 0. Load project context ──
      const project = await geoProjectRepository.findUnique({ where: { id: projectId } })
      if (!project || project.deletedAt) {
        throw new Error(`Project not found: ${projectId}`)
      }

      const context: PresenceContext = {
        projectId,
        name: project.name || '',
        website: project.website || (project.config?.website as string) || '',
        industry: project.industry || (project.config?.industry as string) || '',
        description: project.description || (project.config?.description as string) || '',
      }

      // Track job
      scan = { scanId, projectId, userId, context, startedAt: new Date() }
      runningScans.set(scanId, scan)

      // ── 1. Record SCAN_STARTED event ──
      await recordTimelineEvent(projectId, 'SCAN_STARTED', {
        scanId,
        projectName: project.name,
        providerCount: providerAdapterRegistry.getPresenceCapable().length,
      })

      // ── 2. Run Presence Engine (executes all Provider Adapters) ──
      const result: AIPresenceResult = await this.engine.checkAll(context)

      // ── 3. Persist each provider result to GEOPresenceEvidence ──
      for (const providerResult of result.providers) {
        const entity = context.name
        const requestHash = computeRequestHash(providerResult.provider, entity, providerResult)

        // Map visibility to status
        const status = mapVisibilityToStatus(providerResult.visibility)

        await presenceRepository
          .create({
            projectId,
            provider: providerResult.provider,
            entity,
            status,
            confidence: providerResult.confidence,
            requestHash,
            source: `provider:${providerResult.provider}`,
            checkedAt: new Date(result.checkedAt),
            latencyMs: 0,
            metadata: {
              explain: providerResult.explain,
              summary: providerResult.summary,
              evidenceLevel: providerResult.evidenceLevel,
              evidenceCount: providerResult.evidenceCount,
              knowledgeQuality: providerResult.knowledgeQuality,
              visibility: providerResult.visibility,
              recommendations: providerResult.recommendations,
            },
          })
          .catch((err) => {
            console.error(
              `[PresenceScanWorker] Failed to persist ${providerResult.provider} evidence:`,
              err,
            )
          })

        // Record per-provider event
        await recordTimelineEvent(projectId, 'SCAN_PROVIDER_COMPLETED', {
          scanId,
          provider: providerResult.provider,
          status,
          confidence: providerResult.confidence,
          visibility: providerResult.visibility,
        })
      }

      // ── 4. Create GEOScoreSnapshot (via SnapshotBuilder — SSOT) ──
      // Collect evidence IDs from persisted records
      const evidenceIds: string[] = []
      const isStubRun = result.providers.some((p) => p._meta?.isStub)

      // Re-fetch evidence records to get their IDs after persistence above
      const evidenceRecords = await presenceRepository.findLatestByProject(projectId, 50)
      for (const evidenceRecord of evidenceRecords) {
        evidenceIds.push(evidenceRecord.id)
      }

      // Compute responseHash from provider results
      const responseHash = createHash('md5')
        .update(JSON.stringify(result.providers.map((p) => ({
          provider: p.provider,
          visibility: p.visibility,
          confidence: p.confidence,
        }))))
        .digest('hex')

      const snapshotData = snapshotBuilder.build({
        projectId,
        scanId,
        evidenceIds,
        sourceType: isStubRun ? 'stub' : 'real',
        responseHash,
        snapshotData: {
          overall: result.overall,
          providers: result.providers.map((p) => ({
            provider: p.provider,
            displayName: p.displayName,
            visibility: p.visibility,
            confidence: p.confidence,
            knowledgeQuality: p.knowledgeQuality,
            evidenceLevel: p.evidenceLevel,
            evidenceCount: p.evidenceCount,
            summary: p.summary,
            recommendations: p.recommendations,
          })),
          platformGroups: result.platformGroups,
          checkedAt: result.checkedAt,
        },
        scoresData: {
          overall: result.overall.score,
          visibilityCount: result.overall.visibilityCount,
          totalChecked: result.overall.totalChecked,
          averageKnowledge: result.overall.averageKnowledge,
        },
        metadataData: {
          scanId,
          userId,
          durationMs: Date.now() - startTime,
          source: 'presence-scan-worker',
          isStub: isStubRun,
        },
      })

      const snapshot = await geoScoreSnapshotRepository.create(snapshotData)

      // ── 5. Update GeoScanHistory ──
      await geoScanHistoryRepository.update(
        { id: scanId },
        {
          status: 'completed',
          completedAt: new Date(),
          result: {
            overallScore: result.overall.score,
            visibilityCount: result.overall.visibilityCount,
            totalChecked: result.overall.totalChecked,
            providerCount: result.providers.length,
            snapshotId: snapshot.id,
            providerSummary: result.providers.map((p) => ({
              provider: p.provider,
              visibility: p.visibility,
              confidence: p.confidence,
            })),
          },
        },
      )

      // ── 6. Record SCAN_COMPLETED event ──
      await recordTimelineEvent(projectId, 'SCAN_COMPLETED', {
        scanId,
        overallScore: result.overall.score,
        visibilityCount: result.overall.visibilityCount,
        totalChecked: result.overall.totalChecked,
        snapshotId: snapshot.id,
        durationMs: Date.now() - startTime,
      })

      // Clean up tracker
      runningScans.delete(scanId)

      return {
        scanId,
        projectId,
        status: 'completed',
        overallScore: result.overall.score,
        providerCount: result.providers.length,
        visibleCount: result.overall.visibilityCount,
        checkedAt: result.checkedAt,
        snapshotId: snapshot.id,
        providerResults: result.providers,
      }
    } catch (err: any) {
      // Clean up tracker on failure
      if (scan) runningScans.delete(scan.scanId)

      // ── Record SCAN_FAILED event ──
      await recordTimelineEvent(projectId, 'SCAN_FAILED', {
        scanId,
        error: err.message,
        durationMs: Date.now() - startTime,
      })

      // Update scan history
      try {
        await geoScanHistoryRepository.update(
          { id: scanId },
          {
            status: 'failed',
            completedAt: new Date(),
            error: err.message,
            result: { error: err.message },
          },
        )
      } catch {
        // Best effort
      }

      return {
        scanId,
        projectId,
        status: 'failed',
        overallScore: 0,
        providerCount: 0,
        visibleCount: 0,
        checkedAt: new Date().toISOString(),
        snapshotId: null,
        error: err.message,
        providerResults: [],
      }
    }
  }

  /**
   * Check if a scan is currently running.
   */
  isScanRunning(scanId: string): boolean {
    return runningScans.has(scanId)
  }

  /**
   * Get all running scans.
   */
  getRunningScans(): ScanJob[] {
    return Array.from(runningScans.values())
  }
}

// ─── Helpers ───

function mapVisibilityToStatus(visibility: string): string {
  switch (visibility) {
    case 'visible':
    case 'partial':
      return 'FOUND'
    case 'missing':
      return 'NOT_FOUND'
    case 'checking':
      return 'UNKNOWN'
    case 'unknown':
    default:
      return 'UNKNOWN'
  }
}

// Singleton
export const presenceScanWorker = new PresenceScanWorker()
