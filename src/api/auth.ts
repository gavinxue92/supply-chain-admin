import { request, setCsrfToken } from '../utils/request'
import type { ChangePasswordRequest, LoginRequest, SessionUser } from '../types/auth'

interface Result<T> {
  success: boolean
  data: T
  message: string | null
}

export async function getCsrfToken(): Promise<string> {
  const response = await request.get<Result<{ token: string }>>('/admin/auth/csrf')
  setCsrfToken(response.data.data.token)
  return response.data.data.token
}

export async function login(payload: LoginRequest): Promise<SessionUser> {
  const response = await request.post<Result<SessionUser>>('/admin/auth/login', payload)
  return response.data.data
}

export async function logout(): Promise<void> {
  await request.post<Result<null>>('/admin/auth/logout')
  setCsrfToken(null)
}

export async function changePassword(payload: ChangePasswordRequest): Promise<void> {
  await request.post<Result<null>>('/admin/auth/change-password', payload)
  setCsrfToken(null)
}

export async function getCurrentUser(): Promise<SessionUser> {
  const response = await request.get<Result<SessionUser>>('/admin/auth/me')
  return response.data.data
}
