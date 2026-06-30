# 昆仑镜短剧工作台 — 项目上下文（PROJECT_CONTEXT）

> **最后更新**: 2026-07-20  
> **用途**: 任何 AI Agent / 开发者首次进入此项目时的统一入口文档  
> **规则**: 先读此文件 → 按顺序读文档 → 再动代码

---

## 一、当前项目状态

| 维度 | 状态 |
|------|------|
| 平台基线 | **V4.0 Frozen**（2026-07-17） |
| 当前阶段 | **Phase B-0**（Knowledge Infra 阶段，APP 之后 Story 之前） |
| 当前 Sprint | **Sprint 2 (P2)** — Consumer-grade GEO Workspace |
| 基线置信度 | 91% |
| ADI (Architecture Drift Index) | 4（Sprint 1 从 12 降至 4） |
| 运行中服务 | `api-server-aigc` (PM2 id:41) / `nuxt-frontend` (PM2 id:43) / `banana-slides` (PM2 id:3) |
| GEO 路由 | 21 条已验证，全部迁移至 `/api/v1/geo/` 前缀 |

---

## 二、必读文档顺序

> **首次进入必须按此顺序阅读，禁止跳读。**

### 第 1 层：宪法与架构（不可违反）

| # | 文档 | 路径 | 用时 |
|---|------|------|------|
| 1 | 平台宪法 | `docs/architecture/KMKI-PLATFORM-CONSTITUTION.md` | 15min |
| 2 | 平台蓝图 V2 | `docs/architecture/KMKI-PLATFORM-BLUEPRINT-V2.md` | 20min |
| 3 | 平台基线 V4 | `docs/architecture/PLATFORM-BASELINE-V4.md` | 20min |
| 4 | ADR 索引 | `docs/architecture/ADR-INDEX.md` | 5min |
| 5 | V41 架构冻结 | `docs/architecture/V41-ARCHITECTURE-FREEZE.md` | 10min |

### 第 2 层：GEO 领域

| # | 文档 | 路径 | 用时 |
|---|------|------|------|
| 6 | GEO V1 产品规范 | `docs/products/GEO/GEO-V1-SPEC.md` | 25min |
| 7 | GEO 平台收敛 | `docs/plans/GEO-PLATFORM-CONVERGENCE.md` | 10min |
| 8 | GEO 路由迁移 | `docs/plans/GEO-ROUTE-MIGRATION.md` | 10min |
| 9 | GEO 关闭地图 | `docs/freeze/GEO-CLOSURE-MAP.md` | 10min |

### 第 3 层：验证与 Sprint

| # | 文档 | 路径 | 用时 |
|---|------|------|------|
| 10 | Sprint 1 基线验证 | `frontend/studio-v2/workspace/brand-geo/config/BASELINE-VALIDATION-SPRINT1.md` | 10min |
| 11 | P2 Insight First | `docs/plans/P2-INSIGHT-FIRST.md` | 15min |
| 12 | P2 知识智能 | `docs/plans/P2-KNOWLEDGE-INTELLIGENCE.md` | 15min |
| 13 | GEO V1 RC 审计 | `docs/releases/GEO-V1-RC.md` | 10min |

---

## 三、已冻结内容（不可修改）

> **修改以下内容需要架构评审 + 熊大批准。**

### 平台级冻结

- **V4 Platform Baseline**（`PLATFORM-BASELINE-V4.md`）— 12 项规范全部冻结
- **平台宪法 29 条规则**（`KMKI-PLATFORM-CONSTITUTION.md`）— 不可违反
- **ADR 001-018**（`docs/architecture/adr/`）— 已批准的不回退
- **V4.1 架构冻结**（`V41-ARCHITECTURE-FREEZE.md`）— C0-C1.5 全部完成
- **V4.2A 收敛基线**（`docs/freeze/V4.2A-CONVERGENCE-BASELINE.md`）— C2 平台收敛冻结

### GEO 级冻结

- **GEO Closure Map**（`GEO-CLOSURE-MAP.md`）— 4 个产品层 + 7 个侧边栏入口冻结，不新增
- **GEO 前端冻结清单**（`GEO-FRONTEND-FREEZE-MANIFEST.md`）
- **Sprint 1 完整验证** — Fork 消除（28→2 文件）、API Client 收敛、Contract 收敛、Auth 收敛
- **21 条 GEO 后端路由** — 全部验证通过，格式符合 `/api/v1/geo/` 规范
- **Workspace Adapter 接口** — `packages/studio-platform/src/workspace/workspace-adapter.ts` 冻结

### 架构核心原则

| 原则 | 描述 |
|------|------|
| 分层不可逆 | Platform → Workspace → Provider，调用链方向不可违反 |
| Platform 不直接服务用户 | 只能通过 Workspace 层对外 |
| Workspace 不实现平台能力 | 只消费，不重写（Citation / Trust / Credential 走平台） |
| Workspace 不知道 Provider | 代码中禁止出现模型名、Provider 名、API Key |
| Platform 不知道业务语义 | API 输入输出必须是通用结构 |

