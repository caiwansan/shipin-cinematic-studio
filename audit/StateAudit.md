# Audit M: 前端状态管理审计 (StateAudit.md)

## 1. 状态管理方案分布

前端使用了以下状态管理方案:

| 方案 | 用途 | 文件数 |
|------|------|--------|
| Pinia (defineStore) | 全局应用状态 | 26+ stores |
| Vue Reactive (composables) | 业务逻辑状态 | 15+ composables |
| LocalStorage | 持久化前端数据 | 10+ 文件引用 |
| SessionStorage | 会话级数据 | 少量引用 |
| Component Ref/Reactive | 组件本地状态 | 大量 |
| Provide/Inject | 跨组件状态 | 少量 |
| Vue Router | URL 状态 | nuxt 内置 |

## 2. Pinia Store 清单 (26+)

### 2.1 主 Store

| Store 文件 | Store 名 | 用途 |
|-----------|---------|------|
| `stores/auth.ts` | auth | 用户认证 |
| `stores/projectStore.ts` | projectStore | 项目 (旧) |
| `stores/project.ts` | project | 项目 (新) |
| `stores/workbench.ts` | workbench | 工作台 |
| `stores/community/` | community | 社区 |

### 2.2 Module Store

| Store 文件 | Store 名 | 用途 |
|-----------|---------|------|
| `modules/asset/store/useAssetStore.ts` | asset | 资产 |
| `modules/goal/store/useGoalStore.ts` | goal | 目标 |
| `modules/knowledge-hub/stores/` | knowledgeHub | 知识库 |
| `modules/platform/agent/store/useAgentStore.ts` | platformAgent | Agent |
| `modules/platform/capability/store/useCapabilityStore.ts` | capability | 能力 |
| `modules/platform/execution/store/useExecutionStore.ts` | execution | 执行 |
| `modules/platform/governance/store/useGovernanceStore.ts` | governance | 治理 |
| `modules/platform/resource/store/useResourceStore.ts` | resource | 资源 |
| `modules/platform/workflow/store/useWorkflowStore.ts` | workflow | 工作流 |
| `modules/platform/workspace/store/useWorkspaceStore.ts` | workspace | 工作区 |
| `modules/semantic/store/useSemanticStore.ts` | semantic | 语义 |

### 2.3 Workspace Store (GEO)

| Store 文件 | 用途 |
|-----------|------|
| `workspaces/geo/stores/useAdiStore.ts` | ADI 指标 |
| `workspaces/geo/stores/useDiscoveryStore.ts` | 发现 |
| `workspaces/geo/stores/useGeoProjectStore.ts` | GEO 项目 |
| `workspaces/geo/stores/useGrowthStore.ts` | 增长 |
| `workspaces/geo/stores/useHealthStore.ts` | 健康度 |
| `workspaces/geo/stores/useKnowledgeStore.ts` | 知识 |
| `workspaces/geo/stores/useLearningStore.ts` | 学习 |
| `workspaces/geo/stores/useMissionStore.ts` | 任务 |
| `workspaces/geo/stores/usePublishingStore.ts` | 发布 |
| `workspaces/geo/stores/useRecommendationsStore.ts` | 推荐 |
| `workspaces/geo/stores/useScanStore.ts` | 扫描 |
| `workspaces/geo/stores/useVerificationStore.ts` | 验证 |
| `workspaces/geo/stores/useWorkflowStore.ts` | 工作流 |

## 3. 状态重复与冲突

### 3.1 Auth 状态

| 源 | 存储位置 | 优先级 |
|----|---------|--------|
| Pinia auth store | 内存 | 最高 |
| token-cache | 内存 | 次高 |
| localStorage | 客户端 | 最低 |

**调用链**: `stores/auth.ts:getToken()` → 内存 → token-cache → localStorage

### 3.2 Project 状态

| 源 | 文件 |
|----|------|
| Pinia projectStore | `stores/projectStore.ts` |
| Pinia project | `stores/project.ts` |
| GEO project store | `workspaces/geo/stores/useGeoProjectStore.ts` |
| Workspace store | `modules/platform/workspace/store/useWorkspaceStore.ts` |

**证据**: 至少 4 个 Store 管理"项目"状态

### 3.3 Workbench 状态

| 源 | 文件 |
|----|------|
| Pinia workbench | `stores/workbench.ts` |
| Composable usePipeline | `composables/usePipeline.ts` |
| Workspace store | platform workspace store |
| GEO specific stores | 13 GEO stores |

## 4. 问题清单

| 问题 | 描述 | 严重等级 |
|------|------|----------|
| M-001 | 13 个 GEO 独立 Store 无统一状态管理 | HIGH |
| M-002 | 4 个 Project Store 共存 | HIGH |
| M-003 | Auth token 3 级回退链 | MEDIUM |
| M-004 | localStorage 直接读取绕过 Pinia | HIGH |
| M-005 | Module Store 与 Workspace Store 状态重叠 | MEDIUM |
| M-006 | 无统一的状态持久化策略 | MEDIUM |
| M-007 | Composables 和 Stores 混用状态 | MEDIUM |

## 5. 建议

1. **统一 Auth 状态**: 消除 localStorage 直接读取，全走 Pinia
2. **统一 Project 状态**: 合并 projectStore / project / useGeoProjectStore
3. **模块化 Store**: 使用 Nuxt module 按需加载
4. **消除 Workspace Store 碎片**: 使用 core store 共享状态
5. **状态持久化**: 统一使用 Pinia plugin 或 composable 做持久化
6. **Store 使用规范**: 强制使用 `defineStore` + 类型安全
