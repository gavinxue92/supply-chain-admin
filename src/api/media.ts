import { request } from '../utils/request'
import type {
  ConfirmedMediaVO,
  MediaApiResult,
  MediaUploadAuthorizationVO,
  MediaUploadRequest,
} from '../types/media'

const MAX_FILE_SIZE = 10 * 1024 * 1024
const ALLOWED_CONTENT_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp'])

function requireData<T>(result: MediaApiResult<T>, fallback: string): T {
  if (!result.success) {
    throw new Error(result.message || fallback)
  }
  if (result.data === null) {
    throw new Error('服务器响应缺少媒体数据')
  }
  return result.data
}

export async function uploadMedia(file: File): Promise<ConfirmedMediaVO> {
  if (!ALLOWED_CONTENT_TYPES.has(file.type)) {
    throw new Error('只支持 JPEG、PNG 或 WebP 格式')
  }
  if (file.size > MAX_FILE_SIZE) {
    throw new Error('单张图片不能超过 10 MiB')
  }

  const payload: MediaUploadRequest = {
    originalFilename: file.name,
    contentType: file.type,
  }
  const authorizationResponse = await request.post<
    MediaApiResult<MediaUploadAuthorizationVO>
  >('/admin/media/uploads', payload)
  const authorization = requireData(authorizationResponse.data, '申请上传凭证失败')

  if (authorization.method !== 'PUT' && authorization.method !== 'POST') {
    throw new Error('服务器返回了不支持的媒体上传方式')
  }

  let storageResponse: Response
  try {
    storageResponse = await fetch(authorization.uploadUrl, {
      method: authorization.method,
      headers: authorization.headers,
      body: file,
      credentials: 'omit',
    })
  } catch (error) {
    if (error instanceof Error) {
      throw new Error(`对象存储上传失败：${error.message}`)
    }
    throw error
  }

  if (!storageResponse.ok) {
    if (storageResponse.status === 410) {
      throw new Error('上传凭证已过期，请重试以重新申请')
    }
    throw new Error(`对象存储上传失败（HTTP ${storageResponse.status}），请重试`)
  }

  const confirmationResponse = await request.post<MediaApiResult<ConfirmedMediaVO>>(
    `/admin/media/${authorization.mediaId}/confirm`,
  )
  const media = requireData(confirmationResponse.data, '确认媒体失败')
  if (media.id !== authorization.mediaId) {
    throw new Error('服务器确认的媒体编号与上传凭证不一致')
  }
  return media
}
