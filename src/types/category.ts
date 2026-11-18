export interface CategoryVO {
  id: number
  parentId?: number | null
  name: string
  active: boolean
  sortOrder: number
}

export interface CategoryRequest {
  name: string
  parentId: number | null
  sortOrder: number
}

export interface CategoryStatusRequest {
  active: boolean
}

export interface ApiResult<T> {
  success: boolean
  data: T | null
  message: string | null
}
