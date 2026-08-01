# MEDIA-PRODUCT-CONSTITUTION-01 — 新媒体产品永久治理规则

**Date:** 2026-08-02 01:55
**Gate:** 掌柜拍板（Sprint-MEDIA-01 Preflight 设计层通过后固化）· 永久规则，非 Sprint 级
**状态:** 🔒 已冻结

---

## 规则一：官方 API 唯一通道
> 所有新媒体平台接入必须经过**官方 API**。禁止浏览器自动化模拟登录、禁止 Cookie 注入、禁止任何绕过官方接口的通道。

- 公众号：appid/secret → access_token → 官方 /cgi-bin/* 与 /datacube/* 接口
- 未来平台（视频号/抖音/小红书等）同样只允许官方开放 API / 官方授权协议
- Playwright 浏览器自动化方案已废弃，永不复活（新旧媒体产品线皆适用）

## 规则二：禁止伪造发布结果
> 禁止人工伪造发布结果、禁止假数据同步、禁止 mock 发布状态。

- Reality Gate E5（零 mock）为新媒体产品线永久冻结规则
- SocialPost.status=published 必须以平台真实回执（publish_id/平台可见）为前提
- 任何「看起来发布了」但平台不可见的状态一律视为违规

## 规则三：Adapter 无业务逻辑
> Platform Adapter 只负责平台通信，不包含业务判断。

```
MediaService（Domain Layer：策略/合规/调度/价值判断）
        ↓
WechatMpAdapter（Platform Adapter：token/素材/草稿/发布/数据，纯通信）
```

- ❌ 错误：adapter 内判断「今天发几篇」「客户价值」「内容策略」
- ✅ 正确：adapter 只做 HTTP 通信 + 错误码映射 + 重试退避
- 业务规则全部在 Service/Domain 层，adapter 可替换（换平台只换 adapter）

## 规则四：凭证统一 ProviderCredential
> 新媒体凭证不建新表。统一走 ProviderCredential（企业资产，加密）。

- ❌ 禁止：WechatCredential / WechatToken / MediaSecret 等新凭证体系
- ✅ 统一：模型 Key / 微信 Key / 未来平台 Token → ProviderCredential（ownerType=organization，encryptedKey 加密）
- 账号归属：SocialAccount.credentialId → ProviderCredential
- 多公众号扩展（Phase 2+）：provider=`wechat_mp:<appid>` 或 SocialAccount 多凭证外键；Phase 1 单账号 provider=`wechat_mp`，不提前复杂化

## 规则五：账号是用户资产
> 新媒体账号属于企业/用户资产，不是平台资产。

- 封号风险 = 产品信用归零 → 一切操作以官方限频/合规为前提
- 发布频控、敏感内容、接口调用频率全部遵守平台规则，adapter 层实现退避
- 平台不托管、不保存、不展示企业凭证明文（G4 掩码标准延续）

## 适用范围
- 新媒体产品线（media.*）所有平台接入
- 与 KMKI AI Runtime Principle（BYOK）、AGENT-OUTCOME-01（统一结果层）、IDENTITY-REALITY-01（Organization SSOT）平级，作为新媒体产品线最高约束

**锚点**：实施计划 `docs/.reality/SPRINT-SOCIAL-MEDIA-IMPLEMENTATION-PLAN.md`；Preflight `docs/.reality/SPRINT-MEDIA-01-PREFLIGHT-CHECK.md`
