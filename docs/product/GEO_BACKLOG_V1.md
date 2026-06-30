# Brand Knowledge OS Backlog v1.1

**依据**：《昆仑镜 Brand Knowledge OS 产品白皮书 v1.1》第八章（工程开发原则）+ 第九章（Sprint 验收原则）
**状态**：冻结（K4 RC2 主线已定）
**定义**：Brand Knowledge OS 全平台待开发任务的唯一来源

---

## Backlog 使用规则

1. 所有 Sprint 必须来源于此 Backlog。
2. 一个条目进入 Sprint 的条件：
   - 对应白皮书章节已确认
   - 用户价值已描述
   - 验收标准已定义
3. 不符合条件的条目不得进入 Sprint。
4. Sprint 完成后必须移入"已完成"区域。
5. 按 K/D/N 三阶段分类（K=知识生产，D=知识分发，N=知识网络）。

---

## 当前 Sprint：K4 RC2 — External Delivery Adapter

| # | 条目 | 所属阶段 | 用户价值 | 验收标准 | 优先级 |
|---|------|---------|---------|---------|--------|
| D-05 | Git Repository Adapter | D5 | 品牌知识包可自动推送到 Git 仓库 | Adapter 实现 prepare/deliver/verify/rollback，已验证 | P0 |
| D-06 | S3 / OSS Adapter | D5 | 品牌知识包可上传到对象存储 | Adapter 实现完整生命周期 | P0 |
| D-07 | CMS Adapter（WordPress） | D5 | 品牌知识可发布到 CMS | Adapter 通过 REST API 发布内容 | P0 |
| D-08 | Generic HTTP/Webhook Adapter | D5 | 任何支持 Webhook 的平台可接收知识包 | Adapter 支持 POST/PUT，可配置 URL | P1 |
| D-09 | Adapter Registry 扩展 | D5 | Runtime 可发现并调度新 Adapter | 注册后无需修改 Runtime 代码 | P0 |

---

## 后续 Sprint：K4 RC2.5 — Preview / Publish / Rollback

| # | 条目 | 所属阶段 | 用户价值 | 验收标准 | 优先级 |
|---|------|---------|---------|---------|--------|
| D-10 | 部署预览链路 | D5 | 用户在发布前能看到预览 | 从 Package → Build → Preview URL，可访问 | P0 |
| D-11 | 一键发布 | D5 | 用户点击即可发布 | Preview 通过后，Publish 部署到目标 | P0 |
| D-12 | 发布回滚 | D5 | 用户可一键回滚到之前版本 | Rollback 恢复之前状态，可验证 | P0 |
| D-13 | 发布状态展示 | D5 | 用户能看到发布进度和结果 | 发布中/完成/失败/回滚状态，可见 | P1 |

---

## 知识创建（Knowledge Creation）

| # | 条目 | 用户价值 | 依赖 | 验收标准 | 优先级 |
|---|------|---------|------|---------|--------|
| K-01 | 品牌删除功能 | 用户可以删除不再维护的品牌 | 后端 DELETE API | 删除后品牌从列表消失，关联数据可归档 | P2 |
| K-02 | 品牌快照触发 UI | 用户可以手动创建品牌评分快照 | `POST /api/geo/projects/:id/snapshot` 就绪 | 用户点击按钮即可创建当前评分快照 | P2 |
| A-01 | 知识资产 UI | 用户能看到和管理品牌知识资产 | KDP K1 Service | 资产列表展示、创建、编辑 | P2 |

---

## 知识包装（Knowledge Packaging）

| # | 条目 | 用户价值 | 依赖 | 验收标准 | 优先级 |
|---|------|---------|------|---------|--------|
| PK-01 | Package 管理 UI | 用户能看到所有已创建的 Package | KDP K2 Service | Package 列表展示、状态、类型 | P2 |
| PK-02 | Package 详情 | 用户能看到 Manifest 和预览 | KDP K2 Service | Manifest 展示 + 预览渲染 | P2 |
| PK-03 | 一键包装 | 用户点击即可创建所有 Package | KDP K2 Service | 选择项目 → 生成所有 Package | P2 |

