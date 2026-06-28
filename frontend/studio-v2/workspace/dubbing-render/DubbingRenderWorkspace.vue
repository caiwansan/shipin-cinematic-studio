<template>
  <div class="dubbing-workspace">
    <!-- 顶部导航 -->
    <div class="dr-header">
      <button class="dr-back" @click="goBack">← 返回视频生成</button>
      <h2 class="dr-title">🎙️ 配音合成</h2>
      <div class="dr-project-name" v-if="projectName">{{ projectName }}</div>
    </div>

    <div class="dr-body">
      <!-- 左栏：配音生成 -->
      <section class="dr-left">
        <div class="dr-section-title">
          <span>🎤 角色配音</span>
        </div>
        <div class="dr-placeholder">
          角色配音功能即将上线 — 支持批量 TTS 生成、试听、及字幕合成
        </div>
      </section>

      <!-- 右栏：合成与导出 -->
      <section class="dr-right">
        <div class="dr-section-title">🎬 合成完整视频</div>
        <div class="dr-placeholder">
          视频合成功能即将上线 — 支持配音叠加、字幕烧录、视频导出
        </div>
      </section>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useRoute } from 'vue-router'
import { useStudioStore } from '~/studio-v2/stores/useStudioStore'

const route = useRoute()
const { projectId: pidFromStore, goToStage } = useStudioStore()

const projectName = ref('')

function goBack() {
  goToStage('video-generation' as any)
}

onMounted(() => {
  const pid = route.query.projectId || (pidFromStore as any)?.value || ''
  projectName.value = '项目加载中...'
})
</script>

<style scoped>
.dubbing-workspace {
  display: flex;
  flex-direction: column;
  height: 100%;
  background: #0a0a12;
  color: #e2e8f0;
  padding: 20px;
  overflow-y: auto;
}
.dr-header {
  display: flex;
  align-items: center;
  gap: 16px;
  margin-bottom: 20px;
  flex-shrink: 0;
}
.dr-back {
  background: rgba(255,255,255,0.06);
  border: 1px solid rgba(255,255,255,0.10);
  border-radius: 8px;
  padding: 6px 14px;
  color: #9ca3af;
  cursor: pointer;
  font-size: 13px;
}
.dr-back:hover { background: rgba(255,255,255,0.10); color: #fff; }
.dr-title { font-size: 18px; font-weight: 700; margin: 0; }
.dr-project-name { font-size: 13px; color: #6b7280; margin-left: auto; }
.dr-body { display: flex; gap: 20px; flex: 1; min-height: 0; }
.dr-left { flex: 1; }
.dr-right { width: 380px; min-width: 380px; }
.dr-section-title {
  font-size: 15px;
  font-weight: 600;
  padding-bottom: 8px;
  border-bottom: 1px solid rgba(255,255,255,0.08);
  margin-bottom: 12px;
}
.dr-placeholder {
  padding: 40px;
  text-align: center;
  color: #6b7280;
  font-size: 14px;
  background: rgba(255,255,255,0.02);
  border: 1px dashed rgba(255,255,255,0.08);
  border-radius: 10px;
}
</style>
