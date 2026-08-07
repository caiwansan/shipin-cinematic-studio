// RTC-INTERPRETER-04.3 社区内容发布：视频通话实时语言传译 5 篇贴文
// 作者=昆仑镜官方（JWT 签发）→ 发帖 → admin 审核通过 → 验证 approved
import jwt from 'jsonwebtoken'
import fs from 'node:fs'
import path from 'node:path'

const BASE = 'https://aigc.fushtn.com'
const env = fs.readFileSync(path.resolve(process.cwd(), '.env'), 'utf8')
const JWT_SECRET = ((env.match(/^JWT_SECRET=(.+)$/m) || [])[1]?.trim() || '').replace(/^"|"$/g, '')
if (!JWT_SECRET) throw new Error('JWT_SECRET not found')

const OFFICIAL_USER = { id: 'd75eb963-e600-4962-baa8-e20373b9d414', email: '19999999999@phone.local' }
const ADMIN = { userId: 3, username: 'admin', role: 'superadmin' }

const userToken = jwt.sign({ id: OFFICIAL_USER.id, email: OFFICIAL_USER.email, tokenVersion: 1, organizationId: undefined }, JWT_SECRET, { expiresIn: '2h' })
const adminToken = jwt.sign({ ...ADMIN, isAdmin: true }, JWT_SECRET, { expiresIn: '2h' })

async function api(url, method, body, token, extraHeaders) {
  const res = await fetch(BASE + url, {
    method,
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}), ...(extraHeaders || {}) },
    body: body ? JSON.stringify(body) : undefined,
  })
  const json = await res.json().catch(() => ({}))
  return { status: res.status, json }
}

