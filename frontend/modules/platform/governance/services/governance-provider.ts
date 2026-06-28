// ============================================================
// Governance Service Provider — KMKI-PLAT-012
// Provides the governance API service as a composable
// ============================================================

import { governanceApi } from './governance.service.js'

export function useGovernanceService() {
  return governanceApi
}
