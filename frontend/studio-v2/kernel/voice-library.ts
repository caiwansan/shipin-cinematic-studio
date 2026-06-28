/**
 * VoiceLibrary — 昆仑镜 32 种内置音色库
 * 所有音色通过 voiceProfileId 唯一引用，禁止 LLM 输出音色名称
 */
export interface VoiceProfile {
  id: string                    // voiceProfileId，如 "voice_001"
  name: string                  // 显示名称
  gender: 'female' | 'male' | 'neutral'
  age: 'child' | 'young' | 'middle' | 'elder'
  style: string                 // 风格标签：温柔/知性/沉稳/活泼/磁性/甜美/御姐/正太/大叔/奶奶
  pitch: number                 // 音高 0.5-2.0
  speed: number                 // 语速 0.5-2.0
  description: string           // 简短描述
  emotionRange: string[]        // 擅长情绪
  tags: string[]                // 搜索标签
}

export const VOICE_LIBRARY: VoiceProfile[] = [
  // ─── 女声 ───
  { id: 'voice_001', name: '温柔知性', gender: 'female', age: 'young', style: '温柔', pitch: 1.0, speed: 1.0, description: '温柔知性的年轻女声，适合旁白、叙述', emotionRange: ['温柔', '平静', '感动'], tags: ['女声', '温柔', '知性', '叙述'] },
  { id: 'voice_002', name: '甜美少女', gender: 'female', age: 'young', style: '甜美', pitch: 1.2, speed: 1.1, description: '甜美可爱的少女音，适合学生、年轻女性角色', emotionRange: ['开心', '撒娇', '惊讶'], tags: ['女声', '甜美', '少女', '可爱'] },
  { id: 'voice_003', name: '御姐气场', gender: 'female', age: 'middle', style: '御姐', pitch: 0.9, speed: 0.9, description: '成熟稳重的御姐音，适合职场女性、领导者', emotionRange: ['自信', '冷静', '严厉'], tags: ['女声', '御姐', '成熟', '气场'] },
  { id: 'voice_004', name: '活泼元气', gender: 'female', age: 'young', style: '活泼', pitch: 1.3, speed: 1.3, description: '充满活力的元气少女音', emotionRange: ['开心', '兴奋', '生气'], tags: ['女声', '活泼', '元气', '活力'] },
  { id: 'voice_005', name: '磁性女声', gender: 'female', age: 'middle', style: '磁性', pitch: 0.85, speed: 0.9, description: '略带磁性的女中音，适合成熟角色', emotionRange: ['神秘', '感性', '深沉'], tags: ['女声', '磁性', '中音', '成熟'] },
  { id: 'voice_006', name: '清亮女声', gender: 'female', age: 'young', style: '清亮', pitch: 1.15, speed: 1.0, description: '清澈明亮的年轻女声', emotionRange: ['开朗', '自信', '感动'], tags: ['女声', '清亮', '清澈', '明亮'] },
  { id: 'voice_007', name: '温柔妈妈', gender: 'female', age: 'middle', style: '温柔', pitch: 0.95, speed: 0.85, description: '温柔慈祥的母亲音色', emotionRange: ['温柔', '关爱', '担忧'], tags: ['女声', '温柔', '母亲', '慈祥'] },
  { id: 'voice_008', name: '奶奶音', gender: 'female', age: 'elder', style: '慈祥', pitch: 0.8, speed: 0.75, description: '慈祥的老奶奶音色，带岁月感', emotionRange: ['慈祥', '怀念', '平静'], tags: ['女声', '奶奶', '慈祥', '老年'] },
  { id: 'voice_009', name: '冷艳御姐', gender: 'female', age: 'middle', style: '冷艳', pitch: 0.85, speed: 0.85, description: '冷艳高傲的女声，适合反派或高冷角色', emotionRange: ['冷漠', '嘲讽', '轻蔑'], tags: ['女声', '冷艳', '高傲', '反派'] },
  { id: 'voice_010', name: '萝莉音', gender: 'female', age: 'child', style: '可爱', pitch: 1.5, speed: 1.3, description: '天真可爱的小女孩音色', emotionRange: ['开心', '好奇', '撒娇'], tags: ['女声', '萝莉', '可爱', '小女孩'] },
  { id: 'voice_011', name: '知性学姐', gender: 'female', age: 'young', style: '知性', pitch: 1.05, speed: 1.0, description: '温和知性的学姐音色，适合引导型角色', emotionRange: ['温和', '耐心', '鼓励'], tags: ['女声', '知性', '学姐', '温和'] },
  { id: 'voice_012', name: '妩媚女声', gender: 'female', age: 'middle', style: '妩媚', pitch: 0.9, speed: 0.85, description: '妩媚动人的女声，适合魅力型角色', emotionRange: ['妩媚', '诱惑', '挑逗'], tags: ['女声', '妩媚', '魅力', '诱惑'] },
  { id: 'voice_013', name: '飒爽女声', gender: 'female', age: 'young', style: '飒爽', pitch: 1.0, speed: 1.1, description: '干练飒爽的女声，适合女战士、女侠', emotionRange: ['坚定', '勇敢', '果断'], tags: ['女声', '飒爽', '干练', '女侠'] },
  { id: 'voice_014', name: '空灵女声', gender: 'female', age: 'young', style: '空灵', pitch: 1.1, speed: 0.8, description: '空灵飘逸的女声，适合仙女、精灵', emotionRange: ['梦幻', '缥缈', '神秘'], tags: ['女声', '空灵', '仙女', '精灵'] },
  { id: 'voice_015', name: '傲娇女声', gender: 'female', age: 'young', style: '傲娇', pitch: 1.2, speed: 1.15, description: '傲娇的口是心非型女声', emotionRange: ['傲娇', '害羞', '生气'], tags: ['女声', '傲娇', '可爱', '口是心非'] },
  { id: 'voice_016', name: '温和女声', gender: 'female', age: 'middle', style: '温和', pitch: 0.95, speed: 0.9, description: '温和亲切的中青年女声', emotionRange: ['温和', '亲切', '安慰'], tags: ['女声', '温和', '亲切', '中青年'] },

  // ─── 男声 ───
  { id: 'voice_017', name: '沉稳大叔', gender: 'male', age: 'middle', style: '沉稳', pitch: 0.8, speed: 0.85, description: '沉稳厚重的中年男声，适合父亲、导师', emotionRange: ['沉稳', '严肃', '关怀'], tags: ['男声', '沉稳', '大叔', '中年'] },
  { id: 'voice_018', name: '阳光少年', gender: 'male', age: 'young', style: '阳光', pitch: 1.15, speed: 1.15, description: '阳光开朗的少年音，适合学生、青年', emotionRange: ['开心', '热情', '勇敢'], tags: ['男声', '阳光', '少年', '青年'] },
  { id: 'voice_019', name: '磁性低音', gender: 'male', age: 'middle', style: '磁性', pitch: 0.75, speed: 0.8, description: '低沉有磁性的男低音，适合霸道总裁', emotionRange: ['深沉', '自信', '霸道'], tags: ['男声', '磁性', '低音', '总裁'] },
  { id: 'voice_020', name: '活力男声', gender: 'male', age: 'young', style: '活力', pitch: 1.1, speed: 1.2, description: '充满活力的青年男声', emotionRange: ['兴奋', '积极', '自信'], tags: ['男声', '活力', '青年', '积极'] },
  { id: 'voice_021', name: '温和暖男', gender: 'male', age: 'young', style: '温和', pitch: 1.0, speed: 0.95, description: '温柔体贴的暖男音色', emotionRange: ['温柔', '关心', '安慰'], tags: ['男声', '温和', '暖男', '温柔'] },
  { id: 'voice_022', name: '威严老者', gender: 'male', age: 'elder', style: '威严', pitch: 0.7, speed: 0.75, description: '威严庄重的老年男声，适合长者、掌门', emotionRange: ['威严', '睿智', '严肃'], tags: ['男声', '威严', '老者', '老年'] },
  { id: 'voice_023', name: '痞帅男声', gender: 'male', age: 'young', style: '痞帅', pitch: 0.95, speed: 1.05, description: '略带痞气的帅气男声', emotionRange: ['调侃', '不羁', '自信'], tags: ['男声', '痞帅', '不羁', '帅气'] },
  { id: 'voice_024', name: '正太音', gender: 'male', age: 'child', style: '可爱', pitch: 1.4, speed: 1.25, description: '可爱的小男孩音色', emotionRange: ['开心', '好奇', '委屈'], tags: ['男声', '正太', '可爱', '小男孩'] },
  { id: 'voice_025', name: '儒雅书生', gender: 'male', age: 'young', style: '儒雅', pitch: 0.95, speed: 0.9, description: '温文尔雅的文弱书生音色', emotionRange: ['温和', '文雅', '感性'], tags: ['男声', '儒雅', '书生', '文雅'] },
  { id: 'voice_026', name: '豪迈壮汉', gender: 'male', age: 'middle', style: '豪迈', pitch: 0.7, speed: 1.1, description: '粗犷豪放的壮汉音色，适合武将', emotionRange: ['豪爽', '愤怒', '勇猛'], tags: ['男声', '豪迈', '壮汉', '武将'] },
  { id: 'voice_027', name: '播音男声', gender: 'male', age: 'middle', style: '专业', pitch: 0.9, speed: 0.9, description: '标准的播音级男声，适合旁白', emotionRange: ['平静', '专业', '严肃'], tags: ['男声', '播音', '专业', '旁白'] },
  { id: 'voice_028', name: '颓废男声', gender: 'male', age: 'middle', style: '颓废', pitch: 0.85, speed: 0.8, description: '略带颓废感的沧桑男声', emotionRange: ['颓废', '忧郁', '疲惫'], tags: ['男声', '颓废', '沧桑', '忧郁'] },

  // ─── 中性 / 特殊 ───
  { id: 'voice_029', name: '中性叙述', gender: 'neutral', age: 'middle', style: '中性', pitch: 1.0, speed: 1.0, description: '中性的标准叙述音色', emotionRange: ['平静', '专业', '客观'], tags: ['中性', '叙述', '标准', '旁白'] },
  { id: 'voice_030', name: '机械音', gender: 'neutral', age: 'middle', style: '机械', pitch: 0.9, speed: 1.0, description: '略带电子感的机械音色，适合AI、机器人', emotionRange: ['冷漠', '机械', '程序'], tags: ['中性', '机械', 'AI', '机器人'] },
  { id: 'voice_031', name: '低沉旁白', gender: 'neutral', age: 'middle', style: '低沉', pitch: 0.8, speed: 0.85, description: '低沉的叙述音色，适合史诗旁白', emotionRange: ['深沉', '神秘', '庄重'], tags: ['中性', '低沉', '旁白', '史诗'] },
  { id: 'voice_032', name: '清澈童声', gender: 'neutral', age: 'child', style: '清澈', pitch: 1.3, speed: 1.2, description: '清澈的中性童声音色', emotionRange: ['天真', '好奇', '快乐'], tags: ['中性', '童声', '清澈', '天真'] },
]

export function getVoiceProfile(id: string): VoiceProfile | undefined {
  return VOICE_LIBRARY.find(v => v.id === id)
}

export function filterVoices(gender?: string, age?: string, style?: string, search?: string): VoiceProfile[] {
  let result = [...VOICE_LIBRARY]
  if (gender) result = result.filter(v => v.gender === gender)
  if (age) result = result.filter(v => v.age === age)
  if (style) result = result.filter(v => v.style.includes(style))
  if (search) {
    const q = search.toLowerCase()
    result = result.filter(v => v.name.includes(q) || v.tags.some(t => t.includes(q)) || v.description.includes(q))
  }
  return result
}
