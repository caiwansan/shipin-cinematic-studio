# 昆仑镜 V4 架构治理规范

> **版本**: v1.0 · **状态**: 架构基线 (C0.5) · **日期**: 2026-07-18
> **约束力**: 本规范为昆仑镜平台架构治理的最高效力文件。所有架构决策、RFC、ADR、代码审查、发布管理均以本规范为准。

---

## 1. 架构评审流程

### 1.1 需要正式评审的场景

以下场景**必须**经过架构评审会（Architecture Review Board, ARB）审批：

| 场景 | 评审类型 | 审批人 | 期限 |
|------|---------|--------|------|
| **新增平台能力** | 完整 RFC | 产品架构师 | 5 个工作日 |
| **破坏性变更** | 完整 RFC + 迁移方案 | 产品架构师 | 10 个工作日 |
| **Workspace 违反基线** | 违规评审 | 产品架构师 | 3 个工作日 |
| **新增 Provider** | 快速审查 | 技术负责人 | 2 个工作日 |
| **新增扩展类型** | 快速审查 | 架构团队 | 3 个工作日 |
| **数据模型变更** | 快速审查 | 技术负责人 | 2 个工作日 |
| **API Schema 变更** | 快速审查 | 技术负责人 | 2 个工作日 |

### 1.2 评审流程

```
提交 RFC/PR
    │
    ▼
技术初步审核（1d）
    │ 通过/需修改
    ▼
架构评审会（1-2d）
    │ 通过/拒绝/条件通过
    ▼
产品架构师签署（1d）
    │ 签署/一票否决
    ▼
实施 & 更新基线
```

### 1.3 ARB 组成

- **产品架构师（XiongDa）** — 一票否决权
- **技术负责人** — 技术可行性评估
- **相关 Workspace 负责人** — 影响评估
- **质量保障** — 迁移/测试方案审阅

---

## 2. RFC 流程

### 2.1 提交模板

所有 RFC 必须使用以下模板提交至 `docs/rfc/` 目录：

```markdown
---
title: RFC 标题
author: 提交人
date: YYYY-MM-DD
status: Draft
---

## 1. 问题描述

[清晰描述要解决的问题，包括痛点、现状分析、数据支撑]

## 2. 提议方案

[描述具体解决方案，包括架构图、接口变更、数据流变更]

## 3. 替代方案

| 方案 | 优点 | 缺点 | 拒绝原因 |
|------|------|------|----------|
| 方案 A | ... | ... | ... |
| 方案 B | ... | ... | ... |

## 4. Workspace 影响分析

[列出受影响的 Workspace 及影响范围、变更量]

## 5. 迁移路径

[分阶段迁移计划，包括向后兼容策略、废弃计划]
```

### 2.2 RFC 生命周期

```
Draft → Review → Proposed → Accepted → Implemented → Closed
  │        │          │           │
  │        └── Rejected           │  ← 废弃/RFC 撤回
  │                               │
  └── Withdrawn                   └── Superseded（被新 RFC 替代）
```

### 2.3 时间要求

| 阶段 | 期限 | 说明 |
|------|------|------|
| Draft → Proposed | 3 个工作日 | 提交者根据反馈修改 |
| Review 周期 | 5 个工作日 | 社区评审期 |
| Proposed → Accepted | 3 个工作日 | 架构师签署 |
| Accepted → Implemented | 按里程碑 | 纳入迭代计划 |

---

## 3. ADR 生命周期

### 3.1 ADR 状态流转

```
Draft → Proposed → Accepted → Deprecated → Superseded
                                   │
                                   └── 标记废弃
```

| 状态 | 说明 | 约束 |
|------|------|------|
| **Draft** | 草稿中，尚未提交评审 | 进入架构评审会 |
| **Proposed** | 提交评审，等待架构师签署 | 需工作组成员 +1 确认 |
| **Accepted** | 已批准，为有效架构决策 | 代码审查必须引用 |
| **Deprecated** | 不再推荐使用，由新 ADR 替代 | 代码审查允许「已知违规」标注 |
| **Superseded** | 已被新 ADR 完全替代 | 关联 ADR 必须在同一 page 展示 |

### 3.2 ADR 的代码审查引用

