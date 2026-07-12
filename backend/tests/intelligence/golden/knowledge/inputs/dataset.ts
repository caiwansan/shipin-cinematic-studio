/**
 * Golden Dataset — Knowledge Intelligence Engine
 *
 * 30 standard Knowledge Objects covering all Rule paths.
 * This file is LONG-TERM STABLE. Do NOT modify to make tests pass.
 * If rules change, update expectations/v1.0.json instead.
 *
 * Design: 11 categories, each with specific characteristics.
 *
 * All dates are explicit (not relative) to ensure deterministic
 * expectations regardless of when tests are run.
 * Reference date for freshness: 2026-07-15
 */

import type { KnowledgeObjectInput } from '../../../../src/engines/knowledge-intelligence'

// ── Category 1: High-quality well-cited (5 objects) ────────────────────────
// content.length=120, citationCount=5, authoritativeCount=2, scenarioCount=6,
// totalScenarios=8, sourceTypes=["official_website","academic"],
// entityMentions=8, contradictions=0, lastUpdated="2026-07-01"
// (14 days from reference — <30 -> +20 delta)

const HIGH_QUALITY_1: KnowledgeObjectInput = {
  id: 'high-quality-1',
  category: 'Technology',
  content: 'A'.repeat(120),
  status: 'verified',
  lastUpdated: '2026-07-01',
  citationCount: 5,
  authoritativeCount: 2,
  scenarioCount: 6,
  totalScenarios: 8,
  sourceTypes: ['official_website', 'academic'],
  entityMentions: 8,
  contradictions: 0,
}

const HIGH_QUALITY_2: KnowledgeObjectInput = {
  id: 'high-quality-2',
  category: 'Science',
  content: 'B'.repeat(120),
  status: 'verified',
  lastUpdated: '2026-07-01',
  citationCount: 5,
  authoritativeCount: 2,
  scenarioCount: 6,
  totalScenarios: 8,
  sourceTypes: ['official_website', 'academic'],
  entityMentions: 8,
  contradictions: 0,
}

const HIGH_QUALITY_3: KnowledgeObjectInput = {
  id: 'high-quality-3',
  category: 'Medical',
  content: 'C'.repeat(120),
  status: 'verified',
  lastUpdated: '2026-07-01',
  citationCount: 5,
  authoritativeCount: 2,
  scenarioCount: 6,
  totalScenarios: 8,
  sourceTypes: ['official_website', 'academic'],
  entityMentions: 8,
  contradictions: 0,
}

const HIGH_QUALITY_4: KnowledgeObjectInput = {
  id: 'high-quality-4',
  category: 'Engineering',
  content: 'D'.repeat(120),
  status: 'verified',
  lastUpdated: '2026-07-01',
  citationCount: 5,
  authoritativeCount: 2,
  scenarioCount: 6,
  totalScenarios: 8,
  sourceTypes: ['official_website', 'academic'],
  entityMentions: 8,
  contradictions: 0,
}

const HIGH_QUALITY_5: KnowledgeObjectInput = {
  id: 'high-quality-5',
  category: 'Research',
  content: 'E'.repeat(120),
  status: 'verified',
  lastUpdated: '2026-07-01',
  citationCount: 5,
  authoritativeCount: 2,
  scenarioCount: 6,
  totalScenarios: 8,
  sourceTypes: ['official_website', 'academic'],
  entityMentions: 8,
  contradictions: 0,
}

// ── Category 2: Moderate quality (5 objects) ──────────────────────────────
// content.length=45, citationCount=2, authoritativeCount=0, scenarioCount=4,
// totalScenarios=8, sourceTypes=["wikipedia"], entityMentions=4,
// contradictions=0, lastUpdated="2026-04-15"
// (91 days from reference — 90<days<=180 -> -10 delta)

