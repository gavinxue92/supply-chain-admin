import { request } from '../utils/request'
import type { AxiosResponse } from 'axios'
import type { ApiResult, CategoryRequest, CategoryStatusRequest, CategoryVO } from '../types/category'

function requireData<T>(result: ApiResult<T>, fallback: string): T {
  if (!result.success) {
    throw new Error(result.message || fallback)
  }
  if (result.data === null) {
    throw new Error('服务器响应缺少分类数据')
  }
  return result.data
}

function requireSuccess(result: ApiResult<null>, fallback: string): void {
  if (!result.success) {
    throw new Error(result.message || fallback)
  }
}

export async function listCategories(): Promise<CategoryVO[]> {
  const response = await request.get<ApiResult<CategoryVO[]>>('/admin/categories')
  return requireData(response.data, '获取分类列表失败')
}

export async function createCategory(payload: CategoryRequest): Promise<CategoryVO> {
  const response = await request.post<ApiResult<CategoryVO>>('/admin/categories', payload)
  return requireData(response.data, '创建分类失败')
}

export async function updateCategory(id: number, payload: CategoryRequest): Promise<CategoryVO> {
  const response = await request.put<ApiResult<CategoryVO>>(`/admin/categories/${id}`, payload)
  return requireData(response.data, '保存分类失败')
}

export async function setCategoryStatus(id: number, payload: CategoryStatusRequest): Promise<void> {
  const response: AxiosResponse<ApiResult<null>> = await request.patch(
    `/admin/categories/${id}/status`,
    payload,
  )
  requireSuccess(response.data, '更新分类状态失败')
}

export async function deleteCategory(id: number): Promise<void> {
  const response: AxiosResponse<ApiResult<null>> = await request.delete(`/admin/categories/${id}`)
  requireSuccess(response.data, '删除分类失败')
}
