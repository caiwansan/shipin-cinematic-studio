// === Golden Dataset Validator — Signal Validator ===
// RC2-T002.6
// KnowledgeSignal >=3 <=6, Importance High at least 1, SignalType diversity check

import { ValidationError, ValidationWarning, VitalRecord } from "./types";

const VALID_SIGNAL_TYPES = [
  "Concept", "Brand", "Product", "Founder", "Technology",
  "Certification", "Industry", "Competitor", "Market", "Geography",
];

const VALID_IMPORTANCE_LEVELS = ["High", "Medium", "Low"];

export function validateSignals(
  dataset: VitalRecord,
  errors: ValidationError[],
  warnings: ValidationWarning[],
): void {
  const entityKeys = Object.keys(dataset).filter(k => k !== "_metadata");

  for (const key of entityKeys) {
    const entity = dataset[key] as Record<string, unknown>;
    if (!entity || typeof entity !== "object") continue;

    const signals = entity.expectedKnowledgeSignals;
    if (!Array.isArray(signals)) {
      // Missing field handled by schemaValidator
      continue;
    }

    // === Count check: >=3 and <=6 ===
    if (signals.length < 3) {
      errors.push({
        code: "TOO_FEW_SIGNALS",
        entityId: key,
        field: "expectedKnowledgeSignals",
        message: `Entity "${key}" has only ${signals.length} knowledge signals (minimum 3 required)`,
        severity: "error",
      });
    }

    if (signals.length > 6) {
      errors.push({
        code: "TOO_MANY_SIGNALS",
        entityId: key,
        field: "expectedKnowledgeSignals",
        message: `Entity "${key}" has ${signals.length} knowledge signals (maximum 6 allowed)`,
        severity: "error",
      });
    }

    // === Per-signal validation ===
    let highCount = 0;
    const usedTypes = new Set<string>();
    let totalValidSignals = 0;

    for (let i = 0; i < signals.length; i++) {
      const signal = signals[i];
      if (!signal || typeof signal !== "object") {
        errors.push({
          code: "INVALID_SIGNAL",
          entityId: key,
          field: `expectedKnowledgeSignals[${i}]`,
          message: `Entity "${key}" signal[${i}] is not a valid object`,
          severity: "error",
        });
        continue;
      }

      const sig = signal as Record<string, unknown>;

      // Check type
      if (!sig.type || !VALID_SIGNAL_TYPES.includes(sig.type as string)) {
        errors.push({
          code: "INVALID_SIGNAL_TYPE",
          entityId: key,
          field: `expectedKnowledgeSignals[${i}].type`,
          message: `Entity "${key}" signal[${i}] has invalid type "${sig.type}"`,
          severity: "error",
        });
      } else {
        usedTypes.add(sig.type as string);
      }

      // Check text
      if (!sig.text || (sig.text as string).trim() === "") {
        errors.push({
          code: "MISSING_SIGNAL_TEXT",
          entityId: key,
          field: `expectedKnowledgeSignals[${i}].text`,
          message: `Entity "${key}" signal[${i}] has empty text`,
          severity: "error",
        });
      }

      // Check importance
      if (!sig.importance || !VALID_IMPORTANCE_LEVELS.includes(sig.importance as string)) {
        errors.push({
          code: "INVALID_IMPORTANCE_LEVEL",
          entityId: key,
          field: `expectedKnowledgeSignals[${i}].importance`,
          message: `Entity "${key}" signal[${i}] has invalid importance "${sig.importance}"`,
          severity: "error",
        });
      } else {
        if (sig.importance === "High") {
          highCount++;
        }
      }

      totalValidSignals++;
    }

    // === At least 1 High importance signal ===
    if (totalValidSignals > 0 && highCount === 0) {
      errors.push({
        code: "NO_HIGH_IMPORTANCE_SIGNAL",
        entityId: key,
        field: "expectedKnowledgeSignals",
        message: `Entity "${key}" must have at least 1 High importance signal`,
        severity: "error",
      });
    }

    if (highCount > 2) {
      warnings.push({
        code: "TOO_MANY_HIGH_SIGNALS",
        entityId: key,
        field: "expectedKnowledgeSignals",
        message: `Entity "${key}" has ${highCount} High importance signals (recommended max 2)`,
        severity: "warning",
      });
    }

    // === SignalType diversity check (cannot all be the same type) ===
    if (signals.length >= 2 && usedTypes.size <= 1) {
      warnings.push({
        code: "SIGNAL_TYPE_LOW_DIVERSITY",
        entityId: key,
        field: "expectedKnowledgeSignals",
        message: `Entity "${key}" uses only ${usedTypes.size} signal type(s) (${Array.from(usedTypes).join(", ")}). Consider diversifying.`,
        severity: "warning",
      });
    }
  }
}
