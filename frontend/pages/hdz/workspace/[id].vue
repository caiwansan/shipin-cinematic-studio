<template>
  <div class="hdz-workspace">
    <!-- 顶部栏 -->
    <nav class="hdz-ws-topbar">
      <div class="hdz-ws-topbar-left">
        <a class="hdz-ws-back" href="#" @click.prevent="goBack">← 项目列表</a>
        <span class="hdz-ws-sep">|</span>
        <span class="hdz-ws-project-title">{{ project?.title || '加载中...' }}</span>
        <span v-if="project?.genre" class="hdz-ws-genre-tag">{{ project.genre }}</span>
      </div>
      <div class="hdz-ws-topbar-right">
        <span class="hdz-ws-stat">📝 {{ chapterCount }} 章</span>
        <span class="hdz-ws-stat">👤 {{ characterCount }} 角色</span>
        <span v-if="wordProgress > 0" class="hdz-ws-stat">📊 {{ wordProgress }}%</span>
      </div>
    </nav>

    <div class="hdz-ws-body">
      <!-- 左侧导航 -->
      <aside class="hdz-ws-sidebar">
        <div class="hdz-ws-sidebar-section">
          <div class="hdz-ws-sidebar-title">创作</div>
          <button class="hdz-ws-sidebar-btn" :class="{ active: tab === 'chat' }" @click="tab = 'chat'">
            💬 对话写作
          </button>
          <button class="hdz-ws-sidebar-btn" :class="{ active: tab === 'outline' }" @click="tab = 'outline'">
            📋 大纲管理
          </button>
          <button class="hdz-ws-sidebar-btn" :class="{ active: tab === 'manuscript' }" @click="tab = 'manuscript'">
            📝 手稿编辑
          </button>
          <button class="hdz-ws-sidebar-btn" :class="{ active: tab === 'reader' }" @click="tab = 'reader'">
            📖 阅读器
          </button>
          <button class="hdz-ws-sidebar-btn" :class="{ active: tab === 'screenplay' }" @click="tab = 'screenplay'">
            🎬 编剧
          </button>
          <button class="hdz-ws-sidebar-btn" :class="{ active: tab === 'librarian' }" @click="showLibraryReader">
            📚 图书馆管理员
          </button>
          <button class="hdz-ws-sidebar-btn" @click="triggerUpload">
            📂 导入文档
          </button>
        </div>
        <div class="hdz-ws-sidebar-section">
          <div class="hdz-ws-sidebar-title">审批</div>
          <button class="hdz-ws-sidebar-btn" :class="{ active: focusApproval }" @click="focusApprovalPanel">
            📋 审批 <span v-if="pendingApprovalCount > 0" class="hdz-approval-badge">{{ pendingApprovalCount }}</span>
          </button>
        </div>
        <div class="hdz-ws-sidebar-section">
          <div class="hdz-ws-sidebar-title">设定</div>
          <button class="hdz-ws-sidebar-btn" :class="{ active: tab === 'characters' }" @click="tab = 'characters'">
            👤 角色设定
          </button>
          <button class="hdz-ws-sidebar-btn" :class="{ active: tab === 'factions' }" @click="tab = 'factions'">
            🏛️ 组织设定
          </button>
          <button class="hdz-ws-sidebar-btn" :class="{ active: tab === 'memory' }" @click="tab = 'memory'">
            🧠 记忆库
          </button>
          <button class="hdz-ws-sidebar-btn" :class="{ active: tab === 'style' }" @click="tab = 'style'">
            🎨 风格DNA
          </button>
        </div>

        <!-- 左栏底部卡片 -->
        <div class="hdz-ws-sidebar-bottom">
          <div class="hdz-ws-card hdz-ws-card--member" @click="goMemberCenter">
            <div class="hdz-ws-card-icon" :class="{ 'hdz-vip-icon': isVip }">
              {{ isVip ? '👑' : '💎' }}
            </div>
            <div class="hdz-ws-card-info">
              <div class="hdz-ws-card-title">{{ memberTier !== 'free' ? displayMemberName : '免费用户' }}</div>
              <div class="hdz-ws-card-desc">{{ isVip ? `余额 ${memberCredits} 积分` : '了解会员权益' }}</div>
            </div>
            <div class="hdz-ws-card-arrow">→</div>
          </div>
          <div class="hdz-ws-card hdz-ws-card--model" @click="showModelSettings = true">
            <div class="hdz-ws-card-icon">🧩</div>
            <div class="hdz-ws-card-info">
              <div class="hdz-ws-card-title">大模型设置</div>
              <div class="hdz-ws-card-desc">配置 AI 引擎与 API Key</div>
            </div>
            <div class="hdz-ws-card-arrow">→</div>
          </div>
          <div class="hdz-ws-card hdz-ws-card--local" @click="showLocalModel = true">
            <div class="hdz-ws-card-icon">🖥️</div>
            <div class="hdz-ws-card-info">
              <div class="hdz-ws-card-title">本地模型</div>
              <div class="hdz-ws-card-desc">Ollama / 离线部署</div>
            </div>
            <div class="hdz-ws-card-arrow">→</div>
          </div>
        </div>

        <!-- 锁定状态区 -->
        <div class="hdz-lock-section">
          <div class="hdz-lock-title">🔒 三大锁定</div>
          <div class="hdz-lock-item" :class="{ 'hdz-lock--on': projectLocks?.styleLocked !== false }" @click="toggleLock('styleLocked')">
            <span class="hdz-lock-icon">{{ projectLocks?.styleLocked !== false ? '🔒' : '🔓' }}</span>
            <span class="hdz-lock-label">写作风格</span>
          </div>
          <div class="hdz-lock-item" :class="{ 'hdz-lock--on': projectLocks?.outlineLocked !== false }" @click="toggleLock('outlineLocked')">
            <span class="hdz-lock-icon">{{ projectLocks?.outlineLocked !== false ? '🔒' : '🔓' }}</span>
            <span class="hdz-lock-label">大纲</span>
          </div>
          <div class="hdz-lock-item" :class="{ 'hdz-lock--on': projectLocks?.logicLocked !== false }" @click="toggleLock('logicLocked')">
            <span class="hdz-lock-icon">{{ projectLocks?.logicLocked !== false ? '🔒' : '🔓' }}</span>
            <span class="hdz-lock-label">故事逻辑</span>
          </div>
        </div>
      </aside>

      <!-- 主工作区 -->
      <main class="hdz-ws-main hdz-ws-main--with-right">
        <!-- 对话写作 -->
        <div v-if="tab === 'chat'" class="hdz-ws-panel">
          <div class="hdz-chat-container">
            <div class="hdz-chat-header">
              <span>💬 创作对话</span>
              <span class="hdz-chat-hint">告诉我你想写什么，混沌珠帮你生成</span>
              <div class="hdz-chat-header-actions">
                <button class="hdz-chat-session-btn" @click="showSessionList = !showSessionList" :title="currentSessionId ? '切换对话（当前有 ' + messages.length + ' 条消息）' : '查看对话历史'">
                  📋 {{ currentSessionId ? `对话 ${chatSessions.findIndex(s => s.id === currentSessionId) + 1}/${chatSessions.length}` : '历史' }}
                </button>
              </div>
              <!-- 对话模板 -->
              <div class="hdz-chat-templates">
                <button class="hdz-chat-tpl-btn" @click="useTemplate('帮我构思一个仙侠世界观，包含修炼体系、宗门格局、天地规则')">🌌 仙侠世界观</button>
                <button class="hdz-chat-tpl-btn" @click="useTemplate('设计一个性格复杂的女主角，她背负着复仇使命，内心却有柔软的一面。请给出完整设定')">👩 女主角设定</button>
                <button class="hdz-chat-tpl-btn" @click="useTemplate('帮我写一个引人入胜的故事开头，第一章要有冲突悬念')">📖 第一章开头</button>
                <button class="hdz-chat-tpl-btn" @click="useTemplate('小说写到一半不知道怎么推进剧情了，帮我梳理后续发展')">💡 剧情卡点</button>
                <button class="hdz-chat-tpl-btn" @click="useTemplate('我要设计一个强大的反派势力，请给我构思结构、首领、目标、威胁等级')">👹 反派势力</button>
                <button class="hdz-chat-tpl-btn" @click="useTemplate('帮我设计一章都市悬疑情节，主角发现了一个惊天秘密，剧情要有反转')">🔍 悬疑反转</button>
                <button class="hdz-chat-tpl-btn" @click="useTemplate('帮我设计一个跨越多条时间线的穿越剧情，不同时空的人物命运交织')">⏳ 穿越多线</button>
                <button class="hdz-chat-tpl-btn" @click="useTemplate('为我的小说设计完整的魔法体系，包含元素分类、等级体系、施法规则')">🔮 魔法体系</button>
                <button class="hdz-chat-tpl-btn" @click="useTemplate('帮我设计一对宿敌CP，既是对手又互相欣赏，感情线要虐心')">💔 宿敌CP</button>
                <button class="hdz-chat-tpl-btn" @click="useTemplate('我想写一个宏大的战争场面，两军对垒，主角在战场上的高光时刻')">⚔️ 战争场面</button>
                <button class="hdz-chat-tpl-btn" @click="useTemplate('帮我梳理一下我已经写的章节和角色，给出后续剧情建议')">📋 创作复盘</button>
                <button class="hdz-chat-tpl-btn" @click="useTemplate('设计一个反转结局，让读者意想不到但合情合理')">🔄 反转结局</button>
              </div>
            </div>
            <!-- 快捷操作区（消息区域上方，固定在 header 下方，不随消息滚动） -->
            <div class="hdz-chat-actions-bar">
              <button class="hdz-chat-action-btn" @click="showCreateChar = true">👤 创建角色</button>
              <button class="hdz-chat-action-btn" @click="showCreateFaction = true">🏛️ 创建组织</button>
              <button class="hdz-chat-action-btn hdz-chat-action-btn--primary" @click="generateOutlineFromChat">📋 生成大纲</button>
              <button class="hdz-chat-action-btn hdz-chat-action-btn--primary" @click="startWriting">✍️ 写正文</button>
              <button v-if="hasWritingTask" class="hdz-chat-action-btn hdz-chat-action-btn--danger" @click="cancelWriting" :disabled="cancellingWriting">{{ cancellingWriting ? '⏳ 暂停中...' : '⏸️ 暂停写作' }}</button>
            </div>
            <div class="hdz-chat-messages" ref="chatRef">
              <!-- 对话历史列表面板 -->
              <div v-if="showSessionList" class="hdz-session-panel">
                <div class="hdz-session-panel-header">
                  <span>📋 对话历史（{{ chatSessions.length }}）</span>
                  <button class="hdz-btn hdz-btn-ghost hdz-btn-xs" @click="newChatSession">✏️ 新建对话</button>
                </div>
                <div v-if="chatSessions.length === 0" class="hdz-session-empty">暂无对话记录，发一条消息就开始吧</div>
                <div v-for="(s, si) in chatSessions" :key="s.id" class="hdz-session-item" :class="{ 'hdz-session--active': s.id === currentSessionId }" @click="switchSession(s.id)">
                  <div class="hdz-session-item-title">{{ s.firstMsg || '新对话' }}</div>
                  <div class="hdz-session-item-meta">{{ s.msgCount }} 条消息 · {{ new Date(s.updatedAt).toLocaleString('zh-CN', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) }}</div>
                </div>
              </div>
              <div v-if="messages.length === 0 && !showSessionList" class="hdz-chat-empty">
                <p>开始你的创作之旅</p>
                <p class="hdz-chat-empty-hint">和文曲星聊聊你的故事设定吧！例如：「我想写一部武侠小说，帮我想个开头」</p>
              </div>
              <div v-for="(msg, i) in messages" :key="i" class="hdz-chat-msg" :class="`hdz-msg--${msg.role}`">
                <div class="hdz-msg-avatar">{{ msg.role === 'user' ? '👤' : '☯' }}</div>
                <div class="hdz-msg-content" v-html="cleanContent(msg.content)"></div>
                <div v-if="msg.role === 'assistant' && msg.content && !msg.content.includes('正在思考') && !msg.content.includes('🤖') && msg.content.length > 20" class="hdz-msg-actions">
                  <button class="hdz-tts-btn" :disabled="msg._ttsLoading" @click="playTts(msg, i)" :title="msg._ttsLoading ? '正在生成语音...' : '朗读全文'">
                    {{ msg._ttsLoading ? '⏳' : (msg._ttsPlaying ? '🔊' : '🎵') }}
                  </button>
                </div>
              </div>
              <!-- 隐藏的 audio 播放器 -->
              <audio ref="ttsAudioRef" style="display:none" @ended="onTtsEnded" />
            </div>
            <div class="hdz-chat-input-bar">
              <textarea
                v-model="chatInput"
                placeholder="输入创作指令..."
                class="hdz-chat-input"
                rows="1"
                @keydown.enter.exact.prevent="sendChat"
                @input="autoResizeChatInput"
              ></textarea>
              <button class="hdz-btn hdz-btn-primary hdz-btn-sm" @click="sendChat">发送</button>
            </div>
          </div>
        </div>

        <!-- 大纲管理 -->
        <div v-if="tab === 'outline'" class="hdz-ws-panel">
          <div class="hdz-panel-header">
            <span>📋 章节大纲</span>
            <div class="hdz-panel-header-actions">
              <button v-if="chapters.length > 0" class="hdz-btn hdz-btn-ghost hdz-btn-xs" @click="continueWriting">✏️ 续写</button>
              <button class="hdz-btn hdz-btn-ghost hdz-btn-xs" @click="generateOutline">🔄 生成全文大纲</button>
            </div>
          </div>
          <div v-if="chapters.length === 0" class="hdz-panel-empty">
            还没有章节，点击上方按钮或通过对话创建
          </div>
          <div v-else class="hdz-outline-list">
            <div v-for="(ch, idx) in chapters" :key="ch?.id || idx" class="hdz-outline-item" @click="ch?.id && toggleOutline(ch.id)">
              <div class="hdz-outline-no">第 {{ ch.chapterNo }} 章</div>
              <div class="hdz-outline-info">
                <div class="hdz-outline-title">{{ cleanText(ch.title) || '未命名' }}</div>
                <div class="hdz-outline-status" :class="`hdz-ch-status--${ch.status}`">{{ chStatus(ch.status) }}</div>
              </div>
              <div class="hdz-outline-meta">
                <span v-if="ch.summary" class="hdz-outline-summary-icon">📖</span>
                {{ ch.wordCount || 0 }} 字
              </div>
            </div>
            <!-- 章节介绍（展开时显示） -->
            <div v-if="expandedChapters.has(ch?.id || ch?.chapterNo) && (ch?.summary || ch?.outline)" class="hdz-outline-detail">
              <div v-if="ch.summary" class="hdz-outline-summary">📖 介绍：{{ cleanText(ch.summary) }}</div>
              <div v-if="ch.outline && !ch.summary" class="hdz-outline-summary">📋 大纲：{{ cleanText(ch.outline) }}</div>
            </div>
          </div>
        </div>

        <!-- 手稿编辑器 -->
        <div v-if="tab === 'manuscript'" class="hdz-ws-panel">
          <div class="hdz-panel-header">
            <span>📝 手稿编辑器</span>
            <span style="flex:1"></span>
            <button class="hdz-btn hdz-btn-ghost hdz-btn-xs" @click="saveDraft" v-if="dirty">💾 保存</button>
            <button class="hdz-btn hdz-btn-sm" @click="submitAndReview" :disabled="savingReview">
              {{ savingReview ? '⏳ 提交中...' : '📤 保存并提交评审' }}
            </button>
          </div>
          <div v-if="chapters.length === 0" class="hdz-panel-empty">
            还没有内容，从对话写作或大纲开始
          </div>
          <div v-else class="hdz-manuscript">
            <div class="hdz-manuscript-nav">
              <select v-model="selectedChapter" class="hdz-input hdz-input-sm" @change="loadChapter">
                <option v-for="ch in chapters" :key="ch?.id || ch?.chapterNo" :value="ch?.id">
                  第 {{ ch.chapterNo }} 章 · {{ cleanText(ch.title) || '未命名' }}
                </option>
              </select>
            </div>
            <textarea
              v-model="editContent"
              class="hdz-manuscript-editor"
              placeholder="在此编辑章节内容..."
              @input="dirty = true"
            ></textarea>
          </div>
        </div>

        <!-- 📖 阅读器 + 横刀评审（左右布局） -->
        <div v-if="tab === 'reader'" class="hdz-reader-layout">
          <!-- 顶部章节选择器 -->
          <div class="hdz-reader-topbar">
            <div class="hdz-reader-chapter-selector">
              <span class="hdz-reader-selector-label">📖 选择章节：</span>
              <select class="hdz-input hdz-select" :value="readerChapterIndex" @change="goToChapter(Number(($event.target as HTMLSelectElement).value))">
                <option v-for="(ch, idx) in chapters" :key="ch.id" :value="idx">
                  第 {{ ch.chapterNo }} 章 · {{ cleanText(ch.title) || '未命名' }}
                </option>
              </select>
            </div>
            <div class="hdz-reader-topbar-actions">
              <button class="hdz-btn hdz-btn-ghost hdz-btn-xs" @click="toggleFontSize" :title="`字号: ${readerFontSize}px`">
                {{ readerFontSize === 16 ? '🔠 放大' : readerFontSize === 20 ? '🔡 缩小' : '🔠 标准' }}
              </button>
              <button class="hdz-btn hdz-btn-ghost hdz-btn-xs" @click="toggleReaderMode">
                {{ readerMode === 'scroll' ? '📄 滚动' : '📖 翻页' }}
              </button>
              <button class="hdz-btn hdz-btn-ghost hdz-btn-xs" @click="readerPlayAll" :disabled="readerTtsLoading" :title="readerTtsLoading ? '正在生成语音...' : '朗读全本'">
                {{ readerTtsLoading ? '⏳' : (readerTtsPlaying ? (readerAutoNext ? '🔊 全本播放中' : '🔊 播放中') : '🎵 朗读全本') }}
              </button>
              <button class="hdz-btn hdz-btn-ghost hdz-btn-xs" @click="readerExportAllAudio" :disabled="readerExportingAudio" title="导出所有章节为音频">
                {{ readerExportingAudio ? '⏳ 导出中...' : '📥 导出全本' }}
              </button>
              <button class="hdz-btn hdz-btn-ghost hdz-btn-xs" @click="readerCopyAllText" :disabled="readerCopying" :title="readerCopying ? '正在复制...' : '复制全文到剪贴板'">
                {{ readerCopying ? '⏳' : readerCopied ? '✅ 已复制' : '📋 复制全文' }}
              </button>
            </div>
          </div>

          <div class="hdz-reader-split">
            <!-- 左侧：阅读器 -->
            <div class="hdz-reader-main">
              <div v-if="chapters.length === 0" class="hdz-panel-empty">
                还没有章节内容，先完成写作再来阅读
              </div>
              <div v-else class="hdz-reader">
                <!-- 调试信息 -->
                <div style="font-size:0.7rem;color:#999;padding:4px 8px;background:#f8f8f8;border-radius:4px;margin-bottom:8px;">
                  📊 共 {{ chapters.length }} 章 · 当前第 {{ (currentReaderChapter?.chapterNo || '?') }} 章 · 内容 {{ (currentReaderContent || '').length }} 字
                </div>
                <!-- 翻页模式 -->
                <div v-if="readerMode === 'page'" class="hdz-reader-page-mode">
                  <div class="hdz-reader-page">
                    <div class="hdz-reader-chapter-title">{{ cleanText(currentReaderChapter?.title) || '' }}</div>
                    <div class="hdz-reader-content" :style="{ fontSize: readerFontSize + 'px', lineHeight: '2' }">{{ cleanText(currentReaderContent) }}</div>
                  </div>
                  <div class="hdz-reader-nav">
                    <button class="hdz-btn hdz-btn-ghost hdz-btn-sm" @click="prevChapter" :disabled="readerChapterIndex <= 0">← 上一章</button>
                    <span class="hdz-reader-progress">第 {{ currentReaderChapter?.chapterNo || 0 }} / {{ chapters.length }} 章</span>
                    <button class="hdz-btn hdz-btn-ghost hdz-btn-sm" @click="nextChapter" :disabled="readerChapterIndex >= chapters.length - 1">下一章 →</button>
                  </div>
                </div>
                <!-- 滚动模式 -->
                <div v-else class="hdz-reader-scroll-mode">
                  <div v-for="(ch, idx) in chapters" :key="ch?.id || idx" class="hdz-reader-scroll-chapter" :ref="(el: any) => { if (el) scrollChapterRefs[idx] = el }">
                    <div class="hdz-reader-chapter-title">{{ cleanText(ch.title) || `第 ${ch.chapterNo} 章` }}</div>
                    <div class="hdz-reader-chapter-actions">
                      <button class="hdz-reader-tts-btn" @click="readerPlayTtsContent(ch.content)" :title="'朗读本章'" :disabled="readerTtsLoading">
                        {{ readerTtsPlaying ? '🔊 播放中' : '🎵 朗读' }}
                      </button>
                      <button class="hdz-reader-tts-btn" @click="readerExportAudio(ch)" :title="'导出本章音频'" :disabled="readerTtsLoading || readerExportingAudio">
                        {{ readerExportingAudio ? '⏳ 生成中...' : '📥 导出音频' }}
                      </button>
                    </div>
                    <div class="hdz-reader-content" :style="{ fontSize: readerFontSize + 'px', lineHeight: '2' }">{{ cleanText(ch.content) }}</div>
                    <div class="hdz-reader-scroll-sep">— ✦ —</div>
                  </div>
                  <div class="hdz-reader-nav">
                    <button class="hdz-btn hdz-btn-ghost hdz-btn-sm" @click="scrollToChapter(readerChapterIndex - 1)" :disabled="readerChapterIndex <= 0">← 上一章</button>
                    <span class="hdz-reader-progress">第 {{ readerChapterIndex + 1 }} / {{ chapters.length }} 章</span>
                    <button class="hdz-btn hdz-btn-ghost hdz-btn-sm" @click="scrollToChapter(readerChapterIndex + 1)" :disabled="readerChapterIndex >= chapters.length - 1">下一章 →</button>
                  </div>
                </div>
              </div>
              <!-- 阅读器语音播放器 -->
              <audio ref="readerTtsAudioRef" style="display:none" />
            </div>

            <!-- 右侧：横刀评审 -->
            <div class="hdz-reader-side">
              <div class="hdz-review-panel">
                <template v-if="currentReview">
                  <div class="hdz-review-header">
                    <span class="hdz-review-title">🔍 横刀评审 · 第{{ currentReaderChapter?.chapterNo }}章</span>
                    <span class="hdz-review-score" :class="scoreClass(currentReview.score)">
                      {{ currentReview.score }}分
                    </span>
                    <span class="hdz-review-verdict" :class="verdictClass(currentReview.verdict)">
                      {{ currentReview.verdict }}
                    </span>
                  </div>

                  <div class="hdz-review-summary">{{ currentReview.summary || '评审完成' }}</div>

                  <!-- 评分明细 -->
                  <div class="hdz-review-detail">
                    <div class="hdz-review-detail-item">
                      <span class="hdz-review-detail-label">AI 味扣分</span>
                      <span class="hdz-review-detail-val" :class="currentReview.aiTaintPenalty < 0 ? 'hdz-review-negative' : ''">
                        {{ currentReview.aiTaintPenalty || 0 }}
                      </span>
                    </div>
                    <div class="hdz-review-detail-item">
                      <span class="hdz-review-detail-label">风格漂移扣分</span>
                      <span class="hdz-review-detail-val" :class="currentReview.styleDriftPenalty < 0 ? 'hdz-review-negative' : ''">
                        {{ currentReview.styleDriftPenalty || 0 }}
                      </span>
                    </div>
                    <div class="hdz-review-detail-item">
                      <span class="hdz-review-detail-label">逻辑扣分</span>
                      <span class="hdz-review-detail-val" :class="currentReview.logicPenalty < 0 ? 'hdz-review-negative' : ''">
                        {{ currentReview.logicPenalty || 0 }}
                      </span>
                    </div>
                    <div class="hdz-review-detail-item">
                      <span class="hdz-review-detail-label">质量加分</span>
                      <span class="hdz-review-detail-val hdz-review-positive">+{{ currentReview.qualityBonus || 0 }}</span>
                    </div>
                  </div>

                  <!-- 问题列表（从 LLM issues 解析） -->
                  <div v-if="currentReview.issues && currentReview.issues.length > 0" class="hdz-review-benchmark">
                    <div class="hdz-review-benchmark-title">📋 问题清单</div>
                    <div v-for="(issue, i) in currentReview.issues" :key="i" class="hdz-review-issue-item" :class="'hdz-review-issue--' + (issue.severity || 'minor')">
                      <span class="hdz-review-issue-tag">{{ {critical:'严重',major:'主要',minor:'轻微'}[issue.severity] || issue.severity }}</span>
                      <span class="hdz-review-issue-text">{{ issue.detail }}</span>
                    </div>
                  </div>
                  <!-- ↓ 评审结果下的操作按钮 -->
                  <div style="margin-top:16px;display:flex;gap:8px;flex-wrap:wrap;">
                    <button v-if="currentReview" class="hdz-btn hdz-btn-sm" @click="rewriteByReview" :disabled="rewriteSubmitting">
                      {{ rewriteSubmitting ? '⏳ 重写中...' : '✏️ 按评审意见重写' }}
                    </button>
                    <button class="hdz-btn hdz-btn-ghost hdz-btn-xs" @click="requestReview" :disabled="reviewRequesting">
                      {{ reviewRequesting ? '⏳ 重新评审...' : '🔄 重新评审' }}
                    </button>
                  </div>
                </template>
                <!-- 无审校结果时 -->
                <template v-else>
                  <div class="hdz-review-empty">
                    <p>📋 本章尚未评审</p>
                    <p class="hdz-review-empty-hint">完成「写正文」后 AI 会自动审校，或手动提交</p>
                    <button class="hdz-btn hdz-btn-ghost hdz-btn-xs" @click="requestReview" :disabled="reviewRequesting">
                      {{ reviewRequesting ? '⏳ 提交审校...' : '🔄 提交评审' }}
                    </button>
                  </div>
                </template>
              </div>
            </div>
          </div>
        </div>

      <!-- 回到顶部按钮 -->
      <button v-if="tab === 'reader'" class="hdz-scroll-top-btn" @click="readerScrollToTop" title="回到顶部">↑</button>

      <!-- 拒绝弹窗 -->
      <div v-if="showRejectDialog" class="hdz-overlay" @click.self="showRejectDialog = false">
        <div class="hdz-modal">
          <h2 class="hdz-modal-title">❌ 拒绝理由</h2>
          <div class="hdz-form">
            <div class="hdz-field">
              <label>请说明拒绝原因 <span style="color:#f05">*</span></label>
              <textarea v-model="rejectReason" class="hdz-input hdz-textarea" rows="4" placeholder="详细描述为什么拒绝这个输出..."></textarea>
            </div>
          </div>
          <div class="hdz-modal-actions">
            <button class="hdz-btn hdz-btn-ghost" @click="showRejectDialog = false">取消</button>
            <button class="hdz-btn hdz-btn-danger" @click="confirmReject" :disabled="!rejectReason.trim() || approvalLoading">
              {{ approvalLoading ? '⏳ 提交中...' : '❌ 确认拒绝' }}
            </button>
          </div>
        </div>
      </div>

      <!-- 修改弹窗 -->
      <div v-if="showModifyDialog" class="hdz-overlay" @click.self="showModifyDialog = false">
        <div class="hdz-modal hdz-modal--wide">
          <h2 class="hdz-modal-title">✏️ 修改输出内容</h2>
          <div class="hdz-form">
            <div class="hdz-field">
              <label>修改说明（可选）</label>
              <textarea v-model="modifyNote" class="hdz-input hdz-textarea" rows="2" placeholder="说明你做了哪些修改..."></textarea>
            </div>
            <div class="hdz-field">
              <label>修改后的内容 <span style="color:#f05">*</span></label>
              <textarea v-model="modifyContent" class="hdz-input hdz-textarea" rows="10" placeholder="在此编辑输出内容..."></textarea>
            </div>
          </div>
          <div class="hdz-modal-actions">
            <button class="hdz-btn hdz-btn-ghost" @click="showModifyDialog = false">取消</button>
            <button class="hdz-btn hdz-ap-btn-modify" @click="confirmModify" :disabled="!modifyContent.trim() || approvalLoading">
              {{ approvalLoading ? '⏳ 提交中...' : '✏️ 确认修改' }}
            </button>
          </div>
        </div>
      </div>


    <!-- 大模型设置弹窗 -->
    <DirectorModelSettingsModal :visible="showModelSettings" @close="showModelSettings = false" />
    <div v-if="showLocalModel" class="hdz-overlay" @click.self="showLocalModel = false">
      <div class="hdz-modal">
        <h2 class="hdz-modal-title">🖥️ 本地模型接入</h2>
        <div class="hdz-form">
          <div class="hdz-field">
            <label>Ollama 服务地址</label>
            <input v-model="localModelUrl" placeholder="http://localhost:11434" class="hdz-input" />
          </div>
          <div class="hdz-field">
            <label>模型名称</label>
            <input v-model="localModelName" placeholder="如 qwen2.5:7b" class="hdz-input" />
          </div>
          <p style="font-size:0.75rem;color:#888;line-height:1.6;">💡 先在服务器部署 Ollama，填入地址即可使用本地模型进行写作</p>
        </div>
        <div class="hdz-modal-actions">
          <button class="hdz-btn hdz-btn-ghost" @click="showLocalModel = false">取消</button>
          <button class="hdz-btn hdz-btn-primary" @click="showLocalModel = false">保存</button>
        </div>
      </div>
    </div>

    <!-- 添加/编辑角色弹窗 -->
    <div v-if="showCharacterModal" class="hdz-overlay" @click.self="showCharacterModal = false">
      <div class="hdz-modal hdz-modal--wide">
        <h2 class="hdz-modal-title">{{ charForm._editing ? '✏️ 编辑角色' : '👤 添加角色' }}</h2>
        <div class="hdz-form">
          <div class="hdz-field">
            <label>角色名称 <span style="color:#f05">*</span></label>
            <input v-model="charForm.name" placeholder="例如：林逸尘" class="hdz-input" />
          </div>
          <div class="hdz-field">
            <label>角色定位</label>
            <select v-model="charForm.role" class="hdz-input">
              <option value="protagonist">主角</option>
              <option value="antagonist">反派</option>
              <option value="supporting">配角</option>
              <option value="minor">龙套</option>
            </select>
          </div>
          <div class="hdz-field">
            <label>宗门/势力</label>
            <input v-model="charForm.faction" placeholder="所属宗门、势力、组织（可选）" class="hdz-input" />
          </div>
          <div class="hdz-field">
            <label>外貌描述</label>
            <textarea v-model="charForm.appearance" class="hdz-input hdz-textarea" rows="2" placeholder="年龄、外貌特征、服装风格..."></textarea>
          </div>
          <div class="hdz-field">
            <label>性格特征</label>
            <textarea v-model="charForm.personality" class="hdz-input hdz-textarea" rows="2" placeholder="性格、口头禅、行为习惯..."></textarea>
          </div>
          <div class="hdz-field">
            <label>背景故事</label>
            <textarea v-model="charForm.backstory" class="hdz-input hdz-textarea" rows="3" placeholder="身世来历、动机目标..."></textarea>
          </div>
          <div class="hdz-field">
            <label>技能/能力</label>
            <textarea v-model="charForm.skills" class="hdz-input hdz-textarea" rows="2" placeholder="武功、法术、特殊能力、手段..."></textarea>
          </div>
          <div class="hdz-field">
            <label>成长曲线</label>
            <textarea v-model="charForm.growthArc" class="hdz-input hdz-textarea" rows="2" placeholder="角色从开局到结局的成长变化..."></textarea>
          </div>
        </div>
        <div class="hdz-modal-actions">
          <button class="hdz-btn hdz-btn-ghost" @click="showCharacterModal = false">取消</button>
          <button class="hdz-btn hdz-btn-primary" @click="saveCharacter" :disabled="!charForm.name.trim()">
            {{ charForm._editing ? '保存修改' : '保存角色' }}
          </button>
          <button v-if="charForm._editing" class="hdz-btn hdz-btn-danger" @click="deleteCharEditing">删除角色</button>
        </div>
      </div>
    </div>

    <!-- 创建组织 -->
    <div v-if="showCreateFaction" class="hdz-overlay" @click.self="showCreateFaction = false">
      <div class="hdz-modal">
        <h2 class="hdz-modal-title">🏛️ 创建组织</h2>
        <div class="hdz-form">
          <div class="hdz-field">
            <label>组织类型</label>
            <select v-model="factionForm.type" class="hdz-input">
              <option value="sect">🏔️ 宗门</option>
              <option value="kingdom">👑 国家/王朝</option>
              <option value="company">🏢 公司/企业</option>
              <option value="family">👪 家族</option>
              <option value="gang">⚔️ 帮派</option>
              <option value="military">🎖️ 军队</option>
              <option value="other">📌 其他</option>
            </select>
          </div>
          <div class="hdz-field">
            <label>名称 <span style="color:#f05">*</span></label>
            <input v-model="factionForm.name" :placeholder="namePlaceholder" class="hdz-input" />
          </div>
          <div class="hdz-field">
            <label>介绍</label>
            <textarea v-model="factionForm.description" class="hdz-input hdz-textarea" rows="3" :placeholder="descPlaceholder"></textarea>
          </div>
          <div class="hdz-field">
            <label>所在地</label>
            <input v-model="factionForm.location" placeholder="地理位置" class="hdz-input" />
          </div>
          <div class="hdz-field">
            <label>领导者</label>
            <input v-model="factionForm.leaderName" :placeholder="leaderPlaceholder" class="hdz-input" />
          </div>
        </div>
        <div class="hdz-modal-actions">
          <button class="hdz-btn hdz-btn-ghost" @click="showCreateFaction = false">取消</button>
          <button class="hdz-btn hdz-btn-primary" @click="saveFaction" :disabled="!factionForm.name.trim()">保存组织</button>
        </div>
      </div>
    </div>

    <!-- 审批弹窗 HITL -->
    <div v-if="showApprovalModal && selectedTask" class="hdz-overlay" @click.self="showApprovalModal = false">
      <div class="hdz-modal hdz-modal--wide" style="max-height:90vh;display:flex;flex-direction:column;">
        <div style="padding:20px 24px 0;flex-shrink:0;">
          <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:8px;">
            <h2 style="margin:0;font-size:1.1rem;">
              📋 {{ selectedTask.agentType === 'planner' ? '大纲规划' : selectedTask.agentType === 'writer' ? '正文写作' : '编辑审校' }} — 待审批
            </h2>
            <button class="hdz-ap-close" @click="showApprovalModal = false" style="background:none;border:none;font-size:1.2rem;cursor:pointer;color:#999;">✕</button>
          </div>
          <div style="display:flex;gap:12px;font-size:0.85rem;margin-bottom:8px;" v-if="selectedTask.agentType === 'writer' || selectedTask.agentType === 'reviewer'">
            <span>🔢 章节评分：<strong :style="{color: (chapterReviewScore ?? 0) >= 85 ? '#2e7d32' : '#c62828'}">{{ chapterReviewScore ?? '-' }}</strong> / 100</span>
            <span style="font-size:0.8rem;color:#888;" v-if="(chapterReviewScore ?? 0) < 85">低于85分建议重写</span>
          </div>
          <div style="display:flex;gap:12px;font-size:0.8rem;color:#888;margin-bottom:12px;">
            <span>📅 {{ formatTime(selectedTask.createdAt) }}</span>
            <span v-if="selectedTask.output?.message">📄 {{ selectedTask.output.message }}</span>
          </div>
        </div>

        <!-- 内容区（可滚动） -->
        <div style="flex:1;overflow-y:auto;padding:0 24px;">

          <!-- Planner 大纲详情 -->
          <div v-if="selectedTask.agentType === 'planner'" style="margin-bottom:16px;">
            <div v-if="selectedTask.output?.outline?.chapters" class="hdz-ap-chapters">
              <div v-for="(ch, idx) in selectedTask.output.outline.chapters" :key="idx" class="hdz-ap-chapter-item" style="padding:6px 0;border-bottom:1px solid rgba(0,0,0,0.04);">
                <span class="hdz-ap-chapter-no" style="font-weight:600;color:#6b5a9f;margin-right:8px;">{{ idx + 1 }}.</span>
                <span class="hdz-ap-chapter-title" style="font-weight:500;">{{ ch.title || '未命名' }}</span>
                <span v-if="ch.summary" class="hdz-ap-chapter-summary" style="display:block;font-size:0.75rem;color:#999;margin-top:2px;">{{ ch.summary }}</span>
              </div>
            </div>
            <div v-else-if="selectedTask.output?.chapters" class="hdz-ap-chapters">
              <div v-for="(ch, idx) in selectedTask.output.chapters" :key="idx" class="hdz-ap-chapter-item" style="padding:6px 0;border-bottom:1px solid rgba(0,0,0,0.04);">
                <span class="hdz-ap-chapter-no" style="font-weight:600;color:#6b5a9f;margin-right:8px;">{{ ch.chapterNo || idx + 1 }}.</span>
                <span class="hdz-ap-chapter-title" style="font-weight:500;">{{ ch.title || '未命名' }}</span>
                <span v-if="ch.summary" class="hdz-ap-chapter-summary" style="display:block;font-size:0.75rem;color:#999;margin-top:2px;">{{ ch.summary }}</span>
              </div>
            </div>
            <div v-else style="color:#999;font-size:0.85rem;padding:20px 0;text-align:center;">大纲数据正在生成中...</div>
          </div>

          <!-- Writer 正文详情 -->
          <div v-if="selectedTask.agentType === 'writer'" style="margin-bottom:16px;">
            <div style="font-size:0.8rem;color:#888;margin-bottom:8px;">📝 字数：<strong>{{ writerContent.length }}</strong> 字</div>
            <div class="hdz-ap-writer-text" ref="writerTextRef">
              <div class="hdz-ap-writer-body" style="white-space:pre-wrap;line-height:1.8;font-size:0.9rem;">{{ displayWriterContent }}</div>
              <button v-if="writerContent.length > 2000 && !showFullWriterContent" class="hdz-ap-expand-btn" @click="showFullWriterContent = true" style="margin-top:8px;">
                📖 展开全部（共 {{ writerContent.length }} 字）
              </button>
              <button v-if="showFullWriterContent && writerContent.length > 2000" class="hdz-ap-expand-btn" @click="showFullWriterContent = false" style="margin-top:8px;">
                📖 收起
              </button>
            </div>
          </div>

          <!-- Reviewer 审核报告详情 -->
          <div v-if="selectedTask.agentType === 'reviewer'" style="margin-bottom:16px;">
            <div style="display:flex;align-items:center;gap:12px;margin-bottom:12px;">
              <span style="font-size:1.2rem;font-weight:700;color:#333;">{{ reviewResult.score || '-' }}</span>
              <span style="font-size:0.85rem;padding:2px 8px;border-radius:4px;background:#e8f5e9;color:#2e7d32;" v-if="reviewResult.verdict">{{ reviewResult.verdict }}</span>
            </div>
            <div v-if="reviewResult.summary" style="background:rgba(0,0,0,0.02);padding:12px;border-radius:6px;font-size:0.85rem;line-height:1.6;color:#555;">
              {{ reviewResult.summary }}
            </div>
          </div>

          <!-- 审批表单 -->
          <div style="border-top:1px solid rgba(0,0,0,0.06);padding:16px 0;">
            <div class="hdz-field" style="margin-bottom:12px;">
              <label style="font-size:0.8rem;color:#888;display:block;margin-bottom:4px;">审批意见（可选）</label>
              <textarea v-model="rejectReason" class="hdz-input hdz-textarea" rows="2" placeholder="输入审批意见..." style="width:100%;"></textarea>
            </div>
            <div class="hdz-field" v-if="selectedTask.agentType === 'writer'">
              <label style="font-size:0.8rem;color:#888;display:block;margin-bottom:4px;">修改后内容（可选）</label>
              <textarea v-model="modifyContent" class="hdz-input hdz-textarea" rows="5" placeholder="直接在这里修改正文内容..." style="width:100%;"></textarea>
            </div>
          </div>
        </div>

        <!-- 底部操作按钮 -->
        <div style="padding:12px 24px 16px;border-top:1px solid rgba(0,0,0,0.06);display:flex;justify-content:flex-end;gap:8px;flex-shrink:0;">
          <button class="hdz-btn hdz-btn-danger" @click="showRejectDialog = true" :disabled="approvalLoading">❌ 拒绝</button>
          <button class="hdz-btn hdz-btn-ghost" @click="showModifyDialog = true" :disabled="approvalLoading">✏️ 修改后通过</button>
          <button class="hdz-btn hdz-btn-primary" @click="doApprove" :disabled="approvalLoading">{{ approvalLoading ? '⏳ 处理中...' : '✅ 通过' }}</button>
        </div>
      </div>
    </div>

        <!-- 角色设定 -->
        <div v-if="tab === 'characters'" class="hdz-ws-panel">
          <div class="hdz-panel-header">
            <span>👤 角色设定</span>
            <div class="hdz-panel-header-actions">
              <button class="hdz-btn hdz-btn-ghost hdz-btn-xs" @click="batchCreateFromChat">✨ 从文曲星创建</button>
              <button class="hdz-btn hdz-btn-ghost hdz-btn-xs" @click="showCharacterModal = true">+ 添加角色</button>
            </div>
          </div>
          <!-- 批量创建结果提示 -->
          <div v-if="batchCreateResult" class="hdz-batch-result" :class="batchCreateResult.success > 0 ? 'hdz-batch-result--ok' : 'hdz-batch-result--warn'">
            ✅ 成功创建 {{ batchCreateResult.success }} 个角色
            <template v-if="batchCreateResult.skipped > 0">，跳过 {{ batchCreateResult.skipped }} 个（已存在或无效）</template>
            <button class="hdz-batch-result-close" @click="batchCreateResult = null">✕</button>
          </div>
          <div v-if="characters.length === 0" class="hdz-panel-empty">还没有角色，添加或通过对话生成</div>
          <template v-else>
            <!-- 宗门标签栏 -->
            <div class="hdz-faction-tabs">
              <span class="hdz-faction-tab" :class="{ active: !activeFactionFilter }" @click="activeFactionFilter = ''">
                🏛️ 全部（{{ characters.length }}）
              </span>
              <span v-for="(count, name) in factionStats" :key="name"
                class="hdz-faction-tab"
                :class="{ active: activeFactionFilter === name }"
                @click="activeFactionFilter = name">
                🏛️ {{ name }}（{{ count }}）
              </span>
            </div>
            <div class="hdz-char-grid">
              <div v-for="c in filteredCharacters" :key="c?.id || c?.name" class="hdz-char-card">
              <div class="hdz-char-header">
                <div class="hdz-char-avatar">{{ roleAvatar(c.role) }}</div>
                <div class="hdz-char-info">
                  <div class="hdz-char-name">{{ c.name }}</div>
                  <span class="hdz-char-role-badge" :class="`hdz-char-role--${c.role}`">{{ roleLabel(c.role) }}</span>
                </div>
                <button class="hdz-char-edit-btn" @click.stop="openCharEdit(c)" title="编辑角色">✏️</button>
                <button class="hdz-char-delete-btn" @click.stop="deleteCharacter(c)" title="删除角色">🗑️</button>
                <button class="hdz-char-expand-btn" @click.stop="toggleCharExpand(c.id || c.name)">
                  {{ expandedChars.has(c.id || c.name) ? '▲' : '▼' }}
                </button>
              </div>
              <div v-if="c.properties" class="hdz-char-preview">
                <span v-if="getProp(c, 'faction')" class="hdz-char-preview-faction">🏛️ {{ getProp(c, 'faction') }}</span>
              </div>
              <!-- 展开详情 -->
              <div v-if="expandedChars.has(c.id || c.name)" class="hdz-char-detail">
                <div v-if="getProp(c, 'faction')" class="hdz-char-field">
                  <span class="hdz-char-field-label">🏛️ 宗门/势力</span>
                  <span class="hdz-char-field-val">{{ getProp(c, 'faction') }}</span>
                </div>
                <div v-if="getProp(c, 'appearance')" class="hdz-char-field">
                  <span class="hdz-char-field-label">🎭 外貌特征</span>
                  <span class="hdz-char-field-val">{{ getProp(c, 'appearance') }}</span>
                </div>
                <div v-if="getProp(c, 'personality')" class="hdz-char-field">
                  <span class="hdz-char-field-label">🧠 性格特征</span>
                  <span class="hdz-char-field-val">{{ getProp(c, 'personality') }}</span>
                </div>
                <div v-if="getProp(c, 'backstory')" class="hdz-char-field">
                  <span class="hdz-char-field-label">📜 身世背景</span>
                  <span class="hdz-char-field-val">{{ getProp(c, 'backstory') }}</span>
                </div>
                <div v-if="getProp(c, 'skills')" class="hdz-char-field">
                  <span class="hdz-char-field-label">⚔️ 技能/能力</span>
                  <span class="hdz-char-field-val">{{ getProp(c, 'skills') }}</span>
                </div>
                <div v-if="getProp(c, 'growthArc')" class="hdz-char-field">
                  <span class="hdz-char-field-label">📈 成长曲线</span>
                  <span class="hdz-char-field-val">{{ getProp(c, 'growthArc') }}</span>
                </div>
                <!-- 关系网 -->
                <div v-if="c.relations && c.relations.length > 0" class="hdz-char-field">
                  <span class="hdz-char-field-label">🔗 关系网</span>
                  <div class="hdz-char-relations">
                    <div v-for="(rel, ri) in c.relations" :key="ri" class="hdz-char-relation-item" @click="navigateToChar(rel.target)">
                      <span class="hdz-char-rel-target">{{ rel.target }}</span>
                      <span class="hdz-char-rel-type">{{ rel.type }}</span>
                      <span v-if="rel.description" class="hdz-char-rel-desc">{{ rel.description }}</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
          </template>
        </div>

        <!-- 组织设定 -->
        <div v-if="tab === 'factions'" class="hdz-ws-panel">
          <div class="hdz-panel-header">
            <span>🏛️ 组织设定</span>
            <div class="hdz-panel-header-actions">
              <button class="hdz-btn hdz-btn-ghost hdz-btn-xs" @click="batchCreateFactions">✨ 从文曲星创建</button>
              <button class="hdz-btn hdz-btn-ghost hdz-btn-xs" @click="showCreateFaction = true">+ 添加组织</button>
            </div>
          </div>
          <!-- 批量创建结果提示 -->
          <div v-if="batchFactionResult" class="hdz-batch-result" :class="batchFactionResult.success > 0 ? 'hdz-batch-result--ok' : 'hdz-batch-result--warn'">
            ✅ 成功创建 {{ batchFactionResult.success }} 个组织
            <template v-if="batchFactionResult.skipped > 0">，跳过 {{ batchFactionResult.skipped }} 个（已存在或无效）</template>
            <button class="hdz-batch-result-close" @click="batchFactionResult = null">✕</button>
          </div>
          <div v-if="factions.length === 0" class="hdz-panel-empty">还没有组织，添加或通过对话生成</div>
          <div v-else class="hdz-faction-grid">
            <div v-for="f in factions" :key="f?.id || f?.name" class="hdz-faction-card">
              <div class="hdz-faction-header" @click="toggleFactionExpand(f.id || f.name)">
                <div class="hdz-faction-icon">{{ factionTypeIcon(f.type) }}</div>
                <div class="hdz-faction-info">
                  <div class="hdz-faction-name">{{ f.name }}</div>
                  <span class="hdz-faction-type-badge">{{ factionTypeLabel(f.type) }}</span>
                </div>
                <button class="hdz-faction-expand-btn">
                  {{ expandedFactions.has(f.id || f.name) ? '▲' : '▼' }}
                </button>
              </div>
              <!-- 展开详情 -->
              <div v-if="expandedFactions.has(f.id || f.name)" class="hdz-faction-detail">
                <div v-if="f.description" class="hdz-faction-field">
                  <span class="hdz-faction-field-label">📜 介绍</span>
                  <span class="hdz-faction-field-val">{{ f.description }}</span>
                </div>
                <div v-if="getFactionProp(f, 'scale')" class="hdz-faction-field">
                  <span class="hdz-faction-field-label">📏 规模</span>
                  <span class="hdz-faction-field-val">{{ getFactionProp(f, 'scale') }}</span>
                </div>
                <div v-if="getFactionProp(f, 'location')" class="hdz-faction-field">
                  <span class="hdz-faction-field-label">📍 所在地域</span>
                  <span class="hdz-faction-field-val">{{ getFactionProp(f, 'location') }}</span>
                </div>
                <div v-if="getFactionProp(f, 'culture')" class="hdz-faction-field">
                  <span class="hdz-faction-field-label">🎭 文化/风格</span>
                  <span class="hdz-faction-field-val">{{ getFactionProp(f, 'culture') }}</span>
                </div>
                <div v-if="getFactionProp(f, 'ranking')" class="hdz-faction-field">
                  <span class="hdz-faction-field-label">🏆 江湖排名</span>
                  <span class="hdz-faction-field-val">{{ getFactionProp(f, 'ranking') }}</span>
                </div>
                <div v-if="getFactionProp(f, 'era')" class="hdz-faction-field">
                  <span class="hdz-faction-field-label">⏳ 活跃时期</span>
                  <span class="hdz-faction-field-val">{{ getFactionProp(f, 'era') }}</span>
                </div>
                <!-- 领袖 -->
                <div v-if="f.leaderIds && f.leaderIds.length > 0" class="hdz-faction-field">
                  <span class="hdz-faction-field-label">👑 领袖</span>
                  <div class="hdz-faction-members">
                    <span v-for="lid in f.leaderIds" :key="lid" class="hdz-faction-member-tag hdz-faction-member--leader" @click="navigateToCharById(lid)">
                      {{ resolveCharName(lid) || '未知角色' }}
                    </span>
                  </div>
                </div>
                <!-- 重要成员 -->
                <div v-if="f.memberIds && f.memberIds.length > 0" class="hdz-faction-field">
                  <span class="hdz-faction-field-label">👥 成员</span>
                  <div class="hdz-faction-members">
                    <span v-for="mid in f.memberIds" :key="mid" class="hdz-faction-member-tag" @click="navigateToCharById(mid)">
                      {{ resolveCharName(mid) || '未知角色' }}
                    </span>
                  </div>
                </div>
                <!-- 如果 leaderNames/memberNames 存在但 leaderIds 为空（从文曲星创建尚未匹配到角色） -->
                <div v-if="(!f.leaderIds || f.leaderIds.length === 0) && getFactionProp(f, 'leaderName')" class="hdz-faction-field">
                  <span class="hdz-faction-field-label">👑 领袖名</span>
                  <span class="hdz-faction-field-val hdz-faction-field-val--name">{{ getFactionProp(f, 'leaderName') }}</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- 记忆库 -->
        <div v-if="tab === 'memory'" class="hdz-ws-panel">
          <div class="hdz-panel-header">
            <span>🧠 记忆库 · 7-Truths</span>
          </div>
          <div class="hdz-memory-grid">
            <div v-for="m in memoryTypes" :key="m.key" class="hdz-memory-card">
              <div class="hdz-memory-icon">{{ m.icon }}</div>
              <div class="hdz-memory-name">{{ m.label }}</div>
              <div class="hdz-memory-status" :class="memoryStatus(m.key) ? 'hdz-mem--ready' : 'hdz-mem--empty'">
                {{ memoryStatus(m.key) ? '✅ 已记录' : '⏳ 待生成' }}
              </div>
            </div>
          </div>
          <div class="hdz-memory-refresh">
            <button class="hdz-btn hdz-btn-ghost hdz-btn-xs" @click="refreshMemory">🔄 刷新记忆状态</button>
          </div>
        </div>

        <!-- 风格DNA -->
        <div v-if="tab === 'style'" class="hdz-ws-panel">
          <div class="hdz-panel-header">
            <span>🎨 大师风格</span>
            <span v-if="project?.masterStyle" class="hdz-style-locked-badge">🔒 已锁定</span>
          </div>

          <!-- 已选风格提示 -->
          <div v-if="project?.masterStyle" class="hdz-style-selected-info">
            <p>当前风格：<strong>{{ masterStyleLabel }}</strong></p>
            <p style="font-size:0.8rem;color:#888;margin-top:4px;">风格已锁定，写作全程AI将按此大师的文风创作</p>
          </div>

          <!-- 大师风格网格 -->
          <div class="hdz-master-grid" v-if="!project?.masterStyle || !projectLocks?.styleLocked">
            <div
              v-for="s in masterStyles"
              :key="s.id"
              class="hdz-master-card"
              :class="{ 'hdz-master--selected': project?.masterStyle === s.id }"
              @click="selectMasterStyle(s)"
            >
              <div class="hdz-master-name">{{ s.name }}</div>
              <div class="hdz-master-desc">{{ s.shortDesc }}</div>
              <div class="hdz-master-tags">
                <span v-for="tag in s.tags" :key="tag" class="hdz-master-tag">{{ tag }}</span>
              </div>
            </div>
          </div>
          <div v-else class="hdz-style-locked-msg">
            ✅ 已选定「{{ masterStyleLabel }}」，风格已锁定，不可更改
          </div>

          <div style="border-top:1px solid rgba(0,0,0,0.06);margin:20px 0;" />

          <!-- 原有的风格DNA上传区 -->
          <div class="hdz-style-area">
            <p class="hdz-style-hint">或上传一段你喜欢的文字，混沌珠将提取文风指纹作为补充参考</p>
            <textarea
              v-model="styleText"
              class="hdz-input hdz-textarea"
              rows="6"
              placeholder="粘贴参考文本..."
            ></textarea>
            <button class="hdz-btn hdz-btn-primary hdz-btn-sm" @click="saveStyleDna" :disabled="!styleText.trim()">
              提取风格DNA
            </button>
          </div>
        </div>

        <!-- 🎬 编剧 — 小说章节转剧本 -->
        <div v-if="tab === 'screenplay'" class="hdz-ws-panel hdz-screenplay-panel">
          <div class="hdz-screenplay-layout">
            <!-- 左栏：选章节 -->
            <div class="hdz-screenplay-left">
              <div class="hdz-panel-header">
                <span>📖 选择章节</span>
                <span class="hdz-panel-subtitle">{{ project?.title || '未命名' }}</span>
              </div>

              <div class="hdz-screenplay-chapter-list">
                <div
                  v-for="ch in chapters"
                  :key="ch.id"
                  class="hdz-screenplay-ch-item"
                  :class="{ 'hdz-screenplay-ch--selected': screenplaySelectedChapter?.id === ch.id }"
                  @click="selectScreenplayChapter(ch)"
                >
                  <span class="hdz-sc-ch-no">第{{ ch.chapterNo }}章</span>
                  <span class="hdz-sc-ch-title">{{ ch.title || '未命名' }}</span>
                  <span class="hdz-sc-ch-status" :class="'hdz-sc-status--' + (ch.status || 'outline')">{{ statusLabel(ch.status) }}</span>
                </div>
              </div>

              <div v-if="screenplaySelectedChapter" class="hdz-screenplay-preview">
                <div class="hdz-screenplay-preview-header">
                  <span>📄 第{{ screenplaySelectedChapter.chapterNo }}章 全文预览</span>
                  <span class="hdz-screenplay-wordcount">{{ (screenplaySelectedChapter.content || '').length }}字</span>
                </div>
                <div class="hdz-screenplay-preview-content">
                  <div class="hdz-screenplay-preview-scrollbox">{{ screenplaySelectedChapter.content || '（章节内容为空）' }}</div>
                </div>
              </div>

              <div class="hdz-screenplay-actions">
                <div class="hdz-screenplay-style-input">
                  <textarea
                    v-model="screenplayStyle"
                    placeholder="输入运镜偏好（如：多用特写和慢镜头、固定机位长镜头、手持摄影风格、多角度切）"
                    rows="2"
                  ></textarea>
                </div>
                <button
                  class="hdz-btn hdz-btn-primary"
                  :disabled="!screenplaySelectedChapter || screenwriting"
                  @click="submitScreenplay"
                >
                  {{ screenwriting ? '⏳ 转换中...' : '🎬 转为剧本' }}
                </button>
                <button
                  v-if="screenplayResult"
                  class="hdz-btn hdz-btn-ghost"
                  @click="clearScreenplayResult"
                >
                  🗑️ 清空结果
                </button>
              </div>
            </div>

            <!-- 右栏：显示剧本 -->
            <div class="hdz-screenplay-right">
              <template v-if="screenplayResult">
                <!-- 剧本章节下拉 -->
                <div class="hdz-screenplay-list">
                  <div
                    v-for="s in screenplayChapters"
                    :key="s.chapterNo"
                    class="hdz-screenplay-ch-item"
                    :class="{ 'hdz-screenplay-ch--selected': screenplayResult?.chapterNo === s.chapterNo }"
                    @click="switchScreenplay(s.chapterNo)"
                  >
                    <span class="hdz-sc-ch-no">第{{ s.chapterNo }}章</span>
                    <span class="hdz-sc-ch-title">{{ s.chapterTitle }}</span>
                    <span class="hdz-sc-ch-status" style="background:#e6f7ed;color:#389e0d;">✅ 已生成</span>
                  </div>
                </div>

                <div class="hdz-screenplay-toolbar">
                  <span class="hdz-screenplay-title">📜 剧本 · 第{{ screenplayResult.chapterNo }}章</span>
                  <div class="hdz-screenplay-toolbar-actions">
                    <button class="hdz-btn hdz-btn-ghost hdz-btn-xs" @click="copyScreenplay" title="复制全文">
                      {{ screenplayCopied ? '✅ 已复制' : '📋 复制' }}
                    </button>
                    <button class="hdz-btn hdz-btn-ghost hdz-btn-xs" @click="playScreenplayTts" :disabled="screenplayTtsLoading" title="朗读剧本">
                      {{ screenplayTtsLoading ? '⏳' : '🔊' }} 朗读
                    </button>
                    <button class="hdz-btn hdz-btn-ghost hdz-btn-xs" @click="exportScreenplayPdf" title="导出PDF">
                      📄 PDF
                    </button>
                  </div>
                </div>

                <div class="hdz-screenplay-content" ref="screenplayContentRef">
                  <div v-for="(scene, i) in screenplayResult.scenes" :key="i" class="hdz-scene-block">
                    <div class="hdz-scene-header">
                      <span class="hdz-scene-no">🎬 第 {{ scene.sceneNo }} 场</span>
                      <span class="hdz-scene-location">{{ scene.location }}</span>
                    </div>
                    <div v-if="scene.camera" class="hdz-scene-camera">
                      🎥 {{ scene.camera }}
                    </div>
                    <div v-if="scene.characters?.length" class="hdz-scene-characters">
                      👥 {{ scene.characters.join('、') }}
                    </div>
                    <div class="hdz-scene-content" style="white-space:pre-wrap;">{{ scene.content }}</div>
                  </div>
                </div>
              </template>

              <div v-else class="hdz-screenplay-empty">
                <span>🎬</span>
                <p>选择章节后点击「转为剧本」</p>
                <p class="hdz-screenplay-empty-hint">AI 将按标准拍摄剧本格式改编</p>
              </div>
            </div>
          </div>
        </div>

        <!-- 📚 图书馆管理员 -->
        <LibraryReaderPanel
          v-if="tab === 'librarian'"
          :lr-phase="lrPhase"
          :lr-phase-label="lrPhaseLabel"
          :lr-current-chapter-label="lrCurrentChapterLabel"
          :lr-current-chapter-no="lrCurrentChapterNo"
          :lr-current-chapter-title="lrCurrentChapterTitle"
          :lr-progress-percent="lrProgressPercent"
          :lr-done-chapters="lrDoneChapters"
          :lr-total-chapters="lrTotalChapters"
          :lr-pending-chapters="lrPendingChapters"
          :lr-enabled="lrEnabled"
          :lr-has-cache="lrHasCache"
          :lr-error="lrError"
          :lr-chapter-summaries="lrChapterSummaries"
          :lr-batch-summaries="lrBatchSummaries"
          :lr-selected-summary="lrSelectedSummary"
          :summary-detail-text="summaryDetailText"
          :summary-detail-loading="summaryDetailLoading"
          :lr-batch-tokens="lrBatchTokens"
          :batch-level-counts="batchLevelCounts"
          :format-number="formatNumber"
          :level-label="levelLabel"
          :level-emoji="levelEmoji"
          :level-color="levelColor"
          @toggle="onToggleLibraryReader"
          @activate="onActivateLibraryReader"
          @open-summary="onOpenSummary"
          @close-detail="lrSelectedSummary = null"
          @reset="onResetLibraryReader"
        />
      </main>
      <!-- 右侧建议栏 -->
      <aside class="hdz-ws-aside">
        <div class="hdz-aside-section">
          <div class="hdz-aside-title">AI 创作建议</div>
          <div class="hdz-aside-suggestions">
            <div v-for="(sug, i) in suggestions" :key="i" class="hdz-aside-suggestion">
              <span class="hdz-aside-sug-icon">{{ sug.icon }}</span>
              <span class="hdz-aside-sug-text">{{ sug.text }}</span>
            </div>
          </div>
        </div>

        <div class="hdz-aside-section">
          <div class="hdz-aside-title">作品统计</div>
          <div class="hdz-aside-stats">
            <div class="hdz-stat-item">
              <span class="hdz-stat-label">章节</span>
              <span class="hdz-stat-value">{{ chapterCount }}</span>
            </div>
            <div class="hdz-stat-item">
              <span class="hdz-stat-label">总字数</span>
              <span class="hdz-stat-value">{{ totalWordCount }}</span>
            </div>
            <div class="hdz-stat-item">
              <span class="hdz-stat-label">角色</span>
              <span class="hdz-stat-value">{{ characterCount }}</span>
            </div>
            <div class="hdz-stat-item">
              <span class="hdz-stat-label">完成度</span>
              <span class="hdz-stat-value">{{ wordProgress }}%</span>
            </div>
          </div>
          <!-- 进度条 -->
          <div class="hdz-aside-progress">
            <div class="hdz-aside-progress-bar">
              <div class="hdz-aside-progress-fill" :style="{ width: Math.min(wordProgress, 100) + '%' }"></div>
            </div>
          </div>
        </div>

        <div class="hdz-aside-section">
          <div class="hdz-aside-title">下一步操作</div>
          <div class="hdz-aside-next-steps">
            <button
              v-for="(step, i) in nextSteps"
              :key="i"
              class="hdz-aside-step-btn"
              @click="executeStep(step.action)"
            >
              {{ step.icon }} {{ step.label }}
            </button>
          </div>
        </div>

        <!-- 审批队列（右栏下方） -->
        <div class="hdz-aside-section hdz-ap-aside">
          <div class="hdz-aside-title">
            审批队列
            <span v-if="pendingApprovalCount > 0" class="hdz-aside-badge">{{ pendingApprovalCount }}</span>
          </div>
          <div class="hdz-ap-task-list" v-if="approvalTasks.length > 0">
            <div
              v-for="task in approvalTasks"
              :key="task.id"
              class="hdz-ap-task-item"
              @click="openApprovalDialog(task)"
            >
              <div>
                <strong>{{ agentTypeLabel(task.agentType) }}</strong>
                <span :class="`hdz-ap-status--${task.status}`">{{ statusLabel(task.status) }}</span>
              </div>
              <div class="hdz-ap-task-time">{{ formatTime(task.createdAt) }}</div>
              <div v-if="task.output?.message" class="hdz-ap-task-msg">{{ truncate(task.output.message, 60) }}</div>
            </div>
          </div>
          <div v-else class="hdz-ap-aside-empty">
            <template v-if="approvalLoading">⏳ 加载中...</template>
            <template v-else-if="approvalError">⚠️ {{ approvalError }}</template>
            <template v-else>✅ 暂无待审批</template>
          </div>
        </div>
      </aside>
    </div>
  </div>

  <!-- 隐藏文件选择器 -->
  <input ref="fileInputRef" type="file" accept=".txt,.docx" style="display:none" @change="onFileSelected" />

  <!-- 上传结果弹窗 -->
  <div v-if="showUploadModal" class="hdz-modal-overlay" @click.self="showUploadModal = false">
    <div class="hdz-modal" style="max-width: 500px;">
      <div class="hdz-modal-header">
        <span>{{ uploadResult ? '📂 导入成功' : '⚠️ 导入失败' }}</span>
        <button class="hdz-modal-close" @click="showUploadModal = false">✕</button>
      </div>
      <div class="hdz-modal-body">
        <template v-if="uploading">
          <p>{{ uploadProgress }}</p>
        </template>
        <template v-else-if="uploadError">
          <p style="color: var(--hdz-red);">{{ uploadError }}</p>
          <p style="color: var(--hdz-text-secondary); font-size: 13px; margin-top: 8px;">仅支持 .txt 和 .docx 格式，确保文件编码为 UTF-8。</p>
        </template>
        <template v-else-if="uploadResult">
          <div style="margin-bottom: 16px;">
            <p style="font-size: 16px; font-weight: 600; margin-bottom: 4px;">{{ uploadResult.projectTitle }}</p>
            <p style="color: var(--hdz-text-secondary); font-size: 13px;">
              共 <strong>{{ uploadResult.chapterCount }}</strong> 章 ·
              约 <strong>{{ uploadResult.totalWords.toLocaleString() }}</strong> 字
            </p>
          </div>
          <div style="max-height: 200px; overflow-y: auto; border: 1px solid var(--hdz-border); border-radius: 8px;">
            <div v-for="ch in uploadResult.chapters" :key="ch.id" style="padding: 6px 12px; border-bottom: 1px solid var(--hdz-border); font-size: 13px; display: flex; justify-content: space-between;">
              <span>第 {{ ch.chapterNo }} 章 · {{ ch.title }}</span>
              <span style="color: var(--hdz-text-secondary);">{{ ch.wordCount?.toLocaleString() }} 字</span>
            </div>
          </div>
        </template>
      </div>
      <div class="hdz-modal-footer">
        <button v-if="uploadError" class="hdz-btn hdz-btn-ghost" @click="showUploadModal = false">知道了</button>
        <template v-else-if="uploadResult">
          <button class="hdz-btn hdz-btn-ghost" @click="showUploadModal = false">继续编辑</button>
          <button class="hdz-btn hdz-btn-primary" @click="confirmImport">查看章节</button>
        </template>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { nextTick, onMounted } from 'vue'
