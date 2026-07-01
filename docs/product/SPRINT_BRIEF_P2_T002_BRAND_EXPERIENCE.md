# Sprint Brief: P2-T002 — Brand Experience Polish

## 核心目标
打通唯一一条用户路径：**创建 Brand → 30 秒 Quick Discovery → Brand Overview + Dashboard 自动更新。**

## P0（必须完成）

### ① Quick Discovery API + 前端按钮

**后端 `POST /api/geo/projects/:id/quick-discovery`**
- 输入：projectId
- 从 DB 读 Project.name / website / industry
- 复用 SIE (ScenarioMatcher) + MockScanner → 生成 ADI / Coverage / Share / Position
- 结果：写入 Project.config.adi，创建 PersistedDiscoveryReport
- 返回：`{ adi: 72, dimensions: { coverage, share, position }, summary: "3 个问题待优化" }`

**前端 Brand Overview 按钮**
- 替换 "开始 GEO 评估" → "立即分析（30 秒）"
- 点击后 loading 动画
- 完成后自动刷新 Brand Overview 和 Dashboard

### ② Dashboard KPI 全部改为真实数据

删除 "Brand Profile 三维度" 面板 → 替换为：
```
品牌数量 12 | 已分析品牌 9 | 平均 ADI 72 | 待分析 3
```
无分析时显示：
```
等待首次分析
立即开始 →
```

### ③ Brand Overview 改状态驱动

不要显示虚假分数：

| 之前 | 之后 |
|------|------|
| Knowledge 13% | Knowledge 待扫描 |
| Optimization 0% | Optimization 等待分析 |
| 完成度 37% | 待分析 |

分析后有数据再显示实际分数。

## P1（很重要·本次完成）

### ④ Dashboard Brand Card 统计修复
- 无分析时显示 `— 等待分析`
- 分析后显示实体数和版本数

### ⑤ Workflow Assessment 步骤接真实数据
- 当前调用 health API 返回的大部分为空（dimensions: []）
- 改为从 Project 配置 + discoveryReport 读取
- 显示 Website / Robots / Schema / Knowledge / Entity 状态

### ⑥ 编辑品牌后自动刷新
- PUT 后端直接返回完整 Brand 对象
- Store 更新，所有页面自动刷新，不依赖 emit 重新 load

## 暂缓（后续 Sprint）
- Verification / Report 真实数据填充
- 接入真实 AI Provider（DeepSeek 等）
- 删除确认弹窗（继续用 window.confirm）
- Loading Skeleton / 动画
- 后续七步工作流 Mock 替换

## 用户可见变化（📸 Workspace Visible Changes）
本次 Sprint 完成后：
1. Dashboard 不再显示大量 0，改为 "等待首次分析"
2. Brand Overview 新增 "立即分析（30 秒）" 按钮
3. 点击后 30 秒返回 ADI 分数
4. Dashboard 平均 ADI 和已分析统计自动更新
5. Brand Overview 分析后显示真实 Knowledge 和 Optimization 分数
