# GEO Engine Dependency Graph

## 六引擎整体依赖

```
Discovery Engine ─────────────────────────────────────────────────
│
│   从外部数据源提取原始知识
│   输出：Raw KnowledgeObject（status=DISCOVERED）
│
▼
Knowledge Engine ─────────────────────────────────────────────────
│
│   对原始知识进行结构化、提取 Claims/Evidence/Citations
│   输出：Enriched KnowledgeObject（status=ENRICHING → VERIFIED）
│
▼
Packaging Engine ─────────────────────────────────────────────────
│
│   将 KnowledgeObject 标准化为可发布的 KnowledgePackage
│   输出：PackageBuild（含 PackageManifest + PackageArtifact）
│   Gateway：验证组件完整性 + 确定性哈希
│
▼
Distribution Engine ────────────────────────────────────────────
│
│   将 Package 通过多个 Publisher 发布到外部目标
│   输出：PublishRecord（每个 Target 一条）
│   已实现：Website / Sitemap / AI Feed Publisher
│
▼
Observation & Visibility Engine ──── [ Sprint 4 ] ──────────────
│
│   观察发布成果的外部位、可见性、引用情况
│   输出：ObservedMetric / VisibilitySnapshot
│   依赖：需要 Scheduler + Crawler + AI Visibility Check
│
▼
Adaptive Engine ──────────────────── [ Sprint 5 ] ──────────────
│
│   根据 Observation Engine 反馈，自动调整上游策略
│   输出：ConfigurationProposal / Workflow Patch
│   依赖：需要 Observation Engine 的完整输出
│
```

## Cross-cutting 引擎

以下引擎不是 Pipeline 中的阶段，而是横跨全链的能力：

```
Evidence Engine ─────────────────────────────────────────────────
│
│   type=discovery  → capture 来源提取的证明
│   type=knowledge  → capture enrichment 产生的数据
│   type=packaging  → capture Build 结果
│   type=distribution → capture PublishRecord 结果
│   type=observation → [Sprint 4+]
│
│   输出：EvidenceRecord（append-only immutable 证据流）
│   查询：Evidence API（timeline / by target）
│   使用：Observation Engine 消费时间线 → 推导可见性变化
│
Verification Engine ─────────────────────────────────────────────
│
│   对 Claims/Evidence 进行触发式验证
│   输出：VerificationResult（通过 verificationId 连接 EvidenceRecord）
│   协作：Truth Layer（truthId 连接 TruthRecord）
│
Truth Layer ─────────────────────────────────────────────────────
│
│   维护真相事实（经过仲裁的最高等级信息）
│   输出：TruthRecord（通过 truthId 关联 EvidenceRecord）
│   独立：不和 Evidence 混为一个概念
│
```

## 数据流向图

```
[外部数据源] ──→ Discovery Engine ──→ [Raw KnowledgeObject]
                                                │
                                                ▼
                                         Knowledge Engine
                                                │
                                     [Enriched KnowledgeObject]
                                                │
                                                ▼
                                         Packaging Engine
                                                │
                                     [KnowledgePackage + Build]
                                    ┌───────────┼───────────┐
                                    ▼           ▼           ▼
                              Website    Sitemap     AI Feed
                              Publisher  Publisher   Publisher
                                    │           │           │
                                    ▼           ▼           ▼
                              [index.html][sitemap.xml][ai-feed.json]
                              [.jsonld]   [entry.json][summary.json]
                              [publish.json][publish.json][publish.json]
                                                │
                                     [PublishRecord] ──── EvidenceEngine
                                                │
                                                ▼
                                   Observation Engine [Sprint 4]
                                                │
                                                ▼
                                     Adaptive Engine [Sprint 5]
```

## Engine 时序

```
Discovery
  │  (每 5min) 检查数据源
  ▼
Knowledge
  │  (每 5min) 处理 KnowledgeObject
  ▼
Packaging
  │  (按需, 手动触发) 构建 Package
  │  └── EvidenceRecord (auto)
  ▼
Distribution
  │  (按需, 手动触发) 发布 Package
  │  └── EvidenceRecord (auto)
  ▼
Observation
  │  (Sprint 4: 定时 / 事件触发)
  ▼
Adaptive
  │  (Sprint 5: 观察反馈触发)
```

## Sprint 4 架构依赖

进入 Observation Engine 前必须的依赖（全部已满足）：

```
┌────────────────────────────────────────────────────────────┐
│ Foundation v1 Freeze                                       │
├────────────────────────────────────────────────────────────┤
│ ✅ Package Contract 冻结 — 知道发布什么                      │
│ ✅ Distribution Contract 冻结 — 知道发到哪里                  │
│ ✅ PublishRecord 模型 — 知道发布时间和状态                   │
│ ✅ EvidenceRecord 模型 + Timeline — 提供可查询的完整历史      │
│ ✅ Evidence API — 支撑 Observation 的数据源                  │
│ ✅ Golden Regression — 确保基础不被破坏                      │
└────────────────────────────────────────────────────────────┘
```

## 产品成熟度仪表盘

```
当前 Foundation v1
═══════════════════════════════════════════════════════
                        Production Readiness
                                10
                                │
                    Evidence   ─┤  (10)
                 Distribution ─┤  (10)
                   Packaging  ─┤  (10)
                   Knowledge  ─┤  (7)
                  Discovery   ─┤  (5.3)
                              ─┼───
                                │
                               0
═══════════════════════════════════════════════════════
                        待开发
                    Observation  ░░░░
                     Adaptive   ░░░░░░░░
                     UI         ░░░░░░░░░░░░░░
═══════════════════════════════════════════════════════
```
