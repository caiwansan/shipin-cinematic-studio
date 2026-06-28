import { prisma } from '../../../utils/index.js';

export interface LineageNode {
  assetId: string;
  parentAssetIds: string[];
  rootAssetId: string | null;
  lineageDepth: number;
  creatorChain: Array<{ creatorId: string; depth: number }>;
  createdAt: Date;
}

export interface LineageTree {
  asset: LineageNode;
  parents: LineageTree[];
  children: LineageTree[];
}

/**
 * 追踪资产血缘关系 — 记录新资产的继承链
 */
export async function trackLineage(
  newAssetId: string,
  parentAssetIds: string[],
  userId: string
): Promise<LineageNode> {
  try {
    // 从父资产递归查找 rootAssetId 和最大 depth
    let rootAssetId: string | null = null;
    let maxDepth = 0;
    let allCreatorEntries: Array<{ creatorId: string; depth: number }> = [];

    if (parentAssetIds.length > 0) {
      const existingLineages = await prisma.assetLineage.findMany({
        where: { assetId: { in: parentAssetIds } },
      });

      for (const lineage of existingLineages) {
        // 获取根资产（取最深祖先）
        if (lineage.rootAssetId) {
          rootAssetId = lineage.rootAssetId;
        } else {
          rootAssetId = lineage.assetId;
        }
        // 计算深度 = 父资产最大深度 + 1
        maxDepth = Math.max(maxDepth, lineage.lineageDepth + 1);

        // 解析创作者链
        if (lineage.creatorChain) {
          try {
            const chain: Array<{ creatorId: string; depth: number }> = JSON.parse(lineage.creatorChain);
            allCreatorEntries.push(...chain);
          } catch {
            // 忽略解析错误
          }
        }
      }
    } else {
      // 无父资产，自己是根
      rootAssetId = newAssetId;
      maxDepth = 0;
    }

    // 添加上一次创作者（用户自己）
    allCreatorEntries.push({ creatorId: userId, depth: maxDepth });

    // 去重：同一创作者保留最高 depth（最近）
    const creatorMap = new Map<string, number>();
    for (const entry of allCreatorEntries) {
      const existing = creatorMap.get(entry.creatorId);
      if (existing === undefined || entry.depth > existing) {
        creatorMap.set(entry.creatorId, entry.depth);
      }
    }
    const creatorChain = Array.from(creatorMap.entries()).map(([creatorId, depth]) => ({
      creatorId,
      depth,
    }));

    const lineage = await prisma.assetLineage.upsert({
      where: { assetId: newAssetId },
      update: {
        parentAssetIds: JSON.stringify(parentAssetIds),
        rootAssetId,
        lineageDepth: maxDepth,
        creatorChain: JSON.stringify(creatorChain),
      },
      create: {
        assetId: newAssetId,
        parentAssetIds: JSON.stringify(parentAssetIds),
        rootAssetId,
        lineageDepth: maxDepth,
        creatorChain: JSON.stringify(creatorChain),
      },
    });

    return {
      assetId: lineage.assetId,
      parentAssetIds: lineage.parentAssetIds ? JSON.parse(lineage.parentAssetIds) : [],
      rootAssetId: lineage.rootAssetId,
      lineageDepth: lineage.lineageDepth,
      creatorChain: lineage.creatorChain ? JSON.parse(lineage.creatorChain) : [],
      createdAt: lineage.createdAt,
    };
  } catch (error: any) {
    throw new Error(`追踪资产血缘失败: ${error.message}`);
  }
}

/**
 * 获取资产的完整谱系树
 */
export async function getLineageTree(assetId: string): Promise<LineageTree> {
  try {
    const node = await getLineageNode(assetId);
    if (!node) {
      throw new Error(`资产 ${assetId} 的血缘记录不存在`);
    }

    // 构建树：找出所有子节点（引用此资产的）
    const children = await prisma.assetLineage.findMany({
      where: {
        parentAssetIds: {
          contains: assetId,
        },
      },
    });

    const parentTrees: LineageTree[] = [];
    for (const parentId of node.parentAssetIds) {
      try {
        const parentTree = await getLineageTree(parentId);
        parentTrees.push(parentTree);
      } catch {
        // 父资产可能没有血缘记录，跳过
      }
    }

    const childTrees: LineageTree[] = [];
    for (const child of children) {
      try {
        const childTree = await getLineageTree(child.assetId);
        childTrees.push(childTree);
      } catch {
        // 跳过
      }
    }

    return {
      asset: node,
      parents: parentTrees,
      children: childTrees,
    };
  } catch (error: any) {
    throw new Error(`获取谱系树失败: ${error.message}`);
  }
}

/**
 * 获取单个资产的血缘节点
 */
export async function getLineageNode(assetId: string): Promise<LineageNode | null> {
  try {
    const lineage = await prisma.assetLineage.findUnique({
      where: { assetId },
    });
    if (!lineage) return null;

    return {
      assetId: lineage.assetId,
      parentAssetIds: lineage.parentAssetIds ? JSON.parse(lineage.parentAssetIds) : [],
      rootAssetId: lineage.rootAssetId,
      lineageDepth: lineage.lineageDepth,
      creatorChain: lineage.creatorChain ? JSON.parse(lineage.creatorChain) : [],
      createdAt: lineage.createdAt,
    };
  } catch (error: any) {
    throw new Error(`查询血缘节点失败: ${error.message}`);
  }
}
