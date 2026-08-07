<template>
  <div class="tea-page">
    <div v-if="toastMsg" class="tea-toast">{{ toastMsg }}</div>
    <!-- 顶栏 -->
    <header class="tea-header">
      <div class="tea-brand" @click="goHome" title="返回首页">
        <span class="tea-logo">🍵</span>
        <div class="tea-title-wrap">
          <h1 class="tea-title">昆仑茶馆</h1>
          <p class="tea-sub">昆仑镜 · 三栏控制台</p>
        </div>
      </div>
      <div class="tea-status" :class="tea.connected.value ? 'is-on' : tea.connecting.value ? 'is-connecting' : 'is-off'">
        <span class="status-dot"></span>
        {{ tea.statusLabel.value }}
      </div>
      <button v-if="tea.connected.value" class="tea-btn ghost" @click="handleDisconnect">断开</button>
      <button class="tea-btn ghost member-toggle" @click="rightPanelOpen = !rightPanelOpen">
        {{ rightPanelOpen ? '收起面板' : '成员/好友' }}
      </button>
    </header>

    <div class="tea-body">
      <!-- ══ 左栏：会话导航 ══ -->
      <aside class="tea-sidebar">
        <div class="sidebar-search">
          <span class="search-icon">🔍</span>
          <input v-model="search" class="search-input" placeholder="搜频道 / 搜好友" />
        </div>

        <!-- 公共频道 -->
        <div class="side-group">
          <div class="side-group-title">🏮 公共频道</div>
          <div
            v-for="ch in filteredPublic"
            :key="ch.id"
            class="channel-item"
            :class="{ active: isActive(ch) }"
            @click="switchChannel(ch)"
          >
            <span class="channel-icon">🏮</span>
            <div class="channel-meta">
              <span class="channel-name">{{ ch.name }}</span>
              <span class="channel-desc">{{ ch.desc }}</span>
            </div>
          </div>
        </div>

        <!-- 我的群（R10 群聊生态） -->
        <div class="side-group">
          <div class="side-group-title">👥 我的群 <button class="side-add-btn" title="创建群" @click.stop="openCreateGroup">＋</button></div>
          <div v-if="!filteredGroups.length" class="side-empty">暂无群 · 点 ＋ 创建一个</div>
          <div
            v-for="ch in filteredGroups"
            :key="ch.id"
            class="channel-item"
            :class="{ active: isActive(ch) }"
            @click="switchChannel(ch)"
          >
            <span class="channel-icon">👥</span>
            <div class="channel-meta">
              <span class="channel-name">{{ ch.name }}<span v-if="ch.groupRole === 2" class="role-badge">👑</span><span v-else-if="ch.groupRole === 1" class="role-badge">⭐</span></span>
              <span class="channel-desc">{{ ch.memberCount ? `共 ${ch.memberCount} 位群友` : ch.desc }}</span>
            </div>
            <span v-if="unreadMap[`${ch.type}:${ch.id}`]" class="unread-badge">{{ unreadMap[`${ch.type}:${ch.id}`] > 99 ? '99+' : unreadMap[`${ch.type}:${ch.id}`] }}</span>
          </div>
        </div>

        <!-- 最近私聊 -->
        <div class="side-group">
          <div class="side-group-title">💬 最近私聊</div>
          <div v-if="!filteredDms.length" class="side-empty">暂无私聊 · 右边好友点一下就能开聊</div>
          <div
            v-for="ch in filteredDms"
            :key="ch.id"
            class="channel-item"
            :class="{ active: isActive(ch) }"
            @click="switchChannel(ch)"
          >
            <span class="channel-icon">👤</span>
            <div class="channel-meta">
              <span class="channel-name">{{ ch.name }}</span>
              <span class="channel-desc">{{ ch.desc }}</span>
            </div>
            <span v-if="unreadMap[`${ch.type}:${ch.id}`]" class="unread-badge">{{ unreadMap[`${ch.type}:${ch.id}`] > 99 ? '99+' : unreadMap[`${ch.type}:${ch.id}`] }}</span>
          </div>
        </div>

        <div class="sidebar-foot">
          <span class="foot-hint">图片/短视频/文件 · 红包礼物 · 语音视频（陆续上桌）</span>
        </div>
      </aside>

      <!-- ══ 中栏：聊天窗口 ══ -->
      <section class="tea-chat">
        <div v-if="authFailed" class="chat-empty">
          <span class="empty-emoji">🔐</span>
          <p>请先登录昆仑镜，再进茶馆喝茶</p>
          <NuxtLink to="/" class="tea-btn primary go-login">去登录</NuxtLink>
        </div>
        <div v-else-if="!currentChannel" class="chat-empty">
          <span class="empty-emoji">🍵</span>
          <p>选一个频道，开始摆龙门阵</p>
        </div>
        <template v-else>
          <div class="chat-head">
            <div class="chat-head-main">
              <span class="chat-head-icon">{{ currentChannel.kind === 'dm' ? '👤' : (currentChannel.kind === 'group' ? '👥' : '🏮') }}</span>
              <div>
                <div class="chat-head-name">{{ currentChannel.name }}</div>
                <div class="chat-head-sub">{{ currentChannel.kind === 'group' ? `共 ${members.length} 位群友` : (members.length ? `共 ${members.length} 位茶客` : (currentChannel.kind === 'dm' ? '私聊' : '公共频道')) }}</div>
              </div>
            </div>
            <button v-if="currentChannel.kind === 'group'" class="chat-head-action" @click="openGroupManager">⚙️ 群管理</button>
          </div>
          <div ref="msgListRef" class="msg-list">
            <div
              v-for="msg in displayMessages"
              :key="msg.key"
              class="msg-row"
              :class="{ mine: msg.fromUID === tea.userId.value }"
              @contextmenu.prevent="openMsgMenu(msg, $event)"
              @mousedown="msgHoldStart(msg, $event)"
              @mouseup="msgHoldEnd"
              @mouseleave="msgHoldCancel"
              @touchstart.passive="msgTouchStart(msg, $event)"
              @touchend="msgTouchEnd"
              @touchmove.passive="msgTouchMove"
              @touchcancel="msgHoldCancel"
            >
              <div class="msg-avatar" :class="{ bot: msg.fromUID === 'kunlun_tea_bot' }">
                <img v-if="msgAvatar(msg)" :src="msgAvatar(msg)" alt="" />
                <span v-else>{{ (msgAuthorName(msg) || '茶').slice(0, 1) }}</span>
              </div>
              <div class="msg-main">
                <div class="msg-meta">
                  <span class="msg-author">{{ msgAuthorName(msg) }}</span>
                  <span class="msg-time">{{ fmtTime(msg.timestamp) }}</span>
                  <span class="msg-actions">
                    <button v-if="canRecall(msg)" class="msg-act" @click="recallMsg(msg)">↩ 撤回</button>
                    <button v-if="canTranslate(msg)" class="msg-act" @click="translateMsg(msg)">{{ msg.translating ? '…' : '译' }}</button>
                  </span>
                </div>
                <div class="msg-content" v-html="renderMsg(msg)"></div>
                <div v-if="msg.translation" class="msg-translation">📖 {{ msg.translation }}</div>
                <div v-if="msg.transcribing" class="msg-transcript">🔄 正在提炼文字…</div>
                <div v-else-if="msg.transcript" class="msg-transcript">📝 {{ msg.transcript }}</div>
              </div>
            </div>
            <div v-if="loadingHistory" class="msg-loading">正在烫茶…</div>
          </div>

          <div class="msg-input-bar">
            <!-- 微信风格输入栏：表情独立在外，其余功能收进 ➕（IM-CHA-M10.1） -->
            <button class="gift-btn emoji-btn" title="表情" @click.stop="toggleEmojiPanel">😊</button>
            <textarea
              v-if="!voiceMode"
              v-model="draft"
              class="msg-input"
              placeholder="和茶客们聊聊…（Enter 发送，Shift+Enter 换行）"
              rows="2"
              @keydown.enter.exact.prevent="handleSend"
            ></textarea>
            <div v-else class="voice-hold-wrap">
              <button
                class="voice-hold-btn"
                :class="{ 'voice-hold-btn--recording': recording }"
                :title="recording ? `录音中 ${recordingSeconds}s…` : '按住 说话'"
                @mousedown.prevent="startRecord"
                @mouseup="stopRecord"
                @mouseleave="cancelRecord"
                @touchstart.prevent="startRecord"
                @touchend="stopRecord"
                @touchcancel="cancelRecord"
              >{{ recording ? `🎤 松开发送 ${recordingSeconds}s` : '🎤 按住 说话' }}</button>
            </div>
            <button v-if="voiceMode" class="gift-btn kb-btn" title="切换到键盘" @click="toggleVoiceMode">⌨️</button>
            <button
              class="gift-btn plus-btn"
              :class="{ 'plus-btn--active': plusPanelOpen }"
              title="更多功能"
              @click.stop="togglePlusPanel"
            >＋</button>
            <button class="tea-btn primary" :disabled="(!draft.trim() && !sendingMedia) || !tea.connected.value" @click="handleSend">{{ sendingMedia ? '上传中…' : '发送' }}</button>
            <input ref="fileInputRef" type="file" class="hidden-file-input" @change="onFilePicked" />
            <Teleport to="body">
              <div v-if="emojiPanelOpen" class="emoji-panel" @click.stop>
                <div class="emoji-panel-grid">
                  <button v-for="e in emojiList" :key="e" class="emoji-cell" @click="insertEmoji(e)">{{ e }}</button>
                </div>
              </div>
              <div v-if="plusPanelOpen" class="plus-panel" @click.stop>
                <div class="plus-panel-grid">
                  <button class="plus-item" title="上传图片" @click="plusPanelOpen = false; pickFile('image')">📷<span>图片</span></button>
                  <button class="plus-item" title="上传文档" @click="plusPanelOpen = false; pickFile('file')">📄<span>文件</span></button>
                  <button class="plus-item" :class="{ 'plus-item--active': voiceMode }" title="语音消息（按住说话）" @click="toggleVoiceMode">🎤<span>语音</span></button>
                  <template v-if="currentChannel && currentChannel.kind === 'dm'">
                    <button class="plus-item" title="语音通话" @click="plusPanelOpen = false; callPeer('audio')">📞<span>语音通话</span></button>
                    <button class="plus-item" title="视频通话" @click="plusPanelOpen = false; callPeer('video')">🎥<span>视频通话</span></button>
                  </template>
                  <button class="plus-item" title="发红包" @click="plusPanelOpen = false; openRedPacketPanel()">🧧<span>红包</span></button>
                  <button class="plus-item" title="送礼物" @click="plusPanelOpen = false; openGiftPanel()">🎁<span>礼物</span></button>
                  <button class="plus-item" title="我的收藏" @click="plusPanelOpen = false; openFavPanel()">📌<span>收藏</span></button>
                </div>
              </div>
            </Teleport>
          </div>
        </template>
      </section>

      <!-- ══ IM-CHA-M10.4 消息长按/右键操作菜单（复制/收藏/转发） ══ -->
      <Teleport to="body">
        <div v-if="msgMenu" class="msg-menu-mask" @click="closeMsgMenu" @contextmenu.prevent="closeMsgMenu"></div>
        <div v-if="msgMenu" class="msg-menu" :style="{ left: msgMenu.x + 'px', top: msgMenu.y + 'px' }" @click.stop>
          <div v-if="msgMenu.canCopy" class="msg-menu-item" @click="copyMsg(msgMenu.msg)">📋 复制</div>
          <div class="msg-menu-item" @click="favMsg(msgMenu.msg)">⭐ 收藏</div>
          <div v-if="msgMenu.canForward" class="msg-menu-item" @click="openForward(msgMenu.msg)">↪ 转发</div>
        </div>
      </Teleport>

      <!-- ══ IM-CHA-M10.4 转发选择弹窗 ══ -->
      <Teleport to="body">
        <div v-if="forwardPanel" class="fwd-mask" @click.self="forwardPanel = false">
          <div class="fwd-modal">
            <div class="fwd-head">
              <span>↪ 转发到…</span>
              <button class="fwd-close" @click="forwardPanel = false">✕</button>
            </div>
            <div class="fwd-sub">{{ forwardPreview }}</div>
            <div class="fwd-list">
              <div v-for="t in forwardTargets" :key="t.key" class="fwd-item" @click="doForward(t)">
                <span class="fwd-item-icon">{{ t.kind === 'user' ? '👤' : '🏮' }}</span>
                <span class="fwd-item-name">{{ t.name }}</span>
                <span class="fwd-item-tag">{{ t.kind === 'user' ? '好友' : (t.kind === 'group' ? '群聊' : '频道') }}</span>
              </div>
              <div v-if="!forwardTargets.length" class="fwd-empty">暂无可转发目标（先去加个好友？）</div>
            </div>
          </div>
        </div>
      </Teleport>

      <!-- ══ IM-CHA-M10.4 收藏夹弹窗 ══ -->
      <Teleport to="body">
        <div v-if="favPanel" class="fwd-mask" @click.self="favPanel = false">
          <div class="fwd-modal fav-modal">
            <div class="fwd-head">
              <span>📌 我的收藏（{{ favList.length }}）</span>
              <button class="fwd-close" @click="favPanel = false">✕</button>
            </div>
            <div class="fav-list">
              <div v-for="f in favList" :key="f.id" class="fav-item">
                <div class="fav-item-main" @click="favPreview(f)">
                  <span class="fav-item-icon">{{ favIcon(f) }}</span>
                  <div class="fav-item-body">
                    <div class="fav-item-text" v-html="favText(f)"></div>
                    <div class="fav-item-meta">{{ favMeta(f) }}</div>
                  </div>
                </div>
                <div class="fav-item-ops">
                  <button v-if="favKind(f) === 1" class="fav-op" title="复制" @click="copyFav(f)">📋</button>
                  <button class="fav-op" title="取消收藏" @click="removeFav(f)">🗑</button>
                </div>
              </div>
              <div v-if="!favList.length" class="fwd-empty">还没有收藏 · 长按/右键消息选「收藏」</div>
            </div>
          </div>
        </div>
      </Teleport>

      <!-- ══ 创建群弹窗（R10） ══ -->
      <div v-if="createGroupOpen" class="gift-modal-mask grp-modal-mask" @click.self="createGroupOpen = false">
        <div class="gift-modal grp-modal">
          <div class="gift-modal-head">
            <div class="gift-modal-title">👥 创建群</div>
            <button class="gift-modal-close" @click="createGroupOpen = false">✕</button>
          </div>
          <div class="grp-form">
            <label class="grp-label">群名称 <em>*</em></label>
            <input v-model="createGroupName" class="grp-input" maxlength="30" placeholder="给群起个名字（30 字内）" />
            <label class="grp-label">群简介</label>
            <textarea v-model="createGroupIntro" class="grp-input grp-textarea" maxlength="200" placeholder="一句话介绍这个群（选填）"></textarea>
            <div class="grp-tip">创建后「昆仑镜小管家」自动入群隐身执勤（敏感词自动处置）</div>
            <div v-if="createGroupError" class="grp-error">{{ createGroupError }}</div>
          </div>
          <div class="gift-modal-foot">
            <button class="gift-modal-cancel" @click="createGroupOpen = false">取消</button>
            <button class="gift-modal-send" :disabled="createGroupBusy" @click="createGroup">{{ createGroupBusy ? '创建中…' : '创建' }}</button>
          </div>
        </div>
      </div>

      <!-- ══ 群管理弹窗（R10：群主/管理员/成员三级权限 + 申请流） ══ -->
      <div v-if="groupManagerOpen" class="gift-modal-mask grp-modal-mask" @click.self="closeGroupManager">
        <div class="gift-modal grp-manager-modal grp-modal">
          <div class="gift-modal-head">
            <div class="gift-modal-title">⚙️ 群管理 · {{ groupDetail?.group?.name || '' }}</div>
            <button class="gift-modal-close" @click="closeGroupManager">✕</button>
          </div>

          <div v-if="groupManagerTab === 'info'" class="grp-mgr-body">
            <!-- 群信息 -->
            <div class="grp-mgr-info">
              <div class="grp-info-row"><span class="grp-info-key">群简介</span><span class="grp-info-val">{{ groupDetail?.group?.intro || '—' }}</span></div>
              <div class="grp-info-row"><span class="grp-info-key">群主</span><span class="grp-info-val">{{ groupOwnerName }}</span></div>
              <div class="grp-info-row"><span class="grp-info-key">成员</span><span class="grp-info-val">{{ groupDetail?.members?.length || 0 }} 位</span></div>
            </div>

            <!-- 我的角色操作 -->
            <div class="grp-mgr-actions">
              <button v-if="groupMyRole >= 1" class="grp-act" @click="groupManagerTab = 'members'">👥 成员管理</button>
              <button v-if="groupMyRole >= 1" class="grp-act" @click="openGroupApplies">📋 申请审批<template v-if="pendingApplyCount"> ({{ pendingApplyCount }})</template></button>
              <button v-if="groupMyRole >= 1" class="grp-act" @click="groupManagerTab = 'edit'">✏️ 修改群信息</button>
              <button v-if="groupMyRole === 0" class="grp-act" @click="applyGroupAdmin">🙋 申请群管理</button>
              <button v-if="groupMyRole === 2" class="grp-act grp-act-danger" @click="dissolveGroup">🗑️ 解散群</button>
            </div>
            <div v-if="groupMyRole === 2" class="grp-tip">群主可设/撤管理员、移出成员、审批申请、解散群</div>
            <div v-else-if="groupMyRole === 1" class="grp-tip">管理员可邀请成员、移出普通成员、审批申请</div>
            <div v-else class="grp-tip">向群主申请成为管理员，协助打理群聊</div>
          </div>

          <!-- 修改群信息 -->
          <div v-else-if="groupManagerTab === 'edit'" class="grp-mgr-body">
            <label class="grp-label">群名称</label>
            <input v-model="groupEditName" class="grp-input" maxlength="30" />
            <label class="grp-label">群简介</label>
            <textarea v-model="groupEditIntro" class="grp-input grp-textarea" maxlength="200"></textarea>
            <div v-if="groupEditError" class="grp-error">{{ groupEditError }}</div>
            <div class="gift-modal-foot grp-mgr-foot">
              <button class="gift-modal-cancel" @click="groupManagerTab = 'info'">返回</button>
              <button class="gift-modal-send" :disabled="groupEditBusy" @click="updateGroup">{{ groupEditBusy ? '保存中…' : '保存' }}</button>
            </div>
          </div>

          <!-- 成员管理 -->
          <div v-else-if="groupManagerTab === 'members'" class="grp-mgr-body">
            <div class="grp-mgr-toolbar">
              <button class="grp-act" @click="groupManagerTab = 'invite'">➕ 邀请成员</button>
              <span class="grp-mgr-count">共 {{ groupDetail?.members?.length || 0 }} 人</span>
            </div>
            <div v-for="m in groupDetail?.members || []" :key="m.uid" class="grp-member-row">
              <div class="member-avatar"><img v-if="m.avatar" :src="m.avatar" alt="" /><span v-else>{{ (m.name || '?').slice(0, 1) }}</span></div>
              <div class="member-meta grp-member-meta">
                <span class="member-name">{{ m.name || shortUid(m.uid) }} <span v-if="m.uid === 'kunlun_tea_bot'" class="bot-badge">🤖 AI 客服</span><span v-else-if="m.role === 2" class="role-badge">👑 群主</span><span v-else-if="m.role === 1" class="role-badge">⭐ 管理员</span></span>
                <span class="member-sub">{{ m.isBot ? '隐身执勤 · 敏感词自动处置' : (m.online ? '在线' : '离线') }}</span>
              </div>
              <div v-if="groupMyRole === 2 && m.uid !== tea.userId.value && m.uid !== 'kunlun_tea_bot'" class="grp-member-ops">
                <button v-if="m.role === 1" class="grp-op" title="取消管理员" @click="setMemberRole(m.uid, 0)">📉</button>
                <button v-else class="grp-op" title="设为管理员" @click="setMemberRole(m.uid, 1)">⭐</button>
                <button class="grp-op" title="移出群" @click="kickMember(m.uid)">🚪</button>
              </div>
              <div v-else-if="groupMyRole === 1 && m.role === 0 && m.uid !== 'kunlun_tea_bot'" class="grp-member-ops">
                <button class="grp-op" title="移出群" @click="kickMember(m.uid)">🚪</button>
              </div>
            </div>
          </div>

          <!-- 邀请成员 -->
          <div v-else-if="groupManagerTab === 'invite'" class="grp-mgr-body">
            <div class="grp-mgr-toolbar">
              <button class="grp-act" @click="groupManagerTab = 'members'">← 返回成员</button>
              <span class="grp-mgr-count">从茶客名录选择（已入群自动跳过）</span>
            </div>
            <div class="grp-invite-search"><input v-model="groupInviteSearch" class="grp-input" placeholder="搜茶客昵称…" /></div>
            <div v-for="u in filteredInviteUsers" :key="u.id" class="grp-member-row">
              <div class="member-avatar"><img v-if="u.avatar" :src="u.avatar" alt="" /><span v-else>{{ (u.name || '?').slice(0, 1) }}</span></div>
              <div class="member-meta grp-member-meta">
                <span class="member-name">{{ u.name || shortUid(u.id) }}</span>
                <span class="member-sub">{{ u.online ? '在线' : '离线' }}</span>
              </div>
              <button v-if="!groupMemberUidSet.has(u.id)" class="grp-act grp-invite-btn" :disabled="groupInviteBusy" @click="inviteMember(u.id)">邀请</button>
              <span v-else class="grp-invited">已入群 ✓</span>
            </div>
            <div v-if="!filteredInviteUsers.length" class="grp-mgr-empty">茶客名录暂无其他茶客</div>
          </div>

          <!-- 申请审批 -->
          <div v-else-if="groupManagerTab === 'applies'" class="grp-mgr-body">
            <div class="grp-mgr-toolbar">
              <button class="grp-act" @click="groupManagerTab = 'info'">← 返回</button>
              <span class="grp-mgr-count">群管理申请</span>
            </div>
            <div v-for="a in groupApplies" :key="a.id" class="grp-member-row">
              <div class="member-avatar"><img v-if="a.avatar" :src="a.avatar" alt="" /><span v-else>{{ (a.name || '?').slice(0, 1) }}</span></div>
              <div class="member-meta grp-member-meta">
                <span class="member-name">{{ a.name || shortUid(a.uid) }}</span>
                <span class="member-sub">{{ a.status === 'pending' ? (a.reason ? `申请理由：${a.reason}` : '等待审批') : (a.status === 'approved' ? '已通过' : '已拒绝') }}</span>
              </div>
              <div v-if="a.status === 'pending'" class="grp-member-ops">
                <button class="grp-op grp-op-ok" title="通过" @click="handleApply(a.id, true)">✓</button>
                <button class="grp-op grp-op-no" title="拒绝" @click="handleApply(a.id, false)">✕</button>
              </div>
            </div>
            <div v-if="!groupApplies.length" class="grp-mgr-empty">暂无申请</div>
          </div>
        </div>
      </div>

      <!-- ══ 礼物弹窗（抖音式礼物墙 + 钻石余额 + 充值） ══ -->
      <div v-if="giftPanelOpen" class="gift-modal-mask" @click.self="giftPanelOpen = false">
        <div class="gift-modal">
          <div class="gift-modal-head">
            <div class="gift-modal-title">🎁 送礼物</div>
            <div class="gift-diamond-balance">
              <span class="gift-diamond-icon">💎</span>
              <span class="gift-diamond-num">{{ diamondBalance }}</span>
              <router-link to="/user/diamonds" class="gift-recharge-btn">充值</router-link>
            </div>
            <button class="gift-modal-close" @click="giftPanelOpen = false">✕</button>
          </div>

          <!-- 接收人选择（非私聊需指定茶客） -->
          <div v-if="!isDmChannel" class="gift-receiver-row">
            <span class="gift-receiver-label">送给</span>
            <div class="gift-receiver-list">
              <button
                v-for="m in members"
                :key="m.uid"
                :class="['gift-receiver-chip', giftReceiverUid === m.uid ? 'gift-receiver-chip--active' : '']"
                @click="giftReceiverUid = m.uid"
              >{{ m.name || m.uid.slice(0, 6) }}</button>
              <span v-if="!members.length" class="gift-receiver-empty">暂无在线茶客</span>
            </div>
          </div>

          <!-- 礼物墙：分类 tab + 格子 -->
          <div class="gift-wall">
            <div class="gift-tabs">
              <button
                v-for="g in giftGroups"
                :key="g.category"
                :class="['gift-tab', giftActiveTab === g.category ? 'gift-tab--active' : '']"
                @click="giftActiveTab = g.category"
              >{{ g.category }}</button>
            </div>
            <div class="gift-grid">
              <button
                v-for="g in activeGiftItems"
                :key="g.id"
                :class="['gift-item', giftSelected?.id === g.id ? 'gift-item--active' : '']"
                @click="giftSelected = g"
              >
                <span
                  class="gift-item-icon"
                  :style="{ background: g.iconGradient || 'linear-gradient(135deg,#1e293b,#334155)' }"
                >{{ g.iconUrl || '🎁' }}</span>
                <span class="gift-item-name">{{ g.name }}</span>
                <span class="gift-item-price">💎{{ g.priceDiamonds }}</span>
              </button>
              <div v-if="!activeGiftItems.length" class="gift-grid-empty">该分类暂无礼物</div>
            </div>
          </div>

          <div class="gift-modal-foot">
            <div class="gift-foot-info">
              <template v-if="giftSelected">
                <span class="gift-foot-name">{{ giftSelected.iconUrl }} {{ giftSelected.name }}</span>
                <span class="gift-foot-price">💎 {{ giftSelected.priceDiamonds }}</span>
              </template>
              <span v-else class="gift-foot-empty">选择一份礼物</span>
            </div>
            <button
              class="gift-send-btn"
              :disabled="!giftSelected || !giftReceiverOk || giftSending"
              @click="sendGift"
            >
              {{ giftSending ? '发送中...' : (!giftSelected ? '选择礼物' : (!giftReceiverOk ? '选择接收人' : '赠送')) }}
            </button>
          </div>
        </div>
      </div>

      <!-- ══ 礼物全屏动画（收到/送出时播放） ══ -->
      <div v-if="giftAnimation" class="gift-anim">
        <div
          class="gift-anim-icon"
          :style="giftAnimation.iconGradient ? { background: giftAnimation.iconGradient } : {}"
        >{{ giftAnimation.icon || '🎁' }}</div>
        <div class="gift-anim-name">{{ giftAnimation.name }}</div>
        <div class="gift-anim-from">{{ giftAnimation.fromName }} 送给 {{ giftAnimation.toName }}</div>
      </div>

      <!-- ══ 发红包弹窗（IM-CHA-M6：钻石支付，拼手气/普通） ══ -->
      <div v-if="rpPanelOpen" class="gift-modal-mask" @click.self="rpPanelOpen = false">
        <div class="gift-modal rp-modal">
          <div class="gift-modal-head">
            <div class="gift-modal-title">🧧 发红包</div>
            <div class="gift-diamond-balance">
              <span class="gift-diamond-icon">💎</span>
              <span class="gift-diamond-num">{{ diamondBalance }}</span>
              <router-link to="/user/diamonds" class="gift-recharge-btn">充值</router-link>
            </div>
            <button class="gift-modal-close" @click="rpPanelOpen = false">✕</button>
          </div>
          <div class="rp-body">
            <!-- 私聊 = 直接红包（微信风格）：固定金额单个，无拼手气/个数 -->
            <div v-if="!isDmChannel" class="rp-mode-row">
              <button :class="['rp-mode-btn', rpForm.mode === 'lucky' ? 'is-on' : '']" @click="rpForm.mode = 'lucky'">
                <span class="rp-mode-icon">🎲</span>拼手气红包
                <small>每人随机</small>
              </button>
              <button :class="['rp-mode-btn', rpForm.mode === 'normal' ? 'is-on' : '']" @click="rpForm.mode = 'normal'">
                <span class="rp-mode-icon">⚖️</span>普通红包
                <small>每人一样</small>
              </button>
            </div>
            <div class="rp-field">
              <label>{{ isDmChannel ? '金额' : '单个金额' }}</label>
              <div class="rp-amount-row">
                <div class="rp-amount-box">
                  <input v-model.number="rpForm.amount" type="number" min="1" class="rp-amount-input" />
                  <span class="rp-amount-unit">💎 钻石</span>
                </div>
                <div class="rp-quick">
                  <button v-for="q in rpQuickAmounts" :key="q" class="rp-quick-btn" @click="rpForm.amount = q">{{ q }}</button>
                </div>
              </div>
            </div>
            <div v-if="!isDmChannel" class="rp-field">
              <label>红包个数</label>
              <div class="rp-amount-box">
                <input v-model.number="rpForm.count" type="number" min="1" max="200" class="rp-amount-input" />
                <span class="rp-amount-unit">个</span>
              </div>
            </div>
            <div class="rp-field">
              <label>祝福语</label>
              <input v-model="rpForm.note" maxlength="30" class="rp-note-input" placeholder="恭喜发财，大吉大利！" />
            </div>
            <div class="rp-total-hint">共 <b class="rp-total-num">{{ rpForm.amount * rpForm.count }}</b> 钻石</div>
          </div>
          <div class="gift-modal-foot">
            <div class="gift-foot-info">
              <span v-if="rpForm.amount * rpForm.count > diamondBalance" class="rp-warn">钻石不足，先去充值</span>
              <span v-else class="gift-foot-empty">钻石在账户里实时扣除</span>
            </div>
            <button
              class="gift-send-btn rp-send-btn"
              :disabled="rpSending || !rpForm.amount || !rpForm.count || rpForm.amount * rpForm.count > diamondBalance || rpForm.amount * rpForm.count < rpForm.count"
              @click="sendRedPacket"
            >
              {{ rpSending ? '塞钱中…' : '塞钱进红包' }}
            </button>
          </div>
        </div>
      </div>

      <!-- ══ 抢红包弹窗 ══ -->
      <div v-if="rpDetail" class="gift-modal-mask" @click.self="closeRpDetail">
        <div class="gift-modal rp-detail-modal">
          <div class="rp-detail-top">
            <div class="rp-big-envelope" :class="{ 'is-opened': rpDetail.mine }" @click="grabRedPacket">
              <template v-if="rpGrabbing">
                <div class="rp-big-msg">拆开红包…</div>
              </template>
              <template v-else-if="rpDetail.mine">
                <div class="rp-big-amount">+{{ rpDetail.mine.amount }}<small>钻石</small></div>
              </template>
              <template v-else-if="rpDetail.status === 'completed' || rpDetail.remainCount <= 0">
                <div class="rp-big-msg">{{ rpDetail.dm ? '红包已被领取' : '😅 手慢了，被抢完了' }}</div>
              </template>
              <template v-else-if="rpDetail.status === 'refunded'">
                <div class="rp-big-msg">🕰️ 已过期退回</div>
              </template>
              <template v-else>
                <span class="rp-big-open">開</span>
              </template>
            </div>
            <div class="rp-detail-note">{{ rpDetail.note || '恭喜发财，大吉大利！' }}</div>
            <div class="rp-detail-from">{{ rpDetail.sender?.name || '茶客' }} 的红包</div>
            <div v-if="rpDetail.dm" class="rp-detail-remain">共 {{ rpDetail.totalDiamonds }} 钻石{{ rpDetail.mine ? ' · 已领取' : ' · 待领取' }}</div>
            <div v-else class="rp-detail-remain">剩 {{ rpDetail.remainCount }} 个 · {{ rpDetail.remainDiamonds }} 钻石</div>
          </div>
          <div class="rp-detail-grabs">
            <div class="rp-grabs-title">{{ rpDetail.dm ? '领取记录' : '抢红包记录' }}</div>
            <div v-if="!rpDetail.grabs.length" class="rp-grabs-empty">{{ rpDetail.dm ? '还没有领取' : '还没有人抢到' }}</div>
            <div v-for="g in rpDetail.grabs" :key="g.userId" class="rp-grab-item">
              <div class="msg-avatar rp-grab-avatar">
                <img v-if="g.avatar" :src="g.avatar" alt="" />
                <span v-else>{{ (g.name || '茶').slice(0, 1) }}</span>
              </div>
              <span class="rp-grab-name">{{ g.name }}<span v-if="g.userId === rpDetail.mine?.userId || g.userId === tea.userId.value" class="rp-mine-tag">我</span></span>
              <span class="rp-grab-amt">+{{ g.amount }} 💎</span>
            </div>
          </div>
          <div class="gift-modal-foot rp-detail-foot">
            <div class="gift-foot-info"><span class="gift-foot-empty">{{ rpDetail.totalDiamonds }} 钻石{{ rpDetail.dm ? '' : ' · ' + rpDetail.count + ' 个' }}</span></div>
            <button class="gift-send-btn" @click="closeRpDetail">收下</button>
          </div>
        </div>
      </div>

      <!-- ══ 红包开启动画（全屏） ══ -->
      <div v-if="rpAnim" class="rp-anim">
        <div class="rp-anim-envelope">🧧</div>
        <div class="rp-anim-amount">+{{ rpAnim.amount }}</div>
        <div class="rp-anim-unit">钻石</div>
        <div class="rp-anim-note">{{ rpAnim.note || '恭喜发财，大吉大利！' }}</div>
      </div>

      <!-- ══ 右栏：成员 / 好友 ══ -->
      <aside class="tea-panel" :class="{ open: rightPanelOpen }">
        <div class="panel-tabs">
          <button class="panel-tab" :class="{ active: rightTab === 'members' }" @click="rightTab = 'members'">成员</button>
          <button class="panel-tab" :class="{ active: friendPanel }" @click.stop="toggleFriendPanel">好友</button>
        </div>

        <!-- 成员 tab：资料卡（好友菜单查看资料） > 私聊资料卡 > 频道成员列表 -->
        <div v-if="rightTab === 'members'" class="panel-body">
          <template v-if="profileUser">
            <div class="peer-card">
              <div class="peer-avatar"><img v-if="profileUser.avatar" :src="profileUser.avatar" alt="" /><span v-else>{{ profileUser.name.slice(0, 1) }}</span></div>
              <div class="peer-name">{{ profileUser.name }}</div>
              <div class="peer-sub">{{ profileUser.email || '平台茶客 · 茶馆名录' }}</div>
              <div class="peer-badge" :class="{ online: profileUser.online }">
                <span class="status-dot"></span>{{ profileUser.online ? '在线' : '离线' }}
              </div>
              <button class="profile-follow-btn" :class="{ following: followStatus[profileUser.id] }" @click="toggleFollowId(profileUser.id)">{{ followStatus[profileUser.id] ? '✓ 已关注' : '+ 关注' }}</button>
            </div>
          </template>
          <template v-else-if="currentChannel && currentChannel.kind === 'dm'">
            <div class="peer-card">
              <div class="peer-avatar"><img v-if="peerInfo?.avatar || currentChannel.avatar" :src="peerInfo?.avatar || currentChannel.avatar" alt="" /><span v-else>{{ (peerInfo?.name || currentChannel.name || '?').slice(0, 1) }}</span></div>
              <div class="peer-name">{{ peerInfo?.name || currentChannel.name }}</div>
              <div class="peer-sub">{{ peerInfo?.email || '私聊 · 一对一说悄悄话' }}</div>
              <div class="peer-badge" :class="{ online: peerOnline }">
                <span class="status-dot"></span>{{ peerOnline ? '在线' : '离线' }}
              </div>
            </div>
          </template>
          <template v-else>
            <div class="panel-section-title">在线 ({{ onlineMembers.length }})</div>
            <div v-if="!onlineMembers.length" class="panel-empty">暂时没有在线茶客</div>
            <div v-for="m in onlineMembers" :key="m.uid" class="member-item clickable" @click="openMemberCard(m, $event)">
              <div class="member-avatar"><img v-if="m.avatar" :src="m.avatar" alt="" /><span v-else>{{ (m.name || '?').slice(0, 1) }}</span></div>
              <div class="member-meta">
                <span class="member-name">{{ m.name || shortUid(m.uid) }} <span v-if="m.uid === 'kunlun_tea_bot'" class="bot-badge">🤖</span><span v-else-if="m.role === 2" class="role-badge">👑</span><span v-else-if="m.role === 1" class="role-badge">⭐</span></span>
                <span class="member-sub">在线</span>
              </div>
            </div>
            <div class="panel-section-title">全部 ({{ members.length }})</div>
            <div v-if="!members.length" class="panel-empty">暂无成员</div>
            <div v-for="m in members" :key="m.uid" class="member-item clickable" @click="openMemberCard(m, $event)">
              <div class="member-avatar"><img v-if="m.avatar" :src="m.avatar" alt="" /><span v-else>{{ (m.name || '?').slice(0, 1) }}</span></div>
              <div class="member-meta">
                <span class="member-name">{{ m.name || shortUid(m.uid) }} <span v-if="m.uid === 'kunlun_tea_bot'" class="bot-badge">🤖 AI 客服</span><span v-else-if="m.role === 2" class="role-badge">👑 群主</span><span v-else-if="m.role === 1" class="role-badge">⭐ 管理员</span></span>
                <span class="member-sub">{{ m.uid === 'kunlun_tea_bot' ? '随时在线 · 喊「小管家」' : (m.status === 1 ? '在线' : '离线') }}</span>
              </div>
            </div>
          </template>
        </div>
      </aside>

      <!-- ══ 好友独立下拉框：Teleport 到 body + fixed，列表在框内滚动，绝不影响聊天页面 ══ -->
      <Teleport to="body">
        <div v-if="friendPanel" class="friend-panel" @click.stop>
          <div class="friend-panel-head">
            <div class="friend-panel-tabs">
              <button class="friend-panel-tab" :class="{ active: friendTab === 'following' }" @click="switchFriendTab('following')">关注 {{ followStats.followingCount }}</button>
              <button class="friend-panel-tab" :class="{ active: friendTab === 'follower' }" @click="switchFriendTab('follower')">粉丝 {{ followStats.followerCount }}</button>
              <button class="friend-panel-tab" :class="{ active: friendTab === 'directory' }" @click="switchFriendTab('directory')">茶客名录</button>
            </div>
            <button class="friend-panel-close" @click="toggleFriendPanel">✕</button>
          </div>
          <input v-if="friendTab === 'directory'" v-model="friendSearch" class="friend-panel-search" placeholder="搜茶客…" />
          <div class="friend-panel-list" @wheel.stop>
            <!-- 我的关注（含互相关注） -->
            <template v-if="friendTab === 'following'">
              <div v-if="followLoading" class="panel-empty">加载中…</div>
              <div v-else-if="!followUsers.length" class="panel-empty">还没有关注任何人 · 去茶客名录看看</div>
              <div v-for="u in followUsers" :key="u.id" class="member-item">
                <div class="member-avatar"><img v-if="u.avatar" :src="u.avatar" alt="" /><span v-else>{{ (u.name || '?').slice(0, 1) }}</span></div>
                <div class="member-meta">
                  <span class="member-name">{{ u.name }}
                    <span v-if="u.relation === 'mutual'" class="rel-badge rel-mutual">互相关注</span>
                    <span v-else class="rel-badge rel-following">已关注</span>
                  </span>
                  <span class="member-sub"><span class="mini-dot" :class="{ on: u.online }"></span>{{ u.online ? '在线' : (u.email || '离线') }}</span>
                </div>
                <div class="member-actions">
                  <button class="mini-act-btn" @click="menuSend(u)">💬</button>
                  <button class="mini-follow-btn following" @click="toggleFollowUser(u)">{{ u.relation === 'mutual' ? '互相关注' : '已关注' }}</button>
                </div>
              </div>
            </template>
            <!-- 粉丝（关注我的，可回关） -->
            <template v-else-if="friendTab === 'follower'">
              <div v-if="followLoading" class="panel-empty">加载中…</div>
              <div v-else-if="!followerUsers.length" class="panel-empty">还没有粉丝 · 去茶馆坐坐吧</div>
              <div v-for="u in followerUsers" :key="u.id" class="member-item">
                <div class="member-avatar"><img v-if="u.avatar" :src="u.avatar" alt="" /><span v-else>{{ (u.name || '?').slice(0, 1) }}</span></div>
                <div class="member-meta">
                  <span class="member-name">{{ u.name }}
                    <span v-if="u.relation === 'mutual'" class="rel-badge rel-mutual">互相关注</span>
                    <span v-else class="rel-badge rel-follower">关注了我</span>
                  </span>
                  <span class="member-sub"><span class="mini-dot" :class="{ on: u.online }"></span>{{ u.online ? '在线' : (u.email || '离线') }}</span>
                </div>
                <div class="member-actions">
                  <button class="mini-act-btn" @click="menuSend(u)">💬</button>
                  <button class="mini-follow-btn" @click="toggleFollowUser(u)">{{ u.relation === 'mutual' ? '互相关注' : '回关' }}</button>
                </div>
              </div>
            </template>
            <!-- 茶客名录（全部用户，可搜索 + 关注） -->
            <template v-else>
              <div v-if="!filteredUsers.length" class="panel-empty">没有匹配的茶客</div>
              <div
                v-for="u in filteredUsers"
                :key="u.id"
                class="member-item clickable"
                :class="{ active: currentChannel?.kind === 'dm' && currentChannel.peerUid === u.id }"
                @click="openFriendMenu(u, $event)"
              >
                <div class="member-avatar"><img v-if="u.avatar" :src="u.avatar" alt="" /><span v-else>{{ u.name.slice(0, 1) }}</span></div>
                <div class="member-meta">
                  <span class="member-name">{{ u.name }}</span>
                  <span class="member-sub">
                    <span class="mini-dot" :class="{ on: u.online }"></span>{{ u.online ? '在线' : (u.email || '离线') }}
                  </span>
                </div>
                <div class="member-actions" @click.stop>
                  <button class="mini-follow-btn" :class="{ following: followStatus[u.id] }" @click="toggleFollowId(u.id)">{{ followStatus[u.id] ? '已关注' : '+ 关注' }}</button>
                </div>
              </div>
            </template>
          </div>
          <div class="friend-panel-foot">{{ friendTab === 'directory' ? '点茶客弹出菜单 · Esc 关闭' : '单方面关注 · 互相关注成好友' }}</div>
        </div>
      </Teleport>

      <!-- ══ 成员头像卡片：公共频道点成员弹出，可关注 / 发消息 ══ -->
      <Teleport to="body">
        <div v-if="memberCard" class="member-card" :style="{ left: memberCard.x + 'px', top: memberCard.y + 'px' }" @click.stop>
          <div class="mc-head">
            <div class="mc-avatar"><img v-if="memberCard.m.avatar" :src="memberCard.m.avatar" alt="" /><span v-else>{{ (memberCard.m.name || '?').slice(0, 1) }}</span></div>
            <div class="mc-meta">
              <div class="mc-name">{{ memberCard.m.name || shortUid(memberCard.m.uid) }}
                <span v-if="memberCard.m.role === 2" class="bot-badge">🤖</span>
              </div>
              <div class="mc-sub">
                <span class="status-dot" :class="{ on: memberCard.m.status === 1 }"></span>{{ memberCard.m.status === 1 ? '在线' : '离线' }}
                <span class="mc-platform">昆仑茶馆茶客</span>
              </div>
            </div>
            <button class="mc-close" @click="closeMemberCard">✕</button>
          </div>
          <div class="mc-body">
            <button class="mc-follow-btn" :class="{ following: followStatus[memberCard.m.uid] }" :disabled="followBusyId === memberCard.m.uid" @click="toggleFollowId(memberCard.m.uid)">{{ followStatus[memberCard.m.uid] ? '✓ 已关注' : '+ 关注' }}</button>
            <button class="mc-msg-btn" @click="menuSend({ id: memberCard.m.uid, email: '', name: memberCard.m.name || shortUid(memberCard.m.uid) })">💬 发消息</button>
          </div>
        </div>
      </Teleport>

      <!-- 好友悬浮下拉菜单：独立弹层（fixed），不撑页面 / 不触发整页滚动 -->
      <Teleport to="body">
        <div
          v-if="friendMenu"
          class="friend-menu"
          :style="{ left: friendMenu.x + 'px', top: friendMenu.y + 'px' }"
          @click.stop
        >
          <div class="friend-menu-head">
            <div class="friend-menu-avatar"><img v-if="friendMenu.user.avatar" :src="friendMenu.user.avatar" alt="" /><span v-else>{{ friendMenu.user.name.slice(0, 1) }}</span></div>
            <div class="friend-menu-meta">
              <div class="friend-menu-name">{{ friendMenu.user.name }}</div>
              <div class="friend-menu-sub">
                <span class="mini-dot" :class="{ on: friendMenu.user.online }"></span>
                {{ friendMenu.user.online ? '在线' : (friendMenu.user.email || '离线') }}
              </div>
            </div>
          </div>
          <button class="friend-menu-item" @click="menuSend(friendMenu.user)">💬 发消息</button>
          <button class="friend-menu-item" @click="menuProfile(friendMenu.user)">👤 查看资料</button>
        </div>
      </Teleport>

      <!-- ══ R11 语音/视频 1v1 ══ -->
      <!-- 来电弹窗（被叫） -->
      <Teleport to="body">
        <div v-if="rtc.state.value === 'incoming'" class="rtc-incoming-mask">
          <div class="rtc-incoming-card">
            <div class="rtc-incoming-avatar">
              <img v-if="rtc.peer.value?.avatar" :src="rtc.peer.value.avatar" alt="" />
              <span v-else>{{ (rtc.peer.value?.name || '?').slice(0, 1) }}</span>
            </div>
            <div class="rtc-incoming-name">{{ rtc.peer.value?.name || '茶客' }}</div>
            <div class="rtc-incoming-sub">{{ rtc.mode.value === 'video' ? '🎥 邀请你视频通话' : '📞 邀请你语音通话' }}</div>
            <div class="rtc-incoming-actions">
              <button class="rtc-btn rtc-btn-reject" @click="rtc.rejectCall('declined')">✕ 拒绝</button>
              <button class="rtc-btn rtc-btn-accept" @click="rtc.acceptCall()">✓ 接听</button>
            </div>
          </div>
        </div>
      </Teleport>

      <!-- 通话浮层（主叫等待/建立中/通话中） -->
      <Teleport to="body">
        <div v-if="['calling','connecting','active'].includes(rtc.state.value)" class="rtc-call-mask">
          <div class="rtc-call-stage">
            <!-- 对方画面（视频模式通话中） -->
            <video v-if="rtc.mode.value === 'video' && rtc.remoteStream.value && rtc.state.value === 'active'" ref="rtcRemoteVideoRef" class="rtc-remote-video" autoplay playsinline></video>
            <!-- 语音模式：隐藏 video 承载远端音频（autoplay 播放，头像展示） -->
            <video v-if="rtc.mode.value === 'audio' && rtc.remoteStream.value && rtc.state.value === 'active'" ref="rtcRemoteAudioVideoRef" class="rtc-remote-audio-video" autoplay playsinline></video>
            <!-- 音频/等待：对方头像 + 状态 -->
            <div v-else class="rtc-remote-avatar">
              <img v-if="rtc.peer.value?.avatar" :src="rtc.peer.value.avatar" alt="" />
              <span v-else>{{ (rtc.peer.value?.name || '?').slice(0, 1) }}</span>
              <div class="rtc-status-text">
                <template v-if="rtc.state.value === 'calling'">正在呼叫…</template>
                <template v-else-if="rtc.state.value === 'connecting'">正在接通…</template>
                <template v-else-if="rtc.state.value === 'active'">{{ rtc.mode.value === 'video' ? '视频通话中' : '语音通话中' }}</template>
              </div>
            </div>
            <!-- 本地预览（PiP 小窗：视频模式显示；音频模式隐藏画面） -->
            <video v-if="rtc.mode.value === 'video' && rtc.localStream.value" ref="rtcLocalVideoRef" class="rtc-local-video" autoplay playsinline muted></video>
            <!-- 通话信息条 -->
            <div class="rtc-call-head">
              <div class="rtc-call-peer">{{ rtc.peer.value?.name || '茶客' }}</div>
              <div class="rtc-call-dur" v-if="rtc.state.value === 'active'">{{ rtcDurText }}</div>
            </div>
            <!-- 错误/状态提示 -->
            <div v-if="rtcToast" class="rtc-toast">{{ rtcToast }}</div>
            <!-- 控制条 -->
            <div class="rtc-controls">
              <button class="rtc-ctl" :class="{ off: rtc.micMuted.value }" :title="rtc.micMuted.value ? '取消静音' : '静音'" @click="rtc.toggleMic()">{{ rtc.micMuted.value ? '🔇' : '🎙️' }}</button>
              <button v-if="rtc.mode.value === 'video'" class="rtc-ctl" :class="{ off: rtc.camOff.value }" :title="rtc.camOff.value ? '打开摄像头' : '关闭摄像头'" @click="rtc.toggleCam()">{{ rtc.camOff.value ? '🚫' : '📷' }}</button>
              <button class="rtc-ctl rtc-ctl-hangup" title="挂断" @click="rtc.hangup()">📵</button>
            </div>
          </div>
        </div>
      </Teleport>
    </div>
  </div>
