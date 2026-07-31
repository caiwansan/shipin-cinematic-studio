# Sprint-HDZNOVEL-REALITY-02-A — 质量飞轮修复 — COMPLETE ✅

- **日期**：2026-07-31
- **Gate**：4 Task 全完成 + Reality Gate 全通过（掌柜指令启动，技术总监验收方向：质量飞轮优先于功能堆叠）
- **原则**：不重造（consistency-verifier/Revision 表/MENTAL 事件流均复用）、确定性优先（diff/校验用规则不用 LLM）、每 Task 独立验证

---

## Task 1 — orchestrator 审批状态机修复（🔴 产品欺骗）✅

### 审计发现 3 处强制短路（比审计记录更严重）

| # | 位置 | 问题 |
|---|------|------|
| 1 | `orchestrator.service.ts` executeTask 尾部 | 注释不打自招："如果 reviewer 设为 waiting_approval（未通过），**自动改为 completed 以触发飞轮**"→ 审批弹窗永远等不到不合格任务 |
| 2 | `continueChain` reviewer else 分支 | 章节被强制标 `reviewed` + 事件谎称 `user_approved`（用户从未批准） |
| 3 | `continueChain` reviewer 分支不看 `isRejected` | 用户点「拒绝」→ 走 else → 章节照样标 reviewed —— **拒绝=通过**，彻底反了 |

### 修复后状态机

```
Writer 完成（首次）→ waiting_approval → 用户通过 → reviewed / 用户拒绝 → rewrite
Writer 完成（rewrite）→ 自动 Reviewer
  → 合格(≥passScore) → reviewed（reviewer_pass）
  → 不合格 → waiting_approval（保持，等用户审批）
      → 用户通过 → reviewed（真实 user_approved + note）
      → 用户拒绝 → Writer rewrite（带用户批评意见）
```

### 验证（离线，mock executeTask 防 LLM 调用）7/7 ✅

| 路径 | 结果 |
|------|------|
| A 拒绝 → rewrite 任务创建 + 批评意见传入 + 章节不被标 reviewed | ✅ |
| B 用户通过未达标 → reviewed + 真实 user_approved + note | ✅ |
| C 合格自动 → reviewed + reviewer_pass（回归） | ✅ |
| D 强制短路代码已删除 | ✅ |

---

## Task 2 — MasterPlan 版本治理（diff/rollback/impact）✅

### 复用确认（不重造）

**地基已存在**：`HdzPlanRevision` 表（version/reason/planBefore/planAfter/diffSummary）+ `GET /revisions` + 版本递增。

### 补的缺口

| 缺口 | 修复 |
|------|------|
| diffSummary 全是 null（TODO） | 新增 `plan-diff.service.ts`：确定性 diff（世界观/禁则增删/卷调整/伏笔增删/角色弧线），生成人类可读摘要 |
| generate 端点不写 revision（覆盖旧总纲无历史） | 补写修订记录（可回滚到生成前） |
| 无回滚能力 | `POST /master-plan/rollback`：Git 式（回滚生成新修订，可再回滚）；locked 禁止；状态保持当前 |
| 无影响分析 | `GET /master-plan/impact?version=N`：对比当前 vs 目标版本 → 受影响章节区间 + 严重度（low/medium/high） |

### 验证 11/11 ✅

diff 识别（世界观/禁则/卷/伏笔）→ 修订历史 → impact（severity=high, 区间 1-120+全部章节）→ rollback（内容还原+新修订+状态保持）→ locked 禁止 rollback

---

## Task 3 — 人物心理状态卡（CharacterMindState）✅

### 复用确认（不重造）

- `HdzCharacterState.stateType='MENTAL'` **事件流已存在且工作**（20 条真实数据，情感演化）
- 缺的是**结构化心理档案快照**（fear/desire/belief/trauma/道德底线）——事件是流、快照是卡，各司其职

### 新增

- **表** `character_mind_states`（projectId+characterId 唯一，每章更新）
- **服务** `character-mind.service.ts`：
  - `deriveInitialMindState`：从角色卡规则初始化（motivation→欲望、background→创伤、personality→信念）——确定性，无 LLM 成本
  - `updateMindStateFromEvents`：每章 MENTAL 事件聚合进 summary（保留最近 5 章）+ **性格漂移检测**（谨慎底色+冲动事件 → ⚠️ 警告）
