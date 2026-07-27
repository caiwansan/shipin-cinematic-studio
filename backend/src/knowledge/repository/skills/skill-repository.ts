/**
 * Phase 3-B1: Skill Repository — 技能图谱存储与查询
 * 
 * 当前实现：内存存储（未来迁移到 PostgreSQL + Neo4j）
 * 支持：按ID查找、按名称查找、全文搜索、图遍历
 */

import type { SkillCanonicalObject, SkillEdge } from '../../canonical/schemas'
import type { IKnowledgeRepository, KnowledgeIndexEntry } from '../../registry/tool-registry'
import { CORE_SKILLS, SKILL_IDS } from './skill-seed'

export class SkillRepository implements IKnowledgeRepository<SkillCanonicalObject> {
  private skills: Map<string, SkillCanonicalObject> = new Map()
  private nameIndex: Map<string, string> = new Map()  // name → id

  constructor() {
    // 初始化加载种子数据
    for (const skill of CORE_SKILLS) {
      this.skills.set(skill.id, skill)
      this.nameIndex.set(skill.name.toLowerCase(), skill.id)
      for (const alias of skill.aliases) {
        this.nameIndex.set(alias.toLowerCase(), skill.id)
      }
    }
  }

  // ─── 基础 CRUD ───

  async getById(id: string): Promise<SkillCanonicalObject | null> {
    return this.skills.get(id) || null
  }

  async search(query: string, filters?: Record<string, unknown>): Promise<SkillCanonicalObject[]> {
    if (!query) return Array.from(this.skills.values())

    const q = query.toLowerCase()
    const results: SkillCanonicalObject[] = []

    for (const skill of this.skills.values()) {
      // 名称匹配
      if (skill.name.toLowerCase().includes(q) || skill.aliases.some(a => a.toLowerCase().includes(q))) {
        results.push(skill)
        continue
      }
      // 描述匹配
      if (skill.description.toLowerCase().includes(q)) {
        results.push(skill)
        continue
      }
      // 分类匹配
      if (skill.category.toLowerCase().includes(q) || skill.subcategory.toLowerCase().includes(q)) {
        results.push(skill)
      }
    }

    // 过滤
    if (filters?.category) {
      return results.filter(s => s.category === filters.category)
    }
    if (filters?.demandLevel) {
      return results.filter(s => s.demandLevel === filters.demandLevel)
    }

    return results
  }

  async create(item: SkillCanonicalObject): Promise<SkillCanonicalObject> {
    this.skills.set(item.id, item)
    this.nameIndex.set(item.name.toLowerCase(), item.id)
    for (const alias of item.aliases) {
      this.nameIndex.set(alias.toLowerCase(), item.id)
    }
    return item
  }

  async update(id: string, patch: Partial<SkillCanonicalObject>): Promise<SkillCanonicalObject> {
    const existing = this.skills.get(id)
    if (!existing) throw new Error(`Skill ${id} not found`)
    const updated = { ...existing, ...patch, updatedAt: new Date().toISOString() }
    this.skills.set(id, updated)
    return updated
  }

  async delete(id: string): Promise<boolean> {
    const skill = this.skills.get(id)
    if (!skill) return false
    this.skills.delete(id)
    this.nameIndex.delete(skill.name.toLowerCase())
    for (const alias of skill.aliases) {
      this.nameIndex.delete(alias.toLowerCase())
    }
    return true
  }

  async count(filters?: Record<string, unknown>): Promise<number> {
    if (!filters) return this.skills.size
    return this.search('', filters).then(r => r.length)
  }

  // ─── 图查询 ───

  /**
   * 按名称或别名查找技能
   */
  findByName(name: string): SkillCanonicalObject | null {
    const id = this.nameIndex.get(name.toLowerCase())
    return id ? (this.skills.get(id) || null) : null
  }

  /**
   * 获取技能的所有边（关系）
   */
  getEdges(skillId: string, type?: string): SkillEdge[] {
    const skill = this.skills.get(skillId)
    if (!skill) return []
    
    const allEdges = [
      ...skill.prerequisites.map(e => ({ ...e, type: 'prerequisite' as const })),
      ...skill.relatedSkills,
      ...skill.nextSkills,
      ...skill.complementary,
    ]
    
    return type ? allEdges.filter(e => e.type === type) : allEdges
  }

  /**
   * 获取前置技能树（递归）
   */
  getPrerequisiteTree(skillId: string, maxDepth: number = 5): SkillTreeNode[] {
    const skill = this.skills.get(skillId)
    if (!skill || maxDepth <= 0) return []
    
    return skill.prerequisites.map(edge => {
      const childSkill = this.skills.get(edge.skillId)
      return {
        skillId: edge.skillId,
        name: childSkill?.name || edge.skillId,
        weight: edge.weight,
        children: this.getPrerequisiteTree(edge.skillId, maxDepth - 1),
      }
    })
  }

