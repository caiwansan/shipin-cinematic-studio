import { Mission } from './models/Mission'

export class MissionPrioritizer {
  prioritize(missions: Mission[]): Mission[] {
    return [...missions].sort((a, b) => {
      if (a.priorityScore !== b.priorityScore) {
        return b.priorityScore - a.priorityScore
      }
      return a.id.localeCompare(b.id)
    })
  }
}
