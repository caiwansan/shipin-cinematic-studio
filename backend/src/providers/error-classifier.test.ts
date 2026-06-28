/**
 * providers/error-classifier.test.ts
 *
 * P4.1.1 Verify API Hardening — 错误分类器单元测试
 *
 * 覆盖:
 * - 7 种错误码的精准分类
 * - Invalid API Key vs Network Error 的严格区分
 */

import { describe, it, expect } from 'vitest'
import { classifyError, classifyAdapterError } from './error-classifier'
import type { ClassifiedError, ClassifiedErrorCode } from './error-classifier'

/* ── Test Helpers ── */

function makeError(overrides: Partial<Error & { status: number; body: string; statusCode: number }>): Error & any {
  const err = new Error(overrides.message || 'Unknown error')
  if (overrides.status !== undefined) err.name = 'HttpError'
  return { ...err, ...overrides }
}

function assertErrorCode(err: any, expectedCode: ClassifiedErrorCode, label: string) {
  const result = classifyAdapterError(err)
  expect(result.code, `${label}: expected ${expectedCode}, got ${result.code}`).toBe(expectedCode)
  expect(result.retryable, `${label}: retryable mismatch`).toEqual(
    ['NETWORK_TIMEOUT', 'RATE_LIMITED', 'PROVIDER_ERROR', 'DNS_ERROR', 'NETWORK_ERROR'].includes(expectedCode),
  )
  expect(result.message, `${label}: message should not be empty`).toBeTruthy()
}

/* ── Test Suite ── */

describe('Error Classifier — classifyAdapterError', () => {
  it('INVALID_API_KEY: HTTP 401', () => {
    assertErrorCode(
      makeError({ status: 401, message: 'API密钥无效', body: '{}' }),
      'INVALID_API_KEY',
      'HTTP 401',
    )
  })

  it('INVALID_API_KEY: HTTP 400', () => {
    assertErrorCode(
      makeError({ status: 400, message: 'Bad request' }),
      'INVALID_API_KEY',
      'HTTP 400',
    )
  })

  it('EXPIRED_API_KEY: HTTP 401 + "expired" body', () => {
    assertErrorCode(
      makeError({ status: 401, message: 'API key expired', body: 'expired' }),
      'EXPIRED_API_KEY',
      'HTTP 401 expired',
    )
  })

  it('PERMISSION_DENIED: HTTP 403', () => {
    assertErrorCode(
      makeError({ status: 403, message: 'Forbidden' }),
      'PERMISSION_DENIED',
      'HTTP 403',
    )
  })

  it('QUOTA_EXCEEDED: HTTP 403 + "quota" body', () => {
    assertErrorCode(
      makeError({ status: 403, message: 'quota exceeded', body: 'insufficient balance' }),
      'QUOTA_EXCEEDED',
      'HTTP 403 quota',
    )
  })

  it('RATE_LIMITED: HTTP 429', () => {
    assertErrorCode(
      makeError({ status: 429, message: 'Too Many Requests' }),
      'RATE_LIMITED',
      'HTTP 429',
    )
  })

  it('PROVIDER_ERROR: HTTP 500', () => {
    assertErrorCode(
      makeError({ status: 500, message: 'Internal Server Error' }),
      'PROVIDER_ERROR',
      'HTTP 500',
    )
  })

  it('PROVIDER_ERROR: HTTP 502', () => {
    assertErrorCode(
      makeError({ status: 502, message: 'Bad Gateway' }),
      'PROVIDER_ERROR',
      'HTTP 502',
    )
  })

  it('PROVIDER_ERROR: HTTP 503', () => {
    assertErrorCode(
      makeError({ status: 503, message: 'Service Unavailable' }),
      'PROVIDER_ERROR',
      'HTTP 503',
    )
  })
})

