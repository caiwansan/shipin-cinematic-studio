// === Golden Dataset Validator — Registry Validator ===
// RC2-T002.6
// Checks expectedScenarios references Discovery Scenario Registry
// Checks expectedIntent references Intent Registry

import { ValidationError, ValidationWarning, VitalRecord } from "./types";

// === Discovery Scenario Registry (minimal inline, 25+ entries) ===
const SCENARIO_REGISTRY: string[] = [
  "discover-brand",
  "compare-brands",
  "research-product",
  "evaluate-product-safety",
  "evaluate-shop-trust",
  "recommend-restaurant",
  "discover-company",
  "compare-companies",
  "select-vendor",
  "find-alternative",
  "check-pricing",
  "get-recommendation",
  "assess-quality",
  "check-availability",
  "investigate-history",
  "verify-credentials",
  "find-reviews",
  "compare-prices",
  "check-shipping",
  "understand-features",
  "check-compatibility",
  "lookup-contact",
  "read-documentation",
  "find-tutorials",
  "compare-features",
  "check-certifications",
  "evaluate-risks",
  "discover-trends",
  "compare-ecosystems",
  "assess-market-position",
];

// === Intent Registry (Spec §8 — exactly 14 entries) ===
const INTENT_REGISTRY: string[] = [
  "discover-brand",
  "compare-vendors",
  "select-vendor",
  "recommend-product",
  "inquire-pricing",
  "find-alternative",
  "get-implementation-guide",
  "check-integration",
  "assess-trust",
  "assess-safety",
  "ask-technical",
  "understand-use-case",
  "get-industry-insight",
  "check-compliance",
];

export function validateRegistry(
  dataset: VitalRecord,
  errors: ValidationError[],
  warnings: ValidationWarning[],
): void {
  const entityKeys = Object.keys(dataset).filter(k => k !== "_metadata");

  for (const key of entityKeys) {
    const entity = dataset[key] as Record<string, unknown>;
    if (!entity || typeof entity !== "object") continue;

    // === Check expectedScenarios ===
    const scenarios = entity.expectedScenarios;
    if (Array.isArray(scenarios)) {
      for (const scenario of scenarios) {
        if (!SCENARIO_REGISTRY.includes(scenario as string)) {
          errors.push({
            code: "INVALID_SCENARIO_REFERENCE",
            entityId: key,
            field: "expectedScenarios",
            message: `Entity "${key}" references unknown scenario "${scenario}". Must be from Discovery Scenario Registry.`,
            severity: "error",
          });
        }
      }

      if (scenarios.length === 0) {
        warnings.push({
          code: "EMPTY_SCENARIOS",
          entityId: key,
          field: "expectedScenarios",
          message: `Entity "${key}" has empty expectedScenarios array`,
          severity: "warning",
        });
      }
    }

    // === Check expectedIntent ===
    const intents = entity.expectedIntent;
    if (Array.isArray(intents)) {
      for (const intent of intents) {
        if (!INTENT_REGISTRY.includes(intent as string)) {
          errors.push({
            code: "INVALID_INTENT_REFERENCE",
            entityId: key,
            field: "expectedIntent",
            message: `Entity "${key}" references unknown intent "${intent}". Must be from Intent Registry.`,
            severity: "error",
          });
        }
      }

      if (intents.length === 0) {
        errors.push({
          code: "EMPTY_INTENTS",
          entityId: key,
          field: "expectedIntent",
          message: `Entity "${key}" has empty expectedIntent array (must have at least 1)`,
          severity: "error",
        });
      }

      if (intents.length > 3) {
        warnings.push({
          code: "TOO_MANY_INTENTS",
          entityId: key,
          field: "expectedIntent",
          message: `Entity "${key}" has ${intents.length} intents (max 3 allowed)`,
          severity: "warning",
        });
      }
    }
  }
}

// Export registries for potential external use
export { SCENARIO_REGISTRY, INTENT_REGISTRY };