- **路由** `character-mind.ts`：GET（自动初始化）/ PUT（用户校正）/ GET 全部
- **回写链**：event-extractor 每章 MENTAL 事件 → 自动更新心理档案
- **上下文注入**：story-context-builder 角色段新增 `🧠 心理档案`（writer/文曲星可见）

### 验证 11/11 ✅

自动初始化（欲望/创伤/信念）→ 用户校正 → MENTAL 聚合 + 漂移警告 → StoryContext 注入 → GET 全部

---

## Task 4 — 剧情一致性引擎 ✅

### 复用确认（掌柜审计提示的关键）

**`consistency-verifier.service.ts` 已存在且功能完整**（347 行）：
- 5 维校验：entity existence / timeline monotonicity / inventory / relationship conflicts / forbidden transitions
- 已被 writer shadow pipeline + phasex + alignment-backtest 使用

### 缺口与修复

现有 verify 依赖 `state_delta`（结构化输出）——shadow 置信度低时校验空转。补**章节文本级校验**（确定性规则，无 LLM）：

- `verifyChapterText(projectId, chapterNo, text)` 加入现有 ConsistencyVerifier 类：
  1. 死亡角色仍在行动（identity 含死亡 + 正文出现行动/对话，排除回忆/梦境/遗物）
  2. 已失去/损坏物品仍在用（直接查 ITEM 状态记录——当前持有列表会过滤失去物品）
  3. 透传 story-context-builder 的规则警告
  - 输出：warnings + score（100 - 10/条）+ ok + eventLog
- **接入 reviewer**：审校前跑预检，警告注入审校 prompt（LLM 逐条核查），结果随 reviewData 落库

### 验证 6/6 ✅

死亡角色行动→警告(90分) / 失去物品在用→警告(90分) / **回忆梦境不误报** / 空文本 / reviewer 集成（注入+落库）

---

## Reality Gate

| Gate | 结果 | 证据 |
|------|------|------|
| G1 审批真实性 | ✅ | 不合格不再自动通过；拒绝→重写；通过→真实 user_approved（Task 1，7/7） |
| G2 版本治理 | ✅ | diff/rollback/impact 全链路（Task 2，11/11） |
| G3 人物心理 | ✅ | CharacterMindState 全链路 + 漂移检测（Task 3，11/11） |
| G4 一致性引擎 | ✅ | 文本级校验 + reviewer 集成，误报受控（Task 4，6/6） |
| G5 不重造 | ✅ | consistency-verifier / Revision 表 / MENTAL 事件流全部复用确认 |

---

## 改动文件（10 个）

| 文件 | 改动 |
|------|------|
| `orchestrator.service.ts` | 审批状态机修复（短路移除 + isRejected 处理 + 真实 user_approved） |
| `plan-diff.service.ts` | 新增：确定性 diff + 影响分析 |
| `master-plan.ts` | diffSummary 生成 + generate 补 revision + rollback + impact 端点 |
| `schema.prisma` + migration | character_mind_states 表 |
| `character-mind.service.ts` | 新增：心理档案服务（初始化/聚合/漂移检测/格式化） |
| `character-mind.ts` | 新增：心理档案路由 |
| `routes/hdz/index.ts` | 注册心理档案路由 |
| `event-extractor.service.ts` | MENTAL 事件 → 心理档案聚合钩子 |
| `story-context-builder.service.ts` | 角色段注入 🧠 心理档案 |
| `consistency-verifier.service.ts` | 新增 verifyChapterText（文本级校验） |
| `reviewer.service.ts` | 预检警告注入 + 结果落库 |

**验证脚本**：`scripts/verify-reality-02a-task{1,2,3,4}.ts`

---

## 剩余（02-B 及之后建议）

1. **章节生成前 Context Gate**（掌柜 02 Task-04）：Writer 请求 → Gate 检查（角色死亡/神器/秘密/时间线）→ 允许生成 → Writer → Reviewer。verifyChapterText 已可复用为 Gate 检查器
2. **MasterPlan 影响分析 → 自动重算**：rollback 后受影响章节标记待重写（impact 区间已算好）
3. **心理档案 LLM 深化**：规则初始化已工作，可后续加 LLM 精修（成本换深度，等掌柜决策）
4. 商业化三件套：orchestrator 配额计费 🟠 / SSRF 🟡（02-B 排序按掌柜）

---

*质量飞轮已修复：系统不再欺骗用户。不合格章节真正等待审批，拒绝真正触发重写，版本可回滚，人物有心，剧情有验。*
