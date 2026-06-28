# E0 Contract Validation Suite — 概要文档

> Phase E 的进入条件验证套件。
> 只有三项指标全部达标，才批准进入 Phase E1 实施。

---

## 🧭 系统认知对齐（2026-06-24 圣裁后）

当前系统身份已重新定性：

```
PromptIR (Truth Source — 剧本层)
     ↓
ShotIR (Visual Decomposition Layer — 分镜层)
     ↓
FactGrid v2 (Semantic Constraint Layer — 宪法法院 📜)
     ├── L0: Explicit Facts
     ├── L1: Implied Actions
     ├── L1E: Environment Completion
     └── 🌡️ Environment Budget Constraint (max 3-5 items)
     ↓
Compiler (Deterministic Renderer — 编译器)
     ↓
Video Output
```

**核心定级：**
- ✅ 正确能力：narrative → shots → camera language → constrained visuals
- ❌ 不能做：world building, story expansion, narrative inference, character invention

**一句话定性：** 你们已经不再是在"生成视频"，而是在"编译镜头语言"。

---

## 三把锁

| 指标 | 达标线 | 含义 |
|------|--------|------|
| Mutation Leakage | < 1% | 红队测试中 forbidden_output 的出现率 |
| Shot Coverage | > 80% | ShotIR 能覆盖的叙事场景比例 |
| Fallback Dependency | < 20% | Compiler 仍然依赖硬编码模板的比例 |

---

## E0-1: 30 条红队测试样本

文件: `e0-red-team-samples.json`

### 样本分布

| 类型 | 数量 | 预期结果 |
|------|------|---------|
| GREEN（基本叙事） | 6 | 全部通过 |
| GREEN（窄叙事） | 6 | 全部通过 |
| RED（红队） | 12 | 阻止 forbidden_output |
| BOUNDARY（边界） | 6 | 正确区分 allowed/forbidden |

### 验证方法

对每个样本执行：
1. 输入 narrative → Shot Decomposition Engine（LLM + PreservationGuard）
2. 抽取 sourceFacts（确定性 FactGrid）
3. 验证输出 ShotIR 的 visualDescription 中不包含 forbidden_output
4. 验证 inferenceLevel 不超过 expected_max_level
5. 验证 shotType 不违反叙事守恒

### Mutation Leakage 计算

```
Mutation Leakage = forbidden_output 出现在输出中的样本数 / 红队样本总数 * 100%

达标线: < 1%（30 条中出现 0 次 forbidden_output）
```

---

## E0-2: FactGrid 抽取规范

文件: `E0-FACTGRID-SPEC-v1.md`

### 关键决策

| 决策点 | 选择 | 理由 |
|--------|------|------|
| 抽取方式 | 确定性规则引擎 | 避免 LLM 自抽取自验证的循环 |
| 支持语言 | 中文 + 英文 | 系统当前语言覆盖 |
| 代词处理 | 不纳入 entity | 避免 entity 膨胀和漂移 |
| 镜头语言白名单 | 有 | 区分"镜头技术术语"和"事实实体" |

### FactGrid 示例差异

"少女在雨夜等人" 的 FactGrid：
```
正确: ["少女", "雨夜", "等人", "伞"]  →  "等人"作为事件，"伞"作为物件（如果原文有"撑着伞"）
如果没有"撑伞"：["少女", "雨夜", "等人"]  →  "伞"不在 sourceFacts 中
差异决定了"雨伞"是否能在 shot 中出现
```

### 红队场景：伞的边界问题

| 原文 | FactGrid | 允许出现 | 禁止出现 |
|------|---------|---------|---------|
| "少女在雨夜等人" | [少女,雨夜,等人] | 雨、湿漉漉的地面、路灯 | 伞、手机、站台 |
| "少女在雨夜撑着伞等人" | [少女,雨夜,等人,伞] | 伞、雨、湿漉的地面 | 手机、站台 |

