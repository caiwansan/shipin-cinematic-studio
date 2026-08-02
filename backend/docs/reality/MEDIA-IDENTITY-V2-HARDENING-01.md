# SPRINT-MEDIA-IDENTITY-V2-HARDENING-01 — 多平台真实登录判定加固 — COMPLETE ✅

**Date:** 2026-08-03 04:10
**Gate:** 掌柜战略指令（读完 SynapseAutomation 后：吸收「账号生命周期管理」思想，不改变昆仑镜 BrowserWorkspace 路线；不学习 cleanup_session 用完即焚）

## 战略定位
- SynapseAutomation = 账号矩阵自动化投放系统（cookie 注入派）
- 昆仑镜 = AI 员工数字办公空间（真浏览器派）
- **吸收**：双通道登录判定 / 账号状态细分 / 快速身份验证
- **保持**：BrowserWorkspace / Persistent Profile / AI 员工绑定
- **不学**：cookie 机器人、登录完关浏览器

## Task 完成

| Task | 交付 | 状态 |
|------|------|------|
| Task01 | IdentityProbe v2 三层信号（Credential+Identity+Workspace） | ✅ |
| Task02 | 状态机扩展 SECURITY_CHECK/NEEDS_REAUTH/BLOCKED + 原因映射 | ✅ |
| Task03 | FastIdentityValidator 轻量验证 + 恢复服务集成 + reality verifiedBy | ✅ |
| Task04 | Reality Gate 验收 36/36 PASS（G6 真机流程掌柜人工） | ✅ |

## Task01 — 探针 v2 三层信号

**判定纯函数 `judgeIdentityV2`（可单测）**：
```
credential    = 关键cookie(≥2) && !loginPage
authenticated = credential && (identity || page)
```
- Level 1 Credential Signal：关键登录 cookie 存在 + 非登录路径（URL + loginPageMarkers 双排除）
- Level 2 Identity Signal：userId/nickname（hydration/regex/url/network 四方法）
- Level 3 Workspace Signal：工作台 URL 片段 / markers ≥2

**三禁止（掌柜验收标准）**：
- ❌ 扫码成功 ≠ 登录成功
- ❌ cookie 存在 ≠ 登录成功（游客 cookie 防误判）
- ❌ workspace RUNNING ≠ AI 可用

**新增信号**：loginPage（登录页排除）、securityCheck（安全验证页，区别于普通登录页——抖音「为保障账号安全，请完成身份验证」场景）
- 安全验证页 + 身份仍在 → 认证保持（上层标 NEEDS_REAUTH）
- 安全验证页 + 无身份 → 不认证（上层标 SECURITY_CHECK）

**平台配置**：meta.identityRules 新增 securityCheckMarkers / securityCheckUrlPatterns（抖音/快手/小红书/视频号已配）

## Task02 — 账号状态机细分

新增：**SECURITY_CHECK**（登录流程中安全验证）/ **NEEDS_REAUTH**（登录态有效但平台要求重新验证）/ **BLOCKED**（冻结/处罚，需人工）
- EXPIRED 保留 = 正常过期（重新扫码即可）
- label：安全验证中 / 需要重新验证 / 账号已冻结
- 迁移表：CONNECTED → NEEDS_REAUTH/BLOCKED；SECURITY_CHECK/NEEDS_REAUTH 可回正常流程；BLOCKED 仅人工解除
- `demoteStatusFromSignals` 降级映射：验证类文案 → NEEDS_REAUTH；封禁类 → BLOCKED；其余 → EXPIRED
- 存量 EXPIRED 迁移：SQL 幂等执行 0 行（现存 EXPIRED 无验证类原因，保持正确）

## Task03 — FastIdentityValidator

**轻量验证三要素（不起浏览器）**：
1. credentialOk — DB 加密凭证里关键 cookie ≥2 存在（读凭证 JSON，不起浏览器）
2. snapshotOk — externalAccountId + lastVerifiedAt 在 TTL（12h）内

**判定**：fresh（凭证+快照可信 → 不启动浏览器）/ stale（凭证在快照旧 → 完整探针复核）/ invalid（凭证缺失 → 降级）

**恢复服务集成**：
- CONNECTED + fresh → 不启动浏览器，保持 CONNECTED + metadata.fastVerifiedAt（懒加载）
- stale/invalid → 原有完整探针路径；降级目标按 demoteStatusFromSignals 映射

**reality API**：identity 层新增 `verifiedBy: 'probe' | 'fast' | 'none'`（验证来源诚实标注；fast = 快照验证，probe = 真实浏览器探针）

## Task04 — Reality Gate 36/36 PASS

| Group | 覆盖 | 结果 |
|-------|------|------|
| G1 | 状态机常量/label/迁移/isChannelConnected/降级映射 12 项 | ✅ |
| G2 | judgeIdentityV2 8 组合（含游客 cookie 防误判/登录页排除/安全验证页） | ✅ |
| G3 | FastIdentityValidator fresh/stale/invalid 6 场景 + 真实抖音账号 fresh | ✅ |
| G4 | 恢复端到端：抖音 fastVerifiedAt CONNECTED / 快手按原因降级 EXPIRED | ✅ |
| G5 | reality 四层 + verifiedBy=fast + 真实账号名「南坡万」88130666815 | ✅ |
| G6 | 真机扫码流程（掌柜人工，交付后可验） | ⏸ |

**实测恢复日志**：
```
⚡ 08a0f643... 快照验证 fresh（不启动浏览器）→ 保持 CONNECTED
⚠️ 10e0ea29... 快照验证 invalid（凭证缺失）→ 探针复核 → EXPIRED
✅ 完成：扫描 5 / 保持连接 1 / 降级 1 / 跳过 3 / 失败 0
```

脚本：`scripts/reality-check-identity-v2.ts`（npx tsx 运行）｜ 提交：`454a3d53`

## 冻结清单（持续）
❌ 微信/淘宝真实接入 ❌ 渠道 API ❌ 商品/订单表 ❌ 假经营指标 ❌ 批量发布/矩阵投放（掌柜：不要提前进入，会污染产品定位）
⏸ G6 真机扫码全流程验收（抖音/快手/小红书/视频号 扫码→刷新→PM2重启→恢复→Owner View）
⏸ 安全项（明文 Key / demo-token / 假控件 / IDOR）单独进 Security Sprint
