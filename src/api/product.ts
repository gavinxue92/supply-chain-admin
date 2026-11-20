import { request } from '../utils/request'
import type {
  ProductAction,
  ProductApiResult,
  ProductDraftRequest,
  ProductVO,
} from '../types/product'

function requireData<T>(result: ProductApiResult<T>, fallback: string): T {
  if (!result.success) {
    throw new Error(result.message || fallback)
  }
  if (result.data === null) {
    throw new Error('服务器响应缺少产品数据')
  }
  return result.data
}

function requireSuccess(result: ProductApiResult<null>, fallback: string): void {
  if (!result.success) {
    throw new Error(result.message || fallback)
  }
}

export async function listProducts(): Promise<ProductVO[]> {
  const response = await request.get<ProductApiResult<ProductVO[]>>('/admin/products')
  return requireData(response.data, '获取产品列表失败')
}

export async function getProduct(id: number): Promise<ProductVO> {
  const response = await request.get<ProductApiResult<ProductVO>>(`/admin/products/${id}`)
  return requireData(response.data, '获取产品详情失败')
}

export async function createProduct(payload: ProductDraftRequest): Promise<ProductVO> {
  const response = await request.post<ProductApiResult<ProductVO>>('/admin/products', payload)
  return requireData(response.data, '创建产品草稿失败')
}

export async function updateProduct(
  id: number,
  payload: ProductDraftRequest,
): Promise<ProductVO> {
  const response = await request.put<ProductApiResult<ProductVO>>(
    `/admin/products/${id}`,
    payload,
  )
  return requireData(response.data, '保存产品失败')
}

async function postProductAction(
  id: number,
  action: ProductAction,
  fallback: string,
): Promise<void> {
  const response = await request.post<ProductApiResult<null>>(
    `/admin/products/${id}/${action}`,
  )
  requireSuccess(response.data, fallback)
}

export function publishProduct(id: number): Promise<void> {
  return postProductAction(id, 'publish', '上架产品失败')
}

export function unpublishProduct(id: number): Promise<void> {
  return postProductAction(id, 'unpublish', '下架产品失败')
}

export function archiveProduct(id: number): Promise<void> {
  return postProductAction(id, 'archive', '归档产品失败')
}

export function restoreProduct(id: number): Promise<void> {
  return postProductAction(id, 'restore', '恢复产品失败')
}

export async function deleteProduct(id: number): Promise<void> {
  const response = await request.delete<ProductApiResult<null>>(`/admin/products/${id}`)
  requireSuccess(response.data, '硬删除产品失败')
}
