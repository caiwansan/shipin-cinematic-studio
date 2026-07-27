/**
 * Phase 3-B2: Career Repository — 职业知识存储与查询
 * 
 * 20个核心职业，覆盖昆仑镜所有工作台：
 * AI(6) / 软件(5) / 内容(4) / 创意(4) / 商业(2)
 */

import type { CareerCanonicalObject, CareerFit, CareerTrans, LearningLink, SalaryReference, GrowthDataPoint } from '../../canonical/schemas'
import { CORE_CAREERS, CAREER_IDS } from './career-seed'

export class CareerRepository {
  private careers: Map<string, CareerCanonicalObject> = new Map()
  private nameIndex: Map<string, string> = new Map()

  constructor() {
    for (const career of CORE_CAREERS) {
      this.careers.set(career.id, career)
      this.nameIndex.set(career.name.toLowerCase(), career.id)
      for (const alias of career.aliases) {
        this.nameIndex.set(alias.toLowerCase(), career.id)
      }
    }
  }

  // ─── 基础 CRUD ───

  async getById(id: string): Promise<CareerCanonicalObject | null> {
    return this.careers.get(id) || null
  }

  async search(query: string, filters?: Record<string, unknown>): Promise<CareerCanonicalObject[]> {
    if (!query) return Array.from(this.careers.values())

    const q = query.toLowerCase()
    const results: CareerCanonicalObject[] = []

    for (const career of this.careers.values()) {
      if (
        career.name.toLowerCase().includes(q) ||
        career.aliases.some(a => a.toLowerCase().includes(q)) ||
        career.description.toLowerCase().includes(q) ||
        career.category.toLowerCase().includes(q) ||
        career.subcategory.toLowerCase().includes(q)
      ) {
        results.push(career)
      }
    }

    if (filters?.category) {
      return results.filter(c => c.category === filters.category)
    }
    if (filters?.subcategory) {
      return results.filter(c => c.subcategory === filters.subcategory)
    }

    return results
  }

  async count(filters?: Record<string, unknown>): Promise<number> {
    if (!filters) return this.careers.size
    return this.search('', filters).then(r => r.length)
  }

  // ─── 查询 ───

  findByName(name: string): CareerCanonicalObject | null {
    const id = this.nameIndex.get(name.toLowerCase())
    return id ? (this.careers.get(id) || null) : null
  }

  /**
   * 获取职业薪资（按级别）
   */
  getSalaryByLevel(careerId: string, level: string): SalaryReference | null {
    const career = this.careers.get(careerId)
    if (!career) return null
    return career.salaryByLevel.find(s => s.level === level) || null
  }

  /**
   * 获取增长趋势
   */
  getGrowthTrend(careerId: string): GrowthDataPoint[] {
    const career = this.careers.get(careerId)
    return career?.growthTrend || []
  }

  /**
   * 获取能力画像
   */
  getFitProfile(careerId: string): CareerFit | null {
    const career = this.careers.get(careerId)
    return career?.fitProfile || null
  }

  /**
   * 获取职业迁移路径
   */
  getTransitions(careerId: string): CareerTrans[] {
    const career = this.careers.get(careerId)
    return career?.transitions || []
  }

  /**
   * 获取学习资源
   */
  getLearningLinks(careerId: string): LearningLink[] {
    const career = this.careers.get(careerId)
    return career?.learningLinks || []
  }

  /**
   * 获取热门职业（按需求指数）
   */
  getHotCareers(limit: number = 10): CareerCanonicalObject[] {
    return Array.from(this.careers.values())
      .sort((a, b) => {
        const aDemand = a.growthTrend[0]?.demandIndex || 0
        const bDemand = b.growthTrend[0]?.demandIndex || 0
        return bDemand - aDemand
      })
      .slice(0, limit)
  }

  /**
   * 获取所有职业（分页）
   */
  getAll(page: number = 1, pageSize: number = 20): CareerCanonicalObject[] {
    const all = Array.from(this.careers.values())
    const start = (page - 1) * pageSize
    return all.slice(start, start + pageSize)
  }

  /**
   * 获取职业统计
   */
  getStats() {
    return {
      total: this.careers.size,
      byCategory: this.groupByCategory(),
      hotCareers: this.getHotCareers(5).map(c => c.name),
      totalTransitions: Array.from(this.careers.values()).reduce((sum, c) => sum + c.transitions.length, 0),
      totalLearningLinks: Array.from(this.careers.values()).reduce((sum, c) => sum + c.learningLinks.length, 0),
    }
  }

  private groupByCategory(): Record<string, number> {
    const groups: Record<string, number> = {}
    for (const career of this.careers.values()) {
      groups[career.category] = (groups[career.category] || 0) + 1
    }
    return groups
  }
}

let _instance: CareerRepository | null = null

export function getCareerRepository(): CareerRepository {
  if (!_instance) {
    _instance = new CareerRepository()
  }
  return _instance
}

export { CAREER_IDS }
