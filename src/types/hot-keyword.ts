export interface HotKeywordVO {
  id: number
  keyword: string
  sortOrder: number
}

export interface HotKeywordsSaveRequest {
  keywords: string[]
}

export interface HotKeywordApiResult<T> {
  success: boolean
  data: T | null
  message: string | null
}
