# Audit S: 历史演化与技术债审计

## S1. 历史遗留文件 (LegacyFilesAudit.md)

### 1.1 废弃源码目录

| 目录 | 路径 | 说明 | 处理建议 |
|------|------|------|---------|
| legacy brand-geo | `frontend/legacy/brand-geo/` | 旧版 GEO 工作台, 已被 studio-v2 取代 | 存档后删除 |
| legacy brand-geo-v2 | `frontend/legacy/brand-geo-v2/` | V2 过渡版本 | 检查是否仍有引用 |
| snapshots | `backend/snapshots/phase6_20260528_220518/` | V6 代码快照 | 移至外部存档 |
| archives | `backend/archives/` | 归档 Provider 适配器 | 移至外部存档 |
| old build | `frontend/..output.bak_v2.5/` | 旧版构建输出 | 删除 |
| dist | `backend/dist/` | 构建产出（应被 .gitignore） | .gitignore |
| v1 datasets | `backend/datasets/v1/` | 旧数据集 | 检查是否使用 |

### 1.2 废弃后端代码

| 文件 | 说明 |
|------|------|
| `backend/src/decision-runtime/ag-v1/` | AG V1 实验 |
| `backend/src/kernel-v1/` (snapshot中) | Kernel V1 |
| `backend/src/services/geo/v1/` | GEO V1 |
| `backend/src/services/geo/publishing/_deprecated/` | 已弃用 |

### 1.3 废弃数据库表 (通过 @@map 对照)

| 模型 | 说明 |
|------|------|
| `ShadowConfig`, `ShadowExecutionLog` 等 | Shadow 模式相关 |
| `AiSandboxLog` | Sandbox 实验 |
| `KernelCutoverScore`, `KernelDualExecutionLog` | Kernel 切换实验 |
| `LocalGPUNode`, `GPUNode`, `GPUTaskLog` | GPU 管理 (未使用?) |

## S2. 孤立文件 (OrphanFiles.md)

### 2.1 前端孤立组件

以下组件存在于 `frontend/components/` 但未在其他文件 import:

通过分析 `frontend/legacy/brand-geo/components/` — 大量旧组件可能无引用

需要进一步使用 madge 或 ts-morph 进行完整的 import 分析。

### 2.2 后端孤立文件

以下 `backend/src/` 中的文件在代码库中无 import 引用:

- `backend/src/scripts/` — 所有脚本可能仅手动运行
- `backend/src/audits/ssrf-observer/` — 独立的 SSRF 审计模块

### 2.3 孤立数据库模型

在 DatabaseAudit 中有 51+ 模型在 `backend/src/` 中无代码引用。

## S3. 废弃架构 (ObsoleteArchitecture.md)

### 3.1 已取代的架构

| 旧架构 | 新架构 | 取代时间 | 清理状态 |
|--------|--------|---------|---------|
| Kernel V1 | 当前 Runtime | 旧 | 在 snapshot 中 |
| AG V1 | Decision Runtime | 旧 | 仍存在 |
| Brand-GEO V1 | Workspace GEO (studio-v2) | 最近 | 遗留未清理 |
| Provider Wrapper | Model-adapters | 旧 | 在 archive 中 |
| Director V1 | Director V2 | 最近 | routes 共存 |

### 3.2 过渡状态架构

| 架构 | 状态 | 说明 |
|------|------|------|
| Director V1 + V2 | 共存 | 代码注释: "与老系统共存" |
| Project + Project-v2 | 共存 | routes 中有两个版本 |
| Brand-geo + brand-geo-v2 + studio-geo | 三个共存 | 前端三个版本 |

## S4. 重复架构 (DuplicateArchitecture.md)

### 4.1 Provider 架构重复

| 架构 | 路径 | 说明 |
|------|------|------|
| Provider Registry | `runtime/provider-registry.ts` | 正式 Provider 注册 |
| Provider Wrapper (archived) | `backend/archives/provider-wrapper/` | 旧实现 |
| Model Adapters | `model-adapters/` | 独立适配器 |
| Direct Providers | `services/*.provider.ts` | 服务级 provider |

### 4.2 Agent 架构重复

| 架构 | 路径 | 说明 |
|------|------|------|
| Agent 目录 | `agents/` | 原始 Agent |
| Platform Agent | `services/platform/agent/` | 新版平台 Agent |
| GEO Agent | `services/geo/agents/` | GEO Agent |

### 4.3 Runtime 架构重复

见 ArchitectureAudit: 5 个独立 Runtime

## S5. 死代码 (DeadCodeAudit.md)

### 5.1 不可达代码

通过 grep 检测:
- `backend/src/routes/p0-gateway-route.ts` — P0 实验路由
- `backend/src/routes/p1.8-evaluate.ts` — P1.8 实验
- `backend/src/routes/p18-data-activation.ts` — P18 实验

### 5.2 仅脚本使用的代码

`backend/scripts/` 中的脚本引用了一些 `backend/src/` 的模块，但这些模块可能不被主应用使用。

## S6-S11: 其余子报告 (简要)

### S6 ExperimentalFeaturesAudit.md

| 实验 | 路径 | 状态 |
|------|------|------|
| SSRF Observer | `backend/src/audits/ssrf-observer/` | 未融入主流程 |
| Kernel Cutover | `KernelRollbackHistory` 等模型 | 已完成 |
| P0/P1.8 | routes | 实验性 |
| Shadow Mode | ShadowConfig, ShadowExecutionLog | 可能未使用 |

### S7 NamingConsistencyAudit.md

| 命名冲突 | 示例 |
|---------|------|
| provider/providers | `runtime/providers/` vs `providers/` |
| Agent/agent | 混用大小写 |
| workspace/Workbench | 两个术语混用 |
| project/Project | 5+ 个 project 模型 |

### S8 RepositoryStructureAudit.md

`backend/src/` 下有 150+ 子目录，层次过深。

### S9 DependencyAudit.md

主要依赖已从 `package.json` 列出，无可见冲突。
潜在问题:
- 双 Fastify (dep + @fastify/*)
- 双 JWT (jsonwebtoken + @fastify/jwt)

### S10 DatabaseCleanupAudit.md

参考 DatabaseAudit.md, 需要清理:
- 51 个孤立模型
- 重复 status/time 字段
- 无 @@map 的表名

### S11 GitEvolutionAudit.md

Git 统计:
- 139 commits on audit/reality-v3
- 2 个分支: master, audit/reality-v3
- 从 commit 看项目经历了: P-Product → RC1 → RC3 → GEO v1.0 → Knowledge Hub → DI

### S12 CleanupRoadmap.md

**Phase 1 (1-2 周)**: 安全修复
- 数据库添加索引
- 消除 SQL 注入 (Raw SQL → ORM)
- 修复 25 条无认证路由
- 消除 localStorage token

**Phase 2 (2-3 周)**: 架构清理
- 删除 legacy/deprecated 代码目录
- 消除重复 workspace 实现
- 合并 project/projects-v2

**Phase 3 (3-4 周)**: Runtime 统一
- 消除 4 条 AI 调用路径
- 统一 provider-registry
- 统一 credential 管理

**Phase 4 (2-3 周)**: 数据治理
- 清理孤立数据库模型
- 统一状态管理
- 消除配置碎片

**Phase 5 (持续)**: 代码治理
- 添加代码质量门禁
- 完善类型定义
- 统一命名规范
- 补充单元测试
