# KUNLUN-COMPONENT-CONSTITUTION.md

> **昆仑镜组件宪法**
> 修订版：V1.0 · 2026-06-17
> 此宪法约束 `frontend/components/kunlun/` 下所有组件。
> 任何违反此宪法的组件不得合入首页。

---

## 第一章 · 视觉原语（Visual Primitive）

昆仑镜视觉宇宙由且仅由以下 **六种视觉原语** 构成：

| 原语 | 定义 | 视觉特征 | 实现位置 |
|------|------|----------|----------|
| **Glass** | 玻璃态容器 | `backdrop-filter: blur` + 半透明背景 + 微边框 | `components/kunlun/base/` |
| **Mirror** | 镜面核心 | 旋转反光 + 彩虹折射 + 能量流边缘 | `components/kunlun/hero/` |
| **Prism** | 棱镜光效 | 鼠标追踪彩色渐变边缘 | `components/kunlun/effects/` |
| **Light** | 光束/光芒 | 径向或线性渐变光柱 | `components/kunlun/effects/` |
| **Particle** | 粒子场 | Three.js 动态粒子 + 连线 | `components/kunlun/effects/` |
| **Aurora** | 极光层 | Canvas 2D 慢速流动光层 | `components/kunlun/effects/` |

### 第一条：禁止第七种视觉原语

任何新增视觉元素必须归属于以上六类之一。不允许出现游离于六原语之外的「第七种」。

**例外申请流程：**
1. 在 `docs/kunlun/` 下提交《视觉原语扩展提案》
2. 说明归属哪一类，或为何必须新增一类
3. 由架构审核通过后方可实施

### 第二条：原语职责边界

- Glass 只做容器，不做光效
- Prism 只做边缘折射，不做背景
- Particle 只做粒子场，不做按钮
- Mirror 只做品牌核心，不做业务卡片

---

## 第二章 · 组件层级（Component Hierarchy）

组件分为五级，每一级只能调用下一级的组件，禁止越级调用。

```
Level 1 — Visual Primitive     (base / effects)
Level 2 — Base Container       (cards)
Level 3 — Business Composite   (cards)
Level 4 — Scene                (scenes)
Level 5 — Page                 (pages/index.vue)
```

### 层级定义

| 层级 | 名称 | 目录 | 职责 |
|------|------|------|------|
| L1 | 视觉原语 | `base/`, `effects/` | 纯视觉组件，无业务逻辑 |
| L2 | 基础容器 | `cards/` | 组合原语构成可复用卡片 |
| L3 | 业务组合 | `cards/` | 注入业务数据（Realm / 文案） |
| L4 | 场景 | `scenes/` | 组合 L2/L3 构成首页各区块 |
| L5 | 页面 | `pages/index.vue` | 仅编排 L4 场景的顺序 |

### 第三条：禁止 Scene 调 Scene

场景组件（L4）不得直接引用另一个场景组件。场景之间的组合关系只能由页面层（L5）编排。

### 第四条：禁止 Page 调 Primitive

页面组件（L5）不得直接引用视觉原语组件（L1）。页面只能引用场景（L4）。

### 第五条：禁止 Primitive 含业务逻辑

视觉原语组件（L1）不得：
- 引用 `REALMS` 注册表
- 引用任何 API
- 依赖任何业务数据
- 包含业务文案

---

## 第三章 · 组件设计契约（Design Contract）

### 3.1 MirrorCard Props

```typescript
interface MirrorCardProps {
  glow?: boolean       // 是否显示金色/青色发光
  prism?: boolean      // 是否启用棱镜折射边缘
  hoverable?: boolean  // 悬停是否抬起
  size?: 'sm' | 'md' | 'lg'
}
```

### 3.2 GlassPanel Props

```typescript
interface GlassPanelProps {
  level: 'nav' | 'card' | 'modal' | 'mirror'
  // 对应 glass.ts 中定义的四种玻璃级别
  // nav: 导航栏玻璃
  // card: 标准卡片玻璃
  // modal: 模态框玻璃
  // mirror: 镜面玻璃
}
```

### 3.3 RealmCard Props

```typescript
interface RealmCardProps {
  realm: RealmDefinition  // 来自 realms.ts 注册表
  layout?: 'bento' | 'compact' | 'expanded'
}
```

