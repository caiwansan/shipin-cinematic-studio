/**
 * Walkthrough Service — Progressive Walkthrough API
 * RC1-T003
 *
 * SSOT: WalkthroughEngine (backend)
 * No localStorage business state.
 * No page-level guide logic.
 */
import { geoApi } from './api'

export interface GuideInfo {
  step: 'discovery' | 'explain' | 'action_plan' | 'verification' | null
  message: string
  nextAction: string
  nextUrl: string
}

export interface WalkthroughState {
  showWelcomeCard: boolean
  activeGuide: GuideInfo | null
  dismissed: boolean
  completed: boolean
}

export const walkthroughService = {
  async getState(): Promise<WalkthroughState> {
    const res = await geoApi<{ success: boolean; data: WalkthroughState }>('/walkthrough/state')
    return res.data
  },

  async dismiss(): Promise<void> {
    await geoApi('/walkthrough/dismiss', { method: 'POST' })
  },

  async complete(): Promise<void> {
    await geoApi('/walkthrough/complete', { method: 'POST' })
  },

  async restart(): Promise<WalkthroughState> {
    const res = await geoApi<{ success: boolean; data: WalkthroughState }>('/walkthrough/restart', { method: 'POST' })
    return res.data
  },
}