所有 PR 在描述中必须引用受影响的 ADR：

```markdown
## PR 描述

变更：新增 GEOWorkspaceAdapter 实现
受影响文档：WORKSPACE-SPEC.md
引用的 ADR：ADR-001, ADR-002

## 合规性检查

- [x] 单一运行时：此 PR 不引入新的 Runtime 实现（符合 ADR-001）
- [x] Adapter 模式：实现 WorkspaceAdapter 接口（符合 ADR-002）
- [x] 能力层：通过 PlatformSDK.capability 调用 Provider（符合 ADR-003）
- [x] Repository 模式：通过 BaseRepository 访问数据（符合 ADR-004）
```

### 3.3 历史 ADR 清单

| ADR | 标题 | 状态 | 说明 |
|-----|------|------|------|
| ADR-001 | 单一运行时 | Accepted | 单一 Platform Runtime |
| ADR-002 | Workspace Adapter 模式 | Accepted | Adapter 接口契约 |
| ADR-003 | 能力层架构 | Accepted | 四层能力模型 |
| ADR-004 | Repository + ORM Adapter | Accepted | 数据访问分层 |

---

## 4. 废弃策略

### 4.1 三阶段废弃模型

任何平台能力、API、接口的废弃遵循以下三阶段模型：

```
阶段 1: Deprecated（废弃）
├── 日志打印 WARN 级别废弃提示
├── 文档标记为「已废弃」
├── 不影响现有功能
└── 持续：≥ 1 个 Sprint（2 周）

     ↓

阶段 2: Warning（警告）
├── CI 构建时输出 ERROR 级别警告
├── 功能可正常使用
├── 迁移工具可用
└── 持续：≥ 1 个 Sprint（2 周）

     ↓

阶段 3: Removal（移除）
├── 代码正式删除
├── 迁移文档已更新
└── 旧功能不再可用
```

### 4.2 最短通知期

| 废弃类型 | 最短通知期 | 说明 |
|---------|-----------|------|
| API 端点废弃 | 2 个 Sprint（4 周） | 含迁移指南 |
| SDK 接口废弃 | 2 个 Sprint（4 周） | 含迁移指南 + codemod |
| 数据模型废弃 | 3 个 Sprint（6 周） | 含数据迁移脚本 |
| Provider 废弃 | 2 个 Sprint（4 周） | 含替代 Provider 配置 |
| 配置项废弃 | 1 个 Sprint（2 周） | 含替代配置说明 |

### 4.3 废弃示例

```typescript
// @studio/platform/sdk/v1/deprecated.ts
/**
 * @deprecated 自 v1.1.0 起废弃。
 * 请使用 `PlatformSDK.api.get` 替代。
 * 迁移指南：https://docs.studio.com/migration/api-client
 * 移除时间：v2.0.0（预计 2026-09-01）
 */
export async function fetchProjects(): Promise<Project[]> {
  console.warn('[Studio Platform] WARN: fetchProjects is deprecated, use PlatformSDK.api.get instead')
  // ... 实现
}
```

---

## 5. 破坏性变更策略

### 5.1 破坏性变更定义

以下变更被视为**破坏性变更**：

| 变更类型 | 示例 |
|---------|------|
| 删除/重命名公开 API | 删除 `PlatformSDK.asset.create` |
| 修改函数签名 | `getProjects(page, limit)` → `getProjects(input: {page, limit})` |
| 修改响应格式 | ApiResponse.data 结构变更 |
| 修改错误代码 | `NOT_FOUND` → `RESOURCE_NOT_FOUND` |
| 删除配置项 | 删除 deprecated Provider 配置 |
| 数据库 Schema 变更 | 删除非空字段、修改字段类型 |
| 事件 Schema 变更 | 修改事件 payload 结构（向后不兼容） |

### 5.2 破坏性变更流程

```
1. 创建迁移文档（MIGRATION.md）
   ├── 变更前后对比
   ├── 迁移步骤
   ├── 自动化迁移脚本（可选）
   └── 回滚方案

2. 执行废弃阶段
   ├── 至少经过 Deprecated + Warning 两个阶段
   └── 最短通知期: 2 个 Sprint

3. ARB 评审
   ├── 提交 RFC 包含变更描述
   ├── 所有受影响的 Workspace 确认
   └── 架构师签署

4. 发布
   ├── MAJOR 版本号递增
   ├── Changelog 中标记 BREAKING CHANGE
   └── 通知所有 Workspace 开发者
```

