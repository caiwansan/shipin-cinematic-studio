/**
 * 讯飞星火 WebSocket Provider — XFyun Spark API
 *
 * 讯飞星火使用 WebSocket 协议，不走标准 REST。
 * 鉴权方式：基于 `host`、`date`、`GET /v3.5/chat HTTP/1.1` 计算 `authorization` 签名。
 *
 * WebSocket 请求/响应格式：
 *   Request:  { header: { app_id }, parameter: { chat: { domain, temperature, max_tokens } }, payload: { message: { text: [...] } } }
 *   Response: { header: { code, message }, payload: { choices: [{ status, seq, text: [{ content, role }] }] } }
 *
 * 支持模型（domain 参数）：
 *   generalv3.5  — ws://spark-api.xf-yun.com/v3.5/chat
 *   generalv3    — ws://spark-api.xf-yun.com/v3.1/chat
 *   generalv2    — ws://spark-api.xf-yun.com/v2.1/chat
 *   lite         — ws://spark-api.xf-yun.com/v1.1/chat
 *
 * 价格参考：
 *   generalv3.5: 0.038 元/1K token (input+output)
 *   generalv3:   0.015 元/1K token
 *   generalv2:   0.009 元/1K token
 *   lite:        0.002 元/1K token
 */

import crypto from 'node:crypto'
import { WebSocket } from 'ws'

// 模型 → domain 映射
const MODEL_DOMAIN_MAP: Record<string, string> = {
  generalv3: 'generalv3',
  generalv3_5: 'generalv3.5', // 模型名在存储中用 generalv3.5，但 domain 参数传 generalv3.5
  generalv2: 'generalv2',
  lite: 'lite',
}

// 模型 → WebSocket URL 映射
const MODEL_URL_MAP: Record<string, string> = {
  generalv3: 'wss://spark-api.xf-yun.com/v3.1/chat',
  generalv3_5: 'wss://spark-api.xf-yun.com/v3.5/chat',
  generalv2: 'wss://spark-api.xf-yun.com/v2.1/chat',
  lite: 'wss://spark-api.xf-yun.com/v1.1/chat',
}

export interface XinghuoConfig {
  appid: string
  apiSecret: string
  apiKey: string
  model?: string  // generalv3.5 | generalv3 | generalv2 | lite
}

interface XinghuoMessage {
  role: string
  content: string
}

interface XinghuoResponse {
  header: { code: number; message: string; sid: string; status: number }
  payload?: {
    choices?: {
      status: number
      seq: number
      text: Array<{ content: string; role: string; index: number }>
    }
    usage?: {
      text: {
        question_tokens: number
        prompt_tokens: number
        completion_tokens: number
        total_tokens: number
      }
    }
  }
}

/**
 * 计算讯飞星火 WebSocket 鉴权 URL
 * 参考：https://www.xfyun.cn/doc/spark/Web.html#_1-%E6%8E%A5%E5%8F%A3%E8%AF%B4%E6%98%8E
 */
function buildAuthUrl(baseUrl: string, apiKey: string, apiSecret: string): string {
  const url = new URL(baseUrl)
  const host = url.host
  const path = url.pathname

  // 1. date
  const date = new Date().toUTCString()

  // 2. signature 原始字符串
  const signatureOrigin = `host: ${host}\ndate: ${date}\nGET ${path} HTTP/1.1`

  // 3. 用 apiSecret 做 HMAC-SHA256 签名
  const hmac = crypto.createHmac('sha256', apiSecret)
  hmac.update(signatureOrigin)
  const signature = hmac.digest('base64')

  // 4. authorization 头
  const authorizationOrigin = `api_key="${apiKey}", algorithm="hmac-sha256", headers="host date request-line", signature="${signature}"`
  const authorization = Buffer.from(authorizationOrigin).toString('base64')

  // 5. 构建最终 URL
  url.protocol = 'wss:'
  url.searchParams.set('authorization', authorization)
  url.searchParams.set('date', date)
  url.searchParams.set('host', host)

  return url.toString()
}

/**
 * 构建讯飞星火 WebSocket 请求消息
 */
function buildWsRequest(appid: string, messages: XinghuoMessage[], model: string): any {
  const domain = MODEL_DOMAIN_MAP[model] || 'generalv3.5'

  return {
    header: {
      app_id: appid,
    },
    parameter: {
      chat: {
        domain,
        temperature: 0.5,
        max_tokens: 2048,
        top_k: 4,
      },
    },
    payload: {
      message: {
        text: messages.map(m => ({
          role: m.role === 'assistant' ? 'assistant' : m.role === 'system' ? 'system' : 'user',
          content: m.content,
        })),
      },
    },
  }
}

/**
 * 调用讯飞星火 API（WebSocket）
 * 返回标准格式 { content: string, tokens: { input, output } }
 */
export async function xinghuoChat(config: XinghuoConfig, messages: XinghuoMessage[]): Promise<{ content: string; tokens: { input: number; output: number } }> {
  const model = config.model || 'generalv3.5'
  const baseUrl = MODEL_URL_MAP[model] || MODEL_URL_MAP.generalv3_5

  return new Promise((resolve, reject) => {
    try {
      const wsUrl = buildAuthUrl(baseUrl, config.apiKey, config.apiSecret)
      const ws = new WebSocket(wsUrl, { handshakeTimeout: 10000 })

      let fullContent = ''
      let usageText: any = null
      const timeout = setTimeout(() => {
        ws.close()
        reject(new Error('讯飞星火 WebSocket 超时'))
      }, 30000)

      ws.on('open', () => {
        const request = buildWsRequest(config.appid, messages, model)
        ws.send(JSON.stringify(request))
      })

      ws.on('message', (raw: Buffer) => {
        try {
          const data: XinghuoResponse = JSON.parse(raw.toString())

          if (data.header.code !== 0) {
            ws.close()
            clearTimeout(timeout)
            reject(new Error(`讯飞星火 API 错误: ${data.header.code} - ${data.header.message}`))
            return
          }

          // 累积内容
          if (data.payload?.choices?.text) {
            for (const t of data.payload.choices.text) {
              fullContent += t.content
            }
          }

          // 用量信息（最后一次返回）
          if (data.payload?.usage?.text) {
            usageText = data.payload.usage.text
          }

          // status=2 表示流结束
          if (data.header.status === 2) {
            ws.close()
            clearTimeout(timeout)
            resolve({
              content: fullContent,
              tokens: {
                input: usageText?.prompt_tokens || usageText?.question_tokens || 0,
                output: usageText?.completion_tokens || 0,
              },
            })
          }
        } catch (e: any) {
          ws.close()
          clearTimeout(timeout)
          reject(new Error(`讯飞星火 响应解析失败: ${e.message}`))
        }
      })

      ws.on('error', (err) => {
        clearTimeout(timeout)
        reject(new Error(`讯飞星火 WebSocket 连接失败: ${err.message}`))
      })

      ws.on('close', (code: number, reason: Buffer) => {
        clearTimeout(timeout)
        if (code !== 1000 && code !== 1005) {
          reject(new Error(`讯飞星火 WebSocket 意外关闭: code=${code} reason=${reason?.toString() || 'unknown'}`))
        }
      })
    } catch (e: any) {
      reject(new Error(`讯飞星火 初始化失败: ${e.message}`))
    }
  })
}

export const xinghuoLLM = {
  chat: xinghuoChat,
}
