// === Golden Dataset Validator — Schema Validator ===
// RC2-T002.6
// Checks field completeness, Metadata integrity, version consistency

import {
  ValidationError,
  ValidationWarning,
  VitalRecord,
} from "./types";

const REQUIRED_ENTITY_FIELDS = [
  "id",
  "entityName",
  "entityType",
  "industry",
  "country",
  "language",
  "website",
  "description",
  "expectedScenarios",
  "expectedIntent",
  "expectedKnowledgeSignals",
  "expectedEntities",
  "expectedCoverageBand",
  "expectedConfidenceBand",
  "evidence",
  "version",
  "reviewStatus",
  "origin",
  "notes",
];

const REQUIRED_METADATA_FIELDS = [
  "datasetVersion",
  "schemaVersion",
  "annotationGuideVersion",
  "frozenAt",
  "owner",
  "approved",
  "source",
  "count",
  "industries",
  "entityTypes",
  "coverageBands",
];

const VALID_ENTITY_TYPES: string[] = [
  "Brand", "Company", "Product", "Service", "Platform",
  "Organization", "Person", "Technology",
];

export function validateSchema(
  dataset: VitalRecord,
  errors: ValidationError[],
  warnings: ValidationWarning[],
): void {
  // === 1. Check Metadata presence ===
  if (!dataset._metadata || typeof dataset._metadata !== "object") {
    errors.push({
      code: "MISSING_METADATA",
      entityId: "_metadata",
      field: "_metadata",
      message: "Dataset must contain a _metadata field as the first field",
      severity: "error",
    });
    // Cannot proceed with metadata validation
    return;
  }

  const meta = dataset._metadata as Record<string, unknown>;

  // === 2. Check Metadata field completeness ===
  for (const field of REQUIRED_METADATA_FIELDS) {
    if (meta[field] === undefined || meta[field] === null) {
      errors.push({
        code: "MISSING_METADATA_FIELD",
        entityId: "_metadata",
        field: `_metadata.${field}`,
        message: `Metadata is missing required field: ${field}`,
        severity: "error",
      });
    }
  }

  // === 3. Check version consistency ===
  // All entities must have the same version as metadata datasetVersion
  const expectedVersion = meta.datasetVersion as string | undefined;

  // Collect entities (non-_metadata keys that look like entities)
  const entityKeys = Object.keys(dataset).filter(k => k !== "_metadata");

  for (const key of entityKeys) {
    const entity = dataset[key] as Record<string, unknown>;
    if (!entity || typeof entity !== "object") continue;

    // Check required entity fields
    for (const field of REQUIRED_ENTITY_FIELDS) {
      if (entity[field] === undefined || entity[field] === null) {
        errors.push({
          code: "MISSING_ENTITY_FIELD",
          entityId: key,
          field,
          message: `Entity "${key}" is missing required field: ${field}`,
          severity: "error",
        });
      }
    }

    // Check version consistency
    if (expectedVersion && entity.version !== undefined && entity.version !== expectedVersion) {
      errors.push({
        code: "VERSION_MISMATCH",
        entityId: key,
        field: "version",
        message: `Entity "${key}" has version "${entity.version}" but metadata expects "${expectedVersion}"`,
        severity: "error",
      });
    }

    // Check entityType is valid
    if (entity.entityType !== undefined && !VALID_ENTITY_TYPES.includes(entity.entityType as string)) {
      errors.push({
        code: "INVALID_ENTITY_TYPE",
        entityId: key,
        field: "entityType",
        message: `Entity "${key}" has invalid entityType "${entity.entityType}". Must be one of: ${VALID_ENTITY_TYPES.join(", ")}`,
        severity: "error",
      });
    }
  }

  // === 4. Check schemaVersion / annotationGuideVersion consistency ===
  // These should be "1.0" as per spec
  if (meta.schemaVersion !== undefined && meta.schemaVersion !== "1.0") {
    warnings.push({
      code: "SCHEMA_VERSION_MISMATCH",
      entityId: "_metadata",
      field: "_metadata.schemaVersion",
      message: `Expected schemaVersion "1.0", got "${meta.schemaVersion}"`,
      severity: "warning",
    });
  }

  if (meta.annotationGuideVersion !== undefined && meta.annotationGuideVersion !== "1.0") {
    warnings.push({
      code: "ANNOTATION_GUIDE_VERSION_MISMATCH",
      entityId: "_metadata",
      field: "_metadata.annotationGuideVersion",
      message: `Expected annotationGuideVersion "1.0", got "${meta.annotationGuideVersion}"`,
      severity: "warning",
    });
  }
}
