# Sprint-CAREER-REALITY-01 镜心职业助理开通支付闭环 — COMPLETE ✅

**Date:** 2026-08-01 18:30
**Gate:** 掌柜 P0 指令（求职管家「立即开通」无响应 = 直接损失付费转化，优先于渠道 Phase 2）
**原则对齐：** ① 一个商品入口 ② 一个订阅体系 ③ 一个 AI Runtime 链路（KMKI）

## T01 审计结论：按钮「无响应」真相

**前端断点（JobWorkspaceLayout.vue 镜心卡片）：**
- 按钮有 handler（handlePurchase）✅，但**支付结果零 UI 反馈**：`purchaseError`/`purchaseOrderNo`/`purchaseQrCode`/`purchasePaymentUrl`/`purchasing` 全部无模板引用
- 支付宝唯一反馈 = `window.open(paymentUrl)` → 浏览器异步弹窗**大概率被拦截** → 页面零变化
- 微信 qrCode 返回但**无二维码展示 UI** → 无法支付
- 无支付方式选择、无支付状态轮询、无 loading/成功/失败提示
- **响应嵌套 bug**：checkout 返回 `{success, data:{orderNo}}`，前端读 `data.orderNo`（undefined）
- **DB 佐证**：同一用户 7-31 连点 3 次 + 8-1 又点 2 次 = 5 条 pending 订单，从未支付成功——「按钮没反应」实锤

**后端链路（健康，无需重建）：**
- `POST /api/payment/career/checkout` ✅ 已注册（payment.ts，PaymentSecret alipay/wechat 真实配置）
- 支付回调（alipay/wxpay notify + admin confirm）→ `handleCareerSubscriptionFromPayment` → 订阅 active + `CareerAgentService.createAndDeploy`（Profile+Instance+HermesBinding+MemoryNamespace）✅
- `GET /api/career/agent/status` ✅

## T02 打通支付订单（Commerce Authority 复用，零新增套餐系统）

**前端改造（镜像卡片 + 支付弹窗）：**
- 「立即开通」→ 弹窗：套餐 ¥9.9/月（金额来自后端订单，非写死）+ 5 项权益 + 支付方式选择（支付宝/微信）
- 确认支付 → checkout → 支付宝：新窗口 + 手动链接兜底（防拦截）；微信：qrcode 库渲染二维码
- 订单号 + 错误提示 + 轮询状态（3s）全部可见
- 兼容 `{success, data}` 嵌套响应

## T03 支付成功 → Career Agent Provision + 用户 BYOK（KMKI 红线修复）

**后端修复（3 处）：**
1. **status 端点 hasAgent 分支补返回 `hasActiveSubscription`**（支付轮询依赖，原缺失）
2. **resolveRuntimeConfig 明文 Key 兼容**（`Invalid encrypted key format`——明文 key 被当加密格式解密）
3. **Career Agent 无 BYOK 显式阻断**（4.5 层）：`businessType=career_agent` 未配置用户 Key → `NO_BYOK_CONFIG` + 引导文案，**禁止静默回退平台 env Key**（原 `[MODEL_RUNTIME_FALLBACK]` 红线违规）
4. **agent-brain.resolveProvider 区分 Career Agent**：metadata.source='career_agent' → 走 executeViaGateway 统一链（UserModelConfigV2 → 显式阻断）；企业员工维持 OrgModelConfig 权威（G2 身份隔离不破坏）
5. **career-workflow 路由加 BYOK Gate**：纯个人用户（无企业关联）未配 UserModelConfigV2 → `NO_BYOK_CONFIG`（workflow 执行器走 AgentExecutor 独立链，绕过 4.5）

**发现并修复的架构断裂**：workflow 执行器（AgentExecutor → credential-resolver）只认「企业 Credential + env 开发后门」，**无视用户 UserModelConfigV2** → 用户配了 Key 也走 fallback 模板（14ms「假 AI」）。修复后真实 BYOK 调用 13.2s。

## T04 浏览器 Reality Gate（生产域 aigc.fushtn.com 全流程实测）

| 步骤 | 结果 |
|------|------|
| 未开通用户进 /workspace/job | 镜心卡片「¥9.9/月 + 立即开通」✅ |
| 点击立即开通 | 弹窗渲染（套餐/5 权益/支付宝默认/微信）✅ |
| 确认支付 | 订单 CZ20260801GSU9KH + 支付宝链接 + 轮询状态 ✅ |
| 到账（admin confirm 模拟线下收款） | 轮询自动检测 → 弹窗关闭 → 「已订阅」徽章 + 首次引导 ✅ |
| 数据库落库 | agent_profile 1 / agent_instance 1 / hermes_binding 1 / subscription_active 1 / order paid ✅ |
| 未配模型执行任务 | 「请先配置 AI 模型」显式引导（不静默平台 Key）✅ |
| 配置 BYOK 后执行 | 真实 AI 回复（职业优势分析，deepseek-v4-flash）✅ |

截图：`CAREER-REALITY-01-{purchase-modal,agent-active-reply}.png`

## 数据真相

- 5 条历史 pending 订单（审计前）→ 本次验收新增 3 条全部走通 paid
- 纯个人用户 3 种模型状态验证：无 BYOK → NO_BYOK_CONFIG 显式；有 BYOK → 用户 Key 真实调用；企业用户 → 企业 BYOK（demo 企业 deepseek key 复用验证）
- 平台 env Key 兜底仅存于「企业员工无企业配置」（G2 显式阻断文案），Career 个人场景已彻底关闭

## 遗留（非本次阻塞）

- 11111111 测试用户 activate-and-execute 报 `MEMORY_ACCESS_DENIED`（memory namespace mismatch）——既有 bug，已记录待治理
- tokensUsed 统计为 0（gateway 未回传 totalTokens）——usage 统计增强待办
- admin confirm 端点信任任意 user JWT（verifyToken 非 admin 校验）——安全隐患待治理

## 冻结清单（持续）

❌ 新增套餐系统（复用 Commerce Authority：Product→Plan→Order→Payment→Entitlement）
❌ Career 个人场景静默走平台 Key（已改显式 NO_BYOK_CONFIG）
❌ 平台托管用户/企业 Key
