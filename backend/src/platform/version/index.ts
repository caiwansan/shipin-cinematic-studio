import { VersionEntry, VersionManager } from './types';

const versions = new Map<string, VersionEntry[]>();
const activeVersions = new Map<string, string>();

export const versionManager: VersionManager = {
  register(entry: VersionEntry): void {
    if (!versions.has(entry.domain)) {
      versions.set(entry.domain, []);
    }
    const domainVersions = versions.get(entry.domain)!;
    const existing = domainVersions.find(v => v.version === entry.version);
    if (existing) {
      throw new Error(`Version '${entry.version}' already registered for domain '${entry.domain}'`);
    }
    domainVersions.push(entry);
  },

  activate(domain: string, version: string): void {
    const domainVersions = versions.get(domain);
    if (!domainVersions) {
      throw new Error(`No versions registered for domain '${domain}'`);
    }
    const entry = domainVersions.find(v => v.version === version);
    if (!entry) {
      throw new Error(`Version '${version}' not found for domain '${domain}'`);
    }
    activeVersions.set(domain, version);
  },

  getActiveVersion(domain: string): string | undefined {
    return activeVersions.get(domain);
  },

  getEntry(domain: string, version: string): VersionEntry | undefined {
    return versions.get(domain)?.find(v => v.version === version);
  },

  history(domain: string): VersionEntry[] {
    return versions.get(domain) || [];
  },

  requiresRevalidation(domain: string, currentVersion: string, targetVersion: string): boolean {
    const current = this.getEntry(domain, currentVersion);
    const target = this.getEntry(domain, targetVersion);
    if (!current || !target) return true; // If can't find, revalidate to be safe
    // If target has breakingChanges or requiresRevalidation, need revalidation
    return !!(target.breakingChanges?.length || target.requiresRevalidation);
  },

  listDomains(): string[] {
    return Array.from(versions.keys());
  },
};

// --- 注册初始版本 ---
// geoScore v1
versionManager.register({
  version: 'v1.0',
  domain: 'geoScore',
  releasedAt: new Date('2026-01-01'),
  migrationNotes: 'Initial GEO scoring algorithm',
  breakingChanges: [],
  requiresRevalidation: false,
});
versionManager.activate('geoScore', 'v1.0');

// policy v1
versionManager.register({
  version: 'v1.0',
  domain: 'policy',
  releasedAt: new Date('2026-01-01'),
  migrationNotes: 'Initial verification policy',
  breakingChanges: [],
  requiresRevalidation: false,
});
versionManager.activate('policy', 'v1.0');

// learning v1
versionManager.register({
  version: 'v1.0',
  domain: 'learning',
  releasedAt: new Date('2026-01-01'),
  migrationNotes: 'Initial learning engine',
  breakingChanges: [],
  requiresRevalidation: false,
});
versionManager.activate('learning', 'v1.0');

// verification v1
versionManager.register({
  version: 'v1.0',
  domain: 'verification',
  releasedAt: new Date('2026-07-19'),
  migrationNotes: 'Initial verification engine',
  breakingChanges: [],
  requiresRevalidation: false,
});
versionManager.activate('verification', 'v1.0');

// publishing v1
versionManager.register({
  version: 'v1.0',
  domain: 'publishing',
  releasedAt: new Date('2026-07-19'),
  migrationNotes: 'Initial publishing pipeline',
  breakingChanges: [],
  requiresRevalidation: false,
});
versionManager.activate('publishing', 'v1.0');
