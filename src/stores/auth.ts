import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import * as accountApi from '../api/account'
import * as authApi from '../api/auth'
import type { SessionUser, UserRole } from '../types/auth'

export const useAuthStore = defineStore('auth', () => {
  const username = ref<string | null>(null)
  const nickname = ref<string | null>(null)
  const role = ref<UserRole | null>(null)
  const mustChangePassword = ref(false)

  const isAuthenticated = computed(() => role.value !== null)
  const displayName = computed(() => nickname.value || username.value || '')

  function restoreSession(user: SessionUser) {
    username.value = user.username
    nickname.value = user.nickname ?? null
    role.value = user.role
    mustChangePassword.value = user.mustChangePassword
  }

  function clearSession() {
    username.value = null
    nickname.value = null
    role.value = null
    mustChangePassword.value = false
  }

  async function updateNickname(value: string | null) {
    const account = await accountApi.updateMyNickname({ nickname: value })
    nickname.value = account.nickname
  }

  async function login(usernameValue: string, password: string) {
    await authApi.getCsrfToken()
    const user = await authApi.login({ username: usernameValue, password })
    restoreSession(user)
  }

  async function logout() {
    try {
      await authApi.logout()
    } finally {
      clearSession()
    }
  }

  async function changePassword(newPassword: string) {
    if (newPassword.length < 12 || newPassword.length > 200) {
      throw new Error('新密码长度必须为 12 至 200 个字符')
    }
    await authApi.changePassword({ newPassword })
    clearSession()
  }

  async function restoreFromServer() {
    try {
      await authApi.getCsrfToken()
      const user = await authApi.getCurrentUser()
      restoreSession(user)
      return true
    } catch {
      clearSession()
      return false
    }
  }

  return {
    username,
    nickname,
    displayName,
    role,
    mustChangePassword,
    isAuthenticated,
    restoreSession,
    clearSession,
    updateNickname,
    login,
    logout,
    changePassword,
    restoreFromServer,
  }
})
