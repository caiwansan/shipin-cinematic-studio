// === Golden Dataset Validator — Evidence Validator ===
// RC2-T002.6
// Checks accessedAt ISO date, url validity, archiveUrl optional

import { ValidationError, ValidationWarning, VitalRecord } from "./types";

// Simple URL regex (matches http/https URLs)
const URL_REGEX = /^https?:\/\/.+\..+/i;

// ISO date format: YYYY-MM-DD
const ISO_DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;

const VALID_EVIDENCE_TYPES = [
  "official_website",
  "wikipedia",
  "documentation",
  "trusted_news",
  "analyst_report",
  "academic_paper",
  "press_release",
  "patent",
  "financial_report",
];

export function validateEvidence(
  dataset: VitalRecord,
  errors: ValidationError[],
  warnings: ValidationWarning[],
): void {
  const entityKeys = Object.keys(dataset).filter(k => k !== "_metadata");

  for (const key of entityKeys) {
    const entity = dataset[key] as Record<string, unknown>;
    if (!entity || typeof entity !== "object") continue;

    const evidence = entity.evidence;
    if (!Array.isArray(evidence)) {
      // Missing evidence already handled by schemaValidator
      continue;
    }

    if (evidence.length === 0) {
      errors.push({
        code: "NO_EVIDENCE",
        entityId: key,
        field: "evidence",
        message: `Entity "${key}" has no evidence (at least 1 required)`,
        severity: "error",
      });
      continue;
    }

    for (let i = 0; i < evidence.length; i++) {
      const ev = evidence[i] as Record<string, unknown> | undefined;
      if (!ev || typeof ev !== "object") {
        errors.push({
          code: "INVALID_EVIDENCE_ITEM",
          entityId: key,
          field: `evidence[${i}]`,
          message: `Entity "${key}" evidence[${i}] is not a valid object`,
          severity: "error",
        });
        continue;
      }

      // Check evidence type
      if (ev.type && !VALID_EVIDENCE_TYPES.includes(ev.type as string)) {
        errors.push({
          code: "INVALID_EVIDENCE_TYPE",
          entityId: key,
          field: `evidence[${i}].type`,
          message: `Entity "${key}" evidence[${i}] has invalid type "${ev.type}"`,
          severity: "error",
        });
      }

      // Check url format (url is optional as per spec)
      if (ev.url !== undefined && ev.url !== null) {
        if (!URL_REGEX.test(ev.url as string)) {
          errors.push({
            code: "INVALID_EVIDENCE_URL",
            entityId: key,
            field: `evidence[${i}].url`,
            message: `Entity "${key}" evidence[${i}] has invalid URL: "${ev.url}"`,
            severity: "error",
          });
        }
      }

      // Check archiveUrl — optional, but if present must be valid URL
      if (ev.archiveUrl !== undefined && ev.archiveUrl !== null) {
        if (!URL_REGEX.test(ev.archiveUrl as string)) {
          warnings.push({
            code: "INVALID_ARCHIVE_URL",
            entityId: key,
            field: `evidence[${i}].archiveUrl`,
            message: `Entity "${key}" evidence[${i}] has invalid archiveUrl: "${ev.archiveUrl}"`,
            severity: "warning",
          });
        }
      }

      // Check accessedAt
      if (ev.accessedAt !== undefined && ev.accessedAt !== null) {
        const dateStr = ev.accessedAt as string;
        if (!ISO_DATE_REGEX.test(dateStr)) {
          errors.push({
            code: "INVALID_ACCESSED_DATE",
            entityId: key,
            field: `evidence[${i}].accessedAt`,
            message: `Entity "${key}" evidence[${i}] has invalid accessedAt "${dateStr}". Must be YYYY-MM-DD.`,
            severity: "error",
          });
        } else {
          // Verify it's a real date
          const d = new Date(dateStr);
          if (isNaN(d.getTime())) {
            errors.push({
              code: "INVALID_ACCESSED_DATE_VALUE",
              entityId: key,
              field: `evidence[${i}].accessedAt`,
              message: `Entity "${key}" evidence[${i}] has non-real date "${dateStr}"`,
              severity: "error",
            });
          }
        }
      } else {
        errors.push({
          code: "MISSING_ACCESSED_DATE",
          entityId: key,
          field: `evidence[${i}].accessedAt`,
          message: `Entity "${key}" evidence[${i}] is missing accessedAt`,
          severity: "error",
        });
      }

      // Check description
      if (!ev.description || (ev.description as string).trim() === "") {
        warnings.push({
          code: "MISSING_EVIDENCE_DESCRIPTION",
          entityId: key,
          field: `evidence[${i}].description`,
          message: `Entity "${key}" evidence[${i}] has empty description`,
          severity: "warning",
        });
      }
    }
  }
}
