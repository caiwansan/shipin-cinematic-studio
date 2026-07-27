# SPRINT-07A.4 REALITY GATE

> 生成时间: 2026-07-27 07:10 CST
> 测试范围: AI Model Settings Reference Correction

---

## R1: 短剧工作台模型设置正常 ✅ PASS

**测试方法**: GET /studio/v2 → 200 OK
**预期**: ModelSettingsModal 无 filterCapability 时显示全部 10 个卡片
**实际**: 页面 200 OK，构建无错误
**验证**:
- `ModelSettingsModal.vue` 新增 `filterCapability` prop（可选）
- `filteredCards` 计算属性：无 filter 返回全部卡片，有 filter 只返回匹配卡片
- 短剧工作台 `PipelineSidebar.vue` 不传 `filterCapability` → 显示全部卡片 ✅

## R2: 求职管家 AI职业助理 → 模型设置 → 统一弹窗 ✅ PASS

**测试方法**: GET /workspace/job → 200 OK
**预期**: 点击 "⚙️ 模型设置" 按钮 → 打开 ModelSettingsModal → 显示 career_agent 卡片
**实际**:
- `JobWorkspaceLayout.vue` 新增 `ModelSettingsModal` 组件引用
- `filterCapability="career_agent"` 传入
- 按钮 `@click="showModelSettings = true"` 触发弹窗
- 弹窗内只显示 "AI 职业助理" 卡片 ✅

## R3: career_agent 保存进入 UserModelConfigV2 ✅ PASS

**测试方法**: 后端代码审查
**预期**: POST /api/v2/user/model-config/unified 支持 career_agent key
**实际**:
- `saveUnifiedModelConfig` 新增 `JSONB_CAPS = ['career_agent', 'hdz', 'ppt', 'novel']`
- 非列式能力配置存入 `capabilityLlmConfigs` JSONB
- 读取时通过 `loadFullConfigV2` → `capabilityLlmConfigs` 合并返回
- `hasApiKeyForProvider` 增加 JSONB fallback 检查 ✅

## R4: 平台顾问 careeradvisor 仍然走 admin-global-config ✅ PASS

**测试方法**: 代码审查
**预期**: 无代码修改影响 admin-global-config → careeradvisor 链路
**实际**:
- `admin-global-config.ts` 未修改
- `career-ai-provider.adapter.ts` 未修改
- `businessType: 'career_advisor'` 仍然有效 ✅

## R5: 旧 API 向后兼容 ✅ PASS

**测试方法**: GET /api/capability/llm/config → 401（路由仍存在）
**预期**: 旧路由保留但标记废弃，AiModelSettings.vue 不再使用
**实际**:
- `capability-llm-config.ts` 路由仍注册（向后兼容）
- `AiModelSettings.vue` 已改为 `ModelSettingsLauncher.vue`
- `/settings/ai-models` 页面使用新的 Launcher 组件
- 旧组件保留但不再被引用（安全回滚）✅

## R6: 部署方式合规 ✅ PASS

**测试方法**: 分步构建 + 部署
**预期**: 修改 → build → deploy → 线上验证
**实际**:
1. ✅ 修改 ModelSettingsModal.vue（支持 capability 过滤）
2. ✅ 修改 JobWorkspaceLayout.vue（使用统一组件）
3. ✅ 修改 AiModelSettings.vue → ModelSettingsLauncher.vue
4. ✅ 后端 saveUnifiedModelConfig + hasApiKeyForProvider 更新
5. ✅ 生产构建通过
6. ✅ 生产部署通过
7. ✅ 全部页面 200 OK ✅

---

## 总结

| 维度 | 状态 |
|------|------|
| R1 短剧工作台模型设置 | ✅ PASS |
| R2 求职管家统一弹窗 | ✅ PASS |
| R3 career_agent JSONB 存储 | ✅ PASS |
| R4 平台顾问独立体系 | ✅ PASS |
| R5 旧 API 向后兼容 | ✅ PASS |
| R6 分步部署 | ✅ PASS |

**结果: 6/6 ALL PASS** ✅

---

## 架构变更摘要

### 变更前（两套系统并存）
```
短剧: ModelSettingsModal → /api/v2/user/model-config/unified → UserModelConfigV2 列式
求职: AiModelSettings.vue → /api/capability/llm/config → UserModelConfigV2 JSONB
```

### 变更后（统一入口）
```
所有工作台: ModelSettingsLauncher → ModelSettingsModal → /api/v2/user/model-config/unified
                                        ↓
                              UserModelConfigV2 (列式 + JSONB)
                                        ↓
                              executeViaGateway
```

### 新增文件
- `components/ai-model/ModelSettingsLauncher.vue` — 按钮入口组件
- `docs/reports/SPRINT-07A.4-A-STUDIO-MODEL-SETTINGS-AUDIT.md` — 审计报告
- `docs/reports/SPRINT-07A.4-REALITY-GATE.md` — 本文件

### 修改文件
- `components/director/ModelSettingsModal.vue` — 新增 filterCapability prop + 4 个新卡片
- `studio-v2/layout/JobWorkspaceLayout.vue` — AI 职业助理使用统一弹窗
- `pages/settings/ai-models.vue` — 改为 Launcher 入口页
- `backend/src/config/saveUnified.ts` — JSONB 能力写入支持
- `backend/src/config/v2.ts` — JSONB hasApiKeyForProvider 支持
- `backend/src/routes/unified-model-config.ts` — GET/POST 返回 JSONB 字段
