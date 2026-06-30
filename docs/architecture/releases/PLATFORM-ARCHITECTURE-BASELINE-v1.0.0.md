# KMKI Platform Architecture Baseline v1.0.0

> **Status**: Production Baseline  
> **Date**: 2026-07-20  
> **Version**: 1.0.0  
> **Phase**: Platform Architecture Freeze — End of Architecture Design Phase  
> **Next Phase**: Developer Center — Experience Plane

---

## 1. Executive Summary

KMKI Platform Architecture Baseline v1.0.0 标志架构设计阶段正式完成。所有核心决策已冻结，进入平台工程实现阶段。

**交付总览**:

| 维度 | 数值 |
|------|------|
| 文档层级 | 9 层（Constitution → Blueprint → ADR → SDK → Template → 7 × Center Spec）|
| 总文档量 | 186 KB |
| Center | 7 个 |
| Registry | 50 个 |
| 数据模型 | 71 个 |
| REST API | 147 个 |
| 事件 | 61 个 |
| 架构决策 (ADR) | 20+ 个 |
| 宪法规则 | 29 条 |

---

## 2. Architecture Planes

```
┌─────────────────────────────────────────────────────────────┐
│                    Ingress Plane                             │
│                    Gateway Center                            │
└────────────────────────┬────────────────────────────────────┘
                         │
     ┌───────────────────┼───────────────────┐
     │                   │                   │
     ▼                   ▼                   ▼
┌────────────┐  ┌────────────────┐  ┌──────────────┐
│ Identity   │  │  AI Center     │  │ Asset Center │
│ Center     │  │  (8 Registry)  │  │ (10 Registry)│
│ (Auth/RBAC)│  │                │  │              │
└────────────┘  └───────┬────────┘  └──────────────┘
                        │
                        ▼
                  ┌───────────────┐
                  │ Capability    │
                  │ Center        │
                  │ (5 Registry)  │
                  └───────┬───────┘
                          │
                          ▼
                  ┌───────────────┐
                  │ Runtime Center│ ← Execution Plane
                  │ (9 Registry)  │
                  └───────┬───────┘
                          │
                Event Bus │
                          ▼
                  ┌───────────────┐
                  │ Observability │ ← Control Plane
                  │ Center        │
                  │ (8 Registry)  │
                  └───────────────┘
```

### 2.1 Planes

| Plane | Centers | 职责 |
|-------|---------|------|
| **Ingress** | Gateway | 唯一入口，认证/限流/路由/审计 |
| **Execution** | Identity → AI → Capability → Runtime | 业务执行链 |
| **Persistence** | Asset | 统一对象存储 + 版本/权限/CDN |
| **Control** | Observability | Trace/Metrics/Log/Alert/SLO |
| **Developer (下一步)** | Developer | DX/SDK/CLI/Docs/API Keys/Playground |

### 2.2 Architecture Principles (已验证)

| 原则 | 来源 | 验证状态 |
|------|------|----------|
| Gateway 是唯一入口 | ADR-011 | ✅ Gateway 冻结 |
| Center 不暴露端口 | CONST-010 | ✅ 所有 Center 通过 Gateway |
| Runtime 不感知 Provider | ADR-003 | ✅ Kernel 只有 6 抽象 |
| Runtime 不直接调用 S3 | CONST-024 | ✅ 全部通过 Asset Center |
| Event-first 通信 | CONST-022 | ✅ 61 个事件全部定义 |
| Trace-first | ADR-007 | ✅ Observability 全订阅 |
| 5 层分层调用（G→S→R→Repo→DAO）| Gateway 规范 §15 | ✅ Center SDK 强制执行 |
| Add-only 演化 | CONST-019 | ✅ v1.x 向后兼容 |

---

## 3. 文档构成

### 3.1 宪法级别（最高治理）

| 文档 | 路径 |
|------|------|
| KMKI Platform Constitution v1.1 | `docs/architecture/KMKI-PLATFORM-CONSTITUTION.md` |

### 3.2 蓝图级别

| 文档 | 路径 |
|------|------|
| KMKI Platform Blueprint v2.0 | `docs/architecture/KMKI-PLATFORM-BLUEPRINT-V2.md` |

### 3.3 决策级别

| 文档 | 路径 |
|------|------|
| KMKI Platform ADR v1.0 | `docs/architecture/KMKI-PLATFORM-ADR.md` |

