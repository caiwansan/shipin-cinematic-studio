# Customer Truth Review — FCV-1

> **版本**: v1.0 | **用途**: FCV-1 完成后召开，沉淀真实规律后再进入 Phase E  
> **定位**: Phase D → Customer Truth Review → Phase E

---

## 召开时间

**FCV-1 所有 5-10 场测试完成后，在进入 Phase E 之前。**

---

## 会议时长

90 分钟。不设上限讨论，但必须有结论输出。

---

## 会议议程

### 第一部分（20 分钟）—— 数据回顾

1. 5 项指标汇总（15 分钟完成率 / 无帮助完成率 / Explain 理解率 / 下一步准确率 / 愿意再次使用率）
2. Aha Moment Rate 分布（Aha 发生在哪个阶段）
3. S0 + S1 问题列表（按出现次数降序）

### 第二部分（30 分钟）—— 回答四个核心问题

| # | 问题 | 决策 |
|---|---|---|
| 1 | **用户的第一个 Aha Moment 真正在哪里？** | 价值定位是否需要调整 |
| 2 | **Journey 中摩擦最大的三个地方是什么？** | 修复 Sprint 内容 |
| 3 | **如果只修三个问题，哪个指标提升最大？** | 优先级排序 |
| 4 | **哪些需求是噪音，应该明确拒绝？** | 正式纳入 Don't Build List |

### 第三部分（20 分钟）—— 决策

1. **Phase D 是否通过？**
   - 通过条件：全部 5 项指标 ≥ 目标值
   - 不通过：进入修复 Sprint（最多 2 次）
2. **修复 Sprint 内容**：只修 S0 + S1 问题
3. **Phase E 启动条件**：Customer Truth Review 确认修复有效

### 3.5 团队纪律：任何修复必须可追溯到 VOC

> **任何进入修复 Sprint 的问题，都必须能引用至少一个 VOICE-OF-CUSTOMER Observation 编号。**

- Fix → VOC-003
- Fix → VOC-017

而不是"我觉得……"或"我们猜用户会……"。每一次产品改动都能追溯到真实客户行为。

---

### 第四部分（20 分钟）—— 输出

1. **VOICE-OF-CUSTOMER 新增记录**（所有 S0/S1 正式入库）
2. **Customer Truth 决策记录**（四个核心问题的答案）
3. **Phase E 优先级调整**（如需）

---

## Customer Truth Review 的输出格式

```markdown
## Customer Truth Review — FCV-1 — 2026-XX-XX

### 1. Aha Moment 分布
- Discovery: X 人
- Recommendation: X 人
- Verification: X 人
- Publish: X 人
- Learn: X 人
- Knowledge: X 人

### 2. 前三大摩擦
1. [问题] — S1 — X 人出现
2. [问题] — S1 — X 人出现
3. [问题] — S0/S1 — X 人出现

### 3. 优先级修复
- Fix 1: ___（预期提升: ___）
- Fix 2: ___（预期提升: ___）
- Fix 3: ___（预期提升: ___）

### 4. 明确拒绝的需求
- [需求] — 原因: 仅 1 人提出 / Severity S3 / 行为证据不足

### 5. Phase D 结论
[通过 / 修复 Sprint / 未通过]
```
