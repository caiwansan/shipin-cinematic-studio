/**
 * prisma/seed-style-profiles.ts
 *
 * 初始化 style_profiles 表数据 —— 所有风格配置在此集中管理，禁止前端/后端硬编码。
 * 运行: npx tsx prisma/seed-style-profiles.ts
 */

import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

interface SeedStyle {
  name: string
  displayName: string
  icon: string
  description: string
  styleTokens: string
  negativeTokens: string
  promptOverrides: Record<string, string>
  modelRoutes: Record<string, { provider: string; model: string }>
  parameters: Record<string, any>
  sortOrder: number
  isDefault: boolean
}

const STYLES: SeedStyle[] = [
  // ===== 动漫风格 =====
  {
    name: 'anime',
    displayName: '动漫风格',
    icon: '🎨',
    description: '日系动画风格，二次元赛璐璐上色，线条清晰，平涂手绘质感',
    styleTokens: '日系动画风格，二次元，赛璐璐上色，动漫风，线条清晰，平涂风格，手绘质感，高饱和色彩，柔光效果，空气感构图，夸张透视',
    negativeTokens: '写实风格，真人照片，电影级画质，3D渲染，照片级，真实光影，阴影过硬，立体感过强，摄影感',
    promptOverrides: {
      character: `{{prompt}}

【画风锁定】
你必须严格按照以下画风输出角色设计：
- 日系动画风格，二次元画法
- 赛璐璐上色（Cel shading），色块分明
- 眼睛大而有神，符合动漫比例（眼睛约占脸部的1/5到1/3）
- 线条清晰干净，无模糊渐变
- 头发用色块高光，不用写实的渐变高光
- 肤色均匀，阴影用冷色或暖色色块
- 全身定妆照，居中构图，纯色或渐变背景

【禁止】
- 写实皮肤纹理，真实鼻子阴影
- 照片级光影，3D建模效果
- 油画画笔触感，水彩边缘扩散`,
      scene: `{{prompt}}

【画风锁定】
你必须严格按照以下画风输出场景背景：
- 日系动画场景背景（Animation Background）
- 赛璐璐上色，色块与渐变结合
- 天空用渐变色块，云朵用清晰轮廓
- 场景干净通透，空气感强
- 色彩饱和度高，色调柔和

【禁止】
- 写实摄影级场景
- 3D渲染感
- 阴暗写实的阴影投射
- 复杂的全局光照`,
      storyboard: `{{prompt}}

【画风锁定】
- 日系动漫二次元分镜图
- 赛璐璐上色，线条清晰
- 包含角色+场景，符合动漫比例
- 构图参考动漫常见镜头语言（大眼特写、低角度仰视、广角拉伸等）

【禁止】
- 写实、3D、油画风格`,
      video: `{{prompt}}

【风格锁定：日系动漫视频】
你必须严格按照以下风格生成视频：
- 日系动画风格，二次元
- 赛璐璐上色，线条清晰
- 动作流畅，保持动漫的"抽帧感"（非平滑补帧）
- 色彩饱和鲜明
- 角色保持一致性（发型、服装、脸型不变）

【禁止】
- 写实人物、真人质感
- 3D渲染
- 电影级调色`,
    },
    modelRoutes: {
      image: { provider: 'siliconflow', model: 'anime-style' },
      video: { provider: 'volcengine', model: 'doubao-seedance-2-0-260128' },
      llm: { provider: 'deepseek', model: 'deepseek-chat' },
    },
    parameters: {
      imageStrength: 0.9,
      videoDuration: 5,
      cfgScale: 7,
      seedMode: 'fixed',
    },
    sortOrder: 10,
    isDefault: false,
  },

  // ===== 写实风格 =====
  {
    name: 'realistic',
    displayName: '写实风格',
    icon: '🎬',
    description: '影视级写实质感，真人照片级，电影级画质',
    styleTokens: '影视级写实质感，真人照片级，电影级画质，真实光影，不卡通，摄影感，真实皮肤纹理，自然色调',
    negativeTokens: '动漫风格，卡通风格，二次元，赛璐璐，手绘，插画感，扁平化，平涂，线条感',
    promptOverrides: {
      character: `{{prompt}}

【画风锁定：写实真人】
- 真实照片级写实风格
- 电影级光影，自然肤色
- 皮肤纹理真实（毛孔、细纹）
- 全身定妆照，影棚级布光

【禁止】
- 动漫、卡通
- 扁平上色`,
      scene: `{{prompt}}

【画风锁定：写实场景】
- 照片级真实场景
- 电影级光影与调色
- 物理正确的材质质感
- 自然的景深与空气透视

【禁止】
- 二次元、卡通风格
- 扁平上色、手绘感
- 过度鲜艳的梦幻色调`,
      storyboard: `{{prompt}}

【画风锁定：写实电影】
- 电影级写实分镜
- 真实比例与光影
- 自然肤色与材质
- 构图参考经典电影镜头语言

【禁止】
- 动漫、卡通风格
- 3D渲染感过强
- 扁平上色`,
      video: `{{prompt}}

【风格锁定：写实电影风格】
你必须严格按照以下风格生成视频：
- 电影级写实质感，真人照片级画质
- 真实光影与自然色调
- 物理正确的运动和物体交互
- 角色皮肤纹理、毛发等细节真实
- 自然的景深与空气透视

【禁止】
- 动漫、卡通风格
- 二次元上色
- 扁平化、手绘感
- 3D渲染质感过强`,
    },
    modelRoutes: {
      image: { provider: 'volcengine', model: 'doubao-seedream-4-0-250828' },
      video: { provider: 'volcengine', model: 'doubao-seedance-2-0-260128' },
    },
    parameters: {
      imageStrength: 0.8,
      cfgScale: 8,
    },
    sortOrder: 0,
    isDefault: true,
  },

  // ===== 3D 渲染 =====
  {
    name: '3d',
    displayName: '3D 渲染',
    icon: '🧊',
    description: '3D渲染风格，次世代，PBR材质，CG效果',
    styleTokens: '3D渲染，次世代，PBR材质，高精度建模，三维立体，CG效果，皮克斯风格，体积感，全局光照',
    negativeTokens: '扁平，二次元，动漫，手绘，插画，油画，水彩，像素，平面化',
    promptOverrides: {
      character: `{{prompt}}

【画风锁定：3D 渲染】
- 3D渲染风格，PBR材质
- 次世代建模精度
- 全局光照 + 环境光遮蔽
- 角色设计参考皮克斯/梦工厂风格`,
      scene: `{{prompt}}

【画风锁定：3D 场景】
- 3D渲染场景，PBR材质
- 次世代建模精度
- 全局光照 + 环境光遮蔽 + 泛光
- 体积感强，物体轮廓清晰

【禁止】
- 二次元、扁平上色
- 真实照片质感（保持CG感）`,
      storyboard: `{{prompt}}

【画风锁定：3D CG】
- 3D渲染风格分镜图
- PBR材质，CG效果
- 皮克斯/梦工厂式视觉质感
- 角色与场景比例准确

【禁止】
- 照片级真实质感
- 二次元手绘
- 扁平上色、油画笔触`,
      video: `{{prompt}}

【风格锁定：3D 渲染风格】
你必须严格按照以下风格生成视频：
- 3D渲染风格，PBR材质质感
- 次世代建模级别的精度
- 全局光照 + 环境光遮蔽
- 皮克斯/梦工厂式视觉语言
- 角色和场景有明确的体积感和立体感

【禁止】
- 写实真人质感
- 二次元、动漫平涂上色
- 扁平化设计
- 真实照片的噪点和胶片颗粒感`,
    },
    modelRoutes: {
      image: { provider: 'volcengine', model: 'doubao-seedream-4-0-250828' },
      video: { provider: 'volcengine', model: 'doubao-seedance-2-0-260128' },
    },
    parameters: {},
    sortOrder: 20,
    isDefault: false,
  },

  // ===== 卡通风格 =====
  {
    name: 'cartoon',
    displayName: '卡通风格',
    icon: '⭐',
    description: '美式动画，夸张比例，明亮色彩，扁平矢量',
    styleTokens: '美式卡通风格，夸张比例，明亮色彩，扁平风格，矢量插画，线条粗犷，高饱和度',
    negativeTokens: '写实，二次元日系，赛璐璐，3D渲染，照片级，真实光影',
    promptOverrides: {
      character: `{{prompt}}

【画风锁定：美式卡通】
- 美式卡通风格，夸张比例
- 明亮色彩，高饱和度
- 线条粗犷清晰
- 扁平矢量质感
- 全身定妆照，纯色背景

【禁止】
- 日系二次元大眼睛风格
- 赛璐璐上色
- 真实照片级材质
- 3D渲染`,
      scene: `{{prompt}}

【画风锁定：美式卡通场景】
- 美式卡通场景背景
- 明亮色彩，高饱和度
- 扁平矢量风格
- 形状概括，细节简化

【禁止】
- 写实摄影级场景
- 3D渲染
- 赛璐璐动漫上色
- 油画笔触`,
      storyboard: `{{prompt}}

【画风锁定：美式卡通】
- 美式卡通分镜图
- 夸张比例、明亮色彩
- 粗线条、扁平感
- 表情夸张生动

【禁止】
- 写实、3D、二次元`,
      video: `{{prompt}}

【风格锁定：美式卡通视频】
你必须严格按照以下风格生成视频：
- 美式卡通风格
- 明亮色彩，高饱和度
- 扁平矢量质感，线条粗犷
- 动作夸张有弹性（弹性动画/Squash and Stretch）
- 表情丰富生动

【禁止】
- 写实人物、真人质感
- 日系二次元赛璐璐上色
- 3D渲染
- 电影级调色`,
    },
    modelRoutes: {
      image: { provider: 'siliconflow', model: 'cartoon-style' },
      video: { provider: 'volcengine', model: 'doubao-seedance-2-0-260128' },
    },
    parameters: {},
    sortOrder: 30,
    isDefault: false,
  },

  // ===== 赛博朋克 =====
  {
    name: 'cyberpunk',
    displayName: '赛博朋克',
    icon: '🌃',
    description: '霓虹灯，未来都市，高科技低生活，暗调紫红',
    styleTokens: '赛博朋克风格，霓虹灯，未来都市，高科技低生活，暗调紫红，发光线条，全息投影，雨夜，霓虹倒影',
    negativeTokens: '朴素，日系清新，田园，乡村，古典，温馨明亮',
    promptOverrides: {
      character: `{{prompt}}

【画风锁定：赛博朋克】
- 赛博朋克风格角色设计
- 未来科技感服装，霓虹灯配色
- 暗调紫红或蓝紫色调
- 机械义体元素，发光线条装饰
- 全身定妆照，暗色背景+霓虹光晕

【禁止】
- 田园乡村风格
- 明亮温馨色调
- 古典服饰`,
      scene: `{{prompt}}

【画风锁定：赛博朋克场景】
- 未来都市夜景
- 霓虹灯，全息投影广告
- 潮湿的街道，雨夜倒影
- 高楼林立，电子屏幕满布
- 暗调紫红或蓝紫色调

【禁止】
- 白天亮光场景
- 自然田园风格
- 明亮温馨色调`,
      storyboard: `{{prompt}}

【画风锁定：赛博朋克】
- 赛博朋克风格分镜图
- 霓虹灯照明，蓝紫暗调
- 未来都市环境
- 高科技低生活氛围

【禁止】
- 明亮色调、田园风格`,
      video: `{{prompt}}

【风格锁定：赛博朋克视频】
你必须严格按照以下风格生成视频：
- 赛博朋克风格
- 霓虹灯照明，暗调紫红或蓝紫色调
- 未来都市背景
- 发光线条、全息投影等科技元素
- 潮湿感、雨夜氛围

【禁止】
- 明亮温馨色调
- 田园、古典风格
- 白天自然光场景`,
    },
    modelRoutes: {
      image: { provider: 'volcengine', model: 'doubao-seedream-4-0-250828' },
      video: { provider: 'volcengine', model: 'doubao-seedance-2-0-260128' },
    },
    parameters: {},
    sortOrder: 40,
    isDefault: false,
  },

  // ===== 水墨风 =====
  {
    name: 'ink',
    displayName: '水墨国风',
    icon: '🖌️',
    description: '水墨风格，国画，墨色渲染，留白，写意',
    styleTokens: '水墨风格，国画，墨色渲染，留白，写意，宣纸质感，毛笔笔触，黑白为主，淡彩点缀',
    negativeTokens: '写实照片，3D渲染，动漫，卡通，油画，水彩颜料，色彩饱满',
    promptOverrides: {
      character: `{{prompt}}

【画风锁定：水墨国风】
- 水墨风格，国画
- 墨色渲染，留白写意
- 毛笔笔触，宣纸质感
- 黑白为主，淡彩点缀
- 整体造型写意而非写实

【禁止】
- 写实照片级
- 3D渲染
- 动漫、卡通
- 色彩过于饱满`,
      scene: `{{prompt}}

【画风锁定：水墨国风场景】
- 水墨国风场景
- 墨色渲染，浓淡相间
- 留白构图，意境深远
- 山石树木用墨色皴擦点染
- 宣纸纹理背景

【禁止】
- 写实照片级场景
- 3D渲染感
- 色彩过于鲜艳
- 油画感`,
      storyboard: `{{prompt}}

【画风锁定：水墨国风】
- 水墨国风分镜图
- 墨色渲染，留白构图
- 写意风格
- 毛笔笔触感

【禁止】
- 写实、3D、动漫、油画`,
      video: `{{prompt}}

【风格锁定：水墨国风视频】
你必须严格按照以下风格生成视频：
- 水墨国风风格
- 墨色渲染浓淡相间，留白构图
- 宣纸质感背景
- 毛笔笔触感（墨迹过渡自然）
- 运动节奏舒缓写意
- 色彩以黑白为主，仅少量淡彩点缀

【禁止】
- 写实人物、真人质感
- 3D渲染
- 动漫、卡通
- 色彩过于饱满鲜艳
- 高速激烈运动`,
    },
    modelRoutes: {
      image: { provider: 'siliconflow', model: 'chinese-ink' },
      video: { provider: 'volcengine', model: 'doubao-seedance-2-0-260128' },
    },
    parameters: {},
    sortOrder: 50,
    isDefault: false,
  },

  // ===== 油画风 =====
  {
    name: 'oil',
    displayName: '油画风格',
    icon: '🖼️',
    description: '油画风格，厚涂，笔触感，印象派',
    styleTokens: '油画风格，厚涂，笔触感，印象派，丰富层次，肌理感，暖色调，布纹底',
    negativeTokens: '扁平矢量，动漫，二次元，像素，照片级，3D渲染',
    promptOverrides: {
      character: `{{prompt}}

【画风锁定：油画风格】
- 油画风格角色设计
- 厚涂笔触，色彩丰富
- 布纹画布底质感
- 暖色调为主
- 印象派或古典油画风格

【禁止】
- 扁平矢量、动漫
- 照片级写实
- 3D渲染
- 二次元上色`,
      scene: `{{prompt}}

【画风锁定：油画场景】
- 油画风格场景
- 厚涂笔触感
- 丰富的色彩层次
- 布纹画布底纹理
- 印象派光影处理

【禁止】
- 写实照片级
- 3D渲染
- 扁平矢量
- 动漫上色`,
      storyboard: `{{prompt}}

【画风锁定：油画风格】
- 油画风格分镜图
- 厚涂笔触感
- 色彩丰富有层次
- 布纹画布底

【禁止】
- 写实、3D、动漫、扁平`,
      video: `{{prompt}}

【风格锁定：油画风格视频】
你必须严格按照以下风格生成视频：
- 油画风格
- 厚涂笔触感，色彩丰富有层次
- 布纹画布底质感
- 暖色调为主
- 印象派光影处理（光影柔和模糊）
- 整体视觉效果有画幅感和质感

【禁止】
- 写实真人、照片质感
- 扁平矢量、动漫二次元
- 3D渲染
- 像素风格
- 过于锐利的画面边缘`,
    },
    modelRoutes: {
      image: { provider: 'siliconflow', model: 'oil-painting' },
      video: { provider: 'volcengine', model: 'doubao-seedance-2-0-260128' },
    },
    parameters: {},
    sortOrder: 60,
    isDefault: false,
  },
]

