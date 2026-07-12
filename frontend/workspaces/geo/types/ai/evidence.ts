/**
 * AI Presentation Layer — Evidence Types
 *
 * All evidence types in GEO. When new evidence types are added,
 * extend this enum and the panel component, not AIResult or Explain.
 *
 * @file evidence.ts
 */

export type EvidenceSource = 'scan' | 'knowledge' | 'timeline' | 'verification'

export interface EvidenceItem {
  id: string
  source: EvidenceSource
  summary: string
  detail?: string
  timestamp?: string
  confidence?: 'high' | 'medium' | 'low'
}
