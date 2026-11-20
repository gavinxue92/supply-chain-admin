import { beforeEach, describe, expect, it } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { createRouter, createMemoryHistory } from 'vue-router'

import { useAuthStore } from '../src/stores/auth'
import { createAppRouter } from '../src/router'

describe('路由守卫', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  it('未登录用户访问后台时跳转登录页', async () => {
    const router = createAppRouter(createMemoryHistory())
    await router.push('/products')
    await router.isReady()

    expect(router.currentRoute.value.name).toBe('login')
  })

  it('EDITOR 无权访问账号管理页面', async () => {
    const store = useAuthStore()
    store.restoreSession({
      username: 'editor',
      nickname: null,
      role: 'EDITOR',
      mustChangePassword: false,
    })

    const router = createAppRouter(createMemoryHistory())
    await router.push('/accounts')
    await router.isReady()

    expect(router.currentRoute.value.name).toBe('home')
  })

  it('EDITOR 无权访问客服配置页面并收到 403 提示', async () => {
    const store = useAuthStore()
    store.restoreSession({
      username: 'editor',
      nickname: null,
      role: 'EDITOR',
      mustChangePassword: false,
    })

    const router = createAppRouter(createMemoryHistory())
    await router.push('/contact')
    await router.isReady()

    expect(router.currentRoute.value.name).toBe('home')
    expect(document.body.textContent).toContain('403')
  })

  it('ADMIN 可进入客服配置页面', async () => {
    const store = useAuthStore()
    store.restoreSession({
      username: 'admin',
      nickname: null,
      role: 'ADMIN',
      mustChangePassword: false,
    })

    const router = createAppRouter(createMemoryHistory())
    await router.push('/contact')
    await router.isReady()

    expect(router.currentRoute.value.name).toBe('contact')
  })

  it('ADMIN 可进入账号管理页面', async () => {
    const store = useAuthStore()
    store.restoreSession({
      username: 'admin',
      nickname: null,
      role: 'ADMIN',
      mustChangePassword: false,
    })

    const router = createAppRouter(createMemoryHistory())
    await router.push('/accounts')
    await router.isReady()

    expect(router.currentRoute.value.name).toBe('accounts')
  })
})
