# IPSL — Identity Perturbation Specification Layer

## Phase 4.11 — 身份扰动规范

> **本文件不是架构设计，不是控制系统，不是 execution harness。**
> 它是对「如何离线测量系统身份稳定边界」的规范定义。
>
> ### 架构约束
> Stress Harness 是 **offline replay evaluator**，不是 runtime control layer。
> - 不接入任何 execution path
> - 不修改 seed matching / trace distribution / scoring calibration
> - 只消费 telemetry log 做离线 replay 分析
> - 目标：评估系统鲁棒性（evaluation tool）
> - ⛔ 非：runtime 自适应进化机制（control layer）
>
> P 系列（Path-level）算符在离线 replay 中模拟，永不注入主系统 runtime。

---

## 一、扰动类型定义

系统接受三类扰动，分类依据是扰动作用的「深度」：

```
类别        作用层                 安全等级
Input       → AnchorSync          安全
Constraint  → CNL / CDML          受控
Path        → D2 Dual-Lane        危险
```

---

## 二、Input-level Perturbation（安全）

**定义**：不改变意图的输入形式变化。

适用于测试：
- IDF 对表面变体的敏感性
- Phase Portrait attractor 对噪声的鲁棒性
- CII 在不同表达下是否维持 causal consistency

### 扰动算符

| 算符 | 描述 | 举例 |
|------|------|------|
| `T_synonym` | 同义改写 | `"生成将军特写"` → `"制作将军近景"` |
| `T_noise` | 语义噪声注入 | 在指令中插入冗余修饰词 |
| `T_restructure` | 结构重排 | 修改 prompt 中约束段的顺序 |
| `T_trim` | 信息削减 | 移除非核心约束，观察系统是否仍稳定 |

### 验证条件

```
输入 IDF delta < 0.05         → 通过
Phase Portrait radius delta < 10%  → 通过
CII confidence delta < 0.1    → 通过
```

### 允许的修改

```yaml
modify:
  - anchor_prompt 措辞
  - constraint 顺序
  - 非关键属性值（±10%）
  - 同义词替换
disallow:
  - 改变角色身份
  - 改变场景语义
  - 改变意图类型
```

---

## 三、Constraint-level Perturbation（受控）

**定义**：改变约束强度分布，但不破坏约束拓扑。

适用于测试：
- DCVL 分歧检测能力
- DSB 稳定缓冲对不同偏置的响应
- DIE 在偏置漂移下的意图合成偏移

### 扰动算符

| 算符 | 描述 | 极限 |
|------|------|------|
| `W_bias_shift` | CDML 权重倾斜 | 不超过原权重的 ±30% |
| `W_constraint_swap` | 两个约束优先级互换 | 仅限同层约束 |
| `W_collapse` | 削减高熵约束组 | 最多移除总约束的 15% |
| `W_expand` | 展开（分裂）约束 | 一个约束拆为两个，不新增语义 |

### 验证条件

```
DSB stability score 下降 < 0.2       → 通过
DCVL divergenceRate 上升 < 0.15      → 通过
DIE intent 类型不变                   → 必须（禁止 SUSPEND 转 PROCEED）
```

### 允许的修改

```yaml
modify:
  - CNL 约束方差
  - CDML bias weight 分布
  - DEIP 偏置图的边权重
disallow:
  - 新增或删除约束节点
  - 反转约束极性
  - 重建偏置拓扑
```

---

## 四、Path-level Perturbation（危险）

**定义**：主动创造 D2 Dual-Lane 的分歧条件。

**这是最有价值也最危险的扰动**。它直接测试系统在内部冲突时的身份保持能力。

### 扰动算符

| 算符 | 描述 | 风险等级 |
|------|------|----------|
| `P_forced_divergence` | 强制 Scorer 和 Graph 产出相反推荐 | 高 |
| `P_lane_suppress` | 抑制其中一个 Lane 的信号强度 | 中 |
| `P_fusion_override` | 强制 DOL 选择非默认 canonical mode | 高 |
| `P_signal_invert` | 反转 DCVL 输入一致性信号 | 极高 |

### 验证条件

```
DSB 基线冻结后分数回升 < 1.0          → 通过
DIE 意图类型未超出 {PROCEED, SUSPEND, REJECT}  → 必须
CII identity confidence 下降 < 0.25    → 通过
Phase Portrait attractor 中心位移 < 初始半径  → 必须
```

### 允许的修改

