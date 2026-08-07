// interp-langs.ts — 实时同声传译 世界语言池 101 语种目录（RTC-INTERPRETER-04，掌柜指令「达到100种语言，包括粤语和闽南语」）
// 三层能力：
//   1) ASR（语音→文字）：双引擎路由 —— Vosk 流式（18 常用语种，毫秒级）｜Whisper 多语言（其余 83 语种，含方言粤语 yue/闽南语 nan）
//   2) 翻译：DeepSeek 全语种互译（无语言上限）
//   3) TTS（文字→语音）：edge-tts 微软神经语音，74 语种有音色；无音色语种（27 个，含闽南语）自动降级仅字幕（架构既有容错）
// ⚠️ 前端选项列表与本文件同步维护（frontend/composables/useRtcInterpreter.ts），改这里必须同步改前端

export type InterpAsrEngine = 'vosk' | 'whisper'

export interface InterpLang {
  code: string       // 语言码（网关/WS 参数用；与 whisper 码一致，nan 除外）
  name: string       // 中文名（翻译 prompt 与前端展示）
  engine: InterpAsrEngine
  voice?: string     // edge-tts 音色；缺省 = 该语种仅字幕（TTS 自动降级）
}

// 常用 18 语种 = Vosk 流式毫秒级（fast path）；其余走 Whisper（方言/小语种，正确性优先）
const VOSK_LANGS: [string, string][] = [
  ['zh', '中文（普通话）'],
  ['en', '英语'],
  ['es', '西班牙语'],
  ['ru', '俄语'],
  ['fr', '法语'],
  ['de', '德语'],
  ['ja', '日语'],
  ['ko', '韩语'],
  ['pt', '葡萄牙语'],
  ['it', '意大利语'],
  ['ar', '阿拉伯语'],
  ['vi', '越南语'],
  ['tr', '土耳其语'],
  ['nl', '荷兰语'],
  ['pl', '波兰语'],
  ['hi', '印地语'],
  ['uk', '乌克兰语'],
  ['fa', '波斯语'],
]

// 中文方言专区（掌柜点名：粤语 + 闽南语；Whisper 路径）
//  - yue 粤语：Whisper 原生语言码，edge-tts zh-HK 粤语真声 ✅
//  - nan 闽南语：Whisper 无 nan 码 → 内部以 zh 兜底转写（best-effort，输出汉字）；edge-tts 无闽南语音色 → 仅字幕
const DIALECT_LANGS: [string, string][] = [
  ['yue', '粤语（广东话）'],
  ['nan', '闽南语（台语/福建话）'],
]

