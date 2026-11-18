import { describe, expect, it, vi } from 'vitest'
import { request, setCsrfToken } from '../src/utils/request'

describe('统一 Axios 请求', () => {
  it('写请求携带当前 CSRF token', async () => {
    setCsrfToken('csrf-test-token')
    const adapter = vi.fn(async (config) => ({
      data: { success: true, data: null, message: null },
      status: 200,
      statusText: 'OK',
      headers: {},
      config,
    }))

    await request.post('/admin/test', { name: '测试' }, { adapter })

    const callConfig = adapter.mock.calls[0][0]
    expect(callConfig.headers['X-XSRF-TOKEN']).toBe('csrf-test-token')
  })

  it('401 响应发布未授权事件且不保留继续重试', async () => {
    const unauthorized = vi.fn()
    window.addEventListener('auth:unauthorized', unauthorized)
    const adapter = vi.fn(async (config) => {
      throw {
        response: { status: 401 },
        config,
      }
    })

    await expect(request.get('/admin/test', { adapter })).rejects.toBeDefined()
    expect(unauthorized).toHaveBeenCalledTimes(1)
    window.removeEventListener('auth:unauthorized', unauthorized)
  })
})
