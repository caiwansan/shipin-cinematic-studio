// ============================================================================
// Asset Graph — DAG structure for visual assets
//
// AssetNode is the core unit. AssetRevision maintains version chains.
// Asset stores the actual binary data (content-addressed).
// ============================================================================

import { v4 as uuidv4 } from 'uuid';

// ── Identifiers ──────────────────────────────────────────────────────────────

export type AssetId = string & { readonly __brand: 'AssetId' };
export type AssetNodeId = string & { readonly __brand: 'AssetNodeId' };
export type AssetRevisionId = string & { readonly __brand: 'AssetRevisionId' };

export function createAssetId(): AssetId { return uuidv4() as AssetId; }
export function createAssetNodeId(): AssetNodeId { return uuidv4() as AssetNodeId; }
export function createAssetRevisionId(): AssetRevisionId { return uuidv4() as AssetRevisionId; }

// ── Node Type ────────────────────────────────────────────────────────────────

export enum NodeType {
  CHARACTER = 'CHARACTER',
  CHARACTER_GROUP = 'CHARACTER_GROUP',
  APPEARANCE_GROUP = 'APPEARANCE_GROUP',
  COSTUME = 'COSTUME',
  EXPRESSION = 'EXPRESSION',
  POSE = 'POSE',
  ENVIRONMENT = 'ENVIRONMENT',
  PROP = 'PROP',
  STYLE_FRAME = 'STYLE_FRAME',
  KEY_SHOT = 'KEY_SHOT',
  REFERENCE_IMAGE = 'REFERENCE_IMAGE',
}

// ── Asset (content-addressed binary) ─────────────────────────────────────────

export interface Asset {
  id: AssetId;
  /** Content hash (SHA-256) for deduplication */
  contentHash: string;
  /** MIME type */
  mimeType: string;
  /** Size in bytes */
  sizeBytes: number;
  /** Storage URL (blob store reference) */
  storageUrl: string;
  /** Thumbnail URL for preview */
  thumbnailUrl?: string;
  /** Optional metadata */
  metadata?: Record<string, unknown>;
}

// ── Asset Revision (version chain) ───────────────────────────────────────────

export enum RevisionStatus {
  DRAFT = 'DRAFT',
  PUBLISHED = 'PUBLISHED',
  DEPRECATED = 'DEPRECATED',
  LOCKED = 'LOCKED',
}

export interface AssetRevision {
  id: AssetRevisionId;
  versionNumber: number;  // 1, 2, 3... monotonic within asset node

  /** Pointer to the content */
  assetId: AssetId;

  /** Version chain links */
  previousRevisionId?: AssetRevisionId;
  nextRevisionId?: AssetRevisionId;

  /** Current status */
  status: RevisionStatus;

  /** Locked by user? Locked revisions are never removed by recovery */
  locked: boolean;

  /** Change notes */
  changeLog: string;

  /** Timestamp */
  createdAt: string; // ISO 8601
}

// ── Asset Node (DAG node) ────────────────────────────────────────────────────

export interface AssetNode {
  /** Unique node ID */
  id: AssetNodeId;
  /** Node type */
  type: NodeType;

  /** Human-readable label */
  label: string;

  /** DAG parent edges (a node can have multiple parents) */
  parentNodeIds: AssetNodeId[];

  /** Cross-graph references (e.g., key frame belongs to both character and scene) */
  relatedNodeIds: AssetNodeId[];

  /** Current revision (active/latest) */
  currentRevisionId: AssetRevisionId;

  /** Revision history (most recent first) */
  revisionIds: AssetRevisionId[];

  /** Project/segment this node belongs to */
  segmentId: string;

  /** Free-form tags */
  tags: string[];

  /** Any extra metadata */
  metadata?: Record<string, unknown>;
}

// ── IAssetRepository Contract ────────────────────────────────────────────────

export interface IAssetRepository {
  getAssetNode(id: AssetNodeId): Promise<AssetNode | null>;
  getRevision(id: AssetRevisionId): Promise<AssetRevision | null>;
  getAsset(id: AssetId): Promise<Asset | null>;
  storeAsset(asset: Asset): Promise<void>;
  createNode(node: AssetNode): Promise<AssetNode>;
  createRevision(nodeId: AssetNodeId, revision: AssetRevision): Promise<AssetRevision>;
  updateRevision(nodeId: AssetNodeId, revisionId: AssetRevisionId, revision: Partial<AssetRevision>): Promise<void>;
  linkParentNode(nodeId: AssetNodeId, parentId: AssetNodeId): Promise<void>;
  linkRelatedNode(nodeId: AssetNodeId, relatedId: AssetNodeId): Promise<void>;
  findNodesByType(type: NodeType, segmentId: string): Promise<AssetNode[]>;
  findNodesByTag(tag: string): Promise<AssetNode[]>;
}
