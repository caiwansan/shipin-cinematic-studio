# Execution Theory Kernel 结构一览

```
execution-theory-kernel/
├── README.md                      ← 本文件：内核全景
│
├── EXECUTION-THEORY-KERNEL.md     ← 五层公理 + 九条公理 + 不变性
│
├── contracts/
│   └── CONTRACTS.md               ← 9 个 runtime-neutral 接口规范
│
└── migration/
    └── MIGRATION-GUIDE.md          ← 6 步迁移 + 3 种模式 + 核对清单
```

## 核心结构

### 五层
| 层 | 回答 | 公理 |
|----|------|------|
| R9 Truth Anchor | 什么是不变的事实 | A1-A3 |
| R10 Proof Engine | 系统发生了什么 | A4-A5 |
| R11 Observability | 系统如何行为 | A6-A7 |
| P4 Constraint | 什么是允许的 | A8 |
| P5 Causal | 为什么违反 | A9 |

### 九条公理
```
A1  不可变真相源
A2  真相源可快照冻结
A3  快照不可修改
A4  变化可证明 (diff)
A5  行为可重放 (replay)
A6  四种正交观测维度 (structure/diff/replay/drift)
A7  观测不污染执行
A8  观测→约束转化
A9  约束违反→归因链
```

### 九个接口契约
1. Graph Interface
2. Snapshot Interface
3. Diff Interface（语义冻结）
4. Replay Interface（语义冻结）
5. Adapter Interface
6. Drift Interface
7. Policy Interface
8. SLA Interface（语义冻结）
9. Causal Interface

## 系统不变性
- Truth Immutability — 快照冻结后不可修改
- Reproducibility — 同输入同 diff / 同 replay
- Observational Purity — 观测不改变被观测系统
- Constraint Determinism — 同 fidelity 同决策
- Attribution Determinism — 同 drift delta 同归因链

## 迁移
- 6 步迁移流程：Truth Source → Adapter → Diff → Replay → Observability → Governance
- 3 种模式：全量 / 渐进 / 只观测
- 无需修改 kernel 公理，只需实现 9 个接口

## 版本
`v1.0.0`

语义版本规则：
- MAJOR：公理变更
- MINOR：公理澄清/补充
- PATCH：术语/文档修正
