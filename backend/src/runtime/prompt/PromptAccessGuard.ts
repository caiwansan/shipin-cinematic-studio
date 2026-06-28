/**
 * PromptAccessGuard.ts — 昆仑镜 Prompt 直接访问禁卫军 (v3, 模块封装式)
 *
 * 设计思路：Prisma 6 的 $extends 内部的 query 回调无法可靠获取调用栈，
 * 因此改为「导出层注入」方式——在 prisma 模块上覆写 promptTemplate 的查询方法，
 * 用一个白名单标记判断是否来自 PromptRegistry。
 *
 * @phase2-guard
 */

import { PrismaClient } from '@prisma/client'

let _isRegistryContext = false

/**
 * PromptRegistry 调用上下文标记（导出给 PromptRegistry 使用）
 * 在 PromptRegistry 的 getPromptRaw 中包裹此函数执行 findUnique
 */
export function runAsRegistry<T>(fn: () => Promise<T>): Promise<T> {
  const prev = _isRegistryContext
  _isRegistryContext = true
  return fn().finally(() => { _isRegistryContext = prev })
}

/**
 * 管理员 Prompt CRUD 上下文标记（导出给 script-breakdown.ts 管理路由使用）
 */
export function runAsAdmin<T>(fn: () => Promise<T>): Promise<T> {
  const prev = _isRegistryContext
  _isRegistryContext = true
  return fn().finally(() => { _isRegistryContext = prev })
}

/**
 * 注册防回流锁
 * 替换 prisma.promptTemplate 的 findUnique/findFirst
 */
export function registerPromptGuard(prisma: PrismaClient): PrismaClient {
  // 保存原始方法
  const originalPromptFindUnique = (prisma.promptTemplate as any).findUnique.bind(prisma.promptTemplate)
  const originalPromptFindFirst = (prisma.promptTemplate as any).findFirst.bind(prisma.promptTemplate)
  const originalImageFindUnique = (prisma.imagePromptTemplates as any).findUnique.bind(prisma.imagePromptTemplates)
  const originalImageFindFirst = (prisma.imagePromptTemplates as any).findFirst.bind(prisma.imagePromptTemplates)

  // 覆写 promptTemplate.findUnique
  ;(prisma.promptTemplate as any).findUnique = async function guardedFindUnique(args: any) {
    if (_isRegistryContext) {
      return originalPromptFindUnique(args)
    }
    const errMsg = `[PromptAccessGuard] ❌ 违规直接访问 PromptTemplate.findUnique（"${String(args?.where?.name || 'unknown')}"）。所有 prompt 必须通过 PromptRegistry 获取。`
    console.error(errMsg)
    throw new Error(errMsg)
  }

  // 覆写 promptTemplate.findFirst
  ;(prisma.promptTemplate as any).findFirst = async function guardedFindFirst(args: any) {
    if (_isRegistryContext) {
      return originalPromptFindFirst(args)
    }
    const errMsg = `[PromptAccessGuard] ❌ 违规直接访问 PromptTemplate.findFirst。所有 prompt 必须通过 PromptRegistry 获取。`
    console.error(errMsg)
    throw new Error(errMsg)
  }

  // 覆写 imagePromptTemplates.findUnique
  ;(prisma.imagePromptTemplates as any).findUnique = async function guardedImageFindUnique(args: any) {
    if (_isRegistryContext) {
      return originalImageFindUnique(args)
    }
    const errMsg = `[PromptAccessGuard] ❌ 违规直接访问 ImagePromptTemplates.findUnique。所有 prompt 必须通过 PromptRegistry 获取。`
    console.error(errMsg)
    throw new Error(errMsg)
  }

  ;(prisma.imagePromptTemplates as any).findFirst = async function guardedImageFindFirst(args: any) {
    if (_isRegistryContext) {
      return originalImageFindFirst(args)
    }
    const errMsg = `[PromptAccessGuard] ❌ 违规直接访问 ImagePromptTemplates.findFirst。所有 prompt 必须通过 PromptRegistry 获取。`
    console.error(errMsg)
    throw new Error(errMsg)
  }

  console.log('[PromptAccessGuard] ✅ Prompt 直接访问防回流锁已部署（导出封装式）')
  return prisma
}
