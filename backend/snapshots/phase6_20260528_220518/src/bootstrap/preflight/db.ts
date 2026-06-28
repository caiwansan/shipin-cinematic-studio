/**
 * bootstrap/preflight/db.ts — Database Preflight Check
 *
 * Phase 2, Rule 5: 数据库不可用则系统 fail-fast
 */

export async function verifyDatabase(): Promise<void> {
  try {
    const { prisma } = await import('../../utils/index.js')
    // 轻量查询验证连通性
    await prisma.$queryRaw`SELECT 1 as connected`
    console.log('[boot]   ✅ Database: OK')
  } catch (err: any) {
    throw new Error(`[boot] ❌ Database 不可用: ${err.message}`)
  }
}