const POSTS = [
  {
    title: '昆仑茶馆上线视频通话实时同声传译：打通 101 种语言的实时对话',
    summary: '昆仑茶馆语音/视频通话新增实时同声传译：支持 101 种语言（含粤语、闽南语等方言），边说边译，字幕加语音双通道输出。桌面版与手机版已同步上线，无需安装任何额外软件。',
    category: 'general',
    tags: '同声传译,视频通话,实时翻译,昆仑茶馆,多语言',
    content: `核心结论：昆仑茶馆的语音与视频通话现已内置实时同声传译，覆盖 101 种语言（含粤语、闽南语等中文方言），通话中边说边译、字幕与语音双通道输出，桌面版和手机版同步可用。

一、这是什么
在昆仑茶馆（aigc.fushtn.com）发起语音或视频通话后，点一下同传按钮，你说的话会被实时识别并翻译成对方设定的语言：对方听到翻译语音，同时看到字幕。全程自动，无需人工转述。

二、语言覆盖
- 识别侧：faster-whisper 全部 100 个语言码，常用 18 种方言/语言走毫秒级本地引擎，长尾语言统一大模型兜底
- 方言：粤语原生识别；闽南语（台语/福建话）内部中文兜底，字幕照常输出
- 翻译侧：74 种语言有真实语音音色（edge-tts 324 音色实测对齐），粤语使用专属真声；其余语言自动降级为纯字幕模式

三、怎么用（三步）
1. 进入任意好友或群聊，点右上角电话或摄像头发起通话
2. 通话前点同传按钮，设置「我说」和「对方听」的语言
3. 开始通话，同传自动开启，字幕实时滚动

四、适用场景
- 与海外客户、合作伙伴视频沟通
- 与讲粤语、闽南语的长辈或亲友通话
- 多人跨语言会议，减少语言隔阂

行动建议：建议通话前 10 秒先设置好语言对，同传会在接通后自动启动；网络稳定的 Wi-Fi 环境下识别延迟更低。`,
  },
  {
    title: '视频通话同传教程：从设置语言到字幕语音双通道，5 分钟上手',
    summary: '手把手教程：在昆仑茶馆打开通话同传只需 5 分钟。本文覆盖语言对设置、通话中切换语言、字幕与语音双通道的开关方式，以及粤语/闽南语等方言的通话实测效果。',
    category: 'tutorial',
    tags: '同传教程,视频通话,语言设置,昆仑茶馆,新手教学',
    content: `核心结论：昆仑茶馆通话同传的使用路径极短——通话前设置语言对，接通后自动翻译，字幕与语音同时输出。本文按步骤拆解，5 分钟即可上手。

第一步：进入通话
- 桌面版：在好友或群聊窗口，点右上角电话（语音）或摄像头（视频）
- 手机版：打开 aigc.fushtn.com/mobile-app，进入私聊，点顶栏电话或视频按钮

第二步：设置同传语言
- 点同传按钮（地球图标），底部弹出语言面板
- 设置「我说」的语言（如普通话）和「对方听」的语言（如粤语）
- 选择后自动保存，下次通话记住你的偏好，直接自动开启

第三步：开始通话
- 对方接听后，同传自动运行：你的话被识别、翻译，对方听到翻译语音并看到字幕
- 通话中可随时点同传按钮切换语言或关闭

第四步：读字幕与听语音
- 字幕条实时显示翻译结果，默认显示在通话画面下方
- 带音色的语言（74 种）会播放翻译语音；无音色语言自动降级为纯字幕，不影响沟通

实测效果（2026-08-08 验收）
- 粤语通话：讲粤语的一方被准确识别为粤语并翻译成普通话，字幕地道
- 普通话翻译成粤语：输出书面粤语字幕（例：「大家好，我係昆仑茶馆嘅翻译测试」）并配粤语真声
- 闽南语方向：字幕输出地道闽南语（例：「逐家好，我是昆仑茶馆的翻译测试」），语音降级为纯字幕

FAQ
- 需要装软件吗：不需要，网页打开即用
- 支持哪些语言：101 种，含粤语、闽南语
- 通话中能改语言吗：能，点同传按钮随时改

行动建议：首次使用建议先和好友做一次 1 分钟测试通话，确认语言对设置正确，再进入正式沟通。`,
  },
  {
    title: '方言不再隔阂：用同声传译和讲粤语、闽南语的家人朋友畅快视频',
    summary: '同声传译让方言通话成为可能：粤语原生识别、闽南语字幕兜底，普通话一方听到标准翻译语音，方言一方听到普通话转成的地道方言。跨代际、跨地域的沟通从此没有门槛。',
    category: 'showcase',
    tags: '方言通话,粤语,闽南语,同声传译,亲情沟通',
    content: `核心结论：昆仑茶馆的同声传译把方言纳入了实时翻译版图——粤语、闽南语都能在视频通话中互译，普通话与方言之间的双向沟通第一次变得自然流畅。

场景一：和讲粤语的家人视频
- 你讲普通话，家人讲粤语
- 你听到家人粤语翻译成的普通话语音，家人看到你的话翻译成的粤语字幕
- 实测例：「大家好，我係昆仑茶馆嘅翻译测试，今日天气真系唔错」——粤语字幕地道，语音用专属粤语音色

场景二：闽南语长辈的日常
- 闽南语（台语/福建话）没有原生语言码，昆仑茶馆采用内部中文兜底方案
- 长辈讲闽南语，识别引擎先转写再翻译，你看到的是地道闽南语字幕
- 实测例：「逐家好，我是昆仑茶馆的翻译测试，今仔日天气真好，咱做伙去啉茶啦」

场景三：跨国亲友连线
- 普通话、英语、日语、韩语等 100 种语言全量支持
- 谁都可以用自己的母语说话，对方听到翻译后的语音

为什么能做到
- 识别引擎：faster-whisper 全量语言模型 + 18 种常用语言毫秒级本地引擎
- 翻译引擎：句末整句转写，20 秒分片上限，兼顾实时性与准确度
- 语音合成：74 种语言 324 种音色实测对齐，粤语用真人级音色

行动建议：下次和方言亲友视频前，记得先设置语言对；如果长辈听不清普通话，可以把字幕条打开，边听边看，双通道更稳。`,
  },
  {
    title: '101 种语言实时互译是怎么做到的？昆仑茶馆同声传译技术解析',
    summary: '从语音识别、机器翻译到语音合成，拆解昆仑茶馆同声传译的完整链路：18 种常用语言毫秒级引擎、83 种长尾语言统一大模型、句末整句转写、74 种语言音色合成，以及粤语闽南语的特殊处理。',
    category: 'qa',
    tags: '同声传译,技术解析,语音识别,机器翻译,语音合成',
    content: `核心结论：昆仑茶馆同声传译是一条「识别—翻译—合成」三段式流水线：先按语言路由到合适的识别引擎，句末整句转写后翻译，再按目标语言选择音色合成语音。101 种语言各得其所，方言特殊处理。

一、识别层：双引擎路由
- 18 种常用语言（中英日韩法德西俄等）走 Vosk 本地引擎，毫秒级响应
- 83 种长尾语言统一走 faster-whisper 多语言模型，单模型覆盖全量语言码
- 粤语（yue）有原生语言码，走 Whisper 原生识别；闽南语无原生码，内部用中文兜底转写

二、转写策略：句末整句
- 流式识别，但只在句末提交完整句子，避免半句翻译的碎片感
- 单句超过 20 秒自动分片，保证大段发言也能及时出结果

三、翻译层：101 语言对
- 语言池与 faster-whisper 全量语言码对齐，共 101 项（含闽南语）
- 支持「我说 A 语言、对方听 B 语言」的任意方向组合

四、合成层：74 种语言真实音色
- edge-tts 324 个音色实测对齐到 74 种语言
- 粤语使用专属音色（zh-HK-HiuMaanNeural），发音地道
- 其余 27 种无音色的语言自动降级为纯字幕模式，不中断通话

五、工程保障
- 服务启动时预热模型，冷启动 10-120 秒内就绪
- 通话帧流持续不断，不触发会话超时
- 桌面版与手机版共用同一套引擎，信令互通

FAQ
- 识别准吗：常用语言毫秒级高准确；长尾语言为 best-effort，口语化内容建议用常用语言
- 会打断说话吗：不会，句末才出翻译，边说边译
- 支持实时改语言吗：支持，通话中随时切换

行动建议：对准确度要求高的正式沟通，建议双方都选择常用语言；对方言通话，推荐普通话+粤语组合，效果最好。`,
  },
  {
    title: '视频通话同传常见问题：语言覆盖、准确度、延迟与使用技巧',
    summary: '关于昆仑茶馆视频通话同声传译的 10 个高频问题：支持哪些语言、粤语闽南语怎么处理、翻译准不准、延迟多久、要不要装软件、通话中能否改语言、字幕怎么关等，一文讲清。',
    category: 'qa',
    tags: '同传FAQ,视频通话,实时翻译,常见问题,使用技巧',
    content: `核心结论：昆仑茶馆视频通话同声传译已覆盖 101 种语言，网页即用、无需安装；常用语言识别快、翻译准，方言走特殊通道；延迟在句末转写模型下约 1-3 秒，适合对话节奏。

Q1：支持哪些语言？
A：101 种，包括 faster-whisper 全量 100 个语言码加闽南语。普通话、英语、日语、韩语、粤语等全量覆盖。

Q2：粤语和闽南语能翻译吗？
A：能。粤语原生识别，翻译成普通话或从普通话翻译成粤语都支持，配粤语真声；闽南语用内部中文兜底，字幕输出地道闽南语，语音降级为纯字幕。

Q3：翻译准确吗？
A：常用语言（中英日韩等）识别与翻译质量优秀；长尾语言为尽力而为，正式场景建议用常用语言。

Q4：延迟多久？
A：句末整句转写，单句 20 秒内出结果。网络良好时，从说完到对方看到字幕约 1-3 秒，适合正常对话节奏。

Q5：需要安装软件吗？
A：不需要。桌面版浏览器直接使用；手机版打开 aigc.fushtn.com/mobile-app 即可。

Q6：通话中能改语言吗？
A：能。点同传按钮随时切换「我说」和「对方听」的语言，立即生效。

Q7：字幕能关掉吗？
A：能。同传控制条里可单独开关字幕或语音，也可以整体关闭同传。

Q8：和传统翻译软件有什么区别？
A：传统软件是「复制粘贴式」逐句翻译；昆仑茶馆同传是通话内嵌的实时通道，边说边译、字幕语音双输出，且桌面手机互通。

Q9：对网络有要求吗？
A：建议 Wi-Fi 或稳定 4G/5G；网络差时识别延迟会变长，字幕仍可用。

Q10：多人通话能用吗？
A：当前同传支持通话双方的语言互译；群场景建议先双方一对一验证效果。

行动建议：收藏本页，首次使用前先和好友做 1 分钟测试通话；把常用语言对保存好，下次通话自动开启。`,
  },
]

