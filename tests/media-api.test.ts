import { AxiosHeaders, type AxiosAdapter } from 'axios'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { uploadMedia } from '../src/api/media'
import { request, setCsrfToken } from '../src/utils/request'

describe('媒体上传 API', () => {
  const originalAdapter = request.defaults.adapter

  afterEach(() => {
    request.defaults.adapter = originalAdapter
    setCsrfToken(null)
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  it('按授权、对象存储直传、确认顺序完成且不给对象存储发送 Cookie', async () => {
    const calls: string[] = []
    const adapter: AxiosAdapter = async (config) => {
      calls.push(`api:${config.url}`)
      expect(config.headers.get('X-XSRF-TOKEN')).toBe('csrf-value')
      const data = config.url?.endsWith('/uploads')
        ? {
            success: true,
            data: {
              mediaId: 304,
              uploadUrl: 'https://storage.example/upload/304',
              method: 'PUT',
              headers: { 'Content-Type': 'image/png', 'X-Upload-Signature': 'signed' },
              expiresAt: '2026-11-18T21:00:00Z',
            },
            message: null,
          }
        : {
            success: true,
            data: {
              id: 304,
              originalFilename: 'photo.png',
              mediaType: 'image/png',
              byteSize: 4,
              status: 'CONFIRMED',
              publicUrl: 'https://cdn.example/304',
            },
            message: null,
          }
      return {
        data,
        status: 200,
        statusText: 'OK',
        headers: new AxiosHeaders(),
        config,
      }
    }
    request.defaults.adapter = adapter
    setCsrfToken('csrf-value')
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string | URL | Request, options?: RequestInit) => {
        calls.push(`storage:${url}`)
        expect(options?.credentials).toBe('omit')
        expect(options?.method).toBe('PUT')
        expect(options?.headers).toEqual({
          'Content-Type': 'image/png',
          'X-Upload-Signature': 'signed',
        })
        return new Response(null, { status: 200 })
      }),
    )

    const file = new File(['data'], 'photo.png', { type: 'image/png' })
    const media = await uploadMedia(file)

    expect(media.id).toBe(304)
    expect(calls).toEqual([
      'api:/admin/media/uploads',
      'storage:https://storage.example/upload/304',
      'api:/admin/media/304/confirm',
    ])
  })

  it('在申请上传凭证前拒绝超过 10 MiB 的图片', async () => {
    const requestPost = vi.spyOn(request, 'post')
    const oversizedFile = new File(
      [new Uint8Array(10 * 1024 * 1024 + 1)],
      'oversized.png',
      { type: 'image/png' },
    )

    await expect(uploadMedia(oversizedFile)).rejects.toThrow('单张图片不能超过 10 MiB')
    expect(requestPost).not.toHaveBeenCalled()
  })

  it('在申请上传凭证前拒绝不支持的 MIME 类型', async () => {
    const requestPost = vi.spyOn(request, 'post')
    const unsupportedFile = new File(['data'], 'animation.gif', { type: 'image/gif' })

    await expect(uploadMedia(unsupportedFile)).rejects.toThrow(
      '只支持 JPEG、PNG 或 WebP 格式',
    )
    expect(requestPost).not.toHaveBeenCalled()
  })
})
