# Audit P: 代码质量审计 (CodeQualityAudit.md)

## 1. Dead Code 检测

### 1.1 废弃目录/文件

| 路径 | 状态 | 大小 |
|------|------|------|
| `frontend/legacy/brand-geo/` | 废弃 | 大量组件 |
| `frontend/legacy/brand-geo-v2/` | 部分废弃 | 若干 |
| `backend/snapshots/phase6_20260528_220518/` | 快照 | 完整副本 |
| `backend/archives/` | 已归档 | 若干 |
| `backend/dist/` | 构建产出 | 完整 |
| `frontend/.output/` | 构建产出 | 完整 |
| `frontend/..output.bak_v2.5/` | 旧构建 | 完整 |

### 1.2 未导出的函数/类

通过静态分析检测到:
- 大量 `async function` 未在任何地方 import/require
- 部分 composable 未在其他组件引用

## 2. TODO/FIXME/HACK

全库共计 **15 个** 显式标记:

```
TODO: 4处
FIXME: 3处  
HACK: 2处
XXX: 6处
```

主要位置:
- `backend/src/services/` — 多处 TODO
- 注释中遗留的方案说明

(注: 实际未标记的技术债远多于标记数量)

## 3. Magic Number/String

| 文件 | 行号 | 魔数 | 含义 |
|------|------|------|------|
| `routes/wallet.ts` | 多处 | raw SQL | 业务逻辑 |
| `config/env.ts` | 12 | `'minioadmin'` | 默认 secret |
| `providers/adapters/openai-compatible.adapter.ts` | 多处 | timeout 值 | 超时设置 |
| 各处 | — | 分页大小 | 无常量定义 |

## 4. 长函数/大组件

### 4.1 超大 Vue 组件

| 文件 | 行数估算 | 问题 |
|------|---------|------|
| `pages/hdz/workspace/[id].vue` | >1200 | 单页大组件 |
| `frontend/workspaces/geo/pages/BrandOverview.vue` | >800 | 单页大组件 |
| `pages/user/membership.vue` | >450 | 混合UI+逻辑 |

### 4.2 长后端函数

| 文件 | 问题 |
|------|------|
| `routes/customer-service.ts` | 多混合功能 |
| `routes/ai-tasks.ts:115` | 复杂调用链 |
| `queue/worker-runtime.ts:807` | 大函数 |

## 5. 代码质量问题汇总

| 问题类型 | 严重等级 | 数量估计 |
|---------|---------|---------|
| Dead Code (文件级) | MEDIUM | 5+ 目录 |
| Dead Code (函数级) | LOW | 难以统计 |
| TODO/FIXME | LOW | 15 标记 |
| Magic Number | MEDIUM | 多处 |
| 大组件 | MEDIUM | 3+ |
| 长函数 | MEDIUM | 5+ |
| 无类型安全 | MEDIUM | 部分代码 |
| 不一致命名 | LOW | 多处 |

## 6. 建议

1. 删除 `frontend/legacy/` 目录 (拆分为存档, 不参与构建)
2. 删除 `backend/archives/` 和 `backend/snapshots/`
3. 将 TODO/FIXME 转为 Issue
4. 拆分大组件 (如 HDZ workspace)
5. 统一命名规范 (provider/providers 等)
6. 添加代码质量门禁 (ESLint + Prettier + madge)