// 其余 81 语种（Whisper 原生支持；按字母序）
const WHISPER_LANGS: [string, string][] = [
  ['af', '南非荷兰语'], ['am', '阿姆哈拉语'], ['as', '阿萨姆语'], ['az', '阿塞拜疆语'],
  ['ba', '巴什基尔语'], ['be', '白俄罗斯语'], ['bg', '保加利亚语'], ['bn', '孟加拉语'],
  ['bo', '藏语'], ['br', '布列塔尼语'], ['bs', '波斯尼亚语'], ['ca', '加泰罗尼亚语'],
  ['cs', '捷克语'], ['cy', '威尔士语'], ['da', '丹麦语'], ['el', '希腊语'],
  ['et', '爱沙尼亚语'], ['eu', '巴斯克语'], ['fi', '芬兰语'], ['fo', '法罗语'],
  ['gl', '加利西亚语'], ['gu', '古吉拉特语'], ['ha', '豪萨语'], ['haw', '夏威夷语'],
  ['he', '希伯来语'], ['hr', '克罗地亚语'], ['ht', '海地克里奥尔语'], ['hu', '匈牙利语'],
  ['hy', '亚美尼亚语'], ['id', '印度尼西亚语'], ['is', '冰岛语'], ['jw', '爪哇语'],
  ['ka', '格鲁吉亚语'], ['kk', '哈萨克语'], ['km', '高棉语'], ['kn', '卡纳达语'],
  ['la', '拉丁语'], ['lb', '卢森堡语'], ['ln', '林加拉语'], ['lo', '老挝语'],
  ['lt', '立陶宛语'], ['lv', '拉脱维亚语'], ['mg', '马达加斯加语'], ['mi', '毛利语'],
  ['mk', '马其顿语'], ['ml', '马拉雅拉姆语'], ['mn', '蒙古语'], ['mr', '马拉地语'],
  ['ms', '马来语'], ['mt', '马耳他语'], ['my', '缅甸语'], ['ne', '尼泊尔语'],
  ['nn', '挪威尼诺斯克语'], ['no', '挪威语'], ['oc', '奥克语'], ['pa', '旁遮普语'],
  ['ps', '普什图语'], ['ro', '罗马尼亚语'], ['sa', '梵语'], ['sd', '信德语'],
  ['si', '僧伽罗语'], ['sk', '斯洛伐克语'], ['sl', '斯洛文尼亚语'], ['sn', '绍纳语'],
  ['so', '索马里语'], ['sq', '阿尔巴尼亚语'], ['sr', '塞尔维亚语'], ['su', '巽他语'],
  ['sv', '瑞典语'], ['sw', '斯瓦希里语'], ['ta', '泰米尔语'], ['te', '泰卢固语'],
  ['tg', '塔吉克语'], ['th', '泰语'], ['tk', '土库曼语'], ['tl', '他加禄语（菲律宾语）'],
  ['tt', '鞑靼语'], ['ur', '乌尔都语'], ['uz', '乌兹别克语'], ['yi', '意第绪语'],
  ['yo', '约鲁巴语'],
]

// 74 语种 → edge-tts 音色（女声优先；与 edge-tts --list-voices 实测对齐）
const TTS_VOICES: Record<string, string> = {
  zh: 'zh-CN-XiaoxiaoNeural', en: 'en-US-AriaNeural', es: 'es-ES-ElviraNeural', ru: 'ru-RU-SvetlanaNeural',
  fr: 'fr-FR-DeniseNeural', de: 'de-DE-KatjaNeural', ja: 'ja-JP-NanamiNeural', ko: 'ko-KR-SunHiNeural',
  pt: 'pt-BR-FranciscaNeural', it: 'it-IT-ElsaNeural', ar: 'ar-SA-ZariyahNeural', vi: 'vi-VN-HoaiMyNeural',
  tr: 'tr-TR-EmelNeural', nl: 'nl-NL-ColetteNeural', pl: 'pl-PL-ZofiaNeural', hi: 'hi-IN-SwaraNeural',
  uk: 'uk-UA-PolinaNeural', fa: 'fa-IR-DilaraNeural',
  yue: 'zh-HK-HiuMaanNeural', // 粤语真声（香港粤语女声）
  af: 'af-ZA-AdriNeural', am: 'am-ET-MekdesNeural', az: 'az-AZ-BanuNeural', bg: 'bg-BG-KalinaNeural',
  bn: 'bn-IN-TanishaaNeural', bs: 'bs-BA-VesnaNeural', ca: 'ca-ES-JoanaNeural', cs: 'cs-CZ-VlastaNeural',
  cy: 'cy-GB-NiaNeural', da: 'da-DK-ChristelNeural', el: 'el-GR-AthinaNeural', et: 'et-EE-AnuNeural',
  fi: 'fi-FI-NooraNeural', gl: 'gl-ES-SabelaNeural', gu: 'gu-IN-DhwaniNeural', he: 'he-IL-HilaNeural',
  hr: 'hr-HR-GabrijelaNeural', hu: 'hu-HU-NoemiNeural', id: 'id-ID-GadisNeural', is: 'is-IS-GudrunNeural',
  jw: 'jv-ID-SitiNeural', ka: 'ka-GE-EkaNeural', kk: 'kk-KZ-AigulNeural', km: 'km-KH-SreymomNeural',
  kn: 'kn-IN-SapnaNeural', lo: 'lo-LA-KeomanyNeural', lt: 'lt-LT-OnaNeural', lv: 'lv-LV-EveritaNeural',
  mk: 'mk-MK-MarijaNeural', ml: 'ml-IN-SobhanaNeural', mn: 'mn-MN-YesuiNeural', mr: 'mr-IN-AarohiNeural',
  ms: 'ms-MY-YasminNeural', mt: 'mt-MT-GraceNeural', my: 'my-MM-NilarNeural', ne: 'ne-NP-HemkalaNeural',
  nn: 'nb-NO-PernilleNeural', no: 'nb-NO-PernilleNeural', ps: 'ps-AF-LatifaNeural', ro: 'ro-RO-AlinaNeural',
  si: 'si-LK-ThiliniNeural', sk: 'sk-SK-ViktoriaNeural', sl: 'sl-SI-PetraNeural', so: 'so-SO-UbaxNeural',
  sq: 'sq-AL-AnilaNeural', sr: 'sr-RS-SophieNeural', su: 'su-ID-TutiNeural', sv: 'sv-SE-SofieNeural',
  sw: 'sw-KE-ZuriNeural', ta: 'ta-IN-PallaviNeural', te: 'te-IN-ShrutiNeural', th: 'th-TH-PremwadeeNeural',
  tl: 'fil-PH-BlessicaNeural', ur: 'ur-PK-UzmaNeural', uz: 'uz-UZ-MadinaNeural',
}

