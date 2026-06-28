// ============================================================
// Base Repository — shared CRUD utilities for Governance
// ============================================================

import { prisma } from '../../../../utils/index.js'

export function getPrisma() {
  return prisma
}

// Re-export prisma for backwards compat
export { prisma }
