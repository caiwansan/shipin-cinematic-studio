// === Golden Dataset Validator — Types ===
// RC2-T002.6
// 2026-07-02

export interface ValidationError {
  code: string;
  entityId?: string;
  field: string;
  message: string;
  severity: "error";
}

export interface ValidationWarning {
  code: string;
  entityId?: string;
  field: string;
  message: string;
  severity: "warning";
}

export interface SignalStats {
  avgSignals: number;
  avgHighSignals: number;
}

export interface EvidenceStats {
  withEvidence: number;
  withoutEvidence: number;
}

export interface ValidationStatistics {
  total: number;
  passed: number;
  failed: number;
  byIndustry: Record<string, number>;
  byEntityType: Record<string, number>;
  byCoverageBand: Record<string, number>;
  byConfidenceBand: Record<string, number>;
  byReviewStatus: Record<string, number>;
  byOrigin: Record<string, number>;
  signalStats: SignalStats;
  evidenceStats: EvidenceStats;
}

export interface ValidationReport {
  passed: boolean;
  errors: ValidationError[];
  warnings: ValidationWarning[];
  statistics: ValidationStatistics;
}

// === Type guards ===

export type VitalRecord = {
  _metadata?: Record<string, unknown>;
  [key: string]: unknown;
};

// Enum types matching the spec
export type SignalType =
  | "Concept" | "Brand" | "Product" | "Founder" | "Technology"
  | "Certification" | "Industry" | "Competitor" | "Market" | "Geography";

export type CoverageBand = "Excellent" | "Good" | "Fair" | "Weak" | "Poor";

export type ConfidenceBand = "High" | "Medium" | "Low";

export type EvidenceType =
  | "official_website" | "wikipedia" | "documentation" | "trusted_news"
  | "analyst_report" | "academic_paper" | "press_release" | "patent"
  | "financial_report";

export type ReviewStatus = "draft" | "reviewed" | "verified" | "golden" | "rejected";

export type Origin =
  | "manual" | "production-replay" | "customer-case" | "benchmark" | "synthetic" | "imported";

export type EntityType =
  | "Brand" | "Company" | "Product" | "Service" | "Platform"
  | "Organization" | "Person" | "Technology";
