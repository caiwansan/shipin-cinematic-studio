# ECO-02-REALITY-GATE.md — Plugin Manifest Runtime

> **SPRINT-ECO-02 完成报告** | 日期：2026-08-03 22:30 | 状态：✅ PASS（31/31）
> 技术总监验收指令（2026-08-03 22:01）：建立插件身份证系统（不是插件商城）

---

## 1. 数据变化（纯新增 3 表，现有表零修改）

| 表 | 用途 | 关键约束 |
|----|------|---------|
| `ecology_plugins` | 插件身份注册 | plugin_id **全局唯一**（冒名防线）/ type(author/tool/workflow) / application 可选 FK → ecology_applications |
| `ecology_plugin_versions` | 插件版本 | plugin_id+version **唯一**（版本升级防线）/ manifest 快照（只存不执行） |
| `ecology_plugin_installations` | 组织安装登记 | organization_id+plugin_id **唯一**（安装幂等）/ 只登记不执行 |

- 迁移：手写 SQL + `prisma db execute` 双通道（团队模式），全部 IF NOT EXISTS 幂等
- **G6 验证：ecology_* 由 4 张 → 7 张，其余 461+ 表零结构变更**
- ❌ 未修改 Agent 表 / Hermes（红线遵守）

## 2. Manifest Schema（plugin.json 开发者协议，zod 严格模式）

```json
{
  "id": "ai-media-manager",
  "name": "AI内容运营经理",
  "type": "agent",
  "version": "1.0.0",
  "author": "developer_id",
  "application": "kunlun-media",
  "permissions": ["browser", "content", "analytics"],
  "runtime": { "kaor": true },
  "billing": { "subscription": true, "price": 599 }
}
```

校验规则（纯函数 `validatePluginManifest`，零副作用）：
- `id`：`^[a-z][a-z0-9-]{2,63}$`（小写开头，3-64 字符）
- `type`：白名单 `agent | tool | workflow`（未知类型拒绝）
- `version`：严格 semver `^\d+\.\d+\.\d+$`
- `permissions`：白名单 `browser | content | analytics | storage | network | automation`（未知权限拒绝）
- `runtime`：**严格对象仅允许 `kaor: boolean`**（未知运行时字段拒绝 → 防任意代码声明）
- `billing`：仅登记展示，不接入支付
- **`.strict()` 顶层：未知字段整体拒绝**

## 3. Registry API（/api/ecosystem/plugins，只读 + 登记）

| 方法 | 路径 | 说明 | 验证 |
|------|------|------|:----:|
| GET | /api/ecosystem/plugins | 插件目录（含组织安装状态） | ✅ |
| GET | /api/ecosystem/plugins/:pluginId | 插件详情（含版本历史） | ✅ |
| POST | /api/ecosystem/plugins/register | 注册身份（幂等 + 冒名防线） | ✅ |
| POST | /api/ecosystem/plugins/validate | 纯校验 API（不落库） | ✅ |
| POST | /api/ecosystem/plugins/:pluginId/install | 登记安装（幂等，不执行） | ✅ |
| POST | /api/ecosystem/plugins/:pluginId/uninstall | 登记卸载（标记状态） | ✅ |
| GET | /api/ecosystem/plugins-health | 插件层健康检查 | ✅ |

**注册语义（幂等 + 防线）**：
- 同 id + 同 author → 身份复用，新版本 upsert（版本升级合法）
- 同 id + **不同 author → 409 PLUGIN_ID_CONFLICT 拒绝**（冒名防线，G2 实测抓出真漏洞后修复）

## 4. 合法/非法样本测试（Reality Gate G1-G3）

### 合法 5 ✅
| 样本 | 结果 |
|------|:----:|
| agent plugin（ai-media-manager） | ✅ 注册成功 |
| tool plugin（video-compressor） | ✅ 注册成功 |
| workflow plugin（weekly-report-flow） | ✅ 注册成功 |
| version upgrade（同 id 1.0.0→1.1.0，同 author） | ✅ reused=true 升级成功 |
| permission declaration（content-scheduler） | ✅ 注册成功 |

### 非法 5 ✅（全部拒绝）
| 样本 | 防线 | 结果 |
|------|------|:----:|
| 缺 id | schema 必填 | ✅ 400 INVALID_MANIFEST |
| 权限不存在（super-admin-root） | 白名单 | ✅ 400 INVALID_MANIFEST |
| 版本格式错误（1.0） | semver 严格 | ✅ 400 INVALID_MANIFEST |
| 重复 id（evil 冒名 ai-media-manager） | author 一致性 | ✅ 409 PLUGIN_ID_CONFLICT |
| 非法 runtime 声明（execute_arbitrary_code） | runtime 严格对象 | ✅ 400 INVALID_MANIFEST |

> 💡 **G2 实战价值**：「重复 id」样本第一轮测试暴露了真实漏洞——幂等更新未校验 author，evil 可覆盖他人插件身份。已修复（author 不一致 → 409），复测通过。这正是技术总监要求恶意样本测试的意义。

## 5. 现有 Agent 回归（G5）

- ✅ GET /api/enterprise/agent-profiles → 200，code=0，Agent 数据零影响

## 6. 回滚验证（G7）

- ✅ DROP 3 张 ecology_plugin* 表 → 无依赖报错（纯新增）
- ✅ 重新执行迁移 SQL → 表重建成功（幂等实证）
- ✅ 重建后唯一约束仍在（plugin_id 全局唯一防线保留）
- 恢复现场：重新注册 4 合法插件，目录完整

## 7. 纪律遵守确认

- ✅ 不执行插件（register/install 仅写 DB 记录，零代码执行路径）
- ✅ 不运行第三方代码（无任何 eval/import 动态加载）
- ✅ 不接入支付（billing 仅 JSON 展示）
- ✅ 不做商城 UI（无前端页面新增）
- ✅ 不做开发者后台
- ✅ 不修改 Agent 表 / Hermes

## 8. 交付物清单

```
backend/prisma/schema.prisma                          (+3 EcologyPlugin 模型)
backend/prisma/migrations/sprint-eco-02-plugin-manifest/migration.sql
backend/src/ecosystem/plugin-manifest.schema.ts       (zod 严格校验纯函数 + 白名单)
backend/src/ecosystem/plugin-registry.service.ts      (注册/查询/安装/卸载 + 冒名防线)
backend/src/routes/ecology-plugin.routes.ts           (/api/ecosystem/plugins 7 端点)
backend/src/index.ts                                  (+ECO-02 路由注册)
backend/scripts/reality-check-eco-02.mjs              (Reality Gate 31 项)
docs/.reality/SPRINT-ECO-02-IMPLEMENTATION-PLAN.md
docs/.reality/ECO-02-REALITY-GATE.md                  (本报告)
```

## 9. 生态里程碑状态

```
Application（9 应用身份 ✅ ECO-01）
    ↓
Plugin（插件身份系统 ✅ ECO-02）
    ↓
Agent（现有 23 agents，零改动）
    ↓
KAOR Runtime（ECO-03 待批准）
    ↓
Model
```

**提交：** SPRINT-ECO-02 Plugin Manifest Runtime — 31/31 Reality Gate PASS