const router = useRouter()
const route = useRoute()
const { $api } = useNuxtApp()

const projectId = computed(() => route.params.id as string)

const tab = ref('chat')
const project = ref<any>(null)
const projectLocks = computed(() => project.value?.locks || {})
const chapters = ref<any[]>([])
const characters = ref<any[]>([])
const factions = ref<any[]>([])
const memories = ref<any[]>([])
const messages = ref<{ role: string; content: string; _ttsLoading?: boolean; _ttsPlaying?: boolean }[]>([])
const chatInput = ref('')

// 输入框自动换行（QQ 风格）
function autoResizeChatInput(e: Event) {
  const el = e.target as HTMLTextAreaElement
  el.style.height = 'auto'
  const newH = Math.min(el.scrollHeight, 6 * parseFloat(getComputedStyle(el).lineHeight || '20'))
  el.style.height = Math.max(newH, 34) + 'px'
}

// 滚动聊天区域到底部（发消息后自动定位到最新内容）
function scrollChatBottom() {
  nextTick(() => {
    const el = chatRef.value
    if (!el) return
    el.scrollTop = el.scrollHeight
  })
}
const chatRef = ref<HTMLElement | null>(null)
const ttsAudioRef = ref<HTMLAudioElement | null>(null)
const ttsQueue = ref<{ idx: number; text: string } | null>(null)
const currentSessionId = ref<string | null>(null)
const chatSessions = ref<{ id: string; status: string; firstMsg: string; msgCount: number; updatedAt: string }[]>([])
const showSessionList = ref(false)

