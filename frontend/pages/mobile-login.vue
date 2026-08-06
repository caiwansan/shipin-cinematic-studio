<template>
  <div class="ml-page">
    <!-- 品牌区 -->
    <div class="ml-brand">
      <div class="ml-logo">🏮</div>
      <div class="ml-name">昆仑镜</div>
      <div class="ml-slogan">AI 员工数字办公空间</div>
    </div>

    <!-- 登录卡片 -->
    <div class="ml-card">
      <!-- 登录方式切换 -->
      <div class="ml-tabs">
        <div class="ml-tab" :class="{ active: mode === 'account' }" @click="mode = 'account'">账号登录</div>
        <div class="ml-tab" :class="{ active: mode === 'phone' }" @click="mode = 'phone'">手机号登录</div>
      </div>

      <div class="ml-form">
        <div class="ml-field">
          <label>{{ mode === 'account' ? '邮箱' : '手机号' }}</label>
          <input
            v-model="account"
            class="ml-input"
            :type="mode === 'account' ? 'email' : 'tel'"
            :placeholder="mode === 'account' ? '请输入邮箱' : '请输入手机号'"
            autocomplete="username"
          />
        </div>

        <div class="ml-field">
          <label>密码</label>
          <div class="ml-pwd-wrap">
            <input
              v-model="password"
              class="ml-input ml-pwd"
              :type="showPwd ? 'text' : 'password'"
              placeholder="请输入密码"
              autocomplete="current-password"
              @keyup.enter="doLogin"
            />
            <span class="ml-eye" @click="showPwd = !showPwd">{{ showPwd ? '🙈' : '👁️' }}</span>
          </div>
        </div>

        <div class="ml-row">
          <label class="ml-remember">
            <input type="checkbox" v-model="remember" />
            <span>记住我</span>
          </label>
        </div>

        <div v-if="error" class="ml-error">{{ error }}</div>

        <button class="ml-btn" :disabled="loading" @click="doLogin">
          {{ loading ? '登录中…' : '登 录' }}
        </button>
      </div>
    </div>

    <div class="ml-footer">
      <span @click="goHome">← 返回手机版首页</span>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { useAuthStore } from '~/stores/auth'
import { safeRedirect } from '~/utils/mobile-detect'

definePageMeta({ middleware: 'auth' })

const auth = useAuthStore()
const route = useRoute()
const router = useRouter()

const mode = ref<'account' | 'phone'>('account')
const account = ref('')
const password = ref('')
const showPwd = ref(false)
const remember = ref(true)
const loading = ref(false)
const error = ref('')

async function doLogin() {
  const acc = account.value.trim()
  if (!acc) { error.value = '请输入' + (mode.value === 'account' ? '邮箱' : '手机号'); return }
  if (!password.value) { error.value = '请输入密码'; return }
  error.value = ''
  loading.value = true
  try {
    if (mode.value === 'account') {
      await auth.login(acc, password.value)
    } else {
      await auth.loginByPhone(acc, password.value)
    }
    const target = safeRedirect(route.query.redirect, '/mobile-app')
    await router.replace(target)
  } catch (e: any) {
    error.value = e?.message || '登录失败，请检查账号密码'
  } finally {
    loading.value = false
  }
}

function goHome() {
  router.replace('/mobile')
}
</script>

<style scoped>
.ml-page {
  min-height: 100vh;
  background: linear-gradient(160deg, #0b3d2e 0%, #14532d 35%, #166534 70%, #14532d 100%);
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 32px 24px calc(32px + env(safe-area-inset-bottom));
  box-sizing: border-box;
  font-family: -apple-system, BlinkMacSystemFont, 'PingFang SC', 'Helvetica Neue', sans-serif;
}
.ml-brand { text-align: center; margin-bottom: 36px; }
.ml-logo {
  width: 76px; height: 76px;
  margin: 0 auto 14px;
  border-radius: 22px;
  background: linear-gradient(135deg, #fbbf24, #f59e0b);
  display: flex; align-items: center; justify-content: center;
  font-size: 40px;
  box-shadow: 0 10px 30px rgba(0,0,0,0.35);
}
.ml-name { color: #fff; font-size: 26px; font-weight: 700; letter-spacing: 2px; }
.ml-slogan { color: rgba(255,255,255,0.72); font-size: 13px; margin-top: 6px; }

.ml-card {
  width: 100%;
  max-width: 420px;
  background: #fff;
  border-radius: 20px;
  padding: 26px 22px 30px;
  box-shadow: 0 16px 48px rgba(0,0,0,0.3);
  box-sizing: border-box;
}
.ml-tabs {
  display: flex;
  background: #f1f5f3;
  border-radius: 12px;
  padding: 4px;
  margin-bottom: 24px;
}
.ml-tab {
  flex: 1;
  text-align: center;
  padding: 10px 0;
  font-size: 15px;
  font-weight: 600;
  color: #64748b;
  border-radius: 9px;
  cursor: pointer;
  transition: all 0.2s;
}
.ml-tab.active { background: #fff; color: #166534; box-shadow: 0 2px 8px rgba(0,0,0,0.08); }

.ml-field { margin-bottom: 18px; }
.ml-field label { display: block; font-size: 13px; color: #475569; margin-bottom: 8px; font-weight: 500; }
.ml-input {
  width: 100%;
  height: 50px;
  border: 1.5px solid #e2e8f0;
  border-radius: 12px;
  padding: 0 14px;
  font-size: 16px;
  color: #0f172a;
  outline: none;
  background: #f8fafc;
  box-sizing: border-box;
  transition: border-color 0.2s;
}
.ml-input:focus { border-color: #22c55e; background: #fff; }
.ml-pwd-wrap { position: relative; }
.ml-pwd { padding-right: 48px; }
.ml-eye {
  position: absolute; right: 14px; top: 50%; transform: translateY(-50%);
  font-size: 18px; cursor: pointer; user-select: none;
}

.ml-row { display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px; }
.ml-remember { display: flex; align-items: center; gap: 6px; font-size: 13px; color: #64748b; cursor: pointer; }
.ml-remember input { accent-color: #16a34a; width: 15px; height: 15px; }

.ml-error {
  background: #fef2f2;
  border: 1px solid #fecaca;
  color: #dc2626;
  font-size: 13px;
  border-radius: 10px;
  padding: 10px 12px;
  margin-bottom: 16px;
}

.ml-btn {
  width: 100%;
  height: 52px;
  border: none;
  border-radius: 13px;
  background: linear-gradient(135deg, #16a34a, #15803d);
  color: #fff;
  font-size: 17px;
  font-weight: 700;
  letter-spacing: 6px;
  cursor: pointer;
  box-shadow: 0 8px 20px rgba(22,163,74,0.35);
  transition: transform 0.15s, opacity 0.2s;
}
.ml-btn:active { transform: scale(0.98); }
.ml-btn:disabled { opacity: 0.6; }

.ml-footer { margin-top: 28px; font-size: 13px; color: rgba(255,255,255,0.75); cursor: pointer; }
.ml-footer span { padding: 8px 12px; }
</style>
