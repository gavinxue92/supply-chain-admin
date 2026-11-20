import { defineComponent } from 'vue'
import { flushPromises, mount } from '@vue/test-utils'
import ElementPlus from 'element-plus'
import { createPinia, setActivePinia } from 'pinia'
import { createMemoryHistory, createRouter } from 'vue-router'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import AppLayout from '../src/views/AppLayout.vue'
import { useAuthStore } from '../src/stores/auth'

describe('登录后布局', () => {
  const Placeholder = defineComponent({ template: '<div>内容区</div>' })

  function createTestRouter() {
    return createRouter({
      history: createMemoryHistory(),
      routes: [
        { path: '/', name: 'home', component: Placeholder, meta: { title: '首页' } },
        { path: '/products', name: 'products', component: Placeholder, meta: { title: '产品管理' } },
        { path: '/categories', name: 'categories', component: Placeholder, meta: { title: '分类管理' } },
        { path: '/contact', name: 'contact', component: Placeholder, meta: { title: '客服配置' } },
        { path: '/accounts', name: 'accounts', component: Placeholder, meta: { title: '账号管理' } },
      ],
    })
  }

  beforeEach(() => {
    localStorage.clear()
    document.documentElement.classList.remove('dark')
  })

  afterEach(() => {
    localStorage.clear()
    document.documentElement.classList.remove('dark')
  })

  it('按设计展示顶栏与侧边菜单，收起后仅保留图标，并可切换深色模式', async () => {
    const pinia = createPinia()
    setActivePinia(pinia)
    const auth = useAuthStore()
    auth.restoreSession({
      username: 'admin',
      nickname: '本地管理员',
      role: 'ADMIN',
      mustChangePassword: false,
    })

    const router = createTestRouter()
    await router.push('/products')
    await router.isReady()

    const wrapper = mount(AppLayout, {
      global: { plugins: [pinia, ElementPlus, router] },
    })
    await flushPromises()

    expect(wrapper.text()).toContain('供应链管理')
    expect(wrapper.text()).toContain('本地管理员')
    expect(wrapper.text()).toContain('管理员')
    expect(wrapper.text()).not.toContain('修改昵称')
    expect(wrapper.text()).toContain('产品管理')
    expect(wrapper.text()).toContain('分类管理')
    expect(wrapper.text()).toContain('客服配置')
    expect(wrapper.text()).toContain('账号管理')
    expect(wrapper.text()).toContain('深色模式')
    expect(wrapper.text()).toContain('收起')
    expect(wrapper.find('.app-aside').classes()).not.toContain('is-collapsed')

    await wrapper.get('.user-trigger').trigger('click')
    await flushPromises()
    expect(wrapper.find('.user-dropdown').exists()).toBe(true)
    expect(wrapper.find('.dropdown-profile').text()).toContain('admin')
    expect(wrapper.text()).toContain('修改昵称')
    expect(wrapper.text()).toContain('退出登录')
    expect(wrapper.find('.dropdown-item.is-danger').text()).toContain('退出登录')
    await wrapper.get('.user-trigger').trigger('click')
    await flushPromises()
    expect(wrapper.find('.user-dropdown').exists()).toBe(false)

    const collapseButton = wrapper.findAll('button').find((button) => button.text() === '收起')
    await collapseButton?.trigger('click')
    await flushPromises()

    expect(wrapper.find('.app-aside').classes()).toContain('is-collapsed')
    expect(wrapper.find('.header-brand').classes()).toContain('is-collapsed')
    expect(wrapper.findAll('.nav-label')).toHaveLength(0)
    expect(wrapper.findAll('.app-aside .app-icon').length).toBeGreaterThan(0)

    await wrapper.get('button[title="切换深色模式"]').trigger('click')
    await flushPromises()
    expect(document.documentElement.classList.contains('dark')).toBe(true)
    expect(localStorage.getItem('supply-chain-admin-theme')).toBe('dark')

    await wrapper.get('button[title="展开侧边栏"]').trigger('click')
    await flushPromises()
    expect(wrapper.find('.app-aside').classes()).not.toContain('is-collapsed')
    expect(wrapper.text()).toContain('产品管理')

    wrapper.unmount()
  })
})
