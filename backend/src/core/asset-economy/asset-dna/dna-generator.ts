import { prisma } from '../../../utils/index.js';
import crypto from 'crypto';

export interface DnaMetadata {
  promptStructure?: string;
  styleVector?: string;
  characterEmbedding?: string;
  compositionVector?: string;
  colorDistribution?: string;
  modelInfo?: string;
  workflowInfo?: string;
  parentAssetIds?: string[];
}

export interface AssetDnaResult {
  id: string;
  assetId: string;
  creatorId: string;
  projectId: string;
  type: string;
  promptStructure: string | null;
  styleVector: string | null;
  characterEmbedding: string | null;
  compositionVector: string | null;
  colorDistribution: string | null;
  modelInfo: string | null;
  workflowInfo: string | null;
  createdAt: Date;
}

/**
 * 生成资产 DNA — 基于元数据提取数字指纹并保存到数据库
 */
export async function generateAssetDna(
  assetId: string,
  creatorId: string,
  projectId: string,
  type: string,
  metadata: DnaMetadata = {}
): Promise<AssetDnaResult> {
  try {
    // 生成 prompt 结构指纹（简单 hash）
    const promptHash = metadata.promptStructure
      ? crypto.createHash('sha256').update(metadata.promptStructure).digest('hex').substring(0, 32)
      : null;

    const dna = await prisma.assetDna.create({
      data: {
        assetId,
        creatorId,
        projectId,
        type,
        promptStructure: promptHash,
        styleVector: metadata.styleVector ?? null,
        characterEmbedding: metadata.characterEmbedding ?? null,
        compositionVector: metadata.compositionVector ?? null,
        colorDistribution: metadata.colorDistribution ?? null,
        modelInfo: metadata.modelInfo ?? null,
        workflowInfo: metadata.workflowInfo ?? null,
      },
    });

    return dna;
  } catch (error: any) {
    throw new Error(`生成资产 DNA 失败: ${error.message}`);
  }
}

/**
 * 根据资产 ID 查询 DNA
 */
export async function getDnaByAssetId(assetId: string): Promise<AssetDnaResult | null> {
  try {
    const dna = await prisma.assetDna.findUnique({
      where: { assetId },
    });
    return dna;
  } catch (error: any) {
    throw new Error(`查询资产 DNA 失败: ${error.message}`);
  }
}

/**
 * 内部工具：计算字符串 hash
 */
export function hashString(input: string): string {
  return crypto.createHash('sha256').update(input).digest('hex');
}