</template>

<script setup lang="ts">
// 昆仑茶馆 — 三栏控制台（SPRINT-IM-CHA-02）
// 左栏：会话导航（公共频道 / 我的频道 / 最近私聊）｜中栏：聊天｜右栏：成员 / 好友
// SDK 仅浏览器可用，SSR 阶段不渲染逻辑
import { ref, reactive, computed, onMounted, onBeforeUnmount, nextTick, watch, watchEffect } from 'vue'
import { useRoute } from 'vue-router'
import { useKunlunTea } from '~/composables/useKunlunTea'
import { useRtcCall } from '~/composables/useRtcCall'

const tea = useKunlunTea()
// ══ R11 语音/视频 1v1 ════════════════════════════════
const rtc = useRtcCall(tea)
let rtcSetIdentity: (uid: string, name: string, avatar: string) => void = () => {}
const rtcToast = ref('') // 通话浮层内提示（错误/状态）
const route = useRoute()
const channels = ref<any[]>([])
const groups = ref<any[]>([])
const dms = ref<any[]>([])
// 私聊未读红点（非当前频道收到消息时累计，打开频道清零）
const unreadMap = reactive<Record<string, number>>({})
const currentChannel = ref<any>(null)
const messages = ref<any[]>([])
const members = ref<any[]>([])
const users = ref<any[]>([])
const draft = ref('')
const loadingHistory = ref(false)
const authFailed = ref(false)
const msgListRef = ref<HTMLElement | null>(null)
const search = ref('')
const rightTab = ref<'members' | 'friends'>('members')
const rightPanelOpen = ref(true)
const friendMenu = ref<{ user: any; x: number; y: number } | null>(null)
const friendPanel = ref(false)
const friendSearch = ref('')
const profileUser = ref<any>(null)
const memberCard = ref<{ m: any; x: number; y: number } | null>(null)

// ══ USER-FOLLOW-01 关注体系（好友=关注） ══════════════════════
const friendTab = ref<'following' | 'follower' | 'directory'>('following')
const followStats = ref({ followingCount: 0, followerCount: 0 })
const followUsers = ref<any[]>([])
const followerUsers = ref<any[]>([])
const followLoading = ref(false)
const followBusyId = ref('')
const followStatus = ref<Record<string, boolean>>({})

const displayMessages = computed(() => messages.value)
const onlineMembers = computed(() => members.value.filter((m) => m.status === 1))
const peerUid = computed(() => (currentChannel.value?.kind === 'dm' ? currentChannel.value.peerUid : ''))
const peerInfo = computed(() => users.value.find((u) => u.id === peerUid.value) || null)
const peerOnline = computed(() => peerInfo.value?.online ?? false)

const filteredPublic = computed(() => channels.value.filter((c) => !search.value || c.name.includes(search.value)))
const filteredGroups = computed(() => groups.value.filter((c) => !search.value || c.name.includes(search.value)))
const filteredDms = computed(() => dms.value.filter((c) => !search.value || c.name.includes(search.value)))
const filteredUsers = computed(() => users.value.filter((u) => !friendSearch.value || u.name.includes(friendSearch.value)))

