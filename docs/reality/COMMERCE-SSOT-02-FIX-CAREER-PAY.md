# COMMERCE-SSOT-02 修复：求职管家「立即开通 AI 职业助理」无法付款

**Date:** 2026-08-01
**Gate:** 掌柜反馈（为什么还不能付款？不允许新建支付通道，复用昆仑镜统一支付）

## 根因（实锤）

前端 `frontend/studio-v2/layout/JobWorkspaceLayout.vue` 的 `confirmPurchase()`：
- URL 已迁移到统一入口 `/api/payment/checkout`（Commerce Authority ✅）
- 但 body 只传 `{ method: 'alipay' }`，**漏传 `productCode`**
- 后端统一链要求 productCode 驱动（缺省返回 400「缺少 productCode」）→ 用户点「立即开通」永远建单失败

> 这正是 COMMERCE-SSOT-02 冻结规则的价值：统一入口用参数驱动商品，缺参直接暴露，无法静默走旁路。

## 修复

```diff
- body: JSON.stringify({ method: selectedMethod.value }),
+ // COMMERCE-SSOT-02: 必须携带 productCode，缺省后端返回 400（曾导致无法付款）
+ body: JSON.stringify({ productCode: 'career_agent', method: selectedMethod.value }),
```

- 弹窗注释同步更新（移除「career/checkout 订单链路」误导注释）
- **未创建任何新支付通道**：与 VIP 完全同一条链（/api/payment/checkout → PaymentOrder → 支付宝/微信 → provision）

## 部署教训（重要）

- 生产前端由 PM2 `nuxt-frontend` 进程服务（占 3000 端口），**不是 nuxt-server**（同名进程 EADDRINUSE 起不来）
- 部署顺序：`nuxt build` → `pm2 restart nuxt-frontend --update-env`（build 会覆盖 .output，必须重启对的那个进程）
- 本次首次修复后未生效即因此（重启错了进程），已纠正

## Reality Gate（生产域实测）

| 验收项 | 结果 |
|--------|------|
| 页面「立即开通 AI 职业助理」 | ✅ |
| 弹窗（支付宝/微信支付 + ¥9.9） | ✅ |
| 确认支付 → 建单 | ✅ PaymentOrder CZ20260801DY4RYZ planType=career_agent ¥9.9 pending alipay |
| 支付宝支付引导 | ✅ 新窗口 + 手动链接兜底「点击此处前往支付宝支付 →」 |
| rechargeOrder 新订单 | ✅ 0（统一链，无双轨） |
| 报错（缺 productCode） | ✅ 消失 |

截图：COMMERCE-SSOT-02-career-pay-{modal,created,guide}.png

## 补充修复：支付宝支付体验对齐 VIP（掌柜实操反馈「还不行」）

掌柜实操反馈：求职管家点「确认支付」后无法完成支付。逐环节对比两条链条：

| 环节 | 昆仑镜 VIP（membership） | 求职管家（修复前） | 差异 |
|------|------------------------|-------------------|------|
| 下单 | /api/member/upgrade-vip | /api/payment/checkout（统一链） | ✅ |
| 支付宝呈现 | **二维码扫码**（qrcode 库编码 payUrl） | window.open 跳转（**浏览器必拦**）+ 手动链接 | ❌ 不一致 |
| 微信呈现 | 二维码 NATIVE | 二维码 | ✅ |
| 轮询 | /api/payment/alipay/status | /api/career/agent/status | ✅ |

**根因**：window.open 弹支付宝被浏览器广告拦截策略拦截，页面只剩一个不显眼的手动链接 → 掌柜实操「点了没反应」。

**修复**：JobWorkspaceLayout.vue 支付宝分支渲染二维码（与 membership.vue generatePayment 同一 qrcode 实现），保留新窗口 + 手动链接兜底。产品级对齐：确认支付 → 弹窗内出支付宝二维码 + 「请使用支付宝扫一扫完成支付」→ 轮询 → 到账自动开通。

**验收**（生产域）：订单 CZ20260801465WVR → 二维码 data:image 渲染 ✅ 扫码文案 ✅ 手动链接兜底 ✅ 轮询 ✅
截图：COMMERCE-SSOT-02-career-alipay-qr.png