### 5.3 禁止的破坏性变更

| 禁止操作 | 原因 | 替代方案 |
|---------|------|----------|
| 无通知移除功能 | 影响在产 Workspace | 执行三阶段废弃 |
| 无迁移文档 | 开发者无法适配 | 提供迁移指南 |
| 仅在 MAJOR 版本中提及 | 开发者不会主动追踪 | 提前 2 Sprint 通知 |
| 跳过废弃阶段直接删除 | 破坏已有功能 | 至少经过 Deprecated 阶段 |

---

## 6. 发布兼容性

### 6.1 Platform SDK 语义化版本

`@studio/platform` 严格遵循语义化版本 2.0.0：

```
MAJOR.MINOR.PATCH
  │      │      │
  │      │      └── PATCH: 向后兼容的 bug 修复
  │      │                   示例: 1.2.0 → 1.2.1
  │      │
  │      └── MINOR: 新增能力，向后兼容
  │                    示例: 1.0.0 → 1.1.0
  │
  └── MAJOR: 破坏性变更
                示例: 1.0.0 → 2.0.0
```

### 6.2 Workspace 版本约束

| 约束类型 | 规则 | 示例 |
|---------|------|------|
| **最低版本** | Workspace `package.json` 声明 `@studio/platform` 最低版本 | `"@studio/platform": ">=1.2.0"` |
| **锁定范围** | Workspace 锁定到 MINOR 版本 | `"@studio/platform": "~1.2.0"`（允许 1.2.x，不允许 1.3.0） |
| **升级流程** | 升级 MINOR 需要 Workspace 验证 | 平台发布 1.3.0 → Workspace 在下一 Sprint 验证 → 更新锁定 |
| **MAJOR 升级** | MAJOR 升级需要完整迁移计划 | 按破坏性变更流程执行 |

### 6.3 版本发布节奏

| 版本类型 | 发布频率 | 发布窗口 |
|---------|---------|----------|
| PATCH | 按需（bug 修复） | 任何工作日 |
| MINOR | 每 Sprint（2 周） | Sprint 结束日 |
| MAJOR | 每季度 | 季度末 + 2 周缓冲期 |

---

## 7. 合规检查清单

### 7.1 PR 审查清单

每个 PR 合并前，审查者必须逐项确认以下 15 项检查：

```
□ C1 不包含 import prisma 在 workspace/ 目录下
   [审查] 检查 workspace/**/*.ts 中无 prisma import

□ C2 不包含 fetch() 或 axios() 在 workspace/ 代码中
   [审查] 检查 workspace/**/*.ts, *.vue 中无 fetch( 或 axios.

□ C3 不包含独立 Runtime 实现
   [审查] 检查 *.runtime.ts 文件，检查 class *Runtime 定义

□ C4 不包含自定义 Auth/权限逻辑
   [审查] 检查 getAuthHeaders、localStorage 等自定义认证

□ C5 API 路径不含 brand/ 前缀
   [审查] 检查 /api/brand/ 路径模式

□ C6 数据模型使用 Knowledge* 而非 Geo* 命名
   [审查] 检查 interface Geo* 定义

□ C7 目录结构符合 workspace/<name>/adapter/ 规范
   [审查] 检查 workspace/ 下每个子目录都有 adapter/

□ C8 使用 PlatformSDK 替代直接调用
   [审查] 检查 import 是否来自 @studio/platform

□ C9 所有 Repository 继承 BaseRepository
   [审查] 检查 ... extends BaseRepository 子句

□ C10 所有 Agent 通过 Capability Runtime 注册
   [审查] 检查无独立 agent registry 文件

□ C11 API 响应使用 ApiResponse 统一格式
   [审查] 检查路由文件中 success/data/traceId 字段

□ C12 无重复项目表（仅使用 Project.type 枚举）
   [审查] 检查独立 GEOProject / VideoProject 表定义

□ C13 无直接 Provider 实例化
   [审查] 检查 new OpenAI, new Doubao, new Qwen 等

□ C14 事件使用 PlatformSDK.event 无独立事件通道
   [审查] 检查 new WebSocket、独立 EventEmitter

□ C15 引入了对应的 ADR 引用
   [审查] PR 描述中引用受影响的 ADR 编号

提取检查结果格式：
  ✅ [C1] 未发现 prisma import
  ❌ [C3] 发现独立 Runtime 文件: workspace/geo/runtime/geo.runtime.ts
```

