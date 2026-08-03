# SPRINT-ECO-02 实施计划 — Plugin Manifest Runtime（插件身份系统）

> 状态：技术总监已批准（2026-08-03 22:01）
> 原则：增量开发 | 零破坏 | 零重构 | 零第三方执行

---

## 0. 目标

建立「插件身份证系统」——不是插件商城。

- ✅ Plugin Identity（插件身份）
- ✅ Plugin Metadata（元数据）
- ✅ Plugin Registry（注册中心）
- ✅ Plugin Validation（校验/防线）

## 禁止事项（红线）

- ❌ 不执行插件
- ❌ 不运行第三方代码
- ❌ 不接入支付
- ❌ 不做商城 UI
- ❌ 不做开发者后台
- ❌ 不修改 Agent 表 / Hermes

## 1. 数据层（纯新增 3 表，现有表零修改）

```
ecology_plugins               — 插件身份注册（id 全局唯一 / application 关联 / author）
ecology_plugin_versions       — 插件版本（plugin_id + version 唯一 / manifest 快照）
ecology_plugin_installations  — 组织安装（organization_id + plugin_id 唯一 / 只登记不执行）
```

迁移：手写 SQL + `prisma db execute` 双通道（团队模式，不碰 prisma migrate dev）

## 2. Manifest Schema（plugin.json 开发者协议）

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

校验规则（纯函数，只验证不执行）：
- `id`：必填，`^[a-z][a-z0-9-]{2,63}$`（小写字母开头，字母数字连字符）
- `name`：必填，1-100 字符
- `type`：枚举 `agent | tool | workflow`（未来可扩，未知 type 拒绝）
- `version`：必填，semver 严格校验 `^\d+\.\d+\.\d+$`
- `author`：必填，1-64 字符
- `application`：可选，必须存在于 ecology_applications（如填则校验 FK）
- `permissions`：必填数组，每个权限必须在「已知权限白名单」内（browser/content/analytics/...）
- `runtime`：可选对象，`kaor` 必须为布尔（禁止任意运行时声明，未知字段拒绝或忽略）
- `billing`：可选对象，仅登记展示（不接入支付）

非法样本防线（Reality Gate 必测）：
1. 缺 id
2. 权限不在白名单（权限不存在）
3. 版本格式错误（非 semver）
4. 重复 id（唯一约束冲突）
5. 非法 runtime 声明（kaor 非布尔 / 未知运行时字段）

## 3. Registry Service（ecology-plugin-registry.service.ts）

- `registerPlugin(manifest)`：校验 → 幂等 upsert（id 唯一）→ 写入 plugins + versions
- `listPlugins(orgId)`：插件目录（含组织安装状态）
- `getPlugin(id)`：插件详情（含版本历史）
- `installPlugin(orgId, pluginId)`：登记安装（幂等，不执行）
- `validateManifest(raw)`：纯函数校验（返回 errors 数组，零副作用）

## 4. API（/api/ecosystem/plugins，只读 + 登记）

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | /api/ecosystem/plugins | 插件目录 |
| GET | /api/ecosystem/plugins/:id | 插件详情 |
| POST | /api/ecosystem/plugins/register | 注册插件（身份登记，非执行） |
| POST | /api/ecosystem/plugins/:id/install | 登记安装（幂等） |
| GET | /api/ecosystem/plugins/validate?manifest= | 校验 API（调试/未来开发者用） |

## 5. Reality Gate（10 样本 + 回归 + 回滚）

- 合法 5：agent plugin / tool plugin / workflow plugin / version upgrade / permission declaration
- 非法 5：缺 id / 权限不存在 / 版本格式错误 / 重复 id / 非法 runtime 声明
- 现有 Agent 回归：/api/enterprise/agent-profiles 200
- 回滚验证：DROP 3 表无依赖

## 6. 交付物

```
backend/prisma/schema.prisma                          (+3 EcologyPlugin 模型)
backend/prisma/migrations/sprint-eco-02-plugin-manifest/migration.sql
backend/src/ecosystem/plugin-manifest.schema.ts       (Manifest 校验纯函数)
backend/src/ecosystem/plugin-registry.service.ts      (注册/查询/安装)
backend/src/routes/ecology-plugin.routes.ts           (/api/ecosystem/plugins 路由)
backend/src/index.ts                                  (+路由注册)
backend/scripts/reality-check-eco-02.mjs              (Reality Gate 10+ 样本)
docs/.reality/ECO-02-REALITY-GATE.md                  (完成报告)
```
