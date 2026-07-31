/**
 * services/hdz/writer.service.ts — 混沌珠 Writer Agent
 *
 * 职责：根据大纲 + 已有正文 + 记忆库 + 角色设定，生成章节正文
 * 自动读取前面所有已完成的章节作为上下文，保持剧情连贯
 * BYOK：走 callLLM
 */

import { prisma } from '../../utils/index.js'
import type { LLMConfig, OrchestratorContext } from './llm.client.js'
import { callLLM, getAgentPrompt, getLockContext } from './llm.client.js'
import { alignmentMetricService, type WriterShadowMeta } from './alignment-metric.service.js'
import { consistencyVerifier } from './consistency-verifier.service.js'
import { sceneCompiler, sceneCompilerV2 } from './scene-compiler.service.js'
import { getWorldState } from './world-state.service.js'
import { getAllEntities } from './entity-registry.service.js'
import { getLatestBlueprint, formatBlueprintForLLM } from './master-plan-analyzer.service.js'
import { getCharacterProfiles } from './character-state.service.js'
import { getTimeline } from './story-event.service.js'

class WriterService {
  async execute(ctx: OrchestratorContext, llmCfg: LLMConfig): Promise<void> {
    console.log(`[HDZ/Writer] execute start: task=${ctx.taskId}, project=${ctx.projectId}, chapterNo=${ctx.chapterNo}`)
    const project = await prisma.hdzProject.findUnique({ where: { id: ctx.projectId } })
    if (!project) throw new Error('项目不存在')

    const chapterNo = ctx.chapterNo || 1
    const chapter = await prisma.hdzChapter.findUnique({
      where: { projectId_chapterNo: { projectId: ctx.projectId, chapterNo } },
    })
    if (!chapter) throw new Error(`第 ${chapterNo} 章不存在，请先生成大纲`)

    // ★ 读取已有章节（全部，用于构建总结列表和全局大纲）
    const allChapters = await prisma.hdzChapter.findMany({
      where: { projectId: ctx.projectId },
      orderBy: { chapterNo: 'asc' },
    })
    const prevChapters = allChapters.filter(c => c.chapterNo < chapterNo)
    const fullOutline = allChapters

    // ★ 前文章节总结 — 多层级金字塔策略
    //    优先级：
    //      1. 图书管理员批次小结（libraryReaderSummaries） — 按层级取最高的最新批次
    //      2. 最近5章逐章摘要（libraryReaderCache）
    //      3. 上一章的最新 chapter_summary 记忆
    //    降级：hdzChapter.summary
    let chapterSummariesStr: string
    try {
      const project = await prisma.hdzProject.findUnique({
        where: { id: ctx.projectId },
        select: { libraryReaderCache: true, libraryReaderSummaries: true },
      })
      if (project) {
        const parts: string[] = []

        // ── 批次小结（阶段性总结，最核心的记忆压缩） ──
        if (project.libraryReaderSummaries) {
          const raw = project.libraryReaderSummaries
          const rawParsed = (typeof raw === 'string' ? JSON.parse(raw) : raw) as any
          const batches: Array<{ level: number; batchIndex: number; chapterStart: number; chapterEnd: number; summary: string }> = []
          if (Array.isArray(rawParsed)) {
            for (const d of rawParsed) {
              // ⭐ 层级探测：如果 d.level 已存在则直接用，否则根据章节跨度推算
              //    同时校验 chapterStart/chapterEnd 存在性，防止 NaN → level=100 污染
              if (d.level) {
                batches.push(d)
                continue
              }
              if (typeof d.chapterStart !== 'number' || typeof d.chapterEnd !== 'number') {
                // 数据有残缺的批次直接丢弃，不带入 Writer 上下文
                console.warn(`[Writer/Summary] 丢弃残缺批次: chapterStart=${d.chapterStart}, chapterEnd=${d.chapterEnd}`)
                continue
              }
              const span = d.chapterEnd - d.chapterStart + 1
              batches.push({ ...d, level: span <= 5 ? 5 : span <= 10 ? 10 : span <= 50 ? 50 : 100 })
            }
          } else if (typeof rawParsed === 'object' && rawParsed.batches) {
            batches.push(...rawParsed.batches)
          }
          // 筛选已完成小结且全部早于当前章的批次
          const prevBatches = batches.filter(b => b.chapterEnd < chapterNo && b.summary)
          if (prevBatches.length > 0) {
            // ⭐ 注入不同层级的批次小结，每个层级取最新一个
            //    陛下指示：写101章时，batch-1-100（前100章汇总）+ batch-51-100（51-100章汇总）+ 第100章逐章摘要
            //    不同层级不互斥，互补信息
            const LEVEL_PRIORITY = [100, 50, 10, 5]
            const bestBatches: Array<{ level: number; chapterStart: number; chapterEnd: number; summary: string }> = []
            const seenLevels = new Set<number>()
            // 按层级从高到低遍历，每层级取最近的一个
            for (const level of LEVEL_PRIORITY) {
              const matches = prevBatches.filter(b => b.level === level).sort((a, b) => b.chapterEnd - a.chapterEnd)
              if (matches.length > 0) {
                bestBatches.push(matches[0])
                seenLevels.add(level)
              }
              if (bestBatches.length >= 3) break // 最多3个
            }
            for (const b of bestBatches) {
              const label = b.level === 100 ? '百章大总结' : b.level === 50 ? '五十章大总结' : b.level === 10 ? '十章小结' : '五章小结'
              parts.push(`【阶段总结：第${b.chapterStart}-${b.chapterEnd}章（${label}）】\n${b.summary}`)
            }
          }
        }

        // ── 最近5章逐章摘要（近距离上下文） ──
        if (project.libraryReaderCache) {
          const readerChapterSummaries = JSON.parse(project.libraryReaderCache) as Array<{ chapterNo: number; title: string; summary: string }>
          if (Array.isArray(readerChapterSummaries) && readerChapterSummaries.length > 0) {
            const recent = readerChapterSummaries.filter(rc => rc.chapterNo < chapterNo && rc.chapterNo >= chapterNo - 5 && rc.summary)
            if (recent.length > 0) {
              parts.push(`【近期章节详细总结（最近5章）】`)
              for (const rc of recent) {
                parts.push(`第${rc.chapterNo}章「${rc.title || ''}」：\n${rc.summary}`)
              }
            }
          }
        }

        if (parts.length > 0) {
          chapterSummariesStr = parts.join('\n\n')
          // 日志验证：输出注入的小结层级和最近章节范围
          const batchCount = (project.libraryReaderSummaries ? parts.filter(p => p.includes('【阶段总结')).length : 0)
          const recentChapterNos = parts.length > 0 && parts.some(p => p.includes('近期章节'))
            ? parts.filter(p => p.includes('第') && p.includes('章「')).map(p => {
                const m = p.match(/第(\d+)章/)
                return m ? parseInt(m[1]) : null
              }).filter(Boolean)
            : []
          console.log(`[Writer/Summary] ch${chapterNo}: ${batchCount} batch summaries, recent chapters: [${recentChapterNos.join(',')}], totalChars=${chapterSummariesStr.length}`)
        }
      }
    } catch (e: any) {
      console.warn(`[Writer/Summary] ch${chapterNo}: libraryReaderSummaries parse failed: ${e?.message}`)
    }
    if (!chapterSummariesStr) {
      // 降级：使用 hdzChapter.summary
      const recentChapters = prevChapters.slice(-5)
      const chapterSummariesList = recentChapters.map(c => {
        const summaryText = c.summary || (c.content ? c.content.slice(0, 150) + '...' : '(未写)')
        return `【第${c.chapterNo}章 ${c.title}】\n${summaryText}`
      }).join('\n\n')
      chapterSummariesStr = chapterSummariesList || '（这是第一章，没有前文需要参考）'
    }

    // ★ 完整大纲 — 全量标题索引 + 当前章前后各5章的大纲详情
    // 全量索引（仅标题行，极短，给 AI 全局脉络）
    const outlineIndex = fullOutline.map(ch => `第${ch.chapterNo}章「${ch.title}」`).join(', ')
    // 前后5章详情（当前章的 outline + 前后各5章的详情，保证写作上下文充足）
    const nearbyRange = 5
    const nearbyChapters = fullOutline.filter(ch => Math.abs(ch.chapterNo - chapterNo) <= nearbyRange)
    const nearbyOutlineText = nearbyChapters.map(ch =>
      `第${ch.chapterNo}章「${ch.title}」：${(ch.outline || '').slice(0, 500)}`
    ).join('\n')

    // ★ 角色设定 — 活跃角色全量注入 + 其余角色精简列表
    const characters = await prisma.hdzCharacter.findMany({ where: { projectId: ctx.projectId } })
    // 从 SceneGraph 获取当前章推荐出场角色（确定活跃角色）
    let activeCharNames: Set<string> = new Set()
    try {
      const contractInput = {
        projectId: ctx.projectId,
        chapterNo,
        chapterTitle: chapter.title || '',
        sceneNo: 1,
        outline: chapter.outline || `${chapterNo}章`,
      }
      const contractedGraph = await sceneCompilerV2.compileWithEntityContract(contractInput)
      const contract = contractedGraph.entityContract
      if (contract) {
        for (const n of [...contract.required, ...contract.optional, ...contract.latent]) activeCharNames.add(n)
      }
    } catch {}
    // 如果 activeCharNames 为空（SceneGraph 异常），默认全部角色为活跃
    const activeChars = characters.filter(c => activeCharNames.size > 0 ? activeCharNames.has(c.name) : true)
    const inactiveChars = characters.filter(c => activeCharNames.size > 0 ? !activeCharNames.has(c.name) : false)
    // 活跃角色：全量信息
    const activeCharContext = activeChars.map(c => {
      const props = (c.properties as any) || {}
      return `- ${c.name}（${c.role === 'protagonist' ? '主角' : c.role === 'antagonist' ? '反派' : c.role === 'supporting' ? '配角' : '龙套'}）${props.appearance ? `\n  外貌：${props.appearance}` : ''}${props.personality ? `\n  性格：${props.personality}` : ''}${c.arc ? `\n  角色弧：${c.arc}` : ''}`
    }).join('\n')
    // 非活跃角色：精简列表（只保留名字和角色类型，保证身份不丢失）
    const inactiveCharList = inactiveChars.map(c =>
      `${c.name}（${c.role === 'protagonist' ? '主角' : c.role === 'antagonist' ? '反派' : c.role === 'supporting' ? '配角' : '龙套'}）`
    ).join('、')
    // 拼装角色上下文
    let characterContext = activeCharContext
    if (inactiveCharList) {
      characterContext += `\n\n**其他角色（未在本章规划中出现，仅作身份参考）：**\n${inactiveCharList}`
    }

    // ★ 记忆库 — 按 7 个维度分别组织（精简版，每维度只取前2条关键信息）
    const memories = await prisma.hdzMemory.findMany({ where: { projectId: ctx.projectId }, orderBy: { updatedAt: 'desc' } })
    const memoryByType: Record<string, any[]> = {}
    const MEMORY_DIMENSIONS = ['character_matrix', 'pending_hooks', 'chapter_summary', 'location_state', 'pov_tracker', 'timeline', 'world_state']
    for (const m of memories) {
      const t = m.type
      if (!memoryByType[t]) memoryByType[t] = []
      memoryByType[t].push(m.content)
    }
    const MEMORY_LABELS: Record<string, string> = {
      character_matrix: '【角色矩阵】每个角色的当前状态、立场、目标、关系变化',
      pending_hooks: '【未闭合伏笔】已铺设但尚未回收的情节线索/伏笔',
      chapter_summary: '【章节摘要】已完成章节的情节摘要（按时间顺序）',
      location_state: '【场景状态】重要场景的地理/势力/环境状态变化',
      pov_tracker: '【视角追踪】各章节的叙事视角分配记录',
      timeline: '【时间线】故事内时间推进和重要事件排列',
      world_state: '【世界状态】世界观层面的全局变化（势力格局/天象/规则等）',
    }
    const memoryContext = MEMORY_DIMENSIONS.map(dim => {
      const records = memoryByType[dim]
      if (!records || records.length === 0) return ''
      const label = MEMORY_LABELS[dim] || dim
      // 精简：每维度只取最新1条，每条截取200字
      const items = records.slice(-1).map(r => {
        const str = typeof r === 'string' ? r : JSON.stringify(r)
        return str.slice(0, 200)
      }).join('\n')
      return `${label}:\n${items}`
    }).filter(Boolean).join('\n\n') || '（暂无记忆）'

    // ★ 风格DNA
    const styleDna = await prisma.hdzStyleDna.findFirst({ where: { projectId: ctx.projectId } })

    // ★ 完整大纲 — 标题索引 + 前后5章详情
    const fullOutlineStr = `**完整故事大纲（共 ${fullOutline.length} 章）：**\n${outlineIndex}\n\n**当前章前后各5章大纲详情（用于精确把握近期剧情）：**\n${nearbyOutlineText}`

    // ★ 风格参考
    let styleRef = ''
    if (project.masterStyle) {
      const masterStyles: Record<string, string> = {
        wangzengqi: '风格参照汪曾祺：用最浅最淡最短的白话写作，干净得像水洗过的玻璃。句子极简，拒绝修辞浮夸，在至淡中见至味。多用短句，少用形容词，追求「家常」而非「隆重」。',
        laoshe: '风格参照老舍：句子像胡同里的风，流畅鲜活幽默。用短句和口语节奏写小人物，语言朴素悲悯，是「活着的声音」而非「写出的文字」。多用口语化的生动表达。',
        zhangailing: '风格参照张爱玲：用刺目的颜色对比和具体意象写抽象心理，比喻奇峭又残酷。句子有旧小说的华丽底子，又有现代小说的冷峻疏离，苍凉中见精细。善用通感。',
        chenzhongshi: '风格参照陈忠实：文字厚重雄浑，句子像黄土一样沉实，没有花哨全是骨力。用「拟史诗」语调，叙事沉稳从容，富有史诗气质。',
        jiapingwa: '风格参照贾平凹：文风质朴沉郁，善用「生活流」叙事。有古文功底但不避方言土语，形成独特的「拙」味——大巧若拙，看似琐碎日常，实则暗流涌动。',
        moyan: '风格参照莫言：语言狂野奔放，善用魔幻现实主义笔法，将民间传说、历史记忆与感官体验熔于一炉。句子长时如大河奔涌，短时如刀劈斧凿。',
        yuhua: '风格参照余华：以近乎冷酷的克制书写残酷。句子极短，用词极简，拒绝任何抒情——「零度写作」反而让悲伤像钝刀子割肉，一寸一寸疼进骨头里。',
        liuzhenyun: '风格参照刘震云：语言幽默荒诞，表面是「废话文学」，实则是精准解构。句子绕来绕去，在循环往复中写透人情世故。善用对话推进叙事。',
        jinyucheng: '风格参照金宇澄《繁花》：句子极短段落极密，通篇白描对话。叙事节奏细碎绵密，意蕴悠长。用平淡的对话和细节写出时代的厚度。',
        liuliangcheng: '风格参照刘亮程：文字有散文诗质感，粗糙中有细腻，简单中蕴深邃。在现实与超现实之间游走，用风声尘土梦境构建完整世界。',
      }
      const desc = masterStyles[project.masterStyle]
      if (desc) {
        styleRef = `**严格遵循以下大师写作风格（必须从头到尾保持一致）：**\n${desc}\n\n**风格禁忌：**\n- 禁止使用过多感叹号（不超过全文1%）\n- 拒绝网络小说式的浮夸修辞\n- 保持叙述的沉稳和克制`
      }
    }
    if (!styleRef && styleDna?.sourceText) {
      styleRef = `**参考写作风格（AI 应模仿此文风）：**\n${styleDna.sourceText.slice(0, 1500)}`
    }

    // ★ Story Blueprint — AI 分析生成的结构化故事蓝图
    const blueprint = await getLatestBlueprint(ctx.projectId)
    const blueprintContext = formatBlueprintForLLM(blueprint)

    // ★ 角色当前状态（从 Character State 服务获取）
    const characterProfiles = await getCharacterProfiles(ctx.projectId)
    const recentEvents = await getTimeline(ctx.projectId)
    const recentStoryEvents = recentEvents.slice(-10) // 最近10个事件

    // ★ 小说智能内核上下文（HDZ-NOVEL-INTELLIGENCE-01 复活：总纲/卷规划/世界状态/一致性）
    let storyContextStr = ''
    try {
      const { buildStoryContext, formatStoryContextForLLM } = await import('./story-context-builder.service.js')
      const storyContext = await buildStoryContext(ctx.projectId, chapterNo)
      if (storyContext) {
        storyContextStr = formatStoryContextForLLM(storyContext)
        if (storyContext.consistencyWarnings.length > 0) {
          console.warn(`[HDZ/Writer] ⚠️ 一致性警告 ${storyContext.consistencyWarnings.length} 条 (ch${chapterNo})`)
        }
      }
    } catch (ctxErr: any) {
      console.error(`[HDZ/Writer] StoryContext 构建失败（降级继续）: ${ctxErr.message}`)
    }

    const systemPrompt = await getAgentPrompt('hdz-writer', {
      '$TITLE': project.title,
      '$GENRE': project.genre || '未指定',
      '$STYLE_DESC': project.styleDesc ? `- 风格要求：${project.styleDesc}` : '',
      '$CHAPTER_NO': String(chapterNo),
      '$CHAPTER_TITLE': chapter.title || '',
      '$OUTLINE': chapter.outline || '（无大纲）',
      '$CHARACTER_CONTEXT': characterContext || '（无角色设定）',
      '$MEMORY_CONTEXT': memoryContext || '（暂无记忆）',
      '$CHAPTER_WORD_TARGET': String(project.chapterWordTarget || 3000),
      '$CHAPTER_SUMMARIES': chapterSummariesStr,
      '$FULL_OUTLINE': fullOutlineStr,
      '$STYLE_REFERENCE': styleRef,
      '$STORY_CONTEXT': storyContextStr || '（暂无小说总纲，请先完成总纲规划）',
    })

    // ★ 三大锁定注入
    const lockContext = await getLockContext(ctx.projectId, ctx.chapterNo)
    let fullSystemPrompt = systemPrompt + (lockContext ? `\n${lockContext}` : '')

    // ★ Story Blueprint 注入（AI 分析生成的结构化故事蓝图）
    if (blueprintContext) {
      fullSystemPrompt += `\n\n${blueprintContext}`
    }

    // ★ 角色当前状态注入（动态状态时间线）
    if (characterProfiles.length > 0) {
      const stateLines: string[] = []
      stateLines.push('\n【🎭 角色当前状态（写作必须以此为准，不能凭记忆）：】')
      for (const profile of characterProfiles.slice(0, 10)) {
        const cs = profile.currentState
        const stateParts: string[] = []
        if (cs.HEALTH?.length) stateParts.push(`健康：${cs.HEALTH.map((s: any) => s.description || s.event).join('、')}`)
        if (cs.INJURY?.length) stateParts.push(`伤势：${cs.INJURY.map((s: any) => s.description || s.event).join('、')}`)
        if (cs.POWER?.length) stateParts.push(`能力：${cs.POWER.map((s: any) => s.description || s.event).join('、')}`)
        if (cs.LOCATION?.length) stateParts.push(`位置：${cs.LOCATION.map((s: any) => s.description || s.event).join('、')}`)
        if (cs.MENTAL?.length) stateParts.push(`心理：${cs.MENTAL.map((s: any) => s.description || s.event).join('、')}`)
        if (cs.IDENTITY?.length) stateParts.push(`身份：${cs.IDENTITY.map((s: any) => s.description || s.event).join('、')}`)
        if (stateParts.length > 0) {
          stateLines.push(`- **${profile.name}**：${stateParts.join('；')}`)
        }
      }
      if (stateLines.length > 1) {
        fullSystemPrompt += '\n' + stateLines.join('\n')
      }
    }

    // ★ 近期剧情事件注入
    if (recentStoryEvents.length > 0) {
      const eventLines = ['\n【📜 近期剧情事件（写作需承接以下事件）：】']
      for (const evt of recentStoryEvents.slice(-5)) {
        eventLines.push(`- 第${evt.chapterNo}章「${evt.title}」：${evt.description?.slice(0, 100) || ''}`)
      }
      fullSystemPrompt += '\n' + eventLines.join('\n')
    }

        // ★ Phase X.4 — EntityContract 软提示注入（非强制，仅供 Writer 感知）
    //    SceneGraph v2 产出 required/optional/forbidden 实体，Writer 倾向性遵循
    try {
      const contractInput = {
        projectId: ctx.projectId,
        chapterNo,
        chapterTitle: chapter.title || '',
        sceneNo: 1,
        outline: chapter.outline || `${chapterNo}章`,
      }
      const contractedGraph = await sceneCompilerV2.compileWithEntityContract(contractInput)
      const contract = contractedGraph.entityContract

      if (contract) {
        let contractSection = `\n\n【场景合约（SceneGraph v2）— 请留意以下实体指引】
以下实体信息由 SceneGraph 提供，用于辅助你的写作决策，**不是强制约束**：

**必须关注的角色（建议在本章出场）：**
${contract.required.map(n => `  • ${n}`).join('\n')}

${contract.optional.length > 0 ? `**可选出场的角色（如剧情需要可考虑）：**
${contract.optional.map(n => `  • ${n}`).join('\n')}` : ''}

${contract.latent.length > 0 ? `**剧情背景角色（不在本章出场但保持状态记忆）：**
${contract.latent.map(n => `  • ${n}`).join('\n')}` : ''}

${contract.forbidden.length > 0 ? `**避免涉及的角色（已从故事中脱离）：**
${contract.forbidden.map(n => `  • ${n}`).join('\n')}

⚠️ 以上角色已不符当前剧情条件，请勿在不合理的剧情中出现。` : ''}

**注意事项：**
- required 角色建议在本章正文中至少有 1 次合理提及
- optional 角色按剧情需要酌情安排
- forbidden 角色没有剧情支撑就不要出现
- 以上仅为参考，你对故事走向有最终判断`

        fullSystemPrompt += contractSection
        console.log(`[Writer/Contract] ch${chapterNo}: contract injected (required=${contract.required.length}, forbidden=${contract.forbidden.length})`)
      }
    } catch (e: any) {
      console.warn(`[Writer/Contract] ch${chapterNo}: contract injection failed: ${e?.message}`)
    }

// ★ 重写模式：当 ctx.userInput 有值时（来自 reviewer 的审核反馈），追加重写指令
    // ctx.mode === 'rewrite' 是前端手动按「按评审意见重写」按钮时传入
    // ctx.userInput 包含 '【第' 是质量飞轮自动触发的重写
    const isRewrite = ctx.mode === 'rewrite' || (!!ctx.userInput && ctx.userInput.includes('【第'))
    if (isRewrite) {
      const wordTarget = project.chapterWordTarget || 3500
      const wordMin = wordTarget - 200
      const wordMax = wordTarget + 200
      fullSystemPrompt += `\n\n【重写铁律（必须遵守，违反则重写不合格）】
这是根据审稿意见进行的**高质量重写任务**，目标质量 95 分以上。请仔细阅读审稿反馈后重写本章。铁律如下：

1. **大师风格从严**：以下大师写作风格必须贯穿全文，每一句话都要符合其韵味，不得滑坡为平白叙述：${styleRef || '无'}
2. **字数精确控制**：${wordTarget} 字，误差 ±200 字（即 ${wordMin}-${wordMax} 字），不足或超出都算不及格
3. **保留原有情节走向、人物设定、故事架构不变**，只改善文笔表达，不要重构故事
4. **审稿意见中指出的所有问题必须全部修正**，不能遗漏
5. **禁止堆砌文字**：拒绝空洞修辞、废话填充、套话模板，每句话必须有信息量或有感染力
6. **提升文笔维度**：描写细腻度、对话自然感、叙事节奏感、情感张力，四个维度都要加强
7. **头部质量**：这是 95 分上架标准，以头部顶尖网文水平要求自己，不得敷衍
8. 保持章节号（第 ${chapterNo} 章）不变，不要输出章节号`
    }

    // ★ 构建用户消息：如有 userInput（如审批修改意见/重写请求）则带上
    const userMessage = ctx.userInput || `请撰写第 ${chapterNo} 章「${chapter.title || ''}」的正文内容，约 ${project.chapterWordTarget || 3500} 字。`

    console.log(`[HDZ/Writer] ch${chapterNo}: sending to LLM (${llmCfg.provider}/${llmCfg.modelName})`)
    const wordTarget = project.chapterWordTarget || 3500
    const wordMin = wordTarget - 200
    const wordMax = wordTarget + 200
    let text = ''
    let wordCount = 0
    for (let attempt = 1; attempt <= 3; attempt++) {
      const attemptPrompt = attempt === 1
        ? fullSystemPrompt
        : fullSystemPrompt + `\n\n【⚠️ 严重警告】上一轮输出仅 ${wordCount} 字，远未达标！请立即修正。\n要求：正文必须达到 ${wordTarget} 字（允许 ${wordMin}-${wordMax} 字），当前 ${wordCount} 字属于严重不足。请从头重写，务必写到足够的字数。`
      text = await callLLM(llmCfg, attemptPrompt, userMessage, { maxTokens: 16384 })
      wordCount = text.replace(/\s/g, '').length
      if (wordCount >= wordMin && wordCount <= wordMax) break
      console.log(`[HDZ/Writer] ch${chapterNo}: attempt ${attempt} got ${wordCount} chars (target ${wordTarget}±200), retrying...`)
    }

    wordCount = text.replace(/\s/g, '').length

    // ★ Phase X.3 — SHADOW DUAL OUTPUT PIPELINE (read-only, best-effort)
    //   仅记录对齐评分 + state_delta 采样，不阻断主流程
    let shadowMeta: WriterShadowMeta | null = null
    let contractAlignmentData: any = null

    // ★ Phase X.4 — Contract Alignment (shadow-only, read-only)
    try {
      if (chapter.outline) {
        const contractInput = {
          projectId: ctx.projectId,
          chapterNo,
          chapterTitle: chapter.title || '',
          sceneNo: 1,
          outline: chapter.outline,
        }
        const contractedGraph = await sceneCompilerV2.compileWithEntityContract(contractInput)
        const contractScore = contractedGraph.entityContract
          ? sceneCompilerV2.calculateContractScore(text, contractedGraph.entityContract)
          : 0

        contractAlignmentData = {
          score: contractScore,
          requiredCount: contractedGraph.entityContract?.required.length || 0,
          optionalCount: contractedGraph.entityContract?.optional.length || 0,
          forbiddenCount: contractedGraph.entityContract?.forbidden.length || 0,
        }

        console.log(`[Writer/ContractShadow] ch${chapterNo}: alignment_score=${contractScore}`)
      }
    } catch (e: any) {
      console.warn(`[Writer/ContractShadow] ch${chapterNo}: contract alignment failed: ${e?.message}`)
    }


    try {
      const shadowDelta = alignmentMetricService.extractDeltaFromText(text, [])
      if (shadowDelta.delta.length > 0) {
        const sceneEntities = await getAllEntities(ctx.projectId)
        const allIds: string[] = []
        for (const t of ['character', 'item', 'location', 'event'] as const) {
          allIds.push(...sceneEntities[t].map(e => e.id))
        }
        const worldSnapshot = await getWorldState(ctx.projectId, allIds)

        // 对齐评分
        const score = alignmentMetricService.calculateAlignmentScore(allIds, shadowDelta.delta, worldSnapshot)
        shadowMeta = alignmentMetricService.buildShadowMeta(score, shadowDelta.confidence)

        // 持久化
        await alignmentMetricService.persistAlignmentRecord(
          ctx.projectId, chapter.id, chapterNo, score, shadowDelta.delta,
        )

        // Shadow 校验钩子（READ-ONLY）
        const verifierResult = await consistencyVerifier.onShadowDeltaGenerated(
          ctx.projectId, shadowDelta.delta, chapterNo,
        )

        // 日志
        console.log(`[Writer/Shadow] ch${chapterNo}: score=${score.overall_score}, delta=${shadowDelta.delta.length}, verifier=${verifierResult.ok}`)
      } else {
        console.log(`[Writer/Shadow] ch${chapterNo}: no structured delta extracted (confidence=${shadowDelta.confidence})`)
      }
    } catch (e: any) {
      console.warn(`[Writer/Shadow] ch${chapterNo}: shadow pipeline failed silently: ${e?.message}`)
    }

    await prisma.$transaction(async (tx) => {
      await tx.hdzChapter.update({
        where: { id: chapter.id },
        data: { content: text, wordCount, status: 'draft' },
      })
      await tx.eventLog.create({
        data: {
          entityType: 'chapter', entityId: chapter.id,
          eventType: 'CHAPTER_STATUS_CHANGED',
          payload: { status: 'draft', source: 'writer_new', chapterNo: ctx.chapterNo },
        },
      })
    })

    // ★ 写入记忆库：章节摘要（用于下一章续写上下文）
    await this.generateChapterSummary(chapter, text, llmCfg)

    // ★ 写入/更新世界状态记忆（自动累积）
    await this.updateWorldState(chapter, text, llmCfg)

    // ★ Phase X — 7-Truths 记忆系统全面更新
    await this.updateAllMemoryDimensions(chapter, text, llmCfg)

    // ★ V2: 事件提取 + 角色状态自动更新（异步执行，不阻塞写作主流程）
    try {
      const { processChapterEvents } = await import('./event-extractor.service.js')
      const project = await prisma.hdzProject.findUnique({ where: { id: ctx.projectId }, select: { userId: true } })
      if (project) {
        setImmediate(() => {
          processChapterEvents(ctx.projectId, chapterNo, text, project.userId)
            .then(({ events, statesCreated }) => {
              console.log(`[HDZ/Writer] ch${chapterNo}: extracted ${events.length} events, ${statesCreated} state changes`)
            })
            .catch((e: any) => console.warn(`[HDZ/Writer] ch${chapterNo}: async event extraction failed: ${e?.message}`))
        })
      }
    } catch (e: any) {
      console.warn(`[HDZ/Writer] ch${chapterNo}: event extraction setup failed: ${e?.message}`)
    }

    // ★ Phase Y.1 — Narrative Reader Runtime 异步阅读（待 Y.1 重构完成后恢复）
    // const { onChapterCompleted } = await import('../narrative-reader/index.js')
    // onChapterCompleted(ctx.projectId, chapterNo).catch((e: any) => {
    //   console.warn(`[NRR] ch${chapterNo}: async reader failed: ${e?.message}`)
    // })

    await prisma.$transaction(async (tx) => {
      await tx.hdzAgentTask.update({
        where: { id: ctx.taskId },
        data: {
          output: {
          chapterNo, chapterId: chapter.id, title: chapter.title,
          wordCount, content: text, contentPreview: text.slice(0, 200),
          mode: ctx.mode,
          shadowAlignmentMeta: shadowMeta,
          contractAlignmentData,
        } as any,
          status: isRewrite ? 'completed' : 'waiting_approval',
        },
      })
      await tx.eventLog.create({
        data: {
          entityType: 'task', entityId: ctx.taskId,
          eventType: isRewrite ? 'TASK_COMPLETED' : 'TASK_WAITING_APPROVAL',
          payload: { agentType: 'writer', chapterNo: ctx.chapterNo, mode: ctx.mode, isRewrite },
        },
      })
    })
    console.log(`[HDZ/Writer] ch${chapterNo}: done, ${wordCount} chars, completed`)
  }

