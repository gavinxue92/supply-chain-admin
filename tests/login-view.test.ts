import { flushPromises, mount } from '@vue/test-utils'
import ElementPlus from 'element-plus'
import { createPinia } from 'pinia'
import { createMemoryHistory } from 'vue-router'
import { describe, expect, it } from 'vitest'
import { createAppRouter } from '../src/router'
import LoginView from '../src/views/LoginView.vue'

describe('登录主页', () => {
  it('按设计展示品牌标题、插画和登录表单，且不展示管理员入口与生成水印', async () => {
    const wrapper = mount(LoginView, {
      global: {
        plugins: [createPinia(), ElementPlus, createAppRouter(createMemoryHistory())],
      },
    })
    await flushPromises()

    expect(wrapper.text()).toContain('食材供应链管理平台')
    expect(wrapper.text()).toContain('帮助中心')
    expect(wrapper.text()).toContain('账号登录')
    expect(wrapper.text()).toContain('供应商管理 · 采购订单 · 库存质检 · 配送追踪')
    expect(wrapper.text()).toContain('首次登录请修改初始密码')
    expect(wrapper.find('.login-showcase svg').exists()).toBe(true)
    expect(wrapper.find('input[placeholder="企业账号"]').exists()).toBe(true)
    expect(wrapper.find('input[placeholder="密码"]').exists()).toBe(true)

    expect(wrapper.text()).not.toContain('管理员入口')
    expect(wrapper.text()).not.toContain('豆包')
    expect(wrapper.text()).not.toContain('AI生成')

    wrapper.unmount()
  })
})
