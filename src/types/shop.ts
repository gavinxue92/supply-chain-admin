export interface ShopInfoVO {
  name: string
  slogan: string
  address: string
  hours: string
  phone: string
  wechat: string
}

export interface ShopInfoRequest {
  name: string
  slogan: string
  address: string
  hours: string
  phone: string
  wechat: string
}

export interface ShopApiResult<T> {
  success: boolean
  data: T | null
  message: string | null
}
