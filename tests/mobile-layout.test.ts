import { defineComponent } from 'vue'
import { flushPromises, mount } from '@vue/test-utils'
import ElementPlus from 'element-plus'
import { createPinia, setActivePinia } from 'pinia'
import { createMemoryHistory, createRouter } from 'vue-router'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('../src/api/product', () => ({
  listProducts: vi.fn(),
  getProduct: vi.fn(),
  createProduct: vi.fn(),
  updateProduct: vi.fn(),
  publishProduct: vi.fn(),
  unpublishProduct: vi.fn(),
  archiveProduct: vi.fn(),
  restoreProduct: vi.fn(),
  deleteProduct: vi.fn(),
}))

vi.mock('../src/api/category', () => ({
  listCategories: vi.fn(),
  createCategory: vi.fn(),
  updateCategory: vi.fn(),
  setCategoryStatus: vi.fn(),
  deleteCategory: vi.fn(),
}))

vi.mock('../src/api/contact', () => ({
  listCustomerServices: vi.fn(),
  getGlobalContact: vi.fn(),
  createCustomerService: vi.fn(),
  updateCustomerService: vi.fn(),
  setCustomerServiceActive: vi.fn(),
  deleteCustomerService: vi.fn(),
  saveGlobalContact: vi.fn(),
}))

import * as productApi from '../src/api/product'
import * as categoryApi from '../src/api/category'
import * as contactApi from '../src/api/contact'
import { useAuthStore } from '../src/stores/auth'
import AppLayout from '../src/views/AppLayout.vue'
import ProductView from '../src/views/ProductView.vue'
import CategoryView from '../src/views/CategoryView.vue'
import ContactView from '../src/views/ContactView.vue'

/**
 * 手机断点相关行为。
 *
 * jsdom 默认没有 matchMedia（composable 会退回 innerWidth=1024，即桌面），
 * 这里显式 stub 成命中 (max-width: 899px)，用来断言窄屏分支。
 */
function stubViewport(mobile: boolean) {
  const matches = mobile
  vi.stubGlobal(
    'matchMedia',
    vi.fn().mockImplementation((query: string) => ({
      matches,
      media: query,
      onchange: null,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      addListener: vi.fn(),
      removeListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })),
  )
}

describe('手机端适配', () => {
  beforeEach(() => {
    localStorage.clear()
    setActivePinia(createPinia())
    vi.mocked(categoryApi.listCategories).mockResolvedValue([])
    vi.mocked(contactApi.listCustomerServices).mockResolvedValue([])
    vi.mocked(contactApi.getGlobalContact).mockResolvedValue({ id: 1, services: [] })
    vi.mocked(productApi.listProducts).mockResolvedValue([])
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
    localStorage.clear()
  })

  it('窄屏下侧边栏变成抽屉，点汉堡打开、点遮罩关闭，且不再出现"收起"按钮', async () => {
    stubViewport(true)
    const Placeholder = defineComponent({ template: '<div>内容区</div>' })
    const router = createRouter({
      history: createMemoryHistory(),
      routes: [
        { path: '/', name: 'home', component: Placeholder, meta: { title: '首页' } },
        { path: '/products', name: 'products', component: Placeholder, meta: { title: '产品管理' } },
      ],
    })
    await router.push('/products')
    await router.isReady()

    const auth = useAuthStore()
    auth.restoreSession({
      username: 'admin',
      nickname: '本地管理员',
      role: 'ADMIN',
      mustChangePassword: false,
    })

    const wrapper = mount(AppLayout, {
      global: { plugins: [ElementPlus, router] },
    })
    await flushPromises()

    const aside = wrapper.get('.app-aside')
    expect(aside.classes()).toContain('is-drawer')
    expect(aside.classes()).not.toContain('is-open')
    // 抽屉里的菜单必须始终显示文字，不能因为之前桌面收起过就变成纯图标
    expect(wrapper.text()).toContain('产品管理')
    // 手机上"收起侧边栏"没有意义，不应该渲染
    expect(wrapper.findAll('button').some((button) => button.text() === '收起')).toBe(false)

    await wrapper.get('.drawer-toggle').trigger('click')
    await flushPromises()
    expect(wrapper.get('.app-aside').classes()).toContain('is-open')
    expect(wrapper.find('.aside-scrim').exists()).toBe(true)

    await wrapper.get('.aside-scrim').trigger('click')
    await flushPromises()
    expect(wrapper.get('.app-aside').classes()).not.toContain('is-open')
    expect(wrapper.find('.aside-scrim').exists()).toBe(false)

    wrapper.unmount()
  })

  it('窄屏下产品列表渲染卡片而不是横向滚动的表格', async () => {
    stubViewport(true)
    vi.mocked(productApi.listProducts).mockResolvedValue([
      {
        id: 21,
        status: 'PUBLISHED',
        name: '手机端商品',
        categoryId: null,
        detailText: '',
        mainImageMediaId: null,
        galleryMediaIds: [],
        keywords: [],
        contactMode: 'INHERIT',
        contactServiceIds: [],
        sortOrder: 0,
        specifications: [],
      },
    ])

    const wrapper = mount(ProductView, { global: { plugins: [ElementPlus] } })
    await flushPromises()

    expect(wrapper.find('.product-cards').exists()).toBe(true)
    expect(wrapper.find('.el-table').exists()).toBe(false)

    const card = wrapper.get('.product-card')
    expect(card.text()).toContain('手机端商品')
    expect(card.text()).toContain('#21')
    // 操作仍然可用：已上架产品的卡片上应该有"下架"
    expect(card.findAll('button').some((button) => button.text() === '下架')).toBe(true)

    wrapper.unmount()
  })

  it('窄屏下分类列表渲染卡片并保留展开子分类的入口', async () => {
    stubViewport(true)
    vi.mocked(categoryApi.listCategories).mockResolvedValue([
      { id: 1, name: '生鲜', parentId: null, sortOrder: 0, active: true },
      { id: 2, name: '水果', parentId: 1, sortOrder: 0, active: true },
    ])

    const wrapper = mount(CategoryView, { global: { plugins: [ElementPlus] } })
    await flushPromises()

    expect(wrapper.find('.category-cards').exists()).toBe(true)
    expect(wrapper.find('.el-table').exists()).toBe(false)
    expect(wrapper.get('.category-card').text()).toContain('生鲜')

    const expand = wrapper
      .findAll('button')
      .find((button) => button.text().includes('生鲜'))
    await expand?.trigger('click')
    await flushPromises()
    expect(wrapper.findAll('.category-card')).toHaveLength(2)

    wrapper.unmount()
  })

  it('窄屏下客服列表渲染卡片，关键字段与操作都保留', async () => {
    stubViewport(true)
    vi.mocked(contactApi.listCustomerServices).mockResolvedValue([
      {
        id: 7,
        displayName: '小王',
        wechatId: 'wx-xiaowang',
        phone: '13800000000',
        qrMediaId: null,
        qrImageUrl: null,
        active: true,
      },
    ])

    const wrapper = mount(ContactView, { global: { plugins: [ElementPlus] } })
    await flushPromises()

    expect(wrapper.find('.contact-cards').exists()).toBe(true)
    expect(wrapper.find('.el-table').exists()).toBe(false)

    const card = wrapper.get('.contact-mobile-card')
    expect(card.text()).toContain('小王')
    expect(card.text()).toContain('wx-xiaowang')
    expect(card.text()).toContain('13800000000')
    expect(card.findAll('button').map((button) => button.text())).toEqual([
      '编辑',
      '停用',
      '硬删除',
    ])

    wrapper.unmount()
  })
})
