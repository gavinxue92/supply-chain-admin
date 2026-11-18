export interface MediaUploadRequest {
  originalFilename: string
  contentType: string
}

export interface MediaUploadAuthorizationVO {
  mediaId: number
  uploadUrl: string
  method: string
  headers: Record<string, string>
  expiresAt: string
}

export interface ConfirmedMediaVO {
  id: number
  originalFilename: string
  mediaType: string
  byteSize: number
  status: string
  publicUrl: string
}

export interface MediaApiResult<T> {
  success: boolean
  data: T | null
  message: string | null
}
