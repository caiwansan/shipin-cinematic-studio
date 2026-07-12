# Sprint 2：Knowledge Distribution Engine

> **目标：** KnowledgeObject → Package → 三种标准渠道发布 → PublishRecord 落库
> **前置条件：** ✅ Sprint 1A（Packaging Engine）已完成
> **链路状态：** Distribution Engine 骨架完整 ✅，四个 Target 全是 stub ❌

---

## 核心命题

> **Distribution Engine 的职责不是"发到很多地方"，而是"对一个 Package 执行所有已注册的 DistributionTarget，留下可验证的发布记录"。**

Sprint 2 不追求渠道数量，只追求：
1. **Website Target** — 生成 index.html（JSON-LD + 可读内容）
2. **Sitemap Target** — 更新 sitemap.xml
3. **AI Feed Target** — 生成 AI 可消费的结构化知识数据
4. **PublishRecord** — 写入 DB，留下发布时间、内容、渠道

---

## 现状审计

### Distribution Engine
| 组件 | 状态 | 详情 |
|------|------|------|
| DistributionEngine | ✅ 完整 | `start()` → planner → graph → execute → result |
| DistributionPlanner | ✅ 完整 | `createPlan()` |
| DistributionRegistry | ✅ 完整 | register / get / getAll |
| ExecutionGraph | ✅ 完整 | task 管理 + result 聚合 |
| Distribution API | ✅ 完整 | `/api/knowledge/distribution/*` |

### DistributionTarget
| Target | 状态 | 问题 |
|--------|------|------|
| Website | ❌ stub | `return { success: true }` — 需要读 KnowledgePackage 生成 HTML |
| Sitemap | ❌ stub | `return { success: true }` — 需要更新 sitemap |
| CMS | ❌ stub | 暂不开发 |
| Webhook | ❌ stub | 暂不开发 |
| Export | ❌ stub | 暂不开发 |
| **AI Feed** | ❌ 不存在 | 需要新建 |

### Asset → Package 的 gap
当前 DistributionTarget 的输入是 `packageId`（字符串），但它需要读取 KnowledgePackage + PackageManifest + PackageArtifact 才能生成真实输出。目前没有读取逻辑。

---

## 架构设计

```
POST /api/v1/packages/build
    ↓
KnowledgePackage + Manifest + Artifact + PackageBuild（四张表）
    ↓
POST /api/v1/packages/{id}/distribute
    ↓
DistributionEngine.start({ packageId, targets: ['website', 'sitemap', 'ai-feed'] })
    ↓
DistributionPlanner.createPlan()
    ↓
ExecutionGraph.build()
    ↓
foreach target:
    WebsiteTarget.execute(packageId)    ← 读 DB 生成 index.html
    SitemapTarget.execute(packageId)    ← 读 DB 生成 sitemap entry
    AIFeedTarget.execute(packageId)     ← 读 DB 生成 AI feed JSON
    ↓
PublishRecord （写入 DB）
```

### DistributionTarget 需要的新能力

每个 Target 需要访问：
- `PackageArtifact`（package.json → claims/evidence/citations/assets）
- `PackageManifest`（title/summary/language）
- `KnowledgePackage`（version/status）

建议：Target 的 execute 方法从 `packageId` 读取三张表数据。

---

## 新建/修改文件清单

| 文件 | 变更 | 工作量 |
|------|------|--------|
| `distribution/adapters/website.target.ts` | 重写：读 KnowledgePackage + Artifacts → 生成 index.html | 1.5天 |
| `distribution/adapters/sitemap.target.ts` | 重写：生成 sitemap.xml <url> entry | 1天 |
| `distribution/adapters/ai-feed.target.ts` | 新建：生成 AI Feed JSON（claims/evidence/citations） | 2天 |
| `distribution/api.ts` | 扩展：增加 auto-distribute 模式 + 状态查询 | 1天 |
| `api/packaging-routes.ts` | 扩展：POST build 返回 packageId 后可直接调用 distribute | 0.5天 |
| 新增 DB 表：PublishRecord | 记录每次发布的 packageId/target/status/timestamp | 0.5天 |
| `scripts/golden-regression-distribution.ts` | 新增：Distribution E2E 回归测试 | 1天 |
| `audit/packaging-engine-audit.md` | 更新 Sprint 2 状态 | 0.25天 |

**总工作量预估：7.75 人天**

## 交付顺序

### ✅ Sprint 2A：Distribution Core（真实输出）（已完成）

| ID | Title | 状态 |
|----|-------|------|
| P2A-001 | Website Publisher（参考实现） | ✅ 3文件：index.html + schema.jsonld + publish.json |
| P2A-002 | Sitemap Publisher | ✅ 3文件：sitemap.xml + sitemap-entry.json + publish.json |
| P2A-003 | AI Feed Publisher | ✅ 3文件：ai-feed.json + ai-feed-summary.json + publish.json |
| P2A-004 | PublishRecord 模型 + 表 | ✅ model + publish_records 表 |
| P2A-005 | E2E Distribution Validation | ✅ 20/20 PASS |

### ✅ Sprint 2B：API 对接（已完成）

| ID | Title | 状态 |
|----|-------|------|
| P2B-001 | POST /api/v1/packages/:id/distribute | ✅ 全量 + 选择性分发 |
| P2B-002 | GET /api/v1/packages/:id/publishes | ✅ 发布历史查询 |
| P2B-003 | POST /api/v1/packages/:id/republish | ✅ 幂等重新发布 |

### Post-Sprint

- [x] Distribution RC Gate（45项全部通过）

---

## DoD

- [ ] WebsiteTarget 从 DB 读取 KnowledgePackage → 生成 index.html（JSON-LD + content）
- [ ] SitemapTarget 生成 sitemap.xml <url> entry
- [ ] AIFeedTarget 生成结构化 JSON（claims + evidence + citations + entities）
- [ ] PublishRecord 写入 DB（packageId + target + status + timestamp + output 路径）
- [ ] POST /api/v1/packages/{id}/distribute 触发全渠道分发
- [ ] 回归测试覆盖三种渠道
- [ ] Distribution Engine 骨架无需修改

## 不做

- ❌ CMS Target（Sprint 2 不包含）
- ❌ Webhook Target（Sprint 2 不包含）
- ❌ Export Target（Sprint 2 不包含）
- ❌ 可视化 Distribution 状态（Sprint 1B 做）
- ❌ 修改 DistributionEngine / Planner / Registry / ExecutionGraph（骨架已稳定）
- ❌ Platform 层代码修改（仅修改 Adapter）

---

## 风险

| # | 风险 | 影响 | 可能性 | 缓解 |
|---|------|------|--------|------|
| R1 | AI Feed 格式未定义，后期返工 | 高 | 中 | Sprint 2A 先定义 AI Feed Schema 再编码 |
| R2 | Website 生成的 HTML 可能没有实际 assets（图片） | 中 | 高 | Sprint 1B UI 展示时补充 |
| R3 | Sitemap 需要持久化（当前只写内存） | 中 | 中 | 先写文件路径，Sprint 2 不要求 nginx |
