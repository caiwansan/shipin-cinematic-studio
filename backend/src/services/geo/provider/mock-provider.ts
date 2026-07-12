// ============================================================
// GEO AI Provider — Mock Provider
// @beta-stub: 开发/演示用 Mock Provider，生产环境不参与实际推理
// RC2-T001: GEO AI Provider Infrastructure
//
// Implements GeoAIProvider interface.
// Discovery: wraps existing MockScanner from benchmark/discovery
// Verification: generates realistic mock claims
// ============================================================

import { GeoAIProvider, ProviderName, GeoCapability, DiscoveryRequest, DiscoveryResult, VerificationRequest, VerificationResult } from './types'
import { MockScanner } from '../../../benchmark/discovery/mock-scanner'

export class MockProvider implements GeoAIProvider {
  readonly name: ProviderName = 'mock'
  readonly displayName = 'Mock Scanner (Demo)'
  readonly capabilities: GeoCapability[] = ['discovery', 'verification']

  private scanner: MockScanner

  constructor() {
    this.scanner = new MockScanner()
  }

  async discover(request: DiscoveryRequest): Promise<DiscoveryResult> {
    const startTime = Date.now()

    // Convert Record<string, number> to Map<string, number> for MockScanner
    const matchConfidences = new Map<string, number>()
    for (const [key, value] of Object.entries(request.matchConfidences)) {
      matchConfidences.set(key, value)
    }

    // Call the existing MockScanner
    const result = this.scanner.scan(request.entity, matchConfidences)

    const latencyMs = Date.now() - startTime

    return {
      scenarios: result.scenarios,
      coverage: result.coverage,
      share: result.share,
      position: result.position,
      meta: {
        provider: this.name,
        latencyMs,
        tokenUsage: {
          prompt: 0,
          completion: 0,
          total: 0,
        },
        cost: 0,
        cached: false,
      },
    }
  }

  async verify(request: VerificationRequest): Promise<VerificationResult> {
    const startTime = Date.now()

    // Generate realistic mock verification results
    const mockClaims = request.claims.map((claim, index) => {
      // Deterministic but realistic confidence based on claim text
      const hash = claim.split('').reduce((acc, c) => acc * 31 + c.charCodeAt(0), 0)
      const baseConfidence = 50 + Math.abs(hash % 40) // 50-89
      const noise = Math.abs((hash * 7 + index * 13) % 20) // 0-19
      const confidence = Math.min(95, baseConfidence + noise)
      const verified = confidence >= 60

      // Generate mock evidence
      const evidenceCount = verified ? 1 + Math.abs(hash % 3) : 0
      const evidence: string[] = []
      for (let i = 0; i < evidenceCount; i++) {
        evidence.push(`mock-evidence-${index}-${i}: ${claim.substring(0, 40)}... (simulated)`)
      }

      return {
        claimId: `mock-claim-${index}-${Date.now().toString(36)}`,
        claim,
        verified,
        confidence,
        evidence,
      }
    })

    const overallConfidence = mockClaims.length > 0
      ? Math.round(mockClaims.reduce((sum, c) => sum + c.confidence, 0) / mockClaims.length)
      : 0

    const latencyMs = Date.now() - startTime

    return {
      claims: mockClaims,
      overallConfidence,
      meta: {
        provider: this.name,
        latencyMs,
        tokenUsage: {
          prompt: 0,
          completion: 0,
          total: 0,
        },
        cost: 0,
        cached: false,
      },
    }
  }

  async health(): Promise<{ ok: boolean; latencyMs: number; error?: string }> {
    const startTime = Date.now()

    // Mock health — always healthy
    try {
      // Quick smoke test: run a minimal scan
      const matchConfidences = new Map<string, number>()
      this.scanner.scan('health-check', matchConfidences)

      return {
        ok: true,
        latencyMs: Date.now() - startTime,
      }
    } catch (err: any) {
      return {
        ok: false,
        latencyMs: Date.now() - startTime,
        error: err.message || 'Unknown error',
      }
    }
  }
}