const MODERATE_QUALITY_1: KnowledgeObjectInput = {
  id: 'moderate-quality-1',
  category: 'History',
  content: 'F'.repeat(45),
  status: 'verified',
  lastUpdated: '2026-04-15',
  citationCount: 2,
  authoritativeCount: 0,
  scenarioCount: 4,
  totalScenarios: 8,
  sourceTypes: ['wikipedia'],
  entityMentions: 4,
  contradictions: 0,
}

const MODERATE_QUALITY_2: KnowledgeObjectInput = {
  id: 'moderate-quality-2',
  category: 'Geography',
  content: 'G'.repeat(45),
  status: 'verified',
  lastUpdated: '2026-04-15',
  citationCount: 2,
  authoritativeCount: 0,
  scenarioCount: 4,
  totalScenarios: 8,
  sourceTypes: ['wikipedia'],
  entityMentions: 4,
  contradictions: 0,
}

const MODERATE_QUALITY_3: KnowledgeObjectInput = {
  id: 'moderate-quality-3',
  category: 'Culture',
  content: 'H'.repeat(45),
  status: 'verified',
  lastUpdated: '2026-04-15',
  citationCount: 2,
  authoritativeCount: 0,
  scenarioCount: 4,
  totalScenarios: 8,
  sourceTypes: ['wikipedia'],
  entityMentions: 4,
  contradictions: 0,
}

const MODERATE_QUALITY_4: KnowledgeObjectInput = {
  id: 'moderate-quality-4',
  category: 'Economics',
  content: 'I'.repeat(45),
  status: 'verified',
  lastUpdated: '2026-04-15',
  citationCount: 2,
  authoritativeCount: 0,
  scenarioCount: 4,
  totalScenarios: 8,
  sourceTypes: ['wikipedia'],
  entityMentions: 4,
  contradictions: 0,
}

const MODERATE_QUALITY_5: KnowledgeObjectInput = {
  id: 'moderate-quality-5',
  category: 'Philosophy',
  content: 'J'.repeat(45),
  status: 'verified',
  lastUpdated: '2026-04-15',
  citationCount: 2,
  authoritativeCount: 0,
  scenarioCount: 4,
  totalScenarios: 8,
  sourceTypes: ['wikipedia'],
  entityMentions: 4,
  contradictions: 0,
}

// ── Category 3: Low quality no citations (4 objects) ──────────────────────
// content.length=20, citationCount=0, authoritativeCount=0, scenarioCount=1,
// totalScenarios=8, sourceTypes=["user_forum"], entityMentions=2,
// contradictions=1, lastUpdated="2025-01-10"
// (~550 days from reference — >180 -> -20 delta)

const LOW_QUALITY_1: KnowledgeObjectInput = {
  id: 'low-quality-1',
  category: 'Product',
  content: 'K'.repeat(20),
  status: 'outdated',
  lastUpdated: '2025-01-10',
  citationCount: 0,
  authoritativeCount: 0,
  scenarioCount: 1,
  totalScenarios: 8,
  sourceTypes: ['user_forum'],
  entityMentions: 2,
  contradictions: 1,
}

const LOW_QUALITY_2: KnowledgeObjectInput = {
  id: 'low-quality-2',
  category: 'Support',
  content: 'L'.repeat(20),
  status: 'outdated',
  lastUpdated: '2025-01-10',
  citationCount: 0,
  authoritativeCount: 0,
  scenarioCount: 1,
  totalScenarios: 8,
  sourceTypes: ['user_forum'],
  entityMentions: 2,
  contradictions: 1,
}

const LOW_QUALITY_3: KnowledgeObjectInput = {
  id: 'low-quality-3',
  category: 'FAQ',
  content: 'M'.repeat(20),
  status: 'outdated',
  lastUpdated: '2025-01-10',
  citationCount: 0,
  authoritativeCount: 0,
  scenarioCount: 1,
  totalScenarios: 8,
  sourceTypes: ['user_forum'],
  entityMentions: 2,
  contradictions: 1,
}