  /**
   * 写完正文后自动生成章节摘要，存入记忆库（用于续写上下文）
   */
  private async generateChapterSummary(chapter: any, text: string, llmCfg: LLMConfig): Promise<void> {
    const prompt = `请为以下小说章节生成一段约 150-200 字的精炼摘要，保留关键情节、人物关系变化和伏笔。仅返回摘要文本，不要额外说明。\n\n标题：${chapter.title}\n正文：\n${text.slice(0, 3000)}`
    try {
      const summarizerPrompt = await getAgentPrompt('hdz-summarizer')
      const summary = await callLLM(llmCfg, summarizerPrompt, prompt, { maxTokens: 512, temperature: 0.3 })
      const cleanSummary = summary.replace(/^["'"""'"]|["'"""'"]$/g, '').trim().slice(0, 500)

      const summaryContent = { chapterNo: chapter.chapterNo, title: chapter.title, summary: cleanSummary }

      // ★ 回写到章节记录（供前端展示章节介绍）
      await prisma.hdzChapter.update({
        where: { id: chapter.id },
        data: { summary: cleanSummary },
      }).catch(e => console.warn(`[HDZ] ch${chapter.chapterNo} summary backfill failed`, e?.message))

      // ★ 追加到已有的 chapter_summaries 数组中
      const existing = await prisma.hdzMemory.findFirst({
        where: { projectId: chapter.projectId, type: 'chapter_summary' },
        orderBy: { updatedAt: 'desc' },
      })
      if (existing) {
        await prisma.hdzMemory.update({ where: { id: existing.id }, data: { content: summaryContent } })
      } else {
        await prisma.hdzMemory.create({
          data: { projectId: chapter.projectId, type: 'chapter_summary', content: summaryContent },
        })
      }
    } catch {
      console.warn(`[HDZ] Chapter ${chapter.chapterNo} summary gen failed`)
    }
  }

  /**
   * 更新世界状态记忆：追踪已发生的重大事件
   */
  private async updateWorldState(chapter: any, text: string, llmCfg: LLMConfig): Promise<void> {
    const prompt = `从以下小说章节中提取 2-3 个最重要的世界状态变化或事件进展。用简洁的中文列出，每行一个。\n\n标题：${chapter.title}\n正文：\n${text.slice(0, 2000)}`
    try {
      const result = await callLLM(llmCfg, '你是一个小说世界状态追踪器。提取关键事件。', prompt, { maxTokens: 256, temperature: 0.2 })
      const events = result.trim().split('\n').filter(Boolean).slice(0, 3)

      const existing = await prisma.hdzMemory.findFirst({
        where: { projectId: chapter.projectId, type: 'world_state' },
      })
      const newEntry = `【第${chapter.chapterNo}章】${chapter.title}\n${events.join('\n')}`

      if (existing) {
        const oldContent = (existing.content as any)?.events || ''
        const newContent = { events: oldContent ? oldContent + '\n\n' + newEntry : newEntry }
        await prisma.hdzMemory.update({ where: { id: existing.id }, data: { content: newContent } })
      } else {
        await prisma.hdzMemory.create({
          data: { projectId: chapter.projectId, type: 'world_state', content: { events: newEntry } },
        })
      }
    } catch {
      // 静默失败，不重要
    }
  }

  /**
   * Phase X — 7-Truths 记忆系统全面更新
   * 一次性提取所有维度的更新：角色矩阵、未闭合伏笔、场景状态、视角追踪、时间线
   * 配合已有的 chapter_summaries 和 world_state，构成完整的 7 维记忆
   */
  private async updateAllMemoryDimensions(chapter: any, text: string, llmCfg: LLMConfig): Promise<void> {
    const prompt = `从以下小说章节中提取结构性信息。用 JSON 格式输出，严格遵守以下 schema：

{
  "character_matrix": { "entities": [{"name": "角色名", "state": "当前状态", "goal": "当前目标", "relationship_changes": "与其他角色的关系变化"}] },
  "pending_hooks": [{"hook": "伏笔/线索描述", "chapter_introduced": ${chapter.chapterNo}}],
  "location_state": { "locations": [{"name": "地点名", "status": "当前状态", "changes": "本章变化"}] },
  "pov_tracker": { "chapter": ${chapter.chapterNo}, "pov_character": "本章视角角色", "shift_from": "视角切换自（若无则为 null）" },
  "timeline": { "chapter": ${chapter.chapterNo}, "in_story_time": "故事内时间（如：某年某月/几日后/同日）", "key_events": ["事件1", "事件2"] }
}

只返回 JSON，不要额外说明。

标题：${chapter.title}
正文：
${text.slice(0, 4000)}`

    try {
      const result = await callLLM(llmCfg,
        '你是一个小说世界分析器。从章节正文中提取角色、伏笔、场景、视角和时间线的结构化信息。只输出合规 JSON。',
        prompt,
        { maxTokens: 2048, temperature: 0.2 },
      )

      let parsed: any
      try { parsed = JSON.parse(result) } catch {
        // 尝试从 markdown 代码块中提取
        const jsonMatch = result.match(/```(?:json)?\s*([\s\S]*?)```/)
        if (jsonMatch) parsed = JSON.parse(jsonMatch[1])
        else throw new Error('JSON parse failed')
      }

      const projectId = chapter.projectId
      const chapterNo = chapter.chapterNo

      // ── character_matrix ──
      if (parsed.character_matrix?.entities?.length > 0) {
        const existing = await prisma.hdzMemory.findFirst({
          where: { projectId, type: 'character_matrix' },
        })
        if (existing) {
          const oldContent = (existing.content as any) || {}
          const oldEntities = Array.isArray(oldContent.entities) ? oldContent.entities : []
          // 去重合并：已存在的角色保留，新增的追加
          const oldNames = new Set(oldEntities.map((e: any) => e.name))
          const newEntities = parsed.character_matrix.entities.filter((e: any) => !oldNames.has(e.name))
          const updatedContent = {
            entities: [...oldEntities, ...newEntities].slice(-50), // 最多保留 50 条
            lastUpdated: chapterNo,
          }
          await prisma.hdzMemory.update({ where: { id: existing.id }, data: { content: updatedContent } })
        } else {
          await prisma.hdzMemory.create({
            data: { projectId, type: 'character_matrix', content: { entities: parsed.character_matrix.entities, lastUpdated: chapterNo } },
          })
        }
        console.log(`[HDZ/Memory] ch${chapterNo}: character_matrix updated (${parsed.character_matrix.entities.length} entities)`)
      }

      // ── pending_hooks ──
      if (parsed.pending_hooks?.length > 0) {
        const existing = await prisma.hdzMemory.findFirst({
          where: { projectId, type: 'pending_hooks' },
        })
        const newHooks = parsed.pending_hooks
        if (existing) {
          const oldContent = (existing.content as any) || {}
          const oldHooks = Array.isArray(oldContent.hooks) ? oldContent.hooks : []
          const allHooks = [...oldHooks, ...newHooks].slice(-30)
          await prisma.hdzMemory.update({ where: { id: existing.id }, data: { content: { hooks: allHooks } } })
        } else {
          await prisma.hdzMemory.create({
            data: { projectId, type: 'pending_hooks', content: { hooks: newHooks } },
          })
        }
        console.log(`[HDZ/Memory] ch${chapterNo}: pending_hooks updated (${newHooks.length} hooks)`)
      }

      // ── location_state ──
      if (parsed.location_state?.locations?.length > 0) {
        const existing = await prisma.hdzMemory.findFirst({
          where: { projectId, type: 'location_state' },
        })
        if (existing) {
          const oldContent = (existing.content as any) || {}
          const oldLocations = Array.isArray(oldContent.locations) ? oldContent.locations : []
          const oldNames = new Set(oldLocations.map((l: any) => l.name))
          const newLocations = parsed.location_state.locations.filter((l: any) => !oldNames.has(l.name))
          const updatedLocations = [...oldLocations, ...newLocations].slice(-30)
          await prisma.hdzMemory.update({ where: { id: existing.id }, data: { content: { locations: updatedLocations } } })
        } else {
          await prisma.hdzMemory.create({
            data: { projectId, type: 'location_state', content: { locations: parsed.location_state.locations } },
          })
        }
        console.log(`[HDZ/Memory] ch${chapterNo}: location_state updated`)
      }

      // ── pov_tracker ──
      if (parsed.pov_tracker?.pov_character) {
        const existing = await prisma.hdzMemory.findFirst({
          where: { projectId, type: 'pov_tracker' },
        })
        const newEntry = { chapter: chapterNo, character: parsed.pov_tracker.pov_character, shiftFrom: parsed.pov_tracker.shift_from || null }
        if (existing) {
          const oldContent = (existing.content as any) || {}
          const records = Array.isArray(oldContent.records) ? oldContent.records : []
          records.push(newEntry)
          await prisma.hdzMemory.update({ where: { id: existing.id }, data: { content: { records: records.slice(-100) } } })
        } else {
          await prisma.hdzMemory.create({
            data: { projectId, type: 'pov_tracker', content: { records: [newEntry] } },
          })
        }
        console.log(`[HDZ/Memory] ch${chapterNo}: pov_tracker: ${parsed.pov_tracker.pov_character}`)
      }

      // ── timeline ──
      if (parsed.timeline?.in_story_time || parsed.timeline?.key_events) {
        const existing = await prisma.hdzMemory.findFirst({
          where: { projectId, type: 'timeline' },
        })
        const newTimeline = {
          chapter: chapterNo,
          storyTime: parsed.timeline.in_story_time || '（未指定）',
          events: parsed.timeline.key_events || [],
        }
        if (existing) {
          const oldContent = (existing.content as any) || {}
          const timelineRecords = Array.isArray(oldContent.timeline) ? oldContent.timeline : []
          timelineRecords.push(newTimeline)
          await prisma.hdzMemory.update({ where: { id: existing.id }, data: { content: { timeline: timelineRecords.slice(-100) } } })
        } else {
          await prisma.hdzMemory.create({
            data: { projectId, type: 'timeline', content: { timeline: [newTimeline] } },
          })
        }
        console.log(`[HDZ/Memory] ch${chapterNo}: timeline updated`)
      }

    } catch (e: any) {
      console.warn(`[HDZ/Memory] ch${chapter.chapterNo}: 7-Truths update failed: ${e?.message}`)
    }
  }
}

export const writerService = new WriterService()
