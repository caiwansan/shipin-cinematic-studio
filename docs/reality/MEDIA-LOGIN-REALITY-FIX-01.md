# SPRINT-MEDIA-LOGIN-REALITY-FIX-01 — Login Adapter 层 Reality 修复 — COMPLETE ✅

**Date:** 2026-08-03 01:10 CST
**Gate:** 掌柜战略指令（抖音已证明底座成立；问题不在平台适配，而在 Login Surface 层——小红书/快手卡在「打开登录页 → 无法可靠获取二维码」。暂停微博/头条/公众号扩展；完成前禁止宣称平台接入完成）

## 核心判断落地
- 架构不动：BrowserWorkspace / AuthStateMachine / IdentityProbe **零修改** ✅
- 问题定位：**Login Adapter 层**（Login Surface：打开 → 正确登录入口 → 二维码/短信入口）
- 新增统一 **BrowserLoginDetector v2**，任何平台禁止自行写二维码提取

## Task 01 禁止假设二维码存在 ✅
Reality 调试发现（实测）：
- **小红书**：登录页只有一个 64x64 data:image 占位图（**损坏 PNG：corrupt header**）+ 无「扫码登录」tab + iframe 无二维码 → **假二维码风险实锤**
- **快手**：cp.kuaishou.com 未登录只显示「立即登录」按钮，无任何二维码元素
- 结论：img 存在 ≠ 二维码；**所有候选图必须过 jsQR 解码验证**才返回

## Task 02 统一 BrowserLoginDetector v2 ✅
新文件 `login-detector.ts`，检测顺序 A→B→C→D：
```
A. DOM img    → data:image 正方 / URL 含 qr|login / qrcode 关键词（含尺寸过滤）
B. Canvas     → 普通 canvas + shadow DOM 深度遍历，toDataURL（tainted 跳过）
C. iframe     → page.frames() 逐个 evaluate（跨域各自上下文）
D. 截图 fallback → 视口截图 → sharp 中央 60% 裁剪 → jsQR 解码验证
```
**关键纪律**：每通道命中后必须 jsQR 解码成功才返回；失败记录 note 并继续下一通道。
返回统一结构：`{ loginMethod, qrCode(base64 放大白边), source: img|canvas|iframe|screenshot|none, channels, detail }`
- channels 记录四通道 found/count/note（Debug Panel 数据源）
- 全部失败时按页面文本如实报告 `loginMethod: 'sms'|'unknown'`（短信登录面如实标注）

## Task 03 小红书专项 ✅
- 登录入口确认：creator.xiaohongshu.com/login ✅（loginEntry.mustMatch + fallback 防游客首页重定向）
- **Reality 结论**：当前环境默认**短信登录面**（发送验证码/短信登录/收不到验证码），无扫码 tab（clickSteps:['扫码登录'] 自动跳过）
- 诚实策略：短信面保持可登录（loginMethods 含 sms），不伪造二维码；detector 报 loginMethod=sms
- 64x64 占位图为损坏图 → jsQR 拒绝 → 前端显示短信表单而非假二维码 ✅

## Task 04 快手专项 ✅ **（全链路打通）**
- **登录入口分离验证**：cp.kuaishou.com（创作者端）≠ www.kuaishou.com（普通用户端）
- 实测完整链路：`cp.kuaishou.com → 点「立即登录」→ passport.kuaishou.com/pc/account/login → 点「扫码登录」tab → 真二维码`
- **jsQR 独立验证 ✅：`http://qr.kuaishou.com/l/FzcSkTE3BKigyHTQ`**（385KB 二维码）
- clickSteps 配置化：`['立即登录', '扫码登录']`，connect 时自动执行，找不到的标签跳过

## Task 05 Login Debug Panel ✅
- 后端：getLoginStatus debug 增强 → `{ detector{img,canvas,iframe,screenshot}, qrSource, frames, pageTextSample, loginSurface{url} }`
- 前端：accounts.vue 连接弹窗新增「🔍 登录诊断」折叠区：Status / URL / Frames / QR Detector 四通道 chips（img ✅❌ canvas ✅❌ iframe ✅❌ shot ✅❌）/ 各通道 note / Page Text
- 截图：docs/reality/LOGIN-FIX-01-debug-panel.png

## Task 06 Reality Gate 重定义（禁止写「接入完成」）
| 平台 | Runtime | Login | Identity | Metrics |
|------|---------|-------|----------|---------|
| 抖音 | ✅ | ✅ | ✅ | 待 |
| 小红书 | ✅ | ⚠️ 短信面就绪，扫码未现 | 未测 | 未测 |
| 视频号 | ✅ | ⚠️ 待 jsQR 复核 | 未测 | 未测 |
| 快手 | ✅ | ✅ 扫码 tab 自动切换 + jsQR 验证 | 未测 | 未测 |

## 新增标准：LoginEntry（登录入口导航配置）
```ts
loginEntry?: {
  mustMatch: RegExp    // navigate 后 URL 必须命中（防游客首页/普通用户端）
  fallbackUrl?: string // 未命中回退导航
  waitMs?: number
  clickSteps?: string[] // 进入真实登录面的按钮序列（如快手：立即登录 → 扫码登录）
}
```
**未来新增平台 = 填 ChannelPlatformDefinition + loginEntry + IdentityRule + MetricRule，不写登录流程。**

## 验收（生产域 aigc.fushtn.com 实测）
**后端 12/12 PASS**（真实浏览器，模拟前端完整链路 ensure-account → connect → status）：
- 小红书 6 项：登录入口确认 / state 合法 / 短信面就绪 / **不返回假二维码** / debug 齐全
- 快手 6 项：登录入口确认 / state 合法 / **真二维码 385KB** / img 通道 jsQR 验证通过 / debug 齐全
**前端 7/7 PASS**：连接弹窗打开 / 二维码图显示（data:image） / 诊断按钮 / Status·URL·Frames / 四通道 chips / Page Text / img ✅

调试工具：scripts/detector-reality-test.ts（平台登录面一键诊断）

## 冻结清单（持续）
❌ 微博/头条/公众号扩展（掌柜指令暂停）❌ 自动发布/评论/私信/涨粉
⏸ 下一步：掌柜真人扫码验证快手/小红书短信登录；视频号 jsQR 复核；Identity 实测