const LOW_QUALITY_4: KnowledgeObjectInput = {
  id: 'low-quality-4',
  category: 'Community',
  content: 'N'.repeat(20),
  status: 'outdated',
  lastUpdated: '2025-01-10',
  citationCount: 0,
  authoritativeCount: 0,
  scenarioCount: 1,
  totalScenarios: 8,
  sourceTypes: ['user_forum'],
  entityMentions: 2,
  contradictions: 1,
}

// ── Category 4: Fresh content (3 objects) ─────────────────────────────────
// content.length=60, citationCount=1, authoritativeCount=0, scenarioCount=3,
// totalScenarios=8, sourceTypes=["wikipedia"], entityMentions=3,
// contradictions=0
// lastUpdated at 10/15/25 days before reference (2026-07-15)

const FRESH_CONTENT_1: KnowledgeObjectInput = {
  id: 'fresh-content-1',
  category: 'News',
  content: 'O'.repeat(60),
  status: 'verified',
  lastUpdated: '2026-07-05',  // 10 days before reference
  citationCount: 1,
  authoritativeCount: 0,
  scenarioCount: 3,
  totalScenarios: 8,
  sourceTypes: ['wikipedia'],
  entityMentions: 3,
  contradictions: 0,
}

const FRESH_CONTENT_2: KnowledgeObjectInput = {
  id: 'fresh-content-2',
  category: 'Update',
  content: 'P'.repeat(60),
  status: 'verified',
  lastUpdated: '2026-06-30',  // 15 days before reference
  citationCount: 1,
  authoritativeCount: 0,
  scenarioCount: 3,
  totalScenarios: 8,
  sourceTypes: ['wikipedia'],
  entityMentions: 3,
  contradictions: 0,
}

const FRESH_CONTENT_3: KnowledgeObjectInput = {
  id: 'fresh-content-3',
  category: 'Release',
  content: 'Q'.repeat(60),
  status: 'verified',
  lastUpdated: '2026-06-20',  // 25 days before reference
  citationCount: 1,
  authoritativeCount: 0,
  scenarioCount: 3,
  totalScenarios: 8,
  sourceTypes: ['wikipedia'],
  entityMentions: 3,
  contradictions: 0,
}

// ── Category 5: Stale content (3 objects) ─────────────────────────────────
// content.length=60, citationCount=1, authoritativeCount=0, scenarioCount=3,
// totalScenarios=8, sourceTypes=["wikipedia"], entityMentions=3,
// contradictions=0, lastUpdated > 180 days before reference

const STALE_CONTENT_1: KnowledgeObjectInput = {
  id: 'stale-content-1',
  category: 'Archive',
  content: 'R'.repeat(60),
  status: 'verified',
  lastUpdated: '2025-12-27',  // ~200 days before reference
  citationCount: 1,
  authoritativeCount: 0,
  scenarioCount: 3,
  totalScenarios: 8,
  sourceTypes: ['wikipedia'],
  entityMentions: 3,
  contradictions: 0,
}

const STALE_CONTENT_2: KnowledgeObjectInput = {
  id: 'stale-content-2',
  category: 'Legacy',
  content: 'S'.repeat(60),
  status: 'verified',
  lastUpdated: '2025-07-15',  // ~365 days before reference
  citationCount: 1,
  authoritativeCount: 0,
  scenarioCount: 3,
  totalScenarios: 8,
  sourceTypes: ['wikipedia'],
  entityMentions: 3,
  contradictions: 0,
}

const STALE_CONTENT_3: KnowledgeObjectInput = {
  id: 'stale-content-3',
  category: 'Deprecated',
  content: 'T'.repeat(60),
  status: 'outdated',
  lastUpdated: '2024-07-15',  // ~730 days before reference
  citationCount: 1,
  authoritativeCount: 0,
  scenarioCount: 3,
  totalScenarios: 8,
  sourceTypes: ['wikipedia'],
  entityMentions: 3,
  contradictions: 0,
}

