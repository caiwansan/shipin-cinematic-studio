/**
 * S5.3 Plugin Enhancement — 纯函数 + 授权查询（零新表）
 * Plugin = Employee Enhancement: 读企业授权插件的 manifest.enhancements
 * 边界: 插件不创建 Skill/Agent/Runtime; 不持 Key; 不直调模型; 增强数据只参与 prompt 组装
 */
import { prisma } from '../utils/index.js'

export interface EnhancementData {
  skillId: string
  type: string
  templates?: string[]
  rules?: string[]
  [key: string]: any
}

/** 解析 manifest.enhancements（容错） */
function parseEnhancements(manifest: any): EnhancementData[] {
  if (!manifest || typeof manifest !== 'object') return []
  const arr = manifest.enhancements
  if (!Array.isArray(arr)) return []
  return arr.filter((e: any) => e && typeof e.skillId === 'string')
}

/**
 * 查询组织在指定 Skill 上已授权（EcologyLicense ACTIVE）插件的增强数据
 * 无授权 → 空数组（降级: 员工基础执行, 不拒绝）
 */
export async function getOrgEnhancementsForSkills(orgId: string, skillIds: string[]): Promise<EnhancementData[]> {
  if (!orgId || !skillIds.length) return []
  const licenses = await prisma.ecologyLicense
    .findMany({ where: { organizationId: orgId, status: 'ACTIVE' }, select: { pluginId: true } })
    .catch(() => [])
  if (!licenses.length) return []
  const pluginIds = licenses.map((l: any) => l.pluginId)
  const plugins = await prisma.ecologyPlugin
    .findMany({ where: { id: { in: pluginIds }, status: 'PUBLISHED' }, select: { pluginId: true, manifest: true } })
    .catch(() => [])
  const out: EnhancementData[] = []
  for (const pl of plugins as any[]) {
    for (const e of parseEnhancements(pl.manifest)) {
      if (skillIds.includes(e.skillId)) out.push({ ...e, pluginId: pl.pluginId })
    }
  }
  return out
}

/** 注入增强数据到 prompt（纯函数）: user prompt 追加模板/规则上下文 */
export function applyEnhancements(prompt: { system: string; user: string }, enhancements: EnhancementData[]): { system: string; user: string } {
  if (!enhancements.length) return prompt
  const blocks: string[] = []
  for (const e of enhancements) {
    if (Array.isArray(e.templates) && e.templates.length) {
      blocks.push(`[JD templates from licensed plugin ${e.pluginId || ''}]\n- ${e.templates.join('\n- ')}`)
    }
    if (Array.isArray(e.rules) && e.rules.length) {
      blocks.push(`[Evaluation rules from licensed plugin ${e.pluginId || ''}]\n- ${e.rules.join('\n- ')}`)
    }
  }
  if (!blocks.length) return prompt
  return {
    system: prompt.system + '\nUse the provided enhancement templates/rules as authoritative reference when applicable.',
    user: prompt.user + '\n\n' + blocks.join('\n\n'),
  }
}
