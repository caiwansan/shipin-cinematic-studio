/**
 * Outcome Truth Layer — Service Exports
 * OI-01 Schema Foundation
 */

export { OutcomeService } from './outcome.service.js'
export { ImpactService } from './impact.service.js'
export { FeedbackService } from './feedback.service.js'

export type {
  OutcomeRecord,
  OutcomeType,
  OutcomeStatus,
  EvidenceItem,
  CreateOutcomeInput,
  ImpactMeasurement,
  ImpactMetricType,
  RecordImpactInput,
  DecisionFeedback,
  FeedbackType,
  CreateFeedbackInput,
} from './types.js'
