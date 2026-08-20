<template>
  <div class="mclan">
    <!-- 顶部 4-tab（对齐城市空间布局） -->
    <div class="mcl-tabs">
      <button v-for="t in tabs" :key="t.k" class="mcl-tab" :class="{ on: tab === t.k }" @click="switchTab(t.k)">{{ t.name }}</button>
    </div>

    <!-- 宗亲群选择 -->
    <div class="mcl-bar">
      <select v-model="gid" class="mcl-sel" @change="onGroupChange">
        <option value="" disabled>选择宗亲</option>
        <option v-for="g in groups" :key="g.id" :value="g.id">{{ g.name || g.id.slice(0, 8) }}{{ g.memberCount ? '（' + g.memberCount + '）' : '' }}</option>
      </select>
    </div>

    <!-- ① 群聊（宗亲群聊） -->
    <section v-if="tab === 'chat'">
      <button class="mcl-btn primary" @click="showCreate = true">＋ 申请开通群聊</button>
      <div class="mcl-sec">我的宗亲群（{{ groups.length }}）</div>
      <div v-if="!groups.length" class="mcl-empty">还没有宗亲群 · 点上方申请开通群聊，成为群主</div>
      <div v-for="g in groups" :key="'c' + g.id" class="mcl-row" @click="openClanChat(g)">
        <div class="mcl-avatar">🏮</div>
        <div class="mcl-main">
          <div class="mcl-name">{{ g.name || g.id.slice(0, 8) }}<span v-if="g.myRole === 2" class="mcl-owner">群主</span></div>
          <div class="mcl-sub">{{ g.memberCount || 0 }} 位宗亲</div>
        </div>
        <span class="mcl-arrow">›</span>
      </div>
    </section>

    <!-- 申请开通群聊弹窗 -->
    <div v-if="showCreate" class="mcl-mask">
      <div class="mcl-modal">
        <div class="mcl-modal-title">🏮 申请开通宗亲群聊</div>
        <p class="mcl-tip">提交申请后由后台管理员审核，通过后你即成为本群族长（群主），可邀请宗亲入群、发帖、补录源流。</p>
        <input v-model="createName" class="mcl-input" maxlength="30" placeholder="宗亲群名称（如：张氏宗亲）" />
        <button class="mcl-btn primary" :disabled="creating" @click="createClanGroup">{{ creating ? '开通中…' : '开通' }}</button>
        <button class="mcl-btn ghost" @click="showCreate = false" style="margin-top:8px">关闭</button>
      </div>
    </div>

    <!-- ② 社区（宗亲帖子） -->
    <section v-if="tab === 'post'">
      <button class="mcl-btn primary" :disabled="!gid" @click="openPostNew">📝 发帖子</button>
      <div v-if="!gid" class="mcl-empty">请先选择宗亲</div>
      <div v-for="p in posts" :key="'p' + p.id" class="mcl-post" @click="openPostDetail(p)">
        <div class="mcl-post-head">
          <span class="mcl-post-author">{{ p.nickname || p.uid }}</span>
          <span class="mcl-post-time">{{ fmtTs(p.createdAt) }}</span>
        </div>
        <div class="mcl-post-content mcl-clamp3">{{ p.content }}</div>
        <div class="mcl-post-foot" @click.stop>
          <button class="mcl-mini" @click="likePost(p)">👍 {{ p.likes || 0 }}</button>
          <button class="mcl-mini" @click="openComment(p)">💬 {{ p.comments || 0 }}</button>
          <span v-if="p.content && p.content.length > 80" class="mcl-more">查看全文 ›</span>
        </div>
      </div>
      <div v-if="gid && !posts.length" class="mcl-empty">该宗亲还没有帖子</div>
    </section>

    <!-- ③ 族谱（宗亲树） -->
    <section v-if="tab === 'tree'">
      <div class="mcl-sec">族谱 · 宗亲树</div>
      <div v-if="!gid" class="mcl-empty">请先选择宗亲</div>
      <div v-else-if="!treeNodes.length" class="mcl-empty">宗族树尚空 · 成员入谱点亮树叶</div>
      <div v-for="gen in treeGens" :key="'g' + gen" class="mcl-gen">
        <div class="mcl-gen-label">第{{ gen }}世</div>
        <div class="mcl-gen-leaves">
          <div v-for="n in genNodes(gen)" :key="n.uid" class="mcl-leaf" :class="{ lit: n.leafLit }">{{ n.name.slice(0, 2) }}</div>
        </div>
      </div>
      <button class="mcl-btn ghost" :disabled="!gid" @click="openGenForm">🍃 入谱/报辈分</button>
    </section>

    <!-- ④ 源流（宗祠文化馆） -->
    <section v-if="tab === 'origin'">
      <div class="mcl-sec">源流 · 宗祠文化馆</div>
      <div v-if="!gid" class="mcl-empty">请先选择宗亲</div>
      <div v-for="a in archives" :key="'a' + a.id" class="mcl-archive">
        <div class="mcl-archive-title" @click="toggleArchive(a.id)">{{ iconType(a.type) }}{{ a.title }}</div>
        <div v-if="openArch === a.id" class="mcl-archive-body">{{ a.content }}</div>
      </div>
      <div v-if="gid && !archives.length" class="mcl-empty">源流档案为空</div>
      <button class="mcl-btn ghost" :disabled="!gid" @click="openArchAdd">📜 补录源流</button>
    </section>

    <!-- 发帖弹窗 -->
    <div v-if="showPost" class="mcl-mask">
      <div class="mcl-modal">
        <div class="mcl-modal-title">📝 发帖子</div>
        <textarea v-model="postContent" class="mcl-input mcl-ta" placeholder="家族事、寻亲、族讯…"></textarea>
        <button class="mcl-btn primary" :disabled="posting" @click="submitPost">{{ posting ? '发布中…' : '发布' }}</button>
        <button class="mcl-btn ghost" @click="showPost = false" style="margin-top:8px">关闭</button>
      </div>
    </div>

    <!-- 帖子详情弹窗 -->
    <div v-if="postDetail" class="mcl-mask" @click.self="postDetail = null">
      <div class="mcl-modal mcl-scroll">
        <div class="mcl-modal-title">帖子</div>
        <div class="mcl-post-content">{{ postDetail.content }}</div>
        <div class="mcl-imgs" v-if="postDetail.images && postDetail.images.length">
          <img v-for="(im, ix) in postDetail.images" :key="ix" :src="absCover(im)" class="mcl-img" @error="hideImg" />
        </div>
        <div class="mcl-post-foot">
          <button class="mcl-mini" @click="likePost(postDetail)">👍 {{ postDetail.likes || 0 }}</button>
          <button class="mcl-mini" @click="openComment(postDetail)">💬 评论</button>
        </div>
        <button class="mcl-btn ghost" @click="postDetail = null" style="margin-top:8px">关闭</button>
      </div>
    </div>

    <!-- 评论弹窗 -->
    <div v-if="commentOn" class="mcl-mask">
      <div class="mcl-modal">
        <div class="mcl-modal-title">💬 评论</div>
        <div class="mcl-comments" v-if="commentOn.commentsArr && commentOn.commentsArr.length">
          <div v-for="(cm, i) in commentOn.commentsArr" :key="i" class="mcl-comment"><span class="mcl-comment-auth">{{ cm.nickname || cm.uid }}</span>：{{ cm.text || cm.content }}</div>
        </div>
        <textarea v-model="commentText" class="mcl-input mcl-ta" placeholder="写下评论…"></textarea>
        <div class="mcl-modal-btns">
          <button class="mcl-btn ghost" @click="commentOn = null">关闭</button>
          <button class="mcl-btn primary" :disabled="commenting" @click="submitComment">发送</button>
        </div>
      </div>
    </div>

    <!-- 入谱弹窗 -->
    <div v-if="showGen" class="mcl-mask">
      <div class="mcl-modal">
        <div class="mcl-modal-title">🍃 入谱 · 报辈分</div>
        <input v-model="genName" class="mcl-input" placeholder="姓名" />
        <input v-model.number="genValue" class="mcl-input" type="number" placeholder="辈分（世，如 20）" />
        <input v-model="genRole" class="mcl-input" placeholder="角色（选填，如 族长/副族长/普通宗亲）" />
        <button class="mcl-btn primary" :disabled="genSaving" @click="saveGen">{{ genSaving ? '保存中…' : '入谱' }}</button>
        <button class="mcl-btn ghost" @click="showGen = false" style="margin-top:8px">关闭</button>
      </div>
    </div>

    <!-- 补录源流弹窗 -->
    <div v-if="showArch" class="mcl-mask">
      <div class="mcl-modal">
        <div class="mcl-modal-title">📜 补录源流</div>
        <select v-model="archType" class="mcl-sel" style="margin-bottom:8px">
          <option value="surname_history">姓氏源流</option>
          <option value="clan_history">族史</option>
          <option value="county">郡望</option>
          <option value="hall">堂号</option>
        </select>
        <input v-model="archTitle" class="mcl-input" placeholder="标题" />
        <textarea v-model="archContent" class="mcl-input mcl-ta" placeholder="内容…"></textarea>
        <button class="mcl-btn primary" :disabled="archSaving" @click="submitArch">{{ archSaving ? '保存中…' : '补录' }}</button>
        <button class="mcl-btn ghost" @click="showArch = false" style="margin-top:8px">关闭</button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { mobileAuthFetch, mobileToast } from '~/composables/useMobileApi'

