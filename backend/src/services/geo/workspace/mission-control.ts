// ============================================================
// ★ P0-2 / P0-3 / P0-6: Mission Control — Repository-Backed (no Memory Truth)
//
// All Dashboard data comes from MissionControlRepository → ScoreSnapshot table.
// In-memory stores (ObservatoryStore, MissionQueue, etc.) are
// NOT used as truth sources. They may only serve as cache.
//
// SSOT Chain:  Dashboard → MissionControlRepository → ScoreSnapshot
// DTO:         shared/dto/mission-control.dto.ts (唯一来源)
// ============================================================

import { missionControlRepository } from '../repositories/mission-control.repository.js'
import type { MissionControlDTO } from '../../../../../shared/dto/mission-control.dto.js'

const ENGINE_INFO: Record<string, { label: string; icon: string }> = {
  discovery: { label: '品牌识别', icon: '🔍' },
  knowledge: { label: '知识覆盖', icon: '📚' },
  recommendation: { label: '优化建议', icon: '💡' },
  mission: { label: '待办任务', icon: '🎯' },
  verification: { label: '验证确认', icon: '✅' },
  publishing: { label: '发布成果', icon: '📤' },
  learning: { label: '持续学习', icon: '🧠' },
}

export async function getMissionControl(projectId?: string): Promise<MissionControlDTO> {
  // ★ P0-6: Single call to MissionControlRepository
  const dash = await missionControlRepository.loadDashboard(projectId)

  // ── Engine states derived from ScoreSnapshot presence ──
  const hasSnapshot = dash.snapshotCount > 0
  const engines: MissionControlDTO['engines'] = [
    {
      name: 'discovery',
      label: '品牌识别',
      status: hasSnapshot ? 'completed' : 'idle',
      detail: hasSnapshot ? '已建立品牌档案' : '等待品牌创建',
      updatedAt: dash.latestSnapshot?.createdAt || null,
    },
    {
      name: 'knowledge',
      label: '知识覆盖',
      status: 'idle' as const,
      detail: hasSnapshot ? '等待补充品牌知识' : '等待品牌创建',
      updatedAt: null,
    },
    {
      name: 'recommendation',
      label: '优化建议',
      status: hasSnapshot ? 'completed' as const : 'idle' as const,
      detail: hasSnapshot ? '已生成初始建议' : '等待品牌创建',
      updatedAt: null,
    },
    {
      name: 'mission',
      label: '待办任务',
      status: hasSnapshot ? 'completed' as const : 'idle' as const,
      detail: hasSnapshot ? '有待办任务' : '等待品牌创建',
      updatedAt: null,
    },
    {
      name: 'verification',
      label: '验证确认',
      status: 'idle' as const,
      detail: '等待执行优化',
      updatedAt: null,
    },
    {
      name: 'publishing',
      label: '发布成果',
      status: 'idle' as const,
      detail: '等待验证通过',
      updatedAt: null,
    },
    {
      name: 'learning',
      label: '持续学习',
      status: 'idle' as const,
      detail: '收集中',
      updatedAt: null,
    },
  ]

  // ── Recent Activity → TimelineEvent DTO ──
  const recentActivity: MissionControlDTO['recentActivity'] = dash.recentActivity.map((e: any) => ({
    id: e.eventId,
    title: e.title || '',
    detail: e.detail || '',
    level: (e.level ?? 'info') as 'info' | 'warning' | 'error' | 'success',
    route: e.eventType === 'RECOMMENDATION_GENERATED' ? '/workspace/geo/knowledge' : undefined,
    timestamp: e.createdAt,
  }))

  // ── Actionable Items ──
  const actionableItems: MissionControlDTO['actionableItems'] = recentActivity
    .filter((e: any) => e.title?.includes('完善') || e.title?.includes('创建'))
    .slice(0, 3)

  // ── Return ──
  return {
    projectId: dash.projectId,
    entityName: dash.entityName,
    aiVisibility: dash.aiVisibility,
    todayGoal: dash.todayGoal,
    engines,
    lastExecution: dash.latestSnapshot
      ? { id: dash.latestSnapshot.id, durationMs: 0, timestamp: dash.latestSnapshot.createdAt }
      : null,
    queues: { mission: 0, verification: 0, publishing: 0, learning: 0 },
    recentActivity,
    actionableItems,
    runtimeHealth: dash.runtimeHealth,
  }
}
