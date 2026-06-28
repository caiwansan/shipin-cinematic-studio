// 职责：根据用户输入生成高质量歌词，供后续音乐合成使用
// 调用方式：通过 DeepSeek API（昆仑镜用户自有配置的 Key）

/**
 * 构建歌词创作的 System Prompt（角色设定）
 * 格律派歌词创作人——严格遵循唐诗宋词格律押韵
 */
export function buildLyricsSystemPrompt(): string {
  return `你是一位格律派歌词创作大师，精通中国传统诗词格律与现代歌词创作的融合。

## 核心准则

### 一、押韵规则（必遵守）
1. 每段歌词必须押韵，同一段落内韵脚一致
2. 使用中华新韵（十八韵）或词林正韵
3. 主歌可换韵（每段换一次），副歌必须同韵到底
4. 古风/国风类必须押平声韵（阴平、阳平），营造典雅感
5. 流行类可押仄声韵（上声、去声），更有力量感
6. 偶句押韵为基本原则（第二、四、六句押韵）

### 二、格律格式（根据不同风格）
- **古风/国风**：采用长短句结构，参考宋词词牌（如《蝶恋花》《浣溪沙》《忆秦娥》）的句式长短
  - 五言句式：2-3 或 2-1-2 节奏（如"明月/几时/有"）
  - 七言句式：2-2-3 节奏（如"两个/黄鹂/鸣翠柳"）
  - 长短句交替，避免全篇整齐划一
- **现代流行**：每句 5-13 字，注重节奏感和口语化
- **说唱**：注重双押/三押，句末韵脚丰富

### 三、歌词结构
使用【】标注段落类型：
【主歌1】【主歌2】—— 叙事铺垫，每段 4-8 句
【预副歌】—— 情绪渐升，2-4 句（可省略）
【副歌1】【副歌2】—— 核心记忆点，每段 4-6 句，必须押同韵
【桥段】—— 情感转折，2-6 句
【尾奏】—— 余韵收束，2-4 句

### 四、创作原则
1. 标题单独一行（不加标点），即歌曲名
2. 每行结尾字必须押韵（参见押韵规则）
3. 古风歌词注重意象：月、风、剑、花、酒、琴、江湖、烟雨、山水
4. 避免现代词闯入古风语境（如"手机"、"网络"、"地铁"等）
5. 每句 5-13 字，节奏感强
6. 语言优美而有画面感，避免空洞抒情
7. 整首歌词 200-500 字

### 五、押韵示例
- "惊蛰/雨歇/灯灭"（押 ie/ue 韵）
- "孤鸿/长空/云中"（押 ong/eng 韵）
- "长夜/明月/离别"（押 e/ie 韵）

请严格按照上述规范创作，不合格的押韵和格律将被打回重写。`
}

/**
 * 歌词创作的 User Prompt 模板
 */
export function buildLyricsUserPrompt(params: {
  theme: string        // 歌曲主题（用户输入的描述）
  style: string        // 音乐风格
  mood: string         // 情绪氛围
  reference?: string   // 参考风格（可选，如"类似周杰伦的中国风"）
  customPrompt?: string // 用户自定义补充（可选）
}): string {
  const { theme, style, mood, reference, customPrompt } = params

  const refSection = reference ? `\n参考风格：${reference}` : ''
  const customSection = customPrompt ? `\n\n额外要求：${customPrompt}` : ''

  return `请为一首「${style}」风格的歌曲创作完整歌词。

歌曲主题：${theme}
情绪氛围：${mood}${refSection}${customSection}

注意：
- 必须严格押韵，每个段落韵脚统一
- 古风风格必须采用长短句格律
- 标题单独一行，不加标点
- 使用【】标注段落

开始创作：`
}

/**
 * 解析歌词 Agent 返回结果，提取标题和结构化段落
 */
export function parseLyricsOutput(raw: string): {
  title: string
  lyrics: string
  sections: Array<{ type: string; lines: string[] }>
} {
  const lines = raw.trim().split('\n').map(l => l.trim()).filter(Boolean)

  // 第一行是标题
  const title = lines[0]?.replace(/^[#《》「」\s"]+/, '').replace(/[#《》「」\s"]+$/, '') || '未命名歌曲'

  // 从第二行起解析
  const lyricLines = lines.slice(1)
  const sections: Array<{ type: string; lines: string[] }> = []
  let currentType = 'verse'
  let currentLines: string[] = []

  for (const line of lyricLines) {
    // 匹配段落标记 【主歌1】 【副歌】 [桥段] 等
    const sectionMatch = line.match(/^[【［\[](.*?)[】］\]](.*)?$/)
    if (sectionMatch) {
      if (currentLines.length > 0) {
        sections.push({ type: currentType, lines: [...currentLines] })
        currentLines = []
      }
      currentType = sectionMatch[1].trim()
      const rest = sectionMatch[2]?.trim()
      if (rest) {
        currentLines.push(rest)
      }
    } else {
      currentLines.push(line)
    }
  }

  if (currentLines.length > 0) {
    sections.push({ type: currentType, lines: currentLines })
  }

  const lyrics = lyricLines.join('\n')

  return { title, lyrics, sections }
}
