/**
 * Dashboard Mission Service — API Layer for Dashboard Mission Control
 *
 * Endpoints:
 *   GET /dashboard/mission — Mission Control data
 */
import { geoApi } from './api'

export interface DashboardMission {
  todayProgress: {
    totalSteps: number
    completedSteps: number
    progressPercent: number
    steps: Array<{ label: string; done: boolean; icon: string }>
  }
  continueJourney: {
    projectId: string
    projectName: string
    currentStep: string
    nextStep: string
    nextStepUrl: string
    canContinue: boolean
  } | null
  prioritizedProjects: Array<{
    id: string
    name: string
    priority: number
    priorityLabel: string
    status: string
    adi: number
    currentStep: string
    continueUrl: string
  }>
  recentActivities: Array<{
    type: string
    label: string
    projectName: string
    timestamp: string
    relativeTime: string
  }>
  systemHealth: {
    aiPresenceCount: number
    aiPresenceTotal: number
    lastScanAt: string
    lastScanRelative: string
    apiHealthy: boolean
  }
}

export async function getDashboardMission(): Promise<DashboardMission> {
  const res = await geoApi<{ success: boolean; data: DashboardMission }>('/dashboard/mission')
  return res.data
}