---

## 商业语言优化

| # | 条目 | 用户价值 | 依赖 | 验收标准 | 优先级 |
|---|------|---------|------|---------|--------|
| O-01 | 优化建议商业语言优化 | 用户看到的是"建议补充产品信息"而非技术描述 | current signals API | 所有建议使用商业语言描述 | P1 |
| O-02 | 优化建议排序 | 用户优先看到最重要的建议 | 无 | 建议按权重/优先级降序排列 | P2 |
| O-03 | 建议历史展示 | 用户能看到系统过去给出的建议历史 | `GET /api/geo/learning/history` 就绪 | 用户在 Insights Tab 中查看过去建议 | P2 |

---

## 质量报告增强

| # | 条目 | 用户价值 | 依赖 | 验收标准 | 优先级 |
|---|------|---------|------|---------|--------|
| R-01 | 评分对比视图 | 用户能对比不同时间段的评分变化 | `GET /api/geo/verification/compare` 就绪 | 选择两个时间点，系统显示 before/after 对比 | P1 |
| R-02 | 报告导出 | 用户将报告导出为可分享格式 | 依赖 R-01 | 点击导出按钮获得 PDF/文本格式文件 | P2 |

---

## 监测增强

| # | 条目 | 用户价值 | 依赖 | 验收标准 | 优先级 |
|---|------|---------|------|---------|--------|
| M-01 | 告警详情展示 | 用户点击告警计数后看到具体告警内容 | `GET /api/geo/monitor/dashboard/:projectId` 就绪 | 点击活跃告警后展示告警列表，含类型/严重度/时间 | P1 |
| M-02 | 收录状态可视化 | 用户能看到品牌在 AI 中的收录状态 | `POST /api/geo/monitor/check/indexed` 就绪 | Overview Tab 中展示收录状态 | P1 |
| M-03 | 漂移告警 | 品牌一致性下降时主动提醒 | `POST /api/geo/monitor/drift` 就绪 | Overview 或右侧面板显示漂移告警 | P2 |
| M-04 | 学习仪表盘 | 用户看到系统学习的整体效果 | `GET /api/geo/learning/dashboard` 就绪 | 独立仪表盘，展示成功率/平均收益 | P2 |

---

## 产品体验完善

| # | 条目 | 用户价值 | 依赖 | 验收标准 | 优先级 |
|---|------|---------|------|---------|--------|
| U-01 | 空态引导 | 首次使用不会看到空白页面 | 无 | 项目列表为空时显示引导文案："创建你的第一个品牌" | P1 |
| U-02 | 错误状态处理 | API 调用失败时看到友好提示 | 无 | 每个 Tab 在 API 失败时显示友好的错误状态 | P1 |
| U-03 | 品牌编辑入口 | 可以修改品牌信息 | 无 | 点击品牌可直接编辑名称/网址 | P2 |
| U-04 | 加载状态优化 | 知道系统正在加载 | 无 | 数据加载时显示骨架屏或加载指示 | P1 |

---

## 已完成的 Backlog 条目

| 条目 | 完成于 | 验收 |
|------|--------|------|
| K1 — Knowledge Asset Service | KDP K1 | ✅ |
| K2 — Knowledge Package Service | KDP K2 | ✅ |
| K3 — Delivery Runtime | KDP K3 | ✅ |
| K4 RC1 — Static Delivery | KDP K4 RC1 | ✅ |
| GEO 评分展示 | v1.5 Shell | ✅ |
| AI 收录检测触发 | v1.5 Shell | ✅ |
| 优化建议列表 | Phase 2 闭环 | ✅ |
| 一键执行优化 | P2 Execution Loop | ✅ |
| Action 状态机 | P2 Execution Loop | ✅ |
| 重新验证 | Phase 2 Action Layer | ✅ |
| 时间线展示 | v1.5 Shell | ✅ |
| 验证历史 | v1.5 Shell | ✅ |
| 发布流程 | v1.5 Shell | ✅ |
