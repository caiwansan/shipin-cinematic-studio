# Sprint Brief：P1 — Brand Health Report

---

## 1. 对应白皮书章节

**第四章第三阶段（Report）** — 品牌质量报告
**第八章（工程开发原则）** — 产品优先、业务优先
**第九章（Sprint 验收原则）** — 完整业务闭环

---

## 2. 对应路线图阶段

Phase 1: MVP — 第 3 项：品牌质量报告（Report）

---

## 3. 对应页面蓝图

- **Overview Tab** — 当前已显示评分卡片，需增强为完整的报告视图
- **右侧 InsightsPanel** — 不变，保持快捷建议入口
- 本次不新增 Tab，报告展示整合到 Overview Tab 内

---

## 4. 用户价值

> 用户打开 GEO 工作台后，选中品牌 → Overview Tab → 看到的不再是三个生硬的评分数字，而是一份可读的《品牌质量报告》，明确回答：我的品牌哪里好、哪里不好、为什么、下一步怎么办。

---

## 5. 影响的页面

| 页面 | 变更 |
|------|------|
| `brand-geo-v2/GeoOverview.vue` | 从三列 Metric + 两个板块 → 重构为完整的品牌报告视图 |
| `brand-geo-v2/GeoWorkspaceV1.vue` | 无模板变更 |

---

## 6. 影响的 API

本次**不新增 API**。全部使用现有端点：

| 端点 | 用途 |
|------|------|
| `GET /api/geo/recommendation/score?projectId=` | GEO 评分 + 五维评分 |
| `GET /api/geo/monitor/dashboard/:projectId` | 发布健康度 + 收录率 + 活跃建议数 |
| `GET /api/geo/reports/generate?projectId=&type=brand` | 完整品牌报告（可选增强） |
| `GET /api/geo/learning/signals?projectId=` | 活跃优化建议列表 |
| `GET /api/geo/verification/timeline/:projectId` | 最近验证记录 |

---

## 7. 验收标准

引用《GEO_ACCEPTANCE_STANDARD_V1.md》第三章（Report）全部 7 项：

| 条目 | 标准 |
|------|------|
| 报告构成 | 评分、问题、原因、建议四部分，缺一不可 |
| 评分含义 | 总评分附带文字说明（"良好/需要改进/优秀"），而非仅有数字 |
| 问题列表 | 明确列出问题，每条附带严重度标记 |
| 原因解释 | 每个问题附带业务语言原因说明 |
| 建议输出 | 每个问题附带对应优化建议 |
| 报告保存 | 评分可追溯到生成时间 |
| 空态 | 未检测时显示"请先执行 AI 收录检测" |

另附加：

| 条目 | 标准 |
|------|------|
| 建议语言 | Insights 中所有建议的 reason 字段使用商业语言 |
| 串联操作 | 报告底部显示"查看优化建议"按钮，点击切换到 Insights Tab |

---

## 8. 风险

| 风险 | 概率 | 影响 | 应对 |
|------|------|------|------|
| 报告 API 返回数据不足（如部分维度缺失） | 中 | 报告显示不完整 | 前端 fallback：缺失维度显示"待检测" |
| Overview 改动幅度大，影响其他 Tab | 低 | 布局错乱 | 确保只修改 GeoOverview.vue，不碰 WorkspaceV1.vue |
| 商业语言优化需要了解 API 字段结构 | 中 | 建议描述不够好 | 先改 UI 展示层，服务端语言优化作为拆分项 |

---

## 9. 回滚方案

| 场景 | 操作 |
|------|------|
| 编译失败 | `git stash`，回退到当前版本 |
| 构建通过但页面崩溃 | `pm2 restart 43` 回滚到上一版本（仅修改了 GeoOverview.vue） |
| 报告视图设计不合适 | 保留原有三列 Metric 布局，新增报告展示作为切换模式 |

---

## 待批准

此 Brief 等待熊大确认后，进入编码阶段。