// ══ R11 通话入口（仅私聊频道显示）══
const rtcRemoteVideoRef = ref<HTMLVideoElement | null>(null)
const rtcRemoteAudioVideoRef = ref<HTMLVideoElement | null>(null)
const rtcLocalVideoRef = ref<HTMLVideoElement | null>(null)
const rtcDurText = ref('00:00')
let rtcDurTimer: ReturnType<typeof setInterval> | null = null
let dmPoll: ReturnType<typeof setInterval> | null = null
// 视频流绑定（watchEffect：依赖 ref 挂载/流/状态任何变化都重试绑定，主叫/被叫时序都覆盖）
watchEffect(() => {
  if (rtcRemoteVideoRef.value && rtc.remoteStream.value) {
    rtcRemoteVideoRef.value.srcObject = rtc.remoteStream.value
  }
  // 语音模式远端音频（隐藏 video 播放）
  if (rtcRemoteAudioVideoRef.value && rtc.remoteStream.value) {
    rtcRemoteAudioVideoRef.value.srcObject = rtc.remoteStream.value
  }
  if (rtcLocalVideoRef.value && rtc.localStream.value) {
    rtcLocalVideoRef.value.srcObject = rtc.localStream.value
  }
})
// 通话计时
watch(
  () => rtc.state.value,
  (s) => {
    if (s === 'active') {
      const t0 = Date.now()
      rtcDurTimer = setInterval(() => {
        const sec = Math.floor((Date.now() - t0) / 1000)
        rtcDurText.value = `${String(Math.floor(sec / 60)).padStart(2, '0')}:${String(sec % 60).padStart(2, '0')}`
      }, 1000)
    } else {
      if (rtcDurTimer) {
        clearInterval(rtcDurTimer)
        rtcDurTimer = null
      }
      rtcDurText.value = '00:00'
    }
  }
)
// 挂断/结束后 3s 隐藏错误提示
watch(
  () => rtc.state.value,
  (s) => {
    if (s === 'idle' && rtcToast.value) setTimeout(() => (rtcToast.value = ''), 3000)
  }
)
function readMyProfile(): any {
  try {
    const m = document.cookie.match(/(?:^|;\s*)auth_user=([^;]+)/)
    if (m) return JSON.parse(decodeURIComponent(m[1]))
  } catch { /* ignore */ }
  try {
    const raw = localStorage.getItem('auth_user') || localStorage.getItem('user')
    if (raw) return JSON.parse(raw)
  } catch { /* ignore */ }
  return null
}
function callPeer(mode: 'audio' | 'video') {
  if (!currentChannel.value || currentChannel.value.kind !== 'dm') return
  const uid = currentChannel.value.peerUid
  const name = peerInfo.value?.name || currentChannel.value.name || '茶客'
  const avatar = peerInfo.value?.avatar || currentChannel.value.avatar || ''
  rtc.startCall(uid, mode, name, avatar)
}
// 通话浮层错误提示（防抖：连接状态变化时置空）
watch(() => rtc.errorMsg.value, (v) => { if (v) rtcToast.value = v })

function followToken() {
  try { return window.localStorage?.getItem('auth_token') || '' } catch { return '' }
}

async function loadFollowStats() {
  try {
    const res = await fetch('/api/user/follow/stats', { headers: { Authorization: 'Bearer ' + followToken() } })
    if (res.ok) { const j = await res.json(); if (j.data) followStats.value = j.data }
  } catch { /* 非致命 */ }
}

async function loadFollowList(type: 'following' | 'follower') {
  followLoading.value = true
  try {
    const res = await fetch('/api/user/follow/list?type=' + type, { headers: { Authorization: 'Bearer ' + followToken() } })
    if (res.ok) {
      const j = await res.json()
      if (type === 'following') followUsers.value = j.data?.users || []
      else followerUsers.value = j.data?.users || []
    }
  } catch { /* 非致命 */ } finally { followLoading.value = false }
}

async function switchFriendTab(tab: 'following' | 'follower' | 'directory') {
  friendTab.value = tab
  if (tab === 'following') {
    await loadFollowList('following')
  } else if (tab === 'follower') {
    await loadFollowList('follower')
  } else {
    await refreshFollowStatus()
  }
}

async function refreshFollowStatus() {
  const ids = users.value.map((u) => u.id).filter(Boolean)
  if (!ids.length) { followStatus.value = {}; return }
  try {
    const res = await fetch('/api/user/follow/status', {
      method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + followToken() },
      body: JSON.stringify({ targetIds: ids }),
    })
    if (res.ok) { const j = await res.json(); followStatus.value = j.data?.status || {} }
  } catch { /* 非致命 */ }
}

async function toggleFollowId(targetId: string) {
  if (followBusyId.value) return
  followBusyId.value = targetId
  try {
    const isFollowing = followStatus.value[targetId]
    const res = await fetch(isFollowing ? '/api/user/unfollow' : '/api/user/follow', {
      method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + followToken() },
      body: JSON.stringify({ targetId }),
    })
    if (res.ok) {
      followStatus.value = { ...followStatus.value, [targetId]: !isFollowing }
      loadFollowStats()
    }
  } catch { /* 非致命 */ } finally { followBusyId.value = '' }
}

async function toggleFollowUser(u: any) {
  if (followBusyId.value) return
  followBusyId.value = u.id
  try {
    if (u.relation === 'follower') {
      const res = await fetch('/api/user/follow', {
        method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + followToken() },
        body: JSON.stringify({ targetId: u.id }),
      })
      if (res.ok) u.relation = 'mutual'
    } else {
      const res = await fetch('/api/user/unfollow', {
        method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + followToken() },
        body: JSON.stringify({ targetId: u.id }),
      })
      if (res.ok) u.relation = 'follower'
    }
    loadFollowStats()
    followUsers.value = [...followUsers.value]
    followerUsers.value = [...followerUsers.value]
  } catch { /* 非致命 */ } finally { followBusyId.value = '' }
}

function isActive(ch: any) {
  return currentChannel.value && currentChannel.value.id === ch.id && currentChannel.value.type === ch.type
}

function shortUid(uid: string) {
  return uid ? uid.slice(0, 8) : '未知茶客'
}

// 消息发送者头像：authorAvatar（后端 User 表同步）→ 频道成员头像 → 空
function msgAvatar(msg: any) {
  if (!msg) return ''
  const av =
    msg.authorAvatar ||
    (msg.content && typeof msg.content === 'object' && msg.content.avatar) ||
    members.value.find((x) => x.uid === msg.fromUID)?.avatar ||
    ''
  return av || ''
}

// 消息发送者昵称：自己 → authorName → 成员表 → 用户列表 → 异步解析 → 短 UID
function msgAuthorName(msg: any) {
  if (!msg) return '茶客'
  if (msg.fromUID === tea.userId.value) return '我'
  if (msg.authorName) return msg.authorName
  const m = members.value.find((x) => x.uid === msg.fromUID)
  if (m?.name) return m.name
  const u = users.value.find((x) => x.id === msg.fromUID)
  if (u?.name) return u.name
  resolveNamesFor([msg.fromUID])
  return shortUid(msg.fromUID)
}

function memberName(uid: string) {
  if (!uid) return ''
  // ① 当前频道成员表（imChannelMember，含平台昵称）
  const m = members.value.find((x) => x.uid === uid)
  if (m?.name) return m.name
  // ② 平台用户列表（好友 tab 数据源，username 即账号昵称）
  const u = users.value.find((x) => x.id === uid)
  if (u?.name) return u.name
  // ③ 按需批量解析（User 表）
  resolveNamesFor([uid])
  return ''
}

// 按需批量解析 uid → 账号昵称（异步补名，防抖去重）
let nameResolveTimer: ReturnType<typeof setTimeout> | null = null
let nameResolveQueue: string[] = []
async function resolveNamesFor(uids: string[]) {
  nameResolveQueue = [...new Set([...nameResolveQueue, ...uids])]
  if (nameResolveTimer) return
  nameResolveTimer = setTimeout(async () => {
    const q = [...nameResolveQueue]
    nameResolveQueue = []
    nameResolveTimer = null
    try {
      const names = await tea.resolveNames(q)
      if (!Object.keys(names).length) return
      // 补名后刷新消息作者显示（依赖 members/users 引用不变，直接更新消息对象）
      for (const [uid, name] of Object.entries(names)) {
        messages.value = messages.value.map((m: any) =>
          m.fromUID === uid && !m.authorName ? { ...m, authorName: name } : m
        )
      }
    } catch (e) {
      console.warn('[昆仑茶馆] 昵称解析失败', e)
    }
  }, 120)
}

function fmtTime(ts: number) {
  if (!ts) return ''
  const d = new Date(ts * 1000)
  const pad = (n: number) => String(n).padStart(2, '0')
  const now = new Date()
  const sameDay = d.toDateString() === now.toDateString()
  if (sameDay) return `${pad(d.getHours())}:${pad(d.getMinutes())}`
  return `${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`
}

// 提取礼物信息（三种形态：A content={kind:'gift'} / B content={type:2,content:{kind:'gift'}} / C payload base64 解码）
function extractGiftInfo(msg: any): any {
  if (!msg) return null
  const probe = (obj: any) => (obj && typeof obj === 'object' && obj.kind === 'gift' ? obj : null)
  // A：content 直接是礼物对象
  if (msg.content && typeof msg.content === 'object') {
    const a = probe(msg.content)
    if (a) return a
    // B：content = {type:2, content:{kind:'gift'}}
    const b = probe(msg.content.content)
    if (b) return b
  }
  // C：payload base64 解码
  if (msg.payload) {
    try {
      const bin = atob(msg.payload)
      const bytes = Uint8Array.from(bin, (c) => c.charCodeAt(0))
      const decoded = JSON.parse(new TextDecoder().decode(bytes))
      const c = decoded.content
      const hit = probe(c)
      if (hit) return hit
      if (c && typeof c === 'object') {
        const hit2 = probe(c.content)
        if (hit2) return hit2
      }
      return probe(decoded)
    } catch { return null }
  }
  return null
}

function renderMsg(msg: any) {
  // IM-CHA-M10 撤回：已被撤回的消息显示占位（不展示内容）
  if (msg.recalled) {
    const isMine = typeof tea.userId.value === 'string' && msg.fromUID === tea.userId.value
    return `<span class="msg-recalled">${isMine ? '你撤回了一条消息' : '该消息已撤回'}</span>`
  }
  const giftInfo = extractGiftInfo(msg)
  if (giftInfo) {
    return `<span class="gift-inline">🎁 ${escapeHtml(giftInfo.giftName || '礼物')} ${giftInfo.priceDiamonds ? `<b class="gift-inline-price">💎${giftInfo.priceDiamonds}</b>` : ''}</span>`
  }
  // 红包卡片（IM-CHA-M6）：点击 → window.__klOpenRedPacket(id)
  const rpInfo = extractRedPacketInfo(msg)
  if (rpInfo) {
    const note = escapeHtml(rpInfo.note || '恭喜发财，大吉大利！')
    const st: any = (msg as any)._rpStatus
    const isMine = typeof tea.userId.value === 'string' && msg.fromUID === tea.userId.value
    const isDmRp = !!rpInfo.dm // 私聊直接红包（微信风格）：无个数/抢包概念
    let statusLine = '…'
    let done = false
    if (st) {
      done = st.status === 'completed' || st.status === 'refunded' || st.remainCount <= 0
      if (isDmRp) {
        if (st.grabbedByMe) statusLine = `已领取 +${st.mine?.amount ?? ''} 钻`
        else if (st.status === 'refunded') statusLine = '红包已过期退回'
        else if (st.status === 'completed') statusLine = '红包已被领取'
        else statusLine = isMine ? '查看红包' : '领取红包'
      } else if (st.grabbedByMe) statusLine = `查看红包 · 已抢 ${st.mine?.amount ?? '?'} 钻`
      else if (st.status === 'refunded') statusLine = '红包已过期退回'
      else if (st.status === 'completed' || st.remainCount <= 0) statusLine = '红包已被领完'
      else statusLine = isMine ? `查看红包 · 剩 ${st.remainCount} 个` : `领取红包 · 剩 ${st.remainCount} 个`
    }
    const mineCls = st?.grabbedByMe ? ' is-mine' : ''
    // 微信风格红包卡片（IM-CHA-M10.2）：红色渐变 + 金色開 + 上文案下状态
    return `<div class="rp-card${done ? ' is-done' : ''}" onclick="window.__klOpenRedPacket && window.__klOpenRedPacket('${rpInfo.id}')">` +
      `<div class="rp-card-inner">` +
      `<div class="rp-card-note">${note}</div>` +
      `<div class="rp-card-mid"><span class="rp-open">開</span></div>` +
      `<div class="rp-card-status${mineCls}">${statusLine}</div>` +
      `</div></div>`
  }
  // 私聊领取通知（微信风格：XX 领取了红包）
  const grabbedInfo = extractRedPacketGrabbedInfo(msg)
  if (grabbedInfo) {
    const isMine = typeof tea.userId.value === 'string' && msg.fromUID === tea.userId.value
    const who = isMine ? '你' : escapeHtml(grabbedInfo.userName || memberName(msg.fromUID) || shortUid(msg.fromUID))
    return `<span class="rp-grab-inline rp-grabbed-notice">🧧 ${who} 领取了红包</span>`
  }
  // 抢红包结果（服务端代发「XX 抢到 X 钻石」）
  const grabInfo = extractRedPacketGrabInfo(msg)
  if (grabInfo) {
    const who = escapeHtml(grabInfo.userName || memberName(msg.fromUID) || shortUid(msg.fromUID))
    return `<span class="rp-grab-inline">🧧 ${who} 抢到 <b class="rp-grab-amt-inline">${grabInfo.amount}</b> 钻石${grabInfo.remainCount > 0 ? ` · 还剩 ${grabInfo.remainCount} 个` : ' · 已抢完'}</span>`
  }
  // 撤回通知（服务端代发 kind=recall：XX 撤回了一条消息）
  const recallInfo = extractRecallInfo(msg)
  if (recallInfo) {
    const who = escapeHtml(recallInfo.operatorName || '有人')
    const isMine = typeof tea.userId.value === 'string' && (msg.fromUID || msg.from_uid) === tea.userId.value
    return `<span class="msg-recalled">${escapeHtml(who)} 撤回了一条消息</span>`
  }
  const parsed = parseContentObj(msg)
  if (!parsed) return ''
  const { type, content } = parsed
  // 图片（type=2）——IM-CHA-M10：列表显示缩略图（thumbUrl），点击看原图大图
  if (type === 2 && content && content.url) {
    const thumb = absUrl(content.thumbUrl || content.url)
    const full = absUrl(content.url)
    const ttlTip = content.ttlHours ? `<small class="msg-ttl">${ttlTipText(content.ttlHours)}</small>` : ''
    return `<img class="msg-img" src="${thumb}" loading="lazy" onclick="window.__klImgView && window.__klImgView('${full}')" />${fwdMarkHtml(content)}${ttlTip}`
  }
  // 语音（type=5）——IM-CHA-M10：点击播放，长按提炼文字
  if (type === 5 && content && content.url) {
    const dur = Math.round(Number(content.duration) || 0)
    const durText = dur ? `${dur}"` : ''
    const src = absUrl(content.url)
    const msgId = encodeURIComponent(msg.message_idstr || msg.messageID || content.clientMsgNo || '')
    const vKey = encodeURIComponent(msg.key || msgKey(msg))
    const isMine = typeof tea.userId.value === 'string' && msg.fromUID === tea.userId.value
    return `<div class="msg-voice${isMine ? ' msg-voice--mine' : ''}" data-vkey="${vKey}" data-vmsgid="${msgId}" data-vurl="${src}" data-vdur="${dur}"
      onclick="window.__klPlayVoice && window.__klPlayVoice(this)"
      onmousedown="window.__klVoiceHoldStart && window.__klVoiceHoldStart(event, this)"
      onmouseup="window.__klVoiceHoldEnd && window.__klVoiceHoldEnd(event, this)"
      onmouseleave="window.__klVoiceHoldCancel && window.__klVoiceHoldCancel()"
      ontouchstart="window.__klVoiceHoldStart && window.__klVoiceHoldStart(event, this)"
      ontouchend="window.__klVoiceHoldEnd && window.__klVoiceHoldEnd(event, this)"
      ontouchcancel="window.__klVoiceHoldCancel && window.__klVoiceHoldCancel()"
      title="点击播放 · 长按提炼文字"><span class="voice-play-icon">▶</span><span class="voice-dur-text">${durText}</span></div>`
  }
  // 文件/文档（type=3）
  if (type === 3 && content && content.url) {
    const name = escapeHtml(content.name || '文件')
    const size = fmtSize(content.size)
    const ttlTip = content.ttlHours ? `<small class="msg-ttl">${ttlTipText(content.ttlHours)}</small>` : ''
    return `<a class="msg-file" href="${absUrl(content.url)}" target="_blank" rel="noopener"><span class="msg-file-icon">📄</span><span class="msg-file-main"><span class="msg-file-name">${name}</span>${size ? `<small class="msg-file-size">${size}</small>` : ''}</span></a>${ttlTip}`
  }
  // 视频（type=4）
  if (type === 4 && content && content.url) {
    const ttlTip = content.ttlHours ? `<small class="msg-ttl">${ttlTipText(content.ttlHours)}</small>` : ''
    return `<video class="msg-video" src="${absUrl(content.url)}" controls preload="metadata"></video>${fwdMarkHtml(content)}${ttlTip}`
  }
  // 文本（type=1）
  const text = typeof content === 'string' ? content : typeof content?.text === 'string' ? content.text : typeof content?.content === 'string' ? content.content : ''
  return escapeHtml(text).replace(/\n/g, '<br/>') + fwdMarkHtml(content)
}

// IM-CHA-M10.4 转发标注（微信风格「转发自 …」；文本/图片/视频转发时 content 带 forwardedFrom）
function fwdMarkHtml(content: any): string {
  const fwd = content && typeof content === 'object' ? content.forwardedFrom : null
  if (!fwd) return ''
  const from = [fwd.channelName, fwd.userName].filter(Boolean).join(' · ')
  return `<span class="msg-forwarded">↪ 转发自 ${escapeHtml(from || '未知来源')}</span>`
}

// 提取红包信息（形态同礼物：content 直/嵌套/payload 解码）
function extractRedPacketInfo(msg: any): any {
  if (!msg) return null
  const probe = (obj: any) => (obj && typeof obj === 'object' && obj.kind === 'red_packet' ? obj : null)
  if (msg.content && typeof msg.content === 'object') {
    const a = probe(msg.content)
    if (a) return a
    const b = probe(msg.content.content)
    if (b) return b
  }
  if (msg.payload) {
    try {
      const bin = atob(msg.payload)
      const bytes = Uint8Array.from(bin, (c) => c.charCodeAt(0))
      const decoded = JSON.parse(new TextDecoder().decode(bytes))
      const c = decoded.content
      const hit = probe(c)
      if (hit) return hit
      if (c && typeof c === 'object') {
        const hit2 = probe(c.content)
        if (hit2) return hit2
      }
      return probe(decoded)
    } catch { return null }
  }
  return null
}

// 提取抢红包结果信息（群聊：XX 抢到 X 钻石）
function extractRedPacketGrabInfo(msg: any): any {
  if (!msg) return null
  const probe = (obj: any) => (obj && typeof obj === 'object' && obj.kind === 'red_packet_grab' ? obj : null)
  if (msg.content && typeof msg.content === 'object') {
    const a = probe(msg.content)
    if (a) return a
    const b = probe(msg.content.content)
    if (b) return b
  }
  if (msg.payload) {
    try {
      const bin = atob(msg.payload)
      const bytes = Uint8Array.from(bin, (c) => c.charCodeAt(0))
      const decoded = JSON.parse(new TextDecoder().decode(bytes))
      const c = decoded.content
      const hit = probe(c)
      if (hit) return hit
      if (c && typeof c === 'object') {
        const hit2 = probe(c.content)
        if (hit2) return hit2
      }
      return probe(decoded)
    } catch { return null }
  }
  return null
}

// 提取撤回通知信息（kind=recall；服务端代发 type=6）
// 提取私聊领取通知（微信风格：XX 领取了红包）
function extractRedPacketGrabbedInfo(msg: any): any {
  if (!msg) return null
  const probe = (obj: any) => (obj && typeof obj === 'object' && obj.kind === 'red_packet_grabbed' ? obj : null)
  if (msg.content && typeof msg.content === 'object') {
    const a = probe(msg.content)
    if (a) return a
    const b = probe(msg.content.content)
    if (b) return b
  }
  if (msg.payload) {
    try {
      const bin = atob(msg.payload)
      const bytes = Uint8Array.from(bin, (c) => c.charCodeAt(0))
      const decoded = JSON.parse(new TextDecoder().decode(bytes))
      const c = decoded.content
      const hit = probe(c)
      if (hit) return hit
      if (c && typeof c === 'object') {
        const hit2 = probe(c.content)
        if (hit2) return hit2
      }
      return probe(decoded)
    } catch { return null }
  }
  return null
}

function extractRecallInfo(msg: any): any {
  if (!msg) return null
  const probe = (obj: any) => (obj && typeof obj === 'object' && obj.kind === 'recall' ? obj : null)
  if (msg.content && typeof msg.content === 'object') {
    const a = probe(msg.content)
    if (a) return a
    const b = probe(msg.content.content)
    if (b) return b
  }
  if (msg.payload) {
    try {
      const bin = atob(msg.payload)
      const bytes = Uint8Array.from(bin, (c) => c.charCodeAt(0))
      const decoded = JSON.parse(new TextDecoder().decode(bytes))
      const c = decoded.content
      const hit = probe(c)
      if (hit) return hit
      if (c && typeof c === 'object') {
        const hit2 = probe(c.content)
        if (hit2) return hit2
      }
      return probe(decoded)
    } catch { return null }
  }
  return null
}

function escapeHtml(s: string) {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

/* ══ 表情 + 媒体上传（EMOJI-MEDIA-01） ══════════════════ */
const emojiPanelOpen = ref(false)
/* ══ 微信风格输入栏：表情在外，其余收进 ➕（IM-CHA-M10.1） ══ */
const plusPanelOpen = ref(false)
const voiceMode = ref(false)

function toggleEmojiPanel() {
  // 语音模式下点表情：先切回键盘再弹表情
  if (voiceMode.value) voiceMode.value = false
  emojiPanelOpen.value = !emojiPanelOpen.value
  plusPanelOpen.value = false
}
function togglePlusPanel() {
  plusPanelOpen.value = !plusPanelOpen.value
  emojiPanelOpen.value = false
}
function toggleVoiceMode() {
  if (recording.value || sendingMedia.value) return
  voiceMode.value = !voiceMode.value
  emojiPanelOpen.value = false
  plusPanelOpen.value = false
  if (voiceMode.value) draft.value = '' // 切语音模式时清空草稿，避免误发
}

const sendingMedia = ref(false)
const fileInputRef = ref<HTMLInputElement | null>(null)
let pendingPickKind: 'image' | 'file' = 'image'

const emojiList = [
  '😀', '😄', '😁', '😂', '🤣', '😊', '😍', '🥰', '😘', '😜',
  '🤔', '🤗', '😎', '🥳', '😏', '😴', '🤤', '😭', '😤', '😡',
  '👍', '👏', '🙏', '💪', '👌', '🤝', '✌️', '🤞', '👀', '💯',
  '🔥', '✨', '🎉', '🎊', '💖', '💎', '🍵', '🐟', '🌙', '☀️',
  '🐼', '🦊', '🐱', '🐶', '🍀', '🎵', '⚡', '🌈',
]

function insertEmoji(e: string) {
  draft.value += e
  emojiPanelOpen.value = false
}

function pickFile(kind: 'image' | 'file') {
  pendingPickKind = kind
  const input = fileInputRef.value
  if (!input) return
  input.accept = kind === 'image' ? 'image/*' : ''
  input.value = ''
  input.click()
}

async function onFilePicked(e: Event) {
  const input = e.target as HTMLInputElement
  const file = input.files?.[0]
  if (!file) return
  const kind = pendingPickKind
  input.value = ''
  if (sendingMedia.value) return showToast('⏳ 正在上传上一份，稍等')
  await sendMedia(file, kind)
}

function absUrl(u: string) {
  if (!u) return ''
  return /^https?:\/\//.test(u) ? u : 'https://aigc.fushtn.com' + (u.startsWith('/') ? u : '/' + u)
}

/** TTL 过期提示文案（IM-CHA-M10） */
function ttlTipText(ttlHours: number) {
  const h = Number(ttlHours) || 0
  if (h <= 0) return ''
  if (h % 24 === 0) return `${h / 24} 天后过期`
  return `${h} 小时后过期`
}

async function sendMedia(file: File, kind: 'image' | 'file') {
  if (!currentChannel.value || !tea.connected.value) return showToast('⚠ 请先连接茶馆')
  sendingMedia.value = true
  try {
    const fd = new FormData()
    fd.append('file', file)
    const up = await fetch('/api/im/upload', {
      method: 'POST',
      headers: { Authorization: 'Bearer ' + giftToken() },
      body: fd,
    }).then((r) => r.json())
    if (!up.success) throw new Error(up.error || '上传失败')
    const { url, name, size, thumbUrl, ttlHours } = up.data
    let width = 0, height = 0
    if (kind === 'image') {
      try {
        const img = new Image()
        img.src = absUrl(url)
        await new Promise((res, rej) => { img.onload = res; img.onerror = rej })
        width = img.naturalWidth; height = img.naturalHeight
      } catch { /* 非致命 */ }
    }
    const res = await fetch('/api/im/messages/send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + giftToken() },
      body: JSON.stringify({
        channelId: currentChannel.value.id,
        channelType: currentChannel.value.type,
        contentType: kind === 'image' ? 2 : 3,
        content: { url, name, size, width, height, thumbUrl: thumbUrl || '', ttlHours: ttlHours || 0 },
      }),
    }).then((r) => r.json())
    if (!res.success) throw new Error(res.error || '发送失败')
    messages.value.push({
      fromUID: tea.userId.value,
      timestamp: Date.now(),
      content: { type: kind === 'image' ? 2 : 3, content: { url, name, size, width, height, thumbUrl: thumbUrl || '', ttlHours: ttlHours || 0 } },
      key: 'media-' + Math.random().toString(36).slice(2, 8),
    })
    scrollBottom()
    showToast(kind === 'image' ? '📷 图片已发送' : '📄 文档已发送')
  } catch (err) {
    console.error('[昆仑茶馆] 媒体发送失败', err)
    showToast('⚠ ' + ((err as Error).message || '发送失败'))
  } finally {
    sendingMedia.value = false
  }
}

