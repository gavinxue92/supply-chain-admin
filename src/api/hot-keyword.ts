import { request } from '../utils/request'
import type {
  HotKeywordApiResult,
  HotKeywordVO,
  HotKeywordsSaveRequest,
} from '../types/hot-keyword'

export async function listHotKeywords(): Promise<HotKeywordVO[]> {
  const response = await request.get<HotKeywordApiResult<HotKeywordVO[]>>(
    '/admin/search/hot-keywords',
  )
  if (!response.data.success || response.data.data === null) {
    throw new Error(response.data.message || '获取搜索热词失败')
  }
  return response.data.data
}

export async function saveHotKeywords(
  payload: HotKeywordsSaveRequest,
): Promise<HotKeywordVO[]> {
  const response = await request.put<HotKeywordApiResult<HotKeywordVO[]>>(
    '/admin/search/hot-keywords',
    payload,
  )
  if (!response.data.success || response.data.data === null) {
    throw new Error(response.data.message || '保存搜索热词失败')
  }
  return response.data.data
}