async function main() {
  console.log('🌱 开始初始化 style_profiles...')

  for (const style of STYLES) {
    const existing = await prisma.styleProfile.findUnique({ where: { name: style.name } })
    if (existing) {
      await prisma.styleProfile.update({
        where: { name: style.name },
        data: {
          displayName: style.displayName,
          icon: style.icon,
          description: style.description,
          styleTokens: style.styleTokens,
          negativeTokens: style.negativeTokens,
          promptOverrides: style.promptOverrides as any,
          modelRoutes: style.modelRoutes as any,
          parameters: style.parameters as any,
          sortOrder: style.sortOrder,
          isDefault: style.isDefault,
        },
      })
      console.log(`  ✅ 已更新: ${style.name} (${style.displayName})`)
    } else {
      await prisma.styleProfile.create({
        data: {
          name: style.name,
          displayName: style.displayName,
          icon: style.icon,
          description: style.description,
          styleTokens: style.styleTokens,
          negativeTokens: style.negativeTokens,
          promptOverrides: style.promptOverrides as any,
          modelRoutes: style.modelRoutes as any,
          parameters: style.parameters as any,
          sortOrder: style.sortOrder,
          isDefault: style.isDefault,
        },
      })
      console.log(`  ✅ 已创建: ${style.name} (${style.displayName})`)
    }
  }

  console.log('🎉 风格档案初始化完成')
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
