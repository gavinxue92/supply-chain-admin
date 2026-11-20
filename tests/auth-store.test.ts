import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'

vi.mock('../src/api/auth', () => ({
  getCsrfToken: vi.fn().mockResolvedValue('csrf-token'),
  login: vi.fn(),
  logout: vi.fn(),
  changePassword: vi.fn(),
  getCurrentUser: vi.fn(),
}))
vi.mock('../src/api/account', () => ({
  updateMyNickname: vi.fn(),
}))

import { updateMyNickname } from '../src/api/account'
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
      nickname: null,
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
      nickname: null,
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

  it('拒绝超过 200 个字符的新密码且不发起改密请求', async () => {
    vi.mocked(login).mockResolvedValue({
      username: 'editor',
      nickname: null,
      role: 'EDITOR',
      mustChangePassword: true,
    })
    vi.mocked(getCsrfToken).mockResolvedValue('csrf-token')

    const store = useAuthStore()
    await store.login('editor', 'temporary-password')

    await expect(store.changePassword('a'.repeat(201))).rejects.toThrow('新密码长度必须为 12 至 200 个字符')
    expect(changePassword).not.toHaveBeenCalled()
  })

  it('管理员和编辑均可维护本人昵称并同步到会话状态', async () => {
    vi.mocked(login).mockResolvedValue({
      username: 'editor',
      nickname: null,
      role: 'EDITOR',
      mustChangePassword: false,
    })
    vi.mocked(updateMyNickname).mockResolvedValue({
      id: 2,
      username: 'editor',
      nickname: '小编辑',
      role: 'EDITOR',
      active: true,
      mustChangePassword: false,
      createdAt: '2026-01-01T00:00:00Z',
    })

    const store = useAuthStore()
    await store.login('editor', 'secret-password')
    await store.updateNickname('小编辑')

    expect(updateMyNickname).toHaveBeenCalledWith({ nickname: '小编辑' })
    expect(store.nickname).toBe('小编辑')
    expect(store.displayName).toBe('小编辑')
  })

  it('退出后清除用户和角色', async () => {
    vi.mocked(login).mockResolvedValue({
      username: 'admin',
      nickname: null,
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
