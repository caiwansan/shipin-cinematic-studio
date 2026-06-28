# A/B Video Generation Execution

## Status
Worker pool: ✅ RUNNING (in api-server process)
Test user:   ✅ 慧娟 (volcengine key configured)
Provider:    ✅ Volcengine doubao-seedance-1-5-pro-251215
A/B payloads: ✅ Built and ready

## Execution

Run the following command to execute the A/B test:

```bash
cd /root/shipin-cinematic-studio/backend

cat > /tmp/run-ab-test.cjs << 'SCRIPT'
const { PrismaClient } = require('/root/shipin-cinematic-studio/backend/node_modules/@prisma/client/index.js')
const jwt = require('/root/shipin-cinematic-studio/backend/node_modules/jsonwebtoken')
const prisma = new PrismaClient()

async function main() {
  const userId = '6d503a67-ba62-4f12-a5c0-54352a1bbdf0'  // 慧娟
  const projectId = '7d4d6857-aa7a-429e-8cd0-fa012fe2c96f'
  
  // Get JWT secret
  const fs = require('fs')
  const envContent = fs.readFileSync('/root/shipin-cinematic-studio/backend/.env', 'utf-8')
  const match = envContent.match(/^JWT_SECRET=(.+)$/m)
  if (!match) { console.error('JWT_SECRET not found'); process.exit(1) }
  const JWT_SECRET = match[1].trim()
  
  const token = jwt.sign(
    { id: userId, email: 'qq_2CC5F489775FD090B2862027D8CB8F0C@aigc.fushtn.com', tokenVersion: 99 },
    JWT_SECRET,
    { expiresIn: '2h' }
  )
  
  const headers = { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token }
  const baseUrl = 'http://localhost:4002'
  
  const tests = [
    {
      name: 'A-Dialogue',
      input: {
        narrative: '深夜便利店外，镜头从灯光招牌缓缓下摇，聚焦在长椅上。阿诚低头盯着手机。',
        dialogue: '阿诚：群里说老陈要调走了？',
        effects: '远处车辆行驶声',
        duration: 5, ratio: '9:16', model: 'doubao-seedance-1-5-pro-251215', videoStyle: 'realistic'
      }
    },
    {
      name: 'B-Enhanced',
      input: {
        narrative: '深夜便利店外，镜头从灯光招牌缓缓下摇，聚焦在长椅上。阿诚低头盯着手机。',
        dialogue: '阿诚：群里说老陈要调走了？',
        effects: '远处车辆行驶声',
        duration: 5, ratio: '9:16', model: 'doubao-seedance-1-5-pro-251215', videoStyle: 'realistic',
        characters: [{ name: '阿诚', gender: '男', age: '30岁', clothing: '深灰色连帽卫衣', appearance: '身材偏瘦，短发凌乱' }],
        scenes: [{ name: '便利店外', environment: '城市街道', lighting: '路灯暖黄+冷白荧光', mood: '压抑', timeOfDay: '深夜' }],
        storyboard: { shotPattern: 'MCU中景', emotion: '疑惑', duration: 5 }
      }
    },
  ]
  
  const results = []
  for (const test of tests) {
    console.log(`\n=== Submitting: ${test.name} ===`)
    const res = await fetch(baseUrl + '/api/tasks/ai-generate', {
      method: 'POST', headers,
      body: JSON.stringify({ projectId, taskType: 'video', input: test.input }),
    })
    const data = await res.json()
    console.log(`Status: ${res.status}, Body: ${JSON.stringify(data).substring(0,200)}`)
    if (data.success && data.data?.taskId) {
      results.push({ name: test.name, taskId: data.data.taskId })
    }
  }
  
  // Poll all tasks
  for (const r of results) {
    console.log(`\n=== Polling: ${r.name} (${r.taskId}) ===`)
    for (let i = 0; i < 60; i++) {
      await new Promise(r2 => setTimeout(r2, 3000))
      const res = await fetch(baseUrl + '/api/tasks/' + r.taskId + '/status', { headers })
      const data = await res.json()
      const status = data.data?.status || data.status || 'unknown'
      console.log(`  [${i+1}] ${status}`)
      if (status === 'completed' || status === 'failed') {
        console.log(`  Result: ${JSON.stringify(data).substring(0,300)}`)
        break
      }
    }
  }
  
  await prisma.$disconnect()
}
main().catch(e => { console.error(e); process.exit(1) })
SCRIPT

JWT_SECRET=… node /tmp/run-ab-test.cjs
```

## Evaluation

After execution, compare the video outputs from A and B using the scoring matrix:

| Criterion | A (Legacy) | B (Enhanced) |
|-----------|:----------:|:------------:|
| Character Consistency | /10 | /10 |
| Scene Consistency | /10 | /10 |
| Camera Compliance | /10 | /10 |
| Emotion Accuracy | /10 | /10 |
| Narrative Fidelity | /10 | /10 |
| **Average** | **/10** | **/10** |

## Expected Outcome
B > A by ≥40% across all criteria.
