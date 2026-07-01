# Sprint Brief KH1 — Canonical Package Runtime

**来源**: KH Blueprint v1 章节 C + J + K
**路线图**: KH Architecture Freeze → **KH1** → KH2 → KH3 → KH4 → KH5

## 用户价值
KnowledgePackage 的生产、校验、版本管理。这是 Knowledge Hub 的核心资产，后续所有 Publish / Review / Monitoring 都围绕它运作。

## 蓝图影响

### 新增文件
| 文件 | 说明 |
|------|------|
| `backend/src/platform/knowledge-hub/core/package-builder.ts` | Package Builder — 组装完整 KnowledgePackage |
| `backend/src/platform/knowledge-hub/core/package-validator.ts` | Schema + 完整性校验 |
| `backend/src/platform/knowledge-hub/core/package-repository.ts` | CRUD 仓库 |
| `backend/src/platform/knowledge-hub/core/package-versioning.ts` | semver + 版本历史 |
| `backend/src/platform/knowledge-hub/api/package.route.ts` | REST API |
| `frontend/workspaces/knowledge-hub/pages/` | KH 工作台页面 |

### 修改文件
| 文件 | 变更 |
|------|------|
| `backend/prisma/schema.prisma` | 新增 `platform_knowledge_packages` 表？或复用现有 `knowledge_packages` |

## 影响页面
| 页面 | 说明 |
|------|------|
| GEO Publishing tab | 触发 GeoKnowledgeProvider → 生成 Package |
| KH 工作台 | 查看/校验/版本管理 |

## 影响 API
| 端点 | 说明 |
|------|------|
| `POST /api/knowledge-hub/packages` | 创建 Package |
| `GET /api/knowledge-hub/packages` | 列表 |
| `GET /api/knowledge-hub/packages/:id` | 详情 |
| `PUT /api/knowledge-hub/packages/:id` | 更新 |
| `DELETE /api/knowledge-hub/packages/:id` | 删除 |
| `GET /api/knowledge-hub/packages/:id/versions` | 版本列表 |
| `POST /api/knowledge-hub/packages/:id/versions/:version/rollback` | 回滚 |

## 验收标准（引用 GEO_ACCEPTANCE_STANDARD_V1.md）
- [ ] **AS-FUNC-001**: Package Builder 能接收 Provider 输入，输出标准 KnowledgePackage
- [ ] **AS-FUNC-002**: Package Validator 校验必填字段完整
- [ ] **AS-FUNC-003**: Package Repository 支持 CRUD + 分页
- [ ] **AS-FUNC-004**: Package Versioning 支持 semver + 版本历史
- [ ] **AS-FUNC-005**: API 响应统一 `{ success, data, error }` 信封
- [ ] **AS-UI-001**: KH 工作台能看到 Package 列表
- [ ] **AS-PERF-001**: Package 创建 ≤ 500ms

## 风险
| 风险 | 概率 | 影响 | 缓解 |
|------|------|------|------|
| GEO KDP 的 KnowledgePackage 与新 Canonical Package 不一致 | 中 | 高 | Phase 1 兼容层 + 映射转换 |
| 没有真实 Workspace Provider 可测试 | 高 | 中 | 先写单元测试 + Mock Provider |

## 回滚
```bash
git checkout kh-architecture-freeze-v1
```