### 3.4 原则

所有组件必须声明完整的 Props 接口。禁止隐式参数。
Props 默认值必须在接口中体现。

---

## 第四章 · Realm 协议（Realm Contract）

创世五境及未来所有工作台共享统一数据协议。

```typescript
interface Realm {
  id: string           // 唯一标识，如 'novel' / 'drama'
  realm: string        // 境界名，如 '文界' / '影界'
  title: string        // 产品名，如 'AI 小说'
  subtitle: string     // 一句话描述
  description?: string // 详细描述（可选，用于展开态）
  icon: string         // emoji
  route: string        // 前端路由
  color: string        // 主题色 CSS color
  enabled: boolean
  order: number
}
```

### 第五条：新增 Realm 无需改组件

新增工作台（如「游戏界」「教育界」「企业界」）只需：
1. 在 `utils/kunlun/realms.ts` 的 `REALMS` 数组中新增条目
2. 首页自动扩展

禁止为新增工作台创建专属卡片组件。

---

## 第五章 · CSS 变量公约

昆仑镜组件使用以下 CSS 变量体系。所有组件应消费变量而非硬编码值。

### 颜色变量

```css
--kl-bg-primary: #08131F
--kl-bg-secondary: #0E1D31
--kl-gold-main: #C9A86C
--kl-gold-light: #E2C88A
--kl-cyan-main: #00D4FF
--kl-cyan-light: #00F0FF
--kl-paper-white: #F8F6F1
```

### 玻璃变量

```css
--kl-glass-blur
--kl-glass-bg
--kl-glass-border
--kl-glass-shadow
--kl-glass-radius
```

### 动画变量

```css
--kl-duration-fast: 300ms
--kl-duration-normal: 500ms
--kl-duration-slow: 800ms
--kl-ease-smooth: cubic-bezier(0.22, 1, 0.36, 1)
--kl-ease-glass: cubic-bezier(0.34, 1.56, 0.64, 1)
```

---

## 第六章 · 文件命名与导出规则

### 6.1 命名

- 组件名：PascalCase（`MirrorCard.vue`）
- 组合式函数：`use` 前缀 + PascalCase（`useMirror.ts`）
- Token 文件：kebab-case（`colors.ts` / `glass.ts`）

### 6.2 导出

- 组件：默认导出（`export default`）
- 组合式函数：命名导出（`export function useXxx`）
- Token：命名导出常量（`export const colors`）

### 6.3 禁止

- 禁止在组件中直接引用 `colors` / `glass` Token（必须通过 CSS 变量）
- 禁止 `any` 类型
- 禁止未注册 Props

---

## 第七章 · 组件开发顺序

### Phase 1 — Visual Primitives（L1）

```
1. PrismBorder     → effects/
2. LightBeam       → effects/
3. ParticleField   → effects/
4. AuroraLayer     → effects/
5. GlassPanel      → base/
6. MirrorPanel     → base/
```

### Phase 2 — Business Components（L2→L3）

```
7. MirrorCard      → cards/     (L2 基础容器)
8. RealmCard       → cards/     (L3 业务组合)
9. HeroMirror      → hero/      (品牌核心)
```

### Phase 3 — Scenes（L4）

按以下顺序，每个 Scene 独立文件：

```
10. HeroScene
11. ChoiceLiberationScene
12. WorkbenchUniverseScene
13. WenquxingScene
14. CreationLawScene
15. FourStepScene
16. CreatorVoicesScene
17. FinalCTAScene
```

### Phase 4 — Page Assembly（L5）

```
18. pages/index.vue — 仅编排 Scene 顺序
```

---

## 第八章 · 违规处理

任何违反本宪法的代码提交将触发 Code Review 拒绝。

| 违规类型 | 处理方式 |
|----------|----------|
| Scene 调用 Scene | 退回，拆到 Page 层 |
| Page 调用 Primitive | 退回，封装为 Scene |
| 组件内写死 Realm | 退回，改为 Realm Registry |
| 硬编码颜色值 | 退回，改为 CSS 变量 |
| 新增第七种视觉原语 | 退回，要求归属六原语 |

---

*本宪法随昆仑镜 Design System 一同演进。版本更新需在 `docs/kunlun/` 留存变更记录。*