const emit = defineEmits<{ (e: 'open-group', g: any): void }>()

const tabs = [
  { k: 'chat', name: '群聊' },
  { k: 'post', name: '社区' },
  { k: 'tree', name: '族谱' },
  { k: 'origin', name: '源流' },
]
const tab = ref('chat')
const groups = ref<any[]>([])
const gid = ref('')

async function loadGroups() {
  try { const r = await mobileAuthFetch('/api/tea/family/groups'); const j = await r.json(); const d = j.data || j; groups.value = d.groups || []; if (!gid.value && groups.value.length) gid.value = groups.value[0].id } catch { groups.value = [] }
}
function switchTab(k: string) {
  tab.value = k
  if (k === 'post') loadPosts()
  if (k === 'tree') loadTree()
  if (k === 'origin') loadArchive()
}
function onGroupChange() { loadPosts(); loadTree(); loadArchive() }

// 群聊
const showCreate = ref(false)
const createName = ref('')
const creating = ref(false)
async function createClanGroup() {
  if (!createName.value.trim()) { mobileToast('请输入群名称'); return }
  creating.value = true
  try {
    // 提交开通申请，后台管理员审核通过后建群（申请人成为族长）
    const r = await mobileAuthFetch('/api/tea/family/group/apply', { method: 'POST', body: JSON.stringify({ groupName: createName.value.trim() }) })
    const j = await r.json()
    if (r.ok && j.success) { mobileToast('✅ 开通申请已提交，等待后台管理员审核'); showCreate.value = false; createName.value = '' }
    else mobileToast('❌ ' + (j.error || '申请失败'))
  } catch { mobileToast('⚠ 网络错误') } finally { creating.value = false }
}
function openClanChat(g: any) {
  // grp_<gid> 群聊频道
  emit('open-group', { id: 'grp_' + g.id, type: 4, name: g.name || '宗亲群', kind: 'group', groupId: g.id })
}

