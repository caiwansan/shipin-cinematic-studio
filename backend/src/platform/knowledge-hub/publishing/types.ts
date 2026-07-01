// ════════════════════════════════════════════════════════════
// KH2 — Publishing Types
// ════════════════════════════════════════════════════════════
// Canonical types for the Publishing domain
// ════════════════════════════════════════════════════════════

import { KnowledgePackage } from '../core/types'

// ─── Publishing Result (KH2-T004) ───
export interface PublishArtifact {
  name: string
  url?: string
  size?: number
  mimeType?: string
}

export interface PublishingResult {
  id: string
  packageId: string
  publisherName: string
  status: 'pending' | 'queued' | 'running' | 'succeeded' | 'failed' | 'cancelled'
  startedAt?: string
  finishedAt?: string
  artifacts: PublishArtifact[]
  error?: string
  errorLog: string[]
  retryCount: number
  maxRetries: number
  createdAt: string
  updatedAt: string
}

// ─── Publisher (KH2-T005 Adapter Interface) ───
export interface Publisher {
  name: string
  type: 'website' | 'cms' | 'webhook' | 'export'
  capabilities?: string[]
  publish(pkg: KnowledgePackage): Promise<{ artifacts: PublishArtifact[] }>
  validate?(pkg: KnowledgePackage): { valid: boolean; errors?: string[] }
  rollback?(result: PublishingResult): Promise<boolean>
}

// ─── Publisher Capabilities (future: Capability Discovery) ───
export const PublisherCapability = {
  SupportsIncremental: 'supports_incremental',
  SupportsRollback: 'supports_rollback',
  SupportsScheduling: 'supports_scheduling',
  SupportsPreview: 'supports_preview',
  SupportsVerification: 'supports_verification',
} as const

export type PublisherCapability = (typeof PublisherCapability)[keyof typeof PublisherCapability]