### 7.2 自动合规检查

参见 `scripts/architecture-linter.sh` 脚本，CI 中自动执行：

- 8 个架构规则检查
- 4 个 ADR 验证检查
- --fix 模式自动修复部分违规（如重命名目录）

---

## 8. 升级路径

### 8.1 Workspace 违规处理

当 CI 或审查发现 Workspace 违反基线规范时，按以下路径处理：

```
违规发现
   │
   ▼
阶段 1: 警告（Warning）
   ├── CI 输出 WARNING，不阻塞合并
   ├── 记录到违规追踪表
   ├── 通知 Workspace 负责人
   └── 修复期限：1 个 Sprint
   │
   ▼（期限内未修复）
阶段 2: 正式审查（Review）
   ├── 架构评审会评估风险
   ├── 确定修复方案和时间线
   ├── 可批准临时豁免（最长 2 Sprint）
   └── 修复期限：按评审决议
   │
   ▼（审查期限仍未修复）
阶段 3: 冻结（Freeze）
   ├── 该 Workspace 的所有 PR 禁止合并
   ├── 仅允许修复违规的 PR
   ├── 通知项目负责人和产品负责人
   └── 解冻条件：违规全部修复并通过审查
```

### 8.2 违规级别分类

| 级别 | 代码 | 示例 | 初始处理 |
|------|------|------|---------|
| 🔴 Critical | C-CRIT | 独立 Runtime、import prisma、fetch 绕过 | 直接进入审查阶段，PR 不合并 |
| 🟡 Major | C-MAJ | 命名不规范、目录结构错误、跳过 SDK | PR 不合并，退回修改 |
| 🟢 Minor | C-MIN | 文档缺失、注释过时、代码风格 | PR 可合并，标记为技术债务 |

### 8.3 违规处理文档

```markdown
---
id: VIOLATION-2026-001
workspace: geo
severity: CRITICAL
rule: C3 — 独立 Runtime 实现
detected: 2026-07-18
status: open
---

## 违规详情

- 文件: `workspace/geo/composables/useBrandGEORuntime.ts` (~280 行)
- 违反: 规则 1（Workspace 不得实现自己的 Runtime）
- 影响: 运行时逻辑重复、执行行为不一致

## 处理

- [ ] 创建 GEOWorkspaceAdapter
- [ ] 迁移 Runtime 逻辑到 Adapter
- [ ] 删除 useBrandGEORuntime.ts
- [ ] 验证：架构 linter 通过

## 期限

- 修复截止：2026-07-31（1 Sprint）
- 临时豁免：未批准
```

---

## 9. 治理工具

### 9.1 自动化工具

| 工具 | 位置 | 用途 |
|------|------|------|
| 架构 Linter | `scripts/architecture-linter.sh` | CI 自动合规检查 |
| CI Workflow | `.github/workflows/architecture-lint.yml` | PR 触发检查 |
| 治理规范 | `docs/baselines/GOVERNANCE-SPEC.md` | 本文件 |
| 违规追踪 | `docs/governance/violations/` | 违规记录 |

### 9.2 本地合规检查

```bash
# 本地运行架构合规检查
bash scripts/architecture-linter.sh

# 本地运行并自动修复（--fix 模式）
bash scripts/architecture-linter.sh --fix

# 检查特定 Workspace
bash scripts/architecture-linter.sh --workspace=geo
```

---

*架构治理规范确保昆仑镜平台的架构决策可追溯、可执行、可审计。本规范与 MANIFESTO.md 同为最高效力文件。*
*所有技术决策、代码审查、版本发布均需遵守本规范。违反者将触发升级处理流程。*