```yaml
modify:
  - Scorer → Graph 分歧度（仅离线模拟，不修改 runtime scoring 函数）
  - DOL mode 选择倾向（仅离线 counterfactual，不注入 production graph）
  - Fusion 裁决权重（仅离线 replay，不修改 Fusion Engine）
disallow:
  - 改写 DIE 输出层
  - 绕过 DCVL 验证
  - 删除 DSB 缓冲
  - 修改 identity observer
  - 影响 scoring 函数  # ⬅️ 铁律：P 系列是 counterfactual trace generator，不是 policy shaper
```

---

## 五、扰动序列协议

一次 stress test 由以下阶段构成：

```
Phase 1: Baseline（10 次无扰动决策）
  记录：IDF baseline + Portrait attractor + CII baseline

Phase 2: Input perturbation（5 次）
  每次随机选择 T_synonym / T_noise / T_restructure / T_trim
  记录：逐次 delta

Phase 3: Recovery（3 次无扰动）
  观测：attractor 是否回到原中心

Phase 4: Constraint perturbation（5 次）
  每次随机选择 W_bias_shift / W_constraint_swap / W_collapse
  记录：DSB 响应曲线

Phase 5: Recovery（3 次无扰动）
  观测：DSB 是否收敛回基线

Phase 6: Path perturbation（3 次）
  从 P_forced_divergence / P_lane_suppress / P_fusion_override 中选
  记录：CII identity confidence + Phase Portrait center displacement

Phase 7: Stabilization（10 次无扰动）
  观测：系统是否恢复到 baseline attractor

Full protocol: 39 次决策循环
```

### 判定标准

```
PASS:
  - 最终 Phase Portrait attractor 与 baseline 中心偏移 < 初始半径 × 1.5
  - CII identity confidence 恢复至 baseline - 0.1 以内
  - 无身份丢失告警

WARN:
  - 中心偏移 > 初始半径 × 1.5 但在 × 2 以内
  - CII confidence 恢复至 baseline - 0.2 以内
  - 出现身份丢失告警但已恢复

FAIL:
  - attractor 中心永久位移 > 初始半径 × 2
  - CII confidence 低于 0.5
  - 系统在 Stabilization phase 无法恢复 baseline
```

---

## 六、不可违反约束（铁律）

无论任何扰动：

1. **Identity observer 不可被扰动**
   - IDF / CII / Phase Portrait 代码执行路径不受任何扰动影响
   - 它们只读、不写、不参与推理

2. **扰动不可持久**
   - 每次 perturbation phase 结束后，扰动自动撤销
   - Stress Harness 不修改 DB / config / seed data

3. **不产生新语义**
   - 扰动只影响已有结构的强度/顺序/方向——不引入新概念

4. **Stress test 不触发 Phase 5**
   - 不注入行为生成任务
   - 不触发 video / action 层

---

## 七、输出格式

每次 stress test 应输出一份 `Identity Stress Report`：

```json
{
  "protocol": "input-constraint-path",
  "phases": [
    { "phase": "baseline", "samples": 10, "portrait": { "attractorCenter": [...], "radius": 0.18 }, "ciiConfidence": 0.85 },
    { "phase": "input-perturbation", "samples": 5, "maxIdfDelta": 0.03, "portraitMaxDelta": 0.02 },
    { "phase": "recovery-1", "samples": 3, "recovered": true },
    { "phase": "constraint-perturbation", "samples": 5, "minDsbScore": 0.62 },
    { "phase": "recovery-2", "samples": 3, "recovered": true },
    { "phase": "path-perturbation", "samples": 3, "minCiiConfidence": 0.71, "maxCenterShift": 0.15 },
    { "phase": "stabilization", "samples": 10, "recovered": true, "finalAttractorDelta": 0.08 }
  ],
  "verdict": "PASS",
  "summary": "系统在 39 次决策循环后恢复到 baseline attractor，身份保持。"
}
```

---

## 八、部署形态

### 三阶段计划

```
Phase A（当前 — 安全接入）
  IPSL 作为 offline replay evaluator
  不接任何 execution path
  只消费 telemetry log
  验证 39-cycle 协议本身稳定
  输出：offline Identity Stress Report

Phase B（半隔离执行）
  引入 Shadow Execution Lane
  Stress run 不进入 production graph
  只输出 divergence report（baseline vs perturbed）
  不修改任何 runtime 行为

Phase C（仅在理论需求下）
  允许 W/P 类算符进入 runtime
  但必须绑定 rollback kernel
  目前不计划进入此阶段
```

## 九、身份认证

本文档是 **evaluation tool**，不是 control layer。
- 不控制系统行为
- 不改变系统结构
- 不触发 Phase 5
- 不引入新动作层
- 仅回答一个问题：「系统在什么程度的扰动下仍保持同一 attractor basin」

---

*本文档不修改任何系统文件，不改变任何运行时代码。*
*它只是一个离线测量规范。*
