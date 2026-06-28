#!/usr/bin/env python3
import os

path = '/root/shipin-cinematic-studio/frontend/studio-v2/workspace/script-analysis/ScriptAnalysisWorkspace.vue'

with open(path, 'r') as f:
    content = f.read()

# 1. template: 在"开始AI拆解"按钮后加"提交拆解任务"按钮
old_tpl = '''        <button class="btn-primary" :disabled="!currScript.trim() || analyzing" @click="analyzeScript">
          {{ analyzing ? '\u23f3 \u5206\u6790\u4e2d...' : '\u25b6 \u5f00\u59cbAI\u62c6\u89e3' }}
        </button>
        <button v-if="hasAnalysisResult" class="btn-next" @click="goToCharacterDesign">'''

new_tpl = '''        <button class="btn-primary" :disabled="!currScript.trim() || analyzing" @click="analyzeScript">
          {{ analyzing ? '\u23f3 \u5206\u6790\u4e2d...' : '\u25b6 \u5f00\u59cbAI\u62c6\u89e3' }}
        </button>
        <button class="btn-submit-task" :disabled="!currScript.trim() || submittingTask" @click="submitBreakdownTask">
          {{ submittingTask ? '\u23f3 \u63d0\u4ea4\u4e2d...' : '\U0001f4e6 \u63d0\u4ea4\u62c6\u89e3\u4efb\u52a1' }}
        </button>
        <button v-if="hasAnalysisResult" class="btn-next" @click="goToCharacterDesign">'''

c1 = content.count(old_tpl)
print(f'template replace count: {c1}')
if c1 == 1:
    content = content.replace(old_tpl, new_tpl, 1)
else:
    # fallback: try ascii version
    old_tpl2 = '''        <button class="btn-primary" :disabled="!currScript.trim() || analyzing" @click="analyzeScript">
          {{ analyzing ? '\\u23f3 \\u5206\\u6790\\u4e2d...' : '\\u25b6 \\u5f00\\u59cbAI\\u62c6\\u89e3' }}
        </button>
        <button v-if="hasAnalysisResult" class="btn-next" @click="goToCharacterDesign">'''
    c2 = content.count(old_tpl2)
    print(f'template replace 2 count: {c2}')
    if c2 == 1:
        content = content.replace(old_tpl2, new_tpl, 1)

# 2. script: 加 submittingTask ref
content = content.replace(
    'const analyzing = ref(false)',
    'const analyzing = ref(false)\nconst submittingTask = ref(false)',
    1
)

# 3. 加 submitBreakdownTask 函数（在 analyzeScript 函数闭合之后）
old_fn_end = '''  }
}

'''

new_fn_end = '''  }
}

// Submit breakdown task: POST /api/v1/script-breakdown -> /submit
async function submitBreakdownTask() {
  const data = currNarrative()
  if (!data.script?.trim()) {
    alert('\\u8bf7\\u5148\\u8f93\\u5165\\u5267\\u672c\\u5185\\u5bb9')
    return
  }
  if (submittingTask.value) return
  submittingTask.value = true

  try {
    const userId = store.state?.user?.id || localStorage.getItem('user_id') || ''
    const createRes = await fetch('/api/v1/script-breakdown', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-user-id': userId },
      body: JSON.stringify({
        script: data.script.trim(),
        title: scriptTitle.value || projectNameInput.value || '\\u672a\\u547d\\u540d',
        targetDuration: videoDuration.value || 60,
      }),
    })
    const createJson = await createRes.json()
    if (!createJson.success || !createJson.data?.id) {
      throw new Error(createJson.error || '\\u521b\\u5efa\\u62c6\\u89e3\\u4efb\\u52a1\\u5931\\u8d25')
    }

    const taskId = createJson.data.id
    const submitRes = await fetch('/api/v1/script-breakdown/' + taskId + '/submit', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-user-id': userId },
      body: JSON.stringify({}),
    })
    const submitJson = await submitRes.json()
    if (!submitJson.success) {
      throw new Error(submitJson.error || 'AI \\u62c6\\u89e3\\u63d0\\u4ea4\\u5931\\u8d25')
    }

    // Parse result and update narrative if JSON
    const resultRaw = submitJson.data?.resultScript
    if (resultRaw) {
      try {
        const parsed = JSON.parse(resultRaw)
        if (parsed.videoSegments || parsed.characters || parsed.scenes) {
          updateNarrative({
            videoSegments: parsed.videoSegments || n.value?.videoSegments || [],
            characters: parsed.characters || n.value?.characters || [],
            scenes: parsed.scenes || n.value?.scenes || [],
            dialogues: parsed.dialogues || n.value?.dialogues || [],
            actions: parsed.actions || n.value?.actions || [],
            voices: parsed.voices || n.value?.voices || [],
            beats: parsed.beats || parsed.videoSegments?.flatMap?.((s) => s.beats || []) || n.value?.beats || [],
            props: parsed.props || n.value?.props || [],
            emotionCurve: parsed.emotionCurve || n.value?.emotionCurve || [],
          })
        }
        console.log('[submitBreakdownTask] result synced to narrative')
      } catch (parseErr) {
        console.warn('[submitBreakdownTask] result is not JSON')
      }
    }

    alert('\\u2705 \\u62c6\\u89e3\\u4efb\\u52a1\\u5df2\\u5b8c\\u6210\\uff0c\\u7ed3\\u679c\\u5df2\\u5e94\\u7528')
  } catch (err) {
    alert('\\u274c \\u62c6\\u89e3\\u5931\\u8d25: ' + (err.message || err))
  } finally {
    submittingTask.value = false
  }
}

'''

content = content.replace(old_fn_end, new_fn_end, 1)

with open(path, 'w') as f:
    f.write(content)

print('Patch complete!')
print(f'total len: {len(content)}')
