/**
 * S3.1 Skill Manifest Adapter — 只读 Skill Catalog（复用现有 SSOT）
 * 依据: KUNLUN-S3-SKILL-SYSTEM-DESIGN-GATE.md（SG1-SG7）
 * 原则:
 *  - 复用 AgentDefinition + EcologyRuntimeCapability + EcologyPlugin.manifest（零新表）
 *  - 只读 Catalog（不执行/不修改/不建 Executor）
 *  - Skill = AgentDefinition.capabilities 的能力单元描述
 */
import { prisma } from '../utils/index.js'

/** SkillDefinition（S3.1 契约） */
export interface SkillDefinition {
  id: string
  name: string
  version: string
  description: string | null
  category: string | null
  capabilities: string[]
  requiredTools: string[]
  permissions: string[]
  lifecycleState: string
  // 来源映射
  source: {
    agentDefinition: string | null   // code
    runtimeCapabilities: string[]
  }
}

/** 解析 JSON 字段（容错） */
function parseJson(raw: string | null | undefined): any {
  if (!raw) return null
  try { return JSON.parse(raw) } catch { return null }
}

/**
 * Task 02/03: Skill Catalog（只读）
 * Skill 来源 = AgentDefinition（capabilities 声明）+ EcologyRuntimeCapability（runtime 能力）
 */
export async function listSkills(): Promise<SkillDefinition[]> {
  // 1. AgentDefinition 作为 Skill 主来源（若有数据）
  const defs = await prisma.agentDefinition.findMany({
    where: { status: { in: ['active', 'deprecated'] } },
    orderBy: { createdAt: 'desc' },
  }).catch(() => [])

  // 2. EcologyRuntimeCapability 作为 runtime 能力补充
  const runtimeCaps = await prisma.ecologyRuntimeCapability.findMany({
    select: { runtimeId: true, capability: true, status: true },
  }).catch(() => [])

  // 3. EcologyPlugin.manifest capabilities 作为 Plugin 挂载的 Skill 引用
  const plugins = await prisma.ecologyPlugin.findMany({
    select: { pluginId: true, name: true, manifest: true, status: true },
    take: 100,
  }).catch(() => [])

  // 组装: AgentDefinition → Skill
  const fromDefs: SkillDefinition[] = (defs as any[]).map((d: any) => {
    const caps = parseJson(d.capabilities) || []
    const perms = parseJson(d.permissions) || []
    const tools = parseJson(d.supportedResources) || []
    return {
      id: d.code,
      name: d.name,
      version: d.version,
      description: d.description || null,
      category: d.category || null,
      capabilities: Array.isArray(caps) ? caps : [caps],
      requiredTools: Array.isArray(tools) ? tools : [],
      permissions: Array.isArray(perms) ? perms : [],
      lifecycleState: d.status,
      source: { agentDefinition: d.code, runtimeCapabilities: [] },
    }
  })

  // 组装: RuntimeCapability → Skill（runtime 能力单元）
  const fromRuntime: SkillDefinition[] = runtimeCaps.map((r: any) => ({
    id: `runtime:${r.capability}`,
    name: r.capability,
    version: '1.0.0',
    description: `Hermes runtime capability: ${r.capability}`,
    category: 'runtime',
    capabilities: [r.capability],
    requiredTools: [],
    permissions: [],
    lifecycleState: r.status === 'active' ? 'AVAILABLE' : 'REGISTERED',
    source: { agentDefinition: null, runtimeCapabilities: [r.capability] },
  }))

  // 合并（AgentDefinition 优先）
  return [...fromDefs, ...fromRuntime]
}

/** 单 Skill 详情（只读） */
export async function getSkill(id: string): Promise<SkillDefinition | null> {
  const all = await listSkills()
  return all.find((s) => s.id === id) || null
}

/**
 * Task 04: AgentDefinition 映射验证
 * 证明: Skill ↔ AgentDefinition.capability 可描述
 */
export async function verifyAgentDefinitionMapping(): Promise<any> {
  const defs = await prisma.agentDefinition.findMany({
    select: { code: true, name: true, capabilities: true, status: true },
    take: 50,
  }).catch(() => [])
  return {
    total: (defs as any[]).length,
    mappable: (defs as any[]).filter((d) => {
      const caps = parseJson(d.capabilities)
      return caps && (Array.isArray(caps) ? caps.length > 0 : true)
    }).length,
    defs: (defs as any[]).map((d) => ({
      code: d.code,
      capabilities: parseJson(d.capabilities) || [],
      status: d.status,
    })),
  }
}
