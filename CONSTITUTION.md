# 昆仑镜系统宪法 — BYOK 铁律

**生效日期：2026-06-13｜不可撤销**

## 第一条：平台不持有任何大模型 API Key

昆仑镜（aigc.fushtn.com）是一个 SaaS 平台。平台**不持有、不提供、不兜底**任何大模型 API Key。

所有依赖大模型 API 的功能（包括但不限于短剧工作台、小说工作台、PPT 制作工作台、任何未来增加的产品功能），必须从用户自己在 `UserModelConfigV2` 表中配置的 Key 读取。

## 第二条：唯一例外

**智能客服「小麒」**是唯一的例外，可以保留平台配置的 API Key，用于答复用户的客服咨询。

## 第三条：Key 的读取链路

标准读取链路（所有功能统一）：
```
UserModelConfigV2（用户自配，加密存储）
  → decryptKey() 解密
  → narrative-gateway / model-adapter 注入 process.env
  → 引擎执行时读取 process.env
```

不允许多余的 fallback 逻辑。如果用户未配置 Key 或 Key 余额不足，必须返回明确的提示信息，不得静默降级使用任何平台 Key。

## 第四条：新增功能的合规检查

任何新产品功能在首次上线前，必须逐行审查代码，确认：
1. 没有从 `.env` / 环境变量 / 硬编码常量 读取 API Key
2. 没有兜底回退到平台 Key 的逻辑
3. 使用了 `UserModelConfigV2` → `decryptKey()` 的标准链路

违反此条款的功能不得上线。

---

*如有违反此宪法的代码，视为系统漏洞，必须立即修复。*
