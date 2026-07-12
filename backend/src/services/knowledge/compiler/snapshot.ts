// ============================================================================
// KH-RC2 M5 — Knowledge Snapshot
// 基于 Knowledge Compiler（M4）的输出，记录每次编译的状态快照
// ============================================================================

import * as crypto from 'crypto';
import {
  compileKnowledgePackage,
} from './index';

import type {
  CompiledKnowledgePackage,
} from './index';

// ── 接口定义 ──────────────────────────────────────────────────────────────

export interface KnowledgeSnapshot {
  version: string;            // Package version
  contentHash: string;        // SHA-256 of content
  compiledAt: string;         // ISO timestamp
  sourceRevision: string;     // Source data version
  stats: {
    brandCount: number;
    productCount: number;
    articleCount: number;
    entityCount: number;
    publicationCount: number;
    jsonLdTypes: string[];    // e.g. ['Organization', 'Product', 'Article']
    promptTypes: string[];     // e.g. ['llmSummary', 'citationBlock']
  };
}

export interface SnapshotDiff {
  version: string;
  comparedTo: string;
  changes: {
    field: string;
    before: any;
    after: any;
  }[];
  statsChanged: {
    field: string;
    before: number;
    after: number;
    delta: number;
  }[];
  hashChanged: boolean;
}

// ── 内存存储 ──────────────────────────────────────────────────────────────

const snapshotStore = new Map<string, KnowledgeSnapshot>();
let latestVersion: string | null = null;

// ── 内部工具 ──────────────────────────────────────────────────────────────

/**
 * 从编译结果中提取 JSON-LD 类型列表
 * 检查 jsonld 对象中各字段是否存在，返回对应的 Schema.org 类型名
 */
function extractJsonLdTypes(compiled: CompiledKnowledgePackage): string[] {
  const types: string[] = [];
  const { jsonld } = compiled.data;

  if (jsonld.organization) {
    types.push('Organization');
  }
  if (Array.isArray(jsonld.products) && jsonld.products.length > 0) {
    types.push('Product');
  }
  if (Array.isArray(jsonld.articles) && jsonld.articles.length > 0) {
    types.push('Article');
  }
  // FAQ is always present (may be empty object, but buildFaqJsonLd always returns a valid object)
  if (jsonld.faq) {
    types.push('FAQ');
  }

  return types;
}

/**
 * 从编译结果中提取 Prompt 类型列表
 * Compiler 始终生成以下 5 种 Prompt Block
 */
function extractPromptTypes(_compiled: CompiledKnowledgePackage): string[] {
  // 固定 5 种 Prompt Block，由 M3 (Prompt Block Builder) 定义
  return ['llmSummary', 'citationBlock', 'retrievalContext', 'canonicalFacts', 'faqPrompt'];
}

/**
 * 从 CompiledKnowledgePackage 构造 KnowledgeSnapshot
 */
function packageToSnapshot(pkg: CompiledKnowledgePackage): KnowledgeSnapshot {
  return {
    version: pkg.meta.version,
    contentHash: pkg.meta.contentHash,
    compiledAt: pkg.meta.compiledAt,
    sourceRevision: pkg.meta.sourceRevision,
    stats: {
      brandCount: pkg.summary.brandCount,
      productCount: pkg.summary.productCount,
      articleCount: pkg.summary.articleCount,
      entityCount: pkg.summary.entityCount,
      publicationCount: pkg.summary.publicationCount,
      jsonLdTypes: extractJsonLdTypes(pkg),
      promptTypes: extractPromptTypes(pkg),
    },
  };
}

// ── 导出函数 ──────────────────────────────────────────────────────────────

/**
 * 创建快照 — 调用 Compiler 并保存元数据
 *
 * 流程：
 * 1. 调用 compileKnowledgePackage(options)
 * 2. 构造 KnowledgeSnapshot（stats from compiledPackage）
 * 3. 如果 !force 且存在相同 contentHash 的快照，返回已有的而不创建新的
 * 4. 存入 snapshotStore，更新 latestVersion
 * 5. 返回 KnowledgeSnapshot
 */
export async function createSnapshot(options?: {
  version?: string;
  force?: boolean;       // 即使内容和上次一样也创建新的
}): Promise<KnowledgeSnapshot> {
  // 1. 调用 Compiler
  const compiled = await compileKnowledgePackage(options ? { version: options.version } : undefined);

  // 2. 构造快照
  const snapshot = packageToSnapshot(compiled);

  // 3. 去重检查（非 force 模式下）
  if (!options?.force) {
    for (const [, existing] of snapshotStore) {
      if (existing.contentHash === snapshot.contentHash) {
        return existing;
      }
    }
  }

  // 4. 存入 store
  const version = snapshot.version;
  snapshotStore.set(version, snapshot);
  latestVersion = version;

  return snapshot;
}

