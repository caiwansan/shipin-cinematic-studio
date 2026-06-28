// ⭐ 统一入口（Phase A+）：shadow observe + drift metrics

import { normalizeFields, collectNormalizeStats, NormalizeStats } from './normalizer'
import { validateAgentOutput, ValidateResult } from './validator'
import { captureSnapshot, AgentOutputSnapshot } from './snapshot'
import {
  shadowValidate,
  batchShadowValidate,
  getDriftSummary,
  ShadowInjectionResult,
  AgentDriftMetrics,
} from './shadow'

export {
  normalizeFields,
  collectNormalizeStats,
  validateAgentOutput,
  captureSnapshot,
  shadowValidate,
  batchShadowValidate,
  getDriftSummary,
}

export type {
  NormalizeStats,
  ValidateResult,
  AgentOutputSnapshot,
  ShadowInjectionResult,
  AgentDriftMetrics,
}