// 社区（帖子）
const posts = ref<any[]>([])
const showPost = ref(false)
const postContent = ref('')
const posting = ref(false)
const postDetail = ref<any>(null)
const commentOn = ref<any>(null)
const commentText = ref('')
const commenting = ref(false)
async function loadPosts() {
  if (!gid.value) return
  try { const r = await mobileAuthFetch('/api/tea/family/posts?groupId=' + gid.value); const j = await r.json(); const d = j.data || j; posts.value = d.posts || [] } catch { posts.value = [] }
}
function openPostNew() { showPost.value = true; postContent.value = '' }
async function submitPost() {
  if (!postContent.value.trim()) { mobileToast('请输入内容'); return }
  posting.value = true
  try {
    const r = await mobileAuthFetch('/api/tea/family/posts', { method: 'POST', body: JSON.stringify({ groupId: gid.value, content: postContent.value.trim() }) })
    const j = await r.json()
    if (r.ok && j.success) { mobileToast('✅ 已发布'); showPost.value = false; loadPosts() } else mobileToast('❌ ' + (j.error || '发布失败'))
  } catch { mobileToast('⚠ 网络错误') } finally { posting.value = false }
}
function openPostDetail(p: any) { postDetail.value = { ...p, images: p.images || [] } }
async function likePost(p: any) {
  try { const r = await mobileAuthFetch('/api/tea/family/posts/like', { method: 'POST', body: JSON.stringify({ postId: p.id }) }); const j = await r.json(); if (r.ok && j.success) { p.likes = j.data?.likes ?? p.likes + 1; mobileToast('👍') } else mobileToast('❌ ' + (j.error || '')) } catch { mobileToast('⚠ 网络错误') }
}
function openComment(p: any) { commentOn.value = { ...p, commentsArr: p.commentsArr || [] }; commentText.value = '' }
async function submitComment() {
  if (!commentText.value.trim() || !commentOn.value) return
  commenting.value = true
  try { const r = await mobileAuthFetch('/api/tea/family/posts/comment', { method: 'POST', body: JSON.stringify({ postId: commentOn.value.id, text: commentText.value.trim() }) }); const j = await r.json(); if (r.ok && j.success) { mobileToast('✅ 已评论'); commentOn.value = null; loadPosts() } else mobileToast('❌ ' + (j.error || '评论失败')) } catch { mobileToast('⚠ 网络错误') } finally { commenting.value = false }
}

