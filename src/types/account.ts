import type { UserRole } from './auth'

export interface AdminAccountVO {
  id: number
  username: string
  nickname: string | null
  role: UserRole
  active: boolean
  mustChangePassword: boolean
  createdAt: string
}

export interface CreateAccountRequest {
  username: string
  temporaryPassword: string
  role: UserRole
  nickname?: string | null
}

export interface UpdateNicknameRequest {
  nickname: string | null
}

export interface ResetTemporaryPasswordRequest {
  temporaryPassword: string
}

export interface AccountApiResult<T> {
  success: boolean
  data: T | null
  message: string | null
}
