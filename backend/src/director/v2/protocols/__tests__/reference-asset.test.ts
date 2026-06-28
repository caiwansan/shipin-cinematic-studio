import { describe, it, expect } from 'vitest';
import {
  AssetNode,
  AssetRevision,
  Asset,
  NodeType,
  RevisionStatus,
  createAssetId,
  createAssetNodeId,
  createAssetRevisionId,
} from '../reference/asset-graph';
import {
  ResolvePolicy,
  ReferenceCoverage,
  ReferenceAssignment,
  ReferenceGap,
} from '../reference/reference-assignment';
import { ReferenceBinding } from '../reference/reference-binding';

describe('AssetNode — DAG Structure', () => {
  it('builds an AssetNode with parent and related links', () => {
    const parentId = createAssetNodeId();
    const relatedId = createAssetNodeId();

    const node: AssetNode = {
      id: createAssetNodeId(),
      type: NodeType.CHARACTER,
      label: 'Character A — Main appearance',
      parentNodeIds: [parentId],
      relatedNodeIds: [relatedId],
      currentRevisionId: createAssetRevisionId(),
      revisionIds: [],
      segmentId: 'seg-001',
      tags: ['protagonist', 'main'],
    };

    expect(node.parentNodeIds).toHaveLength(1);
    expect(node.relatedNodeIds).toHaveLength(1);
    expect(node.type).toBe(NodeType.CHARACTER);
  });
});

describe('AssetRevision — Version Chain', () => {
  it('builds a revision chain', () => {
    const rev1: AssetRevision = {
      id: createAssetRevisionId(),
      versionNumber: 1,
      assetId: createAssetId(),
      status: RevisionStatus.PUBLISHED,
      locked: true,
      changeLog: 'Initial version',
      createdAt: new Date().toISOString(),
    };

    const rev2: AssetRevision = {
      id: createAssetRevisionId(),
      versionNumber: 2,
      assetId: createAssetId(),
      previousRevisionId: rev1.id,
      status: RevisionStatus.PUBLISHED,
      locked: false,
      changeLog: 'Updated expression',
      createdAt: new Date().toISOString(),
    };

    expect(rev2.previousRevisionId).toBe(rev1.id);
    expect(rev2.versionNumber).toBe(rev1.versionNumber + 1);
  });
});

describe('ReferenceCoverage — Gap Detection', () => {
  it('detects critical gaps', () => {
    const coverage: ReferenceCoverage = {
      characterCoverage: 0.3,
      sceneCoverage: 0.8,
      shotCoverage: 0.5,
      overallScore: 0.4,
      hasCriticalGaps: true,
      actionRequired: 'request_asset_generation',
      gaps: [
        {
          assetNodeId: createAssetNodeId(),
          severity: 'critical',
          description: 'Missing character A reference image',
        },
      ],
    };

    expect(coverage.hasCriticalGaps).toBe(true);
    expect(coverage.actionRequired).toBe('request_asset_generation');
  });
});

describe('ReferenceBinding — Bridge Type', () => {
  it('builds a locked binding', () => {
    const binding: ReferenceBinding = {
      id: 'binding-001' as any,
      assetNodeId: createAssetNodeId(),
      usage: 'character_reference',
      relevance: 0.9,
      locked: true,
      expectedCoverage: 0.85,
    };

    expect(binding.locked).toBe(true);
    expect(binding.usage).toBe('character_reference');
  });
});
