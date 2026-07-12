# Distribution RC Gate

> Sprint 2B 完成后的关卡验证。通过后方可进入 Sprint 3（Evidence Engine）。

## Gate 定义

Distribution Engine 从"能力"正式变为"产品接口"，必须通过以下全部检查。

---

## 检查清单

### 1. Package Build API
- [ ] `POST /api/v1/packages/build` 返回 200
- [ ] 输入 `knowledgeObjectId` 有效时返回 Package + Manifest + Artifact
- [ ] 输入无效时返回 422
- [ ] `GET /api/v1/packages/:id` 返回包详情
- [ ] `GET /api/v1/packages/:id/manifest` 返回 Manifest
- [ ] `GET /api/v1/packages/:id/artifacts` 返回 Artifacts
- [ ] `GET /api/v1/packages/builds` 返回构建历史
- [ ] `GET /api/v1/packages` 返回包列表

### 2. Distribution API（Sprint 2B）
- [ ] `POST /api/v1/packages/:id/distribute` 对所有已注册 Publisher 执行分发
- [ ] 指定 `targets: ["website"]` 只分发到 website
- [ ] 每个 target 写入 PublishRecord（publish_records 表）
- [ ] 每个 target 生成 3 个文件
- [ ] publish.json 中包含统一元数据
- [ ] `GET /api/v1/packages/:id/publishes` 返回发布历史
- [ ] `POST /api/v1/packages/:id/republish` 重新分发并新增记录

### 3. Publisher Contract
- [ ] WebsitePublisher：index.html + schema.jsonld + publish.json
- [ ] SitemapPublisher：sitemap.xml + sitemap-entry.json + publish.json
- [ ] AIFeedPublisher：ai-feed.json + ai-feed-summary.json + publish.json
- [ ] 所有 Publisher 确定性发布（相同 Package → 相同 Hash）
- [ ] 所有 Publisher 幂等（重复发布不产生内容差异）
- [ ] PublishRecord 写入后支持回读验证

### 4. Golden Regression
- [ ] `scripts/golden-distribution-validation.ts` 20/20 PASS
- [ ] `scripts/golden-regression.ts`（Packaging）仍全部 PASS

### 5. Architecture
- [ ] Distribution Engine 骨架（Engine/Planner/Registry/Graph）未修改
- [ ] Platform 层代码零修改
- [ ] 旧 PublishingRecord 表未受影响
- [ ] Contract（contract.ts）未发生不兼容变更

---

## 当前验证结果（2026-07-04）

| 领域 | 项数 | 通过 | 状态 |
|------|------|------|------|
| Package Build API | 8 | 8 | ✅ |
| Distribution API | 7 | 7 | ✅ |
| Publisher Contract | 6 | 6 | ✅ |
| Golden Regression | 20 | 20 | ✅ |
| Architecture | 4 | 4 | ✅ |
| **总计** | **45** | **45** | **✅ 全部通过** |

---

## 未覆盖（已知限制，不影响 Gate）

- API 鉴权 — 当前无鉴权层，部署时接入
- Filesystem 写入 — Publisher 当前只返回 PublishFile[]，未写入磁盘。Sprint 3 预留
- AI Feed 格式适配 — 当前保持稳定结构，不做多平台适配
- Sitemap 持久化聚合 — 当前每次 publish 生成单条 entry，Sprint 3 考虑 index

---

## Gate 通过

> **Distribution RC Gate: ✅ PASSED**
> 前四段主链（Discovery → Knowledge → Packaging → Distribution）已全部拥有稳定的契约、API 和回归测试。
> Sprint 3（Evidence Engine）可安全开始。
