# 昆仑镜 Sprint 执行流程规范（SDP）

> **Sprint Delivery Protocol**
> 版本：V1.0
> 生效日期：2026-07-17
> 适用范围：Phase D 起所有 Sprint（P2.1 ~ P2.4 及以后）

---

## 流程总览

```
Pre-Check ─► Phase 1~10 执行 ─► Self-Audit ─► 用户验收 ─► 冻结
   ↓                                                          ↓
   全部通过才能开始                                    全部通过才能进入下一 Sprint
```

每个 Sprint 分 12 个阶段，其中 Phase 1~10 由 OpenClaw 执行并自审，Phase 0 和 Phase 11 是检查/验收关口。

---

## Phase 0：Pre-Check（前置检查）

**执行者**：OpenClaw  
**时机**：Sprint 开始前  
**产出**：Pre-Check 报告（逐项标注 ✅/❌）

| ID | 检查项 | 状态 |
|----|--------|------|
| P0-001 | Runtime V1 RC 已冻结 | □ |
| P0-002 | Knowledge Object 为唯一真相源 | □ |
| P0-003 | 前端规范 V2 生效 | □ |
| P0-004 | kmki-ui 使用平台组件 | □ |
| P0-005 | Platform Baseline 12 项规范确认 | □ |
| P0-006 | 不新增违反规范目录 | □ |
| P0-007 | 不产生重复 UI | □ |
| P0-008 | 对应 PlAT 层无未定决策 | □ |

**准入条件**：全部 ✅ 通过 → 进入 Phase 1  
**拒绝条件**：任一 ❌ → 修复后重验

---

## Phase 1：Architecture

**执行者**：OpenClaw  
**产出**：架构确认文档

### 1.1 回答三层问题

| 问题 | 答案 |
|------|------|
| 属于哪一层？ | core / runtime / workspace / kmki-ui / admin |
| 生产还是消费数据？ | Producer / Consumer |
| 是不是平台能力？ | 是 → 放入平台层 / 否 → 工作台内 |

### 1.2 架构检查清单

| ID | 检查项 | 状态 |
|----|--------|------|
| ARC-001 | 正确定义层级归属 | □ |
| ARC-002 | 未来四工作台共享时无需大改 | □ |
| ARC-003 | Workspace 层无状态（纯编排） | □ |
| ARC-004 | 禁止业务逻辑写死在工作台层 | □ |

---

## Phase 2：Backend Service

**执行者**：OpenClaw  
**产出**：Service 层代码

### 2.1 Service 层必须包含

- CRUD（创建/读取/更新/删除）
- Search（搜索/筛选）
- Version（版本控制）
- Import（导入）
- Export（导出）
- Validator（校验）
- Parser（解析）

### 2.2 禁止

- ❌ Controller 写业务
- ❌ Route 写逻辑
- ❌ Workspace 写模块业务

---

## Phase 3：Data Model

**执行者**：OpenClaw  
**产出**：Prisma Schema + 迁移脚本

### 3.1 数据依赖方向

```
Knowledge Object
    ↓
Citation（当前 Sprint）
    ↓
Evidence（P2.2）
    ↓
Claim（P2.3）
```

**禁止逆向依赖。**

### 3.2 模型必须包含

| 字段 | 说明 |
|------|------|
| `id` | UUID |
| `version` | 版本号 |
| `metadata` | JSON 扩展字段 |
| `source` | 来源标识 |
| `hash` | 内容哈希（去重用） |
| `createdBy` | 创建人 |
| `updatedBy` | 更新人 |
| `createdAt` | 创建时间 |
| `updatedAt` | 更新时间 |
| `deletedAt` | 软删除（nullable） |

---

## Phase 4：API

**执行者**：OpenClaw  
**产出**：Route + Controller + DTO + OpenAPI

### 4.1 REST 端点

| Method | Path | 说明 |
|--------|------|------|
| `GET` | `/api/...` | 列表/搜索 |
| `GET` | `/api/.../:id` | 详情 |
| `POST` | `/api/...` | 创建 |
| `PATCH` | `/api/.../:id` | 更新 |
| `DELETE` | `/api/.../:id` | 删除 |

### 4.2 API 规范

- RESTful
- 版本化（URL 或 Header）
- OpenAPI 文档
- DTO（请求/响应分离）
- Validation（输入校验）

---

## Phase 5：Frontend

**执行者**：OpenClaw  
**产出**：Vue 页面 + 组件

### 5.1 页面清单

| 页面 | 说明 |
|------|------|
| `List` | 列表/搜索 |
| `Detail` | 详情 |
| `Editor` | 创建/编辑 |
| `Import` | 批量导入 |
| `Search` | 高级搜索 |

### 5.2 前端规范强制

| 规范 | 要求 |
|------|------|
| 使用 kmki-ui | 100% 使用平台组件，不复制 |
| Page ≤150 行 | ✅ |
| Feature ≤200 行 | ✅ |
| Step ≤120 行 | ✅ |
| 无重复组件 | 检查已存在的 kmki-ui 组件 |

