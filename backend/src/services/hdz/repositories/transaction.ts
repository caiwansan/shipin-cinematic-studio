// ============================================================
// HDZ Transaction Helper — wraps prisma.$transaction
// ============================================================

import { prisma } from '../../../utils/index.js'

/**
 * Execute a callback within a Prisma transaction.
 * The callback receives the Prisma transaction client (tx) for direct use.
 */
export async function hdzTransaction<T>(
  fn: (tx: any) => Promise<T>,
): Promise<T> {
  return prisma.$transaction(fn)
}