// ── Category 6: Authoritative sources (3 objects) ─────────────────────────
// sourceTypes contains "official_website" or "government" or "academic"

const AUTHORITATIVE_1: KnowledgeObjectInput = {
  id: 'authoritative-1',
  category: 'Government',
  content: 'U'.repeat(80),
  status: 'verified',
  lastUpdated: '2026-06-01',  // 44 days before reference (30-90 -> 0 delta)
  citationCount: 3,
  authoritativeCount: 1,
  scenarioCount: 4,
  totalScenarios: 8,
  sourceTypes: ['government', 'official_website'],
  entityMentions: 5,
  contradictions: 0,
}

const AUTHORITATIVE_2: KnowledgeObjectInput = {
  id: 'authoritative-2',
  category: 'Academic',
  content: 'V'.repeat(80),
  status: 'verified',
  lastUpdated: '2026-05-15',  // 61 days before reference (30-90 -> 0 delta)
  citationCount: 4,
  authoritativeCount: 2,
  scenarioCount: 5,
  totalScenarios: 8,
  sourceTypes: ['academic', 'official_website'],
  entityMentions: 6,
  contradictions: 0,
}

const AUTHORITATIVE_3: KnowledgeObjectInput = {
  id: 'authoritative-3',
  category: 'Standards',
  content: 'W'.repeat(80),
  status: 'verified',
  lastUpdated: '2026-03-01',  // 136 days before reference (90-180 -> -10 delta)
  citationCount: 2,
  authoritativeCount: 1,
  scenarioCount: 3,
  totalScenarios: 8,
  sourceTypes: ['official_website', 'government'],
  entityMentions: 4,
  contradictions: 0,
}

// ── Category 7: Contradictory entities (3 objects) ────────────────────────
// contradictions=1~3

const CONTRADICTORY_1: KnowledgeObjectInput = {
  id: 'contradictory-1',
  category: 'Debate',
  content: 'X'.repeat(60),
  status: 'pending',
  lastUpdated: '2026-02-01',  // ~164 days before reference (90-180 -> -10 delta)
  citationCount: 1,
  authoritativeCount: 0,
  scenarioCount: 3,
  totalScenarios: 8,
  sourceTypes: ['wikipedia'],
  entityMentions: 5,
  contradictions: 1,
}

const CONTRADICTORY_2: KnowledgeObjectInput = {
  id: 'contradictory-2',
  category: 'Controversy',
  content: 'Y'.repeat(60),
  status: 'pending',
  lastUpdated: '2026-01-15',  // ~181 days before reference (>180 -> -20 delta)
  citationCount: 2,
  authoritativeCount: 0,
  scenarioCount: 2,
  totalScenarios: 8,
  sourceTypes: ['wikipedia', 'user_forum'],
  entityMentions: 6,
  contradictions: 2,
}

const CONTRADICTORY_3: KnowledgeObjectInput = {
  id: 'contradictory-3',
  category: 'Unresolved',
  content: 'Z'.repeat(60),
  status: 'outdated',
  lastUpdated: '2025-12-01',  // ~226 days before reference (>180 -> -20 delta)
  citationCount: 0,
  authoritativeCount: 0,
  scenarioCount: 2,
  totalScenarios: 8,
  sourceTypes: ['user_forum'],
  entityMentions: 4,
  contradictions: 3,
}

// ── Category 8: No scenario coverage (2 objects) ──────────────────────────
// scenarioCount=0

const NO_COVERAGE_1: KnowledgeObjectInput = {
  id: 'no-coverage-1',
  category: 'Niche',
  content: 'Aa'.repeat(25),
  status: 'pending',
  lastUpdated: '2026-04-10',  // 96 days before reference (90-180 -> -10 delta)
  citationCount: 1,
  authoritativeCount: 0,
  scenarioCount: 0,
  totalScenarios: 8,
  sourceTypes: ['wikipedia'],
  entityMentions: 2,
  contradictions: 0,
}

