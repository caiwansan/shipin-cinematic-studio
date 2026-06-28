# PR-1 — PQL v1.0 Production Ready

## 状态

- 前置条件：AF-1 ✅（6 Contract 冻结 + 18 兼容性测试）
- 前置条件：PQL 全链路代码完成 ✅（494 tests / 27 files / all green）
- **原则：不再新增基础设施，只做真实闭环验证**

---

## Sprint 1：接入真实 Provider（3～5 天）

### 目标
选一个主力 Provider，走通全链路：
```
CIR → CCP(VolcengineCompiler) → Provider API → Video → VEP → CEE → COE → CIR Patch
```

### 待办

1. **CCP 适配真实 Provider** — 当前 VolcengineCompiler 是模拟实现。确认真实 AIGC API 的 prompt 格式、能力边界，调 CCP 的 prompt renderer 匹配。
2. **VEP 抽帧接入** — 后端已有 `execution-images.ts` 抽帧逻辑。把抽帧输出映射到 `EvidencePackage`。
3. **CEE 评估实际视频** — 跑已实现的 7 个 Evaluator（Object Persistence / Lighting / Composition / Focus / Camera Motion / Shot Scale / Shot Angle），看真实视频的评估结果是否合理。
4. **COE 输出可行性验证** — 验证 CEE 的 CapabilityReport 能进入 COE 产出 CIR Patch，确认 Patch 路径与真实 CIR 结构一致。

### 成功标准
- 全链路代码跑通（不要求自动优化循环，但 CIR → Provider → VEP → CEE 必须完整可执行）
- CapabilityReport 有真实数据，不是模拟数据

---

## Sprint 2：Golden Benchmark（约 1 周）

### 目标
固定 **12 个 Golden Case** 作为回归基线。以后任何 Kernel / Provider / Compiler 变更，先跑这 12 个。

### 12 个 Case 覆盖率

| # | 类型 | 主能力 | 场景描述 |
|---|------|--------|----------|
| 1 | 人物一致性 | OBJECT_PERSISTENCE | 单人正面→侧脸 |
| 2 | 对话 | CAMERA_COMPOSITION + SHOT_SCALE | 双人过肩对话 |
| 3 | 跟拍 | CAMERA_PATH + CAMERA_MOTION | 人物行走跟拍 |
| 4 | 情绪 | FOCUS_CONTROL + LIGHT_CONTINUITY | 浅景深+暖光氛围 |
| 5 | 道具 | OBJECT_PERSISTENCE | 手持道具旋转 |
| 6 | 多角色 | SPATIAL_RELATIONSHIP | 三人空间定位 |
| 7 | 建立镜头 | SHOT_SCALE | 大远景→中景 |
| 8 | 夜景 | LIGHT_CONTINUITY | 单光源夜景 |
| 9 | 室内外转换 | TEMPORAL_CONSISTENCY + LIGHT_CONTINUITY | 室内→室外 |
| 10 | 产品展示 | FOCUS_CONTROL | 产品转写 |
| 11 | 动作 | CAMERA_MOTION | 快速摇镜 |
| 12 | 长镜头 | TEMPORAL_CONSISTENCY | 30s+ 单镜头 |

### Golden Case 格式

每个 Case 包含：
- `story.md` — 自然语言场景描述
- `cir.yaml` — 对应的 CIR（导演设计）
- `expected_evidence.yaml` — 期望证据
- `baseline_report.yaml` — 首次运行的 CapabilityReport 基线

### 成功标准
- 12 个 Case 全部有 CIR
- 12 个 Case 全部能在真实 Provider 上跑通
- 12 个 Case 全部产出 CapabilityReport
- 基准报告存入 CKB BenchmarkCorpus

---

## Sprint 3：短剧工作台集成（约 1 周）

### 目标
在生成完成后，前端展示 Capability Report。

### 分层 UI

**普通用户模式（默认）：**
```
视频播放器
────────────────────
Quality Score 92
World Consistency 95  ■■■■■■■■■■
Cinematic Quality   90  ■■■■■■■■■
───────
优化建议
  1. 锁定灯光方向 → Apply Patch
  2. 调整景别深度 → Apply Patch
───────
重新生成
```

**专业模式（展开）：**
```
Capability Report
├─ LIGHT_CONTINUITY ──── 78 ── medium
│  Expected: warm continuous
│  Observed: flicker at 2.3s
│  Patch: lock lighting → Apply
├─ SHOT_SCALE ────────── 95 ── pass
├─ FOCUS_CONTROL ─────── 83 ── minor
│  Patch: set shallow DOF → Apply
├─ ......
EvaluationSummary
  World Consistency    92
  Cinematic Quality   88
  Physics             100
  Story Alignment     90
  Overall             91
Evidence Timeline
  Shot 1  Shot 2  Shot 3  ...
  [■■■■]  [■■■□]  [■■■■]
```

### 实现要点
- 前端新增组件：`ProductionQualityPanel.vue`
- 后端新增 API：`GET /api/pql/report/:executionId`
- API 返回 CapabilityEvaluationResult（含 reports + summary）
- COE OptimizationResult 作为可选字段返回
- 默认不展示，开发模式开关

### 成功标准
- 生成完成后自动显示 Quality Score
- 专业模式可查看全部 Capability Report
- CIR Patch 可一键应用
- 重新生成后 Score 变化可见

---

## PR-1 整体成功标准

1. ✅ **1 个真实 Provider** 全链路接入（CIR → Video → VEP → CEE → COE）
2. ✅ **12 个 Golden Benchmark** 建立，作为固定回归基线
3. ✅ **短剧工作台内置 Capability Report**，支持开发模式展开
4. ✅ **CKB 开始沉淀真实生产数据**（非测试数据）
5. ✅ **完成一次自动优化循环**：第一次生成 → Report → COE Patch → 第二次生成，至少部分指标改善

---

## PR-1 完成后建议

**不要立即进入 Wave 3。** 优先做 Provider Capability Ranking：
- 同一 CIR 同时跑多个 Provider
- CEE Benchmark 自动对比
- 输出：某种场景/某项能力下哪家 Provider 最强

然后把 CKB 里积累的 `OptimizationKnowledge` 和 `FailureAtlas` 整合进 CCP——让 Compiler 能根据当前 Provider 自动调整 IR 策略。

等真实数据跑 2-3 轮后再决定 Wave 3 优先级——**由数据驱动，而非预先假设。**
