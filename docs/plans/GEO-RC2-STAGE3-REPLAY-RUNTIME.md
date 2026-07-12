# GEO-RC2 Stage 3 — Replay Runtime

## 状态: FINAL
冻结日期: 2026-07-02
前置依赖: GEO-RC2 Stage 2 — ✅ PASS

## 一句话目标
每一次 Discovery 执行都被完整记录、可追溯、可复现、可比较。

## 架构位置

```
Provider Runtime (Stage 2)
  │
  ▼
Replay Runtime (Stage 3) — 在此
  │
  ├── M1: Replay Recorder    — 每次执行生成 Replay
  ├── M2: Replay Store       — 统一存储 + 查询
  ├── M3: Replay Viewer API  — REST 入口
  ├── M4: Evidence Index     — 证据索引
  └── M5: Replay Comparison  — 跨版本/跨 Provider 比较
  │
  ▼
Stage 4 (Golden Runtime)
```

## 5 个 Milestone

### M1: Replay Recorder（最高优先级）
每次执行记录：
- Replay ID / Trace ID / Snapshot Version
- Provider / Model / Prompt Version
- Request / Structured Result / Evidence
- Duration / Cost / Status / Timestamp

**Gate**: 任何 Discovery 执行必须产生 Replay。

### M2: Replay Store
统一内存存储（后续可切换持久化）：
- 查询 / 列表 / Diff / Search / Version

### M3: Replay Viewer API
- `GET /replay`
- `GET /replay/:id`
- `GET /replay/:id/evidence`
- `GET /replay/:id/diff`
- `GET /replay/:id/export`

### M4: Evidence Index
建立证据索引：
- Evidence ID / 来源 / 引用关系 / Confidence
- Snapshot Version / Replay Version

### M5: Replay Comparison
- 同一品牌不同时间比较
- 不同 Provider 比较
- 不同 Prompt Version 比较
- 不同 Snapshot 比较

## 文件结构
```
backend/src/services/geo/runtime/
├── provider/               (Stage 2, 已有)
├── replay/                 ← NEW
│   ├── types.ts               (M1)
│   ├── recorder.ts            (M1)
│   ├── store.ts               (M2)
│   ├── routes.ts              (M3)
│   ├── evidence-index.ts      (M4)
│   ├── comparison.ts          (M5)
│   └── index.ts               (导出)
```

## 平台预留设计
当前放在 `services/geo/runtime/replay/`，但所有接口和数据模型均不绑定 GEO 业务逻辑：
- `ReplayRecord` 不包含 brand/project 字段
- `EvidenceIndex` 使用通用 source/reference 模型
- 后续提取为 `runtime/replay/` 共享模块时不需要修改数据模型

## Gate 验收条件
- [ ] 每次 Runtime 执行均生成 Replay
- [ ] Replay 可完整复现一次执行
- [ ] Replay 与 Snapshot 一一关联
- [ ] Evidence 可查询、可导出
- [ ] 支持跨版本 Diff
- [ ] API 完整可用
