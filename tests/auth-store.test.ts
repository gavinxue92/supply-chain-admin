import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'

vi.mock('../src/api/auth', () => ({
  getCsrfToken: vi.fn().mockResolvedValue('csrf-token'),
  login: vi.fn(),
  logout: vi.fn(),
  changePassword: vi.fn(),
  getCurrentUser: vi.fn(),
}))

import { login, logout, changePassword, getCsrfToken } from '../src/api/auth'
import { useAuthStore } from '../src/stores/auth'

describe('认证 Store', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.clearAllMocks()
  })

  it('用户登录后初始化角色并记录首次改密状态', async () => {
    vi.mocked(login).mockResolvedValue({
      username: 'admin',
      role: 'ADMIN',
      mustChangePassword: true,
    })

    const store = useAuthStore()
    await store.login('admin', 'secret-password')

    expect(store.isAuthenticated).toBe(true)
    expect(store.role).toBe('ADMIN')
    expect(store.mustChangePassword).toBe(true)
  })

  it('改密成功后清除登录状态', async () => {
    vi.mocked(login).mockResolvedValue({
      username: 'editor',
      role: 'EDITOR',
      mustChangePassword: true,
    })
    vi.mocked(changePassword).mockResolvedValue()
    vi.mocked(getCsrfToken).mockResolvedValue('csrf-token')

    const store = useAuthStore()
    await store.login('editor', 'temporary-password')
    await store.changePassword('new-password')

    expect(store.isAuthenticated).toBe(false)
    expect(store.mustChangePassword).toBe(false)
  })

  it('退出后清除用户和角色', async () => {
    vi.mocked(login).mockResolvedValue({
      username: 'admin',
      role: 'ADMIN',
      mustChangePassword: false,
    })
    vi.mocked(logout).mockResolvedValue()

    const store = useAuthStore()
    await store.login('admin', 'secret-password')
    await store.logout()

    expect(store.isAuthenticated).toBe(false)
    expect(store.role).toBeNull()
  })
})