// 族谱（宗亲树）
const treeNodes = ref<any[]>([])
const treeGens = computed(() => [...new Set(treeNodes.value.map((n) => Number(n.generation)))].sort((a, b) => b - a))
function genNodes(gen: number) { return treeNodes.value.filter((n) => Number(n.generation) === gen) }
const showGen = ref(false)
const genName = ref('')
const genValue = ref(1)
const genRole = ref('')
const genSaving = ref(false)
async function loadTree() {
  if (!gid.value) return
  try { const r = await mobileAuthFetch('/api/tea/family/tree?groupId=' + gid.value); const j = await r.json(); const d = j.data || j; treeNodes.value = d.nodes || [] } catch { treeNodes.value = [] }
}
function openGenForm() { showGen.value = true; genName.value = ''; genValue.value = 1; genRole.value = '' }
async function saveGen() {
  genSaving.value = true
  try { const r = await mobileAuthFetch('/api/tea/family/member/join', { method: 'POST', body: JSON.stringify({ groupId: gid.value, generation: genValue.value, name: genName.value, clanRole: genRole.value }) }); const j = await r.json(); if (r.ok && j.success) { mobileToast('🍃 已入谱'); showGen.value = false; loadTree() } else mobileToast('❌ ' + (j.error || '入谱失败')) } catch { mobileToast('⚠ 网络错误') } finally { genSaving.value = false }
}

// 源流（档案）
const archives = ref<any[]>([])
const openArch = ref('')
const showArch = ref(false)
const archType = ref('surname_history')
const archTitle = ref('')
const archContent = ref('')
const archSaving = ref(false)
async function loadArchive() {
  if (!gid.value) return
  try { const r = await mobileAuthFetch('/api/tea/family/archive?groupId=' + gid.value); const j = await r.json(); const d = j.data || j; archives.value = d.archives || [] } catch { archives.value = [] }
}
function toggleArchive(id: string) { openArch.value = openArch.value === id ? '' : id }
function iconType(t: string) { return t === 'surname_history' ? '📜 ' : t === 'county' ? '🏞 ' : t === 'hall' ? '🏯 ' : '📖 ' }
function openArchAdd() { showArch.value = true; archTitle.value = ''; archContent.value = '' }
async function submitArch() {
  if (!archTitle.value.trim()) { mobileToast('请输入标题'); return }
  archSaving.value = true
  try {
    const r = await mobileAuthFetch('/api/tea/family/archive/add', { method: 'POST', body: JSON.stringify({ groupId: gid.value, type: archType.value, title: archTitle.value, content: archContent.value }) })
    const j = await r.json()
    if (r.ok && j.success) { mobileToast('✅ 已补录'); showArch.value = false; loadArchive() } else mobileToast('❌ ' + (j.error || '补录失败'))
  } catch { mobileToast('⚠ 网络错误') } finally { archSaving.value = false }
}

