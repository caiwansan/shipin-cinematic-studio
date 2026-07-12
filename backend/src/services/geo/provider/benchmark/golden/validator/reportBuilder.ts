// === Golden Dataset Validator — Report Builder ===
// RC2-T002.6
// Builds statistical distribution report from validation results

import { ValidationReport, ValidationError, ValidationWarning, VitalRecord } from "./types";

interface EntitySummary {
  entityType: string;
  industry: string;
  coverageBand: string;
  confidenceBand: string;
  reviewStatus: string;
  origin: string;
  signalCount: number;
  highSignalCount: number;
  evidenceCount: number;
}

function extractEntities(dataset: VitalRecord): EntitySummary[] {
  const keys = Object.keys(dataset).filter(k => k !== "_metadata");
  const summaries: EntitySummary[] = [];

  for (const key of keys) {
    const entity = dataset[key] as Record<string, unknown>;
    if (!entity || typeof entity !== "object") continue;

    const signals = (entity.expectedKnowledgeSignals as Array<Record<string, unknown>>) || [];
    const evidence = (entity.evidence as Array<unknown>) || [];

    let highCount = 0;
    for (const sig of signals) {
      if (sig && sig.importance === "High") highCount++;
    }

    summaries.push({
      entityType: (entity.entityType as string) || "unknown",
      industry: (entity.industry as string) || "unknown",
      coverageBand: (entity.expectedCoverageBand as string) || "unknown",
      confidenceBand: (entity.expectedConfidenceBand as string) || "unknown",
      reviewStatus: (entity.reviewStatus as string) || "unknown",
      origin: (entity.origin as string) || "unknown",
      signalCount: signals.length,
      highSignalCount: highCount,
      evidenceCount: evidence.length,
    });
  }

  return summaries;
}

function countBy<T>(items: T[], keyFn: (item: T) => string): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const item of items) {
    const key = keyFn(item);
    counts[key] = (counts[key] || 0) + 1;
  }
  return counts;
}

function getEntityId(err: ValidationError | ValidationWarning): string | undefined {
  return err.entityId;
}

export function buildReport(
  dataset: VitalRecord,
  errors: ValidationError[],
  warnings: ValidationWarning[],
): ValidationReport {
  const entities = extractEntities(dataset);
  const total = entities.length;
  const failedEntities = new Set(
    errors.map(e => getEntityId(e)).filter((id): id is string => !!id && id !== "_metadata")
  );

  const passed = total - failedEntities.size;
  const failed = failedEntities.size;

  // Build distributions
  const byIndustry = countBy(entities, e => e.industry);
  const byEntityType = countBy(entities, e => e.entityType);
  const byCoverageBand = countBy(entities, e => e.coverageBand);
  const byConfidenceBand = countBy(entities, e => e.confidenceBand);
  const byReviewStatus = countBy(entities, e => e.reviewStatus);
  const byOrigin = countBy(entities, e => e.origin);

  // Signal stats
  const totalSignals = entities.reduce((sum, e) => sum + e.signalCount, 0);
  const totalHighSignals = entities.reduce((sum, e) => sum + e.highSignalCount, 0);
  const avgSignals = total > 0 ? totalSignals / total : 0;
  const avgHighSignals = total > 0 ? totalHighSignals / total : 0;

  // Evidence stats
  const withEvidence = entities.filter(e => e.evidenceCount > 0).length;
  const withoutEvidence = entities.filter(e => e.evidenceCount === 0).length;

  return {
    passed: errors.length === 0,
    errors,
    warnings,
    statistics: {
      total,
      passed,
      failed,
      byIndustry,
      byEntityType,
      byCoverageBand,
      byConfidenceBand,
      byReviewStatus,
      byOrigin,
      signalStats: { avgSignals, avgHighSignals },
      evidenceStats: { withEvidence, withoutEvidence },
    },
  };
}
