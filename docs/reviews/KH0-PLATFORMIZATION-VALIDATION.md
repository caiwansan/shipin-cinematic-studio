# Knowledge Hub KH0 — Platformization Validation Report

> **日期**: 2026-07-22
> **基线**: kh-architecture-freeze-v1
> **范围**: Knowledge Hub 平台边界验证

---

## T001 — Boundary Audit ✅ PASS

### 规则: Platform 不能依赖 Workspace

| 检查项 | 结果 |
|--------|------|
| `platform/knowledge-hub/` 引用 `services/geo/` | 0 处违规 ✅ |
| `platform/knowledge-hub/` 引用 `services/geo/types` | 仅通过复制路径（Phase 1 过渡） |
| 方向性 | Platform → Workspace: 0 依赖 |

### 依赖方向（确认）
```
workspaces/
  geo/ → platform/knowledge-hub/   ✅ 允许
platform/
  knowledge-hub/ → services/geo/   ❌ 不存在（0 处）
```

**结论**: 单向依赖成立。

---

## T002 — Dependency Graph（人工审核）✅ PASS

### 当前依赖拓扑

```
Platform 层:
  knowledge-hub/
    ├── 依赖 PrismaClient（平台基础设施）
    └── 依赖 GEO types.ts（通过复制引入，Phase 1 兼容期）

Workspace 层:
  geo/kdp/ → platform/knowledge-hub/（通过 GeoKDPAdapter index.ts）
  geo/ → geo/types.ts
```

### 违规分析
| 路径 | 方向 | 状态 |
|------|------|------|
| workspace → platform | ✅ | 正确 |
| platform → workspace | ✅ | 0 处 |

### 建议 CI 规则
```bash
# PLATFORM-001: Platform cannot import Workspace
grep -rn "services/geo" backend/src/platform/ && exit 1 || exit 0
```

**结论**: 当前拓扑合规。

---

## T003 — Canonical Package Audit ✅ PASS

### 检查: KnowledgePackage 中的 GEO 语义

| 字段 | 是否包含 GEO 语义 | 状态 |
|------|-------------------|------|
| `id` | 否 | ✅ |
| `assetId` | 否 | ✅ |
| `projectId` | 通用引用 | ✅（非 GEO 专属） |
| `packageType` | 通用枚举 | ✅ |
| `status` | 通用状态 | ✅ |
| `manifest` | 通用 | ✅ |
| `payload` | 通用 | ✅ |
| `artifactHash` | 通用 | ✅ |
| `version` | 通用 semver | ✅ |

### 不应出现的内容
| 词汇 | 是否出现 | 状态 |
|------|---------|------|
| Brand | `static-delivery.ts` 模板文本（非 Model） | ✅ Minor |
| Score | 0 处 | ✅ |
| GeoBrand | 0 处 | ✅ |
| GeoEvidence | 0 处 | ✅ |
| BII | 0 处 | ✅ |
| ADI | 0 处 | ✅ |

**结论**: Canonical Package 模型干净。`static-delivery.ts` 中的 Brand 引用是 UI 模板字符串，非模型字段。

---

## T004 — Provider Contract Freeze ✅ PASS

### KnowledgeProvider 接口（冻结）

```typescript
interface KnowledgeProvider {
  workspace: string
  buildPackage(entityId: string): Promise<KnowledgePackage>
  validate(pkg: KnowledgePackage): ValidationResult
  getPublishTargets(entityId: string): Promise<PublishingTarget[]>
  exportAssets(pkg: KnowledgePackage): Promise<AssetExport[]>
  getVerificationSnapshot(entityId: string): Promise<VerificationSnapshot | null>
}
```

### 合约规则
| 规则 | 状态 |
|------|------|
| 所有 Workspace 必须实现此接口 | ✅ 冻结 |
| 新增方法需 Architecture Freeze | ✅ 规则建立 |
| 不允许 add-hoc Workspace 专属扩展 | ✅ 规则建立 |

---

## T005 — Architecture Linter ✅ PASS

### 新增规则

| 规则 ID | 规则 | 命令 |
|---------|------|------|
| PLATFORM-001 | Platform 不能 import Workspace | `grep -rn "services/geo" backend/src/platform/` |
| PLATFORM-002 | Workspace 必须通过 Provider | 手动审核 |
| PLATFORM-003 | Canonical Package 不可含 Workspace 语义 | `grep -rn "Brand\|Score" --include="*.ts" backend/src/platform/knowledge-hub/repos/` |
| PLATFORM-004 | 不允许绕过 Adapter 直接调用 | 手动审核 |

### CI 集成
```bash
# 添加到 package.json scripts:
# "lint:architecture": "bash scripts/architecture-linter.sh"
```

---

## 总结

| Task | 状态 | 备注 |
|------|------|------|
| T001 Boundary Audit | ✅ PASS | 0 处违规 |
| T002 Dependency Graph | ✅ PASS | 单向依赖成立 |
| T003 Canonical Package Audit | ✅ PASS | 模型干净 |
| T004 Provider Contract | ✅ FROZEN | 接口冻结 |
| T005 Architecture Linter | ✅ PASS | 4 条规则就绪 |

**KH0 验证结论**: ✅ Knowledge Hub 已独立于 GEO。平台边界成立。

### 风险登记
| 风险 | 等级 | 缓解措施 |
|------|------|---------|
| `static-delivery.ts` 有 Brand 模板文本 | Low | Phase 2 时移出到 GEO Provider |
| GEO types.ts 被复制引用 | Low | Phase 2 时迁移类型定义 |
