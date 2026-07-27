# Production Payment Security Configuration

**Date**: 2026-07-17
**Status**: PENDING — 需运维配置
**Priority**: P1 (生产环境必须)

---

## 当前状态

支付回调 IP 白名单代码层已实现，但环境变量未配置：

```
WHITELIST_ALIPAY_IPS = (未配置)
WHITELIST_WXPAY_IPS  = (未配置)
```

**影响**: 当前支付回调接受任何 IP 的签名正确请求。虽然签名验证已存在，但 IP 白名单是额外防护层。

---

## 配置步骤

### 1. 支付宝 IP 白名单

支付宝官方 IP 段（通知来源）：
```
110.75.143.0/24
110.75.136.0/24
110.75.129.0/24
47.92.0.0/16
47.93.0.0/16
```

配置方式（PM2 ecosystem）：
```javascript
// ecosystem.config.js
module.exports = {
  apps: [{
    name: 'api-server-aigc',
    script: 'dist/index.js',
    env: {
      WHITELIST_ALIPAY_IPS: '110.75.143.0/24,110.75.136.0/24,110.75.129.0/24,47.92.0.0/16,47.93.0.0/16'
    }
  }]
}
```

### 2. 微信支付 IP 白名单

微信支付官方 IP 段：
```
101.226.0.0/16
101.227.0.0/16
140.207.0.0/16
140.206.0.0/16
183.3.235.0/24
203.205.219.0/24
```

配置方式：
```javascript
env: {
  WHITELIST_WXPAY_IPS: '101.226.0.0/16,101.227.0.0/16,140.207.0.0/16,140.206.0.0/16,183.3.235.0/24,203.205.219.0/24'
}
```

### 3. 验证方式

配置后，非白名单 IP 的回调请求将返回 403 并记录日志：
```json
{
  "event": "PAYMENT_CALLBACK_IP_REJECTED",
  "channel": "alipay",
  "clientIp": "x.x.x.x",
  "reason": "IP_NOT_IN_WHITELIST"
}
```

---

## 配置记录

| 项目 | 值 |
| --- | --- |
| 配置时间 | (待填写) |
| 操作人 | (待填写) |
| 当前白名单 | (待填写) |
| 验证结果 | (待填写) |

---

## 代码层已实现

- [x] IP 提取: `x-forwarded-for` header → clientIp
- [x] 白名单检查: `WHITELIST_IPS.includes(clientIp)`
- [x] 拒绝日志: 结构化 JSON 日志
- [x] 空白名单警告: 生产环境未配置时记录 warning

---

**CTO Approval**: ✅ 代码层已通过
**Ops Action Required**: 配置环境变量后重启 PM2
