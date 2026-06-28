import { PrismaClient } from '@prisma/client'
import { EventEmitter } from 'events'

export const prisma = new PrismaClient()
export { projectService } from '../services/project.service.js'
export const taskEventEmitter = new EventEmitter()
// 防止内存泄漏，最多 50 个 listener
taskEventEmitter.setMaxListeners(50)

export async function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

// ====== Route Config 辅助函数（去硬编码） ======

/**
 * 从 RouteConfig 表读取单条配置，支持 scope 过滤
 * 读取不到时返回 defaultValue（硬编码 fallback）
 */
export async function getRouteConfig(scope: string, key: string, defaultValue?: any): Promise<any> {
  try {
    const row = await prisma.routeConfig.findUnique({
      where: { scope_key: { scope, key } }
    })
    return row ? row.value : defaultValue
  } catch (e) {
    // DB 不可用时回退到默认值
    return defaultValue
  }
}

/**
 * 读取 scope 下所有配置，返回扁平对象 { key: value }
 */
export async function getRouteConfigGroup(scope: string): Promise<Record<string, any>> {
  try {
    const rows = await prisma.routeConfig.findMany({
      where: { scope, isActive: true }
    })
    const result: Record<string, any> = {}
    for (const r of rows) result[r.key] = r.value
    return result
  } catch (e) {
    return {}
  }
}

/**
 * 向 RouteConfig 表写入单条配置（upsert）
 */
export async function setRouteConfig(scope: string, key: string, value: any): Promise<void> {
  await prisma.routeConfig.upsert({
    where: { scope_key: { scope, key } },
    update: { value, isActive: true },
    create: { scope, key, value, isActive: true },
  })
}

/**
 * 从 RouteConfig 表读取 providers 数组（便携函数）
 */
export async function getRouteConfigProviders(scope: string): Promise<any[]> {
  const providers = await getRouteConfig(scope, 'providers', [])
  return providers
}

// @phase4-owner

export const __RUNTIME_OWNER__ = {
  "entry": "narrative-gateway",
  "mode": "SYNC"
};