  /**
   * 获取推荐学习路径（BFS）
   */
  getLearningPath(skillId: string): string[] {
    const skill = this.skills.get(skillId)
    if (!skill) return []
    
    const path: string[] = []
    const visited = new Set<string>()
    const queue = [...skill.prerequisites.map(e => e.skillId)]
    
    while (queue.length > 0) {
      const current = queue.shift()!
      if (visited.has(current)) continue
      visited.add(current)
      path.push(current)
      
      const currentSkill = this.skills.get(current)
      if (currentSkill) {
        for (const edge of currentSkill.prerequisites) {
          if (!visited.has(edge.skillId)) {
            queue.push(edge.skillId)
          }
        }
      }
    }
    
    return path
  }

  /**
   * 查找两个技能之间的最短路径
   */
  findShortestPath(fromId: string, toId: string): string[] {
    if (fromId === toId) return [fromId]
    
    const visited = new Set<string>()
    const queue: Array<{ id: string; path: string[] }> = [{ id: fromId, path: [fromId] }]
    
    while (queue.length > 0) {
      const { id, path } = queue.shift()!
      if (id === toId) return path
      
      const skill = this.skills.get(id)
      if (!skill) continue
      
      const neighbors = [...skill.nextSkills, ...skill.relatedSkills, ...skill.complementary]
      for (const edge of neighbors) {
        if (!visited.has(edge.skillId)) {
          visited.add(edge.skillId)
          queue.push({ id: edge.skillId, path: [...path, edge.skillId] })
        }
      }
    }
    
    return []  // 无路径
  }

  /**
   * 计算技能差距：从当前技能到目标技能
   */
  calculateGap(currentSkills: string[], targetSkills: string[]): SkillGapResult {
    const gaps: Array<{ skillId: string; name: string; type: 'required' | 'optional' }> = []
    const strengths: string[] = []
    
    for (const targetId of targetSkills) {
      const target = this.skills.get(targetId)
      if (!target) continue
      
      const hasSkill = currentSkills.some(cs => {
        const current = this.findByName(cs)
        return current?.id === targetId || current?.aliases.includes(cs)
      })
      
      if (hasSkill) {
        strengths.push(target.name)
      } else {
        // 检查是否是前置技能（更基础）
        const isPrerequisite = target.prerequisites.length > 0
        gaps.push({
          skillId: targetId,
          name: target.name,
          type: isPrerequisite ? 'required' : 'optional',
        })
      }
    }
    
    return { gaps, strengths }
  }

  /**
   * 获取所有技能（分页）
   */
  getAll(page: number = 1, pageSize: number = 20): SkillCanonicalObject[] {
    const all = Array.from(this.skills.values())
    const start = (page - 1) * pageSize
    return all.slice(start, start + pageSize)
  }

  /**
   * 获取热门技能（按 demandLevel）
   */
  getHotSkills(limit: number = 10): SkillCanonicalObject[] {
    const demandOrder = { critical: 0, high: 1, medium: 2, low: 3 }
    return Array.from(this.skills.values())
      .sort((a, b) => demandOrder[a.demandLevel] - demandOrder[b.demandLevel])
      .slice(0, limit)
  }

  /**
   * 获取技能统计
   */
  getStats() {
    return {
      total: this.skills.size,
      byCategory: this.groupByCategory(),
      byDemand: this.groupByDemand(),
      hotSkills: this.getHotSkills(5).map(s => s.name),
    }
  }

  private groupByCategory(): Record<string, number> {
    const groups: Record<string, number> = {}
    for (const skill of this.skills.values()) {
      groups[skill.category] = (groups[skill.category] || 0) + 1
    }
    return groups
  }

  private groupByDemand(): Record<string, number> {
    const groups: Record<string, number> = {}
    for (const skill of this.skills.values()) {
      groups[skill.demandLevel] = (groups[skill.demandLevel] || 0) + 1
    }
    return groups
  }
}

export interface SkillTreeNode {
  skillId: string
  name: string
  weight: number
  children: SkillTreeNode[]
}

export interface SkillGapResult {
  gaps: Array<{ skillId: string; name: string; type: 'required' | 'optional' }>
  strengths: string[]
}

// ─── 导出单例 ───

let _instance: SkillRepository | null = null

export function getSkillRepository(): SkillRepository {
  if (!_instance) {
    _instance = new SkillRepository()
  }
  return _instance
}

export { SKILL_IDS }
