export const EngineType = {
  Knowledge: 'knowledge',
  Discovery: 'discovery',
  Packaging: 'packaging',
  Distribution: 'distribution',
  Observation: 'observation',
  Adaptive: 'adaptive'
} as const
export type EngineType = (typeof EngineType)[keyof typeof EngineType]