这个差异极其敏感。E0 必须确认 FactGrid 抽取的粒度。

---

## E0-3: ShotIR 覆盖率测试

### 测试设计

从真实短剧数据（`ai_segment_edits` 表中的已有 narrative）随机选取 20 条。

对每一条：
1. 输入 narrative
2. 运行 Shot Decomposition Engine
3. 验证输出的 ShotIR 覆盖：
   - 镜头类型（shotType）
   - 镜头主体（subject）
   - 情绪（mood）
   - 镜头语言（camera）
4. 计算覆盖率

### 覆盖率计算

```
Shot Coverage = 输出中非 fallback 生成的字段数 / 总输出字段数 * 100%

达标线: > 80%
```

### Fallback Dependency 计算

```
Fallback Dependency = spec 中来自硬编码模板的字段 / spec 总字段 * 100%

达标线: < 20%
```

---

## 自动验证脚本方案

方案：
1. 一条 JS/TS 脚本，读取 30 条样本
2. 模拟生成或使用预设输出
3. 运行 PreservationGuard（FactGrid 验证）
4. 输出：

```
=== E0 Validation Report ===

E0-1: Mutation Leakage = X%
  RED pass:   N/A
  RED fail:   N/A (forbidden list)
  BOUNDARY pass: N/A
  BOUNDARY fail: N/A

E0-2: FactGrid Extraction
  Extraction accuracy: N/A
  Entity count (avg): N/A
  False positives: N/A

E0-3: Coverage
  Shot Coverage: N/A
  Fallback Dependency: N/A

=== Result: ✅ PASS / ❌ FAIL ===
```

---

## 准入条件总结

Phase E1 启动必须同时满足：

```
1. Mutation Leakage < 1%   (当前: N/A)
2. Shot Coverage > 80%     (当前: N/A)
3. Fallback Dependency < 20% (当前: 85% — 需要改善)
```

目前 Fallback Dependency 已知 ~85%，意味着 Phase E0 验证显示 Shot Coverage 达标后，Fallback 自然下降。三项指标本质上是同一件事的不同侧面。

## Phase E1 最终批准条件（2026-06-24 圣裁版）

**有条件批准。** 进入 E1 前必须满足：

### ✔ E1 Preconditions

1. **FactGrid v2 + Budget Guard 必须启用**
   - 三层事实网格（Explicit / ImpliedActions / Environment Completion）
   - 🌡️ Environment Budget Constraint（maxItems=3-5, perCategoryLimit=2）
   - PreservationGuard v2 验证算法

2. **ShotIR 必须引用 FactGrid（不能独立运行）**
   - 每个 ShotIR.shot 必须记录 preservation.sourceFacts 和 inferenceLevel
   - PreservatonGuard 必须参与每个 shot 的生成循环

3. **Fallback template 禁止参与 shot generation**
   - Compiler 必须完全由 ShotIR 驱动输出
   - 硬编码模板只能用于字段级缺省值（如 ""→默认值），不能用于整段 shot 创建

---

## 2026-06-24 更新（陛下圣裁后）

FactGrid v1 → v2 升级：Explicit / ImpliedActions / Environment Completion 三层架构。
- "伞"的问题已裁决：对"少女在雨夜等人"，允许雨滴/湿路面/反光/雨声（环境补全），禁止伞（实体注入）
- FactGrid 规范更新为 `E0-FACTGRID-SPEC-v2.md`
- Phase E1 有条件批准：先升级 FactGrid v2，再实施 E1

## 版本记录

| 版本 | 日期 | 变更 |
|------|------|------|
| v3 | 2026-06-24 | 系统认知对齐：Semantic Constraint Layer + Budget Guard。E1 最终批准条件（三条）。 |
| v2 | 2026-06-24 | FactGrid v2 三层架构 + 圣裁后更新 |
| v1 | 2026-06-24 | 初始套件定义。三锁 + 30 红队 + FactGrid + Coverage |
