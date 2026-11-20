import { request } from '../utils/request'
import type {
  AccountApiResult,
  AdminAccountVO,
  CreateAccountRequest,
  ResetTemporaryPasswordRequest,
  UpdateNicknameRequest,
} from '../types/account'

function requireData<T>(result: AccountApiResult<T>, fallback: string): T {
  if (!result.success) {
    throw new Error(result.message || fallback)
  }
  if (result.data === null) {
    throw new Error('服务器响应缺少账号数据')
  }
  return result.data
}

function requireSuccess(result: AccountApiResult<null>, fallback: string): void {
  if (!result.success) {
    throw new Error(result.message || fallback)
  }
}

export async function listAccounts(): Promise<AdminAccountVO[]> {
  const response = await request.get<AccountApiResult<AdminAccountVO[]>>('/admin/accounts')
  return requireData(response.data, '获取后台账号列表失败')
}

export async function createAccount(payload: CreateAccountRequest): Promise<AdminAccountVO> {
  const response = await request.post<AccountApiResult<AdminAccountVO>>(
    '/admin/accounts',
    payload,
  )
  return requireData(response.data, '创建后台账号失败')
}

export async function deactivateAccount(id: number): Promise<void> {
  const response = await request.post<AccountApiResult<null>>(
    `/admin/accounts/${id}/deactivate`,
  )
  requireSuccess(response.data, '停用后台账号失败')
}

export async function resetTemporaryPassword(
  id: number,
  payload: ResetTemporaryPasswordRequest,
): Promise<void> {
  const response = await request.put<AccountApiResult<null>>(
    `/admin/accounts/${id}/temporary-password`,
    payload,
  )
  requireSuccess(response.data, '重置临时密码失败')
}

export async function updateMyNickname(payload: UpdateNicknameRequest): Promise<AdminAccountVO> {
  const response = await request.patch<AccountApiResult<AdminAccountVO>>(
    '/admin/accounts/me/nickname',
    payload,
  )
  return requireData(response.data, '更新昵称失败')
}

export async function updateAccountNickname(
  id: number,
  payload: UpdateNicknameRequest,
): Promise<AdminAccountVO> {
  const response = await request.patch<AccountApiResult<AdminAccountVO>>(
    `/admin/accounts/${id}/nickname`,
    payload,
  )
  return requireData(response.data, '更新账号昵称失败')
}

export async function deleteAccount(id: number): Promise<void> {
  const response = await request.delete<AccountApiResult<null>>(`/admin/accounts/${id}`)
  requireSuccess(response.data, '硬删除后台账号失败')
}
