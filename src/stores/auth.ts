import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import * as authApi from '../api/auth'
import type { SessionUser, UserRole } from '../types/auth'

export const useAuthStore = defineStore('auth', () => {
  const username = ref<string | null>(null)
  const role = ref<UserRole | null>(null)
  const mustChangePassword = ref(false)

  const isAuthenticated = computed(() => role.value !== null)

  function restoreSession(user: SessionUser) {
    username.value = user.username
    role.value = user.role
    mustChangePassword.value = user.mustChangePassword
  }

  function clearSession() {
    username.value = null
    role.value = null
    mustChangePassword.value = false
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
    role,
    mustChangePassword,
    isAuthenticated,
    restoreSession,
    clearSession,
    login,
    logout,
    changePassword,
    restoreFromServer,
  }
})
