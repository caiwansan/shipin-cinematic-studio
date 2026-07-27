/**
 * Kunlun Knowledge Hub — Tool Registry & Knowledge Repository Schema
 * 
 * Tool Registry: 所有工具的注册、能力声明、输入输出Schema
 * Knowledge Repository: 知识存储的索引和查询接口
 */

import type { MemoryCanonicalObject, SchemaType } from '../canonical/schemas'

// ─── Tool Registry ───

/** 工具能力声明 */
export interface ToolCapability {
  id: string
  name: string
  description: string
  category: 'search' | 'analysis' | 'matching' | 'extraction' | 'generation' | 'validation'
  
  // 输入输出 Schema（JSON Schema 格式）
  inputSchema: Record<string, unknown>
  outputSchema: Record<string, unknown>
  
  // 权限与限流
  permission: 'public' | 'authenticated' | 'premium'
  rateLimit: {
    requestsPerMinute: number
    concurrent: number
  }
  
  // 依赖
  dependencies: string[]
  
  // 性能
  avgLatencyMs: number
  timeout: number
  
  enabled: boolean
  version: string
  updatedAt: string
}

/** Tool Registry — 全局单例 */
export const TOOL_REGISTRY: Record<string, ToolCapability> = {
  searchJobs: {
    id: 'searchJobs',
    name: '岗位搜索',
    description: '根据条件搜索岗位库',
    category: 'search',
    inputSchema: {
      type: 'object',
      properties: {
        keyword: { type: 'string' },
        city: { type: 'string' },
        salaryMin: { type: 'number' },
        salaryMax: { type: 'number' },
        skills: { type: 'array', items: { type: 'string' } },
        page: { type: 'number', default: 1 },
        pageSize: { type: 'number', default: 20 },
      },
    },
    outputSchema: {
      type: 'object',
      properties: {
        total: { type: 'number' },
        jobs: { type: 'array' },
      },
    },
    permission: 'public',
    rateLimit: { requestsPerMinute: 60, concurrent: 5 },
    dependencies: [],
    avgLatencyMs: 200,
    timeout: 5000,
    enabled: true,
    version: '1.0.0',
    updatedAt: '2024-01-01T00:00:00Z',
  },
  analyzeResume: {
    id: 'analyzeResume',
    name: '简历分析',
    description: '解析简历并提取结构化信息',
    category: 'extraction',
    inputSchema: {
      type: 'object',
      properties: {
        resumeText: { type: 'string' },
        resumeUrl: { type: 'string' },
      },
      oneOf: ['resumeText', 'resumeUrl'],
    },
    outputSchema: {
      type: 'object',
      properties: {
        skills: { type: 'array' },
        experience: { type: 'array' },
        education: { type: 'array' },
        summary: { type: 'string' },
      },
    },
    permission: 'authenticated',
    rateLimit: { requestsPerMinute: 30, concurrent: 3 },
    dependencies: [],
    avgLatencyMs: 500,
    timeout: 10000,
    enabled: true,
    version: '1.0.0',
    updatedAt: '2024-01-01T00:00:00Z',
  },
  calculateSalary: {
    id: 'calculateSalary',
    name: '薪资计算',
    description: '基于市场数据计算岗位/个人薪资范围',
    category: 'analysis',
    inputSchema: {
      type: 'object',
      properties: {
        careerId: { type: 'string' },
        city: { type: 'string' },
        experienceYears: { type: 'number' },
        skills: { type: 'array', items: { type: 'string' } },
      },
    },
    outputSchema: {
      type: 'object',
      properties: {
        range: { type: 'object' },
        confidence: { type: 'number' },
        factors: { type: 'array' },
      },
    },
    permission: 'public',
    rateLimit: { requestsPerMinute: 60, concurrent: 10 },
    dependencies: [],
    avgLatencyMs: 100,
    timeout: 3000,
    enabled: true,
    version: '1.0.0',
    updatedAt: '2024-01-01T00:00:00Z',
  },
  analyzeSkills: {
    id: 'analyzeSkills',
    name: '技能图谱分析',
    description: '分析技能差距、推荐学习路径',
    category: 'analysis',
    inputSchema: {
      type: 'object',
      properties: {
        currentSkills: { type: 'array', items: { type: 'string' } },
        targetCareerId: { type: 'string' },
      },
      required: ['currentSkills', 'targetCareerId'],
    },
    outputSchema: {
      type: 'object',
      properties: {
        gaps: { type: 'array' },
        strengths: { type: 'array' },
        learningPath: { type: 'array' },
        timeEstimate: { type: 'string' },
      },
    },
    permission: 'authenticated',
    rateLimit: { requestsPerMinute: 30, concurrent: 5 },
    dependencies: [],
    avgLatencyMs: 300,
    timeout: 5000,
    enabled: true,
    version: '1.0.0',
    updatedAt: '2024-01-01T00:00:00Z',
  },
  matchJobs: {
    id: 'matchJobs',
    name: '岗位匹配',
    description: '基于候选人画像匹配最佳岗位',
    category: 'matching',
    inputSchema: {
      type: 'object',
      properties: {
        candidateId: { type: 'string' },
        topN: { type: 'number', default: 10 },
      },
      required: ['candidateId'],
    },
    outputSchema: {
      type: 'object',
      properties: {
        matches: { type: 'array' },
      },
    },
    permission: 'authenticated',
    rateLimit: { requestsPerMinute: 20, concurrent: 3 },
    dependencies: ['analyzeSkills'],
    avgLatencyMs: 500,
    timeout: 8000,
    enabled: true,
    version: '1.0.0',
    updatedAt: '2024-01-01T00:00:00Z',
  },
  recallMemory: {
    id: 'recallMemory',
    name: '记忆召回',
    description: '从 Agent Memory 中检索相关记忆',
    category: 'search',
    inputSchema: {
      type: 'object',
      properties: {
        userId: { type: 'string' },
        query: { type: 'string' },
        layer: { type: 'string', enum: ['working', 'short', 'long', 'all'] },
        topK: { type: 'number', default: 5 },
      },
      required: ['userId', 'query'],
    },
    outputSchema: {
      type: 'object',
      properties: {
        memories: { type: 'array' },
      },
    },
    permission: 'authenticated',
    rateLimit: { requestsPerMinute: 100, concurrent: 10 },
    dependencies: [],
    avgLatencyMs: 50,
    timeout: 2000,
    enabled: true,
    version: '1.0.0',
    updatedAt: '2024-01-01T00:00:00Z',
  },
}

