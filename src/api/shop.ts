import { request } from '../utils/request'
import type { ShopApiResult, ShopInfoRequest, ShopInfoVO } from '../types/shop'

export async function getShopInfo(): Promise<ShopInfoVO | null> {
  const response = await request.get<ShopApiResult<ShopInfoVO>>('/admin/shop')
  if (!response.data.success) {
    throw new Error(response.data.message || '获取店铺信息失败')
  }
  return response.data.data
}

export async function saveShopInfo(payload: ShopInfoRequest): Promise<ShopInfoVO | null> {
  const response = await request.put<ShopApiResult<ShopInfoVO>>('/admin/shop', payload)
  if (!response.data.success) {
    throw new Error(response.data.message || '保存店铺信息失败')
  }
  return response.data.data
}
