# Kunlun Component Index

> 昆仑镜组件索引表
> 此表定义 `components/kunlun/` 下所有组件的职责边界。
> 任何组件语义漂移须在此更新后执行。

---

## Level 1 — Visual Primitives（`base/` & `effects/`）

| 组件 | 目录 | 层级 | 用途 | 归属原语 | 包含动画 |
|------|------|------|------|----------|----------|
| `GlassPanel` | `base/` | L1 | 玻璃态通用容器。接受 `level` 参数映射 `glass.ts` 中的 4 种玻璃风格。仅做容器，不做光效。 | Glass | 无（容器本身不动画，由父级驱动） |
| `MirrorPanel` | `base/` | L1 | 镜面品牌容器。比 GlassPanel 多一层折射/反射质感，用于品牌核心区域。 | Glass + Mirror | 旋转 + 浮游（CSS only） |
| `PrismBorder` | `effects/` | L1 | 卡片边缘彩色折射光效。鼠标 hover 时在边缘渲染七彩渐变。仅做边缘，不做背景。 | Prism | 鼠标追踪（JS） |
| `LightBeam` | `effects/` | L1 | 光束/光芒。径向或线性渐变光柱，用于 Hero 和 CTA 的视觉强调。 | Light | 呼吸 + 慢移（CSS） |
| `ParticleField` | `effects/` | L1 | Three.js 动态星空粒子场。支持鼠标驱动 + 粒子间连线。仅做背景，不做交互。 | Particle | 粒子运动（Three.js） |
| `AuroraLayer` | `effects/` | L1 | Canvas 2D 极光慢速流动层。轻量极光氛围，用于 Hero 和 Final CTA 背景层。 | Aurora | 极光流动（Canvas 2D） |

### 原语归属速查

| 组件 | 归属 |
|------|------|
| GlassPanel | Glass |
| MirrorPanel | Glass + Mirror |
| PrismBorder | Prism |
| LightBeam | Light |
| ParticleField | Particle |
| AuroraLayer | Aurora |

---

## Level 2 — Base Container（`cards/`）

| 组件 | 目录 | 层级 | 用途 | 组合的原语 |
|------|------|------|------|-----------|
| `MirrorCard` | `cards/` | L2 | 通用玻璃信息卡片。组合 GlassPanel + 可选的 PrismBorder。支持 glow/prism/hoverable 参数。 | GlassPanel, PrismBorder* |

---

## Level 3 — Business Composite（`cards/`）

| 组件 | 目录 | 层级 | 用途 | 组合的原语 |
|------|------|------|------|-----------|
| `RealmCard` | `cards/` | L3 | 五境工作台卡片。接收 `RealmDefinition`，渲染对应境界的名称/图标/路由。组合 MirrorCard。 | MirrorCard |
| `WorkbenchCard` | `cards/` | L3 | 与 RealmCard 结构相同，用于非五境场景（如文曲星展示）。暂留。 | MirrorCard |

---

## Level 3.5 — Brand Core（`hero/`）

| 组件 | 目录 | 层级 | 用途 | 组合的原语 |
|------|------|------|------|-----------|
| `HeroMirror` | `hero/` | L3.5 | 昆仑镜品牌核心视觉。半透明玻璃镜面 + 旋转 + 彩虹折射 + 边缘能量流。首页 Hero 区唯一品牌锚点。 | MirrorPanel, LightBeam, PrismBorder |

注：HeroMirror 虽然语义上在 hero 目录，但层级上属于 L3（品牌核心组合），L4 Scene 可以直接引用。

---

## Level 4 — Scenes（`scenes/`）

| 组件 | 目录 | 层级 | 用途 | 组合的组件 |
|------|------|------|------|-----------|
| `HeroScene` | `scenes/` | L4 | 首屏 Hero 区域。粒子背景 + 镜面核心 + 主文案 + CTA + 底部 Marquee。 | ParticleField, AuroraLayer, HeroMirror |
| `ChoiceLiberationScene` | `scenes/` | L4 | 左右对比：Pain vs Freedom。旧世界 vs 昆仑镜。滚动触发钥匙插入动画。 | GlassPanel |
| `WorkbenchUniverseScene` | `scenes/` | L4 | Bento Grid 展示创世五境。标题 + RealmCard 网格。 | RealmCard |
| `WenquxingScene` | `scenes/` | L4 | 文曲星引擎展示。1000 万数字滚动 + 长期记忆可视化。 | ParticleField, GlassPanel |
| `CreationLawScene` | `scenes/` | L4 | 三大创作铁律。三列 GlassPanel 展示。 | GlassPanel |
| `FourStepScene` | `scenes/` | L4 | 四步照鉴万物。Timeline 布局 + 光流路径连接。 | LightBeam, GlassPanel |
| `CreatorVoicesScene` | `scenes/` | L4 | 创作者证言。Masonry 瀑布流 + 浮动评价卡。 | GlassPanel |
| `FinalCTAScene` | `scenes/` | L4 | 终极 CTA。深空 + 神光 + 镜面飞来首尾呼应。 | AuroraLayer, HeroMirror |

---

## Level 5 — Page（`pages/`）

| 文件 | 层级 | 用途 | 组合的 Scene |
|------|------|------|-------------|
| `pages/index.vue` | L5 | 首页入口。仅编排 L4 Scene 的引入顺序。不含业务逻辑、不含动画逻辑、不含视觉实现。 | HeroScene, ChoiceLiberationScene, WorkbenchUniverseScene, WenquxingScene, CreationLawScene, FourStepScene, CreatorVoicesScene, FinalCTAScene |

---

## 未来扩展预留

当系统需要新增视觉能力时，按以下流程操作：

1. **新增原语归属组件** → 放入 `effects/`，更新本索引表
2. **新增 Scene** → 放入 `scenes/`，更新本索引表
3. **新增业务卡片类型** → 放入 `cards/`，继承 MirrorCard 或 GlassPanel
4. **不得新增层级** → L1-L5 已覆盖全部情况，任何新增组件必须归属某级

---

*本索引与组件宪法同步，变更须同时更新 `KUNLUN-COMPONENT-CONSTITUTION.md`。*