// ── 目录构建（SSOT）──
function buildCatalog(): InterpLang[] {
  const out: InterpLang[] = []
  for (const [code, name] of VOSK_LANGS) out.push({ code, name, engine: 'vosk', voice: TTS_VOICES[code] })
  for (const [code, name] of DIALECT_LANGS) out.push({ code, name, engine: 'whisper', voice: TTS_VOICES[code] })
  for (const [code, name] of WHISPER_LANGS) out.push({ code, name, engine: 'whisper', voice: TTS_VOICES[code] })
  return out
}

export const INTERP_LANGS: InterpLang[] = buildCatalog()
export const SUPPORTED_LANGS: Set<string> = new Set(INTERP_LANGS.map((l) => l.code))
export const LANG_NAMES: Record<string, string> = Object.fromEntries(INTERP_LANGS.map((l) => [l.code, l.name]))
export const TTS_VOICE_MAP: Record<string, string> = Object.fromEntries(
  INTERP_LANGS.filter((l) => l.voice).map((l) => [l.code, l.voice as string]),
)

/** ASR 引擎路由：常用 18 语种 → Vosk 流式（毫秒级）；其余 → Whisper（含粤语/闽南语） */
export function asrEngineFor(lang: string): InterpAsrEngine {
  return INTERP_LANGS.find((l) => l.code === lang)?.engine || 'whisper'
}

/** TTS 音色：无音色语种（如闽南语）返回 undefined → 网关自动降级仅字幕 */
export function ttsVoiceFor(lang: string): string | undefined {
  return TTS_VOICE_MAP[lang]
}

/** Whisper 转写语言码：闽南语无原生码 → zh 兜底（best-effort）；其余原样 */
export function whisperCodeFor(lang: string): string {
  return lang === 'nan' ? 'zh' : lang
}

/** 语言池统计（测试/前端徽标用） */
export function interpLangStats() {
  const vosk = INTERP_LANGS.filter((l) => l.engine === 'vosk').length
  const whisper = INTERP_LANGS.filter((l) => l.engine === 'whisper').length
  const voiced = Object.keys(TTS_VOICE_MAP).length
  return { total: INTERP_LANGS.length, vosk, whisper, voiced, subtitleOnly: INTERP_LANGS.length - voiced }
}
