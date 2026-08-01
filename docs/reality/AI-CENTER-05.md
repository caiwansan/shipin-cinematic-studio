# Sprint-AI-CENTER-05 AI中心重构：全球AI模型性价比中心 — COMPLETE ✅

**Date:** 2026-08-02 01:20
**Gate:** 掌柜战略收敛（AI浏览器方向在 Web SaaS 场景受第三方站点安全策略限制 → 停止投入；AI中心核心价值 = 昆仑镜自己的 AI 模型决策中心）

## 掌柜定位冻结（最高优先级）
> **AI中心 = 全球 AI 模型价格、能力、性价比、API管理中心**
> ❌ 不嵌入第三方网页 ❌ 不做浏览器容器 ❌ 不做代理 ❌ 不增加 Token 消耗 ❌ 不碰用户 Key 托管
> 用户进 AI中心只解决三件事：哪个 AI 适合我？哪个最划算？我的 API 状态和余额是多少？

## 一、Mini Browser 废弃 ✅
- 前端 MiniAIBrowser 入口 / iframe 浏览 / browserMode UI / 第三方网页嵌入逻辑 → **全部移除**（页面完全重写）
- 数据库字段 browserMode/loginUrl/browserEnabled **保留不删**，语义调整 deprecated（seed 新厂商 browserEnabled=false, browserMode='deprecated'）
- AI Provider 数据体系完整保留

## 二、页面重构（/ai-center，Apple/Linear 风格）
- **Hero**：AI中心 + 「发现全球最佳 AI 模型」渐变大字 + 搜索框 + 三数据卡（全球模型 40+ / 支持厂商 21+ / 已连接模型，真实统计非写死）
- **分类 Tab**：全部 / 💬语言 / 🎨图片 / 🎬视频 / 🎙语音 / 🌐多模态 / 🤖Agent（带计数）
- **高级模型卡**（玻璃拟态+微动画+亮暗自适应）：
  - 头：品牌色块 + 厂商+主推模型名（DeepSeek DeepSeek-V3）+ 国家·类型 + 运营标签
  - 综合性价比 ★★★★★ 92（能力×60%+价格×40%，纯计算）
  - 能力条（语言类：中文/推理/代码；视觉类：质量/速度/中文）
  - 价格（输入/输出 ¥/百万tokens + 上下文长度徽章）
  - 我的状态（🟢已连接/未连接 + 余额位）
  - 操作：[注册API账号] [充值] [查询余额]
- **AI Compare 二维对比**：SVG 散点（X=价格对数轴 低→高，Y=能力，气泡大小=性价比，颜色=类型），网格+轴标签+图例
- **价格中心横幅**：价格更新时间（最新维护日）+ 来源：官方公开价格

## 三、详情页（/ai-center/:code）
模型介绍 / **能力雷达图（SVG 六维，视觉类自动降四维）** / 价格+更新时间+来源 / 支持模型 chips / **适合场景**（纯本地规则基于能力分，无 AI）/ 我的状态 / 注册·充值·余额·文档按钮

## 四、数据层扩展
```prisma
modelTypes   String[]  // 分类: language/image/video/audio/multimodal/agent（可多选）
modelName    String    // 主推模型名（卡片标题）
contextLength Int?     // 上下文 tokens
priceSource  String    // 价格来源（默认「官方公开价格」）
```
DB 已 ALTER（camelCase 列名）+ prisma generate + seed v5

## 五、首批模型分类（21 家）
- 语言 11：DeepSeek/OpenAI/智谱/Kimi/火山/通义/文心/混元/讯飞/Gemini/Claude/Llama
- 图片 4：即梦/Midjourney/DALL-E/通义万相
- 视频 6：可灵/Runway/Pika/Luma/即梦/通义万相
- 语音 2：讯飞/ElevenLabs
- 多模态 5 / Agent 3（OpenAI·Claude·DeepSeek）

## 六、后台管理（/admin/ai-center/providers）
新增「🧭 模型分类」区：主推模型名 / 类型多选（6 类）/ 上下文长度 / 价格来源；价格运营区保留（输入/输出/价格分/更新时间自动刷新/标签下拉/支持模型）

## 七、BYOK 严守
余额查询：点「查询余额」→ 弹窗输入 Key → 实时请求官方接口 → 展示 → 立即释放，Key 不落库（API 返回 byok 声明字段）；后台无轮询；平台不保存 Key/余额

## 验收（浏览器生产域全 PASS）
| 项 | 结果 |
|----|------|
| Hero+数据卡（40+/21+） | ✅ |
| 6 分类 Tab + 计数 + 切换过滤 | ✅ |
| 高级卡片全要素（性价比/能力/价格/状态/3按钮） | ✅ |
| Compare 二维散点 | ✅ |
| 价格中心（更新时间+来源） | ✅ |
| 详情页（雷达图/场景/价格/模型/按钮） | ✅ |
| 余额查询：真实 Key → ¥0 实时显示 | ✅ |
| 亮暗自适应（light #f7f8fb） | ✅ |
| 后台分类编辑表单 | ✅ |
| 图片分类切换正确（DeepSeek 隐藏） | ✅ |

截图：docs/reality/AI-CENTER-05-{home,tab-image,detail,balance,light,admin}.png
提交：`（见 git log）`

## 冻结清单（持续）
❌ 嵌入第三方网页 ❌ 浏览器容器 ❌ 代理 ❌ Token 预测消耗 ❌ 自动选模型/调度/编排 ❌ 平台托管用户 Key ❌ 保存余额

## 路线
01 全球入口 ✅ → 02A 能力评分 ✅ → 02B 场景推荐 ✅ → 03 消费决策中心 ✅ → 04 商业入口 ✅ → **05 全球AI模型性价比中心 ✅**
> AI中心 = 模型商城 + 价格比较中心（购买和管理 AI 能力之前的必经入口），类比「AI 时代显卡性能榜 + 云服务价格中心 + API 管理台」
