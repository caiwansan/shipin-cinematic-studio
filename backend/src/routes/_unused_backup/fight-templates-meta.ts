// ============================================================
// fight-templates-meta.js — 模板元数据（后端路由用）
// 只包含基本信息，供前端 API 查询
// ============================================================

export const fightTemplates = [
  {
    name: '经典单挑',
    type: 'duel',
    description: '两位角色正面对决，四段式结构：蓄力→对峙→交锋→决胜',
    shotCountRange: [6, 10],
  },
  {
    name: '混战群斗',
    type: 'group-fight',
    description: '三人及以上混战，强调空间站位清晰，避免角色混淆',
    shotCountRange: [8, 14],
  },
  {
    name: '疾速追逐',
    type: 'chase',
    description: '追逃动态场景，利用环境强调速度感和空间穿越',
    shotCountRange: [6, 10],
  },
  {
    name: '兵团对决',
    type: 'battle',
    description: '大规模群体对战，强调阵型和宏观调度',
    shotCountRange: [10, 18],
  },
]
