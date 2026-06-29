# V4.2 Phase A3 Batch 2 — Customer Service Deprecate

> 日期：2026-07-19

## 执行摘要

| 任务 | 状态 | 说明 |
|------|------|------|
| Feature Flag 添加 | ✅ | `feature.CUSTOMER_SERVICE_ENABLED=false`（环境变量控制，默认关闭） |
| 前端菜单隐藏 | ✅ | KunlunNav / frontend layouts / admin-aigc sidebar / p0 pages |
| Admin 入口隐藏 | ✅ | 后台菜单 `客服管理` 已注释 |
| API Deprecated 标记 | ✅ | 两个路由文件添加了 `@deprecated` JSDoc 注释 |
| 文档更新 | ✅ | V42-PLATFORM-CLASSIFICATION.md 备注已更新 |

## 变更清单

| # | 文件 | 改动类型 | 具体内容 |
|---|------|---------|---------|
| 1 | `backend/src/config/feature-flags.ts` | 新增 Feature Flag | 添加 `CUSTOMER_SERVICE_ENABLED`（默认 `false`），控制生活助手业务开关 |
| 2 | `frontend/components/kunlun/business/KunlunNav.vue` | 隐藏导航入口 | 注释掉 `生活助手` 导航链接，添加 `@deprecated` 注释 |
| 3 | `frontend/layouts/admin-aigc.vue` | 隐藏侧边栏菜单 | 注释掉 `客服管理` 菜单项，添加 `@deprecated` 注释 |
| 4 | `frontend/layouts/default.vue` | 隐藏全局客服浮窗 | 注释掉 `<CustomerService />` 组件渲染和 import，添加 `@deprecated` 注释 |
| 5 | `frontend/layouts/user.vue` | 隐藏用户中心客服浮窗 | 注释掉 `<CustomerService />` 组件渲染和 import，添加 `@deprecated` 注释 |
| 6 | `frontend/pages/p0/seeds.vue` | 隐藏入口链接 | 注释掉"对话"导航链接和空状态"去对话"链接，显示"生活助手功能已下线" |
| 7 | `frontend/pages/p0/coverage.vue` | 隐藏入口链接 | 注释掉"对话"导航链接和空状态"去对话"链接，显示"生活助手功能已下线" |
| 8 | `frontend/pages/p0/fallbacks.vue` | 隐藏入口链接 | 注释掉"对话"导航链接和空状态"去对话"链接，显示"生活助手功能已下线" |
| 9 | `backend/src/routes/customer-service.ts` | 标记 deprecated | 文件头部添加 `@deprecated` JSDoc，说明废弃原因和恢复方式 |
| 10 | `backend/src/routes/admin-customer-service.ts` | 标记 deprecated | 文件头部添加 `@deprecated` JSDoc，说明废弃原因和恢复方式 |
| 11 | `docs/architecture/V42-PLATFORM-CLASSIFICATION.md` | 更新文档 | 生活助手备注更新为 Phase A3 Batch 2 已完成状态 |

## 保留未改动的文件

以下文件是业务页面/组件本身，按原则 **不修改页面组件**，仅隐藏入口：

- `frontend/pages/p0/life-assistant.vue` — 生活助手对话页面（用户无法进入，但页面代码完整）
- `frontend/pages/admin/aigc/customer-service.vue` — 后台客服管理页面（菜单已隐藏）
- `frontend/pages/director-os/aigc/customer-service.vue` — Director OS 客服管理页面（菜单已隐藏）
- `frontend/pages/director-os/aigc/life-assistant-config.vue` — 生活助手路由配置页面（菜单已隐藏）
- `frontend/pages/director-os/aigc/platform-llm.vue` — LLM Provider 管理（菜单已隐藏，但内部关联生活助手标题 — 保留不动）
- `frontend/components/customer/CustomerService.vue` — 客服浮动聊天组件（不删除，供恢复使用）
- 数据库 schema（3 表：`CustomerChatSession`, `CustomerChatMessage`, `CustomerChatMemory`）— 完整保留

## Exit Checklist

| 项目 | 状态 |
|------|------|
| 用户还能进入吗？ | ❌ （所有入口已隐藏） |
| 后台还能配置吗？ | ❌ （管理员菜单已注释） |
| API 默认开放吗？ | ✅ （功能逻辑未改，后端 API 仍在运行） |
| Feature Flag 关闭？ | ✅ （`CUSTOMER_SERVICE_ENABLED` 默认 false，需 `CUSTOMER_SERVICE_ENABLED=true` 才启用） |
| 数据保留？ | ✅ （3 张数据库表完整保留） |
| 可恢复？ | ✅ （取消 Feature Flag 隐藏 + 恢复前端入口注释即可） |

## 恢复操作步骤（如需要）

1. 设置环境变量 `CUSTOMER_SERVICE_ENABLED=true`
2. 恢复 `KunlunNav.vue` 中的 `<NuxtLink to="/p0/life-assistant">` 注释
3. 恢复 `admin-aigc.vue` 中的 `客服管理` 菜单项注释
4. 恢复 `default.vue` 和 `user.vue` 中的 `<CustomerService />` 组件渲染
5. 恢复 `seeds.vue` / `coverage.vue` / `fallbacks.vue` 中的导航链接
6. 重启服务

## 验证

- [ ] PM2 restart 验证
- [ ] 编译通过（TypeScript / Vue 编译）
- [ ] 运行时确认菜单已隐藏

---

*End of Report*