/* ══ IM-CHA-M10 消息撤回 ══════════════════════════ */
// 只允许撤回自己的消息 + 发送 10 分钟内（后端严格校验，前端宽松展示）
// messageId 三通道：message_idstr（历史） / messageID（SDK 实时） / clientMsgNo（SDK 发送返回，发送方本地）
function msgMessageId(msg: any): string {
  return String(msg?.message_idstr || msg?.messageID || msg?.message_id || msg?.clientMsgNo || '')
}
function canRecall(msg: any): boolean {
  if (!msg || msg.recalled) return false
  if (typeof tea.userId.value !== 'string' || msg.fromUID !== tea.userId.value) return false
  const mid = msgMessageId(msg)
  if (!mid || mid === 'undefined' || mid === 'null') return false
  const ts = Number(msg.timestamp) || 0
  if (ts > 0 && Date.now() / 1000 - ts > 10 * 60) return false
  return true
}
async function recallMsg(msg: any) {
  if (!currentChannel.value) return
  const messageId = msgMessageId(msg)
  if (!messageId) return showToast('⚠ 该消息暂不支持撤回')
  if (!window.confirm('确定撤回这条消息吗？')) return
  try {
    const res = await fetch('/api/im/messages/recall', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + giftToken() },
      body: JSON.stringify({ messageId, channelId: currentChannel.value.id, channelType: currentChannel.value.type }),
    })
    const j = await res.json()
    if (j.success) {
      msg.recalled = true
      showToast('✅ 已撤回')
    } else {
      showToast('⚠ ' + (j.error || '撤回失败'))
      if (j.code === 'NOT_OWNER' || j.code === 'EXPIRED' || j.code === 'NOT_FOUND') loadHistory()
    }
  } catch (e) {
    console.error('[昆仑茶馆] 撤回失败', e)
    showToast('⚠ 撤回失败，请重试')
  }
}

/* ══ IM-CHA-M10.4 消息长按/右键操作菜单（复制/收藏/转发） ══════════ */
const msgMenu = ref<{ msg: any; x: number; y: number; canCopy: boolean; canForward: boolean } | null>(null)
const forwardPanel = ref(false)
const forwardMsg = ref<any>(null)
const forwardPreview = ref('')
const favPanel = ref(false)
const favList = ref<any[]>([])
let msgHoldTimer: ReturnType<typeof setTimeout> | null = null
let msgHoldFired = false
let msgTouchStartPos: { x: number; y: number } | null = null

// 转发目标：频道 + 群聊 + 好友（关注）
const forwardTargets = computed(() => {
  const list: any[] = []
  const cur = currentChannel.value
  for (const c of channels.value) if (!cur || c.id !== cur.id) list.push({ key: 'ch-' + c.id, kind: 'channel', id: c.id, type: c.type, name: c.name })
  for (const g of groups.value) if (!cur || g.id !== cur.id) list.push({ key: 'g-' + g.id, kind: 'group', id: g.id, type: g.type, name: g.name })
  for (const u of followUsers.value) if (!cur || u.id !== (cur as any).peerUid) list.push({ key: 'u-' + u.id, kind: 'user', id: u.id, type: 1, name: u.name || '茶客' })
  return list
})

// 消息是否可弹操作菜单（文字/图片/视频；红包/礼物/通知/系统消息除外）
function msgMenuable(msg: any): boolean {
  if (!msg || msg.recalled) return false
  if (extractGiftInfo(msg) || extractRedPacketInfo(msg) || extractRedPacketGrabbedInfo(msg) || extractRedPacketGrabInfo(msg) || extractRecallInfo(msg)) return false
  const parsed = parseContentObj(msg)
  if (!parsed) return false
  return parsed.type === 1 || parsed.type === 2 || parsed.type === 4
}

function openMsgMenu(msg: any, e: { clientX: number; clientY: number }) {
  if (!msgMenuable(msg)) return
  const parsed = parseContentObj(msg)!
  const MENU_W = 148
  const MENU_H = 134
  let x = e.clientX, y = e.clientY
  if (x + MENU_W > window.innerWidth) x = window.innerWidth - MENU_W - 8
  if (y + MENU_H > window.innerHeight) y = window.innerHeight - MENU_H - 8
  x = Math.max(8, x)
  y = Math.max(8, y)
  msgMenu.value = { msg, x, y, canCopy: parsed.type === 1, canForward: parsed.type === 1 || parsed.type === 2 || parsed.type === 4 }
  syncBodyLock()
}
function closeMsgMenu() {
  msgMenu.value = null
  syncBodyLock()
}

// 鼠标长按（500ms）
function msgHoldStart(msg: any, e: MouseEvent) {
  if (e.button !== undefined && e.button !== 0) return
  if (!msgMenuable(msg)) return
  msgHoldCancel()
  msgHoldFired = false
  msgHoldTimer = setTimeout(() => {
    msgHoldFired = true
    openMsgMenu(msg, { clientX: e.clientX, clientY: e.clientY })
  }, 500)
}
function msgHoldEnd() {
  if (msgHoldTimer) { clearTimeout(msgHoldTimer); msgHoldTimer = null }
}
function msgHoldCancel() { msgHoldEnd() }

// 触摸长按（移动端；移动 10px 取消）
function msgTouchStart(msg: any, e: TouchEvent) {
  const t = e.touches?.[0]
  msgTouchStartPos = t ? { x: t.clientX, y: t.clientY } : null
  if (!msgMenuable(msg)) return
  const ce = t ? { clientX: t.clientX, clientY: t.clientY } : { clientX: 0, clientY: 0 }
  msgHoldCancel()
  msgHoldFired = false
  msgHoldTimer = setTimeout(() => {
    msgHoldFired = true
    openMsgMenu(msg, ce)
  }, 500)
}
function msgTouchMove(e: TouchEvent) {
  const t = e.touches?.[0]
  if (t && msgTouchStartPos) {
    const dx = Math.abs(t.clientX - msgTouchStartPos.x)
    const dy = Math.abs(t.clientY - msgTouchStartPos.y)
    if (dx > 10 || dy > 10) msgHoldCancel()
  }
}
function msgTouchEnd() { msgHoldEnd() }

// 长按触发后吞掉紧随的 click（防图片长按弹出菜单时又打开大图）
function installMsgHoldClickGuard() {
  document.addEventListener(
    'click',
    (e) => {
      if (msgHoldFired) {
        e.preventDefault()
        e.stopPropagation()
        msgHoldFired = false
      }
    },
    true
  )
}

// 提取消息纯文本（复制用）
function extractMsgText(msg: any): string {
  const parsed = parseContentObj(msg)
  if (!parsed) return ''
  const c = parsed.content
  if (typeof c === 'string') return c
  if (typeof c?.text === 'string') return c.text
  if (typeof c?.content === 'string') return c.content
  return ''
}

async function copyText(text: string, tip = '✅ 已复制') {
  try {
    await navigator.clipboard.writeText(text)
  } catch {
    const ta = document.createElement('textarea')
    ta.value = text
    ta.style.position = 'fixed'
    ta.style.opacity = '0'
    document.body.appendChild(ta)
    ta.select()
    try { document.execCommand('copy') } catch { /* noop */ }
    ta.remove()
  }
  showToast(tip)
}

function copyMsg(msg: any) {
  const text = extractMsgText(msg)
  if (!text) return showToast('⚠ 无法复制该消息')
  closeMsgMenu()
  copyText(text)
}

// 收藏消息（幂等：后端同 user+messageId 去重）
async function favMsg(msg: any) {
  const parsed = parseContentObj(msg)
  if (!parsed) return
  closeMsgMenu()
  try {
    const res = await fetch('/api/im/favorites', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + giftToken() },
      body: JSON.stringify({
        messageId: msgMessageId(msg),
        channelId: currentChannel.value?.id || '',
        channelType: currentChannel.value?.type || 4,
        contentType: parsed.type,
        content: parsed,
        fromUid: msg.fromUID || '',
        fromName: msgAuthorName(msg),
        channelName: currentChannel.value?.name || '',
      }),
    })
    const j = await res.json()
    if (j.success) showToast(j.duplicated ? '⭐ 已收藏过' : '⭐ 已收藏')
    else showToast('⚠ ' + (j.error || '收藏失败'))
  } catch (e) {
    console.error('[昆仑茶馆] 收藏失败', e)
    showToast('⚠ 收藏失败')
  }
}

// 转发
function openForward(msg: any) {
  const parsed = parseContentObj(msg)
  if (!parsed) return
  closeMsgMenu()
  forwardMsg.value = msg
  const icon = parsed.type === 1 ? '📄' : parsed.type === 2 ? '📷' : '🎬'
  const preview = parsed.type === 1 ? extractMsgText(msg) : parsed.type === 2 ? '图片' : '视频'
  forwardPreview.value = `${icon} ${preview.slice(0, 60)}`
  forwardPanel.value = true
  syncBodyLock()
}
async function doForward(t: any) {
  const msg = forwardMsg.value
  forwardPanel.value = false
  syncBodyLock()
  forwardMsg.value = null
  if (!msg) return
  const parsed = parseContentObj(msg)
  if (!parsed) return
  let chId = t.id
  let chType = t.type
  try {
    if (t.kind === 'user') {
      const data = await tea.ensurePrivate(t.id)
      if (!data) return showToast('⚠ 无法建立私聊')
      chId = data.channel.id
      chType = data.channel.type
    }
    const res = await fetch('/api/im/messages/forward', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + giftToken() },
      body: JSON.stringify({
        targetChannelId: chId,
        targetChannelType: chType,
        contentType: parsed.type,
        content: parsed.content,
        forwardedFrom: { channelName: currentChannel.value?.name || '', userName: msgAuthorName(msg) },
      }),
    })
    const j = await res.json()
    if (j.success) showToast('↪ 已转发')
    else showToast('⚠ ' + (j.error || '转发失败'))
  } catch (e) {
    console.error('[昆仑茶馆] 转发失败', e)
    showToast('⚠ 转发失败')
  }
}

// 收藏夹
async function openFavPanel() {
  favPanel.value = true
  syncBodyLock()
  try {
    const res = await fetch('/api/im/favorites', { headers: { Authorization: 'Bearer ' + giftToken() } })
    const j = await res.json()
    favList.value = (j.data || []).map((f: any) => {
      let parsed: any = null
      try { parsed = JSON.parse(f.content) } catch { /* noop */ }
      return { ...f, _parsed: parsed }
    })
  } catch (e) {
    console.error('[昆仑茶馆] 收藏夹加载失败', e)
    showToast('⚠ 收藏夹加载失败')
  }
}
function favKind(f: any): number {
  return f._parsed?.type || 1
}
function favIcon(f: any): string {
  const t = favKind(f)
  return t === 2 ? '📷' : t === 4 ? '🎬' : t === 5 ? '🎤' : t === 3 ? '📄' : '💬'
}
function favText(f: any): string {
  const c = f._parsed?.content
  if (typeof c === 'string') return escapeHtml(c)
  if (typeof c?.text === 'string') return escapeHtml(c.text)
  if (c?.url) return `<span style="color:#8A8478">媒体消息（点击预览）</span>`
  return '…'
}
function favMeta(f: any): string {
  const from = [f.channelName, f.fromName].filter(Boolean).join(' · ')
  const time = f.createdAt ? new Date(f.createdAt).toLocaleString('zh-CN', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : ''
  return [from, time].filter(Boolean).join('  ')
}
function favPreview(f: any) {
  const c = f._parsed?.content
  if (c?.url) {
    const full = absUrl(c.url)
    const w = window.open('', '_blank')
    if (w) { w.document.write(`<img src="${full}" style="max-width:100%"/>`); w.document.close() }
  }
}
function copyFav(f: any) {
  const c = f._parsed?.content
  const text = typeof c === 'string' ? c : typeof c?.text === 'string' ? c.text : ''
  if (!text) return showToast('⚠ 该收藏不是文字')
  copyText(text)
}
async function removeFav(f: any) {
  try {
    const res = await fetch('/api/im/favorites/' + f.id, {
      method: 'DELETE',
      headers: { Authorization: 'Bearer ' + giftToken() },
    })
    const j = await res.json()
    if (j.success) {
      favList.value = favList.value.filter((x) => x.id !== f.id)
      showToast('🗑 已取消收藏')
    } else showToast('⚠ ' + (j.error || '取消失败'))
  } catch (e) {
    console.error('[昆仑茶馆] 取消收藏失败', e)
    showToast('⚠ 取消失败')
  }
}

/* ══ IM-CHA-M10 英文翻译 ══════════════════════════ */
function canTranslate(msg: any): boolean {
  if (!msg || msg.recalled || msg.translation || msg.translating) return false
  const parsed = parseContentObj(msg)
  if (!parsed || parsed.type !== 1) return false
  const text = typeof parsed.content === 'string' ? parsed.content : parsed.content?.text || ''
  if (!text) return false
  const hasEn = /[a-zA-Z]{4,}/.test(text)
  const hasCn = /[\u4e00-\u9fa5]/.test(text)
  return hasEn && !hasCn // 英文内容才显示翻译按钮
}
async function translateMsg(msg: any) {
  if (msg.translating || msg.translation) return
  const parsed = parseContentObj(msg)
  const text = parsed && typeof parsed.content === 'string' ? parsed.content : parsed?.content?.text || ''
  if (!text) return
  msg.translating = true
  try {
    const res = await fetch('/api/im/translate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + giftToken() },
      body: JSON.stringify({ text }),
    })
    const j = await res.json()
    if (j.success) msg.translation = j.data.translated
    else showToast('⚠ ' + (j.error || '翻译失败'))
  } catch (e) {
    console.error('[昆仑茶馆] 翻译失败', e)
    showToast('⚠ 翻译失败，请重试')
  } finally {
    msg.translating = false
  }
}

/* ══ IM-CHA-M10 语音消息：录音 → 上传 → SDK 发送 ══════════ */
const recording = ref(false)
const recordingSeconds = ref(0)
let mediaRecorder: MediaRecorder | null = null
let mediaChunks: Blob[] = []
let recordTimer: ReturnType<typeof setInterval> | null = null
let recordStartAt = 0

async function startRecord() {
  if (recording.value || sendingMedia.value) return
  if (!currentChannel.value || !tea.connected.value) return showToast('⚠ 请先连接茶馆')
  if (!navigator.mediaDevices?.getUserMedia) return showToast('⚠ 当前浏览器不支持录音')
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
    mediaChunks = []
    const mime = (MediaRecorder.isTypeSupported('audio/webm;codecs=opus') ? 'audio/webm;codecs=opus' : 'audio/webm') || ''
    mediaRecorder = new MediaRecorder(stream, mime ? { mimeType: mime } : undefined)
    mediaRecorder.ondataavailable = (e) => { if (e.data && e.data.size) mediaChunks.push(e.data) }
    mediaRecorder.onstop = () => {
      stream.getTracks().forEach((t) => t.stop())
      const dur = Math.round((Date.now() - recordStartAt) / 1000)
      recording.value = false
      if (recordTimer) { clearInterval(recordTimer); recordTimer = null }
      if (dur < 1) return showToast('⏱ 说话时间太短')
      if (dur > 120) return showToast('⏱ 最长 120 秒')
      const blob = new Blob(mediaChunks, { type: mediaRecorder?.mimeType || 'audio/webm' })
      sendVoiceMsg(blob, dur)
    }
    mediaRecorder.start()
    recordStartAt = Date.now()
    recording.value = true
    recordingSeconds.value = 0
    recordTimer = setInterval(() => { recordingSeconds.value++ }, 1000)
  } catch (e) {
    console.error('[昆仑茶馆] 录音启动失败', e)
    showToast('⚠ 无法访问麦克风（请检查浏览器权限）')
  }
}
function stopRecord() {
  if (mediaRecorder && mediaRecorder.state !== 'inactive') mediaRecorder.stop()
}
function cancelRecord() {
  // 松手时若录音 <1s 或误触：丢弃（不发送）——仅当录音中且非主动停止
  if (recording.value && mediaRecorder && mediaRecorder.state !== 'inactive') {
    mediaRecorder.onstop = () => { /* 丢弃 */ }
    try { mediaRecorder.stop() } catch { /* noop */ }
    recording.value = false
    if (recordTimer) { clearInterval(recordTimer); recordTimer = null }
  }
}
async function sendVoiceMsg(blob: Blob, duration: number) {
  if (!currentChannel.value || !tea.connected.value) return
  sendingMedia.value = true
  try {
    const ext = /mp4|aac|m4a/.test(blob.type) ? '.m4a' : '.webm'
    const fd = new FormData()
    fd.append('file', new File([blob], 'voice' + ext, { type: blob.type }))
    const up = await fetch('/api/im/upload', {
      method: 'POST',
      headers: { Authorization: 'Bearer ' + giftToken() },
      body: fd,
    }).then((r) => r.json())
    if (!up.success) throw new Error(up.error || '上传失败')
    const { url, ttlHours } = up.data
    const sent = await tea.sendVoice({
      url,
      duration,
      name: 'voice',
      ttlHours: ttlHours || 168,
      channelId: currentChannel.value.id,
      channelType: currentChannel.value.type,
    })
    const clientMsgNo = sent?.clientMsgNo || ''
    messages.value.push({
      fromUID: tea.userId.value,
      clientMsgNo,
      timestamp: Math.floor(Date.now() / 1000),
      content: { type: 5, content: { url, duration, name: '语音', ttlHours: ttlHours || 168, clientMsgNo } },
      key: 'voice-' + Math.random().toString(36).slice(2, 8),
    })
    scrollBottom()
  } catch (err) {
    console.error('[昆仑茶馆] 语音发送失败', err)
    showToast('⚠ ' + ((err as Error).message || '发送失败'))
  } finally {
    sendingMedia.value = false
  }
}

/* 语音播放 + 长按转写（v-html 内联事件 → window 全局；赋值必须在 onMounted，防 SSR window 未定义） */
let voiceAudio: HTMLAudioElement | null = null
let voiceHoldTimer: ReturnType<typeof setTimeout> | null = null
let voiceHoldEl: HTMLElement | null = null
let voiceHoldFired = false
function voiceElMsgId(el: HTMLElement): string {
  return decodeURIComponent(el.getAttribute('data-vmsgid') || '')
}
function installVoiceGlobals() {
  ;(window as any).__klPlayVoice = (el: HTMLElement) => {
  const url = el.getAttribute('data-vurl') || ''
  if (!url) return
  if (voiceAudio && !voiceAudio.paused) {
    voiceAudio.pause()
    voiceAudio.currentTime = 0
    el.querySelector('.voice-play-icon')!.textContent = '▶'
    return
  }
  voiceAudio = new Audio(url)
  voiceAudio.playbackRate = 1
  voiceAudio.onended = () => { el.querySelector('.voice-play-icon')!.textContent = '▶' }
  voiceAudio.play().catch(() => { el.querySelector('.voice-play-icon')!.textContent = '▶' })
  el.querySelector('.voice-play-icon')!.textContent = '⏸'
}
;(window as any).__klVoiceHoldStart = (ev: Event, el: HTMLElement) => {
  ev.preventDefault?.()
  voiceHoldEl = el
  voiceHoldFired = false
  if (voiceHoldTimer) clearTimeout(voiceHoldTimer)
  voiceHoldTimer = setTimeout(() => {
    if (voiceHoldEl !== el) return
    voiceHoldFired = true
    const msgId = voiceElMsgId(el)
    if (!msgId) return showToast('⚠ 该语音暂不支持转写')
    transcribeVoiceMsg(el, msgId)
  }, 600)
}
;(window as any).__klVoiceHoldEnd = (ev: Event, el: HTMLElement) => {
  if (voiceHoldTimer) { clearTimeout(voiceHoldTimer); voiceHoldTimer = null }
  voiceHoldEl = null
}
;(window as any).__klVoiceHoldCancel = () => {
  if (voiceHoldTimer) { clearTimeout(voiceHoldTimer); voiceHoldTimer = null }
  voiceHoldEl = null
}
}
async function transcribeVoiceMsg(el: HTMLElement, messageId: string) {
  const url = el.getAttribute('data-vurl') || ''
  if (!url) return
  // 找到对应消息对象，写入转写状态
  const vkey = decodeURIComponent(el.getAttribute('data-vkey') || '')
  const msg = messages.value.find((m) => m.key === vkey)
  if (msg?.transcript) return showToast('📝 ' + msg.transcript)
  if (msg) msg.transcribing = true
  showToast('🔄 正在提炼语音文字…')
  try {
    const res = await fetch('/api/im/asr', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + giftToken() },
      body: JSON.stringify({ messageId, url }),
    })
    const j = await res.json()
    if (j.success && j.data?.text) {
      if (msg) { msg.transcribing = false; msg.transcript = j.data.text }
      showToast('📝 ' + j.data.text.slice(0, 40) + (j.data.text.length > 40 ? '…' : ''))
    } else {
      if (msg) msg.transcribing = false
      showToast('⚠ ' + (j.error || '转写失败'))
    }
  } catch (e) {
    if (msg) msg.transcribing = false
    showToast('⚠ 转写失败，请重试')
  }
}

/* 图片灯箱 */
function viewImage(src: string) {
  const mask = document.createElement('div')
  mask.className = 'img-lightbox'
  const img = document.createElement('img')
  img.src = src
  mask.appendChild(img)
  mask.onclick = () => mask.remove()
  document.body.appendChild(mask)
}

function parseContentObj(msg: any): { type: number; content: any } | null {
  if (msg.content) {
    // SDK 实时消息：content 是内容类实例（contentType + 解码字段）。IM-CHA-M10 修复：
    // 语音/图片实例都有 url，旧逻辑会误判语音(type=5)为图片(type=2) → 先按 contentType 走
    const c = msg.content
    if (typeof c === 'object' && typeof c.contentType === 'number' && c.contentType > 0) {
      const t = c.contentType
      if (t === 1) return { type: 1, content: typeof c.text === 'string' ? c.text : (c.content ?? '') }
      return { type: t, content: c }
    }
    if (typeof c === 'string') return { type: 1, content: c }
    if (typeof c.type === 'number' && c.content !== undefined) return { type: c.type, content: c.content }
    if (typeof c.text === 'string') return { type: 1, content: c.text }
    if (c.url) return { type: 2, content: c }
  }
  if (msg.payload) {
    try {
      const bin = atob(msg.payload)
      const bytes = Uint8Array.from(bin, (c) => c.charCodeAt(0))
      const decoded = JSON.parse(new TextDecoder().decode(bytes))
      if (decoded && typeof decoded === 'object') {
        return { type: decoded.type || 1, content: decoded.content ?? decoded }
      }
    } catch { /* 非致命 */ }
  }
  return null
}

function fmtSize(n: number) {
  if (!n) return ''
  if (n < 1024) return n + ' B'
  if (n < 1024 * 1024) return (n / 1024).toFixed(1) + ' KB'
  return (n / 1024 / 1024).toFixed(1) + ' MB'
}

function msgKey(msg: any) {
  return `${msg.clientMsgNo || ''}-${msg.messageSeq || ''}-${msg.timestamp || ''}-${Math.random().toString(36).slice(2, 6)}`
}

async function loadChannels() {
  const data = await tea.loadChannels()
  if (!data) {
    authFailed.value = true
    return
  }
  channels.value = data.public || []
  groups.value = data.groups || []
  dms.value = data.dms || []
  // 全量订阅当前可见频道（幂等）：私聊/私有频道必须显式订阅才能收到实时消息；
  // 新私聊会话通过定时刷新自动补订阅（B 在线未开私聊窗口也能实时收到）
  for (const ch of [...channels.value, ...groups.value, ...dms.value]) {
    tea.subscribeChannel(ch.id, ch.type)
  }
  // 默认进入公共频道
  if (!currentChannel.value && channels.value.length) {
    switchChannel(channels.value[0])
  }
}

async function loadMembersFor(ch: any) {
  if (!ch || ch.kind === 'dm') return
  const ms = await tea.loadMembers(ch.id, ch.type)
  members.value = ms
}

async function loadUsers() {
  users.value = await tea.loadUsers()
}

// 红包卡片状态批量刷新（历史 + 实时消息统一走这里，卡片显示真实状态）
async function refreshRpStatuses() {
  const ids = [
    ...new Set(
      messages.value
        .map((m: any) => extractRedPacketInfo(m)?.id)
        .filter((id: any) => typeof id === 'string' && id.length > 10),
    ),
  ]
  if (!ids.length) return
  try {
    const r = await fetch('/api/im/red-packets/status', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + giftToken() },
      body: JSON.stringify({ ids }),
    })
    const j = await r.json()
    if (!j.success) return
    messages.value = messages.value.map((m: any) => {
      const info = extractRedPacketInfo(m)
      if (info && j.data[info.id]) {
        const st = j.data[info.id]
        if ((m as any)._rpStatus !== st) return { ...m, _rpStatus: st }
      }
      return m
    })
  } catch (e) {
    console.error('[昆仑茶馆] 红包状态刷新失败', e)
  }
}

async function loadHistory() {
  if (!currentChannel.value) return
  loadingHistory.value = true
  const msgs = await tea.loadHistory(currentChannel.value.id, currentChannel.value.type, 0, 50)
  messages.value = msgs
    .map((m: any) => ({
      ...m,
      // WuKongIM 历史消息字段是 from_uid（下划线），实时消息是 fromUID → 统一驼峰
      fromUID: m.fromUID || m.from_uid,
      key: msgKey(m),
    }))
    .sort((a: any, b: any) => (a.timestamp || 0) - (b.timestamp || 0))
  loadingHistory.value = false
  scrollBottom()
  refreshRpStatuses()
}

async function switchChannel(ch: any) {
  profileUser.value = null
  currentChannel.value = ch
  messages.value = []
  members.value = []
  // 打开频道 → 清未读
  if (unreadMap[`${ch.type}:${ch.id}`]) unreadMap[`${ch.type}:${ch.id}`] = 0
  tea.subscribeChannel(ch.id, ch.type)
  await Promise.all([loadHistory(), loadMembersFor(ch)])
  scrollBottom()
}

/** 点好友 → 创建/复用私聊频道 → 切到中栏（资料卡保留同人） */
async function openPrivate(u: any) {
  const data = await tea.ensurePrivate(u.id)
  if (!data) return
  const ch = {
    id: data.channel.id,
    type: data.channel.type,
    name: data.channel.name,
    desc: data.peer.email,
    kind: 'dm',
    peerUid: data.peer.id,
  }
  // 左栏最近私聊去重 + 置顶；关闭好友下拉框，右栏切「成员」tab 显示对方资料卡
  dms.value = [ch, ...dms.value.filter((d) => d.id !== ch.id)]
  currentChannel.value = ch
  friendPanel.value = false
  rightTab.value = 'members'
  syncBodyLock()
  messages.value = []
  members.value = []
  // 打开频道 → 清未读
  if (unreadMap[`${ch.type}:${ch.id}`]) unreadMap[`${ch.type}:${ch.id}`] = 0
  tea.subscribeChannel(ch.id, ch.type)
  await loadHistory()
  scrollBottom()
}

/** 好友独立下拉框：打开/关闭（打开时锁定页面滚动，滚动只发生在框内） */
function toggleFriendPanel() {
  friendPanel.value = !friendPanel.value
  if (friendPanel.value) {
    rightTab.value = 'friends'
    closeFriendMenu()
    // 打开时按当前 tab 预载数据（USER-FOLLOW-01）
    if (friendTab.value === 'following') loadFollowList('following')
    else if (friendTab.value === 'follower') loadFollowList('follower')
    else refreshFollowStatus()
  }
  syncBodyLock()
}

