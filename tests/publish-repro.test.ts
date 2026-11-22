import { flushPromises, mount } from '@vue/test-utils'
import ElementPlus from 'element-plus'
import { createPinia, setActivePinia } from 'pinia'
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
vi.mock('../src/api/contact', () => ({ listCustomerServices: vi.fn() }))

import * as productApi from '../src/api/product'
import * as categoryApi from '../src/api/category'
import * as contactApi from '../src/api/contact'
import { useAuthStore } from '../src/stores/auth'
import type { ProductVO } from '../src/types/product'
import ProductForm from '../src/components/ProductForm.vue'
import ProductView from '../src/views/ProductView.vue'

describe('产品规格提交回归', () => {
  const wrappers: ReturnType<typeof mount>[] = []

  function product(overrides: Partial<ProductVO> = {}): ProductVO {
    return {
      id: 4,
      status: 'DRAFT',
      name: '小胖牌毛肚',
      categoryId: 6,
      detailText: '<p>详情</p>',
      mainImageMediaId: 10,
      galleryMediaIds: [],
      keywords: ['毛肚'],
      contactMode: 'OVERRIDE',
      contactServiceIds: [301],
      sortOrder: 0,
      specifications: [],
      ...overrides,
    }
  }

  beforeEach(() => {
    setActivePinia(createPinia())
    useAuthStore().restoreSession({
      username: 'admin', nickname: null, role: 'ADMIN', mustChangePassword: false,
    })
    vi.resetAllMocks()
    vi.mocked(productApi.listProducts).mockResolvedValue([])
    vi.mocked(categoryApi.listCategories).mockResolvedValue([])
    vi.mocked(contactApi.listCustomerServices).mockResolvedValue([])
  })

  afterEach(() => {
    wrappers.forEach((wrapper) => wrapper.unmount())
    wrappers.length = 0
    document.body.innerHTML = ''
  })

  it('form submit includes a spec that user added', async () => {
    const wrapper = mount(ProductForm, {
      props: {
        product: product(),
        categories: [],
        customerServices: [
          { id: 301, displayName: '陈宇', wechatId: 'chenyu', qrMediaId: null,
            qrImageUrl: null, phone: null, active: true },
        ],
      },
      global: { plugins: [ElementPlus] },
    })
    wrappers.push(wrapper)
    await flushPromises()
    await wrapper.findAll('button').find((b) => b.text() === '添加规格')?.trigger('click')
    await flushPromises()
    await wrapper.get('input[placeholder="请输入规格名称"]').setValue('500g')
    await flushPromises()
    await wrapper.findAll('button').find((b) => b.text() === '保存产品')?.trigger('click')
    await flushPromises()
    expect(wrapper.emitted('save')?.[0]?.[0]).toMatchObject({
      specifications: [{ name: '500g', referencePrice: null }],
    })
  })

  it('inline contact save preserves specs from list row', async () => {
    const withSpec = product({
      specifications: [{ id: 1, name: '500g', referencePrice: null, sortOrder: 0 }],
    })
    vi.mocked(productApi.listProducts).mockResolvedValue([withSpec])
    vi.mocked(contactApi.listCustomerServices).mockResolvedValue([
      { id: 301, displayName: '陈宇', wechatId: 'chenyu', qrMediaId: null,
        qrImageUrl: null, phone: null, active: true },
    ])
    vi.mocked(productApi.updateProduct).mockResolvedValue(withSpec)

    const wrapper = mount(ProductView, { global: { plugins: [ElementPlus] } })
    wrappers.push(wrapper)
    await flushPromises()
    const row = wrapper.findAll('.el-table__body tr')[0]
    await row.findAll('button').find((b) => b.text() === '陈宇')?.trigger('click')
    await flushPromises()
    await wrapper.findAll('button').find((b) => b.text() === '保存')?.trigger('click')
    await flushPromises()
    expect(productApi.updateProduct).toHaveBeenCalledWith(4, expect.objectContaining({
      specifications: [{ name: '500g', referencePrice: null }],
    }))
  })
})