const NO_COVERAGE_2: KnowledgeObjectInput = {
  id: 'no-coverage-2',
  category: 'Obscure',
  content: 'Bb'.repeat(25),
  status: 'pending',
  lastUpdated: '2026-04-10',  // 96 days before reference (90-180 -> -10 delta)
  citationCount: 1,
  authoritativeCount: 0,
  scenarioCount: 0,
  totalScenarios: 8,
  sourceTypes: ['user_forum'],
  entityMentions: 2,
  contradictions: 0,
}

// ── Category 9: Edge - empty content (1 object) ───────────────────────────
// content="", citationCount=0, scenarioCount=0, entityMentions=0

const EDGE_EMPTY_CONTENT: KnowledgeObjectInput = {
  id: 'edge-empty-content',
  category: 'Unknown',
  content: '',
  status: 'pending',
  lastUpdated: '2026-04-01',  // 105 days before reference (90-180 -> -10 delta)
  citationCount: 0,
  authoritativeCount: 0,
  scenarioCount: 0,
  totalScenarios: 8,
  sourceTypes: [],
  entityMentions: 0,
  contradictions: 0,
}

// ── Category 10: Edge - very long content (1 object) ──────────────────────
// content.length=250, citationCount=8, scenarioCount=8, entityMentions=15

const EDGE_VERY_LONG_CONTENT: KnowledgeObjectInput = {
  id: 'edge-very-long-content',
  category: 'Comprehensive',
  content: 'Cc'.repeat(125),
  status: 'verified',
  lastUpdated: '2026-06-15',  // 30 days before reference (30-90 -> 0 delta)
  citationCount: 8,
  authoritativeCount: 3,
  scenarioCount: 8,
  totalScenarios: 8,
  sourceTypes: ['academic', 'official_website', 'government'],
  entityMentions: 15,
  contradictions: 0,
}

// ── Category 11: Unknown freshness (1 object) ─────────────────────────────
// lastUpdated=null

const UNKNOWN_FRESHNESS: KnowledgeObjectInput = {
  id: 'unknown-freshness',
  category: 'Historical',
  content: 'Dd'.repeat(25),
  status: 'pending',
  lastUpdated: null,
  citationCount: 2,
  authoritativeCount: 0,
  scenarioCount: 3,
  totalScenarios: 8,
  sourceTypes: ['wikipedia'],
  entityMentions: 3,
  contradictions: 0,
}

// ── All Dataset ─────────────────────────────────────────────────────────────

export const GOLDEN_DATASET: KnowledgeObjectInput[] = [
  HIGH_QUALITY_1,
  HIGH_QUALITY_2,
  HIGH_QUALITY_3,
  HIGH_QUALITY_4,
  HIGH_QUALITY_5,
  MODERATE_QUALITY_1,
  MODERATE_QUALITY_2,
  MODERATE_QUALITY_3,
  MODERATE_QUALITY_4,
  MODERATE_QUALITY_5,
  LOW_QUALITY_1,
  LOW_QUALITY_2,
  LOW_QUALITY_3,
  LOW_QUALITY_4,
  FRESH_CONTENT_1,
  FRESH_CONTENT_2,
  FRESH_CONTENT_3,
  STALE_CONTENT_1,
  STALE_CONTENT_2,
  STALE_CONTENT_3,
  AUTHORITATIVE_1,
  AUTHORITATIVE_2,
  AUTHORITATIVE_3,
  CONTRADICTORY_1,
  CONTRADICTORY_2,
  CONTRADICTORY_3,
  NO_COVERAGE_1,
  NO_COVERAGE_2,
  EDGE_EMPTY_CONTENT,
  EDGE_VERY_LONG_CONTENT,
  UNKNOWN_FRESHNESS,
]

export default GOLDEN_DATASET
