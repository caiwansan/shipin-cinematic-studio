// llm-config-resolver/migrate.ts — V1→V2 收敛迁移工具

/**
 * 迁移目标：
 * 1. 清空所有 User 的 activeLlmConfigId（消除 V1 优先级）
 * 2. 标记 V1 表记录为 deprecated（如果有 deprecated 列）
 * 3. 确保 V2 表中都已标记活跃
 */
export async function migrateLLMConfigs(prisma: any) {
  const results: string[] = []

  // 1. 清空 activeLlmConfigId
  const { count: cleared } = await prisma.user.updateMany({
    data: { activeLlmConfigId: null },
  })
  results.push(`清空 activeLlmConfigId: ${cleared} 用户`)

  // 2. 标记 V1 deprecated（如果存在该列）
  try {
    const { count: deprecated } = await prisma.userModelConfig.updateMany({
      data: { deprecated: true },
    })
    results.push(`标记 V1 deprecated: ${deprecated} 条`)
  } catch {
    results.push('V1 表无 deprecated 列，跳过')
  }

  // 3. V2 统一激活
  try {
    const { count: activated } = await prisma.userModelConfigV2.updateMany({
      data: { isActive: true },
    })
    results.push(`激活 V2 配置: ${activated} 条`)
  } catch {
    results.push('V2 表无 isActive 列，跳过')
  }

  return { ok: true, details: results }
}