---

## Phase 6：Admin

**执行者**：OpenClaw  
**产出**：统一后台管理模块

### 6.1 管理功能

| 功能 | 说明 |
|------|------|
| 列表 | 分页、排序 |
| 搜索 | 关键词/条件筛选 |
| 审核 | 通过/拒绝/待审 |
| 删除 | 软删除 |
| 批量导入 | CSV/JSON |
| 批量导出 | CSV/Excel |
| 操作日志 | 变更记录 |

---

## Phase 7：Security

**执行者**：OpenClaw  
**产出**：权限 + 审计 + 租户隔离

| ID | 检查项 | 状态 |
|----|--------|------|
| SEC-001 | Permission 权限控制 | □ |
| SEC-002 | License 接入 Entitlement 系统 | □ |
| SEC-003 | Tenant 租户隔离 | □ |
| SEC-004 | Audit Log 操作审计 | □ |
| SEC-005 | Operation Log 操作记录 | □ |
| SEC-006 | Soft Delete 软删除 | □ |

---

## Phase 8：Test

**执行者**：OpenClaw  
**产出**：测试代码 + 运行报告

| 类型 | 覆盖范围 |
|------|----------|
| Unit | Service 层 |
| Integration | API 端点 |
| Frontend | 页面渲染 + 交互 |
| Permission | 权限控制流程 |

**红线**：

| 检查项 | 要求 |
|--------|------|
| 编译 0 Error | ✅ |
| Test PASS | ✅ |
| Build PASS | ✅ |

---

## Phase 9：Self-Audit（自审）

**执行者**：OpenClaw  
**产出**：审计报告

| 审计类型 | 说明 |
|----------|------|
| Architecture Audit | 是否符合 Platform Baseline |
| UI Audit | 是否符合 kmki-ui 规范 |
| Runtime Audit | 是否破坏 Runtime V1 冻结 |
| Performance Audit | 是否存在性能隐患 |
| Duplicate Audit | 是否存在重复代码/组件 |
| Code Quality Audit | 代码质量评分 |

---

## Phase 10：Deliverable

**执行者**：OpenClaw  
**产出**：交付包

### 10.1 交付物清单

| 交付物 | 路径 | 状态 |
|--------|------|------|
| Architecture Diagram | `docs/diagrams/...` | □ |
| Database Schema | `prisma/schema.prisma` | □ |
| API | `src/routes/...` | □ |
| UI | `frontend/...` | □ |
| Admin | `admin/...` | □ |
| Migration | `prisma/migrations/...` | □ |
| Tests | `src/.../*.test.ts` + `frontend/.../*.spec.ts` | □ |
| Audit Report | `docs/reviews/...` | □ |

**缺一不可。**

---

## Phase 11：Final Acceptance（最终验收）

**执行者**：用户（熊大）  
**时机**：OpenClaw 提交完整交付报告后  
**产出**：验收签核 / 修改意见

| ID | 验收内容 | 状态 |
|----|----------|------|
| ACC-001 | 符合 V4 Platform Baseline | □ |
| ACC-002 | 本模块为平台能力（如是） | □ |
| ACC-003 | Workspace 无重复实现 | □ |
| ACC-004 | kmki-ui 100% 使用 | □ |
| ACC-005 | Admin 已集成 | □ |
| ACC-006 | License 已接入 | □ |
| ACC-007 | Asset Center 已兼容 | □ |
| ACC-008 | Runtime V1 无破坏 | □ |
| ACC-009 | 编译零错误 | □ |
| ACC-010 | 测试全部通过 | □ |
| ACC-011 | 架构审计通过 | □ |
| ACC-012 | UI 审计通过 | □ |
| ACC-013 | 无重复代码与重复组件 | □ |
| ACC-014 | 文档同步完成 | □ |
| ACC-015 | 可作为 Platform RC 冻结 | □ |

---

## Sprint 执行总时间线

```
Phase 0: Pre-Check         ─── OpenClaw → 用户确认
Phase 1: Architecture      ─── OpenClaw
Phase 2: Backend Service   ─── OpenClaw
Phase 3: Data Model        ─── OpenClaw
Phase 4: API               ─── OpenClaw
Phase 5: Frontend          ─── OpenClaw
Phase 6: Admin             ─── OpenClaw
Phase 7: Security          ─── OpenClaw
Phase 8: Test              ─── OpenClaw
Phase 9: Self-Audit        ─── OpenClaw
Phase 10: Deliverable      ─── OpenClaw → 报告提交
Phase 11: Final Acceptance ─── 用户验收
```

---

## 后续 Sprint 复用

| Sprint | 适用 SDP |
|--------|----------|
| P2.1 Citation Foundation | ✅ V1.0 |
| P2.2 Evidence Foundation | ✅ V1.0 |
| P2.3 Claim Engine | ✅ V1.0 |
| P2.4 Trust Engine | ✅ V1.0（额外维度配置阶段） |
| 后续平台模块 | ✅ V1.0 微调 |

---

*End of Sprint Delivery Protocol*
