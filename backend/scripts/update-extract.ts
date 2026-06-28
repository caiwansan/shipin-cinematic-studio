import { readFileSync, writeFileSync } from 'fs'

const path = 'src/routes/optimize-video-prompt.ts'
let content = readFileSync(path, 'utf-8')

// Find the old function
const idx = content.indexOf('function extractStoryFromProject(project: any): string')
if (idx < 0) { console.error('Not found'); process.exit(1) }

// Find the next export/function/import after it
const after = content.substring(idx)
const nextFn = after.search(/\n(?:(export|function|import)\s)/)
const fnLen = nextFn > 0 ? nextFn : after.length
const oldFn = after.substring(0, fnLen).replace(/\n$/, '')

console.log('Old function length:', oldFn.length)

const newFn = `function extractStoryFromProject(project: any): string {
  try {
    const er = project.executionResults
    if (!er) {
      const desc = project.description || project.name || ''
      if (desc.startsWith('{')) {
        try {
          const parsed = JSON.parse(desc)
          if (parsed.designSpec) {
            const chars = parsed.designSpec.characterSpecs || []
            const scenes = parsed.designSpec.sceneSpecs || []
            const parts: string[] = []
            for (const c of chars) {
              if (c.characterName) parts.push(\`角色：\${c.characterName}，\${c.gender || ''}，\${c.age || ''}，\${(c.physicalDescription || '').slice(0, 60)}\`)
            }
            for (const s of scenes) {
              if (s.sceneName) parts.push(\`场景：\${s.sceneName}，\${(s.description || '').slice(0, 60)}\`)
            }
            return parts.join('\\n') || project.name || ''
          }
        } catch {}
      }
      return desc
    }

    const erObj = typeof er === 'string' ? JSON.parse(er) : er

    // ⭐ 首要：plotBlueprint 有 scenes[].script 时输出完整剧本（下游 Agent 的唯一剧情事实源）
    if (erObj.plotBlueprint?.scenes?.length) {
      const scenes = erObj.plotBlueprint.scenes
      const hasFullScript = scenes.some((s: any) => s.script && s.script.length > 20)
      if (hasFullScript) {
        const scriptParts: string[] = []
        for (const scene of scenes) {
          scriptParts.push(\`【场景 \${scene.sceneId || '?'}】\${scene.name || ''}（\${scene.env || ''}，\${scene.time || ''}，\${scene.weather || ''}）\`)
          if (scene.characterVariants && Object.keys(scene.characterVariants).length > 0) {
            const variantInfo = Object.entries(scene.characterVariants)
              .map(([char, varName]) => \`\${char}（\${(varName as string) || '默认状态'}）\`)
              .join('，')
            scriptParts.push(\`出场角色：\${variantInfo}\`)
          }
          scriptParts.push(scene.summary || '')
          scriptParts.push(\`【剧本正文】\${scene.script}\`)
          scriptParts.push('')
        }
        return scriptParts.join('\\n')
      }

      // 无 script 字段时回退到 summary
      const sceneParts: string[] = []
      for (const scene of scenes) {
        const summary = scene.summary || scene.description || ''
        if (summary) sceneParts.push(summary)
      }
      if (sceneParts.length > 0) {
        return sceneParts.join('\\n')
      }
    }

    // 2. rawScript
    if (erObj.rawScript && typeof erObj.rawScript === 'string') {
      return erObj.rawScript
    }

    // 3. plotBlueprint 摘要
    if (erObj.plotBlueprint) {
      const bp = erObj.plotBlueprint
      const parts: string[] = []
      if (bp.theme) parts.push(\`主题：\${bp.theme}\`)
      if (bp.mood) parts.push(\`氛围：\${bp.mood}\`)
      if (bp.timeline) parts.push(\`时间线：\${bp.timeline}\`)
      if (bp.worldView) parts.push(\`世界观：\${bp.worldView}\`)
      if (bp.tags?.length) parts.push(\`标签：\${bp.tags.join('、')}\`)
      return parts.join('\\n')
    }

    return project.description || project.name || ''
  } catch {
    return project.description || project.name || ''
  }
}`

// Verify oldFn exists
if (!content.includes(oldFn)) {
  console.error('Could not find exact match. Showing first/last 100 chars:')
  console.log('START:', JSON.stringify(oldFn.substring(0, 100)))
  console.log('END:', JSON.stringify(oldFn.substring(oldFn.length - 100)))
  process.exit(1)
}

content = content.replace(oldFn, newFn)
writeFileSync(path, content)
console.log('✅ Updated successfully')
