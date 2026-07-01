// ============================================================
// AI Presence Engine — ProviderAdapter Interface
// P0-T005: AI Presence Engine Foundation
//
// SSOT: All adapters implement this interface. Engine consumes
// adapters through this interface only — no if/else on provider type.
// ============================================================

import { PresenceContext, ProviderResult } from './types.js'

export interface ProviderAdapterMeta {
  group: 'international' | 'china'
  displayOrder: number
  iconUrl?: string
}

export interface ProviderAdapter {
  readonly provider: string
  readonly displayName: string
  readonly supportsPresence: boolean
  readonly meta: ProviderAdapterMeta
  checkPresence(context: PresenceContext): Promise<ProviderResult>
}
