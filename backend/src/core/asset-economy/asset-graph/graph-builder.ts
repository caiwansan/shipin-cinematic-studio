import { prisma } from '../../../utils/index.js';
import { getLineageTree, getLineageNode } from '../lineage-engine/lineage-tracker.js';
import { getDnaByAssetId } from '../asset-dna/dna-generator.js';
import { getContributions } from '../attribution-engine/contribution-calc.js';

export interface GraphNode {
  id: string;
  type: 'creator' | 'image' | 'video' | 'character' | 'scene' | 'prop' | 'asset';
  label: string;
  metadata?: Record<string, any>;
}

export interface GraphEdge {
  source: string;
  target: string;
  type: 'created' | 'referenced' | 'inherited' | 'modified' | 'monetized';
  weight?: number;
  label?: string;
}

export interface AssetGraph {
  nodes: GraphNode[];
  edges: GraphEdge[];
  rootAssetId: string;
}

/**
 * 构建资产关系图谱
 */
export async function buildAssetGraph(assetId: string): Promise<AssetGraph> {
  try {
    const nodes: Map<string, GraphNode> = new Map();
    const edges: GraphEdge[] = [];
    const visited = new Set<string>();

    // 添加根资产节点
    const dna = await getDnaByAssetId(assetId);
    nodes.set(assetId, {
      id: assetId,
      type: mapAssetType(dna?.type || 'asset'),
      label: dna?.type || 'Asset',
      metadata: dna ? { type: dna.type, modelInfo: dna.modelInfo } : undefined,
    });

    // 递归遍历谱系树
    await traverseLineage(assetId, nodes, edges, visited, 0, 3); // max depth 3

    // 如果有贡献度信息，添加创作者节点
    try {
      const contributions = await getContributions(assetId);
      for (const contrib of contributions) {
        const creatorId = contrib.creatorId;
        if (!nodes.has(creatorId)) {
          nodes.set(creatorId, {
            id: creatorId,
            type: 'creator',
            label: `Creator:${creatorId.substring(0, 8)}`,
          });
        }
        edges.push({
          source: creatorId,
          target: assetId,
          type: 'created',
          weight: contrib.contributionScore,
          label: `contribution ${(contrib.contributionScore * 100).toFixed(0)}%`,
        });
      }
    } catch {
      // 忽略贡献度获取错误
    }

    return {
      nodes: Array.from(nodes.values()),
      edges,
      rootAssetId: assetId,
    };
  } catch (error: any) {
    throw new Error(`构建资产关系图谱失败: ${error.message}`);
  }
}

/**
 * 递归遍历血缘树
 */
async function traverseLineage(
  assetId: string,
  nodes: Map<string, GraphNode>,
  edges: GraphEdge[],
  visited: Set<string>,
  depth: number,
  maxDepth: number
): Promise<void> {
  if (depth >= maxDepth || visited.has(assetId)) return;
  visited.add(assetId);

  try {
    const lineage = await getLineageNode(assetId);
    if (!lineage) return;

    // 遍历父资产
    for (const parentId of lineage.parentAssetIds) {
      if (!nodes.has(parentId)) {
        const parentDna = await getDnaByAssetId(parentId);
        nodes.set(parentId, {
          id: parentId,
          type: mapAssetType(parentDna?.type || 'asset'),
          label: parentDna?.type || 'Parent',
        });
      }

      edges.push({
        source: parentId,
        target: assetId,
        type: 'inherited',
        weight: Math.max(0, 1 - depth * 0.3),
        label: `depth ${depth + 1}`,
      });

      await traverseLineage(parentId, nodes, edges, visited, depth + 1, maxDepth);
    }

    // 查找引用记录
    const references = await prisma.assetReference.findMany({
      where: { targetAssetId: assetId },
      take: 10,
    });

    for (const ref of references) {
      if (!nodes.has(ref.sourceAssetId)) {
        const refDna = await getDnaByAssetId(ref.sourceAssetId);
        nodes.set(ref.sourceAssetId, {
          id: ref.sourceAssetId,
          type: mapAssetType(refDna?.type || 'asset'),
          label: refDna?.type || 'Source',
        });
      }

      edges.push({
        source: ref.sourceAssetId,
        target: assetId,
        type: 'referenced',
        weight: ref.coinsPaid > 0 ? Math.min(1, ref.coinsPaid / 100) : 0.5,
        label: ref.referenceType,
      });
    }
  } catch {
    // 忽略遍历错误
  }
}

/**
 * 将资产类型映射到图节点类型
 */
function mapAssetType(type: string): GraphNode['type'] {
  switch (type) {
    case 'image': return 'image';
    case 'video': return 'video';
    case 'character': return 'character';
    case 'scene': return 'scene';
    case 'prop': return 'prop';
    default: return 'asset';
  }
}
