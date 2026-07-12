/**
 * Timeline Repository — SSOT for all activity data
 *
 * Architecture constraint: This is the ONLY source of activity data.
 * No component may maintain its own activity array.
 *
 * Data flow:
 *   API/Fetch → TimelineRepository (append/patch/remove) → Reactive State → UI
 *   EventBus events → TimelineRepository (append/reconcile) → Reactive State → UI
 *
 * Part of RC1-UI-003 Timeline Integration.
 */

import { ref, computed, shallowRef, type Ref } from '#imports'
import { useEventBus } from '../composables/useEventBus'
import { useAuthStore } from '../stores/useAuthStore'
import type { EventPayloads } from '../lib/events'

// ── Timeline Event DTO ──

export interface TimelineEvent {
  id: string
  type: 'presence_check' | 'verification' | 'claim' | 'evidence' | 'mission' | 'task' | 'system'
  title: string
  description?: string
  source?: string
  status?: string
  projectName?: string
  projectId?: string
  timestamp: string
  relativeTime?: string
  icon?: string
  metadata?: Record<string, any>
}

export type TimelineState = 'idle' | 'loading' | 'ready' | 'empty' | 'error' | 'syncing'

// ── Event → Timeline icon mapping ──

const EVENT_ICON_MAP: Record<string, string> = {
  'MISSION:APPEND': '📌',
  'TASK:FINISHED': '✅',
  'TASK:STARTED': '▶️',
  'TASK:UPDATED': '🔄',
  'MISSION:LOADING': '⏳',
  'MISSION:LOADED': '✅',
  'MISSION:ERROR': '❌',
  'SYSTEM:READY': '🚀',
  'SYSTEM:ERROR': '⚠️',
}

const EVENT_TYPE_MAP: Record<string, TimelineEvent['type']> = {
  'MISSION:APPEND': 'mission',
  'MISSION:LOADING': 'mission',
  'MISSION:LOADED': 'mission',
  'MISSION:ERROR': 'mission',
  'TASK:STARTED': 'task',
  'TASK:UPDATED': 'task',
  'TASK:FINISHED': 'task',
  'SYSTEM:READY': 'system',
  'SYSTEM:ERROR': 'system',
}

// ── Singleton instance ──
// Single source of truth — only one TimelineRepository exists per app lifetime.

let _instance: TimelineRepository | null = null

export function getTimelineRepository(): TimelineRepository {
  if (!_instance) {
    _instance = new TimelineRepository()
  }
  return _instance
}

export class TimelineRepository {
  private _events = shallowRef<TimelineEvent[]>([])
  private _state = ref<TimelineState>('idle')
  private _error = ref<string>('')
  private _eventBus: ReturnType<typeof useEventBus>
  private _unsubscribers: Array<() => void> = []
  private _loaded = false

  // ── Reactive state (read-only) ──

  get events(): Ref<TimelineEvent[]> {
    return this._events as Ref<TimelineEvent[]>
  }

  get state(): Ref<TimelineState> {
    return this._state as Ref<TimelineState>
  }

  get error(): Ref<string> {
    return this._error as Ref<string>
  }

  // ── Computed helpers ──

  get recentEvents() {
    return computed(() =>
      [...this._events.value]
        .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
        .slice(0, 20),
    )
  }

  get recentActivities() {
    return computed(() =>
      [...this._events.value]
        .filter(e => ['presence_check', 'verification', 'mission', 'task'].includes(e.type))
        .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
        .slice(0, 10),
    )
  }

  get recentMissions() {
    return computed(() =>
      [...this._events.value]
        .filter(e => e.type === 'mission' || e.type === 'task')
        .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
        .slice(0, 5),
    )
  }

  constructor() {
    this._eventBus = useEventBus('timeline-repository')
    this._bindEvents()
  }

  // ── Public methods ──

