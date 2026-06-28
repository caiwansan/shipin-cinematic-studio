import { prisma } from '../../../utils/index.js';

export type AssetAction = 'view' | 'reuse' | 'download' | 'commercial';

/**
 * 为新建资产初始化权限
 */
export async function initRights(assetId: string, isExternal: boolean = false) {
  try {
    const rights = await prisma.assetRights.upsert({
      where: { assetId },
      update: {},
      create: {
        assetId,
        publicView: true,
        reuseAllowed: true,
        downloadAllowed: false,
        commercialAllowed: false,
        externalAsset: isExternal,
      },
    });
    return rights;
  } catch (error: any) {
    throw new Error(`初始化资产权限失败: ${error.message}`);
  }
}

/**
 * 检查某操作是否被允许
 */
export async function checkAllowed(assetId: string, action: AssetAction): Promise<boolean> {
  try {
    const rights = await prisma.assetRights.findUnique({
      where: { assetId },
    });

    if (!rights) {
      // 默认允许 publicView 和 reuse
      if (action === 'view') return true;
      if (action === 'reuse') return true;
      return false;
    }

    switch (action) {
      case 'view':
        return rights.publicView;
      case 'reuse':
        return rights.reuseAllowed;
      case 'download':
        return rights.downloadAllowed;
      case 'commercial':
        return rights.commercialAllowed;
      default:
        return false;
    }
  } catch (error: any) {
    throw new Error(`检查资产权限失败: ${error.message}`);
  }
}

/**
 * 更新资产权限
 */
export async function updateRights(
  assetId: string,
  updates: {
    publicView?: boolean;
    reuseAllowed?: boolean;
    downloadAllowed?: boolean;
    commercialAllowed?: boolean;
    externalAsset?: boolean;
  }
) {
  try {
    const rights = await prisma.assetRights.upsert({
      where: { assetId },
      update: updates,
      create: {
        assetId,
        publicView: updates.publicView ?? true,
        reuseAllowed: updates.reuseAllowed ?? true,
        downloadAllowed: updates.downloadAllowed ?? false,
        commercialAllowed: updates.commercialAllowed ?? false,
        externalAsset: updates.externalAsset ?? false,
      },
    });
    return rights;
  } catch (error: any) {
    throw new Error(`更新资产权限失败: ${error.message}`);
  }
}

/**
 * 查询资产权限
 */
export async function getRights(assetId: string) {
  try {
    const rights = await prisma.assetRights.findUnique({
      where: { assetId },
    });
    return rights;
  } catch (error: any) {
    throw new Error(`查询资产权限失败: ${error.message}`);
  }
}