// ─── Knowledge Repository 接口 ───

/** 知识查询接口（所有 Knowledge 模块实现此接口） */
export interface IKnowledgeRepository<T> {
  getById(id: string): Promise<T | null>
  search(query: string, filters?: Record<string, unknown>): Promise<T[]>
  create(item: T): Promise<T>
  update(id: string, patch: Partial<T>): Promise<T>
  delete(id: string): Promise<boolean>
  count(filters?: Record<string, unknown>): Promise<number>
}

/** 知识索引条目（用于全文搜索） */
export interface KnowledgeIndexEntry {
  entityId: string
  entityType: SchemaType
  title: string
  aliases: string[]
  description: string
  tags: string[]
  updatedAt: string
  searchText: string    // 拼接后的全文搜索文本
}

/** 图查询接口 */
export interface IKnowledgeGraph {
  getNode(id: string): Promise<unknown | null>
  getEdges(nodeId: string, type?: string): Promise<Array<{ targetId: string; weight: number; type: string }>>
  findPath(fromId: string, toId: string, maxDepth?: number): Promise<string[]>
  getRelated(id: string, depth?: number): Promise<Array<{ id: string; distance: number; path: string[] }>>
  calculateDistance(fromSkills: string[], toSkills: string[]): Promise<number>
}

/** Memory 接口 */
export interface IMemoryEngine {
  // 写入
  remember(userId: string, memory: Omit<MemoryCanonicalObject, 'id' | 'createdAt' | 'updatedAt'>): Promise<MemoryCanonicalObject>
  
  // 召回
  recall(userId: string, query: string, options?: { layer?: string; topK?: number }): Promise<MemoryCanonicalObject[]>
  
  // 遗忘（过期/冲突记忆）
  forget(memoryId: string): Promise<boolean>
  
  // 巩固（短期→长期）
  consolidate(userId: string): Promise<number>
  
  // 获取工作记忆
  getWorkingMemory(userId: string): Promise<MemoryCanonicalObject[]>
}

