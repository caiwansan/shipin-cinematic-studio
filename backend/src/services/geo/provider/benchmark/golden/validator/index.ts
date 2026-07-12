// === Golden Dataset Validator — 统一入口 ===
// RC2-T002.6

import { VitalRecord, ValidationReport, ValidationError, ValidationWarning } from "./types";
import { validateSchema } from "./schemaValidator";
import { validateRegistry } from "./registryValidator";
import { validateEvidence } from "./evidenceValidator";
import { validateSignals } from "./signalValidator";
import { validateBands } from "./bandValidator";
import { buildReport } from "./reportBuilder";

export function validate(dataset: VitalRecord): ValidationReport {
  const errors: ValidationError[] = [];
  const warnings: ValidationWarning[] = [];

  validateSchema(dataset, errors, warnings);
  validateRegistry(dataset, errors, warnings);
  validateEvidence(dataset, errors, warnings);
  validateSignals(dataset, errors, warnings);
  validateBands(dataset, errors, warnings);

  return buildReport(dataset, errors, warnings);
}

export * from "./types";
export { validateSchema } from "./schemaValidator";
export { validateRegistry, SCENARIO_REGISTRY, INTENT_REGISTRY } from "./registryValidator";
export { validateEvidence } from "./evidenceValidator";
export { validateSignals } from "./signalValidator";
export { validateBands } from "./bandValidator";
export { buildReport } from "./reportBuilder";
