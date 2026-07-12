# Audit J: 资产管理审计 (AssetAudit.md)

## 1. Asset 模型分布

昆仑镜存在至少 10 个资产相关模型:

| 模型 | 表 | 用途 |
|------|-----|------|
| `Asset` | asset | 通用资产 |
| `UnifiedAsset` | unified_asset | 统一资产管理 |
| `UnifiedAssetRelation` | unified_asset_relation | 资产关系 |
| `UnifiedAssetTag` | unified_asset_tag | 资产标签 |
| `UnifiedAssetVersion` | unified_asset_version | 资产版本 |
| `UserAsset` | user_asset | 用户资产 |
| `WorkspaceAsset` | workspace_asset | 工作区资产 |
| `AssetLike` | asset_like | 资产点赞 |
| `AssetComment` | asset_comment | 资产评论 |
| `AssetDna` | asset_dna | 资产 DNA |
| `AssetLineage` | asset_lineage | 资产谱系 |
| `AssetReference` | asset_reference | 资产引用 |
| `AssetRegistry` | asset_registry | 资产注册 |
| `AssetRights` | asset_rights | 资产权限 |
| `AssetVariant` | asset_variant | 资产变体 |
| `AssetVersion` | asset_version | 资产版本 |
| `AssetTransaction` | asset_transaction | 资产交易 |
| `AssetGraphEdge` | asset_graph_edge | 资产图谱 |
| `LocalAssetIndex` | local_asset_index | 本地资产索引 |

## 2. Asset Manager 审计

### 2.1 是否有唯一的 Asset Manager?

**结论: 无**

| Asset Manager | 路径 | 范围 |
|--------------|------|------|
| `services/asset/` | `backend/src/services/asset/` | 通用资产服务 |
| `core/asset-economy/` | `backend/src/core/asset-economy/` | 资产经济 |
| `routes/asset/` | `backend/src/routes/asset/` | 资产路由 |
| `modules/asset/` | `frontend/modules/asset/` | 前端资产模块 |
| Platform Workspace Asset | `services/platform/workspace/` | 平台资产 |

### 2.2 功能重叠

| 功能 | 实现文件 | 数量 |
|------|---------|------|
| 资产 CRUD | `services/asset/` + `core/asset-economy/` + `routes/asset/` | 3 |
| 资产版本 | `UnifiedAssetVersion` + `AssetVersion` | 2 个不同模型 |
| 资产引用 | `AssetReference` + `UnifiedAssetRelation` | 2 个不同模型 |
| 前端资产 Store | `modules/asset/store/useAssetStore.ts` + `stores/projectStore.ts` | 2 |

## 3. 资产调用链

```
Page → Asset Components → Asset Store 
  → Asset Routes/Platform Workspace Routes 
    → Asset Service / Platform Workspace Service 
      → Prisma (Asset / UnifiedAsset / WorkspaceAsset 等模型)
```

## 4. 问题清单

| 问题 | 描述 | 严重等级 |
|------|------|----------|
| J-001 | 无唯一的 Asset Manager | HIGH |
| J-002 | 多 Asset 模型共存, 数据冗余 | HIGH |
| J-003 | Asset 和 UnifiedAsset 关系不明确 | MEDIUM |
| J-004 | 前端 asset store 分散在 modules/ 和 workspaces/ | MEDIUM |
| J-005 | 无统一的资产搜索/查询层 | MEDIUM |

## 5. 建议

1. **单一 Asset Manager**: 使用 `core/asset-economy/` 作为唯一的资产管理层
2. **统一 Asset 模型**: 合并 `Asset` / `UnifiedAsset` / `WorkspaceAsset`
3. **前端统一**: 资产操作通过统一 API 和 composable
4. **资产版本对齐**: 消除重复的版本模型
5. **资产图谱**: 使用 `AssetGraphEdge` 统一资产关系管理
