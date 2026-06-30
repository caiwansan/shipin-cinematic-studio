/**
 * GEO Verification Service — Real API Implementation
 *
 * GET /api/v1/geo/verification/{projectId}
 */
import { ofetch } from 'ofetch'

export interface VerificationData {
  outcome: {
    beforeScore: number
    afterScore: number
    delta: number
  }
  confidence: Array<{
    item: string
    complete: boolean
  }>
  proof: Array<{
    name: string
    before: string | number
    after: string | number
    delta: number
    suffix?: string
    isUnavailable?: boolean
    learnContent?: string
  }>
  trust: {
    message: string
  }
  history: Array<{
    id: string
    date: string
    beforeScore: number
    afterScore: number
    delta: number
  }>
}

const API_BASE = '/api/v1/geo'

export async function fetchVerification(projectId: string): Promise<VerificationData> {
  return ofetch(`${API_BASE}/verification/${projectId}`)
}
