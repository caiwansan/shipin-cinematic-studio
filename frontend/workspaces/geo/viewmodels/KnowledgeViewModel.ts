/**
 * KnowledgeViewModel — 统一 ViewModel 层
 *
 * Knowledge 页面的所有 UI 状态和 KPI 都从这里输出。
 * 组件只负责渲染 ViewModel，不写条件逻辑。
 *
 * Note: objects/searchQuery 已迁移至 KnowledgeBrowserVM。
 * KnowledgeVM 保留 browser 字段引用。
 */

import type { useKnowledgeStore } from '../stores/useKnowledgeStore'
import type { KnowledgeBrowserVM } from './KnowledgeBrowserVM'
import { buildBrowserVM } from './KnowledgeBrowserVM'

export type KnowledgeStatus = 'idle' | 'loading' | 'editing' | 'completed' | 'empty' | 'error'

export interface KnowledgeVM {
  /** 统一状态 */
  status: KnowledgeStatus
  /** 错误信息 */
  error: string | null
  /** 品牌名 */
  brandName: string

  // ── Hero Header ──
  hero: {
    brandName: string
    knowledgeScore: number
    objectsCoverage: number
    lastUpdate: string
    statusText: string
    isRunning: boolean
    isCompleted: boolean
    actions: {
      import: boolean
      create: boolean
      refresh: boolean
    }
  }

  // ── Snapshot ──
  snapshot: {
    knowledgeScore: number
    objectsTotal: number
    coveragePercent: number
    verifiedCount: number
    publishedCount: number
  }

  // ── Search (legacy — delegates to browserVM) ──
  searchQuery: string

  // ── Browser (replaces objects) ──
  browser: KnowledgeBrowserVM

  // ── Bottom CTA ──
  cta: {
    label: string
    action: 'import' | 'create' | 'goto-discovery' | 'goto-optimization' | 'noop'
    visible: boolean
  }
}

export function buildEmptyVM(brandName?: string): KnowledgeVM {
  return {
    status: 'empty',
    error: null,
    brandName: brandName || '—',
    hero: {
      brandName: brandName || '—',
      knowledgeScore: 0,
      objectsCoverage: 0,
      lastUpdate: '—',
      statusText: brandName ? 'Ready to Build' : 'No Brand Selected',
      isRunning: false,
      isCompleted: false,
      actions: { import: !!brandName, create: !!brandName, refresh: false },
    },
    snapshot: { knowledgeScore: 0, objectsTotal: 0, coveragePercent: 0, verifiedCount: 0, publishedCount: 0 },
    searchQuery: '',
    browser: buildBrowserVM(
      { filteredStatements: [], searchQuery: '' } as any,
      'all',
      'recent',
    ),
    cta: {
      label: brandName ? 'Import Knowledge' : 'Create Brand',
      action: brandName ? 'import' : 'goto-discovery',
      visible: true,
    },
  }
}

export function buildLoadingVM(brandName: string): KnowledgeVM {
  return {
    status: 'loading',
    error: null,
    brandName,
    hero: {
      brandName,
      knowledgeScore: 0,
      objectsCoverage: 0,
      lastUpdate: '—',
      statusText: 'Loading…',
      isRunning: true,
      isCompleted: false,
      actions: { import: false, create: false, refresh: false },
    },
    snapshot: { knowledgeScore: 0, objectsTotal: 0, coveragePercent: 0, verifiedCount: 0, publishedCount: 0 },
    searchQuery: '',
    browser: buildBrowserVM(
      { filteredStatements: [], searchQuery: '' } as any,
      'all',
      'recent',
    ),
    cta: {
      label: 'Loading…',
      action: 'noop',
      visible: false,
    },
  }
}

export function buildCompletedVM(
  store: ReturnType<typeof useKnowledgeStore>,
  brandName: string,
): KnowledgeVM {
  const assets = store.assets
  const coverage = store.coverage
  const freshness = store.freshness

  const knowledgeScore = coverage.percentage
  const objectsTotal = assets.knowledgeObjects || assets.total
  const coveragePercent = coverage.percentage
  const verifiedCount = store.verifiedStatements.length
  const publishedCount = objectsTotal

  const lastUpdate = freshness?.lastUpdated
    ? freshness.lastUpdated.split('T')[0]
    : '—'

  // Filtered objects
  const allObjects = store.filteredStatements.map(s => ({
    id: s.id,
    content: s.content,
    category: s.category,
    status: s.status as 'verified' | 'pending' | 'outdated',
  }))

  return {
    status: store.isEditing ? 'editing' : 'completed',
    error: null,
    brandName,
    hero: {
      brandName,
      knowledgeScore,
      objectsCoverage: coveragePercent,
      lastUpdate,
      statusText: 'Completed',
      isRunning: false,
      isCompleted: true,
      actions: { import: true, create: true, refresh: true },
    },
    snapshot: {
      knowledgeScore,
      objectsTotal,
      coveragePercent,
      verifiedCount,
      publishedCount,
    },
    searchQuery: store.searchQuery,
    browser: buildBrowserVM(store, 'all', 'recent'),
    cta: {
      label: 'Continue to Optimization',
      action: 'goto-optimization',
      visible: true,
    },
  }
}

export function buildErrorVM(brandName: string, error: string): KnowledgeVM {
  return {
    status: 'error',
    error,
    brandName,
    hero: {
      brandName,
      knowledgeScore: 0,
      objectsCoverage: 0,
      lastUpdate: '—',
      statusText: 'Failed',
      isRunning: false,
      isCompleted: false,
      actions: { import: false, create: false, refresh: true },
    },
    snapshot: { knowledgeScore: 0, objectsTotal: 0, coveragePercent: 0, verifiedCount: 0, publishedCount: 0 },
    searchQuery: '',
    browser: buildBrowserVM(
      { filteredStatements: [], searchQuery: '' } as any,
      'all',
      'recent',
    ),
    cta: {
      label: 'Retry',
      action: 'goto-discovery',
      visible: true,
    },
  }
}