/** 统一页面滚动锁：面板或菜单任一打开 → 锁死 body，聊天页面纹丝不动 */
function syncBodyLock() {
  document.body.style.overflow =
    friendPanel.value || friendMenu.value || memberCard.value || msgMenu.value || forwardPanel.value || favPanel.value || createGroupOpen.value || groupManagerOpen.value
      ? 'hidden'
      : ''
}

/** 好友下拉菜单：定位（右侧/底部空间不足自动反弹）+ 锁定页面滚动 */
function openFriendMenu(u: any, e: MouseEvent) {
  // 关键：阻止本次 click 继续冒泡到 window 关闭监听器（否则菜单刚打开就被自己关掉）
  e.stopPropagation()
  const rect = (e.currentTarget as HTMLElement).getBoundingClientRect()
  const MENU_W = 190
  const MENU_H = 138
  let x = Math.min(rect.left, window.innerWidth - MENU_W - 8)
  let y = rect.bottom + 6
  if (y + MENU_H > window.innerHeight) y = Math.max(8, rect.top - MENU_H - 6)
  // 兜底：任何情况下菜单都在视口内（防滚动后的项 rect 异常）
  x = Math.max(8, x)
  y = Math.max(8, y)
  friendMenu.value = { user: u, x, y }
  syncBodyLock()
}

function closeFriendMenu() {
  friendMenu.value = null
  syncBodyLock()
}

/** 成员头像卡片：公共频道点成员弹出，头像卡片内可关注/发消息 */
function openMemberCard(m: any, e: MouseEvent) {
  e.stopPropagation()
  // 先查关注状态（单用户）
  if (m.uid && followStatus[m.uid] === undefined) {
    fetch('/api/user/follow/status', {
      method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + followToken() },
      body: JSON.stringify({ targetIds: [m.uid] }),
    }).then((r) => r.json()).then((j) => {
      if (j.data?.status) followStatus.value = { ...followStatus.value, ...j.data.status }
    }).catch(() => {})
  }
  const rect = (e.currentTarget as HTMLElement).getBoundingClientRect()
  const W = 300, H = 150
  let x = Math.min(Math.max(8, rect.left + rect.width / 2 - W / 2), window.innerWidth - W - 8)
  let y = rect.bottom + 8
  if (y + H > window.innerHeight) y = Math.max(8, rect.top - H - 8)
  memberCard.value = { m, x, y }
  syncBodyLock()
}

function closeMemberCard() {
  memberCard.value = null
  syncBodyLock()
}

async function menuSend(u: any) {
  closeFriendMenu()
  closeMemberCard()
  await openPrivate(u)
}

// ══ R10 群聊生态：创建群 / 群管理（三级权限 + 申请流） ═══════════════
const createGroupOpen = ref(false)
const createGroupName = ref('')
const createGroupIntro = ref('')
const createGroupBusy = ref(false)
const createGroupError = ref('')
function openCreateGroup() {
  createGroupOpen.value = true
  createGroupError.value = ''
  syncBodyLock()
}
async function createGroup() {
  const name = createGroupName.value.trim()
  if (!name) { createGroupError.value = '群名称必填'; return }
  createGroupBusy.value = true
  createGroupError.value = ''
  try {
    const r = await fetch('/api/im/groups', {
      method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + authToken() },
      body: JSON.stringify({ name, intro: createGroupIntro.value.trim() }),
    })
    const j = await r.json()
    if (!j.success) { createGroupError.value = j.error || '创建失败'; return }
    createGroupOpen.value = false
    createGroupName.value = ''
    createGroupIntro.value = ''
    // 刷新左栏群列表并直接进入新群
    await loadChannels()
    const ch = { id: j.data.group.channelId, groupId: j.data.group.id, type: 4, name: j.data.group.name, desc: `共 ${j.data.group.memberCount} 位群友`, kind: 'group', groupRole: 2, ownerUid: j.data.group.ownerUid, memberCount: j.data.group.memberCount }
    await switchChannel(ch)
  } catch (e) {
    createGroupError.value = (e as Error).message
  } finally {
    createGroupBusy.value = false
    syncBodyLock()
  }
}

// ── 群管理弹窗 ──
const groupManagerOpen = ref(false)
const groupManagerTab = ref<'info' | 'edit' | 'members' | 'invite' | 'applies'>('info')
const groupDetail = ref<any>(null)
const groupMyRole = ref(-1)
const groupOwnerName = ref('')
const groupEditName = ref('')
const groupEditIntro = ref('')
const groupEditBusy = ref(false)
const groupEditError = ref('')
const groupApplies = ref<any[]>([])
const groupInviteSearch = ref('')
const groupInviteBusy = ref(false)

