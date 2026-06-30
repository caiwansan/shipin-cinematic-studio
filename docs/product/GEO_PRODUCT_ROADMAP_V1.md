# Brand Knowledge OS 产品路线图 v1.1

**依据**：《昆仑镜 Brand Knowledge OS 产品白皮书 v1.1》第十章（K/D/N 三阶段路线）
**状态**：冻结（K4 RC2 主线已定）
**定义**：Brand Knowledge OS 全平台的产品阶段规划与验收标准

---

## 三阶段命名

| 阶段 | 代号 | 说明 | 状态 |
|------|------|------|------|
| 知识生产 | K1-K5 | 从评估到发布的完整知识生产闭环 | ✅ 完成 |
| 知识分发 | D1-D6 | 从资产构建到外部交付的分发链路 | 🚀 进行中 |
| 知识网络 | N1-N5 | 从分发到知识图谱的网络化 | ⬜ 未来 |

---

## D 阶段：知识分发（Knowledge Distribution）

### D1 — Knowledge Asset（知识资产）

| 项 | 内容 |
|---|---|
| 用户目标 | 将已验证/已发布的内容转化为 AI 可消费的知识资产 |
| 后端 | ✅ AssetBuilderService |
| API | ✅ 完整链路 |
| UI | ❌ |
| 验收标准 | 每个 Asset 含三层输出（human/search/AI），状态可追踪 |

**当前状态**：✅ 完成（KDP K1 Freeze）

---

### D2 — Knowledge Package（知识包装）

| 项 | 内容 |
|---|---|
| 用户目标 | 将知识资产打包为标准化的可分发单元 |
| 后端 | ✅ PackagingOrchestrator + 5 Packagers |
| API | ✅ 完整链路 |
| UI | ❌ |
| 验收标准 | 6 种 Package Type 全部可用，Manifest + Preview + 校验完整 |

**当前状态**：✅ 完成（KDP K2 Freeze）

---

### D3 — Delivery Runtime（交付运行时）

| 项 | 内容 |
|---|---|
| 用户目标 | 可靠地将知识包交付到目标渠道 |
| 后端 | ✅ DeliveryRuntime |
| API | ✅ Queue → Dispatch → Deliver → Verify → Rollback |
| UI | ❌ |
| 验收标准 | Runtime 处理 Queue/Dispatch/Retry/Rollback/Verify，K3 只支持 Local |

**当前状态**：✅ 完成（KDP K3 Freeze）

---

### D4 — Static Delivery（静态网站分发）

| 项 | 内容 |
|---|---|
| 用户目标 | 将品牌知识生成为可直接部署的静态网站 |
| 后端 | ✅ StaticDelivery |
| 输出结构 | dist/（index, about, faq, sitemap, rss, ai-feed, schema, manifest, sha256） |
| UI | ❌ |
| 验收标准 | 完整静态网站，Checksum 校验通过，可部署到任意静态托管平台 |

**当前状态**：✅ 完成（KDP K4 RC1 Freeze）

---

### D5 — External Adapter（外部平台适配器）

| 项 | 内容 |
|---|---|
| 用户目标 | 品牌知识可分发到外部平台（Git Repository / S3 / CMS / Webhook） |
| 后端 | ❌ 未开始 |
| API | ❌ |
| UI | ❌ |
| 第一批 Adapter（按优先级） | Git Repository → S3/OSS → CMS (WordPress) → Generic HTTP |
| 验收标准 | 注册 Adapter 后 Runtime 无需修改，每个 Adapter 实现完整生命周期 |

**当前状态**：🚀 **下一阶段（K4 RC2）**

---

### D6 — Preview / Publish / Rollback（部署预览）

| 项 | 内容 |
|---|---|
| 用户目标 | 在发布前预览、一键发布、可回滚 |
| 后端 | ⚠️ 部分就绪（DeliveryRuntime 含 Rollback） |
| API | ❌ |
| UI | ❌ |
| 验收标准 | Package → Build → Preview URL → Publish → Rollback 完整链路 |

**当前状态**：⬜ 后续阶段（K4 RC2.5）

---

## N 阶段：知识网络（Knowledge Network）

| 代号 | 条目 | 说明 | 状态 |
|------|------|------|------|
| N1 | Knowledge Graph | 品牌知识图谱 | ⬜ |
| N2 | Cross Citation | 跨资产引用 | ⬜ |
| N3 | Entity Relationship | 实体关系 | ⬜ |
| N4 | Topic Cluster | 主题聚类 | ⬜ |
| N5 | AI Discovery Graph | AI 发现图谱 | ⬜ |

---

## 附录：当前 Tab 与平台能力映射

| 白皮书能力 | 对应 Tab | 状态 |
|---|---|---|
| 知识创建 | 左侧 Projects Panel | ✅ |
| 知识优化 | Insights | ⚠️ |
| 知识验证 | Evidence | ✅ |
| 知识包装 | 无 UI | ❌ |
| 知识分发 | 无 UI | ❌ |
| 知识监测 | Overview + InsightsPanel | ⚠️ |
| 知识学习 | Insights | ⚠️ |

---

## 附录 B：Six-Plane Architecture（冻结 2026-06-30，未变更）

```
                     Vertical Planes
  Assessment → Recommendation → Optimization → Verification → Publishing → KDP

                     Horizontal Layers
               Monitoring                          Automation
```