// ─── 文档上传 ──────────────────────────────────
const uploading = ref(false)
const uploadProgress = ref('')
const uploadResult = ref<{
  projectTitle: string
  chapterCount: number
  totalWords: number
  chapters: { id: string; chapterNo: number; title: string; wordCount: number }[]
} | null>(null)
const uploadError = ref('')
const showUploadModal = ref(false)
const fileInputRef = ref<HTMLInputElement | null>(null)

function triggerUpload() {
  fileInputRef.value?.click()
}

async function onFileSelected(e: Event) {
  const input = e.target as HTMLInputElement
  const file = input.files?.[0]
  if (!file) return

  const ext = file.name.split('.').pop()?.toLowerCase()
  if (ext !== 'txt' && ext !== 'docx') {
    uploadError.value = '仅支持 .txt 和 .docx 文件'
    showUploadModal.value = true
    return
  }

  uploading.value = true
  uploadProgress.value = `正在解析 ${file.name}...`
  uploadError.value = ''

  try {
    const form = new FormData()
    form.append('file', file)

    const token = (() => { try { return localStorage.getItem('auth_token') || '' } catch { return '' } })()
    const res = await $fetch(`/api/hdz/upload/${projectId.value}`, {
      method: 'POST',
      body: form,
      headers: token ? { 'Authorization': `Bearer ${token}` } : {},
    })

    uploadResult.value = res.data
    showUploadModal.value = true
    uploadProgress.value = ''

    // 刷新章节列表
    await loadChapters()
  } catch (err: any) {
    uploadError.value = err?.data?.error || err?.message || '上传失败'
    showUploadModal.value = true
  } finally {
    uploading.value = false
    uploadProgress.value = ''
    // 重置 file input，以便重复选择同一个文件
    input.value = ''
  }
}

async function confirmImport() {
  showUploadModal.value = false
  uploadResult.value = null
  uploadError.value = ''
  // 自动跳到手稿编辑或大纲管理
  tab.value = 'outline'
}

// 加载项目的对话历史 session 列表
async function loadChatSessions() {
  try {
    const res = await $api.get(`/api/hdz/chat/sessions?projectId=${projectId.value}`)
    chatSessions.value = res?.data?.data || []
  } catch {}
}

// 切换到某个历史 session
async function switchSession(sessionId: string) {
  try {
    const res = await $api.get(`/api/hdz/chat/sessions/${sessionId}`)
    const d = res?.data?.data
    if (d) {
      currentSessionId.value = d.id
      messages.value = (d.messages || []).map((m: any) => ({ role: m.role, content: m.content }))
      showSessionList.value = false
      scrollChatBottom()
    }
  } catch {}
}

// 新建对话
function newChatSession() {
  currentSessionId.value = null
  messages.value = []
  showSessionList.value = false
  chatInput.value = ''
}

// 加载最近一次活跃 session
async function loadLatestSession() {
  await loadChatSessions()
  if (chatSessions.value.length > 0) {
    await switchSession(chatSessions.value[0].id)
  }
}

async function playTts(msg: any, idx: number) {
  // 如果正在播放同一条，暂停
  if (msg._ttsPlaying) {
    ttsAudioRef.value?.pause()
    msg._ttsPlaying = false
    return
  }

  // 如果正在生成，不要重复触发
  if (msg._ttsLoading) return

  msg._ttsLoading = true
  try {
    // 清洗：去掉所有字面量反斜杠 n（兼容单\\n和双\\\\n）
    const ttsText = msg.content.replace(/\\\\n/g, '\n').replace(/\\n/g, '\n')
    const res = await $api.post('/api/hdz/tts', { text: ttsText }, { timeout: 300000 })
    const body = res?.data
    if (!body?.success || !body?.data?.url) {
      throw new Error(body?.error || 'TTS 生成失败')
    }
    msg._ttsLoading = false
    msg._ttsPlaying = true

    // 用 Audio 播放
    const audioUrl = body.data.url
    if (ttsAudioRef.value) {
      ttsAudioRef.value.src = audioUrl
      ttsAudioRef.value.play()
    }
  } catch (e: any) {
    msg._ttsLoading = false
    console.error('TTS 播放失败:', e)
  }
}

function onTtsEnded() {
  // 清理所有 _ttsPlaying 状态
  for (const m of messages.value) {
    if (m._ttsPlaying) m._ttsPlaying = false
  }
}

/** 提交评审 */
async function requestReview() {
  const ch = currentReaderChapter.value
  if (!ch?.id) return
  reviewRequesting.value = true
  try {
    const res: any = await $api.post('/api/hdz/agent/request-review', {
      projectId: projectId.value,
      chapterId: ch.id,
      chapterNo: ch.chapterNo,
    })
    // $api 返回 ApiResponse，res.data 是服务器响应体
    // 服务器响应: { success: true, data: { taskId } }
    // 所以 res.data.data = { taskId }
    if (res?.success && res?.data?.success) {
      const taskId = res.data.data?.taskId
      // 轮询直到审校完成（最多等 60 秒）
      const pollReview = async () => {
        for (let i = 0; i < 20; i++) {
          await new Promise(r => setTimeout(r, 3000))
          try {
            const rr: any = await $api.get(`/api/hdz/agent/review/${projectId.value}/${ch.chapterNo}`)
            // $api 返回 ApiResponse，rr.data 是服务器响应体
            // 服务器响应: { success: true, data: { reviewed, score, ... } }
            // 所以 rr.data.data = 评审数据
            const data = rr?.data?.data || null
            if (data?.reviewed) {
              currentReview.value = data
              reviewRequesting.value = false
              return
            }
          } catch {}
        }
        reviewRequesting.value = false
      }
      pollReview()
    } else {
      reviewRequesting.value = false
    }
  } catch {
    reviewRequesting.value = false
  }
}