### 3.4 SDK & Template（本版本新增）

| 文档 | 路径 | 状态 |
|------|------|------|
| Center SDK Specification v1.0 | `docs/architecture/specifications/CENTER-SDK-SPEC.md` | ✅ |
| Center Template Specification v1.0 | `docs/architecture/specifications/CENTER-TEMPLATE-SPEC.md` | ✅ |

### 3.5 Center Specifications

| Center | Registry 数 | 路径 | 大小 |
|--------|:----------:|------|:----:|
| AI Center | 8+Cache | `specifications/AI-CENTER-SPEC.md` | 38 KB |
| Asset Center | 10 | `specifications/ASSET-CENTER-SPEC.md` | 24 KB |
| Runtime Center | 9 | `specifications/RUNTIME-CENTER-SPEC.md` | 28 KB |
| Observability Center | 8 | `specifications/OBSERVABILITY-CENTER-SPEC.md` | 26 KB |
| Capability Center | 5+Cache | `specifications/CAPABILITY-CENTER-SPEC.md` | 23 KB |
| Gateway Center | 5+7MW | `specifications/GATEWAY-CENTER-SPEC.md` | 21 KB |

---

## 4. 依赖拓扑（冻结）

```
Gateway
  │
  ├── Identity
  │
  ├── AI ──── Capability ──── Runtime ──── Asset
  │
  └── Developer (Phase B)

Event Bus (异步)
  │
  └── Observability
```

**禁止循环依赖**: 以下依赖方向被明确禁止：
- ❌ Runtime → Capability（已完成解析，不应再查询 Capability）
- ❌ Observability → 任何 Center（Observability 不查询业务 Center）
- ❌ Asset → Runtime（Asset 不需要知道执行上下文）
- ❌ Gateway → 任何 Center 的数据库

---

## 5. 版本承诺

### 5.1 v1.x（当前基线）

| 承诺 | 说明 |
|------|------|
| 向后兼容 | 所有 Public API 保持原有签名 |
| Add-only | 只新增能力，不修改/删除已有 API |
| Event Schema 扩展 | 事件只新增字段，不删除/修改已有字段 |
| 废弃窗口 | 标记 deprecated 后最少 3 个月方可移除 |

### 5.2 v2.0 启动条件

- 至少 3 个 Workspace（短剧、小说、GEO）全部迁移到 Platform SDK
- 至少 6 个月生产运行无重大架构问题
- 所有 Center 均有生产流量
- 经过架构评审委员会批准

---

## 6. 所有 Specification 的版本归属

| Spec | Version | Status |
|------|---------|--------|
| KMKI Platform Constitution | v1.1 | ✅ 冻结 |
| KMKI Platform Blueprint | v2.0 | ✅ 冻结 |
| KMKI Platform ADR | v1.0 | ✅ 冻结 |
| Center SDK | v1.0 | ✅ 冻结 |
| Center Template | v1.0 | ✅ 冻结 |
| Gateway Center | v1.0 | ✅ 冻结 |
| Identity Center | v1.0 | ✅ 冻结（GEO V1） |
| AI Center | v1.1 RC | ✅ 冻结 |
| Capability Center | v1.0 | ✅ 冻结 |
| Runtime Center | v1.0 | ✅ 冻结 |
| Asset Center | v1.0 | ✅ 冻结 |
| Observability Center | v1.0 | ✅ 冻结 |

---

## 7. 下一步（Phase B — Developer Center）

冻结此基线后，进入 Developer Center Specification v1.0：

```mermaid
Phase A (当前) ──→ Architecture Baseline v1.0.0  ←── 你在這裡
                          │
                          ▼
Phase B ──→ Developer Center (DX Plane)
                │  API Key Registry
                │  SDK Registry
                │  CLI Registry
                │  Playground Registry
                │  OpenAPI Registry
                │  Webhook Registry
                │  Documentation Registry
                │
                ▼
Phase C ──→ Workspace 层迁移
                │  短剧 → Platform SDK
                │  小说 → Platform SDK
                │  PPT  → Platform SDK
                │  GEO  → Platform SDK
                │
                ▼
Phase D ──→ Plugin / Marketplace / Ecosystem
```

---

> **KMKI Platform Architecture Baseline v1.0.0 标志着：宪法已立、蓝图已绘、决策已记、工 具已备、Center 已定。进入工程实现前，此基线不可违反。**
