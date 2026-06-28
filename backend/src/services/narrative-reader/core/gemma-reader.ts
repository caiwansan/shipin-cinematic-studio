/**
 * gemma-reader.ts — Qwen 2.5 1.5B Inference Layer
 *
 * 调用本地 llama.cpp server（Qwen 2.5 1.5B），
 * 对文本 chunk 进行叙事结构提取。
 *
 * 模型：Qwen 2.5 1.5B Q4_K_M (1.1GB)
 * Schema：降级版 v0.1 — entities[+type+weight] + events[+text+actors]
 * 暂不输出: relations, summary_state
 */

import http from 'http'

const GEMMA_URL = process.env.GEMMA_SERVER_URL || 'http://127.0.0.1:8080'
const NRR_TIMEOUT = Number(process.env.NRR_TIMEOUT_MS) || 120000
const NRR_RETRY = Number(process.env.NRR_RETRY_MS) || 3000 // 重试间隔

const PROMPT_TEMPLATE = `Extract characters and events from the story below.

Return ONLY a JSON object with exactly these fields:
{
  "entities": [{ "name": "<character name>", "type": "person|place|object", "weight": 0.0 }],
  "events": [{ "text": "<brief action description>", "actors": ["<entity name>"] }]
}

Rules:
- entity names exactly as they appear in the text
- weight: 0.0~1.0 (how important is this entity to the story)
- events: only describe things that actually happen
- no explanation, no markdown

Story:
%s

JSON:`

/**
 * 对文本 chunk 进行叙事结构提取（带重试）
 * 返回原始 JSON 字符串
 */
export async function gemmaNarrativeReader(chunk: string, retries = 2): Promise<string> {
  const inputText = chunk.slice(0, 5000)
  const prompt = PROMPT_TEMPLATE.replace('%s', inputText)

  const body = JSON.stringify({
    prompt,
    n_predict: 384,
    temperature: 0.15,
    top_p: 0.9,
    stop: ['<|im_end|>', '<|end|>', '\n\n\n'],
    cache_prompt: true,
  })

  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      return await postCompletion(body)
    } catch (err: any) {
      if (attempt < retries) {
        const delay = NRR_RETRY * (attempt + 1)
        console.log(`[gemma] retry ${attempt + 1}/${retries} after ${delay}ms: ${err.message}`)
        await new Promise(r => setTimeout(r, delay))
      } else {
        throw err
      }
    }
  }

  throw new Error('unreachable')
}

/**
 * 一次 POST 请求（带 AbortController 兜底）
 */
function postCompletion(body: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const ac = new AbortController()
    const timeoutId = setTimeout(() => {
      ac.abort('timeout')
      req.destroy(new Error('timeout'))
    }, NRR_TIMEOUT)

    const req = http.request(
      `${GEMMA_URL}/completion`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: ac.signal,
      },
      (res) => {
        let data = ''
        res.on('data', chunk => data += chunk)
        res.on('end', () => {
          clearTimeout(timeoutId)
          if (!data) {
            reject(new Error('empty response'))
            return
          }
          try {
            const parsed = JSON.parse(data)
            // 检查 Qwen 的错误响应
            if (parsed.error) {
              reject(new Error(`Qwen error: ${parsed.error.message || JSON.stringify(parsed.error)}`))
              return
            }
            let content = parsed.content || parsed.text || ''
            resolve(content.trim())
          } catch {
            reject(new Error(`Qwen parse failed: ${data.slice(0, 200)}`))
          }
        })
        res.on('error', (e) => {
          clearTimeout(timeoutId)
          reject(new Error(`Qwen response error: ${e.message}`))
        })
      },
    )
    req.on('error', (e: any) => {
      clearTimeout(timeoutId)
      // AbortError 已经由 timeout 处理过了，不要重复 reject
      if (e.name === 'AbortError') return
      reject(new Error(`Qwen request: ${e.message}`))
    })
    req.on('timeout', () => {
      // socket timeout — 但用了 AbortController 所以这里不做双重处理
      req.destroy(new Error('socket timeout'))
    })
    req.write(body)
    req.end()
  })
}

/**
 * 心跳检测
 */
export async function checkGemmaHealth(): Promise<boolean> {
  return new Promise((resolve) => {
    const req = http.get(`${GEMMA_URL}/health`, { timeout: 5000 }, (res) => {
      resolve(res.statusCode === 200)
    })
    req.on('error', () => resolve(false))
    req.on('timeout', () => { req.destroy(); resolve(false) })
  })
}