/** 按评审意见重写当前章节 */
async function rewriteByReview() {
  const ch = currentReaderChapter.value
  if (!ch?.id || !currentReview.value) return

  // 拉一下最新评审数据（不阻拦重写，即使 ≥85 分用户也可以强制重写）
  try {
    const freshRes: any = await $api.get(`/api/hdz/agent/review/${projectId.value}/${ch.chapterNo}`)
    const freshData = freshRes?.data?.data || null
    if (freshData?.reviewed) currentReview.value = freshData
  } catch {}

  rewriteSubmitting.value = true
  messages.value.push({ role: 'assistant', content: `✏️ 正在按评审意见重写第 ${ch.chapterNo} 章「${ch.title || ''}」...` })
  try {
    const review = currentReview.value
    const reviewNotesText = [
      review.summary,
      review.aiTaintPenalty < 0 ? `AI味扣分：${review.aiTaintPenalty}` : '',
      review.styleDriftPenalty < 0 ? `风格漂移扣分：${review.styleDriftPenalty}` : '',
      review.logicPenalty < 0 ? `逻辑扣分：${review.logicPenalty}` : '',
      `质量加分：+${review.qualityBonus}`,
      review.benchmarkComparison?.gapDescription ? `差距分析：${review.benchmarkComparison.gapDescription}` : '',
    ].filter(Boolean).join('\n')
    
    const res: any = await $api.post('/api/hdz/agent/write', {
      projectId: projectId.value,
      chapterId: ch.id,
      chapterNo: ch.chapterNo,
      mode: 'rewrite',
      reviewNotes: reviewNotesText,
    })
    // 后端返回 { success: true, data: task }
    if (res?.success) {
      const taskId = res?.data?.data?.id
      const chapterId = ch.id
      const startTime = Date.now()
      const MAX_WAIT = 300_000
      let lastContent = editContent.value

      // 给用户一个明确的「已提交」反馈
      messages.value.push({ role: 'assistant', content: `⏳ 重写请求已提交（任务ID: ${taskId?.slice(0, 8) || 'N/A'}），正在等待 AI 生成，请稍候...` })

      const poll = async (): Promise<void> => {
        const elapsed = Date.now() - startTime
        if (elapsed > MAX_WAIT) {
          rewriteSubmitting.value = false
          messages.value.push({ role: 'assistant', content: `⏰ 等待超时，请手动刷新页面查看结果` })
          return
        }
        // 1. 先查 task 状态 — writer 是否完成
        if (taskId) {
          try {
            const tasksRes: any = await $api.get(`/api/hdz/agent/tasks/${projectId.value}`)
            const tasks = tasksRes?.data?.data || []
            const writerTask = tasks.find((t: any) => t.id === taskId)
            if (writerTask && (writerTask.status === 'completed' || writerTask.status === 'failed')) {
              // writer 已完成后，检查 content 是否变化
              const r2: any = await $api.get(`/api/hdz/projects/${projectId.value}`)
              const d = r2?.data?.data
              if (d?.chapters) {
                chapters.value = d.chapters
                const updated = chapters.value.find((x: any) => x.id === chapterId)
                if (updated && updated.content && updated.content !== lastContent) {
                  editContent.value = updated.content || ''
                  messages.value.push({ role: 'assistant', content: `✅ 第 ${updated.chapterNo} 章重写完成` })
                  rewriteSubmitting.value = false
                  await loadProjectData()
                  // ★ 重写完成后等待 auto-reviewer 完成，再拉评审结果（不是等固定 5 秒，而是轮询等待）
                  messages.value.push({ role: 'assistant', content: `⏳ 正在等待自动评审结果...` })
                  const reviewPollStart = Date.now()
                  const reviewPoll = async () => {
                    const elapsed = Date.now() - reviewPollStart
                    if (elapsed > 120_000) {
                      messages.value.push({ role: 'assistant', content: `⏰ 自动评审超时，请稍后手动刷新查看评分` })
                      return
                    }
                    try {
                      const rr: any = await $api.get(`/api/hdz/agent/review/${projectId.value}/${ch.chapterNo}`)
                      const rd = rr?.data?.data || null
                      if (rd?.reviewed) {
                        currentReview.value = rd
                        const score = rd.score ?? rd.totalScore ?? '?'
                        const passed = score >= 80
                        messages.value.push({
                          role: 'assistant',
                          content: passed
                            ? `✅ 自动评审完成 — 评分 ${score} 分，已通过！`
                            : `📋 自动评审完成 — 评分 ${score} 分（未达通过线 ${passScore ?? 80} 分）`
                        })
                        return
                      }
                    } catch {}
                    setTimeout(() => reviewPoll(), 3000)
                  }
                  reviewPoll()
                  return
                }
                lastContent = updated?.content || ''
              }
            }
          } catch {}
        }
        setTimeout(() => poll(), 3000)
      }

      poll()
    } else {
      rewriteSubmitting.value = false
      messages.value.push({ role: 'assistant', content: `⚠️ 提交重写请求失败` })
    }
  } catch {
    rewriteSubmitting.value = false
    messages.value.push({ role: 'assistant', content: `⚠️ 提交重写请求异常` })
  }
}

/** 阅读器朗读当前章节 */

/** 朗读全本：从当前章节开始，读完一章自动下一章 */
async function readerPlayAll() {
  // 如果正在播放 → 停止
  if (readerTtsPlaying.value) {
    readerTtsAudioRef.value?.pause()
    if (readerTtsAudioRef.value) readerTtsAudioRef.value.src = ''
    readerTtsPlaying.value = false
    readerAutoNext.value = false
    return
  }
  readerAutoNext.value = true
  readerPlayNextChapter()
}

/** 播完当前章后的回调：连播模式切下一章，单章模式停止 */
function readerOnChapterEnd() {
  if (readerAutoNext.value) {
    // 全本连播：切到下一章
    const next = readerChapterIndex.value + 1
    if (next < chapters.value.length) {
      readerChapterIndex.value = next
      readerPlayNextChapter()
      return
    }
  }
  readerTtsPlaying.value = false
  readerAutoNext.value = false
}

/** 播放当前 readerChapterIndex 指向的章节 */
async function readerPlayNextChapter() {
  const ch = chapters.value[readerChapterIndex.value]
  if (!ch?.content) {
    readerTtsPlaying.value = false
    readerAutoNext.value = false
    return
  }
  // 滚动模式同步位置
  if (readerMode.value === 'scroll') scrollToChapter(readerChapterIndex.value)

  readerTtsLoading.value = true
  try {
    let ttsText = ch.content.replace(/\\\\n/g, '\n').replace(/\\n/g, '\n')
    if (/<[a-z][^>]*>/i.test(ttsText)) {
      ttsText = ttsText.replace(/<[^>]+>/g, '').trim()
    }
    const res = await $api.post('/api/hdz/tts', { text: ttsText }, { timeout: 300000 })
    const body = res?.data
    if (!body?.success || !body?.data?.url) {
      throw new Error(body?.error || 'TTS 生成失败')
    }
    readerTtsLoading.value = false
    readerTtsPlaying.value = true
    if (readerTtsAudioRef.value) {
      readerTtsAudioRef.value.src = body.data.url
      readerTtsAudioRef.value.onended = readerOnChapterEnd
      readerTtsAudioRef.value.play().catch(e => {
        console.error('阅读器朗读：播放失败', e)
        readerTtsPlaying.value = false
        readerAutoNext.value = false
      })
    }
  } catch (e: any) {
    readerTtsLoading.value = false
    console.error('阅读器朗读失败:', e)
  }
}

/** 朗读单章（单章按钮调用，不自动连播） */
async function readerPlayTtsContent(content: string) {
  if (!content) {
    console.warn('阅读器朗读：内容为空')
    return
  }
  // 如果正在播放 → 点击停止
  if (readerTtsPlaying.value) {
    readerTtsAudioRef.value?.pause()
    if (readerTtsAudioRef.value) readerTtsAudioRef.value.src = ''
    readerTtsPlaying.value = false
    readerAutoNext.value = false
    return
  }
  // 单章模式不自动连播
  readerAutoNext.value = false

  readerTtsLoading.value = true
  try {
    let ttsText = content.replace(/\\\\n/g, '\n').replace(/\\n/g, '\n')
    if (/<[a-z][^>]*>/i.test(ttsText)) {
      ttsText = ttsText.replace(/<[^>]+>/g, '').trim()
    }
    const res = await $api.post('/api/hdz/tts', { text: ttsText }, { timeout: 300000 })
    const body = res?.data
    if (!body?.success || !body?.data?.url) {
      throw new Error(body?.error || (res?.error ? `HTTP ${res.status}: ${res.error}` : 'TTS 生成失败'))
    }
    readerTtsLoading.value = false
    readerTtsPlaying.value = true
    if (readerTtsAudioRef.value) {
      readerTtsAudioRef.value.src = body.data.url
      readerTtsAudioRef.value.onended = () => { readerTtsPlaying.value = false }
      readerTtsAudioRef.value.play().catch(e => {
        console.error('阅读器朗读：播放失败', e)
        readerTtsPlaying.value = false
      })
    }
  } catch (e: any) {
    readerTtsLoading.value = false
    console.error('阅读器朗读失败:', e)
  }
}

// 清洗消息内容：将字面量 \n 转成换行，再转成 HTML 段落
function cleanContent(text: string): string {
  if (!text) return ''
  // 先处理双反斜杠，再处理单反斜杠版本
  let clean = text.replace(/\\\\n/g, '\n').replace(/\\n/g, '\n')
  // 把换行转成 <br>（v-html 渲染）
  clean = clean.replace(/\n/g, '<br>')
  return clean
}

// 手稿
const selectedChapter = ref('')
const editContent = ref('')
const dirty = ref(false)

// 风格
const styleText = ref('')
const styleDnaDirty = ref(false)

// 十位文学大师风格模板
const masterStyles = [
  { id: 'wangzengqi', name: '汪曾祺', shortDesc: '白描极致，家常至味', desc: '用最浅、最淡、最短的白话写作，干净得像水洗过的玻璃。句子极简，拒绝修辞浮夸，在至淡中见至味。多用短句，少用形容词，追求「家常」而非「隆重」。', tags: ['白描', '极简', '淡而有味'], descFull: '用最浅、最淡、最短的白话，写食、草、木、人，干净得像水洗过的玻璃，却透着至味的暖意。追求「家常」而非「隆重」，拒绝一切修辞的浮夸，在极简中抵达精确。' },
  { id: 'laoshe', name: '老舍', shortDesc: '京味儿语言，活着的声音', desc: '句子像胡同里的风，流畅鲜活幽默。用短句和口语节奏写小人物，仿佛能听见角色的喘息和叹气。语言朴素悲悯，是「活着的声音」而非「写出的文字」。', tags: ['口语化', '幽默悲悯', '京味儿'], descFull: '他的句子就像胡同里的风，流畅、鲜活、幽默。用短句和口语的节奏写底层小人物，仿佛能听见那些角色的喘息和叹气。语言朴素却悲悯，是「活着的声音」而非「写出的文字」。' },
  { id: 'zhangailing', name: '张爱玲', shortDesc: '苍凉美学，通感大师', desc: '用刺目的颜色对比和具体意象写抽象心理，比喻奇峭又残酷。句子有旧小说的华丽底子，又有现代小说的冷峻疏离，苍凉中见精细。', tags: ['通感', '苍凉', '华丽冷峻'], descFull: '喜欢用刺目的颜色对比和具体意象（胡琴、月亮）来写抽象心理。比喻往往奇峭又残酷——「一袭华美的袍，爬满了虱子」。句子有旧小说的华丽底子，又有现代小说的冷峻与疏离。' },
  { id: 'chenzhongshi', name: '陈忠实', shortDesc: '史诗质感的关中叙事', desc: '文字扎根关中大地，厚重雄浑。句子像黄土一样沉实，没有花哨全是骨力。用「拟史诗」语调，把家族命运写成民族秘史。', tags: ['史诗', '厚重', '黄土质感'], descFull: '文字扎根关中大地，厚重雄浑，富有史诗气质。句子像黄土一样沉实，没有花哨，全是骨力。用「拟史诗」的语调，把宏大叙事写得沉稳从容。' },
  { id: 'jiapingwa', name: '贾平凹', shortDesc: '沉郁拙朴，大巧若拙', desc: '文风质朴沉郁，善用「生活流」叙事。有古文功底但不避方言土语，形成独特的「拙」味——大巧若拙，看似琐碎日常，实则暗流涌动。', tags: ['沉郁', '拙朴', '生活流'], descFull: '文风质朴、沉郁，善用「生活流」式的叙事——看似琐碎日常，实则暗流涌动。语言有古文功底，但又不避方言土语，形成一种独特的「拙」味，大巧若拙。' },
  { id: 'moyan', name: '莫言', shortDesc: '感官狂欢，汪洋恣肆', desc: '语言狂野奔放，如同高粱地里的风。魔幻现实主义笔法，民间传说与历史记忆熔于一炉，句子长时如大河奔涌，短时如刀劈斧凿。', tags: ['魔幻现实', '狂野', '感官丰富'], descFull: '语言狂野奔放，叙事如同高粱地里的风，呼啸而来，席卷一切。善用魔幻现实主义的笔法，将民间传说、历史记忆与感官体验熔于一炉，句子长时如大河奔涌，短时如刀劈斧凿。' },
  { id: 'yuhua', name: '余华', shortDesc: '零度写作，命运重击', desc: '以近乎冷酷的克制书写残酷。句子极短，用词极简，拒绝任何抒情——「零度写作」反而让悲伤像钝刀子割肉，一寸一寸疼进骨头。', tags: ['极简克制', '冷酷', '命运叙事'], descFull: '以一种近乎冷酷的克制来书写残酷。句子极短，用词极简，拒绝任何抒情——但这种「零度写作」反而让悲伤像钝刀子割肉，一寸一寸地疼进骨头里。' },
  { id: 'liuzhenyun', name: '刘震云', shortDesc: '废话里写透孤独', desc: '语言幽默荒诞，绕来绕去——表面是「废话文学」，实则是精准解构。句子像拧麻花，在循环往复中写透中国人「想说一句知心话」的百年孤独。', tags: ['荒诞', '幽默', '绕来绕去'], descFull: '语言幽默、荒诞、绕来绕去——表面是「废话文学」，实则是一种精准的解构。他的句子像拧麻花，一件事绕出另一件事，一句话引出另一句话，在循环往复中写透了中国人的孤独。' },
  { id: 'jinyucheng', name: '金宇澄', shortDesc: '沪语叙事，繁花似锦', desc: '用改良的沪语思维写普通话，句子极短段落极密，通篇白描对话。让方言拥有文学高度，叙事节奏像弄堂里的麻将声，细碎绵密意蕴悠长。', tags: ['方言文学', '白描', '细碎绵密'], descFull: '用改良的沪语思维写普通话，句子极短，段落极密，通篇是「鸳鸯蝴蝶派」式的白描对话。让一种方言拥有了文学的高度，叙事节奏像弄堂里的麻将声，细碎、绵密、意蕴悠长。' },
  { id: 'liuliangcheng', name: '刘亮程', shortDesc: '乡土哲学诗，万物有灵', desc: '文字像戈壁滩上的风，粗糙中有细腻，简单中蕴深邃。有散文诗的质感，在现实与超现实之间游走，用风声尘土梦境构建生死模糊的完整世界。', tags: ['哲学诗', '乡土', '超现实'], descFull: '文字像戈壁滩上的风，粗糙中有细腻，简单中蕴深邃。有散文诗的质感，善于在现实与超现实之间游走，用「风声、尘土、梦境、亡灵」构建一个生死界限模糊的完整世界。' },
]
const masterStyleLabel = computed(() => {
  const found = masterStyles.find(s => s.id === project.value?.masterStyle)
  return found ? found.name : '未选择'
})

const showCharacterModal = ref(false)
const charForm = ref({ name: '', role: 'supporting', faction: '', appearance: '', personality: '', backstory: '', skills: '', growthArc: '', _editing: false, _id: '' })
const showModelSettings = ref(false)
const showCreateFaction = ref(false)
const factionForm = ref({ name: '', type: 'sect', description: '', location: '', leaderName: '' })
const namePlaceholder = computed(() => {
  const m: Record<string, string> = { sect: '例如：凌霄剑宗', kingdom: '例如：大周皇朝', company: '例如：天工集团', family: '例如：慕容世家', gang: '例如：血煞帮', military: '例如：龙骑军', other: '组织名称' }
  return m[factionForm.value.type] || '组织名称'
})
const descPlaceholder = computed(() => {
  const m: Record<string, string> = { sect: '宗门的来历、地位、特色...', kingdom: '国家的历史、疆域、国策...', company: '公司的业务、规模、影响力...', family: '家族的传承、声望、族规...', gang: '帮派的势力范围、行事风格...', military: '军队的编制、战绩、军纪...', other: '组织的介绍...' }
  return m[factionForm.value.type] || '介绍...'
})
const leaderPlaceholder = computed(() => {
  const m: Record<string, string> = { sect: '宗主姓名', kingdom: '君主姓名', company: 'CEO姓名', family: '族长姓名', gang: '帮主姓名', military: '统帅姓名', other: '领导者姓名' }
  return m[factionForm.value.type] || '领导者姓名'
})
const expandedChapters = ref(new Set())
function toggleOutline(id: string) {
  const s = expandedChapters.value
  if (s.has(id)) s.delete(id); else s.add(id)
  // 触发响应式更新
  expandedChapters.value = new Set(s)
}
const showLocalModel = ref(false)
// 角色卡片展开状态
const expandedChars = ref(new Set())
const expandedFactions = ref(new Set())
// 批量创建结果提示
const batchCreateResult = ref<{ success: number; skipped: number } | null>(null)
const batchFactionResult = ref<{ success: number; skipped: number; total: number } | null>(null)

// 宗门标签筛选
const activeFactionFilter = ref<string>('')
const factionStats = computed(() => {
  const stats: Record<string, number> = {}
  for (const c of characters.value) {
    const f = getProp(c, 'faction')
    if (f) stats[f] = (stats[f] || 0) + 1
  }
  return stats
})
const filteredCharacters = computed(() => {
  if (!activeFactionFilter.value) return characters.value
  return characters.value.filter(c => getProp(c, 'faction') === activeFactionFilter.value)
})

// 角色辅助函数
function getProp(c: any, key: string): string {
  return c.properties?.[key] || ''
}
function roleLabel(role: string): string {
  const map: Record<string, string> = { protagonist: '主角', antagonist: '反派', supporting: '配角', minor: '龙套' }
  return map[role] || role
}
function roleAvatar(role: string): string {
  const map: Record<string, string> = { protagonist: '🌟', antagonist: '👿', supporting: '⭐', minor: '🔹' }
  return map[role] || '👤'
}
function toggleCharExpand(id: string) {
  const s = new Set(expandedChars.value)
  if (s.has(id)) s.delete(id); else s.add(id)
  expandedChars.value = s
}
function navigateToChar(name: string) {
  // 高亮同名角色卡片（如果有精确匹配则展开）
  const char = characters.value.find((c: any) => c.name === name)
  if (char) {
    const charId = char.id || char.name
    expandedChars.value = new Set([charId])
  }
}
function openCharEdit(c: any) {
  charForm.value = {
    _editing: true,
    _id: c.id || '',
    name: c.name || '',
    role: c.role || 'supporting',
    faction: c.properties?.faction || '',
    appearance: c.properties?.appearance || '',
    personality: c.properties?.personality || '',
    backstory: c.properties?.backstory || '',
    skills: c.properties?.skills || '',
    growthArc: c.properties?.growthArc || '',
  }
  showCharacterModal.value = true
}
async function deleteCharEditing() {
  if (!charForm.value._id) return
  if (!confirm(`确认删除角色「${charForm.value.name}」？`)) return
  try {
    await $api.delete(`/api/hdz/character/${projectId.value}/${charForm.value._id}`)
    showCharacterModal.value = false
    loadCharacters()
  } catch (e: any) {
    alert('删除失败: ' + (e.message || '未知错误'))
  }
}
async function deleteCharacter(c: any) {
  const charId = c?.id
  if (!charId) return
  if (!confirm(`确认删除角色「${c.name}」？此操作不可恢复。`)) return
  try {
    await $api.delete(`/api/hdz/character/${projectId.value}/${charId}`)
    // 从本地列表中移除，避免重载
    characters.value = characters.value.filter((ch: any) => ch.id !== charId && (ch.id || ch.name) !== charId)
  } catch (e: any) {
    alert('删除失败: ' + (e.message || '未知错误'))
  }
}
async function batchCreateFromChat() {
  // 查找最近的文曲星回复中的 CARD_DATA_START / CARD_DATA_END
  const lastAssistantMsgs = [...messages.value].reverse().filter(m => m.role === 'assistant')
  let parsedData: any = null
  for (const msg of lastAssistantMsgs) {
    const startMarker = '===CARD_DATA_START==='
    const endMarker = '===CARD_DATA_END==='
    const si = msg.content.indexOf(startMarker)
    if (si < 0) continue
    const jsonStart = si + startMarker.length
    const ei = msg.content.indexOf(endMarker)
    if (ei < 0) continue
    const jsonStr = msg.content.slice(jsonStart, ei).trim()
    try {
      parsedData = JSON.parse(jsonStr)
      if (parsedData?.batchCreate && Array.isArray(parsedData?.characters)) {
        break
      }
    } catch {
      continue
    }
  }

  if (!parsedData) {
    alert('未在对话中找到可创建的角色卡片数据。请先和文曲星聊角色设定，然后说"创建卡片"或"好了，建卡吧"。')
    return
  }

  try {
    const res: any = await $api.post(`/api/hdz/character/${projectId.value}/batch`, {
      characters: parsedData.characters,
    })
    const result = res?.data?.data
    if (result) {
      batchCreateResult.value = { success: result.created, skipped: result.skipped }
      loadCharacters()
      setTimeout(() => { batchCreateResult.value = null }, 5000)
    }
  } catch (e: any) {
    alert('批量创建失败: ' + (e.message || '未知错误'))
  }
}
const localModelUrl = ref('http://localhost:11434')
const localModelName = ref('qwen2.5:7b')
// 审批 HITL (旧版弹窗 - 保留兼容)
const showApprovalModal = ref(false)
const pendingTask = ref<any>(null)
const approvalNote = ref('')
const approvalModifiedOutput = ref('')

// 审批面板 (新版右侧抽屉)
const showApprovalPanel = ref(false)
const focusApproval = ref(false)
const approvalTasks = ref<any[]>([])
const selectedTask = ref<any>(null)
const approvalLoading = ref(false)
const approvalError = ref('')
const showRejectDialog = ref(false)
const showModifyDialog = ref(false)
const rejectReason = ref('')
const modifyNote = ref('')
const modifyContent = ref('')
const showHistory = ref(false)
const historyTasks = ref<any[]>([])
const showFullWriterContent = ref(false)
const writerTextRef = ref<HTMLElement | null>(null)
let approvalPollTimer: ReturnType<typeof setInterval> | null = null

const pendingApprovalCount = computed(() => approvalTasks.value.filter(t => t.status === 'waiting_approval').length)

const reviewResult = computed(() => {
  const task = selectedTask.value
  if (!task || task.agentType !== 'reviewer') return {}
  // Try to extract review data from different output formats
  const output = task.output || {}
  return output.review || output.assessment || output.result || output
})

const chapterReviewScore = computed(() => {
  const task = selectedTask.value
  if (!task) return null
  // 1) 如果是 Reviewer 任务，直接从 output 取
  if (task.agentType === 'reviewer') {
    const r = reviewResult.value
    return r?.score ?? null
  }
  // 2) 如果是 Writer 任务，从该章节的 reviewNotes 取（由 Writer 触发自动 Reviewer 后写入）
  if (task.agentType === 'writer') {
    const input = task.input || {}
    const chapterNo = input.chapterNo
    if (chapterNo) {
      const ch = chapters.value.find((x: any) => x.chapterNo === chapterNo)
      return ch?.reviewNotes?.score ?? null
    }
  }
  return null
})

const writerContent = computed(() => {
  const task = selectedTask.value
  if (!task || task.agentType !== 'writer') return ''
  const output = task.output || {}
  return output.content || output.text || output.body || output.message || ''
})

const displayWriterContent = computed(() => {
  const content = writerContent.value
  if (!showFullWriterContent.value && content.length > 2000) {
    return content.slice(0, 2000) + '...'
  }
  return content
})

function agentTypeLabel(type: string): string {
  const map: Record<string, string> = {
    planner: '📝 大纲规划师',
    writer: '✍️ 小说作家',
    reviewer: '🔍 编辑审校',
  }
  return map[type] || type || '未知'
}

function statusLabel(status: string): string {
  const map: Record<string, string> = {
    waiting_approval: '⏳ 待审批',
    approved: '✅ 已通过',
    rejected: '❌ 已拒绝',
    modified: '✏️ 已修改',
  }
  return map[status] || status || '未知'
}

