import { flushPromises, mount } from '@vue/test-utils'
import ElementPlus, { ElMessageBox } from 'element-plus'
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
}))
vi.mock('../src/api/category', () => ({
  listCategories: vi.fn(),
  createCategory: vi.fn(),
  updateCategory: vi.fn(),
  setCategoryStatus: vi.fn(),
  deleteCategory: vi.fn(),
}))

import * as productApi from '../src/api/product'
import * as categoryApi from '../src/api/category'
import { useAuthStore } from '../src/stores/auth'
import ProductView from '../src/views/ProductView.vue'

describe('产品管理页面', () => {
  const wrappers: ReturnType<typeof mount>[] = []

  async function confirmAction() {
    const buttons = document.body.querySelectorAll<HTMLButtonElement>(
      '.el-message-box__btns .el-button--primary',
    )
    const confirmButton = buttons.item(buttons.length - 1)
    expect(confirmButton).not.toBeNull()
    confirmButton?.click()
    await flushPromises()
  }

  beforeEach(() => {
    setActivePinia(createPinia())
    useAuthStore().restoreSession({
      username: 'admin',
      role: 'ADMIN',
      mustChangePassword: false,
    })
    vi.resetAllMocks()
    vi.mocked(productApi.listProducts).mockResolvedValue([])
    vi.mocked(categoryApi.listCategories).mockResolvedValue([])
  })

  afterEach(() => {
    wrappers.forEach((wrapper) => wrapper.unmount())
    wrappers.length = 0
    document.body.innerHTML = ''
    vi.restoreAllMocks()
  })

  it('按后端原始顺序展示产品及四种状态', async () => {
    vi.mocked(productApi.listProducts).mockResolvedValue([
      {
        id: 21,
        status: 'PUBLISHED',
        name: '先上架的产品',
        categoryId: null,
        detailText: '',
        mainImageMediaId: null,
        galleryMediaIds: [],
        keywords: [],
        contactMode: 'INHERIT',
        contactWechatId: null,
        contactQrMediaId: null,
        sortOrder: 0,
        specifications: [],
      },
      {
        id: 22,
        status: 'DRAFT',
        name: '后创建的草稿',
        categoryId: null,
        detailText: '',
        mainImageMediaId: null,
        galleryMediaIds: [],
        keywords: [],
        contactMode: 'INHERIT',
        contactWechatId: null,
        contactQrMediaId: null,
        sortOrder: 0,
        specifications: [],
      },
      {
        id: 23,
        status: 'UNPUBLISHED',
        name: '已下架产品',
        categoryId: null,
        detailText: '',
        mainImageMediaId: null,
        galleryMediaIds: [],
        keywords: [],
        contactMode: 'DISABLED',
        contactWechatId: null,
        contactQrMediaId: null,
        sortOrder: 0,
        specifications: [],
      },
      {
        id: 24,
        status: 'ARCHIVED',
        name: '已归档产品',
        categoryId: null,
        detailText: '',
        mainImageMediaId: null,
        galleryMediaIds: [],
        keywords: [],
        contactMode: 'INHERIT',
        contactWechatId: null,
        contactQrMediaId: null,
        sortOrder: 0,
        specifications: [],
      },
    ])

    const wrapper = mount(ProductView, {
      global: { plugins: [ElementPlus] },
    })
    wrappers.push(wrapper)
    await flushPromises()

    const rows = wrapper.findAll('.el-table__body tr')
    expect(rows).toHaveLength(4)
    expect(rows.map((row) => row.text())).toEqual([
      expect.stringContaining('先上架的产品'),
      expect.stringContaining('后创建的草稿'),
      expect.stringContaining('已下架产品'),
      expect.stringContaining('已归档产品'),
    ])
    expect(rows.map((row) => row.text())).toEqual(
      expect.arrayContaining([
        expect.stringContaining('已上架'),
        expect.stringContaining('草稿'),
        expect.stringContaining('已下架'),
        expect.stringContaining('已归档'),
      ]),
    )
    expect(wrapper.text()).not.toContain('筛选')
    expect(wrapper.text()).not.toContain('排序')
  })

  it('创建草稿时提交完整替换内容和动态规格', async () => {
    const createdProduct = {
      id: 30,
      status: 'DRAFT' as const,
      name: '冷冻带鱼',
      categoryId: null,
      detailText: '<p>产品介绍</p>',
      mainImageMediaId: null,
      galleryMediaIds: [],
      keywords: ['带鱼', '冻带鱼'],
      contactMode: 'INHERIT' as const,
      contactWechatId: null,
      contactQrMediaId: null,
      sortOrder: 0,
      specifications: [{ id: 1, name: '500g', referencePrice: null, sortOrder: 0 }],
    }
    vi.mocked(productApi.listProducts)
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([createdProduct])
    vi.mocked(categoryApi.listCategories).mockResolvedValue([
      { id: 7, parentId: null, name: '水产', active: true, sortOrder: 0 },
    ])
    vi.mocked(productApi.createProduct).mockResolvedValue(createdProduct)

    const wrapper = mount(ProductView, {
      global: { plugins: [ElementPlus] },
    })
    wrappers.push(wrapper)
    await flushPromises()
    await wrapper.findAll('button').find((button) => button.text() === '新建产品草稿')?.trigger('click')
    await flushPromises()

    await wrapper.get('input[placeholder="请输入产品名称"]').setValue('冷冻带鱼')
    await wrapper.get('textarea[placeholder="每行输入一个关键词"]').setValue('带鱼\n冻带鱼')
    const editor = wrapper.get<HTMLElement>('[contenteditable="true"]')
    editor.element.innerHTML = '<p>产品介绍</p>'
    await editor.trigger('input')
    await wrapper.findAll('button').find((button) => button.text() === '添加规格')?.trigger('click')
    await flushPromises()
    await wrapper.get('input[placeholder="请输入规格名称"]').setValue('500g')
    await wrapper.findAll('button').find((button) => button.text() === '保存草稿')?.trigger('click')
    await flushPromises()

    expect(productApi.createProduct).toHaveBeenCalledWith({
      name: '冷冻带鱼',
      categoryId: null,
      detailText: '<p>产品介绍</p>',
      mainImageMediaId: null,
      galleryMediaIds: [],
      keywords: ['带鱼', '冻带鱼'],
      contactMode: 'INHERIT',
      contactWechatId: null,
      contactQrMediaId: null,
      sortOrder: 0,
      specifications: [{ name: '500g', referencePrice: null }],
    })
    expect(wrapper.text()).toContain('冷冻带鱼')
    expect(wrapper.text()).toContain('草稿创建成功')
  })

  it('新建产品只提供启用的末级分类', async () => {
    vi.mocked(categoryApi.listCategories).mockResolvedValue([
      { id: 1, parentId: null, name: '生鲜', active: true, sortOrder: 0 },
      { id: 2, parentId: 1, name: '水产', active: true, sortOrder: 0 },
      { id: 3, parentId: null, name: '饮品', active: true, sortOrder: 1 },
      { id: 4, parentId: null, name: '停用分类', active: false, sortOrder: 2 },
      { id: 5, parentId: 1, name: '停用子类', active: false, sortOrder: 1 },
    ])
    const wrapper = mount(ProductView, {
      global: { plugins: [ElementPlus] },
    })
    wrappers.push(wrapper)
    await flushPromises()
    await wrapper.findAll('button').find((button) => button.text() === '新建产品草稿')?.trigger('click')
    await flushPromises()
    await wrapper.get('.el-select__wrapper').trigger('click')
    await flushPromises()

    const options = Array.from(
      document.body.querySelectorAll('.el-select-dropdown__item'),
      (option) => option.textContent,
    )
    expect(options).toContain('水产')
    expect(options).toContain('饮品')
    expect(options).not.toContain('生鲜')
    expect(options).not.toContain('停用分类')
    expect(options).not.toContain('停用子类')
  })

  it('取消上架二次确认时不调用状态接口', async () => {
    vi.mocked(productApi.listProducts).mockResolvedValue([
      {
        id: 41,
        status: 'DRAFT',
        name: '待上架产品',
        categoryId: null,
        detailText: '',
        mainImageMediaId: null,
        galleryMediaIds: [],
        keywords: [],
        contactMode: 'INHERIT',
        contactWechatId: null,
        contactQrMediaId: null,
        sortOrder: 0,
        specifications: [],
      },
    ])
    vi.spyOn(ElMessageBox, 'confirm').mockRejectedValue('cancel')

    const wrapper = mount(ProductView, {
      global: { plugins: [ElementPlus] },
    })
    wrappers.push(wrapper)
    await flushPromises()
    await wrapper.findAll('button').find((button) => button.text() === '上架')?.trigger('click')
    await flushPromises()

    expect(ElMessageBox.confirm).toHaveBeenCalledWith(
      '上架“待上架产品”后将立即在小程序展示，是否继续？',
      '上架产品',
      expect.any(Object),
    )
    expect(productApi.publishProduct).not.toHaveBeenCalled()
    expect(wrapper.text()).toContain('草稿')
  })

  it('归档和恢复均二次确认并以服务端返回状态刷新列表', async () => {
    const publishedProduct = {
      id: 45,
      status: 'PUBLISHED' as const,
      name: '停售商品',
      categoryId: null,
      detailText: '',
      mainImageMediaId: null,
      galleryMediaIds: [],
      keywords: [],
      contactMode: 'INHERIT' as const,
      contactWechatId: null,
      contactQrMediaId: null,
      sortOrder: 0,
      specifications: [],
    }
    const archivedProduct = { ...publishedProduct, status: 'ARCHIVED' as const }
    const restoredProduct = { ...publishedProduct, status: 'UNPUBLISHED' as const }
    vi.mocked(productApi.listProducts)
      .mockResolvedValueOnce([publishedProduct])
      .mockResolvedValueOnce([archivedProduct])
      .mockResolvedValueOnce([restoredProduct])
    vi.mocked(productApi.archiveProduct).mockResolvedValue()
    vi.mocked(productApi.restoreProduct).mockResolvedValue()
    const confirmationSpy = vi.spyOn(ElMessageBox, 'confirm')
    const wrapper = mount(ProductView, {
      global: { plugins: [ElementPlus] },
    })
    wrappers.push(wrapper)
    await flushPromises()
    await wrapper.findAll('button').find((button) => button.text() === '归档')?.trigger('click')
    await flushPromises()
    await confirmAction()

    expect(confirmationSpy).toHaveBeenLastCalledWith(
      '归档“停售商品”后将无法普通编辑，只有管理员可以恢复。确定归档吗？',
      '归档产品',
      expect.any(Object),
    )
    expect(productApi.archiveProduct).toHaveBeenCalledWith(45)
    expect(wrapper.findAll('.el-table__body tr')[0].text()).toContain('已归档')

    await wrapper.findAll('button').find((button) => button.text() === '恢复')?.trigger('click')
    await flushPromises()
    await confirmAction()

    expect(confirmationSpy).toHaveBeenLastCalledWith(
      '恢复“停售商品”后将变为已下架状态，需要重新检查后才能上架。确定恢复吗？',
      '恢复产品',
      expect.any(Object),
    )
    expect(productApi.restoreProduct).toHaveBeenCalledWith(45)
    expect(wrapper.findAll('.el-table__body tr')[0].text()).toContain('已下架')
    expect(wrapper.text()).toContain('产品已恢复为已下架')
  })

  it('EDITOR 只看到当前状态允许的操作，不显示归档或恢复', async () => {
    useAuthStore().restoreSession({
      username: 'editor',
      role: 'EDITOR',
      mustChangePassword: false,
    })
    vi.mocked(productApi.listProducts).mockResolvedValue([
      {
        id: 51,
        status: 'DRAFT',
        name: '草稿产品',
        categoryId: null,
        detailText: '',
        mainImageMediaId: null,
        galleryMediaIds: [],
        keywords: [],
        contactMode: 'INHERIT',
        contactWechatId: null,
        contactQrMediaId: null,
        sortOrder: 0,
        specifications: [],
      },
      {
        id: 52,
        status: 'PUBLISHED',
        name: '上架产品',
        categoryId: null,
        detailText: '',
        mainImageMediaId: null,
        galleryMediaIds: [],
        keywords: [],
        contactMode: 'INHERIT',
        contactWechatId: null,
        contactQrMediaId: null,
        sortOrder: 0,
        specifications: [],
      },
      {
        id: 53,
        status: 'UNPUBLISHED',
        name: '下架产品',
        categoryId: null,
        detailText: '',
        mainImageMediaId: null,
        galleryMediaIds: [],
        keywords: [],
        contactMode: 'INHERIT',
        contactWechatId: null,
        contactQrMediaId: null,
        sortOrder: 0,
        specifications: [],
      },
      {
        id: 54,
        status: 'ARCHIVED',
        name: '归档产品',
        categoryId: null,
        detailText: '',
        mainImageMediaId: null,
        galleryMediaIds: [],
        keywords: [],
        contactMode: 'INHERIT',
        contactWechatId: null,
        contactQrMediaId: null,
        sortOrder: 0,
        specifications: [],
      },
    ])

    const wrapper = mount(ProductView, {
      global: { plugins: [ElementPlus] },
    })
    wrappers.push(wrapper)
    await flushPromises()

    const rows = wrapper.findAll('.el-table__body tr')
    expect(rows).toHaveLength(4)
    const actions = rows.map((row) =>
      row.findAll('button').map((button) => button.text()),
    )
    expect(actions[0]).toEqual(['编辑', '上架'])
    expect(actions[1]).toEqual(['编辑', '下架'])
    expect(actions[2]).toEqual(['编辑', '上架'])
    expect(actions[3]).toEqual([])
  })

  it('更新产品失败时保留完整表单输入并显示后端原因', async () => {
    const draft = {
      id: 61,
      status: 'DRAFT' as const,
      name: '原产品名',
      categoryId: null,
      detailText: '<p>原详情</p>',
      mainImageMediaId: null,
      galleryMediaIds: [],
      keywords: ['旧关键词'],
      contactMode: 'INHERIT' as const,
      contactWechatId: null,
      contactQrMediaId: null,
      sortOrder: 2,
      specifications: [{ id: 1, name: '500g', referencePrice: 18.5, sortOrder: 0 }],
    }
    vi.mocked(productApi.listProducts).mockResolvedValue([draft])
    vi.mocked(productApi.getProduct).mockResolvedValue(draft)
    vi.mocked(productApi.updateProduct).mockRejectedValue(
      Object.assign(new Error('Invalid product'), {
        isAxiosError: true,
        response: {
          status: 400,
          data: { success: false, data: null, message: '该分类当前不可用于产品' },
        },
      }),
    )
    const wrapper = mount(ProductView, {
      global: { plugins: [ElementPlus] },
    })
    wrappers.push(wrapper)
    await flushPromises()
    await wrapper.findAll('button').find((button) => button.text() === '编辑')?.trigger('click')
    await flushPromises()
    await wrapper.get('input[placeholder="请输入产品名称"]').setValue('修改后的产品名')
    await wrapper.findAll('button').find((button) => button.text() === '保存产品')?.trigger('click')
    await flushPromises()

    expect(productApi.updateProduct).toHaveBeenCalledWith(61, {
      name: '修改后的产品名',
      categoryId: null,
      detailText: '<p>原详情</p>',
      mainImageMediaId: null,
      galleryMediaIds: [],
      keywords: ['旧关键词'],
      contactMode: 'INHERIT',
      contactWechatId: null,
      contactQrMediaId: null,
      sortOrder: 2,
      specifications: [{ name: '500g', referencePrice: 18.5 }],
    })
    expect(wrapper.text()).toContain('该分类当前不可用于产品')
    expect(wrapper.find<HTMLInputElement>('input[placeholder="请输入产品名称"]').element.value)
      .toBe('修改后的产品名')
  })

  it('编辑已上架产品需确认，保存后立即显示后端生效状态', async () => {
    const publishedProduct = {
      id: 71,
      status: 'PUBLISHED' as const,
      name: '当前商品',
      categoryId: null,
      detailText: '<p>商品详情</p>',
      mainImageMediaId: null,
      galleryMediaIds: [],
      keywords: [],
      contactMode: 'INHERIT' as const,
      contactWechatId: null,
      contactQrMediaId: null,
      sortOrder: 0,
      specifications: [],
    }
    const updatedProduct = { ...publishedProduct, name: '修改后商品' }
    vi.mocked(productApi.listProducts)
      .mockResolvedValueOnce([publishedProduct])
      .mockResolvedValueOnce([updatedProduct])
    vi.mocked(productApi.getProduct).mockResolvedValue(publishedProduct)
    vi.mocked(productApi.updateProduct).mockResolvedValue(updatedProduct)
    const confirmationSpy = vi.spyOn(ElMessageBox, 'confirm')
    const wrapper = mount(ProductView, {
      global: { plugins: [ElementPlus] },
    })
    wrappers.push(wrapper)
    await flushPromises()
    await wrapper.findAll('button').find((button) => button.text() === '编辑')?.trigger('click')
    await flushPromises()
    await confirmAction()

    expect(confirmationSpy).toHaveBeenCalledWith(
      '保存“当前商品”会立即影响小程序展示，是否继续编辑？',
      '编辑已上架产品',
      expect.any(Object),
    )
    await wrapper.get('input[placeholder="请输入产品名称"]').setValue('修改后商品')
    await wrapper.findAll('button').find((button) => button.text() === '保存产品')?.trigger('click')
    await flushPromises()

    expect(productApi.updateProduct).toHaveBeenCalledWith(71, {
      name: '修改后商品',
      categoryId: null,
      detailText: '<p>商品详情</p>',
      mainImageMediaId: null,
      galleryMediaIds: [],
      keywords: [],
      contactMode: 'INHERIT',
      contactWechatId: null,
      contactQrMediaId: null,
      sortOrder: 0,
      specifications: [],
    })
    expect(productApi.publishProduct).not.toHaveBeenCalled()
    expect(wrapper.text()).toContain('产品保存成功，已立即生效')
    expect(wrapper.text()).toContain('已上架')
    expect(wrapper.text()).not.toContain('发布版本')
  })
})
