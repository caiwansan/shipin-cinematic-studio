// === Golden Dataset Validator — Band Validator ===
// RC2-T002.6
// Checks CoverageBand/ConfidenceBand/ReviewStatus/Origin value ranges
// Checks ReviewStatus state machine (cannot be draft→golden)

import { ValidationError, ValidationWarning, VitalRecord } from "./types";

const VALID_COVERAGE_BANDS = ["Excellent", "Good", "Fair", "Weak", "Poor"];
const VALID_CONFIDENCE_BANDS = ["High", "Medium", "Low"];
const VALID_REVIEW_STATUSES = ["draft", "reviewed", "verified", "golden", "rejected"];
const VALID_ORIGINS = ["manual", "production-replay", "customer-case", "benchmark", "synthetic", "imported"];

// Valid review status transitions (parent state -> allowed child states)
const VALID_STATUS_TRANSITIONS: Record<string, string[]> = {
  "draft": ["reviewed", "rejected"],
  "reviewed": ["verified", "rejected"],
  "verified": ["golden", "rejected"],
  "golden": [],              // golden cannot transition (must deprecate)
  "rejected": ["draft"],     // can re-enter from rejected
};

export function validateBands(
  dataset: VitalRecord,
  errors: ValidationError[],
  warnings: ValidationWarning[],
): void {
  const entityKeys = Object.keys(dataset).filter(k => k !== "_metadata");

  for (const key of entityKeys) {
    const entity = dataset[key] as Record<string, unknown>;
    if (!entity || typeof entity !== "object") continue;

    // === CoverageBand ===
    const coverage = entity.expectedCoverageBand as string;
    if (coverage && !VALID_COVERAGE_BANDS.includes(coverage)) {
      errors.push({
        code: "INVALID_COVERAGE_BAND",
        entityId: key,
        field: "expectedCoverageBand",
        message: `Entity "${key}" has invalid coverageBand "${coverage}". Must be one of: ${VALID_COVERAGE_BANDS.join(", ")}`,
        severity: "error",
      });
    }

    // === ConfidenceBand ===
    const confidence = entity.expectedConfidenceBand as string;
    if (confidence && !VALID_CONFIDENCE_BANDS.includes(confidence)) {
      errors.push({
        code: "INVALID_CONFIDENCE_BAND",
        entityId: key,
        field: "expectedConfidenceBand",
        message: `Entity "${key}" has invalid confidenceBand "${confidence}". Must be one of: ${VALID_CONFIDENCE_BANDS.join(", ")}`,
        severity: "error",
      });
    }

    // === ReviewStatus ===
    const status = entity.reviewStatus as string;
    if (status && !VALID_REVIEW_STATUSES.includes(status)) {
      errors.push({
        code: "INVALID_REVIEW_STATUS",
        entityId: key,
        field: "reviewStatus",
        message: `Entity "${key}" has invalid reviewStatus "${status}". Must be one of: ${VALID_REVIEW_STATUSES.join(", ")}`,
        severity: "error",
      });
    }

    // === ReviewStatus state machine check ===
    // If the entity has a previousStatus from migration context, check transition validity
    // For initial imported data, just check that draft→golden doesn't skip steps
    // This is a basic check: if status is "golden" but no evidence of prior reviews, flag warning
    if (status === "golden" && !entity._priorReviewStatus) {
      warnings.push({
        code: "GOLDEN_WITHOUT_REVIEW_CHAIN",
        entityId: key,
        field: "reviewStatus",
        message: `Entity "${key}" is golden but has no review chain history. First-time imported entities should be "draft" or "imported".`,
        severity: "warning",
      });
    }

    // Check for direct draft→golden transition
    if (entity._priorReviewStatus && status) {
      const prior = entity._priorReviewStatus as string;
      const allowed = VALID_STATUS_TRANSITIONS[prior];
      if (allowed && !allowed.includes(status)) {
        errors.push({
          code: "INVALID_STATUS_TRANSITION",
          entityId: key,
          field: "reviewStatus",
          message: `Entity "${key}" cannot transition from "${prior}" to "${status}". Allowed: ${allowed.join(", ") || "(none)"}`,
          severity: "error",
        });
      }
    }

    // === Origin ===
    const origin = entity.origin as string;
    if (origin && !VALID_ORIGINS.includes(origin)) {
      errors.push({
        code: "INVALID_ORIGIN",
        entityId: key,
        field: "origin",
        message: `Entity "${key}" has invalid origin "${origin}". Must be one of: ${VALID_ORIGINS.join(", ")}`,
        severity: "error",
      });
    }
  }
}
