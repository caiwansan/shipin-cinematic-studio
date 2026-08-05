/**
 * S2.1 Plugin Registry Adapter — Registry 查询适配层（只读，复用>重构）
 * 依据: KUNLUN-S2.1-PLUGIN-REGISTRY-DESIGN-REVIEW.md（RG1-RG5 批准）
 * 原则:
 *  - 不改 Ecology 表 / 不改现有 plugin-registry.service
 *  - 消费 EcologyPlugin / EcologyPluginRuntimeBinding / EcologyLicense
 *  - 输出统一 Registry DTO（S2.0 三层契约对齐）
 *  - Desktop 只读消费（不写任何 Registry 数据）
 *
 * 部署: backend/src/ecosystem/plugin-registry-adapter.ts（新文件，纯增量）
 */
import { prisma } from '../utils/index.js'

/**
 * Registry DTO（S2.0 三层契约对齐）
 * Identity: id/name/version
 * Runtime: type/entry/capabilities/runtimeBindings
 * Governance: permissions/pricing/entitlementState
 */
export interface PluginRegistryEntry {
  id: string
  name: string
  version: string | null
  type: string
  status: string
  lifecycleState: string
  // Runtime Layer
  entry: {
    kind: 'workspace' | 'capability'
    workspaceUrl: string | null
    deepLink: string | null
  }
  capabilities: string[]
  runtimeBindings: {
    runtimeId: string
    capabilities: string[]
    status: string
  }[]
  // Governance Layer
  permissions: string[]
  pricing: { model: string; price?: number; period?: string } | null
  entitlementState: 'free' | 'authorized' | 'none' | 'expired' | null
  // 关联
  application: { slug: string; name: string } | null
}

/** type 映射（Ecology agent/tool/workflow → S2.0 契约语义） */
function mapType(type: string): string {
  switch (type) {
    case 'agent': return 'capability-plugin'   // Agent 型 = 能力增强
    case 'tool': return 'capability-plugin'
    case 'workflow': return 'workspace-plugin' // 工作流型 = 工作台入口
    default: return type
  }
}

/** 权限映射（Ecology 集 → S2.0 最小集；未知权限保留原样由上层判定） */
function mapPermissions(raw: unknown): string[] {
  const list = Array.isArray(raw) ? (raw as string[]) : []
  const map: Record<string, string> = {
    content: 'storage',
    analytics: 'ai-runtime',
    automation: 'ai-runtime',
    browser: 'workspace',
    storage: 'storage',
    network: 'workspace',
  }
  // 保留已知映射 + 直接透传 workspace/identity/ai-runtime/storage
  return [...new Set(list.map(p => map[p] || p))]
}

/**
 * 查询 Plugin Registry 目录（只读）
 * @param orgId 可选组织（返回 entitlementState）
 */
export async function listRegistryPlugins(orgId?: string): Promise<PluginRegistryEntry[]> {
  const plugins = await prisma.ecologyPlugin.findMany({
    orderBy: { createdAt: 'desc' },
    include: {
      application: { select: { slug: true, name: true } },
      runtimeBindings: {
        select: { runtimeId: true, capabilities: true, status: true },
      },
      licenses: orgId
        ? {
            where: { organizationId: orgId },
            select: { licenseType: true, status: true, expireAt: true },
          }
        : false,
    },
  })

  return plugins.map((p) => {
    const manifest = (p.manifest as any) || {}
    const license = Array.isArray(p.licenses) && p.licenses.length > 0 ? p.licenses[0] : null
    const entryKind = p.type === 'workflow' ? 'workspace' : 'capability'

    let entitlementState: PluginRegistryEntry['entitlementState'] = 'none'
    if (license) {
      if (license.status === 'active' && (!license.expireAt || new Date(license.expireAt) > new Date())) {
        entitlementState = 'authorized'
      } else {
        entitlementState = 'expired'
      }
    } else if (!manifest.pricing || manifest.pricing.model === 'free') {
      entitlementState = 'free'
    }

    return {
      id: p.pluginId,
      name: p.name,
      version: manifest.version || null,
      type: mapType(p.type),
      status: p.status,
      lifecycleState: p.lifecycleState,
      entry: {
        kind: entryKind,
        workspaceUrl: manifest.entry?.workspaceUrl || manifest.workspaceUrl || null,
        deepLink: manifest.entry?.deepLink || manifest.deepLink || null,
      },
      capabilities: Array.isArray(manifest.capabilities)
        ? (manifest.capabilities as string[])
        : (p.runtimeBindings.flatMap((b) => {
            try { return JSON.parse(b.capabilities || '[]') as string[] } catch { return [] }
          })),
      runtimeBindings: p.runtimeBindings.map((b) => ({
        runtimeId: b.runtimeId,
        capabilities: (() => { try { return JSON.parse(b.capabilities || '[]') as string[] } catch { return [] } })(),
        status: b.status,
      })),
      permissions: mapPermissions(manifest.permissions),
      pricing: manifest.pricing || manifest.billing || null,
      entitlementState,
      application: p.application ? { slug: p.application.slug, name: p.application.name } : null,
    }
  })
}

/** 单插件查询（只读） */
export async function getRegistryPlugin(pluginId: string, orgId?: string): Promise<PluginRegistryEntry | null> {
  const entries = await listRegistryPlugins(orgId)
  return entries.find((e) => e.id === pluginId) || null
}

/**
 * Hermes 绑定查询（Task 03: 只做声明映射，不执行）
 * 返回: Plugin → Agent Binding → Hermes Runtime Requirement
 */
export async function getHermesBinding(pluginId: string) {
  const plugin = await prisma.ecologyPlugin.findUnique({
    where: { pluginId },
    include: { runtimeBindings: true },
  })
  if (!plugin) return null
  return {
    pluginId: plugin.pluginId,
    pluginType: plugin.type,
    bindings: plugin.runtimeBindings.map((b) => ({
      runtimeId: b.runtimeId,
      capabilities: (() => { try { return JSON.parse(b.capabilities || '[]') as string[] } catch { return [] } })(),
      status: b.status,
    })),
    // Hermes Runtime Requirement（声明式，不触发执行）
    runtimeRequirement: (plugin.manifest as any)?.runtime || { kaor: true, local: false },
  }
}