  async fetch(projectId?: string, limit = 50): Promise<void> {
    this._state.value = this._events.value.length > 0 ? 'syncing' : 'loading'
    this._error.value = ''

    try {
      // Primary data source: GET /api/geo/timeline (Timeline Engine)
      // Fallback: dashboard service (legacy)
      const results: TimelineEvent[] = []

      if (projectId) {
        // Try new Timeline Engine API first
        const token = useAuthStore().getToken()
        const headers: Record<string, string> = token ? { Authorization: `Bearer ${token}` } : {}
        const resp = await fetch(`/api/geo/timeline?projectId=${encodeURIComponent(projectId)}&limit=${limit}`, { headers })
        if (resp.ok) {
          const body = await resp.json()
          if (body.success && Array.isArray(body.data)) {
            const mappedEvents = body.data.map((e: any) => this._normalizeEngineEvent(e))
            results.push(...mappedEvents)
          }
        }

        // If no data from engine, try legacy dashboard API
        if (results.length === 0) {
          const { getTimelineEvents } = await import('../services/dashboardService')
          const dashboardEvents = await getTimelineEvents(projectId, limit)
          results.push(...dashboardEvents.map(e => this._normalizeTimelineEvent(e)))
        }
      }

      // Also fetch dashboard mission for activity feed
      try {
        const { getDashboardMission } = await import('../services/dashboardMissionService')
        const mission = await getDashboardMission()
        if (mission?.recentActivities) {
          results.push(
            ...mission.recentActivities.map(a => this._normalizeActivity(a)),
          )
        }
      } catch {
        // Dashboard mission is optional — fails gracefully
      }

      if (results.length === 0) {
        this._events.value = []
        this._state.value = 'empty'
      } else {
        // Deduplicate by id
        const seen = new Set<string>()
        const deduped = results.filter(e => {
          if (seen.has(e.id)) return false
          seen.add(e.id)
          return true
        })

        // Merge with existing events, dedupe across batches
        const existingIds = new Set(this._events.value.map(e => e.id))
        for (const event of deduped) {
          if (!existingIds.has(event.id)) {
            this._events.value = [...this._events.value, event]
            existingIds.add(event.id)
          }
        }

        this._events.value.sort(
          (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime(),
        )

        this._state.value = 'ready'
      }

      this._loaded = true
    } catch (err: any) {
      this._error.value = err?.message || 'Failed to load timeline'
      this._state.value = this._events.value.length > 0 ? 'ready' : 'error'
    }
  }

  append(event: Omit<TimelineEvent, 'id' | 'timestamp'> & { id?: string; timestamp?: string }): void {
    const newEvent: TimelineEvent = {
      id: event.id || `tl-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      ...event,
      timestamp: event.timestamp || new Date().toISOString(),
    }

    // Deduplicate
    if (this._events.value.some(e => e.id === newEvent.id)) return

    this._events.value = [newEvent, ...this._events.value]
    if (this._state.value === 'empty') {
      this._state.value = 'ready'
    }
  }

  update(id: string, patch: Partial<TimelineEvent>): void {
    this._events.value = this._events.value.map(e =>
      e.id === id ? { ...e, ...patch } : e,
    )
  }

  remove(id: string): void {
    this._events.value = this._events.value.filter(e => e.id !== id)
    if (this._events.value.length === 0) {
      this._state.value = 'empty'
    }
  }

  clear(): void {
    this._events.value = []
    this._state.value = 'empty'
  }

  reset(): void {
    this.clear()
    this._error.value = ''
    this._loaded = false
  }

  destroy(): void {
    this._unsubscribers.forEach(fn => fn())
    this._unsubscribers = []
    _instance = null
  }

  // ── Private ──

  private _bindEvents(): void {
    const eventsToListen: Array<keyof EventPayloads> = [
      'TASK:STARTED',
      'TASK:UPDATED',
      'TASK:FINISHED',
      'MISSION:APPEND',
      'MISSION:LOADING',
      'MISSION:LOADED',
      'MISSION:ERROR',
      'SYSTEM:ERROR',
      'SYSTEM:READY',
    ]

    for (const eventName of eventsToListen) {
      const unsub = this._eventBus.on(eventName as any, (payload: any) => {
        this._handleEvent(eventName as string, payload)
      })
      this._unsubscribers.push(unsub)
    }
  }

  private _handleEvent(eventName: string, payload: any): void {
    const icon = EVENT_ICON_MAP[eventName] || '📌'
    const type = EVENT_TYPE_MAP[eventName] || 'system'
    const title = this._eventTitle(eventName, payload)
    const now = new Date().toISOString()

    this.append({
      id: `${eventName}-${payload?.taskId || payload?.timestamp || Date.now()}`,
      type,
      title,
      icon,
      status: eventName.includes('FAILED') || eventName === 'SYSTEM:ERROR' ? 'error' : 'success',
      timestamp: payload?.timestamp || now,
      metadata: payload || {},
    })
  }

  private _eventTitle(eventName: string, payload: any): string {
    switch (eventName) {
      case 'TASK:STARTED': return `任务开始：${payload?.type || payload?.taskId || ''}`
      case 'TASK:UPDATED': return `任务更新：${payload?.currentStep || payload?.status || ''}`
      case 'TASK:FINISHED': return `任务完成：${payload?.result || ''}`
      case 'MISSION:APPEND': return payload?.title || 'Mission 更新'
      case 'MISSION:LOADING': return '加载 Dashboard ...'
      case 'MISSION:LOADED': return `Dashboard 已加载${payload?.missionId ? ' (' + payload.missionId + ')' : ''}`
      case 'MISSION:ERROR': return `加载失败：${payload?.message || ''}`
      case 'SYSTEM:READY': return '系统就绪'
      case 'SYSTEM:ERROR': return `系统错误：${payload?.message || ''}`
      default: return `${eventName}: ${JSON.stringify(payload).slice(0, 40)}`
    }
  }

  private _normalizeTimelineEvent(e: any): TimelineEvent {
    return {
      id: e.id || `tl-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      type: e.type || 'system',
      title: e.title || '',
      description: e.description,
      source: e.source,
      status: e.status,
      projectName: (e as any).projectName,
      projectId: (e as any).projectId,
      timestamp: e.date || e.timestamp || new Date().toISOString(),
      relativeTime: this._relativeTime(e.date || e.timestamp),
      icon: EVENT_ICON_MAP[e.type] || '📌',
    }
  }

  /**
   * Normalize backend Timeline Engine event → frontend TimelineEvent
   */
  private _normalizeEngineEvent(e: any): TimelineEvent {
    const eventType = e.eventType || 'system'
    return {
      id: e.id,
      type: eventType as TimelineEvent['type'],
      title: e.title || '',
      description: e.detail || '',
      status: e.level === 'error' ? 'error' : e.level === 'success' ? 'success' : undefined,
      projectId: e.projectId,
      timestamp: e.timestamp || new Date().toISOString(),
      relativeTime: this._relativeTime(e.timestamp),
      metadata: e.metadata,
    }
  }

  private _normalizeActivity(a: any): TimelineEvent {
    return {
      id: `act-${a.timestamp || Date.now()}`,
      type: (a.type as TimelineEvent['type']) || 'mission',
      title: a.label || '',
      projectName: a.projectName,
      timestamp: a.timestamp || new Date().toISOString(),
      relativeTime: a.relativeTime || this._relativeTime(a.timestamp),
      icon: a.icon || '📌',
    }
  }

  private _relativeTime(timestamp?: string): string {
    if (!timestamp) return ''
    const diff = Date.now() - new Date(timestamp).getTime()
    const seconds = Math.floor(diff / 1000)
    if (seconds < 60) return '刚刚'
    const minutes = Math.floor(seconds / 60)
    if (minutes < 60) return `${minutes} 分钟前`
    const hours = Math.floor(minutes / 60)
    if (hours < 24) return `${hours} 小时前`
    const days = Math.floor(hours / 24)
    if (days < 30) return `${days} 天前`
    return new Date(timestamp).toLocaleDateString('zh-CN')
  }
}
