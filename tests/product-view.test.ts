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
}))

import * as productApi from '../src/api/product'
import * as categoryApi from '../src/api/category'
import * as contactApi from '../src/api/contact'
import { useAuthStore } from '../src/stores/auth'
import type { ProductVO } from '../src/types/product'
import ProductForm from '../src/components/ProductForm.vue'
import ProductView from '../src/views/ProductView.vue'

describe('产品管理页面', () => {
  const wrappers: ReturnType<typeof mount>[] = []

  function product(overrides: Partial<ProductVO> = {}): ProductVO {
    return {
      id: 1,
      status: 'DRAFT',
      name: '产品',
      categoryId: null,
      detailText: '',
      mainImageMediaId: null,
      galleryMediaIds: [],
      keywords: [],
      contactMode: 'INHERIT',
      contactServiceIds: [],
      sortOrder: 0,
      specifications: [],
      ...overrides,
    }
  }

  async function selectOption(wrapper: ReturnType<typeof mount>, index: number, label: string) {
    const wrappers = wrapper.findAll('.product-filter .el-select__wrapper')
    expect(wrappers.length).toBeGreaterThan(index)
    await wrappers[index].trigger('click')
    await flushPromises()
    const option = Array.from(
      document.body.querySelectorAll<HTMLElement>(
        '.product-filter-popper .el-select-dropdown__item',
      ),
    ).find((item) => item.textContent?.trim() === label)
    expect(option).toBeDefined()
    option?.click()
    await flushPromises()
  }

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
      nickname: null,
      role: 'ADMIN',
      mustChangePassword: false,
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
        contactServiceIds: [],
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
        contactServiceIds: [],
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
        contactServiceIds: [],
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
        contactServiceIds: [],
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
    expect(wrapper.find('input[placeholder="搜索产品名称或关键词"]').exists()).toBe(true)
    expect(wrapper.findAll('.product-filter .el-select__wrapper')).toHaveLength(2)
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
      contactServiceIds: [],
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
      contactServiceIds: [],
      sortOrder: 0,
      specifications: [{ name: '500g', referencePrice: null }],
    })
    expect(wrapper.text()).toContain('冷冻带鱼')
    expect(wrapper.text()).toContain('草稿创建成功')
  })

  it('新建产品按一级分类级联选择二级分类', async () => {
    const wrapper = mount(ProductForm, {
      props: {
        product: null,
        categories: [
          { id: 1, parentId: null, name: '生鲜', active: true, sortOrder: 0 },
          { id: 2, parentId: 1, name: '水产', active: true, sortOrder: 0 },
          { id: 3, parentId: null, name: '饮品', active: true, sortOrder: 1 },
          { id: 4, parentId: null, name: '停用分类', active: false, sortOrder: 2 },
          { id: 5, parentId: 1, name: '停用子类', active: false, sortOrder: 1 },
        ],
      },
      global: { plugins: [ElementPlus] },
    })
    wrappers.push(wrapper)
    await flushPromises()

    await wrapper.findAll('.el-select__wrapper')[0].trigger('click')
    await flushPromises()
    let labels = Array.from(
      document.body.querySelectorAll('.product-form-root-popper .el-select-dropdown__item'),
      (option) => option.textContent ?? '',
    )
    expect(labels.some((label) => label.includes('生鲜'))).toBe(true)
    expect(labels.some((label) => label.includes('饮品'))).toBe(true)
    expect(labels.some((label) => label.includes('停用分类'))).toBe(true)
    expect(labels.some((label) => label.includes('水产'))).toBe(false)

    const rootOption = Array.from(
      document.body.querySelectorAll('.product-form-root-popper .el-select-dropdown__item'),
    ).find((option) => option.textContent?.includes('生鲜'))
    rootOption?.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    await flushPromises()

    await wrapper.findAll('.el-select__wrapper')[1].trigger('click')
    await flushPromises()
    labels = Array.from(
      document.body.querySelectorAll('.product-form-second-popper .el-select-dropdown__item'),
      (option) => option.textContent ?? '',
    )
    expect(labels.some((label) => label.includes('水产'))).toBe(true)
    expect(labels.some((label) => label.includes('停用子类'))).toBe(false)
    expect(labels.some((label) => label.includes('饮品'))).toBe(false)
  })

  it('选择一级和二级分类后提交对应末级分类 ID', async () => {
    const wrapper = mount(ProductForm, {
      props: {
        product: null,
        categories: [
          { id: 1, parentId: null, name: '生鲜', active: true, sortOrder: 0 },
          { id: 2, parentId: 1, name: '水产', active: true, sortOrder: 0 },
        ],
      },
      global: { plugins: [ElementPlus] },
    })
    wrappers.push(wrapper)
    await flushPromises()
    await wrapper.get('input[placeholder="请输入产品名称"]').setValue('分类产品')

    async function chooseOption(selectIndex: number, label: string) {
      const popperClass =
        selectIndex === 0 ? '.product-form-root-popper' : '.product-form-second-popper'
      await wrapper.findAll('.el-select__wrapper')[selectIndex].trigger('click')
      await flushPromises()
      const option = Array.from(
        document.body.querySelectorAll(`${popperClass} .el-select-dropdown__item`),
      ).find((item) => item.textContent?.includes(label))
      expect(option).toBeDefined()
      option?.dispatchEvent(new MouseEvent('click', { bubbles: true }))
      await flushPromises()
    }

    await chooseOption(0, '生鲜')
    await chooseOption(1, '水产')
    await wrapper.findAll('button').find((button) => button.text() === '保存草稿')?.trigger('click')
    await flushPromises()

    expect(wrapper.emitted('save')?.[0][0]).toEqual(
      expect.objectContaining({ name: '分类产品', categoryId: 2 }),
    )
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
        contactServiceIds: [],
        sortOrder: 0,
        specifications: [{ id: 1, name: '500g', referencePrice: null, sortOrder: 0 }],
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

  it('没有规格的草稿点击上架时直接提示补充规格，不调用上架接口', async () => {
    vi.mocked(productApi.listProducts).mockResolvedValue([
      product({ id: 4, name: '小胖牌毛肚', status: 'DRAFT', specifications: [] }),
    ])
    // Element Plus 把返回值类型声明成 MessageBoxInputData & Action（属性与字符串求交，无法构造），
    // 运行时确认结果是字符串 'confirm'，这里按运行期实际值断言。
    vi.spyOn(ElMessageBox, 'confirm').mockResolvedValue('confirm' as never)

    const wrapper = mount(ProductView, { global: { plugins: [ElementPlus] } })
    wrappers.push(wrapper)
    await flushPromises()
    await wrapper.findAll('button').find((button) => button.text() === '上架')?.trigger('click')
    await flushPromises()

    expect(ElMessageBox.confirm).not.toHaveBeenCalled()
    expect(productApi.publishProduct).not.toHaveBeenCalled()
    expect(wrapper.text()).toContain('请先编辑产品并添加至少一个规格后再上架')
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
      contactServiceIds: [],
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

  it('管理员可硬删除已归档产品，二次确认后刷新列表', async () => {
    const archived = product({ id: 81, status: 'ARCHIVED', name: '待清理产品' })
    vi.mocked(productApi.listProducts)
      .mockResolvedValueOnce([archived])
      .mockResolvedValueOnce([])
    vi.mocked(productApi.deleteProduct).mockResolvedValue()
    const confirmationSpy = vi.spyOn(ElMessageBox, 'confirm')

    const wrapper = mount(ProductView, { global: { plugins: [ElementPlus] } })
    wrappers.push(wrapper)
    await flushPromises()

    const row = wrapper.findAll('.el-table__body tr')[0]
    expect(row.findAll('button').map((button) => button.text())).toEqual([
      '继承全局客服',
      '恢复',
      '硬删除',
    ])

    await wrapper.findAll('button').find((button) => button.text() === '硬删除')?.trigger('click')
    await flushPromises()
    expect(confirmationSpy).toHaveBeenLastCalledWith(
      '硬删除“待清理产品”后不可恢复，其独占媒体也会同步清理。请先确认产品已归档，是否继续？',
      '确认硬删除产品',
      expect.any(Object),
    )
    expect(productApi.deleteProduct).not.toHaveBeenCalled()
    await confirmAction()

    expect(productApi.deleteProduct).toHaveBeenCalledWith(81)
    expect(wrapper.text()).toContain('产品“待清理产品”已硬删除')
    expect(wrapper.findAll('.el-table__body tr')).toHaveLength(0)
  })

  it('新建产品直接选择已配置客服并提交 ID 列表', async () => {
    vi.mocked(contactApi.listCustomerServices).mockResolvedValue([
      {
        id: 301,
        displayName: '客服小李',
        wechatId: 'kefu-li',
        qrMediaId: null,
        qrImageUrl: null,
        phone: '13800138000',
        active: true,
      },
      {
        id: 302,
        displayName: '停用客服',
        wechatId: null,
        qrMediaId: null,
        qrImageUrl: null,
        phone: null,
        active: false,
      },
    ])
    vi.mocked(productApi.createProduct).mockResolvedValue(
      product({ id: 91, name: '带客服产品', contactMode: 'OVERRIDE', contactServiceIds: [301] }),
    )

    const wrapper = mount(ProductView, { global: { plugins: [ElementPlus] } })
    wrappers.push(wrapper)
    await flushPromises()
    await wrapper.findAll('button').find((button) => button.text() === '新建产品草稿')?.trigger('click')
    await flushPromises()

    await wrapper.get('input[placeholder="请输入产品名称"]').setValue('带客服产品')
    const contactSelect = wrapper.find('.contact-service-select .el-select__wrapper')
    await contactSelect.trigger('click')
    await flushPromises()
    const option = Array.from(document.body.querySelectorAll('.el-select-dropdown__item'))
      .find((item) => item.textContent?.includes('客服小李'))
    expect(option).toBeDefined()
    option?.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    await flushPromises()

    await wrapper.findAll('button').find((button) => button.text() === '保存草稿')?.trigger('click')
    await flushPromises()

    expect(productApi.createProduct).toHaveBeenCalledWith(
      expect.objectContaining({
        name: '带客服产品',
        contactMode: 'OVERRIDE',
        contactServiceIds: [301],
      }),
    )
  })

  it('产品列表点击当前客服可在行内更换并直接保存整份内容', async () => {
    const original = product({
      id: 70,
      name: '带客服产品',
      categoryId: 2,
      detailText: '<p>产品详情</p>',
      keywords: ['冻品'],
      galleryMediaIds: [305],
      contactMode: 'OVERRIDE',
      contactServiceIds: [301],
      sortOrder: 3,
    })
    const updated = { ...original, contactServiceIds: [303] }
    vi.mocked(contactApi.listCustomerServices).mockResolvedValue([
      {
        id: 301,
        displayName: '客服小李',
        wechatId: 'kefu-li',
        qrMediaId: null,
        qrImageUrl: null,
        phone: '13800138000',
        active: true,
      },
      {
        id: 303,
        displayName: '客服小王',
        wechatId: 'kefu-wang',
        qrMediaId: null,
        qrImageUrl: null,
        phone: '13900139000',
        active: true,
      },
    ])
    vi.mocked(productApi.listProducts)
      .mockResolvedValueOnce([original])
      .mockResolvedValueOnce([updated])
    vi.mocked(productApi.updateProduct).mockResolvedValue(updated)

    const wrapper = mount(ProductView, { global: { plugins: [ElementPlus] } })
    wrappers.push(wrapper)
    await flushPromises()

    const row = wrapper.findAll('.el-table__body tr')[0]
    expect(row.text()).toContain('客服小李')
    await row.findAll('button').find((button) => button.text() === '客服小李')?.trigger('click')
    await flushPromises()

    await wrapper.get('.product-contact-select .el-select__wrapper').trigger('click')
    await flushPromises()
    const option = Array.from(document.body.querySelectorAll('.el-select-dropdown__item'))
      .find((item) => item.textContent?.includes('客服小王'))
    expect(option).toBeDefined()
    option?.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    await flushPromises()

    await wrapper.findAll('button').find((button) => button.text() === '保存')?.trigger('click')
    await flushPromises()

    expect(productApi.updateProduct).toHaveBeenCalledWith(70, {
      name: '带客服产品',
      categoryId: 2,
      detailText: '<p>产品详情</p>',
      mainImageMediaId: null,
      galleryMediaIds: [305],
      keywords: ['冻品'],
      contactMode: 'OVERRIDE',
      contactServiceIds: [303],
      sortOrder: 3,
      specifications: [],
    })
    expect(wrapper.text()).toContain('产品“带客服产品”客服已更新')
    expect(wrapper.findAll('.el-table__body tr')[0].text()).toContain('客服小王')
  })

  it('EDITOR 只看到当前状态允许的操作，不显示归档或恢复', async () => {
    useAuthStore().restoreSession({
      username: 'editor',
      nickname: null,
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
        contactServiceIds: [],
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
        contactServiceIds: [],
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
        contactServiceIds: [],
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
        contactServiceIds: [],
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
    expect(actions[0]).toEqual(['继承全局客服', '编辑', '上架'])
    expect(actions[1]).toEqual(['继承全局客服', '编辑', '下架'])
    expect(actions[2]).toEqual(['继承全局客服', '编辑', '上架'])
    expect(actions[3]).toEqual(['继承全局客服'])
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
      contactServiceIds: [],
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
      contactServiceIds: [],
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
      contactServiceIds: [],
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
      contactServiceIds: [],
      sortOrder: 0,
      specifications: [],
    })
    expect(productApi.publishProduct).not.toHaveBeenCalled()
    expect(wrapper.text()).toContain('产品保存成功，已立即生效')
    expect(wrapper.text()).toContain('已上架')
    expect(wrapper.text()).not.toContain('发布版本')
  })

  it('列表展示分类路径和主图缩略图', async () => {
    vi.mocked(categoryApi.listCategories).mockResolvedValue([
      { id: 1, parentId: null, name: '生鲜', active: true, sortOrder: 0 },
      { id: 2, parentId: 1, name: '水产', active: true, sortOrder: 0 },
    ])
    vi.mocked(productApi.listProducts).mockResolvedValue([
      product({ id: 1, name: '冷冻带鱼', categoryId: 2, mainImageMediaId: 301 }),
      product({ id: 2, name: '未分类产品' }),
    ])

    const wrapper = mount(ProductView, { global: { plugins: [ElementPlus] } })
    wrappers.push(wrapper)
    await flushPromises()

    const rows = wrapper.findAll('.el-table__body tr')
    expect(rows[0].text()).toContain('生鲜 / 水产')
    expect(rows[0].find('img').attributes('src')).toContain('/api/v1/media/301')
    expect(rows[1].text()).toContain('未分类')
    expect(rows[1].find('img').exists()).toBe(false)
  })

  it('草稿表单实时展示填写进度', async () => {
    const wrapper = mount(ProductForm, {
      props: {
        product: null,
        categories: [
          { id: 1, parentId: null, name: '生鲜', active: true, sortOrder: 0 },
          { id: 2, parentId: 1, name: '水产', active: true, sortOrder: 0 },
        ],
      },
      global: { plugins: [ElementPlus] },
    })
    wrappers.push(wrapper)
    await flushPromises()

    expect(wrapper.get('.progress-summary').text()).toContain('0/6')
    expect(wrapper.get('.progress-summary').text()).toContain('还有 6 项待补充')

    await wrapper.get('input[placeholder="请输入产品名称"]').setValue('进度产品')
    await flushPromises()
    expect(wrapper.get('.progress-summary').text()).toContain('0/6')

    await wrapper.findAll('.el-select__wrapper')[0].trigger('click')
    await flushPromises()
    const rootOption = Array.from(
      document.body.querySelectorAll('.product-form-root-popper .el-select-dropdown__item'),
    ).find((option) => option.textContent?.includes('生鲜'))
    rootOption?.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    await flushPromises()
    await wrapper.findAll('.el-select__wrapper')[1].trigger('click')
    await flushPromises()
    const secondOption = Array.from(
      document.body.querySelectorAll('.product-form-second-popper .el-select-dropdown__item'),
    ).find((option) => option.textContent?.includes('水产'))
    secondOption?.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    await flushPromises()

    expect(wrapper.get('.progress-summary').text()).toContain('1/6')
    expect(wrapper.findAll('.progress-list li.is-done')).toHaveLength(1)

    await wrapper.get('textarea[placeholder="每行输入一个关键词"]').setValue('冻品')
    await flushPromises()
    expect(wrapper.get('.progress-summary').text()).toContain('2/6')
    expect(wrapper.get('.progress-summary').text()).toContain('还有 4 项待补充')
    expect(wrapper.findAll('.progress-list li.is-done')).toHaveLength(2)

    await wrapper.findAll('button').find((button) => button.text() === '添加规格')?.trigger('click')
    await wrapper.get('input[placeholder="请输入规格名称"]').setValue('500g')
    await flushPromises()
    expect(wrapper.get('.progress-summary').text()).toContain('3/6')
    expect(wrapper.findAll('.progress-list li.is-done')).toHaveLength(3)
  })

  it('上传图片只在对应的素材框内展示', async () => {
    const wrapper = mount(ProductForm, {
      props: {
        product: product({
          mainImageMediaId: 11,
          galleryMediaIds: [12, 13],
          detailText: '<p><img src="/api/v1/media/14" alt=""></p>',
        }),
        categories: [],
      },
      global: { plugins: [ElementPlus] },
    })
    wrappers.push(wrapper)
    await flushPromises()

    const boxes = wrapper.findAll('.media-picker')
    expect(boxes).toHaveLength(3)
    expect(boxes[0].findAll('.media-preview')).toHaveLength(1)
    expect(boxes[1].findAll('.media-preview')).toHaveLength(2)
    expect(boxes[2].findAll('.media-preview')).toHaveLength(1)
    expect(boxes[0].text()).not.toContain('gallery-12')
  })

  it('按名称或关键词模糊搜索产品', async () => {
    vi.mocked(productApi.listProducts).mockResolvedValue([
      product({ id: 1, name: '冷冻带鱼', keywords: ['海鲜'] }),
      product({ id: 2, name: '冷冻虾', keywords: ['水产'] }),
      product({ id: 3, name: '苹果', keywords: ['水果'] }),
    ])

    const wrapper = mount(ProductView, { global: { plugins: [ElementPlus] } })
    wrappers.push(wrapper)
    await flushPromises()
    const search = wrapper.get('input[placeholder="搜索产品名称或关键词"]')

    await search.setValue('带鱼')
    await flushPromises()
    let rows = wrapper.findAll('.el-table__body tr')
    expect(rows).toHaveLength(1)
    expect(rows[0].text()).toContain('冷冻带鱼')

    await search.setValue('水产')
    await flushPromises()
    rows = wrapper.findAll('.el-table__body tr')
    expect(rows).toHaveLength(1)
    expect(rows[0].text()).toContain('冷冻虾')

    await search.setValue('')
    await flushPromises()
    expect(wrapper.findAll('.el-table__body tr')).toHaveLength(3)
  })

  it('选择一级分类时包含该分类及其子分类下的产品', async () => {
    vi.mocked(categoryApi.listCategories).mockResolvedValue([
      { id: 1, parentId: null, name: '生鲜', active: true, sortOrder: 0 },
      { id: 2, parentId: 1, name: '水产', active: true, sortOrder: 0 },
      { id: 3, parentId: null, name: '饮品', active: true, sortOrder: 1 },
    ])
    vi.mocked(productApi.listProducts).mockResolvedValue([
      product({ id: 1, name: '一级分类产品', categoryId: 1 }),
      product({ id: 2, name: '二级分类产品', categoryId: 2 }),
      product({ id: 3, name: '其他分类产品', categoryId: 3 }),
    ])

    const wrapper = mount(ProductView, { global: { plugins: [ElementPlus] } })
    wrappers.push(wrapper)
    await flushPromises()
    await selectOption(wrapper, 0, '生鲜')

    const rows = wrapper.findAll('.el-table__body tr')
    expect(rows).toHaveLength(2)
    expect(rows.map((row) => row.text())).toEqual([
      expect.stringContaining('一级分类产品'),
      expect.stringContaining('二级分类产品'),
    ])
  })

  it('级联选择一级和二级分类后可叠加关键词搜索', async () => {
    vi.mocked(categoryApi.listCategories).mockResolvedValue([
      { id: 1, parentId: null, name: '生鲜', active: true, sortOrder: 0 },
      { id: 2, parentId: 1, name: '水产', active: true, sortOrder: 0 },
      { id: 3, parentId: 1, name: '肉类', active: true, sortOrder: 1 },
      { id: 4, parentId: null, name: '饮品', active: true, sortOrder: 1 },
    ])
    vi.mocked(productApi.listProducts).mockResolvedValue([
      product({ id: 1, name: '冷冻带鱼', categoryId: 2 }),
      product({ id: 2, name: '鲜虾', categoryId: 2 }),
      product({ id: 3, name: '牛肉', categoryId: 3 }),
      product({ id: 4, name: '果汁', categoryId: 4 }),
    ])

    const wrapper = mount(ProductView, { global: { plugins: [ElementPlus] } })
    wrappers.push(wrapper)
    await flushPromises()
    await selectOption(wrapper, 0, '生鲜')
    await selectOption(wrapper, 1, '水产')

    let rows = wrapper.findAll('.el-table__body tr')
    expect(rows).toHaveLength(2)

    await wrapper.get('input[placeholder="搜索产品名称或关键词"]').setValue('带鱼')
    await flushPromises()
    rows = wrapper.findAll('.el-table__body tr')
    expect(rows).toHaveLength(1)
    expect(rows[0].text()).toContain('冷冻带鱼')
  })
})
