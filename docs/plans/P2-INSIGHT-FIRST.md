# Sprint P2 — Insight First（熊大评审后定稿）

> 北极星：**用户不应该学习 GEO，而应该直接获得下一步决策。**
>
> Sprint 2 第一个里程碑：✅ PASS 可以继续。
> 第二阶段目标：从 One-click 升级为 Insight First。

---

## 哲学转变

| 旧思维 | 新思维 |
|--------|--------|
| Data Platform | **Decision Platform** |
| Entity → Knowledge → Evidence → Report | **Report 第一，细节可展开** |
| "用户不需要学习系统"（清理术语） | **"用户直接获得下一步决策"** |
| 功能完整度分维度推进 | **Insight Layer 作为第一印象** |

---

## 已完成（Sprint 2 前半段）

- [x] Dashboard → Mission Control（不再展示数据库，告诉用户"下一步"）
- [x] Wizard → 轻量引导（还有 Step 1/2/3 表象，后续隐藏）
- [x] Sidebar 收敛（目标：最多 4-5 项，其余进 More/Advanced/Developer）
- [x] Terminology 清洗（Runtime/Execution/Provider/Metadata → 不可见）
- [x] Frontend Architecture V2 规范

---

## Sprint 2 后半段：Insight First

### 核心产出：Report Workspace

不再走 Citation → Evidence → Claim → Report 的纵向链路。
改为 **Report 作为默认入口**，底层三个模块并行建设。

#### Report 内容结构（用户看到的）

```
┌─────────────────────────────────┐
│ 你的品牌健康度 82 ★★★★★         │
│                                 │
│ 今天最重要的三件事：             │
│ ① 品牌词覆盖率需要提升          │
│ ② 竞品对比分析有新增竞品         │
│ ③ 两条高风险舆情需要关注         │
│                                 │
│ ──── 品牌概况 ────              │
│ 品牌定位 / 核心信息 / 声量趋势   │
│                                 │
│ ──── 搜索表现 ────              │
│ SERP 占有率 / 品牌词排名变化     │
│                                 │
│ ──── 竞争分析 ────              │
│ 竞品品牌健康度对比               │
│                                 │
│ ──── 风险 ────                  │
│ 负面关联 / 品牌歧义 / 侵权       │
│                                 │
│ ──── 建议 ────                  │
│ 优先修复：首页标题 + 产品页      │
│                                 │
│ ▼ 证据（可展开）                │
│ ▼ 知识来源（可展开）            │
└─────────────────────────────────┘
```

#### 关键设计原则

1. **Report 是默认视图，不是终点视图**
   - 用户进入品牌分析后，永远先看到 Report
   - 不需要先经过 Brand → Knowledge → Evidence → Claim 才能到达 Report

2. **深度是展开的，不是导航过去的**
   - Evidence/Citation/Claim 作为可展开的细节层存在
   - 导航路径扁平化：Report → 展开细节，而不是 Report → 另一个页面

3. **洞察在数据的上方**
   - "你的品牌健康度 82" 在 Entity 列表的上方
   - "今天最重要的三件事" 在所有表格的上方
   - 数字是支撑洞察的，洞察才是主体

---

### 并行建设：底层基础设施

Report Workspace 不阻塞 Citation/Evidence/Claim 的建设。
两者并行：

| 前端 | 后端 |
|------|------|
| Report Workspace（Insight 层渲染） | Citation 模块（来源管理） |
| Mission Control（"今天最重要三件事"） | Evidence 模块（聚合分析） |
| 可展开细节组件 | Claim 模块（推理引擎） |
| 健康度评分展示 | Trust Engine v0.1（可信度） |

架构原则：Report 层是纯展示层，底层数据体系完全独立。
Report 先做前端骨架 + Mock 数据，后端 Citation/Evidence/Claim 填充真实数据后替换。

---

## 新验收标准

- [ ] Report Workspace 作为品牌分析默认入口
- [ ] Mission Control 展示"健康度 + 最重要的 1-3 件事"（非数据库计数）
- [ ] Report 内容包含：品牌概况 / 搜索表现 / 竞争分析 / 风险 / 建议
- [ ] 证据和知识来源作为可展开细节存在（不是独立页面）
- [ ] 底层 Citation / Evidence / Claim 模块代码与 Report 不耦合
- [ ] 无 Token 截断错误
- [ ] 编译通过
- [ ] PM2 后端重启正常

---

## Sprint 2 最终评分目标

| 项目 | 目标 |
|------|------|
| Product Direction | ⭐⭐⭐⭐⭐ |
| Consumer UX | ⭐⭐⭐⭐⭐ |
| Workflow | ⭐⭐⭐⭐⭐ |
| Engineering | ⭐⭐⭐⭐⭐ |
| Information Architecture | ⭐⭐⭐⭐⭐ |

目标：10 / 10。
差距就在 Insight Layer。
