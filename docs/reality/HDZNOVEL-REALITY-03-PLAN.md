# Sprint-HDZNOVEL-REALITY-03 — 百万字小说宇宙压力验证 — 作战计划

- **日期**：2026-07-31
- **Gate**：掌柜 02-B 验收通过后指令启动
- **目标**：证明「连续生产 100 万字仍然稳定」——混沌珠对外商业发布的底气

---

## 验证承诺

> 一台机器，一个测试作者账号，连续生产 100 卷 / 1000 章 / 100 万字，
> 每 100 章做一次 Reality Checkpoint，最终给出 Novel Reality Score。
> 如果 1000 章后人物不串、世界不崩、伏笔有合、心理不漂 → 商业发布。

---

## Task 1 — 百万字压力测试工程（🔴 最高优先）

### 测试工程结构

```
测试项目: test-novel-100w（100 卷 / 1000 章 / ~100万字）
  ├─ 总纲: 卷规划器生成（10卷/批次，batch 规划）
  ├─ 生产: batch-write 批量入队（每批 100 章）→ hdz-production 队列消费
  └─ 检查点: 每 100 章一次 Reality Checkpoint
```

### Novel Reality Score 定义

基于现有 `consistency-verifier.verify()`（已含 4 类检查）扩展为 6 维指标：

| 维度 | 检查内容 | 数据源 | 权重 |
|------|----------|--------|------|
| 人物一致性 | 角色状态冲突（死亡/阵营/关系）、实体存在性 | verify: entity/relationship | 25 |
| 世界一致性 | 时间线单调、道具清单、地点 | verify: timeline/inventory | 20 |
| 伏笔状态 | 伏笔开/合闭环率（开的伏笔最终要合） | hdzForeshadowing 表 | 20 |
| 心理漂移 | 角色心理状态连续性（无突变漂移） | character-state-evolution 快照 | 15 |
| 质量门 | Gate 拦截率、needs_rewrite 率 | hdzAgentTask 状态分布 | 10 |
| 生产稳定性 | 队列失败率、重试率、断点恢复 | hdz-production 队列指标 | 10 |

**Score 计算**：`NovelRealityScore = Σ(维度分 × 权重)`，每 100 章出一个 checkpoint 分，
最终取全程最低分作为发布门槛（**最低分 ≥ 85 才算通过**——不能平均分好看、某一卷崩掉）。

### 检查点节奏

```
ch100 → ch200 → ... → ch1000（共 10 个 checkpoint）
每个 checkpoint 输出：
  1. verify() 全量检查（该 checkpoint 前 100 章的 delta）
  2. 伏笔开/合统计
  3. 心理漂移检测
  4. 生产指标（拦截/返工/失败）
  5. Reality Score 明细
最终：docs/reality/HDZNOVEL-REALITY-03-REPORT.md + checkpoint 趋势 CSV
```

### 成本估算（BYOK，记测试账号）

| 项 | 量 | 说明 |
|----|----|------|
| 输出 token | ~130 万 | 1000 章 × ~1000 字（中文 1 字 ≈ 1.3 token） |
| 输入 token | ~400 万 | 每章 StoryContext ~4k × 1000 |
| 成本（deepseek 系） | **~¥5-8** | 输出 ¥2/1M + 输入 ¥0.5/1M |
| 成本（doubao 系） | **~¥10-20** | ¥8/1M 输出档 |
| 时间 | 4-8 小时 | 并发 2，每章 30-60s（可分 10 批跑，每批 100 章） |

### 执行方式（等掌柜拍板）

- **方案 A（推荐）**：全真实 LLM 生成。成本 ~¥10 量级，验证最有说服力。
- 方案 B：前 200 章真实 + 后续快速模式（低 token）。省成本，但说服力打折。
- 规模节奏：建议 **先 100 章试点验证管线 → 确认 → 全量 10 批**。

---

## Task 2 — 章节依赖图（剧情知识图谱）🔴

掌柜指出的正确方向：从「影响范围」升级到「依赖图」。

```
节点: Chapter / Character / Item / Secret / Faction
边:   introduced / revealed / destroyed / changed / foreshadows
```

- 数据源：Event Extractor 已提取事件 + 人物状态演化 + 伏笔表
- 用途：rollback 精确影响分析（改"反派真实身份"只重写 20/55/120/180 章，而非 50-200 章）
- 形态：`Novel Knowledge Graph`（邻接表存储 + 影响传播算法）

## Task 3 — 自动剧情规划 Agent（Story Planner）🟠

文曲星负责对话规划，Story Planner 负责**生产规划**：

```
写第 300 章前
  → 检查未来 20 章路线（总纲对齐）
  → 生成章节计划（类似导演分镜表）
  → 等用户确认
  → 批量生产（走 02-B 队列）
```

复用：master-plan / batch-write / 队列，不新建孤岛。

## Task 4 — 商业化计费闭环 🟠

接 Usage Ledger（02-B Task 4），分级套餐：

```
免费: 体验章节（3 章）
VIP: 10万字/月额度
专业作者: 100万字/月
出版机构: 企业版 + 超额计费
```

需要产品决策：额度规则 / 单价 / 超额费率（等掌柜定）。

---

## 风险排序（掌柜已定）

| 风险 | 优先级 | 状态 |
|------|--------|------|
| 百万字真实压力测试 | 🔴 最高 | Task 1（本 Sprint 核心） |
| 剧情依赖图 | 🔴 | Task 2 |
| 配额计费 | 🟠 | Task 4（等产品决策） |
| SSRF | 🟡 | 冻结（不进入，等掌柜） |
| 心理 LLM 深化 | 🟡 | 冻结（不进入，等掌柜） |

---

## 冻结清单（持续）

❌ SSRF 安全修复（等掌柜指令）
❌ 心理 LLM 精修（P2 暂缓）
❌ 多作者协作（Level 5 未来项）
❌ 不新增 Agent/Prompt/模型——本 Sprint 只验证生产，不造智能
