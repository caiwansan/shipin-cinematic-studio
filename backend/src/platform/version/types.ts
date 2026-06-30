// Version entry with metadata (Freeze⑬)
export interface VersionEntry {
  version: string;           // "v2.1"
  domain: string;            // "geoScore" | "verification" | "policy" | "learning" | "publishing"
  releasedAt: Date;
  migrationNotes?: string;   // "知识维度权重从 0.3 调整为 0.35"
  breakingChanges?: string[];// ["knowledge.maxScore 从 10 变为 15"]
  featureFlags?: string[];   // ["enable_authority_boost"]
  requiresRevalidation?: boolean; // true = GeoScorer 升级，已有快照应重算
}

export interface VersionManager {
  register(entry: VersionEntry): void;
  activate(domain: string, version: string): void;
  getActiveVersion(domain: string): string | undefined;
  getEntry(domain: string, version: string): VersionEntry | undefined;
  history(domain: string): VersionEntry[];
  requiresRevalidation(domain: string, currentVersion: string, targetVersion: string): boolean;
  listDomains(): string[];
}