/**
 * 比较两个版本的快照差异
 *
 * 流程：
 * 1. 从 store 获取两个版本的快照
 * 2. 比较 stats 字段，计算 delta
 * 3. 比较 contentHash
 * 4. 返回 SnapshotDiff
 */
export async function diffSnapshots(
  versionA: string,
  versionB: string,
): Promise<SnapshotDiff> {
  const snapshotA = snapshotStore.get(versionA);
  const snapshotB = snapshotStore.get(versionB);

  if (!snapshotA) {
    throw new Error(`Snapshot not found: ${versionA}`);
  }
  if (!snapshotB) {
    throw new Error(`Snapshot not found: ${versionB}`);
  }

  // 比较 hash
  const hashChanged = snapshotA.contentHash !== snapshotB.contentHash;

  // 比较元数据字段
  const changes: { field: string; before: any; after: any }[] = [];

  if (snapshotA.version !== snapshotB.version) {
    changes.push({ field: 'version', before: snapshotA.version, after: snapshotB.version });
  }
  if (snapshotA.compiledAt !== snapshotB.compiledAt) {
    changes.push({ field: 'compiledAt', before: snapshotA.compiledAt, after: snapshotB.compiledAt });
  }
  if (snapshotA.sourceRevision !== snapshotB.sourceRevision) {
    changes.push({ field: 'sourceRevision', before: snapshotA.sourceRevision, after: snapshotB.sourceRevision });
  }

  // 比较 JSON-LD 类型（数组）
  const addedTypes = snapshotB.stats.jsonLdTypes.filter(
    (t) => !snapshotA.stats.jsonLdTypes.includes(t),
  );
  const removedTypes = snapshotA.stats.jsonLdTypes.filter(
    (t) => !snapshotB.stats.jsonLdTypes.includes(t),
  );
  if (addedTypes.length > 0 || removedTypes.length > 0) {
    changes.push({
      field: 'jsonLdTypes',
      before: snapshotA.stats.jsonLdTypes,
      after: snapshotB.stats.jsonLdTypes,
    });
  }

  // 比较 Prompt 类型（数组）
  const addedPrompts = snapshotB.stats.promptTypes.filter(
    (t) => !snapshotA.stats.promptTypes.includes(t),
  );
  const removedPrompts = snapshotA.stats.promptTypes.filter(
    (t) => !snapshotB.stats.promptTypes.includes(t),
  );
  if (addedPrompts.length > 0 || removedPrompts.length > 0) {
    changes.push({
      field: 'promptTypes',
      before: snapshotA.stats.promptTypes,
      after: snapshotB.stats.promptTypes,
    });
  }

  // 比较数值字段，计算 delta
  const numericFields: (keyof typeof snapshotA.stats & string)[] = [
    'brandCount',
    'productCount',
    'articleCount',
    'entityCount',
    'publicationCount',
  ];

  const statsChanged: { field: string; before: number; after: number; delta: number }[] = [];

  for (const field of numericFields) {
    const before = snapshotA.stats[field] as number;
    const after = snapshotB.stats[field] as number;
    if (before !== after) {
      statsChanged.push({
        field,
        before,
        after,
        delta: after - before,
      });
    }
  }

  return {
    version: snapshotB.version,
    comparedTo: snapshotA.version,
    changes,
    statsChanged,
    hashChanged,
  };
}

/**
 * 获取最新快照
 */
export async function getLatestSnapshot(): Promise<KnowledgeSnapshot | null> {
  if (latestVersion === null) {
    return null;
  }
  return snapshotStore.get(latestVersion) ?? null;
}

/**
 * 列出所有历史快照版本
 */
export async function listSnapshots(): Promise<{ version: string; compiledAt: string }[]> {
  const entries: { version: string; compiledAt: string }[] = [];
  for (const [, snapshot] of snapshotStore) {
    entries.push({
      version: snapshot.version,
      compiledAt: snapshot.compiledAt,
    });
  }
  // 按 compiledAt 降序排列（最新的在前）
  entries.sort((a, b) => b.compiledAt.localeCompare(a.compiledAt));
  return entries;
}

/**
 * 获取指定版本的快照
 */
export async function getSnapshot(version: string): Promise<KnowledgeSnapshot | null> {
  return snapshotStore.get(version) ?? null;
}