function fmtTs(t: any) { const n = Number(t); const d = n > 10000000000 ? new Date(n) : new Date(n * 1000); return d.toISOString().slice(0, 10) }
function absCover(u: string) { if (!u) return ''; if (/^https?:\/\//i.test(u)) return u; return 'https://aigc.fushtn.com' + (u.startsWith('/') ? u : '/' + u) }
function hideImg(e: any) { try { e.target.style.display = 'none' } catch { } }

onMounted(() => { loadGroups().then(() => { loadPosts(); loadTree(); loadArchive() }) })
</script>

<style scoped>
.mcl-tabs { display: flex; background: #fff; border-radius: 10px; padding: 4px; margin-bottom: 10px; gap: 4px; }
.mcl-tab { flex: 1; padding: 8px 0; border: none; background: transparent; border-radius: 8px; font-size: 14px; font-weight: 600; color: #666; }
.mcl-tab.on { background: #a855f7; color: #fff; }
.mcl-bar { margin-bottom: 8px; }
.mcl-sel { width: 100%; padding: 10px; border: 1px solid #e5e7eb; border-radius: 10px; font-size: 14px; background: #fff; }
.mcl-sec { font-size: 13px; font-weight: 700; color: #374151; margin: 12px 0 8px; }
.mcl-empty { text-align: center; color: #9ca3af; font-size: 13px; padding: 24px 0; }
.mcl-row { display: flex; align-items: center; gap: 10px; background: #fff; border-radius: 10px; padding: 12px; margin-bottom: 8px; }
.mcl-avatar { width: 40px; height: 40px; border-radius: 8px; display: flex; align-items: center; justify-content: center; font-size: 20px; background: #faf5ff; flex-shrink: 0; }
.mcl-main { flex: 1; min-width: 0; }
.mcl-name { font-size: 15px; font-weight: 600; }
.mcl-owner { display: inline-block; margin-left: 6px; font-size: 11px; color: #a855f7; background: #faf5ff; padding: 1px 6px; border-radius: 6px; }
.mcl-tip { font-size: 12px; color: #6b7280; line-height: 1.6; margin-bottom: 10px; }
.mcl-sub { font-size: 12px; color: #6b7280; margin-top: 2px; }
.mcl-arrow { color: #c0c4cc; font-size: 18px; }
.mcl-btn { width: 100%; padding: 11px; border: none; border-radius: 10px; font-size: 14px; font-weight: 600; margin-top: 8px; }
.mcl-btn.primary { background: linear-gradient(135deg, #c084fc, #a855f7); color: #fff; }
.mcl-btn.ghost { background: #fff; color: #a855f7; border: 1px solid #ddd6fe; }
.mcl-mini { font-size: 12px; padding: 5px 10px; border-radius: 8px; border: none; background: #faf5ff; color: #a855f7; flex-shrink: 0; font-weight: 600; }
.mcl-post { background: #fff; border-radius: 10px; padding: 12px; margin-bottom: 10px; }
.mcl-post-head { display: flex; justify-content: space-between; font-size: 12px; color: #9ca3af; margin-bottom: 6px; }
.mcl-post-author { color: #a855f7; font-weight: 600; }
.mcl-post-content { font-size: 13px; line-height: 1.7; word-break: break-word; white-space: pre-wrap; }
.mcl-clamp3 { display: -webkit-box; -webkit-line-clamp: 3; -webkit-box-orient: vertical; overflow: hidden; }
.mcl-post-foot { display: flex; gap: 8px; margin-top: 8px; align-items: center; }
.mcl-more { margin-left: auto; font-size: 12px; color: #a855f7; }
.mcl-gen { margin-bottom: 12px; }
.mcl-gen-label { font-size: 13px; font-weight: 700; color: #a855f7; margin-bottom: 6px; }
.mcl-gen-leaves { display: flex; flex-wrap: wrap; gap: 8px; }
.mcl-leaf { width: 40px; height: 40px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 13px; font-weight: 600; background: #e5e7eb; color: #9ca3af; }
.mcl-leaf.lit { background: linear-gradient(135deg, #86efac, #22c55e); color: #fff; }
.mcl-archive { background: #fff; border-radius: 10px; padding: 12px; margin-bottom: 8px; }
.mcl-archive-title { font-size: 14px; font-weight: 600; }
.mcl-archive-body { font-size: 13px; color: #374151; line-height: 1.7; margin-top: 8px; white-space: pre-wrap; }
.mcl-mask { position: fixed; inset: 0; background: rgba(0,0,0,.45); z-index: 70; display: flex; align-items: center; justify-content: center; padding: 20px; }
.mcl-modal { background: #fff; border-radius: 14px; padding: 18px; width: 100%; max-width: 340px; }
.mcl-scroll { max-height: 82vh; overflow-y: auto; -webkit-overflow-scrolling: touch; }
.mcl-modal-title { font-size: 16px; font-weight: 700; margin-bottom: 8px; }
.mcl-input { width: 100%; padding: 10px; border: 1px solid #e5e7eb; border-radius: 10px; font-size: 14px; margin-bottom: 8px; box-sizing: border-box; }
.mcl-ta { min-height: 80px; resize: none; }
.mcl-modal-btns { display: flex; gap: 8px; }
.mcl-imgs { display: flex; flex-wrap: wrap; gap: 6px; margin: 8px 0; }
.mcl-img { width: 100px; height: 100px; object-fit: cover; border-radius: 8px; }
.mcl-comments { max-height: 150px; overflow-y: auto; margin-bottom: 8px; }
.mcl-comment { font-size: 13px; padding: 6px 0; border-bottom: 1px solid #f5f5f5; }
.mcl-comment-auth { color: #a855f7; font-weight: 600; }
</style>