async function openGroupManager() {
  const ch = currentChannel.value
  if (!ch || ch.kind !== 'group') return
  groupManagerTab.value = 'info'
  groupManagerOpen.value = true
  groupEditError.value = ''
  syncBodyLock()
  await refreshGroupDetail()
}
function closeGroupManager() {
  groupManagerOpen.value = false
  syncBodyLock()
}
async function refreshGroupDetail() {
  const ch = currentChannel.value
  if (!ch) return
  try {
    const r = await fetch(`/api/im/groups/${ch.groupId}`, { headers: { Authorization: 'Bearer ' + authToken() } })
    const j = await r.json()
    if (!j.success) return
    groupDetail.value = j.data
    groupMyRole.value = j.data.myRole
    groupEditName.value = j.data.group.name
    groupEditIntro.value = j.data.group.intro
    const owner = j.data.members.find((m: any) => m.role === 2)
    groupOwnerName.value = owner?.name || '群主'
    // 同步右栏成员列表（角色标识实时）
    members.value = j.data.members.map((m: any) => ({ ...m, status: m.online ? 1 : 0 }))
  } catch (e) {
    console.error('[昆仑茶馆] 群详情加载失败', e)
  }
}
const groupMemberUidSet = computed(() => new Set((groupDetail.value?.members || []).map((m: any) => m.uid)))
const filteredInviteUsers = computed(() => {
  const q = groupInviteSearch.value.trim()
  return users.value.filter((u: any) => !groupMemberUidSet.value.has(u.id) && (!q || (u.name || '').includes(q) || (u.email || '').includes(q)))
})
async function updateGroup() {
  const ch = currentChannel.value
  if (!ch) return
  groupEditBusy.value = true
  groupEditError.value = ''
  try {
    const r = await fetch(`/api/im/groups/${ch.groupId}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + authToken() },
      body: JSON.stringify({ name: groupEditName.value.trim(), intro: groupEditIntro.value.trim() }),
    })
    const j = await r.json()
    if (!j.success) { groupEditError.value = j.error || '保存失败'; return }
    groupManagerTab.value = 'info'
    ch.name = j.data.group.name
    ch.desc = j.data.group.intro || ch.desc
    await refreshGroupDetail()
  } catch (e) {
    groupEditError.value = (e as Error).message
  } finally {
    groupEditBusy.value = false
  }
}
async function dissolveGroup() {
  const ch = currentChannel.value
  if (!ch) return
  if (!window.confirm(`确定解散群「${ch.name}」？成员将被清出，不可恢复`)) return
  try {
    const r = await fetch(`/api/im/groups/${ch.groupId}`, { method: 'DELETE', headers: { Authorization: 'Bearer ' + authToken() } })
    const j = await r.json()
    if (!j.success) { alert(j.error || '解散失败'); return }
    closeGroupManager()
    groups.value = groups.value.filter((g) => g.groupId !== ch.groupId)
    if (isActive(ch)) {
      if (channels.value.length) await switchChannel(channels.value[0])
      else { currentChannel.value = null; messages.value = []; members.value = [] }
    }
  } catch (e) {
    alert((e as Error).message)
  }
}
async function setMemberRole(uid: string, role: number) {
  const ch = currentChannel.value
  if (!ch) return
  try {
    const r = await fetch(`/api/im/groups/${ch.groupId}/members/${uid}/role`, {
      method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + authToken() },
      body: JSON.stringify({ role }),
    })
    const j = await r.json()
    if (!j.success) { alert(j.error || '操作失败'); return }
    await refreshGroupDetail()
  } catch (e) {
    alert((e as Error).message)
  }
}
async function kickMember(uid: string) {
  const ch = currentChannel.value
  if (!ch) return
  try {
    const r = await fetch(`/api/im/groups/${ch.groupId}/members/${uid}`, { method: 'DELETE', headers: { Authorization: 'Bearer ' + authToken() } })
    const j = await r.json()
    if (!j.success) { alert(j.error || '操作失败'); return }
    await refreshGroupDetail()
  } catch (e) {
    alert((e as Error).message)
  }
}
async function inviteMember(uid: string) {
  const ch = currentChannel.value
  if (!ch) return
  groupInviteBusy.value = true
  try {
    const r = await fetch(`/api/im/groups/${ch.groupId}/members`, {
      method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + authToken() },
      body: JSON.stringify({ uids: [uid] }),
    })
    const j = await r.json()
    if (!j.success) { alert(j.error || '邀请失败'); return }
    await refreshGroupDetail()
  } catch (e) {
    alert((e as Error).message)
  } finally {
    groupInviteBusy.value = false
  }
}
async function applyGroupAdmin() {
  const ch = currentChannel.value
  if (!ch) return
  const reason = window.prompt('申请理由（群主可见，选填）：') ?? ''
  try {
    const r = await fetch(`/api/im/groups/${ch.groupId}/apply`, {
      method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + authToken() },
      body: JSON.stringify({ reason }),
    })
    const j = await r.json()
    alert(j.success ? '申请已提交，等待群主审批' : (j.error || '申请失败'))
  } catch (e) {
    alert((e as Error).message)
  }
}
async function openGroupApplies() {
  const ch = currentChannel.value
  if (!ch) return
  groupManagerTab.value = 'applies'
  try {
    const r = await fetch(`/api/im/groups/${ch.groupId}/applies`, { headers: { Authorization: 'Bearer ' + authToken() } })
    const j = await r.json()
    groupApplies.value = j.success ? (j.data.applies || []) : []
  } catch (e) {
    groupApplies.value = []
  }
}
async function handleApply(applyId: string, approve: boolean) {
  const ch = currentChannel.value
  if (!ch) return
  try {
    const r = await fetch(`/api/im/groups/${ch.groupId}/applies/${applyId}`, {
      method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + authToken() },
      body: JSON.stringify({ approve }),
    })
    const j = await r.json()
    if (!j.success) { alert(j.error || '操作失败'); return }
    await openGroupApplies()
    await refreshGroupDetail()
  } catch (e) {
    alert((e as Error).message)
  }
}
const pendingApplyCount = computed(() => groupApplies.value.filter((a: any) => a.status === 'pending').length)

function menuProfile(u: any) {
  closeFriendMenu()
  friendPanel.value = false
  syncBodyLock()
  profileUser.value = u
  rightTab.value = 'members'
}

// 发送送达追踪：SDK send 返回本地消息（messageSeq=0），服务端 Sendack 回执（clientSeq + reasonCode）
// 才是真正送达确认；超时未收到回执 = 连接异常静默丢消息 → toast 提示
const pendingSends = new Map<number, { clientSeq: number; clientMsgNo: string; warnTimer: ReturnType<typeof setTimeout> }>()
const toastMsg = ref('')
let toastTimer: ReturnType<typeof setTimeout> | null = null

function showToast(text: string) {
  toastMsg.value = text
  if (toastTimer) clearTimeout(toastTimer)
  toastTimer = setTimeout(() => {
    toastMsg.value = ''
  }, 4000)
}

function trackSend(clientSeq: number, clientMsgNo: string, text: string) {
  const warnTimer = setTimeout(() => {
    if (pendingSends.has(clientSeq)) {
      pendingSends.delete(clientSeq)
      // 静默丢失：恢复草稿方便重试 + toast 提示（不再假装已发出）
      if (!draft.value) draft.value = text
      showToast('⚠ 消息可能未送达（网络不稳定），草稿已保留，请重试')
    }
  }, 8000)
  pendingSends.set(clientSeq, { clientSeq, clientMsgNo, text, warnTimer })
}

function markDelivered(clientSeq: number) {
  const p = pendingSends.get(clientSeq)
  if (p) {
    clearTimeout(p.warnTimer)
    pendingSends.delete(clientSeq)
  }
}

async function handleSend() {
  let text = draft.value.trim()
  if (!text || !tea.connected.value || !currentChannel.value) return
  // M3 敏感词即时替换（客户端，无感知）：词库缓存 5 分钟，命中替换为等长 *
  await ensureSensitiveWords()
  const safe = sanitizeText(text)
  if (safe !== text) {
    text = safe
    showToast('⚠ 已自动过滤敏感词汇')
  }
  draft.value = ''
  try {
    const msg = await tea.sendText(text, currentChannel.value.id, currentChannel.value.type)
    messages.value.push({ ...msg, key: msgKey(msg) })
    // clientSeq 在 SDK 本地消息对象上（send 返回的 message），Sendack 用它配对
    const clientSeq = msg.clientSeq ?? (msg as any).clientSeq
    if (typeof clientSeq === 'number') trackSend(clientSeq, msg.clientMsgNo || '', text)
    scrollBottom()
  } catch (e) {
    console.error('[昆仑茶馆] 发送失败', e)
    draft.value = text
    showToast('⚠ 发送失败，草稿已保留')
  }
}

// ══ M3 敏感词即时替换（SPRINT-IM-CHA-03） ═════════════════
const sensitiveWords = ref<string[]>([])
let sensitiveFetchedAt = 0

function authToken() {
  try { return window.localStorage?.getItem('auth_token') || '' } catch { return '' }
}

async function ensureSensitiveWords() {
  if (sensitiveWords.value.length && Date.now() - sensitiveFetchedAt < 5 * 60 * 1000) return
  try {
    const res = await fetch('/api/im/sensitive-words', { headers: { Authorization: 'Bearer ' + authToken() } })
    if (res.ok) {
      const j = await res.json()
      if (j.data?.words) { sensitiveWords.value = j.data.words; sensitiveFetchedAt = Date.now() }
    }
  } catch { /* 非致命：服务端 webhook 兜底 */ }
}

function sanitizeText(text: string) {
  let out = text
  for (const w of sensitiveWords.value) {
    if (!w || !out.includes(w)) continue
    out = out.split(w).join('*'.repeat(w.length))
  }
  return out
}

// ══ 礼物体系（GIFT-GOLD-ECO-01） ══════════════════════
const giftPanelOpen = ref(false)
const giftGroups = ref<any[]>([])
const giftActiveTab = ref('热门')
const giftSelected = ref<any>(null)
const giftReceiverUid = ref('')
const giftSending = ref(false)
const diamondBalance = ref(0)
const giftAnimation = ref<any>(null)
let giftAnimTimer: ReturnType<typeof setTimeout> | null = null

function giftToken() {
  try { return window.localStorage?.getItem('auth_token') || '' } catch { return '' }
}

const isDmChannel = computed(() => currentChannel.value?.kind === 'dm')
const giftReceiverOk = computed(() => (isDmChannel.value ? !!peerUid.value : !!giftReceiverUid.value))
const activeGiftItems = computed(() => giftGroups.value.find((g) => g.category === giftActiveTab.value)?.items || [])

async function loadDiamondBalance() {
  try {
    const r = await fetch('/api/user/diamonds', { headers: { Authorization: 'Bearer ' + giftToken() } })
    const j = await r.json()
    diamondBalance.value = (j.data || j).totalDiamonds || 0
  } catch { diamondBalance.value = 0 }
}

async function openGiftPanel() {
  if (!currentChannel.value) return
  giftPanelOpen.value = true
  giftSelected.value = null
  giftReceiverUid.value = ''
  // 群里必须显式指定接收人（掌柜 08-06：群里未指定接收人必须无法送）；私聊直接送给对方
  if (isDmChannel.value) {
    giftReceiverUid.value = peerUid.value
  } else {
    giftReceiverUid.value = ''
  }
  try {
    const r = await fetch('/api/gifts/products', { headers: { Authorization: 'Bearer ' + giftToken() } })
    const j = await r.json()
    giftGroups.value = (j.data || {}).gifts || []
    if (giftGroups.value.length) giftActiveTab.value = giftGroups.value[0].category
  } catch { giftGroups.value = [] }
  loadDiamondBalance()
}

function playGiftAnimation(gift: any, toName: string) {
  const g = {
    icon: gift.iconUrl || '🎁',
    iconGradient: gift.iconGradient || '',
    name: gift.giftName || gift.name || '礼物',
    fromName: '我',
    toName: toName || '茶客',
  }
  giftAnimation.value = g
  if (giftAnimTimer) clearTimeout(giftAnimTimer)
  giftAnimTimer = setTimeout(() => { giftAnimation.value = null }, 3200)
}

async function sendGift() {
  if (!giftSelected.value || !giftReceiverOk.value || giftSending.value || !currentChannel.value) return
  const receiverUid = isDmChannel.value ? peerUid.value : giftReceiverUid.value
  giftSending.value = true
  try {
    const r = await fetch('/api/gifts/send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + giftToken() },
      body: JSON.stringify({
        giftId: giftSelected.value.id,
        receiverUid,
        channelId: currentChannel.value.id,
        channelType: currentChannel.value.type,
      }),
    })
    const j = await r.json()
    if (j.success) {
      diamondBalance.value = Math.max(0, diamondBalance.value - (j.data?.gift?.priceDiamonds || giftSelected.value.priceDiamonds))
      const toName = isDmChannel.value
        ? currentChannel.value.name || '茶客'
        : (members.value.find((m) => m.uid === receiverUid)?.name || '茶客')
      playGiftAnimation(giftSelected.value, toName)
      // 服务端已代发礼物消息，本地即时补一条（不等 WS 推送）
      messages.value.push({
        fromUID: tea.userId.value,
        authorName: '我',
        timestamp: Math.floor(Date.now() / 1000),
        content: { kind: 'gift', giftName: giftSelected.value.name, giftIcon: giftSelected.value.iconUrl, priceDiamonds: giftSelected.value.priceDiamonds, receiverUid },
        key: 'gift-' + Date.now(),
      })
      scrollBottom()
      giftPanelOpen.value = false
      showToast(`🎁 已送出「${giftSelected.value.name}」`)
    } else {
      showToast('⚠ ' + (j.error || '赠送失败'))
      if (j.code === 'DIAMOND_INSUFFICIENT') loadDiamondBalance()
    }
  } catch (e) {
    console.error('[昆仑茶馆] 送礼失败', e)
    showToast('⚠ 赠送失败，请重试')
  } finally {
    giftSending.value = false
  }
}

function goHome() {
  // 顶栏 logo / 标题 → 返回首页（工作台）
  if (typeof window !== 'undefined') window.location.href = '/'
}

// ══ 红包体系（IM-CHA-M6） ══════════════════════
const rpPanelOpen = ref(false)
const rpSending = ref(false)
const rpForm = ref({ mode: 'lucky', amount: 10, count: 5, note: '恭喜发财，大吉大利！' })
const rpQuickAmounts = [1, 5, 10, 50, 100]
const rpDetail = ref<any>(null)
const rpGrabbing = ref(false)
const rpAnim = ref<any>(null)
let rpAnimTimer: ReturnType<typeof setTimeout> | null = null
let rpDetailLoadSeq = 0 // 防止异步详情覆盖新弹窗

function openRedPacketPanel() {
  if (!currentChannel.value) return
  if (isDmChannel.value) {
    rpForm.value = { mode: 'normal', amount: 10, count: 1, note: '恭喜发财，大吉大利！' }
  }
  loadDiamondBalance()
  rpPanelOpen.value = true
}

async function sendRedPacket() {
  if (!currentChannel.value || rpSending.value) return
  const { mode, amount, count, note } = rpForm.value
  // 私聊直接红包：强制单个固定金额（后端同规则防御）
  const isDm = currentChannel.value.kind === 'dm'
  const finalCount = isDm ? 1 : count
  const finalMode = isDm ? 'normal' : mode
  if (!amount || !finalCount || amount * finalCount < finalCount) return showToast('⚠ 金额不能少于个数')
  rpSending.value = true
  try {
    const r = await fetch('/api/im/red-packets', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + giftToken() },
      body: JSON.stringify({
        channelId: currentChannel.value.id,
        channelType: currentChannel.value.type,
        totalDiamonds: amount * finalCount,
        count: finalCount,
        mode: finalMode,
        note,
      }),
    })
    const j = await r.json()
    if (j.success) {
      diamondBalance.value = Math.max(0, diamondBalance.value - amount * finalCount)
      // 本地即时补红包卡片（服务端已代发，不等 WS 推送）
      messages.value.push({
        fromUID: tea.userId.value,
        authorName: '我',
        timestamp: Math.floor(Date.now() / 1000),
        content: { kind: 'red_packet', id: j.data.id, note, totalDiamonds: amount * finalCount, count: finalCount, mode: finalMode, dm: isDm },
        key: 'rp-' + Date.now(),
      })
      scrollBottom()
      refreshRpStatuses() // 卡片状态（自己发的显示「查看红包 · 剩 N 个」）
      rpPanelOpen.value = false
      showToast(`🧧 红包已发出（${amount * finalCount} 钻石）`)
    } else {
      showToast('⚠ ' + (j.error || '发红包失败'))
      if (j.code === 'DIAMOND_INSUFFICIENT') loadDiamondBalance()
    }
  } catch (e) {
    console.error('[昆仑茶馆] 发红包失败', e)
    showToast('⚠ 发红包失败，请重试')
  } finally {
    rpSending.value = false
  }
}

async function openRpDetail(id: string) {
  const seq = ++rpDetailLoadSeq
  try {
    const r = await fetch('/api/im/red-packets/' + id, { headers: { Authorization: 'Bearer ' + giftToken() } })
    const j = await r.json()
    if (!j.success) return showToast('⚠ ' + (j.error || '红包不存在'))
    if (seq !== rpDetailLoadSeq) return
    rpDetail.value = j.data
    rpGrabbing.value = false
  } catch (e) {
    console.error('[昆仑茶馆] 红包详情失败', e)
  }
}

async function grabRedPacket() {
  if (!rpDetail.value || rpGrabbing.value) return
  rpGrabbing.value = true
  try {
    const r = await fetch('/api/im/red-packets/' + rpDetail.value.id + '/grab', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + giftToken() },
      body: JSON.stringify({ channelId: currentChannel.value?.id || '', channelType: currentChannel.value?.type || 0 }),
    })
    const j = await r.json()
    if (j.success) {
      const amount = j.data.amount
      rpAnim.value = { amount, note: rpDetail.value.note }
      if (rpAnimTimer) clearTimeout(rpAnimTimer)
      rpAnimTimer = setTimeout(() => { rpAnim.value = null }, 3200)
      // 重新拉详情显示「我抢到」+ 抢包记录
      await openRpDetail(rpDetail.value.id)
      refreshRpStatuses() // 领取后卡片状态即时更新（私聊：已领取 +X 钻）
    } else {
      showToast('⚠ ' + (j.error || '抢红包失败'))
      await openRpDetail(rpDetail.value.id) // 刷新状态（可能已被抢完）
    }
  } catch (e) {
    console.error('[昆仑茶馆] 抢红包失败', e)
    showToast('⚠ 抢红包失败，请重试')
  } finally {
    rpGrabbing.value = false
  }
}

function closeRpDetail() {
  rpDetailLoadSeq++
  rpDetail.value = null
  rpGrabbing.value = false
}

function handleDisconnect() {
  tea.disconnect()
}

function scrollBottom() {
  nextTick(() => {
    if (msgListRef.value) msgListRef.value.scrollTop = msgListRef.value.scrollHeight
  })
}

// 窄屏自动折叠右栏
function handleResize() {
  if (typeof window !== 'undefined') {
    rightPanelOpen.value = window.innerWidth >= 1100
  }
}

// 外部点击 / Esc 关闭：菜单 + 好友下拉框
function onWindowClick() {
  closeFriendMenu()
  closeMemberCard()
  emojiPanelOpen.value = false
  if (friendPanel.value) toggleFriendPanel()
}
function onKeydown(e: KeyboardEvent) {
  if (e.key === 'Escape') {
    closeFriendMenu()
    closeMemberCard()
    emojiPanelOpen.value = false
    if (friendPanel.value) toggleFriendPanel()
  }
}

onMounted(async () => {
  ;(window as any).__klImgView = (src: string) => viewImage(src)
  ;(window as any).__klOpenRedPacket = (id: string) => openRpDetail(id)
  installVoiceGlobals()
  installMsgHoldClickGuard()
  // ══ R11：初始化 RTC（拉取 ICE 配置 + 注册 CMD 信令监听，须在 connect 前）══
  try {
    rtcSetIdentity = (await rtc.init({})).setIdentity
  } catch (e) {
    console.warn('[RTC] 初始化失败（非致命）', e)
  }
  tea.onMessage((msg: any) => {
    const ch = currentChannel.value
    const msgChannel = msg.channel
    const isCurrent = ch && msgChannel && msgChannel.channelID === ch.id && msgChannel.channelType === ch.type
    // 非当前频道的私聊消息：累计未读红点（不打断当前聊天）；当前频道消息才渲染
    if (!isCurrent) {
      const cid = msgChannel ? `${msgChannel.channelType}:${msgChannel.channelID}` : ''
      if (cid && msg.fromUID !== tea.userId.value && msgChannel.channelType === 4) {
        unreadMap[cid] = (unreadMap[cid] || 0) + 1
      }
      return
    }
    if (msg.fromUID === tea.userId.value) return
    // IM-CHA-M10 撤回通知：标记本地对应消息已撤回 + 渲染系统提示条
    const recallInfo = extractRecallInfo(msg)
    if (recallInfo) {
      const mid = String(recallInfo.messageId || '')
      if (mid) {
        for (const m of messages.value) {
          if (msgMessageId(m) === mid) m.recalled = true
        }
      }
      messages.value.push({ ...msg, fromUID: msg.fromUID || msg.from_uid, key: msgKey(msg) })
      scrollBottom()
      return
    }
    messages.value.push({ ...msg, fromUID: msg.fromUID || msg.from_uid, key: msgKey(msg) })
    // 红包消息 → 拉取实时状态（卡片显示「领取红包/已被领完」）
    if (extractRedPacketInfo(msg) || extractRedPacketGrabbedInfo(msg)) refreshRpStatuses()
    // 他人送的礼物 → 全屏动画（服务端代发 payload: {type:2, content:{kind:'gift'}}）
    const giftInfo = extractGiftInfo(msg)
    if (giftInfo) {
      const toName = giftInfo.receiverUid ? (members.value.find((m) => m.uid === giftInfo.receiverUid)?.name || '茶客') : '茶客'
      playGiftAnimation(giftInfo, toName)
    }
    scrollBottom()
  })
  // 发送回执：reasonCode 0/1 或 messageSeq>0 = 成功送达（WuKongIM 入库即成功，1 表示已持久化）；
  // 非 0 且无 seq = 失败；reasonCode=3（不在频道，容器重启丢订阅）→ 自动重订阅 + 重发
  tea.onSendStatus(async (p: any) => {
    const clientSeq = p?.clientSeq
    if (typeof clientSeq !== 'number') return
    const pend = pendingSends.get(clientSeq)
    if (!pend) return
    const delivered = p.reasonCode === 0 || p.reasonCode === 1 || (p.messageSeq && p.messageSeq > 0)
    if (delivered) {
      markDelivered(clientSeq)
      return
    }
    if (p.reasonCode === 3 && pend.text) {
      pendingSends.delete(clientSeq)
      clearTimeout(pend.warnTimer)
      const text = pend.text
      showToast('🔄 频道订阅已恢复，正在重发…')
      try {
        await tea.rejoin()
        if (currentChannel.value && tea.connected.value) {
          const msg = await tea.sendText(text, currentChannel.value.id, currentChannel.value.type)
          messages.value.push({ ...msg, key: msgKey(msg) })
          const cs = msg.clientSeq ?? (msg as any).clientSeq
          if (typeof cs === 'number') trackSend(cs, msg.clientMsgNo || '', text)
          scrollBottom()
        }
      } catch (e) {
        console.error('[昆仑茶馆] 自动重发失败', e)
        showToast('⚠ 发送失败，请重试')
      }
      return
    }
    pendingSends.delete(clientSeq)
    clearTimeout(pend.warnTimer)
    showToast('⚠ 消息发送失败（' + (p.reason || '连接异常') + '）')
  })

  await Promise.all([loadChannels(), loadUsers()])
  // 会话列表定时刷新：新私聊频道 20s 内自动订阅（在线未开窗也能实时收到）
  dmPoll = setInterval(() => { loadChannels().catch(() => {}) }, 20000)
  // USER-FOLLOW-01：关注统计 + 关注列表 + 名录关注状态点亮
  loadFollowStats()
  loadFollowList('following')
  loadFollowList('follower')
  refreshFollowStatus()
  try {
    await tea.connect()
  } catch (e) {
    console.error('[昆仑茶馆] 连接失败', e)
  }
  // ══ R11：连接成功后注入本人身份（来电显示用）══
  try {
    const me = readMyProfile()
    rtcSetIdentity(tea.userId.value, me?.username || me?.email?.split('@')[0] || '茶客', me?.avatarUrl || '')
  } catch { /* 非致命 */ }
  // ?dm=<uid> 直达私聊（会员中心关注列表「发消息」跳转）
  const dmUid = route.query.dm as string | undefined
  if (dmUid && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(dmUid)) {
    const target = users.value.find((u) => u.id === dmUid)
    await openPrivate(target || { id: dmUid, email: '', name: '茶客' })
  }
  handleResize()
  window.addEventListener('resize', handleResize)
  // 点好友弹独立菜单：外部点击 / Esc 关闭
  window.addEventListener('click', onWindowClick)
  window.addEventListener('keydown', onKeydown)
})

onBeforeUnmount(() => {
  if (dmPoll) clearInterval(dmPoll)
  window.removeEventListener('resize', handleResize)
  window.removeEventListener('click', onWindowClick)
  window.removeEventListener('keydown', onKeydown)
  ;(window as any).__klImgView = undefined
  ;(window as any).__klPlayVoice = undefined
  ;(window as any).__klVoiceHoldStart = undefined
  ;(window as any).__klVoiceHoldEnd = undefined
  ;(window as any).__klVoiceHoldCancel = undefined
  if (voiceAudio) { voiceAudio.pause(); voiceAudio = null }
  if (voiceHoldTimer) { clearTimeout(voiceHoldTimer); voiceHoldTimer = null }
  closeFriendMenu()
  friendPanel.value = false
  syncBodyLock()
})
</script>

<style scoped>
.tea-toast {
  position: fixed;
  top: 18px;
  left: 50%;
  transform: translateX(-50%);
  z-index: 9999;
  padding: 10px 18px;
  border-radius: 10px;
  background: rgba(239, 68, 68, 0.92);
  color: #FBF8EF;
  font-size: 13px;
  box-shadow: 0 6px 24px rgba(0, 0, 0, 0.35);
  pointer-events: none;
  animation: teaToastIn 0.25s ease;
}
@keyframes teaToastIn {
  from { opacity: 0; transform: translateX(-50%) translateY(-6px); }
  to { opacity: 1; transform: translateX(-50%) translateY(0); }
}
.tea-page {
  /* 微信群模式：页面锁死在视口高度，消息再多也不撑高页面、不挤走输入框 */
  /* 青花瓷主题（IM-CHA-M6）：宣纸底 + 雨过天青晕染 + 青花缠枝莲水印 */
  /* 显式重定义全局深色变量 → 本组件浅色主题（全局 :root 仍为深色品牌变量） */
  --color-bg-primary: #F6F1E3;
  --color-text-primary: #33302A;
  --color-text-muted: #6F6A5C;
  --color-text-disabled: #A39D8E;
  --color-border-primary: #A8CDD8;
  --color-bg-elevated: #FBF8EF;
  --color-bg-hover: #EDE5CE;
  --color-decision: #26547C;
  --color-execution: #3E7F99;
  height: 100vh;
  height: 100dvh;
  overflow: hidden;
  background-color: var(--color-bg-primary, #F6F1E3);
  background-image:
    radial-gradient(1100px 500px at 12% -8%, rgba(95, 168, 190, 0.2), transparent 60%),
    radial-gradient(850px 420px at 96% 6%, rgba(168, 205, 216, 0.3), transparent 55%),
    url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='180' height='180' viewBox='0 0 180 180'%3E%3Cg fill='none' stroke='%2326547C' stroke-width='1.1' opacity='0.05'%3E%3Ccircle cx='90' cy='90' r='26'/%3E%3Ccircle cx='90' cy='90' r='14'/%3E%3Cpath d='M90 64c-9-7-18-9-27-9 0 9 4 16 13 21'/%3E%3Cpath d='M90 64c9-7 18-9 27-9 0 9-4 16-13 21'/%3E%3Cpath d='M90 116c-9 7-18 9-27 9 0-9 4-16 13-21'/%3E%3Cpath d='M90 116c9 7 18 9 27 9 0-9-4-16-13-21'/%3E%3Cpath d='M90 64v-18M90 116v18M64 90H46M116 90h18'/%3E%3Cpath d='M30 30c7-9 21-9 28 0-9 5-19 5-28 0z'/%3E%3Cpath d='M150 30c-7-9-21-9-28 0 9 5 19 5 28 0z'/%3E%3Cpath d='M30 150c7 9 21 9 28 0-9-5-19-5-28 0z'/%3E%3Cpath d='M150 150c-7 9-21 9-28 0 9-5 19-5 28 0z'/%3E%3Ccircle cx='30' cy='30' r='5'/%3E%3Ccircle cx='150' cy='30' r='5'/%3E%3Ccircle cx='30' cy='150' r='5'/%3E%3Ccircle cx='150' cy='150' r='5'/%3E%3C/g%3E%3C/svg%3E");
  color: var(--color-text-primary, #33302A);
  display: flex;
  flex-direction: column;
  font-family: -apple-system, 'PingFang SC', 'Microsoft YaHei', 'Noto Serif SC', system-ui, sans-serif;
}

/* ── 顶栏 ─────────────────────────── */
.tea-header {
  display: flex;
  align-items: center;
  gap: 16px;
  padding: 12px 20px;
  border-bottom: 1px solid var(--color-border-primary, #A8CDD8);
  box-shadow: 0 1px 0 rgba(38, 84, 124, 0.08);
  background: rgba(246, 241, 227, 0.94);
  backdrop-filter: blur(10px);
  position: sticky;
  top: 0;
  z-index: 10;
}
.tea-brand { display: flex; align-items: center; gap: 12px; cursor: pointer; border-radius: 10px; padding: 4px 8px; margin-left: -8px; transition: background 0.2s; }
.tea-brand:hover { background: rgba(124, 92, 52, 0.1); }
.tea-logo {
  font-size: 26px;
  width: 46px; height: 46px;
  display: flex; align-items: center; justify-content: center;
  background: linear-gradient(135deg, #26547C, #5FA8BE);
  border-radius: 14px;
  box-shadow: 0 4px 20px rgba(59, 130, 246, 0.35);
}
.tea-title {
  font-family: 'KaiTi', 'STKaiti', 'Kaiti SC', 'Noto Serif SC', 'Songti SC', serif;
  letter-spacing: 2px; font-size: 20px; font-weight: 700; letter-spacing: 2px; margin: 0; }
.tea-sub { font-size: 12px; color: var(--color-text-muted, #6F6A5C); margin: 2px 0 0; }

.tea-status {
  margin-left: auto;
  display: flex; align-items: center; gap: 6px;
  font-size: 13px;
  padding: 5px 12px;
  border-radius: 20px;
  border: 1px solid var(--color-border-primary, #A8CDD8);
  color: var(--color-text-secondary, #94a3b8);
}
.status-dot { width: 8px; height: 8px; border-radius: 50%; background: #A39D8E; display: inline-block; }
.tea-status.is-on { color: #10b981; border-color: rgba(16, 185, 129, 0.4); }
.tea-status.is-on .status-dot { background: #3E7F99; box-shadow: 0 0 8px rgba(62, 127, 153, 0.7); }
.tea-status.is-connecting { color: #B98A3E; }
.tea-status.is-connecting .status-dot { background: #B98A3E; animation: blink 1s infinite; }
@keyframes blink { 50% { opacity: 0.3; } }
.member-toggle { display: none; }

/* ── 主体三栏 ─────────────────────── */
.tea-body {
  flex: 1;
  display: grid;
  grid-template-columns: 250px minmax(0, 1fr) 260px;
  /* 行高锁死为剩余高度：中栏消息区内部滚动，输入框永不被挤出视口 */
  grid-template-rows: minmax(0, 1fr);
  min-height: 0;
}

/* 左栏 */
.tea-sidebar {
  border-right: 1px solid var(--color-border-primary, #A8CDD8);
  background: rgba(246, 241, 227, 0.88);
  padding: 12px 10px;
  display: flex; flex-direction: column;
  gap: 14px;
  overflow-y: auto;
}
.sidebar-search {
  display: flex; align-items: center; gap: 8px;
  background: var(--color-bg-elevated, #FBF8EF);
  border: 1px solid var(--color-border-primary, #A8CDD8);
  border-radius: 10px;
  padding: 7px 10px;
}
.search-icon { font-size: 13px; opacity: 0.7; }
.search-input {
  flex: 1; background: transparent; border: none; outline: none;
  color: var(--color-text-primary, #33302A); font-size: 13px;
}
.side-group { display: flex; flex-direction: column; gap: 3px; }
.side-group-title {
  font-size: 12px; color: var(--color-text-muted, #6F6A5C);
  padding: 2px 8px 6px; letter-spacing: 1px; font-weight: 600;
}
.side-empty { font-size: 12px; color: var(--color-text-disabled, #A39D8E); padding: 6px 10px; }
.channel-item {
  display: flex; align-items: center; gap: 10px;
  padding: 8px 10px;
  border-radius: 10px;
  cursor: pointer;
  transition: background 0.2s;
  border: 1px solid transparent;
}
.channel-item:hover { background: var(--color-bg-hover, #EDE5CE); }
.channel-item.active { background: rgba(95, 168, 190, 0.18); border-color: rgba(38, 84, 124, 0.35); }
.channel-icon { font-size: 18px; }
.channel-meta { display: flex; flex-direction: column; gap: 1px; min-width: 0; }
.channel-name { font-size: 13px; font-weight: 600; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.channel-desc { font-size: 11px; color: var(--color-text-muted, #6F6A5C); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.unread-badge { flex-shrink: 0; min-width: 18px; height: 18px; padding: 0 5px; margin-left: auto; border-radius: 9px; background: #E4572E; color: #FFF; font-size: 11px; font-weight: 700; line-height: 18px; text-align: center; }
.sidebar-foot { margin-top: auto; padding: 8px 8px 0; font-size: 11px; color: var(--color-text-disabled, #A39D8E); }

/* 中栏 */
.tea-chat { display: flex; flex-direction: column; min-height: 0; min-width: 0; }
.chat-head {
  padding: 12px 20px;
  border-bottom: 1px solid var(--color-border-primary, #A8CDD8);
  background: rgba(246, 241, 227, 0.82);
  display: flex; align-items: center;
}
.chat-head-main { display: flex; align-items: center; gap: 10px; }
.chat-head-icon { font-size: 22px; }
.chat-head-name { font-size: 15px; font-weight: 700; }
.chat-head-sub { font-size: 11px; color: var(--color-text-muted, #6F6A5C); }

.chat-empty {
  flex: 1; display: flex; flex-direction: column; align-items: center; justify-content: center;
  gap: 8px; color: var(--color-text-muted, #6F6A5C);
}
.empty-emoji { font-size: 48px; opacity: 0.6; }
.go-login { text-decoration: none; margin-top: 6px; }

.msg-list {
  flex: 1;
  min-height: 0; /* 允许收缩：消息多时在框内滚动，不撑高页面 */
  overflow-y: auto;
  overscroll-behavior: contain;
  padding: 20px 24px;
  display: flex;
  flex-direction: column;
  gap: 12px;
}
.msg-row {
  display: flex;
  gap: 10px;
  align-items: flex-start;
  padding: 6px 14px; display: flex; }
.msg-row.mine { justify-content: flex-end; }
.msg-bubble {
  max-width: 62%;
  padding: 10px 14px;
  border-radius: 14px;
  background: var(--color-bg-elevated, #FBF8EF);
  border: 1px solid var(--color-border-primary, #A8CDD8);
}
.msg-row.mine .msg-bubble {
  background: linear-gradient(135deg, rgba(95, 168, 190, 0.3), rgba(168, 205, 216, 0.25));
  border-color: rgba(59, 130, 246, 0.35);
}
.msg-meta { display: flex; gap: 8px; align-items: baseline; margin-bottom: 4px; }
.msg-author { font-size: 12px; font-weight: 600; color: var(--color-decision, #26547C); }
.msg-row.mine .msg-author { color: var(--color-execution, #3E7F99); }
.msg-time { font-size: 11px; color: var(--color-text-disabled, #A39D8E); }
.msg-content { font-size: 14px; line-height: 1.6; word-break: break-word; }
.msg-loading { text-align: center; font-size: 12px; color: var(--color-text-disabled, #A39D8E); }

.msg-input-bar {
  display: flex; gap: 10px; align-items: flex-end;
  padding: 14px 20px 18px;
  border-top: 1px solid var(--color-border-primary, #A8CDD8);
  background: rgba(251, 248, 239, 0.97);
}

/* ══ 礼物体系（GIFT-GOLD-ECO-01） ══ */
.gift-btn {
  flex-shrink: 0;
  width: 42px; height: 42px;
  border-radius: 12px;
  border: 1px solid var(--color-border-primary, #A8CDD8);
  background: linear-gradient(135deg, #DCEBEE, #F6F1E3);
  color: #B98A3E;
  font-size: 20px;
  cursor: pointer;
  transition: transform 0.15s;
}
.gift-btn:hover { transform: scale(1.08); background: linear-gradient(135deg, #DCEBEE, #DCEBEE); }

.gift-inline {
  display: inline-flex; align-items: center; gap: 6px;
  background: linear-gradient(135deg, rgba(185, 138, 62, 0.18), rgba(185, 138, 62, 0.12));
  border: 1px solid rgba(251, 191, 36, 0.35);
  border-radius: 10px;
  padding: 4px 10px;
  font-size: 14px;
  color: #B98A3E;
}
.gift-inline-price { color: #FBF8EF; font-weight: 700; }

/* 礼物弹窗 */
.gift-modal-mask {
  position: fixed; inset: 0; z-index: 9999;
  background: rgba(2, 6, 23, 0.62);
  backdrop-filter: blur(3px);
  display: flex; align-items: center; justify-content: center;
}
.gift-modal {
  width: 520px; max-width: 94vw;
  background: linear-gradient(180deg, #1E2A3A, #111A28);
  border: 1px solid rgba(251, 191, 36, 0.25);
  border-radius: 18px;
  padding: 18px;
  box-shadow: 0 24px 64px rgba(0, 0, 0, 0.6);
}
.gift-modal-head { display: flex; align-items: center; gap: 12px; margin-bottom: 14px; }
.gift-modal-title { font-size: 17px; font-weight: 700; color: #FBF8EF; flex: 1; }
.gift-diamond-balance {
  display: flex; align-items: center; gap: 6px;
  background: rgba(185, 138, 62, 0.14);
  border: 1px solid rgba(251, 191, 36, 0.3);
  border-radius: 999px;
  padding: 5px 12px;
}
.gift-diamond-icon { font-size: 15px; }
.gift-diamond-num { font-size: 15px; font-weight: 800; color: #B98A3E; min-width: 28px; text-align: center; }
.gift-recharge-btn {
  background: linear-gradient(135deg, #B98A3E, #8C5E24);
  color: #FBF8EF; border: none; border-radius: 999px;
  padding: 4px 14px; font-size: 12px; font-weight: 700;
  cursor: pointer; text-decoration: none;
}
.gift-modal-close {
  background: none; border: none; color: rgba(255, 255, 255, 0.45);
  font-size: 18px; cursor: pointer; padding: 4px;
}
.gift-modal-close:hover { color: #FBF8EF; }

.gift-receiver-row {
  display: flex; align-items: center; gap: 8px;
  margin-bottom: 12px;
  padding: 8px 10px;
  background: rgba(255, 255, 255, 0.04);
  border-radius: 10px;
}
.gift-receiver-label { font-size: 12px; color: rgba(255, 255, 255, 0.5); flex-shrink: 0; }
.gift-receiver-list { display: flex; flex-wrap: wrap; gap: 6px; max-height: 44px; overflow-y: auto; }
.gift-receiver-chip {
  background: rgba(255, 255, 255, 0.06);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 999px;
  color: rgba(255, 255, 255, 0.8);
  font-size: 12px; padding: 3px 10px;
  cursor: pointer;
}
.gift-receiver-chip--active { background: rgba(251, 191, 36, 0.2); border-color: #B98A3E; color: #B98A3E; }
.gift-receiver-empty { font-size: 12px; color: rgba(255, 255, 255, 0.35); }

.gift-wall { margin-bottom: 14px; }
.gift-tabs { display: flex; gap: 6px; margin-bottom: 10px; }
.gift-tab {
  background: rgba(255, 255, 255, 0.05);
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 999px;
  color: rgba(255, 255, 255, 0.75);
  font-size: 13px; padding: 5px 16px;
  cursor: pointer;
}
.gift-tab--active { background: linear-gradient(135deg, #B98A3E, #8C5E24); border-color: transparent; color: #FBF8EF; font-weight: 700; }
.gift-grid {
  display: grid; grid-template-columns: repeat(5, 1fr); gap: 8px;
  max-height: 220px; overflow-y: auto;
}
.gift-item {
  background: rgba(255, 255, 255, 0.04);
  border: 1.5px solid rgba(255, 255, 255, 0.07);
  border-radius: 12px;
  padding: 10px 4px 8px;
  display: flex; flex-direction: column; align-items: center; gap: 4px;
  cursor: pointer;
  transition: transform 0.12s, border-color 0.12s;
}
.gift-item:hover { transform: translateY(-2px); border-color: rgba(251, 191, 36, 0.4); }
.gift-item--active { border-color: #B98A3E; background: rgba(185, 138, 62, 0.14); box-shadow: 0 0 0 1px #B98A3E; }
.gift-item-icon {
  width: 46px; height: 46px; border-radius: 13px;
  display: flex; align-items: center; justify-content: center;
  font-size: 26px; line-height: 1;
  box-shadow: inset 0 -6px 12px rgba(255,255,255,0.18), inset 0 2px 4px rgba(255,255,255,0.35), 0 4px 10px rgba(0,0,0,0.3);
  text-shadow: 0 2px 6px rgba(0,0,0,0.25);
}
.gift-item-name { font-size: 12px; color: rgba(255, 255, 255, 0.85); }
.gift-item-price { font-size: 11px; color: #B98A3E; font-weight: 700; }
.gift-grid-empty { grid-column: 1 / -1; text-align: center; color: rgba(255, 255, 255, 0.35); padding: 24px 0; font-size: 13px; }

.gift-modal-foot {
  display: flex; align-items: center; gap: 12px;
  padding-top: 12px;
  border-top: 1px solid rgba(255, 255, 255, 0.08);
}
.gift-foot-info { flex: 1; display: flex; align-items: center; gap: 8px; min-height: 20px; }
.gift-foot-name { font-size: 14px; color: #FBF8EF; font-weight: 600; }
.gift-foot-price { font-size: 14px; color: #B98A3E; font-weight: 800; }
.gift-foot-empty { font-size: 13px; color: rgba(255, 255, 255, 0.35); }
.gift-send-btn {
  background: linear-gradient(135deg, #B98A3E, #8C5E24);
  border: none; border-radius: 12px;
  color: #FBF8EF; font-size: 14px; font-weight: 700;
  padding: 10px 30px;
  cursor: pointer;
}
.gift-send-btn:disabled { opacity: 0.4; cursor: not-allowed; }

/* 礼物全屏动画 */
.gift-anim {
  position: fixed; inset: 0; z-index: 10000;
  display: flex; flex-direction: column; align-items: center; justify-content: center;
  background: radial-gradient(circle, rgba(251, 191, 36, 0.18), rgba(2, 6, 23, 0.35) 70%);
  pointer-events: none;
  animation: gift-anim-fade 3.2s ease forwards;
}
.gift-anim-icon {
  font-size: 96px;
  width: 160px; height: 160px;
  display: flex; align-items: center; justify-content: center;
  border-radius: 36px;
  box-shadow: inset 0 -12px 24px rgba(255,255,255,0.22), inset 0 4px 8px rgba(255,255,255,0.4), 0 16px 48px rgba(251, 191, 36, 0.45);
  text-shadow: 0 4px 12px rgba(0,0,0,0.3);
  animation: gift-anim-pop 0.6s cubic-bezier(0.34, 1.56, 0.64, 1) both;
  filter: drop-shadow(0 12px 32px rgba(251, 191, 36, 0.5));
}
.gift-anim-name {
  margin-top: 12px;
  font-size: 26px; font-weight: 800; color: #FBF8EF;
  text-shadow: 0 2px 12px rgba(0, 0, 0, 0.6);
}
.gift-anim-from {
  margin-top: 6px;
  font-size: 15px; color: rgba(255, 255, 255, 0.85);
}
@keyframes gift-anim-pop {
  0% { transform: scale(0.2); opacity: 0; }
  60% { transform: scale(1.15); opacity: 1; }
  100% { transform: scale(1); opacity: 1; }
}
@keyframes gift-anim-fade {
  0% { opacity: 1; }
  72% { opacity: 1; }
  100% { opacity: 0; visibility: hidden; }
}
.msg-input {
  flex: 1;
  background: var(--color-bg-elevated, #FBF8EF);
  border: 1px solid var(--color-border-primary, #A8CDD8);
  border-radius: 12px;
  color: var(--color-text-primary, #33302A);
  padding: 10px 14px;
  font-size: 14px;
  resize: none;
  outline: none;
  transition: border-color 0.2s;
}
.msg-input:focus { border-color: rgba(59, 130, 246, 0.6); }

/* 右栏 */
.tea-panel {
  border-left: 1px solid var(--color-border-primary, #A8CDD8);
  background: rgba(246, 241, 227, 0.88);
  display: flex; flex-direction: column;
  min-height: 0;
}
.panel-tabs {
  display: flex; gap: 4px;
  padding: 10px 12px;
  border-bottom: 1px solid var(--color-border-primary, #A8CDD8);
}
.panel-tab {
  flex: 1;
  background: transparent; border: 1px solid transparent;
  border-radius: 8px; padding: 6px 0;
  color: var(--color-text-muted, #6F6A5C);
  font-size: 13px; font-weight: 600; cursor: pointer;
  transition: all 0.2s;
}
.panel-tab.active {
  background: rgba(95, 168, 190, 0.18);
  border-color: rgba(38, 84, 124, 0.35);
  color: var(--color-text-primary, #33302A);
}
.panel-body { flex: 1; overflow-y: auto; padding: 12px; }
.panel-section-title {
  font-size: 12px; color: var(--color-text-muted, #6F6A5C);
  padding: 8px 4px 6px; font-weight: 600;
}
.panel-empty { font-size: 12px; color: var(--color-text-disabled, #A39D8E); padding: 8px 4px; }

.member-item {
  display: flex; align-items: center; gap: 10px;
  padding: 8px 10px;
  border-radius: 10px;
}
.member-item.clickable { cursor: pointer; transition: background 0.2s; }
.member-item.clickable:hover { background: var(--color-bg-hover, #EDE5CE); }
.member-item.active { background: rgba(95, 168, 190, 0.18); }
.member-avatar {
  width: 34px; height: 34px; border-radius: 50%;
  background: linear-gradient(135deg, #26547C, #5FA8BE);
  display: flex; align-items: center; justify-content: center;
  font-size: 15px; font-weight: 700; color: #FBF8EF; flex-shrink: 0;
}
.member-meta { display: flex; flex-direction: column; gap: 1px; min-width: 0; }
.member-name { font-size: 13px; font-weight: 600; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.member-sub { font-size: 11px; color: var(--color-text-muted, #6F6A5C); }
.bot-badge { font-size: 11px; }
.mini-dot { width: 6px; height: 6px; border-radius: 50%; background: #A39D8E; display: inline-block; margin-right: 4px; }
.mini-dot.on { background: #3E7F99; box-shadow: 0 0 6px rgba(62, 127, 153, 0.7); }

/* ══ 好友独立下拉框：fixed 悬浮层，列表在框内滚动，聊天页面零影响 ══ */
.friend-panel {
  position: fixed;
  z-index: 9998;
  top: 64px;
  right: 12px;
  width: 300px;
  max-height: calc(100vh - 84px);
  display: flex;
  flex-direction: column;
  background: var(--color-bg-panel, #141a2e);
  border: 1px solid var(--color-border, #26304d);
  border-radius: 14px;
  box-shadow: 0 16px 44px rgba(0, 0, 0, 0.55);
  overflow: hidden;
  animation: panel-pop 0.18s ease-out;
}
@keyframes panel-pop {
  from { opacity: 0; transform: translateY(-8px) scale(0.98); }
  to { opacity: 1; transform: none; }
}
.friend-panel-head {
  display: flex; align-items: center; justify-content: space-between;
  padding: 12px 14px 8px;
  gap: 8px;
}
.friend-panel-tabs {
  display: flex; gap: 4px; flex-wrap: wrap;
}
.friend-panel-tab {
  background: none; border: 1px solid transparent;
  color: var(--color-text-muted, #6F6A5C);
  font-size: 12px; font-weight: 600;
  padding: 4px 10px; border-radius: 20px;
  cursor: pointer; transition: all 0.15s;
}
.friend-panel-tab.active {
  color: #FBF8EF;
  background: rgba(59, 130, 246, 0.18);
  border-color: rgba(59, 130, 246, 0.35);
}
/* 列表项右侧操作（关注/发消息） */
.member-actions {
  display: flex; align-items: center; gap: 4px; margin-left: auto; flex-shrink: 0;
}
.mini-act-btn {
  width: 26px; height: 26px; border-radius: 8px;
  border: 0; background: rgba(255, 255, 255, 0.06);
  font-size: 13px; cursor: pointer; transition: all 0.15s;
}
.mini-act-btn:hover { background: rgba(59, 130, 246, 0.25); }
.mini-follow-btn {
  border: 0; font-size: 11px; font-weight: 600;
  padding: 4px 10px; border-radius: 20px; cursor: pointer;
  background: linear-gradient(135deg, #B98A3E, #B98A3E);
  color: #141a2e; transition: all 0.15s;
}
.mini-follow-btn:hover { filter: brightness(1.1); }
.mini-follow-btn.following {
  background: rgba(255, 255, 255, 0.08); color: rgba(255, 255, 255, 0.55);
}
.rel-badge {
  font-size: 10px; padding: 1px 6px; border-radius: 8px; margin-left: 4px;
  white-space: nowrap; vertical-align: 1px;
}
.rel-mutual { background: rgba(185, 138, 62, 0.18); color: #B98A3E; }
.rel-following { background: rgba(95, 168, 190, 0.18); color: #60a5fa; }
.rel-follower { background: rgba(16, 185, 129, 0.15); color: #34d399; }
/* 资料卡关注按钮 */
.profile-follow-btn {
  margin-top: 10px;
  border: 0; font-size: 12px; font-weight: 600;
  padding: 6px 16px; border-radius: 20px; cursor: pointer;
  background: linear-gradient(135deg, #B98A3E, #B98A3E); color: #141a2e;
  transition: all 0.15s;
}
.profile-follow-btn.following {
  background: rgba(255, 255, 255, 0.08); color: rgba(51, 48, 42, 0.6);
}

/* ══ 成员头像卡片（公共频道点成员弹出） ══ */
.member-card {
  position: fixed;
  z-index: 9999;
  width: 300px;
  background: var(--color-bg-panel, #141a2e);
  border: 1px solid var(--color-border, #26304d);
  border-radius: 14px;
  box-shadow: 0 16px 44px rgba(0, 0, 0, 0.55);
  padding: 14px;
  animation: panel-pop 0.18s ease-out;
}
.mc-head {
  display: flex; align-items: center; gap: 12px;
}
.mc-avatar {
  width: 52px; height: 52px; border-radius: 50%;
  background: linear-gradient(135deg, #26547C, #5FA8BE);
  display: flex; align-items: center; justify-content: center;
  font-size: 22px; font-weight: 700; color: #FBF8EF; flex-shrink: 0;
  box-shadow: 0 4px 14px rgba(59, 130, 246, 0.35);
}
.mc-meta {
  flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 4px;
}
.mc-name {
  font-size: 15px; font-weight: 700; color: var(--color-text, #e2e8f0);
  white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
}
.mc-sub {
  display: flex; align-items: center; gap: 6px;
  font-size: 12px; color: var(--color-text-muted, #6F6A5C);
}
.mc-platform {
  font-size: 10px; padding: 1px 6px; border-radius: 8px;
  background: rgba(255, 255, 255, 0.06); color: rgba(51, 48, 42, 0.45);
}
.mc-close {
  width: 24px; height: 24px; border-radius: 50%;
  border: 0; background: transparent;
  color: var(--color-text-muted, #6F6A5C);
  font-size: 13px; line-height: 1; cursor: pointer;
  transition: all 0.2s; flex-shrink: 0;
}
.mc-close:hover { background: rgba(239, 68, 68, 0.15); color: #f87171; }
.mc-body {
  display: flex; gap: 8px; margin-top: 12px;
  padding-top: 12px; border-top: 1px solid var(--color-border-primary, #A8CDD8);
}
.mc-follow-btn, .mc-msg-btn {
  flex: 1;
  border: 0; font-size: 12px; font-weight: 600;
  padding: 8px 0; border-radius: 20px; cursor: pointer;
  transition: all 0.15s;
}
.mc-follow-btn {
  background: linear-gradient(135deg, #B98A3E, #B98A3E); color: #141a2e;
}
.mc-follow-btn.following {
  background: rgba(255, 255, 255, 0.08); color: rgba(51, 48, 42, 0.6);
}
.mc-follow-btn:disabled { opacity: 0.5; pointer-events: none; }
.mc-msg-btn {
  background: rgba(59, 130, 246, 0.18); color: #60a5fa;
  border: 1px solid rgba(38, 84, 124, 0.35);
}
.mc-msg-btn:hover { background: rgba(38, 84, 124, 0.35); }
.status-dot { width: 8px; height: 8px; border-radius: 50%; background: #A39D8E; display: inline-block; }
.status-dot.on { background: #3E7F99; box-shadow: 0 0 6px rgba(62, 127, 153, 0.7); }

/* ══ 表情面板 + 媒体消息（EMOJI-MEDIA-01） ══ */
.hidden-file-input { display: none; }
.emoji-panel {
  position: fixed;
  z-index: 9999;
  bottom: 96px;
  left: 50%;
  transform: translateX(-50%);
  width: 372px;
  max-width: calc(100vw - 32px);
  background: var(--color-bg-panel, #141a2e);
  border: 1px solid var(--color-border, #26304d);
  border-radius: 14px;
  box-shadow: 0 16px 44px rgba(0, 0, 0, 0.55);
  padding: 10px;
  animation: panel-pop 0.18s ease-out;
}
.emoji-panel-grid {
  display: grid;
  grid-template-columns: repeat(8, 1fr);
  gap: 2px;
  max-height: 240px;
  overflow-y: auto;
}
.emoji-cell {
  background: transparent;
  border: 0;
  font-size: 22px;
  line-height: 1.4;
  padding: 4px 0;
  border-radius: 8px;
  cursor: pointer;
  transition: background 0.12s;
}
.emoji-cell:hover { background: rgba(255, 255, 255, 0.08); }

/* ══ ➕ 更多功能面板（微信风格，IM-CHA-M10.1） ══ */
.plus-panel {
  position: fixed;
  z-index: 9999;
  bottom: 92px;
  left: 50%;
  transform: translateX(-50%);
  width: 372px;
  max-width: calc(100vw - 32px);
  background: var(--color-bg-panel, #141a2e);
  border: 1px solid var(--color-border, #26304d);
  border-radius: 14px;
  box-shadow: 0 16px 44px rgba(0, 0, 0, 0.55);
  padding: 14px 10px 10px;
  animation: panel-pop 0.18s ease-out;
}
.plus-panel-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 8px 4px;
}
.plus-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 5px;
  background: rgba(255, 255, 255, 0.05);
  border: 1px solid transparent;
  border-radius: 12px;
  padding: 10px 4px 8px;
  cursor: pointer;
  transition: background 0.12s, transform 0.12s;
}
.plus-item:hover { background: rgba(255, 255, 255, 0.12); transform: translateY(-1px); }
.plus-item:active { transform: scale(0.96); }
.plus-item span {
  font-size: 11px;
  color: var(--color-text-muted, #A39D8E);
  line-height: 1;
}
.plus-item--active {
  background: rgba(59, 130, 246, 0.22);
  border-color: rgba(59, 130, 246, 0.5);
}
.plus-btn--active {
  background: rgba(59, 130, 246, 0.25) !important;
  border-color: rgba(59, 130, 246, 0.55) !important;
  color: #fff !important;
  transform: scale(1.05);
}
.plus-btn { font-size: 24px; font-weight: 700; line-height: 1; }
.emoji-btn { font-size: 20px; }
.kb-btn { font-size: 18px; }
.voice-hold-wrap { flex: 1; min-width: 0; display: flex; }
.voice-hold-btn {
  flex: 1;
  height: 42px;
  background: var(--color-bg-elevated, #FBF8EF);
  border: 1px solid var(--color-border-primary, #A8CDD8);
  border-radius: 12px;
  color: var(--color-text-primary, #33302A);
  font-size: 14px;
  font-weight: 600;
  letter-spacing: 2px;
  cursor: pointer;
  user-select: none;
  -webkit-user-select: none;
  touch-action: none;
  transition: background 0.15s;
}
.voice-hold-btn:active { background: rgba(59, 130, 246, 0.15); }
.voice-hold-btn--recording {
  background: rgba(176, 58, 46, 0.92) !important;
  color: #fff !important;
  animation: voice-pulse 1s ease-in-out infinite;
}

.msg-img {
  max-width: 260px;
  max-height: 300px;
  border-radius: 10px;
  display: block;
  cursor: zoom-in;
  border: 1px solid rgba(255, 255, 255, 0.08);
}
.msg-file {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 14px;
  border-radius: 10px;
  background: rgba(255, 255, 255, 0.06);
  border: 1px solid rgba(255, 255, 255, 0.08);
  text-decoration: none;
  color: var(--color-text, #e2e8f0);
  max-width: 260px;
  transition: background 0.15s;
}
.msg-file:hover { background: rgba(255, 255, 255, 0.12); }
.msg-file-icon { font-size: 24px; }
.msg-file-main { display: flex; flex-direction: column; gap: 2px; min-width: 0; }
.msg-file-name {
  font-size: 13px;
  font-weight: 600;
  color: #60a5fa;
  white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
}
.msg-file-size { font-size: 11px; color: var(--color-text-muted, #6F6A5C); }
.msg-video {
  max-width: 280px;
  max-height: 300px;
  border-radius: 10px;
  display: block;
}
/* IM-CHA-M10：撤回 / 翻译 / 转写 / TTL / 语音 */
.msg-actions {
  display: inline-flex;
  gap: 6px;
  margin-left: 8px;
  opacity: 0;
  transition: opacity 0.12s;
}
.msg-row:hover .msg-actions { opacity: 1; }
.msg-act {
  background: rgba(255, 255, 255, 0.08);
  border: 1px solid rgba(255, 255, 255, 0.12);
  color: var(--color-text-muted, #b8b2a4);
  border-radius: 6px;
  font-size: 11px;
  padding: 2px 8px;
  cursor: pointer;
}
.msg-act:hover { background: rgba(255, 255, 255, 0.16); color: #fff; }
.msg-recalled {
  display: inline-block;
  font-size: 12px;
  color: var(--color-text-muted, #8a8478);
  font-style: italic;
  padding: 2px 0;
}
.msg-ttl {
  display: block;
  font-size: 10px;
  color: #d9a441;
  opacity: 0.8;
  margin-top: 2px;
}
.msg-translation {
  margin-top: 4px;
  padding: 6px 10px;
  border-left: 3px solid #5fa8be;
  background: rgba(95, 168, 190, 0.08);
  border-radius: 0 8px 8px 0;
  font-size: 12px;
  color: #1F1F1F;
  font-weight: 500;
  max-width: 320px;
}
.msg-transcript {
  margin-top: 4px;
  padding: 6px 10px;
  border-left: 3px solid #b03a2e;
  background: rgba(176, 58, 46, 0.08);
  border-radius: 0 8px 8px 0;
  font-size: 12px;
  color: #ecc9c2;
  max-width: 320px;
}
.msg-voice {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 8px 14px;
  border-radius: 18px;
  background: rgba(95, 168, 190, 0.18);
  border: 1px solid rgba(95, 168, 190, 0.35);
  cursor: pointer;
  user-select: none;
  -webkit-user-select: none;
  transition: background 0.12s;
}
.msg-voice:hover { background: rgba(95, 168, 190, 0.3); }
.msg-voice--mine { background: rgba(95, 168, 190, 0.3); }
.voice-play-icon {
  font-size: 13px;
  color: #7cc4d8;
  width: 18px;
  text-align: center;
}
.voice-dur-text {
  font-size: 12px;
  color: #cfe8ef;
}
.voice-btn--recording {
  background: rgba(176, 58, 46, 0.9) !important;
  color: #fff !important;
  animation: voice-pulse 1s ease-in-out infinite;
}
@keyframes voice-pulse {
  0%, 100% { transform: scale(1); }
  50% { transform: scale(1.12); }
}
.img-lightbox {
  position: fixed;
  inset: 0;
  z-index: 99999;
  background: rgba(0, 0, 0, 0.85);
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: zoom-out;
  animation: panel-pop 0.15s ease-out;
}
.img-lightbox img {
  max-width: 92vw;
  max-height: 92vh;
  border-radius: 8px;
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.6);
}
.friend-panel-title {
  font-size: 13px; font-weight: 700; color: var(--color-text, #e2e8f0);
  letter-spacing: 0.02em;
}
.friend-panel-close {
  width: 24px; height: 24px; border-radius: 50%;
  border: 0; background: transparent;
  color: var(--color-text-muted, #6F6A5C);
  font-size: 13px; line-height: 1; cursor: pointer;
  transition: all 0.2s;
}
.friend-panel-close:hover { background: rgba(239, 68, 68, 0.15); color: #f87171; }
.friend-panel-search {
  margin: 0 12px 8px;
  background: rgba(7, 11, 22, 0.6);
  border: 1px solid var(--color-border-primary, #A8CDD8);
  border-radius: 8px;
  padding: 7px 10px;
  color: var(--color-text-primary, #33302A);
  font-size: 13px;
  outline: none;
  transition: border-color 0.2s;
}
.friend-panel-search:focus { border-color: rgba(59, 130, 246, 0.6); }
/* 核心：列表固定区域 + 框内独立滚动（overscroll 不穿透到页面） */
.friend-panel-list {
  flex: 1;
  overflow-y: auto;
  overscroll-behavior: contain;
  padding: 0 8px 8px;
  min-height: 60px;
}
.friend-panel-foot {
  padding: 8px 12px;
  border-top: 1px solid var(--color-border-primary, #A8CDD8);
  font-size: 11px; color: var(--color-text-disabled, #A39D8E);
  text-align: center;
}

/* 好友悬浮下拉菜单：独立弹层（fixed），不撑页面 / 不触发整页滚动 */
.friend-menu {
  position: fixed;
  z-index: 9999;
  width: 190px;
  background: var(--color-bg-panel, #141a2e);
  border: 1px solid var(--color-border, #26304d);
  border-radius: 12px;
  box-shadow: 0 12px 32px rgba(0, 0, 0, 0.45);
  padding: 8px;
  animation: menu-pop 0.15s ease-out;
}
@keyframes menu-pop {
  from { opacity: 0; transform: translateY(-4px) scale(0.98); }
  to { opacity: 1; transform: none; }
}
.friend-menu-head {
  display: flex; gap: 9px; align-items: center;
  padding: 4px 8px 9px;
  border-bottom: 1px solid var(--color-border, #26304d);
  margin-bottom: 6px;
}
.friend-menu-avatar {
  width: 34px; height: 34px; border-radius: 50%;
  background: linear-gradient(135deg, #B98A3E, #b45309);
  color: #FBF8EF; display: flex; align-items: center; justify-content: center;
  font-size: 15px; font-weight: 700; flex-shrink: 0;
}
.friend-menu-meta { min-width: 0; }
.friend-menu-name { font-size: 13px; font-weight: 600; color: var(--color-text, #e2e8f0); }
.friend-menu-sub { font-size: 11px; color: var(--color-text-muted, #6F6A5C); margin-top: 2px; }
.friend-menu-item {
  display: flex; align-items: center; gap: 8px;
  width: 100%; text-align: left;
  padding: 8px 10px; border: 0; border-radius: 8px;
  background: transparent; color: var(--color-text, #e2e8f0);
  font-size: 13px; cursor: pointer;
}
.friend-menu-item:hover { background: rgba(95, 168, 190, 0.18); }

/* 私聊资料卡 */
.peer-card {
  display: flex; flex-direction: column; align-items: center; gap: 6px;
  padding: 28px 12px 20px;
}
.peer-avatar {
  width: 72px; height: 72px; border-radius: 50%;
  background: linear-gradient(135deg, #26547C, #5FA8BE);
  display: flex; align-items: center; justify-content: center;
  font-size: 30px; font-weight: 700; color: #FBF8EF;
  box-shadow: 0 8px 30px rgba(59, 130, 246, 0.35);
}
.peer-name { font-size: 16px; font-weight: 700; margin-top: 6px; }
.peer-sub { font-size: 12px; color: var(--color-text-muted, #6F6A5C); }
.peer-badge {
  display: flex; align-items: center; gap: 5px;
  font-size: 12px; color: #64748b;
  padding: 3px 10px; border-radius: 20px;
  border: 1px solid var(--color-border-primary, #A8CDD8);
  margin-top: 4px;
}
.peer-badge.online { color: #10b981; border-color: rgba(16, 185, 129, 0.4); }
.peer-badge.online .status-dot { background: #3E7F99; box-shadow: 0 0 8px rgba(62, 127, 153, 0.7); }

/* 按钮 */
.tea-btn {
  border: none; border-radius: 10px;
  padding: 9px 18px;
  font-size: 14px; font-weight: 600;
  cursor: pointer;
  transition: opacity 0.2s, transform 0.1s;
}
.tea-btn.primary {
  background: linear-gradient(135deg, #26547C, #5FA8BE);
  color: #FBF8EF;
  box-shadow: 0 4px 16px rgba(38, 84, 124, 0.35);
}
.tea-btn.primary:disabled { opacity: 0.4; cursor: not-allowed; }
.tea-btn.primary:not(:disabled):hover { transform: translateY(-1px); }
.tea-btn.ghost {
  background: transparent;
  border: 1px solid var(--color-border-primary, #A8CDD8);
  color: var(--color-text-secondary, #94a3b8);
  padding: 6px 12px; font-size: 12px;
}
.tea-btn.ghost:hover { color: #f87171; border-color: rgba(248, 113, 113, 0.4); }

/* 响应式：<1100px 右栏收成抽屉 */
@media (max-width: 1100px) {
  .tea-body { grid-template-columns: 250px minmax(0, 1fr); }
  .tea-panel {
    position: fixed; right: 0; top: 64px; bottom: 0; width: 280px;
    transform: translateX(105%);
    transition: transform 0.25s ease;
    z-index: 20;
    box-shadow: -12px 0 40px rgba(0, 0, 0, 0.4);
    border-left: 1px solid var(--color-border-primary, #A8CDD8);
  }
  .tea-panel.open { transform: translateX(0); }
  .member-toggle { display: inline-block; }
}
@media (max-width: 768px) {
  .tea-body { grid-template-columns: 1fr; }
  .tea-sidebar { display: none; }
  .tea-panel { top: 56px; width: 260px; }
}

.member-avatar img, .peer-avatar img, .mc-avatar img, .friend-menu-avatar img, .msg-avatar img, .rp-grab-avatar img {
  width: 100%; height: 100%; border-radius: 50%; object-fit: cover; display: block;
}

/* ══ 消息头像 + 布局（青花瓷圆形） ══ */
.msg-avatar {
  width: 38px; height: 38px; border-radius: 50%; flex-shrink: 0;
  background: linear-gradient(135deg, #26547C, #5FA8BE);
  display: flex; align-items: center; justify-content: center;
  font-size: 16px; font-weight: 700; color: #FBF8EF;
  box-shadow: 0 1px 4px rgba(38, 84, 124, 0.25);
  border: 1px solid rgba(255, 255, 255, 0.7);
  overflow: hidden;
}
.msg-avatar.bot { background: linear-gradient(135deg, #B98A3E, #8C5E24); }
.msg-main { flex: 1; min-width: 0; display: flex; flex-direction: column; }
.msg-row.mine { flex-direction: row-reverse; }
.msg-row.mine .msg-meta { flex-direction: row-reverse; }
.msg-row.mine .msg-main { align-items: flex-end; }
.msg-row.mine .msg-avatar { order: 1; }
.msg-row.mine .msg-bubble { background: linear-gradient(135deg, #26547C, #5FA8BE); color: #FBF8EF; border: none; }

/* ══ 红包卡片（消息内 · 微信式红信封 + 金「開」封口） ══ */
.rp-card {
  display: inline-flex;
  min-width: 240px; max-width: 300px;
  padding: 12px 14px 11px;
  border-radius: 10px;
  cursor: pointer;
  background: linear-gradient(150deg, #F0564A 0%, #E23A30 55%, #C62828 100%);
  border: 1px solid rgba(255, 235, 210, 0.28);
  box-shadow: 0 3px 12px rgba(140, 46, 36, 0.35), inset 0 1px 0 rgba(255, 255, 255, 0.22);
  transition: transform 0.15s, box-shadow 0.15s;
}
.rp-card:hover { transform: translateY(-1px); box-shadow: 0 5px 16px rgba(140, 46, 36, 0.45); }
.rp-card:active { transform: scale(0.985); }
.rp-card-inner { display: flex; flex-direction: column; align-items: center; gap: 5px; width: 100%; }
/* 上：祝福语（半透明白，微信风格） */
.rp-card-note {
  font-size: 13px; font-weight: 500;
  color: rgba(255, 245, 235, 0.92);
  letter-spacing: 1px;
  white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
  max-width: 100%;
}
/* 中：金色開 */
.rp-card-mid { display: flex; align-items: center; justify-content: center; }
.rp-open {
  width: 46px; height: 46px;
  border-radius: 50%;
  display: flex; align-items: center; justify-content: center;
  background: radial-gradient(circle at 32% 28%, #FFF3C4, #FFD34D 55%, #F5B90F 100%);
  box-shadow: 0 2px 6px rgba(120, 40, 20, 0.45), inset 0 1px 0 rgba(255, 255, 255, 0.75);
  color: #B03A2E;
  font-size: 26px; font-weight: 800;
  line-height: 1;
  text-shadow: 0 1px 0 rgba(255, 255, 255, 0.5);
}
/* 下：状态（金色） */
.rp-card-status { font-size: 12px; color: #FFE9B8; font-weight: 600; letter-spacing: 1px; }
.rp-card-status.is-mine { color: #FFD9A0; }
/* 已领完 / 已过期：卡片变灰，開变淡 */
.rp-card.is-done { background: linear-gradient(150deg, #C9BCAE, #B5A89A); border-color: rgba(120, 110, 100, 0.3); box-shadow: 0 2px 8px rgba(100, 90, 80, 0.25); }
.rp-card.is-done .rp-open { background: radial-gradient(circle at 32% 28%, #EDE6DA, #D8CFC0); box-shadow: 0 1px 4px rgba(100, 90, 80, 0.3); color: #9A8E80; }
.rp-card.is-done .rp-card-status { color: #F5EFE6; }
.rp-card.is-done .rp-card-note { color: rgba(255, 250, 242, 0.85); }
.rp-grab-inline { font-size: 12px; color: #6F6A5C; }
.rp-grabbed-notice { display: inline-block; background: rgba(0, 0, 0, 0.04); border-radius: 4px; padding: 2px 8px; }
.rp-grab-amt-inline { color: #B03A2E; font-weight: 700; }

/* ══ 抢红包弹窗（大红包一体式） ══ */
.rp-btn { }
.rp-body { padding: 14px 18px 6px; display: flex; flex-direction: column; gap: 14px; }
.rp-mode-row { display: flex; gap: 10px; }
.rp-mode-btn {
  flex: 1; display: flex; flex-direction: column; align-items: center; gap: 3px;
  padding: 10px; border-radius: 10px; cursor: pointer;
  background: #F6F1E3; border: 1px solid #A8CDD8; color: #33302A; font-size: 14px; font-weight: 600;
  transition: all 0.15s;
}
.rp-mode-btn small { font-size: 11px; font-weight: 400; color: #6F6A5C; }
.rp-mode-btn.is-on { background: linear-gradient(135deg, #26547C, #5FA8BE); border-color: #26547C; color: #FBF8EF; }
.rp-mode-btn.is-on small { color: rgba(251, 248, 239, 0.8); }
.rp-mode-icon { font-size: 20px; }
.rp-field { display: flex; flex-direction: column; gap: 6px; }
.rp-field label { font-size: 12px; color: #6F6A5C; font-weight: 600; }
.rp-amount-row { display: flex; gap: 8px; align-items: center; }
.rp-amount-box {
  display: flex; align-items: center; gap: 6px; flex: 1;
  background: #F6F1E3; border: 1px solid #A8CDD8; border-radius: 8px; padding: 8px 10px;
}
.rp-amount-input {
  flex: 1; min-width: 0; background: transparent; border: none; outline: none;
  font-size: 20px; font-weight: 700; color: #26547C;
}
.rp-amount-unit { font-size: 12px; color: #6F6A5C; white-space: nowrap; }
.rp-quick { display: flex; gap: 6px; }
.rp-quick-btn {
  padding: 6px 10px; border-radius: 999px; cursor: pointer; font-size: 12px; font-weight: 600;
  background: #DCEBEE; border: 1px solid #A8CDD8; color: #26547C;
}
.rp-quick-btn:hover { background: #A8CDD8; }
.rp-note-input {
  width: 100%; padding: 9px 10px; border-radius: 8px; font-size: 14px;
  background: #F6F1E3; border: 1px solid #A8CDD8; color: #33302A; outline: none;
}
.rp-total-hint { text-align: center; font-size: 13px; color: #6F6A5C; padding-bottom: 4px; }
.rp-total-num { color: #B03A2E; font-size: 16px; }
.rp-warn { color: #B03A2E; font-size: 12px; font-weight: 600; }
.rp-send-btn { background: linear-gradient(135deg, #B03A2E, #8C2E24) !important; }

.rp-detail-modal { max-width: 340px; }
.rp-detail-top {
  position: relative; text-align: center; padding: 22px 18px 16px;
  background:
    radial-gradient(circle at 50% 10%, rgba(255, 210, 140, 0.35), transparent 55%),
    linear-gradient(160deg, #E2574C 0%, #C93A2E 60%, #A92C22 100%);
  color: #FBF8EF; border-radius: 12px 12px 0 0; margin: -18px -18px 0;
  border-bottom: 2px solid rgba(255, 210, 140, 0.55);
  overflow: hidden;
}
.rp-big-envelope {
  width: 108px; height: 132px; margin: 0 auto; border-radius: 8px; position: relative;
  background: linear-gradient(160deg, #E2574C, #A92C22);
  box-shadow: inset 0 0 0 2px rgba(255, 205, 160, 0.6), 0 6px 18px rgba(0, 0, 0, 0.3);
  display: flex; align-items: center; justify-content: center;
  cursor: pointer; transition: transform 0.15s;
}
.rp-big-envelope:hover { transform: scale(1.04); }
.rp-big-envelope.is-opened { box-shadow: inset 0 0 0 2px rgba(255, 205, 160, 0.6), 0 6px 18px rgba(0, 0, 0, 0.3), 0 0 24px rgba(255, 210, 140, 0.4); }
.rp-big-envelope::before {
  content: ''; position: absolute; top: 0; left: 0; right: 0; height: 16px;
  background: linear-gradient(180deg, rgba(255, 225, 180, 0.85), rgba(255, 225, 180, 0));
  border-radius: 8px 8px 0 0;
}
.rp-big-envelope::after {
  content: ''; position: absolute; bottom: 8px; left: 12%; right: 12%; height: 2px;
  background: linear-gradient(90deg, transparent, rgba(255, 210, 140, 0.8), transparent);
}
.rp-big-open {
  width: 52px; height: 52px; border-radius: 50%;
  background: radial-gradient(circle at 35% 30%, #FFE3A3, #D9A441 70%);
  color: #8C2E24; font-size: 26px; font-weight: 800;
  display: flex; align-items: center; justify-content: center;
  font-family: 'KaiTi', 'STKaiti', serif;
  box-shadow: 0 2px 6px rgba(0, 0, 0, 0.35), inset 0 2px 3px rgba(255, 255, 255, 0.7);
  animation: rpBreath 1.6s ease-in-out infinite;
}
@keyframes rpBreath {
  0%, 100% { transform: scale(1); }
  50% { transform: scale(1.06); }
}
.rp-big-amount { font-size: 42px; font-weight: 800; color: #FFE3A3; text-shadow: 0 2px 8px rgba(0, 0, 0, 0.35); }
.rp-big-amount small { font-size: 14px; font-weight: 400; letter-spacing: 2px; margin-left: 4px; }
.rp-big-msg { font-size: 14px; color: rgba(251, 248, 239, 0.92); }
.rp-detail-note { font-size: 15px; font-weight: 700; margin-top: 10px; color: #FBF8EF; text-shadow: 0 1px 3px rgba(0, 0, 0, 0.25); }
.rp-detail-from { font-size: 12px; opacity: 0.85; margin-top: 3px; }
.rp-detail-remain {
  display: inline-block; margin-top: 10px; font-size: 11px;
  padding: 3px 12px; border-radius: 999px;
  background: rgba(0, 0, 0, 0.18); color: rgba(255, 240, 220, 0.95);
}
.rp-detail-grabs { max-height: 150px; overflow-y: auto; padding: 4px 18px 8px; border-top: 1px dashed #A8CDD8; margin: 0 8px; }
.rp-grabs-title { font-size: 11px; color: #6F6A5C; font-weight: 600; padding: 8px 0 4px; }
.rp-grabs-empty { font-size: 12px; color: #A39D8E; padding: 6px 0; }
.rp-grab-item { display: flex; align-items: center; gap: 8px; padding: 4px 0; font-size: 12px; }
.rp-grab-avatar { width: 24px; height: 24px; font-size: 11px; }
.rp-grab-name { flex: 1; color: #33302A; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.rp-mine-tag {
  display: inline-block; margin-left: 4px; padding: 0 5px; border-radius: 4px;
  background: #DCEBEE; color: #26547C; font-size: 10px;
}
.rp-grab-amt { color: #B03A2E; font-weight: 700; }
.rp-detail-foot { border-top: 1px solid #EDE5CE; }

/* ══ 红包全屏开启动画 ══ */
.rp-anim {
  position: fixed; inset: 0; z-index: 9998;
  display: flex; flex-direction: column; align-items: center; justify-content: center;
  background: radial-gradient(circle at 50% 42%, rgba(140, 46, 36, 0.88), rgba(51, 48, 42, 0.82));
  animation: rpAnimIn 0.25s ease;
  color: #FBF8EF;
}
@keyframes rpAnimIn { from { opacity: 0; } to { opacity: 1; } }
.rp-anim-envelope { font-size: 88px; animation: rpPop 0.6s ease; filter: drop-shadow(0 6px 16px rgba(0,0,0,0.4)); }
@keyframes rpPop {
  0% { transform: scale(0.2) rotate(-20deg); opacity: 0; }
  60% { transform: scale(1.15) rotate(6deg); }
  100% { transform: scale(1) rotate(0); opacity: 1; }
}
.rp-anim-amount { font-size: 64px; font-weight: 800; margin-top: 10px; color: #FFD98A; text-shadow: 0 3px 12px rgba(0,0,0,0.4); animation: rpPop 0.5s 0.15s ease backwards; }
.rp-anim-unit { font-size: 16px; opacity: 0.9; letter-spacing: 4px; margin-top: 2px; }
.rp-anim-note { font-size: 14px; opacity: 0.85; margin-top: 16px; font-family: 'KaiTi', 'STKaiti', serif; letter-spacing: 2px; }

/* ══ R11 语音/视频 1v1 ══ */
.rtc-call-btn { animation: rtc-pulse 2s infinite; }
@keyframes rtc-pulse { 0%,100% { box-shadow: 0 0 0 0 rgba(38, 84, 124, 0.25); } 50% { box-shadow: 0 0 0 5px rgba(38, 84, 124, 0); } }

.rtc-incoming-mask, .rtc-call-mask {
  position: fixed; inset: 0; z-index: 9999; display: flex; align-items: center; justify-content: center;
  background: rgba(15, 20, 25, 0.82); backdrop-filter: blur(8px);
}
.rtc-incoming-card {
  background: linear-gradient(160deg, #FBF8EF, #F3EBD8); border: 2px solid #26547C; border-radius: 20px;
  padding: 36px 48px; text-align: center; box-shadow: 0 18px 60px rgba(0,0,0,0.4); animation: rtc-pop 0.3s ease;
}
@keyframes rtc-pop { from { transform: scale(0.85); opacity: 0; } to { transform: scale(1); opacity: 1; } }
.rtc-incoming-avatar, .rtc-remote-avatar {
  width: 96px; height: 96px; margin: 0 auto 14px; border-radius: 50%; overflow: hidden;
  background: linear-gradient(135deg, #5FA8BE, #26547C); color: #FBF8EF; font-size: 40px;
  display: flex; align-items: center; justify-content: center; border: 3px solid #FBF8EF;
}
.rtc-incoming-avatar img, .rtc-remote-avatar img { width: 100%; height: 100%; object-fit: cover; }
.rtc-incoming-name { font-size: 22px; font-weight: 700; color: #26547C; }
.rtc-incoming-sub { margin: 8px 0 22px; color: #6b5f4f; font-size: 14px; }
.rtc-incoming-actions { display: flex; gap: 16px; justify-content: center; }
.rtc-btn {
  border: none; cursor: pointer; border-radius: 999px; padding: 12px 28px; font-size: 16px; font-weight: 700;
  color: #FBF8EF; transition: transform 0.15s, opacity 0.15s;
}
.rtc-btn:active { transform: scale(0.94); }
.rtc-btn-reject { background: #B03A2E; }
.rtc-btn-accept { background: #2E8B57; }

.rtc-call-stage {
  position: relative; width: min(92vw, 860px); height: min(82vh, 620px); border-radius: 18px; overflow: hidden;
  background: #0d1418; box-shadow: 0 20px 70px rgba(0,0,0,0.55);
}
.rtc-remote-video { position: absolute; inset: 0; width: 100%; height: 100%; object-fit: cover; background: #0d1418; }
.rtc-remote-avatar {
  position: absolute; inset: 0; margin: auto; width: 120px; height: 120px; font-size: 52px;
  animation: rtc-ring 1.6s infinite;
}
@keyframes rtc-ring {
  0% { box-shadow: 0 0 0 0 rgba(95, 168, 190, 0.55); }
  70% { box-shadow: 0 0 0 26px rgba(95, 168, 190, 0); }
  100% { box-shadow: 0 0 0 0 rgba(95, 168, 190, 0); }
}
.rtc-status-text {
  position: absolute; top: calc(100% + 12px); left: 50%; transform: translateX(-50%);
  color: #d8e6ea; font-size: 15px; white-space: nowrap; letter-spacing: 1px;
}
.rtc-remote-audio-video { position: absolute; width: 1px; height: 1px; opacity: 0; pointer-events: none; }
.rtc-local-video {
  position: absolute; right: 14px; bottom: 84px; width: 168px; aspect-ratio: 3/4; border-radius: 12px;
  object-fit: cover; border: 2px solid rgba(251, 248, 239, 0.6); box-shadow: 0 6px 24px rgba(0,0,0,0.5); background: #222;
}
.rtc-call-head {
  position: absolute; top: 14px; left: 0; right: 0; display: flex; flex-direction: column; align-items: center; gap: 4px;
  color: #FBF8EF; text-shadow: 0 2px 8px rgba(0,0,0,0.6); z-index: 2;
}
.rtc-call-peer { font-size: 19px; font-weight: 700; }
.rtc-call-dur { font-size: 13px; opacity: 0.85; font-variant-numeric: tabular-nums; }
.rtc-toast {
  position: absolute; top: 56px; left: 50%; transform: translateX(-50%); z-index: 3;
  background: rgba(176, 58, 46, 0.92); color: #FBF8EF; padding: 8px 18px; border-radius: 999px; font-size: 13px;
  white-space: nowrap; max-width: 80%; overflow: hidden; text-overflow: ellipsis;
}
.rtc-controls {
  position: absolute; bottom: 20px; left: 50%; transform: translateX(-50%); z-index: 2;
  display: flex; gap: 18px; align-items: center; padding: 12px 22px; border-radius: 999px;
  background: rgba(20, 28, 34, 0.75); backdrop-filter: blur(6px); border: 1px solid rgba(251, 248, 239, 0.15);
}
.rtc-ctl {
  width: 52px; height: 52px; border-radius: 50%; border: none; cursor: pointer; font-size: 22px;
  background: rgba(251, 248, 239, 0.14); color: #FBF8EF; transition: transform 0.15s, background 0.15s;
}
.rtc-ctl:hover { transform: scale(1.08); background: rgba(251, 248, 239, 0.26); }
.rtc-ctl.off { background: #B03A2E; }
.rtc-ctl-hangup { background: #B03A2E; }
.rtc-ctl-hangup:hover { background: #d14a3c; }

</style>

<!-- ══ v-html 渲染内容样式（非 scoped：scoped 选择器不匹配 v-html 生成的 DOM，IM-CHA-M10.2 修复红包/图片/文件/语音样式从未生效的 bug） ══ -->
<style>
/* ══ R10 群聊生态：创建群/群管理 ══ */
.side-add-btn {
  margin-left: auto; background: rgba(251, 191, 36, 0.16); color: #F7D488;
  border: 1px solid rgba(251, 191, 36, 0.35); border-radius: 6px; width: 20px; height: 20px;
  line-height: 1; font-size: 14px; cursor: pointer; padding: 0;
}
.side-add-btn:hover { background: rgba(251, 191, 36, 0.3); }
.role-badge { font-size: 11px; margin-left: 2px; }
.chat-head-action {
  margin-left: auto; background: rgba(251, 191, 36, 0.14); color: #F7D488;
  border: 1px solid rgba(251, 191, 36, 0.3); border-radius: 8px; padding: 5px 10px;
  font-size: 12px; cursor: pointer; white-space: nowrap;
}
.chat-head-action:hover { background: rgba(251, 191, 36, 0.26); }
.grp-form { display: flex; flex-direction: column; gap: 8px; }
.grp-label { font-size: 12px; color: #333; }
.grp-label em { color: #D32F2F; font-style: normal; }
.grp-input {
  width: 100%; box-sizing: border-box; background: #fff;
  border: 1px solid #B9B09E; border-radius: 8px; color: #141414;
  padding: 9px 11px; font-size: 13px; outline: none;
}
.grp-input:focus { border-color: #1e2b4f; box-shadow: 0 0 0 2px rgba(30, 43, 79, 0.15); }
.grp-input::placeholder { color: #9A9181; }
.grp-textarea { min-height: 64px; resize: vertical; }
.grp-tip { font-size: 11px; color: #6B6B6B; line-height: 1.5; }
.grp-error { font-size: 12px; color: #D32F2F; }
.grp-manager-modal { max-width: 400px; width: calc(100vw - 40px); }
.grp-mgr-body { max-height: 62vh; overflow-y: auto; display: flex; flex-direction: column; gap: 8px; }
.grp-mgr-info { display: flex; flex-direction: column; gap: 6px; background: #F4EFE3; border-radius: 8px; padding: 10px; }
.grp-info-row { display: flex; gap: 8px; font-size: 13px; }
.grp-info-key { color: #6B6B6B; min-width: 48px; }
.grp-info-val { color: #141414; word-break: break-all; }
.grp-mgr-actions { display: flex; flex-wrap: wrap; gap: 8px; }
.grp-act {
  background: #fff; color: #1A1A1A; border: 1px solid #555;
  border-radius: 8px; padding: 6px 10px; font-size: 12px; cursor: pointer;
}
.grp-act:hover { background: #F4EFE3; border-color: #1e2b4f; color: #000; }
.grp-act-danger { background: #D32F2F; color: #fff; border-color: #D32F2F; }
.grp-act-danger:hover { background: #B71C1C; color: #fff; border-color: #B71C1C; }
.grp-mgr-foot { padding: 8px 0 0; }
.grp-mgr-toolbar { display: flex; align-items: center; justify-content: space-between; gap: 8px; }
.grp-mgr-count { font-size: 12px; color: #6B6B6B; }
.grp-member-row { display: flex; align-items: center; gap: 8px; padding: 6px 4px; border-radius: 8px; }
.grp-member-row:hover { background: #F4EFE3; }
.grp-member-meta { flex: 1; min-width: 0; }
.grp-member-ops { display: flex; gap: 4px; }
.grp-op {
  background: #F4EFE3; color: #333; border: 1px solid #B9B09E; border-radius: 6px;
  width: 26px; height: 26px; font-size: 13px; cursor: pointer; line-height: 1;
}
.grp-op:hover { background: #E8E0CE; border-color: #555; color: #000; }
.grp-op-ok { background: #2E7D32; color: #fff; border-color: #2E7D32; }
.grp-op-ok:hover { background: #1B5E20; color: #fff; }
.grp-op-no { background: #D32F2F; color: #fff; border-color: #D32F2F; }
.grp-op-no:hover { background: #B71C1C; color: #fff; }
.grp-invite-search { margin: 2px 0; }
.grp-invite-btn { font-size: 12px; padding: 4px 10px; }
.grp-invited { font-size: 12px; color: #2E7D32; font-weight: 600; }
.grp-mgr-empty { font-size: 12px; color: #8A8A8A; text-align: center; padding: 14px 0; }

/* ══ R10 群弹窗浅色化：白底黑字，图标与 UI 高反差（掌柜 2026-08-06 指令） ══ */
.grp-modal-mask { background: rgba(20, 16, 10, 0.55) !important; backdrop-filter: blur(4px); }
.grp-modal {
  background: #FFFDF6 !important;
  border: 1px solid rgba(0, 0, 0, 0.12) !important;
  box-shadow: 0 24px 64px rgba(0, 0, 0, 0.45) !important;
}
.grp-modal .gift-modal-title { color: #141414 !important; }
.grp-modal .gift-modal-close {
  background: #EFE9DC !important; color: #141414 !important;
  border-radius: 6px; line-height: 1; width: 26px; height: 26px;
}
.grp-modal .gift-modal-close:hover { background: #DCD3BF !important; color: #000 !important; }
.grp-modal .gift-modal-foot { border-top: 1px solid rgba(0, 0, 0, 0.1); }
.grp-modal .gift-modal-cancel {
  background: #fff; color: #333; border: 1px solid #8A8175; border-radius: 8px;
  padding: 7px 16px; font-size: 13px; cursor: pointer;
}
.grp-modal .gift-modal-cancel:hover { background: #F4EFE3; color: #000; }
.grp-modal .gift-modal-send {
  background: #1e2b4f; color: #fff; border: none; border-radius: 8px;
  padding: 7px 18px; font-size: 13px; font-weight: 700; cursor: pointer;
}
.grp-modal .gift-modal-send:hover { background: #2A3B6E; }
.grp-modal .gift-modal-send:disabled { opacity: 0.5; cursor: not-allowed; }
.grp-modal .member-name { color: #141414 !important; }
.grp-modal .member-sub { color: #6B6B6B !important; }
.grp-modal .bot-badge { color: #141414 !important; }
.grp-modal .grp-mgr-body::-webkit-scrollbar { width: 6px; }
.grp-modal .grp-mgr-body::-webkit-scrollbar-thumb { background: #C9C0AE; border-radius: 3px; }
/* 礼物 inline（v-html） */
.gift-inline {
  display: inline-flex; align-items: center; gap: 6px;
  background: linear-gradient(135deg, rgba(185, 138, 62, 0.18), rgba(185, 138, 62, 0.12));
  border: 1px solid rgba(251, 191, 36, 0.35);
  border-radius: 10px;
  padding: 4px 10px;
  font-size: 14px;
  color: #B98A3E;
}
.gift-inline-price { color: #FBF8EF; font-weight: 700; }

/* 图片（v-html） */
.msg-img {
  max-width: 260px;
  max-height: 300px;
  border-radius: 10px;
  display: block;
  cursor: zoom-in;
  border: 1px solid rgba(255, 255, 255, 0.08);
}

/* 视频（v-html）——微信风格：圆角缩略播放器 */
.msg-video {
  max-width: 280px;
  max-height: 320px;
  border-radius: 10px;
  display: block;
  background: #101418;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.35);
}

/* 文件（v-html） */
.msg-file {
  display: flex; align-items: center; gap: 10px;
  background: rgba(59, 130, 246, 0.1);
  border: 1px solid rgba(59, 130, 246, 0.28);
  border-radius: 10px;
  padding: 8px 12px;
  min-width: 200px; max-width: 280px;
  text-decoration: none;
  transition: background 0.15s;
}
.msg-file:hover { background: rgba(255, 255, 255, 0.12); }
.msg-file-icon { font-size: 24px; }
.msg-file-main { display: flex; flex-direction: column; gap: 2px; min-width: 0; }
.msg-file-name {
  font-size: 13px; font-weight: 600;
  color: var(--color-text-primary, #33302A);
  white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
  max-width: 220px;
}
.msg-file-size { font-size: 11px; color: var(--color-text-muted, #6F6A5C); }

/* 撤回占位（v-html） */
.msg-recalled {
  font-size: 12px; color: var(--color-text-disabled, #A39D8E);
  font-style: italic;
}

/* 媒体 TTL 提示（v-html） */
.msg-ttl { font-size: 10px; color: var(--color-text-disabled, #A39D8E); display: block; margin-top: 3px; }

/* 翻译 / 转写结果（v-html 外，但同属消息内容区）——IM-CHA-M10.4 掌柜指令：译文必须深黑色 */
.msg-translation {
  margin-top: 6px; font-size: 12px; color: #1F1F1F; font-weight: 500;
  background: rgba(185, 138, 62, 0.1); border-radius: 8px; padding: 4px 8px;
}
.msg-transcript {
  margin-top: 6px; font-size: 12px; color: #3E7F99;
  background: rgba(62, 127, 153, 0.1); border-radius: 8px; padding: 4px 8px;
}

/* 语音气泡（v-html） */
.msg-voice {
  display: inline-flex; align-items: center; gap: 8px;
  min-width: 84px; padding: 9px 14px;
  background: rgba(95, 168, 190, 0.18);
  border: 1px solid rgba(95, 168, 190, 0.4);
  border-radius: 18px;
  cursor: pointer;
  user-select: none;
  transition: background 0.15s;
}
.msg-voice:hover { background: rgba(95, 168, 190, 0.3); }
.msg-voice--mine { background: rgba(95, 168, 190, 0.3); }
.voice-play-icon {
  font-size: 13px;
  color: #7cc4d8;
  width: 18px;
  text-align: center;
}
.voice-dur-text {
  font-size: 12px;
  color: #cfe8ef;
}

/* ══ 微信风格红包卡片（v-html，IM-CHA-M10.2） ══ */
.rp-card {
  display: inline-flex;
  min-width: 240px; max-width: 300px;
  padding: 12px 14px 11px;
  border-radius: 10px;
  cursor: pointer;
  background: linear-gradient(150deg, #F0564A 0%, #E23A30 55%, #C62828 100%);
  border: 1px solid rgba(255, 235, 210, 0.28);
  box-shadow: 0 3px 12px rgba(140, 46, 36, 0.35), inset 0 1px 0 rgba(255, 255, 255, 0.22);
  transition: transform 0.15s, box-shadow 0.15s;
}
.rp-card:hover { transform: translateY(-1px); box-shadow: 0 5px 16px rgba(140, 46, 36, 0.45); }
.rp-card:active { transform: scale(0.985); }
.rp-card-inner { display: flex; flex-direction: column; align-items: center; gap: 5px; width: 100%; }
.rp-card-note {
  font-size: 13px; font-weight: 500;
  color: rgba(255, 245, 235, 0.92);
  letter-spacing: 1px;
  white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
  max-width: 100%;
}
.rp-card-mid { display: flex; align-items: center; justify-content: center; }
.rp-open {
  width: 46px; height: 46px;
  border-radius: 50%;
  display: flex; align-items: center; justify-content: center;
  background: radial-gradient(circle at 32% 28%, #FFF3C4, #FFD34D 55%, #F5B90F 100%);
  box-shadow: 0 2px 6px rgba(120, 40, 20, 0.45), inset 0 1px 0 rgba(255, 255, 255, 0.75);
  color: #B03A2E;
  font-size: 26px; font-weight: 800;
  line-height: 1;
  text-shadow: 0 1px 0 rgba(255, 255, 255, 0.5);
}
.rp-card-status { font-size: 12px; color: #FFE9B8; font-weight: 600; letter-spacing: 1px; }
.rp-card-status.is-mine { color: #FFD9A0; }
.rp-card.is-done {
  background: linear-gradient(150deg, #C9BCAE, #B5A89A);
  border-color: rgba(120, 110, 100, 0.3);
  box-shadow: 0 2px 8px rgba(100, 90, 80, 0.25);
}
.rp-card.is-done .rp-open {
  background: radial-gradient(circle at 32% 28%, #EDE6DA, #D8CFC0);
  box-shadow: 0 1px 4px rgba(100, 90, 80, 0.3);
  color: #9A8E80;
}
.rp-card.is-done .rp-card-status { color: #F5EFE6; }
.rp-card.is-done .rp-card-note { color: rgba(255, 250, 242, 0.85); }
.rp-grab-inline { font-size: 12px; color: #6F6A5C; }
.rp-grab-amt-inline { color: #B03A2E; font-weight: 700; }

/* ══ IM-CHA-M10.4 消息长按菜单 / 转发 / 收藏夹 ══ */
.msg-forwarded { display: block; font-size: 11px; color: #8A8478; margin-top: 3px; }
.msg-menu-mask { position: fixed; inset: 0; z-index: 9990; }
.msg-menu {
  position: fixed; z-index: 9991; background: #FFFDF7;
  border: 1px solid rgba(120, 110, 100, 0.18); border-radius: 10px;
  box-shadow: 0 6px 24px rgba(60, 50, 40, 0.16); padding: 6px; min-width: 128px;
}
.msg-menu-item {
  padding: 9px 14px; font-size: 14px; color: #3A352C; border-radius: 8px; cursor: pointer;
  display: flex; align-items: center; gap: 8px;
}
.msg-menu-item:hover { background: rgba(185, 138, 62, 0.12); color: #B03A2E; }
.fwd-mask {
  position: fixed; inset: 0; background: rgba(20, 16, 10, 0.45); z-index: 9992;
  display: flex; align-items: center; justify-content: center;
}
.fwd-modal {
  width: 380px; max-width: 92vw; max-height: 70vh; background: #FFFDF7; border-radius: 14px;
  box-shadow: 0 12px 40px rgba(40, 30, 20, 0.25); display: flex; flex-direction: column; overflow: hidden;
}
.fwd-head {
  display: flex; justify-content: space-between; align-items: center; padding: 14px 16px;
  font-weight: 700; color: #3A352C; border-bottom: 1px solid rgba(120, 110, 100, 0.12);
}
.fwd-close { background: none; border: none; font-size: 16px; cursor: pointer; color: #8A8478; }
.fwd-sub { padding: 8px 16px; font-size: 12px; color: #8A8478; border-bottom: 1px dashed rgba(120, 110, 100, 0.15); max-height: 60px; overflow: hidden; }
.fwd-list { overflow-y: auto; padding: 8px; }
.fwd-item {
  display: flex; align-items: center; gap: 10px; padding: 10px 12px; border-radius: 10px; cursor: pointer;
}
.fwd-item:hover { background: rgba(185, 138, 62, 0.1); }
.fwd-item-icon { font-size: 18px; }
.fwd-item-name { flex: 1; color: #3A352C; font-size: 14px; }
.fwd-item-tag { font-size: 11px; color: #8A8478; background: rgba(120, 110, 100, 0.1); padding: 2px 8px; border-radius: 10px; }
.fwd-empty { padding: 24px; text-align: center; color: #A39D8E; font-size: 13px; }
.fav-list { overflow-y: auto; padding: 8px; }
.fav-item {
  display: flex; align-items: center; gap: 8px; padding: 10px 12px; border-radius: 10px;
}
.fav-item:hover { background: rgba(185, 138, 62, 0.08); }
.fav-item-main { display: flex; align-items: center; gap: 10px; flex: 1; min-width: 0; cursor: pointer; }
.fav-item-icon { font-size: 18px; }
.fav-item-body { flex: 1; min-width: 0; }
.fav-item-text {
  font-size: 13px; color: #3A352C; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
}
.fav-item-meta { font-size: 11px; color: #A39D8E; margin-top: 2px; }
.fav-item-ops { display: flex; gap: 4px; }
.fav-op {
  background: rgba(120, 110, 100, 0.08); border: none; border-radius: 8px;
  padding: 5px 8px; cursor: pointer; font-size: 13px;
}
.fav-op:hover { background: rgba(185, 138, 62, 0.15); }
</style>