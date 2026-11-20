export interface CustomerServiceVO {
  id: number
  displayName: string
  wechatId: string | null
  qrMediaId: number | null
  qrImageUrl: string | null
  phone: string | null
  active: boolean
}

export interface CustomerServiceRequest {
  displayName: string
  wechatId: string | null
  qrMediaId: number | null
  phone: string | null
}

export interface CustomerServiceActiveRequest {
  active: boolean
}

export interface GlobalContactVO {
  id: number
  services: CustomerServiceVO[]
}

export interface GlobalContactRequest {
  serviceIds: number[]
}

export interface ContactApiResult<T> {
  success: boolean
  data: T | null
  message: string | null
}