describe('Error Classifier — classifyError (from Error messages)', () => {
  it('NETWORK_TIMEOUT: AbortError', () => {
    const err = makeError({ name: 'AbortError', message: 'The operation was aborted' })
    const result = classifyError(err)
    expect(result.code).toBe('NETWORK_TIMEOUT')
    expect(result.retryable).toBe(true)
  })

  it('NETWORK_TIMEOUT: TimeoutError', () => {
    const result = classifyError(makeError({ name: 'TimeoutError', message: 'timeout of 10000ms exceeded' }))
    expect(result.code).toBe('NETWORK_TIMEOUT')
  })

  it('DNS_ERROR: ENOTFOUND', () => {
    const result = classifyError(makeError({ message: 'ENOTFOUND api.deepseek.com' }))
    expect(result.code).toBe('DNS_ERROR')
  })

  it('NETWORK_ERROR: ECONNREFUSED', () => {
    const result = classifyError(makeError({ message: 'ECONNREFUSED 127.0.0.1:443' }))
    expect(result.code).toBe('NETWORK_ERROR')
  })

  it('NETWORK_ERROR: fetch failed', () => {
    const result = classifyError(makeError({ message: 'fetch failed: reason: network error' }))
    expect(result.code).toBe('NETWORK_ERROR')
  })
})

describe('Error Classifier — status in message text (Adapter format)', () => {
  it('DeepSeek LLM 失败 (401) → INVALID_API_KEY', () => {
    // This is the format openai-compat.adapter.ts throws
    const err = makeError({ message: 'DeepSeek LLM 失败 (401): Authentication fails, Your api key is invalid' })
    // No .status property — classifier should extract from message
    const result = classifyAdapterError(err)
    expect(result.code).toBe('INVALID_API_KEY')
  })

  it('通用 LLM 失败 (429) → RATE_LIMITED', () => {
    const result = classifyAdapterError(makeError({ message: 'OpenAI LLM 失败 (429): Too many requests' }))
    expect(result.code).toBe('RATE_LIMITED')
  })

  it('通用 LLM 失败 (500) → PROVIDER_ERROR', () => {
    const result = classifyAdapterError(makeError({ message: '通用 LLM 失败 (500): server error' }))
    expect(result.code).toBe('PROVIDER_ERROR')
  })

  it('unknown error → UNKNOWN_ERROR', () => {
    const result = classifyAdapterError(makeError({ message: 'Unexpected error occurred' }))
    expect(result.code).toBe('UNKNOWN_ERROR')
  })
})

describe('Error Classifier — retryable classification', () => {
  const retryable: Array<[ClassifiedErrorCode, () => Error]> = [
    ['NETWORK_TIMEOUT', () => makeError({ name: 'AbortError', message: 'timeout' })],
    ['RATE_LIMITED', () => makeError({ status: 429 })],
    ['PROVIDER_ERROR', () => makeError({ status: 503 })],
    ['DNS_ERROR', () => makeError({ message: 'ENOTFOUND' })],
    ['NETWORK_ERROR', () => makeError({ message: 'ECONNREFUSED' })],
  ]

  for (const [code, factory] of retryable) {
    it(`${code} → retryable=true`, () => {
      const err = factory()
      const result = err.hasOwnProperty('status') || err.hasOwnProperty('statusCode')
        ? classifyAdapterError(err)
        : classifyError(err)
      expect(result.code, `expected ${code}, got ${result.code}`).toBe(code)
      expect(result.retryable).toBe(true)
    })
  }

  const nonRetryable: Array<[ClassifiedErrorCode, number]> = [
    ['INVALID_API_KEY', 401],
    ['EXPIRED_API_KEY', 401],  // still 401, but body contains "expired"
    ['PERMISSION_DENIED', 403],
    ['QUOTA_EXCEEDED', 403],   // still 403, but body contains "quota"
    ['UNKNOWN_ERROR', 418],    // unknown status code
  ]

  for (const [code, status] of nonRetryable) {
    it(`${code} → retryable=false`, () => {
      let err: any
      if (code === 'EXPIRED_API_KEY') {
        err = makeError({ status, message: 'expired', body: 'expired' })
      } else if (code === 'QUOTA_EXCEEDED') {
        err = makeError({ status, message: 'quota exceeded', body: 'insufficient balance' })
      } else if (code === 'UNKNOWN_ERROR') {
        err = makeError({ status, message: 'I am a teapot' })
      } else {
        err = makeError({ status, message: 'Forbidden' })
      }
      const result = classifyAdapterError(err)
      expect(result.code, `expected ${code}, got ${result.code}`).toBe(code)
      expect(result.retryable).toBe(false)
    })
  }
})
