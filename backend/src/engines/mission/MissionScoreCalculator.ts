import { ActionPriority } from './models/ActionPriority'
import { MissionPriority } from './models/MissionPriority'

export class MissionScoreCalculator {
  static calculate(input: { priority: ActionPriority; impactPercentage: number }): { priorityScore: number; missionPriority: MissionPriority } {
    const { priority, impactPercentage } = input
    let score: number
    switch (priority) {
      case 'Critical': score = 90 + Math.min(Math.floor(impactPercentage / 2), 10); break
      case 'High':     score = 70 + Math.min(Math.floor(impactPercentage / 2), 15); break
      case 'Urgent':   score = 65 + Math.min(Math.floor(impactPercentage / 3), 15); break
      case 'Medium':   score = 45 + Math.min(Math.floor(impactPercentage / 2), 15); break
      case 'Low':      score = 15 + Math.min(Math.floor(impactPercentage / 3), 15); break
      default:         score = 20; break
    }
    const missionPriority: MissionPriority = score >= 70 ? 'P0' : score >= 50 ? 'P1' : score >= 30 ? 'P2' : 'P3'
    return { priorityScore: Math.min(score, 100), missionPriority }
  }
}
