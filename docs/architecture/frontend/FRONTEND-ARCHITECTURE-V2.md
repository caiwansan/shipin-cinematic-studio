# GEO 前端架构规范 V2

> 从"功能开发阶段"升级为"产品架构阶段"
> 生效日期：2026-07-17
> 适用范围：昆仑镜平台所有工作台（短剧/小说/PPT/GEO）

## 核心原则

### 行数约束

| 层级 | 文件 | 最大行数 | 超过怎么办 |
|------|------|----------|-----------|
| **Page** | 页面 | **≤150 行** | 拆出组件 |
| **Feature** | 业务组件 | **≤200 行** | 拆出子组件 |
| **Step** | Wizard 步骤 | **≤120 行** | 拆出子组件 |
| **Atomic** | 原子组件 | **≤80 行** | 保持精简 |

违反即重构，没有例外。

### 层级职责

```
Page（≤150 行）
  └─ 只做 4 件事：
     1. Route 控制
     2. Layout 布局
     3. Data Loading（API 调用）
     4. Component Composition（编排子组件）

Feature（≤200 行）
  └─ 一个完整业务模块
     例：BrandWizard / KnowledgeStats / GraphToolbar / ProviderPanel

Step（≤120 行）
  └─ Wizard 中的一步
     例：StepBasicInfo / StepProvider / StepFinish

Atomic（≤80 行）
  └─ 基础 UI 单元
     例：StatCard / EmptyState / Skeleton / StatusBadge
```

### Wizard 模式

所有工作流型交互统一采用 Wizard 模式：

```
Wizard/
  Step1.vue
  Step2.vue
  Step3.vue
  ...
  StepFinish.vue
WizardView.vue    ← 仅 Step 编排（≤180 行）
```

### 文件组织

```
workspace/[module]/
  pages/           ← Page 文件（≤150 行）
  components/      ← Feature + Atomic 组件
    [module]/      ← 业务模块子目录
      Step*.vue    ← Wizard 步骤
      *.vue        ← 模块内组件
  composables/     ← 组合式逻辑
  stores/          ← Pinia 状态
  services/        ← API 调用
  config/          ← 配置
  types/           ← 类型
```

## 样式体系

统一暗色主题，使用 `.geo-*` 前缀的 class 体系：

| Class | 用途 | 示例值 |
|-------|------|--------|
| `.geo-page` | 页面容器 | padding:24px; color:#e0e0e0 |
| `.geo-page-header` | 页面顶栏 | margin-bottom:20px |
| `.geo-page-title` | 页面标题 | font-size:20px; font-weight:700 |
| `.geo-filters-bar` | 筛选栏 | |
| `.geo-input` | 输入框 | background:rgba(255,255,255,0.04); border-radius:6px |
| `.geo-btn` | 按钮 | border-radius:6px; font-weight:600 |
| `.geo-btn-primary` | 主按钮 | linear-gradient(135deg, #818cf8, #6366f1) |
| `.geo-btn-secondary` | 次按钮 | background:rgba(255,255,255,0.06) |
| `.geo-btn-ghost` | 幽灵按钮 | background:transparent |
| `.geo-stat-card` | 统计卡片 | background:#1a1a2e; border-left:3px solid |
| `.geo-status-badge` | 状态标签 | padding:2px 8px; border-radius:10px |
| `.geo-empty-state` | 空状态 | padding:60px 20px; text-align:center; color:#666 |
| `.geo-loading-spinner` | 加载动画 | 旋转圆圈 |
| `.geo-form-group` | 表单组 | margin-bottom:14px |
| `.geo-form-label` | 表单标签 | font-size:12px; color:#888 |
| `.geo-form-row` | 表单行（两列） | display:grid; grid-template-columns:1fr 1fr |

## 组件导出路径约定

```
// 内部路径
~/workspace/[module]/components/[name].vue

// 组件内引用父组件
import { SomeThing } from '../stores/...'

// 跨工作台引用（仅 kmki-ui 允许）
~/components/kmki-ui/Card/index.vue
```

## 后续迁移计划

- **Phase 1**（P1.5 后）：创建 `frontend/components/kmki-ui/` 目录，迁移首批共享组件
- **Phase 2**（P2 中）：短剧/小说/PPT 工作台依序引用共享组件
- **Phase 3**（P2 后）：废弃各工作台内的重复组件，全部指向 kmki-ui

---

*违反此规范视为技术债务，应在同一 Sprint 内修复。*