const results = []
for (const post of POSTS) {
  const r = await api('/api/community/posts', 'POST', post, userToken)
  const pid = r.json?.post?.id || r.json?.id
  results.push({ title: post.title, status: r.status, id: pid, error: r.json?.error })
  console.log(`发帖 [${r.status}] ${post.title.slice(0, 30)} → ${pid || r.json?.error || ''}`)
}

const created = results.filter((r) => r.status === 200 && r.id)
console.log(`\n创建成功 ${created.length}/${POSTS.length}`)

// 站长审核：x-admin-token（admin JWT）+ PATCH /api/community/admin/posts/:id/approve
for (const r of created) {
  const a = await api(`/api/community/admin/posts/${r.id}/approve`, 'PATCH', undefined, undefined, { 'x-admin-token': adminToken })
  console.log(`审核 [${a.status}] ${r.title.slice(0, 30)}`)
}

// 验证：公开列表可见 + approved
const list = await fetch(BASE + '/api/community/posts?page=1&pageSize=10&category=all').then((r) => r.json())
const items = list.items || list.posts || list.data || []
const ok = created.filter((c) => items.some((i) => i.id === c.id)).length
console.log(`\n公开列表可见 ${ok}/${created.length}`)
const detail = await fetch(BASE + `/api/community/posts/${created[0]?.id}`).then((r) => r.json())
console.log('详情样例:', detail.title, '| status =', detail.status, '| author =', detail.user?.username || detail.author, '| summary =', (detail.summary || '').slice(0, 40))
