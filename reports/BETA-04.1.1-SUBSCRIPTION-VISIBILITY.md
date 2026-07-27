# BETA-04.1.1 Enterprise Subscription Visibility Patch

## 目标
解决 Beta 企业付费后无法确认权益的信任断点。

## 范围
- ✅ 新增 `GET /api/enterprise/subscription/current`
- ✅ SettingsModule 套餐区域接入 API
- ❌ 套餐升级 / 降级 / 账单历史 / 发票 / 使用量 Dashboard — 明确禁止

---

## 变更清单

### 后端
**文件**: `backend/src/routes/enterprise-subscription.ts`

新增端点：
```
GET /api/enterprise/subscription/current
```

响应格式：
```json
{
  "success": true,
  "data": {
    "plan": {
      "name": "专业版",
      "displayName": "专业版",
      "status": "active"
    },
    "subscription": {
      "startDate": "2026-07-18T00:00:00.000Z",
      "endDate": "2026-08-18T00:00:00.000Z",
      "status": "active",
      "autoRenew": true
    }
  }
}
```

### 前端
**文件**: `frontend/components/enterprise/workspace/modules/SettingsModule.vue`

Before:
```ts
const plan = ref('—')
onMounted(() => { /* TODO: 接入 Org Settings API */ })
```

After:
```ts
const plan = ref<any>(null)
const subscription = ref<any>(null)
const loading = ref(true)

async function fetchCurrentSubscription() {
  const token = getToken()
  const res = await fetch('/api/enterprise/subscription/current', {
    headers: { Authorization: `Bearer ${token}` },
  })
  const data = await res.json()
  if (data.success && data.data) {
    plan.value = data.data.plan
    subscription.value = data.data.subscription
  }
}
```

Before 展示：
```
企业套餐: —
```

After 展示：
```
企业套餐: 专业版 [Active]
有效期: 2026/8/18
```

---

## 验证结果

| 测试项 | 结果 |
|--------|------|
| `GET /api/enterprise/subscription/current` (无 token) | ✅ 401 |
| `GET /api/enterprise/subscription/current` (admin) | ✅ 404 (admin 非企业用户) |
| `GET /api/enterprise/subscription/current` (企业用户) | ✅ 返回套餐 + 有效期 |
| `/enterprise/settings` 页面加载 | ✅ HTTP 200 |
| 展示：套餐名 + 状态 + 有效期 | ✅ |

---

## 验收通过 ✅

企业用户现在可以确认：
1. 自己购买了什么套餐
2. 套餐是否 Active
3. 到期时间

满足 First Value Blocker 修复目标。不扩大产品范围。
