/**
 * BrandHealth Store — 品牌健康 Pinia Store
 *
 * 管理 BrandHealthReport 状态，可被任何页面消费。
 * 替换旧的 useHealthStore（基于 health/:id 的映射）。
 */
import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { fetchBrandHealth } from '../services/brandHealthService'
import type { BrandHealthReport } from '../types/brand-health'

export const useBrandHealthStore = defineStore('geo-brand-health', () => {
  // ── State ──
  const report = ref<BrandHealthReport | null>(null)
  const isLoading = ref<boolean>(false)
  const error = ref<string | null>(null)
  const lastUpdated = ref<number | null>(null)
  const projectId = ref<string>('')

  // ── Getters ──
  const hasReport = computed(() => report.value !== null && report.value.brandName !== '')

  /** 整体健康分 */
  const overallScore = computed(() => report.value?.overallScore ?? 0)

  /** 分数变化 */
  const scoreChange = computed(() => report.value?.scoreChange ?? 0)

  /** 趋势 */
  const trend = computed(() => report.value?.trend ?? 'stable')

  /** 品牌名称 */
  const brandName = computed(() => report.value?.brandName ?? '')

  /** 风险数量 */
  const riskCount = computed(() => report.value?.topRisks.length ?? 0)

  /** 机会数量 */
  const opportunityCount = computed(() => report.value?.topOpportunities.length ?? 0)

  /** 维度列表 */
  const dimensions = computed(() => report.value?.dimensions ?? [])

  /** 健康标签文字 */
  const healthLabel = computed(() => {
    const score = overallScore.value
    if (score >= 80) return '优秀'
    if (score >= 60) return '良好'
    if (score >= 40) return '需要关注'
    return '亟需改善'
  })

  /** 健康标签颜色 class */
  const healthLabelClass = computed(() => {
    const score = overallScore.value
    if (score >= 80) return 'text-green-600 bg-green-100'
    if (score >= 60) return 'text-yellow-600 bg-yellow-100'
    if (score >= 40) return 'text-orange-600 bg-orange-100'
    return 'text-red-600 bg-red-100'
  })

  // ── Actions ──

  /**
   * 加载品牌健康报告
   */
  async function loadBrandHealth(id: string): Promise<void> {
    projectId.value = id
    isLoading.value = true
    error.value = null

    try {
      const data = await fetchBrandHealth(id)
      report.value = data
      lastUpdated.value = Date.now()
    } catch (err) {
      error.value = err instanceof Error ? err.message : '加载品牌健康报告失败'
      report.value = null
    } finally {
      isLoading.value = false
    }
  }

  /**
   * 刷新当前项目的数据
   */
  async function refresh(): Promise<void> {
    if (projectId.value) {
      await loadBrandHealth(projectId.value)
    }
  }

  /**
   * 设置项目 ID 并加载
   */
  function setProject(id: string): void {
    projectId.value = id
  }

  return {
    // State
    report,
    isLoading,
    error,
    lastUpdated,
    projectId,

    // Getters
    hasReport,
    overallScore,
    scoreChange,
    trend,
    brandName,
    riskCount,
    opportunityCount,
    dimensions,
    healthLabel,
    healthLabelClass,

    // Actions
    loadBrandHealth,
    refresh,
    setProject,
  }
})
