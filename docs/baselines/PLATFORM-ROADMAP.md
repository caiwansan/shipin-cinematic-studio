# 昆仑镜 Studio Platform 演进路线图

> 一击必中，不做半成品。

---

## v4.0 · Architecture Baseline ✅

> 平台应该长什么样？

**日期**: 2026-07-17  
**主题**: Architecture Freeze  
**核心交付**:
- 11 份 Baseline 规范（MANIFESTO / WORKSPACE / RUNTIME / DATA / CAPABILITY / PLATFORM-SDK / API / EVENT / STATE / EXTENSION / GOVERNANCE）
- 4 份 ADR（Single Runtime / Workspace Adapter / Capability Layer / Repository+ORM）
- Architecture Linter + CI 工作流
- WorkspaceAdapter 合约接口

**验证**: C1.5 Reference Workspace（GEO 试点 × 6 项验证全 PASS）  
**评分**: 10/10 — Architecture Baseline Freeze Complete

---

## v4.1 · Platform Kernel ✅

> 平台真正开始跑起来了。

**日期**: 2026-07-17  
**主题**: Platform Kernel Freeze  
**核心交付**:

| 内核 | 文件 | 职责 |
|---|---|---|
| Execution Kernel | 11 文件 ~1,800 行 | ExecutionEngine · Pipeline · Scheduler · Events · Lock |
| Capability Orchestrator | 14 文件 ~2,700 行 | PolicyEngine · Router · ProviderRegistry · ModelRegistry · HealthManager · CostManager · FallbackManager · CapabilityRegistry |

**平台边界已锁定**:
- Execution 不碰 Provider（只传 CapabilityRequest）
- CapabilityOrchestrator 不碰 Execution 内部
- Provider 只实现 CapabilityProvider 接口
- Workspace 只传 capabilityId

**评分**: 9.8~10/10 — Platform Kernel Freeze Complete

---

## v4.2 · Resource Platform ⏳

> 不仅仅是 Asset Center — 所有 AI 输出统一为 Resource，构建平台资源层。

**计划时间**: 2026-07-18  
**主题**: Resource Platform Baseline + Kernel  
**核心对象**:
1. **ResourceIdentity（RID）** — 所有对象（Asset / Knowledge / Claim / Prompt / Execution 等）统一标识
2. **Resource Schema** — 统一资源模型（Asset / Knowledge / Prompt / Execution / Evaluation / Dataset）
3. **Resource Graph** — 资源关系、血缘与引用模型（Lineage / Relation / Dependency）
4. **Storage Adapter** — Local / OSS / COS / S3 统一存储接口
5. **Lifecycle** — Draft → Active → Archived → Deleted
6. **Processing Pipeline** — Thumbnail / Transcode / OCR / ASR / Metadata Extraction

**覆盖六类资源**:
1. MediaResource（图片 / 视频 / 音频 / 字幕）
2. KnowledgeResource（Knowledge / Claim / Evidence / Citation）
3. PromptResource（Prompt / Embedding / 向量 / 模型输出）
4. RuntimeResource（Execution Result / Workflow Snapshot / Trace）
5. EvaluationResource（评测数据集 / Benchmark / Score）
6. DatasetResource（训练数据 / 标注数据）

---

## v4.3 · Integration Runtime ⏳

> 事件驱动的平台集成层。

**计划时间**: Next  
**主题**: Event / Command / Query / Saga / Outbox / Replay  
**范围**:
- Command Bus + Query Bus
- Saga Orchestrator（跨服务事务）
- Outbox + Dead Letter Queue + Inbox
- **Event Replay** — Debug 与恢复能力（重新生成 Asset / 重新计算 Cost / 重新同步）
- Audit Trail

---

## v4.4 · Platform Services ⏳

> 生产级平台服务产品化。

**计划时间**: Next  
**主题**: Auth / Project / Membership 生产化  
**范围**:
- Auth 升级 + RBAC
- Project Center 统一 + type 枚举
- Membership + Tenant Isolation
- Rate Limit + Audit Log + Secret Management
- Extension Registry（Plugin / Template / Marketplace）

---

## v4.5 · Domain SDK ⏳

> 领域逻辑从 Workspace 中解耦为独立 SDK。Workspace 只负责 UI，业务逻辑全部进入 Domain。

**计划时间**: Next  
**主题**: @studio/domain  
**范围**:
- Knowledge SDK（Claim / Evidence / Citation / FAQ / Schema）
- Story SDK（Storyboard / Segment / Prompt）
- Brand SDK（BrandProfile / WebsiteSnapshot / Visibility）
- Media SDK（Image / Video / Audio）
- Research SDK
- Evaluation SDK
- Workflow SDK
- Resource SDK

---

## v5.0 · Production Platform 🚀

> 平台具备多租户、企业级、市场化能力。

**计划时间**: Future  
**主题**: GA

**最终平台形态**:

```
KMKI Platform
├── Studio Platform
│   ├── Execution Kernel
│   ├── Capability Platform
│   ├── Resource Platform
│   ├── Domain SDK
│   ├── Integration Runtime
│   ├── Platform Services
│   ├── Workspace Plugins
│   └── Marketplace
```

**范围**:
- 多租户隔离
- 企业 SSO / Audit / Compliance
- Plugin / Capability / Workflow Marketplace
- Cost Analysis Dashboard
- SLA / SLO / SLI 保障

---

## 索引

| 文档 | 路径 |
|---|---|
| Architecture Freeze v4.0 | `docs/ARCHITECTURE-FREEZE-COMPLETE.md` |
| C2 Architecture Report v4.1 | `docs/reviews/C2-ARCHITECTURE-REPORT.md` |
| C1.5 Validation Report | `docs/reviews/C1.5-VALIDATION-REPORT.md` |
| Architecture Linter | `scripts/architecture-linter.sh` |
| All Baselines | `docs/baselines/` |
| ADR | `docs/adr/` |