---

## 四、当前开发目标（Sprint 2 — Consumer-grade GEO Workspace）

### 北极星

> 用户不应该学习 GEO，而应该直接获得下一步决策。

### 哲学转变

| 旧思维 | 新思维 |
|--------|--------|
| Data Platform | **Decision Platform** |
| 功能完整度分维度推进 | **Insight Layer 作为第一印象** |
| Entity → Knowledge → Evidence → Report | **Report 第一，细节可展开** |
| "用户不需要学习系统" | **"用户直接获得下一步决策"** |

### Sprint 2 核心交付

| 优先级 | 任务 | 说明 |
|--------|------|------|
| P0 | **Report First** | Report Workspace 作为默认入口，不要求用户从底层构建 |
| P0 | **Dashboard → Mission Control** | 不再展示数据库，告诉用户"下一步" |
| P1 | **Brand Wizard** | 轻量引导，Smart Defaults，逐步隐藏 Step 表象 |
| P1 | **Sidebar 收敛** | 最多 4-5 项，其余进 More/Advanced/Developer |
| P1 | **Terminology 清洗** | Runtime/Execution/Provider/Metadata → 不可见 |
| P2 | **Citation Foundation** | Citation Center 模块（P2.1） |
| P2 | **Evidence** | Evidence Center（P2.2） |
| P2 | **Claim Intelligence** | Claim Center（P2.3） |
| P2 | **Trust Engine** | 平台级可信度引擎（P2.4） |

> **关键约束**: P2 开发顺序为 Citation → Evidence → Claim → Trust Engine，跳级做 Claim 会导致数据根基不稳。

---

## 五、最近完成的里程碑

| 里程碑 | 日期 | 内容 |
|--------|------|------|
| V4 平台基线冻结 | 2026-07-17 | 12 项规范全部冻结 |
| GEO Sprint 1 冻结 | 2026-07-17 | Fork 消除、API Client 收敛、Contract 对齐、Baseline 置信度 91% |
| C0-C1.5 全部完成 | 2026-07-17 | 11 基线文档 + 4 ADR + Linter/CI + SDK 16 模块 |
| V4.1 架构冻结 | 2026-07-17 | Execution Kernel + Capability Orchestrator |
| P1-RC 发布 | git tag: `geo-p1-rc` | GEO V1 可交付 SaaS |
| ADR-018 | 最新 | Website Intelligence as Platform Capability |

---

## 六、默认执行规范

### 开发流程

```
Build → Regression（确认不破坏 Baseline）→ Deploy → PM2 Restart → Health Check → Go Live
```

### 编译命令

```bash
# 后端编译（改 TS 后必须做）
cd /root/shipin-cinematic-studio/backend && npx tsc && npx prisma generate && pm2 restart api-server-aigc

# 前端编译
cd /root/shipin-cinematic-studio/frontend && npx nuxt build && pm2 restart nuxt-frontend
```

### 架构合规检查

```bash
bash scripts/architecture-linter.sh
```

### PM2 服务管理

| 服务 | PM2 ID | 类型 |
|------|--------|------|
| 后端 API | 41 | `api-server-aigc` |
| 前端 | 43 | `nuxt-frontend` |
| PPT 工作台 | 3 | `banana-slides` |

### 通信规则

- 熊大通过 QQ 私聊
- AI 自称熊二
- 沟通简洁直接，不需要铺垫

---

## 七、下一阶段目标（Phase B-0 完成后）

| 阶段 | 内容 | 说明 |
|------|------|------|
| Phase B-1 | Citation Center 完整实现 | P2.1 |
| Phase B-2 | Evidence Center | P2.2 |
| Phase B-3 | Claim Intelligence | P2.3 |
| Phase B-4 | Trust Engine（平台级） | P2.4 |
| Phase C | 短剧/小说/PPT 三方接平台 | Workspace 统一 |
| Phase D | 用户增长、稳定性、SLA | 平台运营阶段 |

---

## 八、常见问题

### Q: 上下文丢失了怎么办？
A: 读此文件 → 按第 2 节顺序读文档 → 再动代码。不要从零遍历代码。

### Q: 需要修改冻结内容怎么办？
A: 提架构评审，熊大审批。90% 情况下不需要修改冻结内容。

### Q: 发现代码和文档不一致怎么办？
A: 以代码为准，但优先询问。不一致点是技术债务，应在当前 Sprint 中修复。

### Q: PM2 服务挂了怎么办？
A: 先看日志，找到根因，再重启。禁止"重启试试"。
```bash
pm2 logs <id> --lines 100
```

### Q: 编译失败怎么办？
A: 确认是否改过 TS 文件 > 确认 `npx tsc` 错误 > 修复类型错误 > 重新编译。TS 编译错误通常是类型不匹配或 import 路径错误。

---

*此文件由 AI 生成并维护。保持简洁，免于膨胀。*
