export type ProductStatus = 'DRAFT' | 'PUBLISHED' | 'UNPUBLISHED' | 'ARCHIVED'

export type ProductContactMode = 'INHERIT' | 'OVERRIDE' | 'DISABLED'

export type ProductAction = 'publish' | 'unpublish' | 'archive' | 'restore'

export interface ProductSpecificationVO {
  id: number
  name: string
  referencePrice: number | null
  sortOrder: number
}

export interface ProductSpecificationRequest {
  name: string
  referencePrice: number | null
}

export interface ProductVO {
  id: number
  status: ProductStatus
  name: string | null
  categoryId: number | null
  detailText: string | null
  mainImageMediaId: number | null
  galleryMediaIds: number[]
  keywords: string[]
  contactMode: ProductContactMode
  contactWechatId: string | null
  contactQrMediaId: number | null
  sortOrder: number
  specifications: ProductSpecificationVO[]
}

export interface ProductDraftRequest {
  name: string
  categoryId: number | null
  detailText: string
  mainImageMediaId: number | null
  galleryMediaIds: number[]
  keywords: string[]
  contactMode: ProductContactMode
  contactWechatId: string | null
  contactQrMediaId: number | null
  sortOrder: number
  specifications: ProductSpecificationRequest[]
}

export interface ProductApiResult<T> {
  success: boolean
  data: T | null
  message: string | null
}
