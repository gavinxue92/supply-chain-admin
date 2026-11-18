export type UserRole = 'ADMIN' | 'EDITOR'

export interface SessionUser {
  username: string
  role: UserRole
  mustChangePassword: boolean
}

export interface LoginRequest {
  username: string
  password: string
}

export interface ChangePasswordRequest {
  newPassword: string
}
