# KM-AI-JOB-PRODUCTION-VERIFY-02

**日期**: 2026-07-23  
**执行人**: OpenClaw  
**目标**: 确认生产 UI Runtime — API 200 但用户看不到聊天框

---

## 🔴 根因确认

### 现象
用户访问 `https://aigc.fushtn.com/workspace/job`，看不到聊天框（AI 职业顾问对话框）。

### 根因
**Phase 1.5 欢迎页全屏遮罩** 完全隐藏了聊天 UI。

```vue
<template>
  <div class="job-workspace-layout">
    <!-- Phase 1.5: 首次进入欢迎页 -->
    <div v-if="showWelcome" class="job-welcome-overlay">
      <!-- 全屏遮罩：position: fixed; inset: 0; z-index: 100 -->
      <div class="job-welcome-card">
        <h2>AI职业顾问</h2>
        <p>5分钟了解你的能力，帮你找到更适合的发展方向</p>
        <button @click="startCareer分析">开始职业分析</button>
        <a @click.prevent="skipWelcome">直接进入</a>
      </div>
    </div>

    <!-- 主体：聊天框在这里 -->
    <div v-else class="job-workspace-main">
      <div class="job-chat-panel">
        <!-- AI 职业顾问聊天 UI -->
      </div>
    </div>
  </div>
</template>
```

### 控制逻辑
```javascript
const showWelcome = ref(true)  // ← 默认 true，显示欢迎页

// 关闭欢迎页的方式：
// 1. 点击"开始职业分析" → showWelcome = false → 显示聊天
// 2. 点击"直接进入" → showWelcome = false → 显示聊天
// 3. localStorage 有 job-welcome-seen = true → 自动跳过欢迎页
```

### 关键 CSS
```css
.job-welcome-overlay {
  position: fixed;
  inset: 0;
  z-index: 100;
  background: rgba(8, 12, 20, 0.95);
  backdrop-filter: blur(8px);
}
```

---

## 🔍 排查过程

### 检查 1: 源码链路 ✅
- `workspace/job/index.vue` → `<JobWorkspaceLayout />` ✅
- `JobWorkspaceLayout.vue` → 包含 `job-chat-panel` ✅
- `chatWithCareerAgent` 导入正确 ✅

### 检查 2: 生产 bundle = 构建 bundle ✅
- 构建 `DdQo61dq.js` 哈希: `87bb67047996f38ea29cfb67702f7f05`
- 生产 `DdQo61dq.js` 哈希: `87bb67047996f38ea29cfb67702f7f05`
- ✅ 哈希完全一致，生产运行的是最新代码

### 检查 3: 欢迎页代码在生产 bundle 中 ✅
- `grep "job-welcome-overlay" /www/.../DdQo61dq.js` → 2 处匹配
- ✅ 欢迎页代码已部署到生产

### 检查 4: API 正常 ✅
- `POST /api/job/chat` → HTTP 200，AI 正常回复
- `GET /api/job/welcome` → HTTP 200

---

## 🎯 用户视角描述

当新用户访问 `/workspace/job` 时，看到的是：

```
┌─────────────────────────────────────┐
│  ← 返回首页   💼 AI 求职招聘工作台   │  ← 顶部导航条
├─────────────────────────────────────┤
│                                     │
│              🧭 (欢迎图标)           │
│           AI职业顾问 (标题)          │
│   5分钟了解你的能力... (副标题)      │
│                                     │
│   ✓ 你的学历背景                    │
│   ✓ 你的技能优势                    │   ← 全屏欢迎页
│   ✓ 工作经验                        │     (遮罩聊天框)
│   ✓ 职业目标                        │
│                                     │
│   ⭐ 分析职业方向                    │
│   ⭐ 推荐匹配岗位                    │
│   ⭐ 提供成长建议                    │
│                                     │
│   [ 开始职业分析 ] (按钮)            │
│   已有职业画像？直接进入 (链接)      │
│                                     │
└─────────────────────────────────────┘
```

**用户看不到任何聊天框**。必须点击「开始职业分析」才能进入聊天。

---

## 📊 问题定性

| 维度 | 评估 |
|------|------|
| 代码 bug | ❌ 否 |
| 产品设计 | ✅ 是 |
| 部署问题 | ❌ 否 |
| 集成质量 | ❌ 否 |

**结论**: 这是 Phase 1.5 的产品设计决策 —— 用欢迎页引导新用户了解产品价值，然后才进入聊天。

---

## 🔧 修复方案（需 CTO 决策）

### 方案 A: 移除欢迎页（推荐 Phase 2-P3）
```vue
<!-- 删除 v-if/v-else 包裹，直接显示聊天 -->
<div class="job-workspace-main">
  <div class="job-chat-panel">...</div>
</div>
```
- **优点**: 用户直接看到聊天框，核心功能立即可用
- **缺点**: 失去新用户引导

### 方案 B: 改为非遮挡式引导
将欢迎页改为顶部 Banner 或右侧卡片，不遮挡聊天框：
```vue
<div class="job-workspace-main">
  <WelcomeBanner v-if="showWelcome" @dismiss="showWelcome = false" />
  <div class="job-chat-panel">...</div>  <!-- 始终可见 -->
</div>
```
- **优点**: 兼顾引导和核心功能
- **缺点**: 需要重新设计 UI

### 方案 C: 保留欢迎页，优化文案
- 将按钮文案改为「开始与 AI 职业顾问对话」
- 在欢迎页添加聊天框预览截图
- **优点**: 改动最小
- **缺点**: 用户仍需主动点击才能进入聊天

### 方案 D: 仅对已登录用户显示欢迎页
```javascript
const showWelcome = ref(isLoggedIn && !welcomeSeen)
```
- **优点**: 老用户直接看聊天，新用户有引导
- **缺点**: 仍有新用户看不到聊天

---

## 🎯 推荐

**Phase 2-P3 Beta 推荐方案 A**。

理由：
1. 昆仑镜 SaaS 的 Phase 1 已完成 MVP 验证
2. Phase 2-P3 进入 Beta，核心目标是让用户用起来
3. 欢迎页的"5分钟了解价值"适合冷启动阶段，但不适合已有明确需求的用户
4. 企业用户不应该被欢迎页阻挡

---

## 📋 附录

### 文件变更记录
| 文件 | 变更 |
|------|------|
| `studio-v2/layout/JobWorkspaceLayout.vue` | 欢迎页默认 true，聊天在 v-else |
| `studio-v2/api/job-api.ts` | 已修复为 Interface-based API |
| `deploy.sh` | 已修复静态资产同步 |

### 验证命令
```bash
# 确认生产 bundle 与构建一致
md5sum frontend/.output/public/_nuxt/*.js | sort > build_hashes.txt
md5sum /www/wwwroot/aigc.fushtn.com/_nuxt/*.js | sort > prod_hashes.txt
diff build_hashes.txt prod_hashes.txt  # 应该无差异

# 确认 API 正常
curl -s -X POST https://aigc.fushtn.com/api/job/chat \
  -H "Content-Type: application/json" \
  -d '{"message":"你好，我想找工作"}'
```