function formatTime(t: string): string {
  if (!t) return ''
  try {
    const d = new Date(t)
    const now = new Date()
    const diff = now.getTime() - d.getTime()
    if (diff < 60000) return '刚刚'
    if (diff < 3600000) return `${Math.floor(diff / 60000)} 分钟前`
    if (diff < 86400000) return `${Math.floor(diff / 3600000)} 小时前`
    return d.toLocaleDateString('zh-CN', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
  } catch {
    return t
  }
}

function truncate(text: string, maxLen: number): string {
  if (!text || text.length <= maxLen) return text || ''
  return text.slice(0, maxLen) + '...'
}

function toggleApprovalPanel() {
  showApprovalPanel.value = !showApprovalPanel.value
  if (showApprovalPanel.value) {
    fetchApprovalTasks()
    startApprovalPolling()
  } else {
    stopApprovalPolling()
  }
}

function focusApprovalPanel() {
  focusApproval.value = true
  fetchApprovalTasks()
  startApprovalPolling()
  setTimeout(() => focusApproval.value = false, 2000)
}

function openApprovalDialog(task: any) {
  selectApprovalTask(task)
  showApprovalModal.value = true
}

function startApprovalPolling() {
  stopApprovalPolling()
  approvalPollTimer = setInterval(fetchApprovalTasks, 10000)
}

function stopApprovalPolling() {
  if (approvalPollTimer) {
    clearInterval(approvalPollTimer)
    approvalPollTimer = null
  }
}

async function fetchApprovalTasks() {
  // 如果 token 已过期（auth:expired 已触发），停止轮询
  if ((window as any).__hdzAuthExpired) {
    stopApprovalPolling()
    return
  }
  approvalLoading.value = true
  approvalError.value = ''
  try {
    const [latestRes, tasksRes] = await Promise.all([
      $api.get(`/api/hdz/agent/latest/${projectId.value}`).catch((e: any) => {
        // 401/403 = token 过期，停止轮询
        const status = e?.response?.status || e?.status
        if (status === 401 || status === 403) {
          ;(window as any).__hdzAuthExpired = true
          stopApprovalPolling()
          return { data: { data: null } }
        }
        approvalError.value = `latest接口: ${e?.message || '未知错误'}`
        return { data: { data: null } }
      }),
      $api.get(`/api/hdz/agent/tasks/${projectId.value}`).catch((e: any) => {
        const status = e?.response?.status || e?.status
        if (status === 401 || status === 403) {
          ;(window as any).__hdzAuthExpired = true
          stopApprovalPolling()
          return { data: { data: [] } }
        }
        approvalError.value = `tasks接口: ${e?.message || '未知错误'}`
        return { data: { data: [] } }
      }),
    ])
    const latestTask = latestRes?.data?.data
    const allTasks = tasksRes?.data?.data || []

    // Filter waiting_approval tasks
    approvalTasks.value = allTasks.filter((t: any) => t.status === 'waiting_approval')

    // History: approved/rejected/modified
    historyTasks.value = allTasks.filter((t: any) =>
      ['approved', 'rejected', 'modified'].includes(t.status)
    ).sort((a: any, b: any) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())

    // If there's a latest pending task and nothing selected, or the selected was processed, select the first
    if (approvalTasks.value.length > 0) {
      if (!selectedTask.value || !approvalTasks.value.some(t => t.id === selectedTask.value.id)) {
        selectApprovalTask(approvalTasks.value[0])
      }
    } else {
      selectedTask.value = null
    }
  } catch (e: any) {
    console.error('获取审批任务失败:', e)
    approvalError.value = e?.message || '未知错误'
  } finally {
    approvalLoading.value = false
  }
}

async function fetchReviewForTask(task: any) {
  if (task.agentType !== 'reviewer') return
  const chapterNo = task.chapterNo || task.context?.chapterNo
  if (!chapterNo) return
  try {
    const res: any = await $api.get(`/api/hdz/agent/review/${projectId.value}/${chapterNo}`)
    const reviewData = res?.data?.data
    if (reviewData) {
      task.output = task.output || {}
      task.output.review = reviewData
    }
  } catch {}
}

function selectApprovalTask(task: any) {
  selectedTask.value = task
  showFullWriterContent.value = false
  // Pre-fill modify content with current output
  if (task.agentType === 'writer') {
    const content = task.output?.content || task.output?.text || task.output?.body || task.output?.message || ''
    modifyContent.value = content
  } else {
    modifyContent.value = JSON.stringify(task.output || {}, null, 2)
  }
  modifyNote.value = ''
  // Fetch review data if reviewer
  if (task.agentType === 'reviewer') {
    fetchReviewForTask(task)
  }
}

async function doApprove() {
  if (!selectedTask.value || approvalLoading.value) return
  approvalLoading.value = true
  try {
    const res: any = await $api.post('/api/hdz/agent/approve', {
      taskId: selectedTask.value.id,
      action: 'approved',
    })
    if (res?.data?.success !== false) {
      // Remove from pending
      approvalTasks.value = approvalTasks.value.filter(t => t.id !== selectedTask.value.id)
      if (approvalTasks.value.length > 0) {
        selectApprovalTask(approvalTasks.value[0])
      } else {
        selectedTask.value = null
      }
      // Refresh chapters
      loadChapters()
      checkWritingTasks()
    }
  } catch (e: any) {
    console.error('审批失败:', e)
  } finally {
    approvalLoading.value = false
  }
}

function confirmReject() {
  if (!selectedTask.value || !rejectReason.value.trim() || approvalLoading.value) return
  submitReject()
}

async function submitReject() {
  if (!selectedTask.value || approvalLoading.value) return
  approvalLoading.value = true
  try {
    const res: any = await $api.post('/api/hdz/agent/approve', {
      taskId: selectedTask.value.id,
      action: 'rejected',
      note: rejectReason.value.trim(),
    })
    if (res?.data?.success !== false) {
      showRejectDialog.value = false
      rejectReason.value = ''
      approvalTasks.value = approvalTasks.value.filter(t => t.id !== selectedTask.value.id)
      if (approvalTasks.value.length > 0) {
        selectApprovalTask(approvalTasks.value[0])
      } else {
        selectedTask.value = null
      }
    }
  } catch (e: any) {
    console.error('拒绝失败:', e)
  } finally {
    approvalLoading.value = false
  }
}

function confirmModify() {
  if (!selectedTask.value || !modifyContent.value.trim() || approvalLoading.value) return
  submitModify()
}

async function submitModify() {
  if (!selectedTask.value || approvalLoading.value) return
  approvalLoading.value = true
  try {
    const res: any = await $api.post('/api/hdz/agent/approve', {
      taskId: selectedTask.value.id,
      action: 'modified',
      modifiedOutput: modifyContent.value.trim(),
      note: modifyNote.value.trim() || undefined,
    })
    if (res?.data?.success !== false) {
      showModifyDialog.value = false
      modifyNote.value = ''
      modifyContent.value = ''
      approvalTasks.value = approvalTasks.value.filter(t => t.id !== selectedTask.value.id)
      if (approvalTasks.value.length > 0) {
        selectApprovalTask(approvalTasks.value[0])
      } else {
        selectedTask.value = null
      }
      loadChapters()
      checkWritingTasks()
    }
  } catch (e: any) {
    console.error('修改提交失败:', e)
  } finally {
    approvalLoading.value = false
  }
}

// 会员数据
const memberTier = ref('free')
const memberCredits = ref(0)
const isVip = computed(() => {
  const t = memberTier.value.toLowerCase()
  return !['free', ''].includes(t)
})
const displayMemberName = computed(() => {
  const map: Record<string, string> = {
    free: '体验版', basic: '基础版', pro: '本地版', enterprise: '年卡',
  }
  return map[memberTier.value] || memberTier.value || '体验版'
})
async function fetchMembership() {
  try {
    const token = useAuthStore().getToken()
    if (!token) return
    const [planRes, meRes] = await Promise.all([
      fetch('/api/member/profile', { headers: { 'Authorization': `Bearer ${token}` } }),
      fetch('/api/auth/me', { headers: { 'Authorization': `Bearer ${token}` } }).catch(() => null),
    ])
    if (planRes.ok) {
      const data = await planRes.json()
      memberTier.value = data.memberTier || data.membership?.tier || 'free'
      memberCredits.value = data.credits ?? data.membership?.credits ?? 0
    } else if (meRes && meRes.ok) {
      const data = await meRes.json()
      const u = data.user || data
      memberTier.value = u.memberTier || u.membership?.tier || 'free'
      memberCredits.value = u.coins || u.membership?.credits || u.credits || 0
    }
  } catch {}
}

const memoryTypes = [
  { key: 'world_state', icon: '🌍', label: '世界状态' },
  { key: 'character_matrix', icon: '🔗', label: '角色矩阵' },
  { key: 'pending_hooks', icon: '🎣', label: '未闭合伏笔' },
  { key: 'chapter_summary', icon: '📜', label: '章节摘要' },
  { key: 'location_state', icon: '📍', label: '场景状态' },
  { key: 'pov_tracker', icon: '👁️', label: '视角追踪' },
  { key: 'timeline', icon: '⏳', label: '时间线' },
]

const chapterCount = computed(() => chapters.value.length)
const characterCount = computed(() => characters.value.length)
const totalWordCount = computed(() => chapters.value.reduce((s: number, c: any) => {
  // 只统计已写正文的章节（排除 outline 状态的章节，大纲的字数不算正文）
  if (c.status === 'outline' || !c.status) return s
  return s + (c.wordCount || 0)
}, 0))
const wordProgress = computed(() => {
  if (!project.value?.wordTarget) return 0
  return Math.round((totalWordCount.value / project.value.wordTarget) * 100)
})

// 清洗文本：移除章节标题和正文中的 # 和 * 符号
function cleanText(t: string): string {
  if (!t) return t
  return t
    .replace(/[#＊✳]/g, '')
    .replace(/\*\*/g, '')
    .replace(/\*/g, '')
    .replace(/^---+$/gm, '')
    .replace(/^#+\s*/gm, '')
}

function readerContentHtml(text: string): string {
  if (!text) return ''
  const cleaned = cleanText(text)
  // 按换行分割成段落，过滤空行
  const paragraphs = cleaned.split(/\n+/).filter((p: string) => p.trim())
  return paragraphs.map((p: string) => `<p>${p.trim()}</p>`).join('')
}

function chStatus(s: string) {
  const map: Record<string, string> = { outline: '大纲', draft: '草稿', reviewed: '已通过', waiting_approval: '待审批', final: '定稿' }
  return map[s] || s
}

function memoryStatus(key: string) {
  return memories.value.some(m => m.type === key)
}

async function loadProject() {
  try {
    console.time('loadProject')
    const res: any = await $api.get(`/api/hdz/projects/${projectId.value}`)
    const d = res?.data?.data
    if (!d) {
      document.body.innerHTML = '<div style="padding:40px;text-align:center;font-family:sans-serif"><h3>❌ 项目数据为空</h3><p style="color:#888;margin-top:8px">Token 可能已过期，<a href="javascript:location.reload()" style="color:#8a6de9">刷新页面</a>或重新登录</p></div>'
      return
    }
    project.value = d
    chapters.value = d.chapters || []
    characters.value = d.characters || []
    ;(window as any).__hdz_chapters = chapters.value
    ;(window as any).__hdz_project = d
    loadFactions()
    if (chapters.value.length > 0) {
      selectedChapter.value = chapters.value[0].id
      editContent.value = chapters.value[0].content || ''
    }
    loadLatestSession()
    console.timeEnd('loadProject')
    // 延迟 1.5s 强制刷新阅读器章节索引（解决 ssr:false 下 computed 偶尔不更新的问题）
    setTimeout(() => { readerChapterIndex.value = Math.max(0, readerChapterIndex.value || 0) }, 1500)
  } catch (e: any) {
    console.error('loadProject failed:', e)
    const status = e?.response?.status || e?.status
    const isAuthErr = status === 401 || status === 403
    if (isAuthErr) { (window as any).__hdzAuthExpired = true; stopApprovalPolling() }
    const msg = isAuthErr
      ? 'Token 已失效，请<a href="javascript:location.reload()" style="color:#8a6de9">刷新页面</a>或重新登录'
      : String(e?.message || e)
    document.body.innerHTML = `<div style="padding:40px;text-align:center;font-family:sans-serif"><h3>❌ 加载项目失败</h3><p style="color:#888;margin-top:8px">${msg}</p></div>`
  }
}

async function loadChapters() {
  try {
    const res: any = await $api.get(`/api/hdz/manuscript/${projectId.value}`)
    chapters.value = res?.data?.data || []
  } catch {}
}

// 别名：sendChat/generateOutline/continueWriting 中调用
function refreshChapters() { loadChapters(); checkWritingTasks() }
async function checkWritingTasks() {
  try {
    const res: any = await $api.get(`/api/hdz/agent/tasks/${projectId.value}`)
    const tasks: any[] = res?.data?.data || []
    hasWritingTask.value = tasks.some((t: any) =>
      t.agentType === "writer" && (t.status === "queued" || t.status === "running")
    )
  } catch {
    // 静默失败
  }
}


async function loadCharacters() {
  try {
    const res: any = await $api.get(`/api/hdz/projects/${projectId.value}`)
    characters.value = res?.data?.data?.characters || []
  } catch {}
}

async function loadFactions() {
  try {
    const res: any = await $api.get(`/api/hdz/faction/${projectId.value}`)
    factions.value = res?.data?.data || []
  } catch {}
}

// 组织卡片辅助函数
function factionTypeIcon(type: string): string {
  const map: Record<string, string> = { sect: '🏔️', kingdom: '👑', company: '🏢', family: '🏠', gang: '⚔️', military: '🎖️', other: '🏛️' }
  return map[type] || '🏛️'
}
function factionTypeLabel(type: string): string {
  const map: Record<string, string> = { sect: '宗门', kingdom: '国家/王朝', company: '公司/企业', family: '家族', gang: '帮派', military: '军队', other: '其他' }
  return map[type] || type || '其他'
}
function getFactionProp(f: any, key: string): string {
  return f.properties?.[key] || ''
}
function toggleFactionExpand(id: string) {
  const s = new Set(expandedFactions.value)
  if (s.has(id)) s.delete(id); else s.add(id)
  expandedFactions.value = s
}
function resolveCharName(charId: string): string {
  const c = characters.value.find((ch: any) => ch.id === charId)
  return c?.name || ''
}
function navigateToCharById(charId: string) {
  const c = characters.value.find((ch: any) => ch.id === charId)
  if (c) {
    tab.value = 'characters'
    expandedChars.value = new Set([c.id || c.name])
  }
}

// 自动检测 AI 回复中的卡片 JSON，直接保存到数据库（无需用户手动点击）
async function autoSaveCardsFromChat(content: string) {
  // 检测角色卡片
  try {
    const cardStart = '===CARD_DATA_START==='
    const cardEnd = '===CARD_DATA_END==='
    const si = content.indexOf(cardStart)
    if (si >= 0) {
      const jsonStart = si + cardStart.length
      const ei = content.indexOf(cardEnd)
      if (ei >= 0) {
        const jsonStr = content.slice(jsonStart, ei).trim()
        const data = JSON.parse(jsonStr)
        if (data?.batchCreate && Array.isArray(data?.characters) && data.characters.length > 0) {
          const res: any = await $api.post(`/api/hdz/character/${projectId.value}/batch`, {
            characters: data.characters,
          })
          const result = res?.data?.data
          if (result) {
            batchCreateResult.value = { success: result.created, skipped: result.skipped }
            loadCharacters()
          }
        }
      }
    }
  } catch {}

  // 检测组织卡片
  try {
    const factionStart = '===FACTION_DATA_START==='
    const factionEnd = '===FACTION_DATA_END==='
    const si = content.indexOf(factionStart)
    if (si >= 0) {
      const jsonStart = si + factionStart.length
      const ei = content.indexOf(factionEnd)
      if (ei >= 0) {
        const jsonStr = content.slice(jsonStart, ei).trim()
        const data = JSON.parse(jsonStr)
        if (data?.batchCreate && Array.isArray(data?.factions) && data.factions.length > 0) {
          const res: any = await $api.post(`/api/hdz/faction/${projectId.value}/batch`, {
            factions: data.factions,
          })
          const result = res?.data?.data
          if (result) {
            batchFactionResult.value = { success: result.created, skipped: result.skipped, total: result.total }
            loadFactions()
          }
        }
      }
    }
  } catch {}
}

async function batchCreateFactions() {
  // 反向遍历 messages，查找最近的 FACTION_DATA_START / FACTION_DATA_END
  const lastAssistantMsgs = [...messages.value].reverse().filter(m => m.role === 'assistant')
  let parsedData: any = null
  for (const msg of lastAssistantMsgs) {
    const startMarker = '===FACTION_DATA_START==='
    const endMarker = '===FACTION_DATA_END==='
    const si = msg.content.indexOf(startMarker)
    if (si < 0) continue
    const jsonStart = si + startMarker.length
    const ei = msg.content.indexOf(endMarker)
    if (ei < 0) continue
    const jsonStr = msg.content.slice(jsonStart, ei).trim()
    try {
      parsedData = JSON.parse(jsonStr)
      if (parsedData?.batchCreate && Array.isArray(parsedData?.factions) && parsedData.factions.length > 0) {
        break
      }
    } catch {
      continue
    }
  }

  if (!parsedData) {
    alert('未在对话中找到可创建的组织数据。请先和文曲星聊组织设定，然后说"创建组织"或"建宗门"。')
    return
  }

  try {
    const res: any = await $api.post(`/api/hdz/faction/${projectId.value}/batch`, {
      factions: parsedData.factions,
    })
    const result = res?.data?.data
    if (result) {
      batchFactionResult.value = { success: result.created, skipped: result.skipped, total: result.total }
      loadFactions()
      setTimeout(() => { batchFactionResult.value = null }, 5000)
    }
  } catch (e: any) {
    alert('批量创建组织失败: ' + (e.message || '未知错误'))
  }
}

// 右侧建议栏
const suggestions = computed(() => {
  const list: { icon: string; text: string }[] = []
  const hasChapters = chapters.value.length > 0
  const hasContent = chapters.value.some((c: any) => c.content && c.content.length > 200)
  const hasNoOutline = chapters.value.some((c: any) => !c.outline)
  const pendingReview = chapters.value.filter((c: any) => c.status === 'review')
  const hasCharacters = characters.value.length > 0

  if (!hasChapters) {
    list.push({ icon: '📝', text: '创建第一个章节开始写作' })
    list.push({ icon: '📋', text: '先规划好大纲再动笔' })
    list.push({ icon: '👤', text: '为主角设定一些独特属性' })
  } else {
    if (!hasContent) list.push({ icon: '✍️', text: '开始写第一章吧！从对话写作入手' })
    if (hasNoOutline) list.push({ icon: '📋', text: '为没有大纲的章节补充提纲' })
    if (pendingReview.length > 0) list.push({ icon: '✅', text: `有 ${pendingReview.length} 章待审核` })
    if (!hasCharacters) list.push({ icon: '👤', text: '添加角色信息让故事更鲜活' })
    if (hasContent && wordProgress.value < 20) list.push({ icon: '🚀', text: '初期多写，后期再精修' })
    if (wordProgress.value >= 80) list.push({ icon: '🎯', text: '接近目标字数，可以开始收尾了' })
    if (wordProgress.value >= 100) list.push({ icon: '🎉', text: '恭喜！目标字数已完成' })
  }

  return list.slice(0, 5)
})

const nextSteps = computed(() => {
  const steps: { icon: string; label: string; action: string }[] = []
  if (chapters.value.length === 0) {
    steps.push({ icon: '💬', label: '对话写作', action: 'tab:chat' })
    steps.push({ icon: '📋', label: '新增大纲', action: 'tab:outline' })
  } else {
    const noContent = chapters.value.some((c: any) => !c.content)
    if (noContent) steps.push({ icon: '✍️', label: '续写空缺章节', action: 'continueBlank' })
    steps.push({ icon: '📖', label: '预览全文', action: 'tab:reader' })
    if (wordProgress.value < 100) steps.push({ icon: '📝', label: '继续写作', action: 'tab:manuscript' })
    else steps.push({ icon: '🎉', label: '发布作品', action: 'publish' })
  }
  return steps
})

function executeStep(action: string) {
  if (action.startsWith('tab:')) {
    tab.value = action.replace('tab:', '') as any
  } else if (action === 'continueBlank') {
    tab.value = 'manuscript'
  } else if (action === 'publish') {
    // TODO: 发布弹窗
    alert('发布功能即将上线')
  }
}

async function refreshMemory() {
  try {
    const res: any = await $api.get(`/api/hdz/memory/${projectId.value}`)
    memories.value = res?.data?.data || []
  } catch {}
}

function loadChapter() {
  const ch = chapters.value.find((c: any) => c.id === selectedChapter.value)
  if (ch) {
    editContent.value = ch.content || ''
    dirty.value = false
  }
}

async function saveDraft() {
  if (!selectedChapter.value) return
  try {
    await $api.put(`/api/hdz/manuscript/${projectId.value}/${selectedChapter.value}`, { content: editContent.value })
    dirty.value = false
  } catch {}
}

async function saveCharacter() {
  if (!charForm.value.name.trim() || !projectId.value) return
  try {
    const isEdit = charForm.value._editing
    const payload: any = {
      name: charForm.value.name.trim(),
      role: charForm.value.role,
      faction: charForm.value.faction,
      appearance: charForm.value.appearance,
      personality: charForm.value.personality,
      backstory: charForm.value.backstory,
      skills: charForm.value.skills,
      growthArc: charForm.value.growthArc,
    }

    if (isEdit && charForm.value._id) {
      // PUT 更新
      await $api.put(`/api/hdz/character/${projectId.value}/${charForm.value._id}`, payload)
    } else {
      // POST 创建
      const res: any = await $api.post(`/api/hdz/character/${projectId.value}`, payload)
      if (!res?.data?.data?.id) throw new Error('创建失败')
    }

    charForm.value = { name: '', role: 'supporting', faction: '', appearance: '', personality: '', backstory: '', skills: '', growthArc: '', _editing: false, _id: '' }
    showCharacterModal.value = false
    loadCharacters()
  } catch (e: any) {
    alert('保存失败: ' + (e.message || '未知错误'))
  }
}

async function saveFaction() {
  if (!factionForm.value.name.trim() || !projectId.value) return
  const name = factionForm.value.name.trim()
  const type = factionForm.value.type
  const typeLabel: Record<string, string> = { sect: '宗门', kingdom: '国家', company: '公司', family: '家族', gang: '帮派', military: '军队', other: '组织' }
  try {
    const res: any = await $api.post(`/api/hdz/faction/${projectId.value}`, {
      name,
      type,
      description: factionForm.value.description,
      properties: { location: factionForm.value.location, leaderName: factionForm.value.leaderName },
    })
    if (res?.data?.data?.id) {
      factionForm.value = { name: '', type: 'sect', description: '', location: '', leaderName: '' }
      showCreateFaction.value = false
      // 把创建消息写入聊天
      messages.value.push({
        role: 'assistant',
        content: `🏛️ 已创建${typeLabel[type] || '组织'}「${name}」！文曲星已记录下来，之后写章节时我就知道有这个势力了。`,
      })
    }
  } catch {}
}

function useTemplate(text: string) {
  chatInput.value = text
  sendChat()
}

async function sendChat() {
  const text = chatInput.value.trim()
  if (!text) return
  messages.value.push({ role: 'user', content: text })
  chatInput.value = ''
  messages.value.push({ role: 'assistant', content: '🤖 正在思考...' })
  scrollChatBottom()
  try {
    const payload: any = { projectId: projectId.value, message: text }
    if (currentSessionId.value) payload.sessionId = currentSessionId.value
    // 使用长超时防止 LLM 响应慢导致超时
    const res = await $api.post('/api/hdz/chat/send', payload, { timeout: 180000 })
    const body = res?.data
    if (body?.success && body?.data?.response) {
      messages.value[messages.value.length - 1] = { role: 'assistant', content: body.data.response }
      scrollChatBottom()
      // 保存 sessionId（新会话第一次返回）
      if (body.data.sessionId) currentSessionId.value = body.data.sessionId
      // 自动检测并保存卡片数据（角色和组织）
      autoSaveCardsFromChat(body.data.response)
      // 对话可能触发了章节写入（如文曲星生成章节内容），刷新章节列表
      refreshChapters()
    } else {
      messages.value[messages.value.length - 1] = { role: 'assistant', content: `⚠️ ${body?.error || 'AI 暂无回复'}` }
    }
  } catch (e: any) {
    messages.value[messages.value.length - 1] = { role: 'assistant', content: `🤖 思考中...请稍候` }
    // 兜底：请求超时但后端可能已完成，轮询 session 数据
    if (currentSessionId.value) {
      let waited = 0
      const interval = setInterval(async () => {
        waited += 5000
        try {
          const sessRes = await $api.get(`/api/hdz/chat/sessions/${currentSessionId.value}`)
          const sess = sessRes?.data?.data
          if (sess?.messages?.length > 0) {
            const lastMsg = sess.messages[sess.messages.length - 1]
            if (lastMsg?.role === 'assistant' && lastMsg.content !== '🤖 正在思考...') {
              messages.value[messages.value.length - 1] = { role: 'assistant', content: lastMsg.content }
              scrollChatBottom()
              clearInterval(interval)
            }
          }
        } catch {}
        if (waited >= 180000) {
          messages.value[messages.value.length - 1] = { role: 'assistant', content: `❌ 请求超时，请刷新页面重试` }
          clearInterval(interval)
        }
      }, 5000)
    }
  }
}

async function generateOutline() {
  chatInput.value = ''
  messages.value.push({ role: 'assistant', content: '🤖 正在生成全文大纲...' })
  try {
    const res = await $api.post('/api/hdz/agent/generate', { projectId: projectId.value, mode: 'full' })
    const body = res?.data
    if (!body?.success) throw new Error(body?.error || '生成失败')
    messages.value.push({ role: 'assistant', content: `✅ 大纲生成任务已提交，请稍候查看章节列表...` })
    setTimeout(refreshChapters, 5000)
  } catch (e: any) {
    messages.value.push({ role: 'assistant', content: `❌ 大纲生成失败: ${e.message || '未知错误'}` })
  }
}

// 📋 基于当前对话上下文生成大纲
async function generateOutlineFromChat() {
  if (messages.value.length === 0) {
    messages.value.push({ role: 'assistant', content: '⚠️ 还没有对话内容，请先和文曲星聊一聊故事设定' })
    return
  }
  // 收集最近的对话内容作为上下文
  const chatContext = messages.value
    .filter(m => m.role !== 'assistant' || (!m.content.includes('正在思考') && !m.content.includes('🤖')))
    .slice(-20)
    .map(m => (m.role === 'user' ? '作者' : '文曲星') + '：' + m.content)
    .join('\n\n')

  chatInput.value = ''
  messages.value.push({ role: 'assistant', content: '🤖 正在基于对话内容生成故事大纲...' })
  scrollChatBottom()
  try {
    const res = await $api.post('/api/hdz/agent/generate', {
      projectId: projectId.value,
      mode: 'full',
      userInput: `请根据我们之前讨论的所有设定（角色、宗门、世界观、故事走向等）生成完整的故事大纲。以下是最近的对话记录供参考：\n\n${chatContext}`,
    })
    const body = res?.data
    if (!body?.success) throw new Error(body?.error || '生成失败')
    messages.value[messages.value.length - 1] = { role: 'assistant', content: `✅ 大纲生成任务已提交！文曲星已基于对话内容开始规划故事大纲，请切换到「📋 大纲管理」标签查看章节列表，稍等片刻后刷新。` }
    scrollChatBottom()
    setTimeout(refreshChapters, 5000)
  } catch (e: any) {
    messages.value[messages.value.length - 1] = { role: 'assistant', content: `❌ 大纲生成失败: ${e.message || '未知错误'}` }
  }
}

async function continueWriting() {
  chatInput.value = ''
  const lastChapter = chapters.value.length > 0 ? chapters.value[chapters.value.length - 1] : null
  const nextNo = lastChapter ? lastChapter.chapterNo + 1 : 1
  messages.value.push({ role: 'assistant', content: `📖 续写模式启动 — 从第 ${nextNo} 章开始，基于已有 ${chapters.value.length} 章剧情继续规划...` })
  try {
    const res = await $api.post('/api/hdz/agent/generate', { projectId: projectId.value, mode: 'full', userInput: `续写第 ${nextNo} 章起的后续章节大纲，保持已有故事线和人物关系连贯。已有${chapters.value.length}章章节摘要已提供。` })
    const body = res?.data
    if (!body?.success) throw new Error(body?.error || '续写失败')
    messages.value.push({ role: 'assistant', content: `✅ 续写任务已提交（Planner Agent 启动），请稍候查看新章节...` })
    setTimeout(refreshChapters, 5000)
  } catch (e: any) {
    messages.value.push({ role: 'assistant', content: `❌ 续写失败: ${e.message || '未知错误'}` })
  }
}

async function startWriting() {
  if (chapters.value.length === 0) {
    messages.value.push({ role: 'assistant', content: '⚠️ 还没有章节，请先生成大纲。点击「📋 生成大纲」按钮创建故事大纲，或跟文曲星说生成大纲。' })
    return
  }
  const firstOutline = chapters.value.find((c: any) => c.status === 'outline')
  if (!firstOutline) {
    messages.value.push({ role: 'assistant', content: '⚠️ 所有章节都已写作完成，可以点击「审核」按钮进行审校。' })
    return
  }
  const ch = firstOutline

  // ★ 打包文曲星对话作为写作指导意见
  const chatHistory = messages.value.map(m => `[${m.role === 'user' ? '用户' : '文曲星'}]\n${m.content}`).join('\n\n---\n\n')
  const writingGuideline = chatHistory
    ? `以下是用户与文曲星关于本故事的对话记录，请仔细阅读其中的设定讨论、修改意见和创作方向，将这些指导意见融入正文写作中：\n\n${chatHistory}`
    : ''

  messages.value.push({ role: 'assistant', content: `✍️ 开始写第 ${ch.chapterNo} 章「${ch.title || ''}」...` })
  try {
    const res: any = await $api.post('/api/hdz/agent/write', {
      projectId: projectId.value,
      chapterNo: ch.chapterNo,
      userInput: writingGuideline || undefined,
    })
    const body = res?.data
    if (!body?.success) throw new Error(body?.error || '写作失败')
    messages.value.push({ role: 'assistant', content: `✍️ 第 ${ch.chapterNo} 章的写作任务已提交！AI 正在创作中，写完后会显示在阅读器里等待审阅。` })
    hasWritingTask.value = true
    setTimeout(refreshChapters, 5000)
  } catch (e: any) {
    messages.value.push({ role: 'assistant', content: `❌ 写作失败: ${e.message || '未知错误'}` })
  }
}

async function cancelWriting() {
  cancellingWriting.value = true
  try {
    const res: any = await $api.post("/api/hdz/agent/cancel-writing", { projectId: projectId.value })
    const body = res?.data
    if (body?.success) {
      hasWritingTask.value = false
      messages.value.push({ role: "assistant", content: `⏸️ 写作任务已暂停（已取消 ${body.data?.cancelled || 0} 个任务）。` })
    } else {
      messages.value.push({ role: "assistant", content: `❌ 暂停失败: ${body?.error || "未知错误"}` })
    }
  } catch (e: any) {
    messages.value.push({ role: "assistant", content: `❌ 暂停失败: ${e.message || "网络错误"}` })
  } finally {
    cancellingWriting.value = false
  }
}

function goMemberCenter() {
  if (isVip.value) {
    router.push('/user/center')
  } else {
    router.push('/user/membership')
  }
}
function goModelSettings() { window.open('/director-os/aigc/models', '_blank') }
function goBack() { router.push('/hdz') }

function scoreClass(score: number) {
  if (score >= 80) return 'hdz-review-s--good'
  if (score >= 60) return 'hdz-review-s--mid'
  return 'hdz-review-s--bad'
}
function verdictClass(v: string) {
  if (v === '通过') return 'hdz-review-v--pass'
  if (v === '需修改') return 'hdz-review-v--fix'
  return 'hdz-review-v--fail'
}

async function toggleLock(key: string) {
  const current = project.value?.locks || {}
  const newVal = current[key] === false ? true : false
  try {
    const res: any = await $api.put(`/api/hdz/projects/${projectId.value}`, {
      locks: { ...current, [key]: newVal },
    })
    if (res?.data?.success !== false) {
      if (project.value) project.value.locks = { ...current, [key]: newVal }
    }
  } catch {}
}

// 阅读器
const readerChapterIndex = ref(0)
const readerFontSize = ref(16)
const readerMode = ref<'scroll' | 'page'>('scroll')
const readerTtsPlaying = ref(false)
const readerTtsLoading = ref(false)
const readerExportingAudio = ref(false)
const readerCopying = ref(false)
const readerCopied = ref(false)

/**
 * 导出单章音频
 */
async function readerExportAudio(ch: any) {
  if (!ch?.content) return
  readerExportingAudio.value = true
  try {
    let ttsText = ch.content.replace(/\\\\n/g, '\n').replace(/\\n/g, '\n')
    if (/<[a-z][^>]*>/i.test(ttsText)) {
      ttsText = ttsText.replace(/<[^>]+>/g, '').trim()
    }
    const res = await $api.post('/api/hdz/tts', { text: ttsText }, { timeout: 300000 })
    const body = res?.data
    if (!body?.success || !body?.data?.url) {
      throw new Error(body?.error || 'TTS 生成失败')
    }
    // 触发下载
    const a = document.createElement('a')
    a.href = body.data.url
    a.download = `第${ch.chapterNo}章_${ch.title || '未命名'}.mp3`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
  } catch (e: any) {
    console.error('导出音频失败:', e)
  } finally {
    readerExportingAudio.value = false
  }
}

/**
 * 导出全本音频（逐章生成并下载）
 */
async function readerExportAllAudio() {
  const validChapters = chapters.value.filter(c => c?.content)
  if (validChapters.length === 0) return
  readerExportingAudio.value = true
  try {
    // 逐章生成并自动下载
    for (let i = 0; i < validChapters.length; i++) {
      const ch = validChapters[i]
      let ttsText = ch.content.replace(/\\\\n/g, '\n').replace(/\\n/g, '\n')
      if (/<[a-z][^>]*>/i.test(ttsText)) {
        ttsText = ttsText.replace(/<[^>]+>/g, '').trim()
      }
      const res = await $api.post('/api/hdz/tts', { text: ttsText }, { timeout: 300000 })
      const body = res?.data
      if (!body?.success || !body?.data?.url) continue
      const a = document.createElement('a')
      a.href = body.data.url
      a.download = `${(i + 1).toString().padStart(2, '0')}_第${ch.chapterNo}章_${ch.title || '未命名'}.mp3`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      // 防止浏览器阻止批量下载，间隔 1 秒
      if (i < validChapters.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 1000))
      }
    }
  } catch (e: any) {
    console.error('全本导出音频失败:', e)
  } finally {
    readerExportingAudio.value = false
  }
}

/** 复制全文到剪贴板（含按钮反馈：加载态→成功提示→2秒恢复） */
async function readerCopyAllText() {
  const validChapters = chapters.value.filter((ch: any) => ch.content && ch.wordCount > 0)
  if (validChapters.length === 0) {
    messages.value.push({ role: 'assistant', content: '📋 还没有已写完成的章节可以复制' })
    return
  }

  readerCopying.value = true
  readerCopied.value = false

  const text = validChapters.map((ch: any) => {
    const title = ch.title ? `第${ch.chapterNo}章 ${ch.title}` : `第${ch.chapterNo}章`
    return `# ${title}\n\n${cleanText(ch.content || '')}`
  }).join('\n\n---\n\n')

  try {
    await navigator.clipboard.writeText(text)
    readerCopied.value = true
    messages.value.push({ role: 'assistant', content: `📋 已复制全部 ${validChapters.length} 章正文到剪贴板（共约 ${text.length} 字）` })
  } catch {
    // fallback: 创建 textarea 选中复制
    const ta = document.createElement('textarea')
    ta.value = text
    ta.style.position = 'fixed'
    ta.style.opacity = '0'
    document.body.appendChild(ta)
    ta.select()
    document.execCommand('copy')
    document.body.removeChild(ta)
    readerCopied.value = true
    messages.value.push({ role: 'assistant', content: `📋 已复制全部 ${validChapters.length} 章正文到剪贴板（共约 ${text.length} 字）` })
  } finally {
    readerCopying.value = false
    // 2 秒后恢复按钮原样
    setTimeout(() => { readerCopied.value = false }, 2000)
  }
}

const readerTtsAudioRef = ref<HTMLAudioElement | null>(null)
const readerAutoNext = ref(false)
const currentReview = ref<any>(null)
const reviewRequesting = ref(false)
const rewriteSubmitting = ref(false)
const hasWritingTask = ref(false)

// ─── 编剧 Agent ───
const screenwriting = ref(false)
const screenplaySelectedChapter = ref<any>(null)
const screenplayResult = ref<{ chapterNo: number; chapterTitle: string; scenes: any[]; raw: string } | null>(null)
const screenplayTtsLoading = ref(false)
const previewExpanded = ref(false)
const screenplayContentRef = ref<HTMLElement | null>(null)
/** 持久化剧本映射：chapterNo → 剧本结果 */
const screenplayMap = ref<Record<number, any>>({})
/** 剧本 taskId 映射：chapterNo → { taskId, chapterNo, chapterTitle } */
const screenplaySrcTasks = ref<Record<number, any>>({})

/** 从后端加载已持久化的剧本列表 */
async function loadScreenplays() {
  try {
    const res: any = await $api.get(`/api/hdz/agent/screenplay/${projectId.value}`)
    const tasks: any[] = res?.data?.data || []
    const map: Record<number, any> = {}
    const srcMap: Record<number, any> = {}
    for (const t of tasks) {
      const output = t.output as any
      if (output?.chapterNo && output?.scenes) {
        map[output.chapterNo] = { chapterNo: output.chapterNo, chapterTitle: output.chapterTitle, scenes: output.scenes, raw: output.raw }
        srcMap[output.chapterNo] = { taskId: t.id, chapterNo: output.chapterNo, chapterTitle: output.chapterTitle }
      }
    }
    screenplayMap.value = map
    screenplaySrcTasks.value = srcMap
    // 如果当前选中的章节有剧本，自动显示
    if (screenplaySelectedChapter.value && map[screenplaySelectedChapter.value.chapterNo]) {
      screenplayResult.value = map[screenplaySelectedChapter.value.chapterNo]
    }
  } catch {}
}

function selectScreenplayChapter(ch: any) {
  screenplaySelectedChapter.value = ch
  previewExpanded.value = false
  // 如果已有持久化剧本，直接显示
  if (screenplayMap.value[ch.chapterNo]) {
    screenplayResult.value = screenplayMap.value[ch.chapterNo]
  } else {
    screenplayResult.value = null
  }
}

async function submitScreenplay() {
  const ch = screenplaySelectedChapter.value
  if (!ch?.id) return
  screenwriting.value = true
  try {
    const res: any = await $api.post('/api/hdz/agent/screenplay', {
      projectId: projectId.value,
      chapterNos: [ch.chapterNo],
      cinematicStyle: screenplayStyle.value || undefined,
    })
    if ($api.unwrap(res)?.results?.length) {
      screenplayResult.value = $api.unwrap(res)?.results?.[0]
      // 加入持久化映射
      screenplayMap.value = { ...screenplayMap.value, [ch.chapterNo]: $api.unwrap(res)?.results?.[0] }
      if ($api.unwrap(res)?.taskIds?.[0]) {
        screenplayTasks.value = {
          ...screenplayTasks.value,
          [ch.chapterNo]: { taskId: $api.unwrap(res)!.taskIds[0], chapterNo: ch.chapterNo, chapterTitle: ch.title }
        }
      }
      messages.value.push({ role: 'assistant', content: `🎬 第 ${ch.chapterNo} 章「${ch.title || ''}」已转为剧本（${$api.unwrap(res)?.results?.[0]?.scenes?.length || 0} 场戏）` })
    } else {
      messages.value.push({ role: 'assistant', content: `⚠️ 剧本转换失败：${res?.data?.error || res?.error || '未知错误'}` })
    }
  } catch (err: any) {
    messages.value.push({ role: 'assistant', content: `⚠️ 剧本转换异常：${err.message}` })
  } finally {
    screenwriting.value = false
  }
}

function clearScreenplayResult() {
  screenplayResult.value = null
  screenplaySelectedChapter.value = null
}

const screenplayCopied = ref(false)
const screenplayStyle = ref('')

/** 已生成剧本的章节列表（按 chapterNo 排序） */
const screenplayChapters = computed(() => {
  return Object.values(screenplayMap.value)
    .filter(Boolean)
    .sort((a: any, b: any) => a.chapterNo - b.chapterNo)
})

/** 切换到指定章节的剧本 */
function switchScreenplay(chapterNo: number) {
  const hit = screenplayMap.value[chapterNo]
  if (hit) screenplayResult.value = hit
}

function copyScreenplay() {
  if (!screenplayResult.value) return
  const text = screenplayResult.value.raw || screenplayResult.value.scenes.map(s =>
    `【场号】${s.sceneNo}\n【场景】${s.location}\n【人物】${s.characters.join('、')}\n【内容】\n${s.content}`
  ).join('\n\n')
  navigator.clipboard.writeText(text).then(() => {
    screenplayCopied.value = true
    setTimeout(() => { screenplayCopied.value = false }, 1500)
  }).catch(() => {
    messages.value.push({ role: 'assistant', content: '⚠️ 复制失败，请手动选择复制' })
  })
}

async function exportScreenplayPdf() {
  const sp = screenplayResult.value
  if (!sp) return

  // 从 screenplayMap 找到对应 taskId
  let taskId: string | null = null
  for (const t of Object.values(screenplaySrcTasks || {})) {
    const t2 = t as any
    if (t2.chapterNo === sp.chapterNo) {
      taskId = t2.taskId
      break
    }
  }
  // 如果缓存中没有，用 chapterNo 下载（后端同时支持 taskId 和 chapterNo 两种查找方式）
  const qs = taskId ? '' : `?chapterNo=${sp.chapterNo}`
  const url = `/api/hdz/agent/screenplay/${projectId.value}/pdf/${taskId || 'by-chapter'}${qs}`
  try {
    // 直接用浏览器下载（后端已放行，无需 token）
    const a = document.createElement('a')
    a.href = url
    a.download = `第${sp.chapterNo}章_${sp.chapterTitle || '剧本'}.pdf`
    a.click()
    messages.value.push({ role: 'assistant', content: `📄 正在下载 PDF...` })
  } catch (err: any) {
    messages.value.push({ role: 'assistant', content: `⚠️ 导出失败：${err.message}` })
  }
}

async function playScreenplayTts() {
  if (!screenplayResult.value) return
  screenplayTtsLoading.value = true
  try {
    // 构造朗读文本：场景号 + 场景 + 内容
    const text = screenplayResult.value.scenes.map(s => {
      const locationPart = s.location ? `场景：${s.location}。` : ''
      const charPart = s.characters.length ? `人物：${s.characters.join('、')}。` : ''
      return `第${s.sceneNo}场。${locationPart}${charPart}${s.content}`
    }).join('。')
    const ttsRes: any = await $api.post('/api/hdz/tts', { text: text.slice(0, 2000) })
    const respData = ttsRes?.data // 后端返回的 { success, data: { url, ... } }
    const audioUrl = respData?.data?.url
    if (audioUrl) {
      const audio = new Audio(audioUrl)
      audio.play()
    } else {
      messages.value.push({ role: 'assistant', content: '⚠️ 语音生成失败' })
    }
  } catch {
    messages.value.push({ role: 'assistant', content: '⚠️ 语音生成异常' })
  } finally {
    screenplayTtsLoading.value = false
  }
}

onMounted(() => {
  checkWritingTasks()
  loadScreenplays()
})
const cancellingWriting = ref(false)
const scrollChapterRefs = ref<any[]>([])

const currentReaderChapter = computed(() => chapters.value[readerChapterIndex.value] || null)
const currentReaderContent = computed(() => currentReaderChapter.value?.content || '')

// 当当前阅读章节变化时，自动加载审核结果
watch(currentReaderChapter, async (ch) => {
  if (ch?.id && ch.status && ch.status !== 'outline') {
    try {
      const res: any = await $api.get(`/api/hdz/agent/review/${projectId.value}/${ch.chapterNo}`)
      const data = res?.data?.data || null
      currentReview.value = data?.reviewed ? data : null
    } catch { currentReview.value = null }
  } else {
    currentReview.value = null
  }
})

// 切到编剧 tab 时加载持久化剧本
watch(tab, (val) => {
  if (val === 'screenplay') {
    loadScreenplays()
  }
})

function nextChapter() {
  if (readerChapterIndex.value < chapters.value.length - 1) {
    readerChapterIndex.value++
    if (readerMode.value === 'scroll') scrollToChapter(readerChapterIndex.value)
  }
}
function prevChapter() {
  if (readerChapterIndex.value > 0) {
    readerChapterIndex.value--
    if (readerMode.value === 'scroll') scrollToChapter(readerChapterIndex.value)
  }
}
function goToChapter(idx: number) {
  if (idx >= 0 && idx < chapters.value.length) {
    readerChapterIndex.value = idx
    if (readerMode.value === 'scroll') scrollToChapter(idx)
  }
}
function readerScrollToTop() {
  const el = document.querySelector('.hdz-ws-main') || document.querySelector('.hdz-reader-layout')
  if (el) el.scrollTo({ top: 0, behavior: 'smooth' })
}
function scrollToChapter(idx: number) {
  if (idx < 0) idx = 0
  if (idx >= chapters.value.length) idx = chapters.value.length - 1
  readerChapterIndex.value = idx
  const el = scrollChapterRefs.value[idx]
  if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' })
}
function toggleFontSize() {
  const sizes = [14, 16, 18, 20, 22]
  const i = sizes.indexOf(readerFontSize.value)
  readerFontSize.value = sizes[(i + 1) % sizes.length]
}
function toggleReaderMode() {
  readerMode.value = readerMode.value === 'scroll' ? 'page' : 'scroll'
}

async function selectMasterStyle(s: any) {
  if (project.value?.masterStyle === s.id) return
  try {
    await $api.put(`/api/hdz/projects/${projectId.value}`, { masterStyle: s.id })
    project.value.masterStyle = s.id
  } catch (e: any) {
    console.error('设置大师风格失败:', e)
  }
}

async function saveStyleDna() {
  if (!styleText.value.trim()) return
  try {
    await $api.put(`/api/hdz/style-dna/${projectId.value}`, { sourceText: styleText.value })
    styleDnaDirty.value = false
  } catch {}
}

console.log('📖 混沌珠工作台已挂载, projectId:', projectId.value)
console.log('📖 当前阅读器 tab:', tab.value, '阅读模式:', readerMode.value, '章节数:', chapters.value?.length)
console.log('📖 token:', (document.cookie || 'no cookie'))
fetchMembership()
loadProject()
// _loadStatus() moved after const
refreshMemory()
// 3 秒后检查待审批任务（新面板）
setTimeout(() => fetchApprovalTasks(), 3000)
const savingReview = ref(false)

/** 保存当前章节并提交评审 */
async function submitAndReview() {
  if (!selectedChapter.value) return
  savingReview.value = true
  try {
    await $api.put(`/api/hdz/manuscript/${projectId.value}/${selectedChapter.value}`, { content: editContent.value })
    dirty.value = false
    const ch = chapters.value.find((x: any) => x.id === selectedChapter.value)
    if (ch) {
      const res: any = await $api.post("/api/hdz/agent/review", {
        projectId: projectId.value,
        chapterNo: ch.chapterNo,
      })
      if (res?.data?.success) {
        messages.value.push({ role: "assistant", content: `✅ 第 ${ch.chapterNo} 章已保存并提交评审，请稍候...` })
        setTimeout(async () => {
          await loadProject()
          savingReview.value = false
        }, 5000)
      } else {
        savingReview.value = false
      }
    } else {
      savingReview.value = false
    }
  } catch {
    savingReview.value = false
  }
}

/* ========== 图书馆管理员（独立 composable） ========== */
import { useLibraryReader } from '~/composables/useLibraryReader'

const {
  lrPhase, lrProgressPercent, lrPhaseLabel,
  lrCurrentChapterLabel, lrCurrentChapterNo, lrCurrentChapterTitle,
  lrDoneChapters, lrTotalChapters, lrPendingChapters,
  lrEnabled, lrHasCache, lrError,
  lrChapterSummaries, lrBatchSummaries, lrReadChars,
  lrSelectedSummary, summaryDetailText, summaryDetailLoading,
  lrBatchTokens, batchLevelCounts,
  formatNumber, levelLabel, levelIcon, levelEmoji, levelColor,
  loadLibraryReaderStatus: _loadStatus, toggleLibraryReader: cl, openSummary: ul, activateLibraryReader: hl,
  resetReaderData: resetReaderData,
} = useLibraryReader(() => project.value?.id)
_loadStatus()

/** 启用/禁用 */
async function onToggleLibraryReader() {
  tab.value = 'librarian'
  await cl()
}

/** 开始阅读 */
async function onActivateLibraryReader() {
  tab.value = 'librarian'
  await hl()
}

/** 点击摘要详情 */
async function onOpenSummary(item: any) {
  await ul(item)
}

/** 重新阅读（清缓存） */
async function onResetLibraryReader() {
  tab.value = 'librarian'
  await resetReaderData()
}

/* ========== 旧版兼容 ========== */
async function showLibraryReader() {
  tab.value = 'librarian'
  try {
    await _loadStatus()
  } catch (e) {
    console.error('[LibraryReader] _loadStatus 失败:', e)
  }
  if (lrEnabled.value) {
    onActivateLibraryReader()
  }
}
</script>

<style scoped>
.hdz-workspace { min-height: 100vh; background: #f5f0e8; color: #222; display: flex; flex-direction: column; }

/* Topbar */
.hdz-ws-topbar {
  position: fixed; top: 0; left: 0; right: 0; z-index: 100;
  height: 48px; display: flex; align-items: center; justify-content: space-between;
  padding: 0 20px;
  backdrop-filter: blur(16px); background: rgba(245,240,232,0.85);
  border-bottom: 1px solid rgba(0,0,0,0.08);
}
.hdz-ws-topbar-left { display: flex; align-items: center; gap: 10px; }
.hdz-ws-back { font-size: 0.8rem; color: #8b7355; text-decoration: none; }
.hdz-ws-back:hover { color: #6b5a40; }
.hdz-ws-sep { color: rgba(0,0,0,0.12); }
.hdz-ws-project-title { font-size: 0.9rem; font-weight: 600; color: #333; }
.hdz-ws-genre-tag { font-size: 0.65rem; padding: 1px 6px; border-radius: 3px; background: rgba(168,130,255,0.12); color: #7a5f9a; }
.hdz-ws-topbar-right { display: flex; gap: 14px; }
.hdz-ws-stat { font-size: 0.75rem; color: #888; }

/* Body */
.hdz-ws-body { display: flex; margin-top: 48px; flex: 1; overflow: hidden; }
.hdz-ws-body > main { overflow-y: auto; }

/* 右侧建议栏 */
.hdz-ws-aside {
  width: 220px; flex-shrink: 0;
  padding: 16px 12px;
  border-left: 1px solid rgba(0,0,0,0.06);
  background: rgba(0,0,0,0.01);
  overflow-y: auto;
  display: flex; flex-direction: column; gap: 20px;
}
.hdz-aside-section { }
.hdz-aside-title { font-size: 0.7rem; color: #999; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 10px; }
.hdz-aside-suggestions { display: flex; flex-direction: column; gap: 8px; }
.hdz-aside-suggestion {
  display: flex; align-items: flex-start; gap: 6px;
  padding: 8px 10px; border-radius: 6px;
  background: rgba(0,0,0,0.02);
  font-size: 0.75rem; line-height: 1.5;
  color: #888;
  transition: all 0.15s;
}
.hdz-aside-suggestion:hover { background: rgba(0,0,0,0.04); color: #444; }
.hdz-aside-sug-icon { flex-shrink: 0; font-size: 0.9rem; }
.hdz-aside-sug-text { }
.hdz-aside-stats { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }
.hdz-stat-item {
  display: flex; flex-direction: column; gap: 2px;
  padding: 8px; border-radius: 6px;
  background: rgba(0,0,0,0.02);
}
.hdz-stat-label { font-size: 0.65rem; color: #999; }
.hdz-stat-value { font-size: 1rem; font-weight: 600; color: #6b5a9f; }
.hdz-aside-progress { margin-top: 8px; }
.hdz-aside-progress-bar { height: 4px; background: rgba(0,0,0,0.06); border-radius: 2px; overflow: hidden; }
.hdz-aside-progress-fill { height: 100%; background: linear-gradient(90deg, rgba(168,130,255,0.4), rgba(180,140,200,0.4)); border-radius: 2px; transition: width 0.4s ease; }

/* 锁定区 */
.hdz-lock-section { padding: 8px 12px; border-top: 1px solid rgba(0,0,0,0.06); margin-top: 4px; }
.hdz-lock-title { font-size: 0.7rem; color: #999; margin-bottom: 6px; letter-spacing: 1px; }
.hdz-lock-item { display: flex; align-items: center; gap: 6px; padding: 4px 6px; border-radius: 4px; cursor: pointer; transition: all 0.2s; }
.hdz-lock-item:hover { background: rgba(0,0,0,0.03); }
.hdz-lock-icon { font-size: 0.8rem; }
.hdz-lock-label { font-size: 0.75rem; color: #777; }
.hdz-lock--on .hdz-lock-label { color: #7a5f9a; }

/* 审核面板 */
.hdz-review-panel { padding: 16px 24px; background: rgba(0,0,0,0.04); border-top: 1px solid rgba(0,0,0,0.06); }
.hdz-review-header { display: flex; align-items: center; gap: 10px; margin-bottom: 8px; }
.hdz-review-title { font-size: 0.85rem; color: #666; }
.hdz-review-score { font-size: 1.4rem; font-weight: 700; }
.hdz-review-s--good { color: #52c41a; }
.hdz-review-s--mid { color: #b8860b; }
.hdz-review-s--bad { color: #c0392b; }
.hdz-review-verdict { font-size: 0.75rem; padding: 2px 8px; border-radius: 4px; }
.hdz-review-v--pass { background: rgba(82,196,26,0.12); color: #2e7d32; }
.hdz-review-v--fix { background: rgba(200,140,20,0.12); color: #b8860b; }
.hdz-review-v--fail { background: rgba(255,60,60,0.12); color: #c0392b; }
.hdz-review-summary { font-size: 0.8rem; color: #888; margin-bottom: 10px; }
.hdz-review-detail { display: grid; grid-template-columns: 1fr 1fr; gap: 6px; margin-bottom: 10px; }
.hdz-review-detail-item { display: flex; justify-content: space-between; font-size: 0.75rem; padding: 4px 8px; background: rgba(0,0,0,0.04); border-radius: 4px; }
.hdz-review-detail-label { color: #999; }
.hdz-review-detail-val { font-weight: 600; }
.hdz-review-negative { color: #c0392b; }
.hdz-review-positive { color: #2e7d32; }
.hdz-review-benchmark { padding: 8px 12px; background: rgba(168,130,255,0.06); border-radius: 6px; margin-top: 6px; }
.hdz-review-benchmark-title { font-size: 0.75rem; color: #7a5f9a; margin-bottom: 6px; font-weight: 600; }
.hdz-review-benchmark-item { font-size: 0.72rem; margin-bottom: 4px; color: #888; }
.hdz-review-benchmark-label { color: #aaa; display: inline-block; width: 60px; flex-shrink: 0; }
.hdz-review-issue-item { font-size: 0.72rem; padding: 4px 6px; margin-bottom: 3px; border-radius: 4px; display: flex; gap: 6px; }
.hdz-review-issue--critical { background: rgba(231,76,60,0.08); color: #c0392b; }
.hdz-review-issue--major { background: rgba(243,156,18,0.08); color: #b8860b; }
.hdz-review-issue--minor { background: rgba(46,204,113,0.06); color: #555; }
.hdz-review-issue-tag { font-weight: 600; flex-shrink: 0; min-width: 28px; }
.hdz-review-issue-text { color: #666; }
.hdz-review-empty { text-align: center; padding: 20px; color: #888; font-size: 0.8rem; }
.hdz-review-empty-hint { margin-top: 4px; margin-bottom: 12px; font-size: 0.7rem; color: #aaa; }
.hdz-aside-next-steps { display: flex; flex-direction: column; gap: 6px; }
.hdz-aside-step-btn {
  text-align: left; width: 100%;
  padding: 8px 10px; border-radius: 6px; border: 1px solid rgba(0,0,0,0.06);
  background: rgba(0,0,0,0.02); color: #888;
  font-size: 0.75rem; cursor: pointer; transition: all 0.15s;
}
.hdz-aside-step-btn:hover { background: rgba(168,130,255,0.06); border-color: rgba(168,130,255,0.15); color: #7a5f9a; }

/* ===== 审批队列（右栏） ===== */
.hdz-ap-aside { border-top: 1px solid rgba(0,0,0,0.06); padding-top: 12px; }
.hdz-aside-badge {
  display: inline-flex; align-items: center; justify-content: center;
  min-width: 18px; height: 18px; border-radius: 9px;
  background: #e74c3c; color: #fff; font-size: 0.65rem; font-weight: 700;
  padding: 0 5px; margin-left: 6px;
}
.hdz-ap-task-list { display: flex; flex-direction: column; gap: 6px; max-height: 200px; overflow-y: auto; }
.hdz-ap-task-item {
  padding: 6px 8px; border-radius: 6px; cursor: pointer;
  background: rgba(0,0,0,0.02); border: 1px solid transparent;
  font-size: 0.72rem; line-height: 1.4; color: #666;
  transition: all .15s;
}
.hdz-ap-task-item:hover { background: rgba(0,0,0,0.04); border-color: rgba(0,0,0,0.08); }
.hdz-ap-task--selected { background: rgba(102,178,255,0.08); border-color: rgba(102,178,255,0.3); }
.hdz-ap-task-header { display: flex; align-items: center; gap: 6px; margin-bottom: 2px; }
.hdz-ap-task-agent { font-weight: 600; color: #555; }
.hdz-ap-task-status { font-size: 0.65rem; padding: 1px 5px; border-radius: 3px; }
.hdz-ap-status--waiting_approval { background: #fff3cd; color: #856404; }
.hdz-ap-task-time { font-size: 0.65rem; color: #aaa; }
.hdz-ap-task-msg { margin-top: 2px; font-size: 0.65rem; color: #999; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.hdz-ap-aside-empty { padding: 16px 0; text-align: center; font-size: 0.75rem; color: #aaa; }
.hdz-ap-aside-preview {
  margin-top: 8px; padding: 8px; border-radius: 6px;
  background: rgba(102,178,255,0.05); border: 1px solid rgba(102,178,255,0.15);
  cursor: pointer; transition: all .15s;
}
.hdz-ap-aside-preview:hover { background: rgba(102,178,255,0.1); }
.hdz-ap-aside-preview-header { display: flex; justify-content: space-between; font-size: 0.72rem; margin-bottom: 4px; }
.hdz-ap-aside-preview-link { color: #4a7fcf; font-weight: 600; }
.hdz-ap-aside-preview-text { font-size: 0.7rem; color: #888; line-height: 1.4; }

/* Sidebar */
.hdz-ws-sidebar {
  width: 220px; flex-shrink: 0;
  padding: 16px 10px;
  border-right: 1px solid rgba(0,0,0,0.06);
  background: rgba(0,0,0,0.02);
  display: flex; flex-direction: column;
}
.hdz-ws-sidebar-section { margin-bottom: 20px; }
.hdz-ws-sidebar-title { font-size: 0.7rem; color: #999; padding: 0 10px; margin-bottom: 6px; text-transform: uppercase; letter-spacing: 1px; }
.hdz-ws-sidebar-btn {
  display: block; width: 100%; text-align: left;
  padding: 8px 10px; border-radius: 6px;
  font-size: 0.8rem; color: #666;
  background: transparent; border: none; cursor: pointer;
  transition: all 0.15s;
}
.hdz-ws-sidebar-btn:hover { color: #333; background: rgba(0,0,0,0.03); }
.hdz-ws-sidebar-btn.active { color: #6b5a9f; background: rgba(168,130,255,0.08); }

/* Sidebar bottom cards */
.hdz-ws-sidebar-bottom { margin-top: auto; padding-top: 12px; border-top: 1px solid rgba(0,0,0,0.06); display: flex; flex-direction: column; gap: 6px; }
.hdz-ws-card {
  display: flex; align-items: center; gap: 8px;
  padding: 8px 10px; border-radius: 6px; cursor: pointer;
  transition: all 0.15s; background: transparent; border: 1px solid transparent;
}
.hdz-ws-card:hover { background: rgba(0,0,0,0.03); border-color: rgba(0,0,0,0.08); }
.hdz-ws-card-icon { font-size: 1rem; flex-shrink: 0; }
.hdz-ws-card-info { flex: 1; min-width: 0; }
.hdz-ws-card-title { font-size: 0.75rem; color: #555; font-weight: 500; }
.hdz-ws-card-desc { font-size: 0.65rem; color: #999; margin-top: 1px; }
.hdz-ws-card-arrow { font-size: 0.7rem; color: #aaa; }
.hdz-ws-card--member:hover .hdz-ws-card-icon { color: #b8860b; }
.hdz-vip-icon { filter: drop-shadow(0 0 6px rgba(200,160,50,0.4)); }
.hdz-ws-card--model:hover .hdz-ws-card-icon { color: #7a5f9a; }
.hdz-ws-card--local:hover .hdz-ws-card-icon { color: #4a7a9a; }

/* Main */
.hdz-ws-main { flex: 1; padding: 20px; overflow-y: auto; }
.hdz-ws-panel { min-height: 60vh; }
.hdz-panel-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 16px; font-size: 0.95rem; font-weight: 600; color: #333; }
.hdz-panel-empty { text-align: center; padding: 60px 0; color: #999; font-size: 0.85rem; }

/* Chat */
.hdz-chat-container { display: flex; flex-direction: column; height: calc(100vh - 120px); }
.hdz-chat-header { margin-bottom: 12px; font-size: 0.95rem; font-weight: 600; display: flex; align-items: center; gap: 12px; color: #333; flex-wrap: wrap; }
.hdz-chat-hint { font-size: 0.75rem; font-weight: 400; color: #999; }
.hdz-chat-header-actions { margin-left: auto; }
.hdz-chat-session-btn {
  padding: 3px 10px; border-radius: 6px; border: 1px solid rgba(0,0,0,0.1);
  background: rgba(255,255,255,0.5); color: #666; font-size: 0.72rem; cursor: pointer;
  transition: all 0.15s;
}
.hdz-chat-session-btn:hover { background: rgba(102,178,255,0.1); border-color: rgba(102,178,255,0.25); color: #2a6f9f; }
.hdz-session-panel {
  background: rgba(255,255,255,0.6); border: 1px solid rgba(0,0,0,0.06);
  border-radius: 8px; padding: 10px; max-height: 300px; overflow-y: auto;
}
.hdz-session-panel-header { display: flex; justify-content: space-between; align-items: center; font-size: 0.8rem; color: #666; margin-bottom: 8px; }
.hdz-session-empty { text-align: center; color: #999; font-size: 0.78rem; padding: 20px 0; }
.hdz-session-item {
  padding: 8px 10px; border-radius: 6px; cursor: pointer; margin-bottom: 2px;
  transition: background 0.1s;
}
.hdz-session-item:hover { background: rgba(0,0,0,0.03); }
.hdz-session--active { background: rgba(102,178,255,0.1); border-left: 3px solid rgba(102,178,255,0.5); }
.hdz-session-item-title { font-size: 0.82rem; color: #333; font-weight: 500; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.hdz-session-item-meta { font-size: 0.7rem; color: #aaa; margin-top: 2px; }
.hdz-chat-messages { flex: 1; overflow-y: auto; padding: 12px 0; display: flex; flex-direction: column; gap: 12px; }
.hdz-chat-empty { text-align: center; padding: 80px 0; color: #999; }
.hdz-chat-empty-hint { font-size: 0.8rem; color: #aaa; margin-top: 8px; }
.hdz-chat-msg { display: flex; gap: 10px; max-width: 80%; }
.hdz-msg--user { align-self: flex-end; flex-direction: row-reverse; }
.hdz-msg--assistant { align-self: flex-start; }
.hdz-msg-avatar { width: 28px; height: 28px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 0.9rem; flex-shrink: 0; background: rgba(0,0,0,0.04); }
.hdz-msg-content { padding: 10px 14px; border-radius: 10px; font-size: 0.85rem; line-height: 1.6; }
.hdz-msg--user .hdz-msg-content { background: rgba(168,130,255,0.1); border: 1px solid rgba(168,130,255,0.08); color: #333; }
.hdz-msg--assistant .hdz-msg-content { background: rgba(255,255,255,0.5); border: 1px solid rgba(0,0,0,0.06); color: #333; }
.hdz-chat-input-bar { display: flex; gap: 8px; margin-top: 12px; align-items: flex-end; }
.hdz-msg-actions { display: flex; flex-direction: column; gap: 4px; align-self: flex-start; margin-top: 4px; }
.hdz-tts-btn {
  width: 28px; height: 28px; border-radius: 50%; border: none;
  background: rgba(102,178,255,0.1);
  cursor: pointer; font-size: 0.75rem;
  display: flex; align-items: center; justify-content: center;
  transition: all 0.15s; flex-shrink: 0;
}
.hdz-tts-btn:hover { background: rgba(102,178,255,0.25); }
.hdz-tts-btn:disabled { opacity: 0.5; cursor: not-allowed; }
.hdz-chat-templates {
  display: flex; gap: 6px; padding: 4px 0 8px; flex-wrap: wrap;
}
.hdz-chat-tpl-btn {
  padding: 4px 12px; border-radius: 12px;
  background: rgba(102,178,255,0.06);
  border: 1px solid rgba(102,178,255,0.15);
  color: #4a8fc1; font-size: 0.72rem; cursor: pointer;
  transition: all 0.15s; white-space: nowrap;
}
.hdz-chat-tpl-btn:hover {
  background: rgba(102,178,255,0.15);
  border-color: rgba(102,178,255,0.3);
  color: #1a6f9f;
}
.hdz-chat-actions {
  display: flex; gap: 8px; padding: 8px 0; flex-wrap: wrap;
}
/* 快捷操作栏 — 固定不滚动 */
.hdz-chat-actions-bar {
  display: flex; gap: 8px; padding: 6px 0 10px; flex-wrap: wrap;
  flex-shrink: 0;
}
.hdz-chat-action-btn {
  padding: 6px 14px; border-radius: 6px;
  background: rgba(0,0,0,0.03);
  border: 1px solid rgba(0,0,0,0.08);
  color: #666; font-size: 0.78rem; cursor: pointer;
  transition: all 0.15s;
}
.hdz-chat-action-btn:hover {
  background: rgba(0,0,0,0.06);
  color: #333;
  border-color: rgba(0,0,0,0.15);
}
.hdz-chat-action-btn--primary {
  background: rgba(102,178,255,0.1);
  border-color: rgba(102,178,255,0.25);
  color: #2a6f9f;
}
.hdz-chat-action-btn--primary:hover {
  background: rgba(102,178,255,0.2);
  border-color: rgba(102,178,255,0.4);
  color: #1a4f7f;
}
.hdz-chat-input {
  flex: 1; padding: 10px 14px; border-radius: 8px;
  background: #fff;
.hdz-chat-action-btn--danger {
  background: rgba(255,80,80,0.1);
  border-color: rgba(255,80,80,0.25);
  color: #c0392b;
}
.hdz-chat-action-btn--danger:hover {
  background: rgba(255,80,80,0.2);
  border-color: rgba(255,80,80,0.4);
  color: #a93226;
}
  border: 1px solid rgba(0,0,0,0.12);
  color: #333; font-size: 0.85rem;
  outline: none;
  resize: none;
  line-height: 1.5;
  max-height: 6em;
  overflow-y: auto;
  font-family: inherit;
  word-break: break-word;
  white-space: pre-wrap;
}
.hdz-chat-input::placeholder { color: #aaa; }

/* Outline */
.hdz-outline-list { display: flex; flex-direction: column; gap: 8px; }
.hdz-outline-item {
  display: flex; align-items: center; gap: 12px;
  padding: 12px 16px; border-radius: 8px;
  background: rgba(255,255,255,0.5);
  border: 1px solid rgba(0,0,0,0.06);
  cursor: pointer;
}
.hdz-outline-item:hover { background: rgba(255,255,255,0.8); }
.hdz-outline-no { font-size: 0.7rem; color: #999; width: 60px; flex-shrink: 0; }
.hdz-outline-info { flex: 1; display: flex; align-items: center; gap: 10px; }
.hdz-outline-title { font-size: 0.85rem; color: #333; }
.hdz-outline-status { font-size: 0.65rem; padding: 1px 6px; border-radius: 3px; }
.hdz-ch-status--outline { background: rgba(0,0,0,0.04); color: #888; }
.hdz-ch-status--draft { background: rgba(200,160,50,0.12); color: #7a6a20; }
.hdz-ch-status--reviewed { background: rgba(76,175,80,0.12); color: #2e7d32; }
.hdz-ch-status--waiting_approval { background: rgba(255,152,0,0.12); color: #e65100; }
.hdz-ch-status--final { background: rgba(76,175,80,0.12); color: #2e7d32; }
.hdz-outline-meta { font-size: 0.7rem; color: #999; display: flex; align-items: center; gap: 4px; }
.hdz-outline-summary-icon { font-size: 0.8rem; }
.hdz-outline-detail {
  padding: 8px 16px 12px 72px;
  border-bottom: 1px solid rgba(0,0,0,0.04);
}
.hdz-outline-summary {
  font-size: 0.78rem;
  line-height: 1.6;
  color: #888;
}

/* Manuscript */
.hdz-manuscript { display: flex; flex-direction: column; gap: 12px; }
.hdz-manuscript-nav { display: flex; gap: 8px; }
.hdz-manuscript-editor {
  width: 100%; min-height: calc(100vh - 200px);
  padding: 16px; border-radius: 8px;
  background: #fff;
  border: 1px solid rgba(0,0,0,0.08);
  color: #333; font-size: 0.9rem;
  line-height: 1.8; font-family: inherit;
  resize: vertical; outline: none;
}
.hdz-manuscript-editor:focus { border-color: rgba(168,130,255,0.3); }

/* Character grid */
/* 宗门筛选标签 */
.hdz-faction-tabs { display: flex; flex-wrap: wrap; gap: 6px; margin-bottom: 12px; }
.hdz-faction-tab { padding: 4px 10px; border-radius: 14px; background: #2a2a3a; color: #aaa; font-size: 12px; cursor: pointer; transition: all .15s; white-space: nowrap; border: 1px solid transparent; }
.hdz-faction-tab:hover { background: #3a3a4a; color: #ddd; }
.hdz-faction-tab.active { background: #3b5998; color: #fff; border-color: #4a7fcf; }

.hdz-char-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(200px, 1fr)); gap: 12px; }
.hdz-char-card { padding: 16px; border-radius: 8px; background: rgba(255,255,255,0.7); border: 1px solid rgba(0,0,0,0.06); }
.hdz-char-name { font-size: 0.95rem; font-weight: 600; color: #333; margin-bottom: 6px; }
.hdz-char-role { font-size: 0.75rem; color: #7a5f9a; }

/* Memory */
.hdz-memory-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(180px, 1fr)); gap: 12px; }
.hdz-memory-card { padding: 16px; border-radius: 8px; background: rgba(255,255,255,0.7); border: 1px solid rgba(0,0,0,0.06); text-align: center; }
.hdz-memory-icon { font-size: 1.5rem; margin-bottom: 8px; }
.hdz-memory-name { font-size: 0.85rem; color: #333; margin-bottom: 8px; }
.hdz-memory-status { font-size: 0.7rem; }
.hdz-mem--ready { color: #2e7d32; }
.hdz-mem--empty { color: #aaa; }
.hdz-memory-refresh { margin-top: 16px; text-align: center; }

/* Style */
.hdz-style-area { max-width: 600px; }
.hdz-style-hint { font-size: 0.8rem; color: #888; margin-bottom: 12px; line-height: 1.6; }
.hdz-style-area .hdz-btn { margin-top: 12px; }
.hdz-style-locked-badge { font-size: 0.7rem; color: #fff; background: #e74c3c; padding: 2px 8px; border-radius: 10px; margin-left: 8px; }
.hdz-style-selected-info { padding: 12px 16px; background: rgba(102,178,255,0.08); border-radius: 8px; margin-bottom: 16px; font-size: 0.85rem; }
.hdz-master-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(180px, 1fr)); gap: 12px; margin-bottom: 20px; }
.hdz-master-card {
  padding: 14px; border-radius: 8px; border: 2px solid rgba(0,0,0,0.06); background: rgba(255,255,255,0.5);
  cursor: pointer; transition: all .2s;
}
.hdz-master-card:hover { border-color: rgba(168,130,255,0.3); box-shadow: 0 2px 8px rgba(0,0,0,0.06); }
.hdz-master--selected { border-color: #6b5a9f; background: rgba(168,130,255,0.06); }
.hdz-master-name { font-size: 0.95rem; font-weight: 700; color: #333; margin-bottom: 4px; }
.hdz-master-desc { font-size: 0.75rem; color: #888; line-height: 1.4; margin-bottom: 8px; }
.hdz-master-tags { display: flex; flex-wrap: wrap; gap: 4px; }
.hdz-master-tag { font-size: 0.65rem; padding: 1px 6px; border-radius: 3px; background: rgba(168,130,255,0.08); color: #7a5f9a; }
.hdz-style-locked-msg { padding: 24px; text-align: center; color: #888; font-size: 0.9rem; }

/* Reader */
/* Reader - New Layout */
.hdz-reader-layout { display: flex; flex-direction: column; height: calc(100vh - 120px); overflow: hidden; }
.hdz-reader-topbar {
  display: flex; align-items: center; justify-content: space-between; flex-shrink: 0;
  padding: 10px 16px; background: #fff; border-bottom: 1px solid rgba(0,0,0,0.06);
  gap: 12px; flex-wrap: wrap; position: sticky; top: 0; z-index: 10;
}
.hdz-reader-chapter-selector { display: flex; align-items: center; gap: 8px; }
.hdz-reader-selector-label { font-size: 0.8rem; color: #888; white-space: nowrap; }
.hdz-reader-topbar-actions { display: flex; gap: 6px; flex-shrink: 0; }
.hdz-reader-split {
  display: flex; flex: 1; min-height: 0;
}
.hdz-reader-main {
  flex: 1; overflow-y: auto; padding: 16px; min-width: 0;
}
.hdz-reader-side {
  width: 280px; flex-shrink: 0; overflow-y: auto; padding: 16px;
  border-left: 1px solid rgba(0,0,0,0.06);
}

.hdz-scroll-top-btn {
  position: fixed; bottom: 24px; right: 24px; z-index: 100;
  width: 40px; height: 40px; border-radius: 50%; border: none;
  background: rgba(168,130,255,0.85); color: #fff; font-size: 1.4rem;
  cursor: pointer; box-shadow: 0 2px 8px rgba(0,0,0,0.15);
  transition: all .2s; display: flex; align-items: center; justify-content: center;
}
.hdz-scroll-top-btn:hover { background: rgba(168,130,255,1); transform: scale(1.1); }

.hdz-reader { }
.hdz-reader-actions { display: flex; gap: 6px; }
.hdz-reader-chapter-actions { text-align: center; margin-bottom: 16px; }
.hdz-reader-tts-btn {
  font-size: 0.75rem; padding: 4px 14px; border-radius: 14px; border: 1px solid rgba(168,130,255,0.3);
  background: rgba(168,130,255,0.06); color: #7a5f9a; cursor: pointer; transition: all .15s;
}
.hdz-reader-tts-btn:hover { background: rgba(168,130,255,0.15); border-color: rgba(168,130,255,0.5); }
.hdz-reader-page-mode { display: flex; flex-direction: column; flex: 1; }
.hdz-reader-page { flex: 1; padding: 20px 40px; max-width: 720px; margin: 0 auto; }
.hdz-reader-chapter-title { font-size: 1.4rem; font-weight: 700; text-align: center; margin-bottom: 32px; color: #7a5f9a; letter-spacing: 2px; }
.hdz-reader-content { color: #333; white-space: pre-wrap; word-break: break-word; visibility: visible !important; }
.hdz-reader-progress { font-size: 0.75rem; color: #999; min-width: 100px; text-align: center; }
.hdz-reader-scroll-mode { display: flex; flex-direction: column; }
.hdz-reader-scroll-chapter { padding: 20px 40px; max-width: 720px; margin: 0 auto; }
.hdz-reader-scroll-sep { text-align: center; color: #ddd; padding: 40px 0; font-size: 0.8rem; }
/* 翻页按钮区 */
.hdz-reader-nav button:disabled { opacity: 0.2; cursor: default; }

/* Panel header actions */
.hdz-panel-header-actions { display: flex; gap: 6px; }

/* Modal */
.hdz-overlay { position: fixed; inset: 0; z-index: 1000; background: rgba(0,0,0,0.4); display: flex; align-items: center; justify-content: center; }
.hdz-modal { background: #faf7f0; border: 1px solid rgba(0,0,0,0.1); border-radius: 12px; padding: 28px; max-width: 420px; width: 90vw; max-height: 80vh; overflow-y: auto; }
.hdz-modal-title { font-size: 1.05rem; font-weight: 600; margin-bottom: 20px; color: #333; }
.hdz-form { display: flex; flex-direction: column; gap: 14px; }
.hdz-field { display: flex; flex-direction: column; gap: 6px; }
.hdz-field label { font-size: 0.8rem; color: #666; }
.hdz-modal-actions { display: flex; gap: 10px; justify-content: center; margin-top: 16px; }

/* Shared */
.hdz-btn { padding: 8px 18px; border-radius: 6px; font-size: 0.8rem; font-weight: 500; border: none; cursor: pointer; transition: all 0.2s; display: inline-flex; align-items: center; gap: 4px; }
.hdz-btn-primary { background: linear-gradient(135deg, rgba(168,130,255,0.15), rgba(180,140,200,0.15)); color: #6b5a9f; border: 1px solid rgba(168,130,255,0.2); }
.hdz-btn-primary:hover { background: linear-gradient(135deg, rgba(168,130,255,0.25), rgba(180,140,200,0.25)); }
.hdz-btn-primary:disabled { opacity: 0.4; cursor: default; }
.hdz-btn-ghost { background: transparent; color: #999; }
.hdz-btn-ghost:hover { color: #555; }
.hdz-btn-danger { background: rgba(200,60,60,0.12); color: #c0392b; border: 1px solid rgba(200,60,60,0.2); }
.hdz-btn-danger:hover { background: rgba(200,60,60,0.2); }
.hdz-btn-sm { padding: 6px 14px; font-size: 0.75rem; }
.hdz-btn-xs { padding: 4px 10px; font-size: 0.7rem; }
.hdz-input { background: #fff; border: 1px solid rgba(0,0,0,0.1); border-radius: 6px; padding: 8px 12px; color: #333; font-size: 0.85rem; outline: none; }
.hdz-input-sm { padding: 6px 10px; font-size: 0.8rem; }
.hdz-textarea { resize: vertical; font-family: inherit; line-height: 1.6; }

/* ===== 审批面板 HITL (右侧抽屉) ===== */
.hdz-approval-panel {
  width: 380px; flex-shrink: 0;
  border-left: 1px solid rgba(0,0,0,0.06);
  background: rgba(0,0,0,0.02);
  overflow-y: auto;
  display: flex; flex-direction: column;
  padding: 16px 14px;
  gap: 12px;
  animation: hdz-ap-slide-in 0.2s ease-out;
}

@keyframes hdz-ap-slide-in {
  from { opacity: 0; transform: translateX(20px); }
  to { opacity: 1; transform: translateX(0); }
}

/* 顶部标题 */
.hdz-ap-header {
  display: flex; align-items: center; gap: 8px;
  padding-bottom: 10px;
  border-bottom: 1px solid rgba(0,0,0,0.06);
}
.hdz-ap-title { font-size: 0.9rem; font-weight: 600; color: #333; flex: 1; }
.hdz-ap-badge {
  font-size: 0.7rem; font-weight: 600;
  background: rgba(200,60,60,0.12); color: #c0392b;
  min-width: 20px; height: 20px;
  display: flex; align-items: center; justify-content: center;
  border-radius: 10px; padding: 0 6px;
}
.hdz-ap-close {
  background: none; border: none; cursor: pointer;
  font-size: 1rem; color: #999; padding: 2px 6px; border-radius: 4px;
}
.hdz-ap-close:hover { background: rgba(0,0,0,0.05); color: #333; }

/* 章节标题 */
.hdz-ap-section-title {
  font-size: 0.7rem; color: #999; text-transform: uppercase; letter-spacing: 1px;
  padding: 4px 0;
}

/* 待审批任务列表 */
.hdz-ap-task-list { display: flex; flex-direction: column; gap: 4px; max-height: 260px; overflow-y: auto; }

.hdz-ap-task-item {
  padding: 10px 12px; border-radius: 8px;
  background: rgba(255,255,255,0.5);
  border: 1px solid rgba(0,0,0,0.05);
  cursor: pointer; transition: all 0.15s;
}
.hdz-ap-task-item:hover { background: rgba(255,255,255,0.8); border-color: rgba(168,130,255,0.2); }
.hdz-ap-task--selected { background: rgba(168,130,255,0.08); border-color: rgba(168,130,255,0.25); }
.hdz-ap-task--planner { border-left: 3px solid rgba(100,180,255,0.5); }
.hdz-ap-task--writer { border-left: 3px solid rgba(76,175,80,0.5); }
.hdz-ap-task--reviewer { border-left: 3px solid rgba(255,152,0,0.5); }
.hdz-ap-task-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 2px; }
.hdz-ap-task-agent { font-size: 0.78rem; font-weight: 500; color: #444; }
.hdz-ap-task-time { font-size: 0.65rem; color: #aaa; }
.hdz-ap-task-msg { font-size: 0.7rem; color: #888; margin-top: 4px; line-height: 1.5; }
.hdz-ap-task-status { font-size: 0.6rem; padding: 1px 6px; border-radius: 3px; }
.hdz-ap-status--waiting_approval { background: rgba(255,152,0,0.12); color: #b8860b; }
.hdz-ap-status--approved { background: rgba(76,175,80,0.12); color: #2e7d32; }
.hdz-ap-status--rejected { background: rgba(200,60,60,0.12); color: #c0392b; }
.hdz-ap-status--modified { background: rgba(33,150,243,0.12); color: #1565c0; }
.hdz-ap-empty { text-align: center; padding: 20px 0; color: #999; font-size: 0.8rem; line-height: 1.6; }
.hdz-ap-empty-hint { font-size: 0.7rem; color: #aaa; margin-top: 4px; }

/* 选中任务详情 */
.hdz-ap-detail { border-top: 1px solid rgba(0,0,0,0.06); padding-top: 8px; }
.hdz-ap-detail-content { max-height: 300px; overflow-y: auto; padding: 4px 0; }

/* Planner 大纲章节列表 */
.hdz-ap-chapters { display: flex; flex-direction: column; gap: 4px; }
.hdz-ap-chapter-item {
  display: flex; align-items: baseline; gap: 6px;
  padding: 6px 8px; border-radius: 4px;
  background: rgba(0,0,0,0.02);
  font-size: 0.75rem; line-height: 1.5;
}
.hdz-ap-chapter-no { color: #999; font-size: 0.7rem; min-width: 20px; }
.hdz-ap-chapter-title { color: #444; font-weight: 500; }
.hdz-ap-chapter-summary { color: #888; font-size: 0.7rem; flex: 1; }
.hdz-ap-no-data { color: #aaa; padding: 12px 0; text-align: center; font-size: 0.75rem; }

/* Writer 正文 */
.hdz-ap-word-count { font-size: 0.72rem; color: #888; margin-bottom: 6px; }
.hdz-ap-writer-text { 
  background: rgba(255,255,255,0.6);
  border: 1px solid rgba(0,0,0,0.06);
  border-radius: 6px; padding: 10px 12px;
  max-height: 280px; overflow-y: auto;
}
.hdz-ap-writer-body {
  font-size: 0.78rem; line-height: 1.7; color: #444;
  white-space: pre-wrap; word-break: break-word;
}
.hdz-ap-expand-btn {
  display: block; width: 100%; text-align: center;
  padding: 6px; margin-top: 6px;
  background: rgba(168,130,255,0.06);
  border: 1px solid rgba(168,130,255,0.12);
  border-radius: 4px;
  font-size: 0.7rem; color: #7a5f9a; cursor: pointer;
  transition: all 0.15s;
}
.hdz-ap-expand-btn:hover { background: rgba(168,130,255,0.12); }

/* Reviewer 审核报告 */
.hdz-ap-review-score-bar {
  display: flex; align-items: center; gap: 8px;
  padding: 10px 12px; margin-bottom: 8px;
  background: rgba(0,0,0,0.02); border-radius: 6px;
}
.hdz-ap-review-score-label { font-size: 0.7rem; color: #999; }
.hdz-ap-review-score-val { font-size: 1.6rem; font-weight: 700; }
.hdz-ap-review-verdict { font-size: 0.72rem; padding: 2px 8px; border-radius: 4px; }

.hdz-ap-review-details { display: grid; grid-template-columns: 1fr 1fr; gap: 4px; margin-bottom: 8px; }
.hdz-ap-review-detail-item {
  display: flex; justify-content: space-between;
  padding: 6px 8px; font-size: 0.72rem;
  background: rgba(0,0,0,0.02); border-radius: 4px;
  color: #666;
}
.hdz-ap-review-benchmark {
  padding: 8px 10px; background: rgba(168,130,255,0.06);
  border-radius: 6px; margin-bottom: 8px;
}
.hdz-ap-review-benchmark-title { font-size: 0.7rem; color: #7a5f9a; margin-bottom: 4px; }
.hdz-ap-benchmark-item { font-size: 0.7rem; margin-bottom: 3px; color: #888; }
.hdz-ap-benchmark-label { color: #aaa; display: inline-block; width: 56px; flex-shrink: 0; }

.hdz-ap-review-summary { margin-bottom: 6px; }
.hdz-ap-review-summary-title { font-size: 0.72rem; color: #7a5f9a; margin-bottom: 4px; font-weight: 500; }
.hdz-ap-review-summary p { font-size: 0.75rem; color: #666; line-height: 1.6; }

.hdz-ap-review-verdict-section { margin-bottom: 6px; }

/* 审批操作区 */
.hdz-ap-actions { border-top: 1px solid rgba(0,0,0,0.06); padding-top: 8px; }
.hdz-ap-action-buttons { display: flex; gap: 6px; flex-wrap: wrap; }
.hdz-ap-btn-approve {
  flex: 1; min-width: 80px;
  background: rgba(76,175,80,0.12); color: #2e7d32;
  border: 1px solid rgba(76,175,80,0.25);
}
.hdz-ap-btn-approve:hover:not(:disabled) { background: rgba(76,175,80,0.22); }
.hdz-ap-btn-reject {
  flex: 1; min-width: 80px;
  background: rgba(200,60,60,0.12); color: #c0392b;
  border: 1px solid rgba(200,60,60,0.2);
}
.hdz-ap-btn-reject:hover:not(:disabled) { background: rgba(200,60,60,0.22); }
.hdz-ap-btn-modify {
  flex: 1; min-width: 80px;
  background: rgba(33,150,243,0.12); color: #1565c0;
  border: 1px solid rgba(33,150,243,0.2);
}
.hdz-ap-btn-modify:hover:not(:disabled) { background: rgba(33,150,243,0.22); }

/* 审批历史 (折叠) */
.hdz-ap-history { border-top: 1px solid rgba(0,0,0,0.06); padding-top: 4px; margin-top: auto; }
.hdz-ap-history-header {
  display: flex; align-items: center; justify-content: space-between;
  padding: 8px 4px; cursor: pointer; font-size: 0.7rem; color: #999; letter-spacing: 1px; text-transform: uppercase;
}
.hdz-ap-history-header:hover { color: #666; }
.hdz-ap-history-toggle { font-size: 0.6rem; color: #bbb; }
.hdz-ap-history-list { max-height: 180px; overflow-y: auto; }
.hdz-ap-history-item {
  padding: 8px 10px; border-radius: 6px;
  background: rgba(255,255,255,0.4);
  border: 1px solid rgba(0,0,0,0.04);
  margin-bottom: 4px;
}
.hdz-ap-history-item-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 2px; }
.hdz-ap-history-item-time { font-size: 0.62rem; color: #aaa; }
.hdz-ap-history-item-note { font-size: 0.68rem; color: #888; margin-top: 4px; line-height: 1.5; }
.hdz-ap-hs--approved { color: #2e7d32; font-size: 0.7rem; }
.hdz-ap-hs--rejected { color: #c0392b; font-size: 0.7rem; }
.hdz-ap-hs--modified { color: #1565c0; font-size: 0.7rem; }

/* 审批徽标 (侧边栏) */
.hdz-approval-badge {
  display: inline-flex; align-items: center; justify-content: center;
  background: rgba(200,60,60,0.15); color: #c0392b;
  font-size: 0.6rem; font-weight: 600;
  min-width: 18px; height: 18px; border-radius: 9px;
  padding: 0 5px; margin-left: 4px;
  vertical-align: middle;
}

/* Wide modal for modify dialog */
.hdz-modal--wide { max-width: 560px; }

/* Scrollbar styling for approval panel */
.hdz-approval-panel ::-webkit-scrollbar { width: 4px; }
.hdz-approval-panel ::-webkit-scrollbar-track { background: transparent; }
.hdz-approval-panel ::-webkit-scrollbar-thumb { background: rgba(0,0,0,0.1); border-radius: 2px; }
.hdz-approval-panel ::-webkit-scrollbar-thumb:hover { background: rgba(0,0,0,0.2); }

/* ===== 角色卡片增强 ===== */
.hdz-char-card {
  padding: 14px 16px;
  border-radius: 10px;
  background: rgba(255,255,255,0.7);
  border: 1px solid rgba(0,0,0,0.06);
  transition: all 0.2s;
}
.hdz-char-card:hover {
  background: rgba(255,255,255,0.9);
  border-color: rgba(168,130,255,0.15);
}
.hdz-char-header {
  display: flex;
  align-items: center;
  gap: 10px;
  cursor: pointer;
}
.hdz-char-avatar {
  width: 36px;
  height: 36px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 1.2rem;
  background: rgba(168,130,255,0.08);
  flex-shrink: 0;
}
.hdz-char-info {
  flex: 1;
  min-width: 0;
}
.hdz-char-name {
  font-size: 0.95rem;
  font-weight: 600;
  color: #333;
  margin-bottom: 2px;
}
.hdz-char-role-badge {
  font-size: 0.65rem;
  padding: 1px 8px;
  border-radius: 3px;
  background: rgba(0,0,0,0.04);
  color: #888;
}
.hdz-char-role--protagonist {
  background: rgba(168,130,255,0.12);
  color: #6b5a9f;
}
.hdz-char-role--antagonist {
  background: rgba(200,60,60,0.12);
  color: #c0392b;
}
.hdz-char-role--supporting {
  background: rgba(76,175,80,0.12);
  color: #2e7d32;
}
.hdz-char-role--minor {
  background: rgba(0,0,0,0.04);
  color: #888;
}
.hdz-char-edit-btn {
  background: none;
  border: none;
  cursor: pointer;
  font-size: 0.8rem;
  padding: 2px 6px;
  border-radius: 4px;
  color: #999;
  transition: all 0.15s;
  opacity: 0.5;
}
.hdz-char-edit-btn:hover {
  opacity: 1;
  color: #6b5a9f;
  background: rgba(168,130,255,0.08);
}
.hdz-char-delete-btn {
  background: none;
  border: none;
  cursor: pointer;
  font-size: 0.8rem;
  padding: 2px 6px;
  border-radius: 4px;
  color: #999;
  transition: all 0.15s;
  opacity: 0.5;
}
.hdz-char-delete-btn:hover {
  opacity: 1;
  color: #e53935;
  background: rgba(229,57,53,0.08);
}
.hdz-char-expand-btn {
  background: none;
  border: none;
  cursor: pointer;
  font-size: 0.7rem;
  padding: 2px 6px;
  border-radius: 4px;
  color: #aaa;
  transition: all 0.15s;
}
.hdz-char-expand-btn:hover {
  color: #666;
  background: rgba(0,0,0,0.04);
}
.hdz-char-preview {
  margin-top: 6px;
  font-size: 0.75rem;
  color: #999;
}
.hdz-char-preview-faction {
  color: #7a5f9a;
}
.hdz-char-detail {
  margin-top: 10px;
  padding-top: 10px;
  border-top: 1px solid rgba(0,0,0,0.06);
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.hdz-char-field {
  display: flex;
  flex-direction: column;
  gap: 2px;
}
.hdz-char-field-label {
  font-size: 0.7rem;
  color: #999;
  font-weight: 500;
}
.hdz-char-field-val {
  font-size: 0.8rem;
  color: #444;
  line-height: 1.6;
  white-space: pre-wrap;
}
.hdz-char-relations {
  display: flex;
  flex-direction: column;
  gap: 4px;
  margin-top: 2px;
}
.hdz-char-relation-item {
  display: flex;
  align-items: baseline;
  gap: 8px;
  padding: 4px 8px;
  border-radius: 4px;
  background: rgba(168,130,255,0.04);
  cursor: pointer;
  transition: all 0.15s;
  font-size: 0.78rem;
}
.hdz-char-relation-item:hover {
  background: rgba(168,130,255,0.1);
}
.hdz-char-rel-target {
  font-weight: 500;
  color: #6b5a9f;
}
.hdz-char-rel-type {
  color: #999;
  font-size: 0.7rem;
}
.hdz-char-rel-desc {
  color: #888;
  font-size: 0.7rem;
  flex: 1;
}

/* 批量创建结果提示 */
.hdz-batch-result {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 14px;
  border-radius: 8px;
  margin-bottom: 12px;
  font-size: 0.8rem;
  border: 1px solid;
}
.hdz-batch-result--ok {
  background: rgba(76,175,80,0.08);
  border-color: rgba(76,175,80,0.2);
  color: #2e7d32;
}
.hdz-batch-result--warn {
  background: rgba(255,152,0,0.08);
  border-color: rgba(255,152,0,0.2);
  color: #b8860b;
}
.hdz-batch-result-close {
  margin-left: auto;
  background: none;
  border: none;
  cursor: pointer;
  color: inherit;
  font-size: 0.8rem;
  opacity: 0.6;
}
.hdz-batch-result-close:hover {
  opacity: 1;
}

/* Wide modal for character edit */
/* .hdz-modal--wide is already defined as 560px above */

/* ===== 组织卡片（仿角色卡片折叠/展开样式） ===== */
.hdz-faction-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
  gap: 12px;
}
.hdz-faction-card {
  padding: 14px 16px;
  border-radius: 10px;
  background: rgba(255,255,255,0.7);
  border: 1px solid rgba(0,0,0,0.06);
  transition: all 0.2s;
}
.hdz-faction-card:hover {
  background: rgba(255,255,255,0.9);
  border-color: rgba(139,115,85,0.15);
}
.hdz-faction-header {
  display: flex;
  align-items: center;
  gap: 10px;
  cursor: pointer;
}
.hdz-faction-icon {
  width: 36px;
  height: 36px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 1.2rem;
  background: rgba(139,115,85,0.08);
  flex-shrink: 0;
}
.hdz-faction-info {
  flex: 1;
  min-width: 0;
}
.hdz-faction-name {
  font-size: 0.95rem;
  font-weight: 600;
  color: #333;
  margin-bottom: 2px;
}
.hdz-faction-type-badge {
  font-size: 0.65rem;
  padding: 1px 8px;
  border-radius: 3px;
  background: rgba(139,115,85,0.1);
  color: #8b7355;
}
.hdz-faction-expand-btn {
  background: none;
  border: none;
  cursor: pointer;
  font-size: 0.7rem;
  padding: 2px 6px;
  border-radius: 4px;
  color: #aaa;
  transition: all 0.15s;
}
.hdz-faction-expand-btn:hover {
  color: #666;
  background: rgba(0,0,0,0.04);
}
.hdz-faction-detail {
  margin-top: 10px;
  padding-top: 10px;
  border-top: 1px solid rgba(0,0,0,0.06);
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.hdz-faction-field {
  display: flex;
  flex-direction: column;
  gap: 2px;
}
.hdz-faction-field-label {
  font-size: 0.7rem;
  color: #999;
  font-weight: 500;
}
.hdz-faction-field-val {
  font-size: 0.8rem;
  color: #444;
  line-height: 1.6;
  white-space: pre-wrap;
}
.hdz-faction-field-val--name {
  color: #6b5a9f;
  font-weight: 500;
}
.hdz-faction-members {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin-top: 2px;
}
.hdz-faction-member-tag {
  display: inline-flex;
  align-items: center;
  padding: 3px 10px;
  border-radius: 12px;
  font-size: 0.75rem;
  background: rgba(168,130,255,0.06);
  color: #6b5a9f;
  border: 1px solid rgba(168,130,255,0.12);
  cursor: pointer;
  transition: all 0.15s;
}
.hdz-faction-member-tag:hover {
  background: rgba(168,130,255,0.14);
  border-color: rgba(168,130,255,0.25);
}
.hdz-faction-member--leader {
  background: rgba(255,193,7,0.08);
  border-color: rgba(255,193,7,0.2);
  color: #8b6b00;
  font-weight: 500;
}
.hdz-faction-member--leader:hover {
  background: rgba(255,193,7,0.16);
  border-color: rgba(255,193,7,0.3);
}
</style>

<!-- Reader paragraph indent (非 scoped，作用于 v-html 渲染的 <p>) -->
<style>
.hdz-reader-content p {
  text-indent: 2em;
  margin-bottom: 1em;
  line-height: 2;
}

/* 🎬 编剧面板 */
.hdz-screenplay-layout {
  display: flex;
  gap: 16px;
  height: 100%;
  min-height: 0;
}

.hdz-screenplay-left,
.hdz-screenplay-right {
  flex: 1;
  display: flex;
  flex-direction: column;
  min-height: 0;
  background: rgba(0,0,0,0.02);
  border-radius: 8px;
  padding: 12px;
  overflow: hidden;
}

.hdz-screenplay-left .hdz-panel-header {
  margin-bottom: 8px;
}

.hdz-screenplay-left .hdz-panel-subtitle {
  font-size: 0.8rem;
  color: #888;
  margin-left: 8px;
}

.hdz-screenplay-chapter-list {
  flex: 0 0 auto;
  max-height: 300px;
  overflow-y: auto;
  margin-bottom: 8px;
  border: 1px solid rgba(0,0,0,0.08);
  border-radius: 6px;
  background: rgba(255,255,255,0.5);
}

.hdz-screenplay-ch-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 10px;
  cursor: pointer;
  border-bottom: 1px solid rgba(0,0,0,0.04);
  transition: background 0.15s;
}
.hdz-screenplay-ch-item:hover {
  background: rgba(106,90,205,0.06);
}
.hdz-screenplay-ch-item.hdz-screenplay-ch--selected {
  background: rgba(106,90,205,0.12);
}

.hdz-sc-ch-no {
  font-size: 0.78rem;
  color: #666;
  min-width: 52px;
}

.hdz-sc-ch-title {
  flex: 1;
  font-size: 0.85rem;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.hdz-sc-ch-status {
  font-size: 0.7rem;
  padding: 1px 6px;
  border-radius: 4px;
}
.hdz-sc-status--reviewed { background: #e6f7ed; color: #389e0d; }
.hdz-sc-status--draft { background: #fff7e6; color: #d48806; }
.hdz-sc-status--outline { background: #f0f0f0; color: #8c8c8c; }

.hdz-screenplay-preview {
  flex: 1;
  display: flex;
  flex-direction: column;
  min-height: 0;
  border: 1px solid rgba(0,0,0,0.08);
  border-radius: 6px;
  background: rgba(255,255,255,0.5);
  overflow: hidden;
}

.hdz-screenplay-preview-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 6px 10px;
  font-size: 0.8rem;
  color: #555;
  border-bottom: 1px solid rgba(0,0,0,0.06);
  flex-shrink: 0;
}

.hdz-screenplay-wordcount {
  font-size: 0.75rem;
  color: #999;
}

.hdz-screenplay-preview-content {
  flex: 1;
  padding: 6px 10px 10px;
  min-height: 0;
}

.hdz-screenplay-preview-scrollbox {
  height: 120px;
  overflow-y: auto;
  border: 1px solid #ddd;
  border-radius: 4px;
  padding: 8px;
  font-size: 0.82rem;
  line-height: 1.7;
  white-space: pre-wrap;
  word-break: break-word;
  color: #333;
  background: #fff;
  box-sizing: border-box;
}


.hdz-screenplay-actions {
  display: flex;
  flex-direction: column;
  gap: 8px;
  margin-top: 8px;
  flex-shrink: 0;
}

.hdz-screenplay-style-input textarea {
  width: 100%;
  font-size: 0.82rem;
  padding: 6px 8px;
  border: 1px solid rgba(0,0,0,0.12);
  border-radius: 6px;
  background: rgba(255,255,255,0.6);
  color: #333;
  resize: vertical;
  box-sizing: border-box;
  line-height: 1.5;
  transition: border-color 0.2s;
}
.hdz-screenplay-style-input textarea:focus {
  border-color: #6a6acd;
  outline: none;
}
.hdz-screenplay-style-input textarea::placeholder {
  color: #aaa;
  font-size: 0.78rem;
}

/* 右栏 — 剧本展示 */
.hdz-screenplay-empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 100%;
  color: #bbb;
  font-size: 2rem;
  gap: 8px;
}
.hdz-screenplay-empty p {
  font-size: 0.9rem;
  color: #999;
  margin: 0;
}
.hdz-screenplay-empty-hint {
  font-size: 0.78rem !important;
  color: #bbb !important;
}

.hdz-screenplay-toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding-bottom: 8px;
  border-bottom: 1px solid rgba(0,0,0,0.08);
  margin-bottom: 8px;
  flex-shrink: 0;
}

.hdz-screenplay-title {
  font-weight: 600;
  font-size: 0.9rem;
}

.hdz-screenplay-toolbar-actions {
  display: flex;
  gap: 4px;
}

.hdz-screenplay-content {
  max-height: 420px;
  overflow-y: auto;
  padding-right: 4px;
}

/* 右栏剧本章节下拉 */
.hdz-screenplay-list {
  max-height: 420px;
  overflow-y: auto;
  margin-bottom: 8px;
  border: 1px solid rgba(0,0,0,0.08);
  border-radius: 6px;
  background: rgba(255,255,255,0.5);
}

.hdz-scene-block {
  background: rgba(255,255,255,0.6);
  border: 1px solid rgba(0,0,0,0.06);
  border-radius: 6px;
  padding: 10px 12px;
  margin-bottom: 10px;
}

.hdz-scene-header {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 4px;
}

.hdz-scene-no {
  font-weight: 600;
  font-size: 0.85rem;
  color: #6a5acd;
}

.hdz-scene-location {
  font-size: 0.8rem;
  color: #666;
}

.hdz-scene-characters {
  font-size: 0.78rem;
  color: #888;
  margin-bottom: 6px;
}

.hdz-scene-camera {
  font-size: 0.82rem;
  color: #6a6acd;
  margin-bottom: 6px;
  padding: 3px 8px;
  background: rgba(106,90,205,0.06);
  border-radius: 4px;
  display: inline-block;
}

.hdz-scene-content {
  font-size: 0.85rem;
  line-height: 1.7;
  color: #333;
}
.library-reader-panel { min-height: 60vh !important; }
</style>