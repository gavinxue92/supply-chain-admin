import { flushPromises, mount } from '@vue/test-utils'
import ElementPlus, { ElMessageBox } from 'element-plus'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('../src/api/category', () => ({
  listCategories: vi.fn(),
  createCategory: vi.fn(),
  updateCategory: vi.fn(),
  setCategoryStatus: vi.fn(),
  deleteCategory: vi.fn(),
}))

import * as categoryApi from '../src/api/category'
import CategoryView from '../src/views/CategoryView.vue'

describe('分类管理页面', () => {
  const wrappers: ReturnType<typeof mount>[] = []

  async function confirmDialog() {
    const confirmButton = document.body.querySelector<HTMLButtonElement>(
      '.el-message-box__btns .el-button--primary',
    )
    expect(confirmButton).not.toBeNull()
    confirmButton?.click()
    await flushPromises()
  }

  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    wrappers.forEach((wrapper) => wrapper.unmount())
    wrappers.length = 0
    document.body.innerHTML = ''
    vi.restoreAllMocks()
  })

  it('按分类等级展示并通过一级名称展开、折叠二级分类', async () => {
    vi.mocked(categoryApi.listCategories).mockResolvedValue([
      { id: 1, parentId: null, name: '冷冻食品', active: true, sortOrder: 2 },
      { id: 2, parentId: 1, name: '水产', active: false, sortOrder: 1 },
    ])

    const wrapper = mount(CategoryView, {
      global: { plugins: [ElementPlus] },
    })
    wrappers.push(wrapper)
    await flushPromises()

    const headers = wrapper.findAll('.el-table__header th').map((header) => header.text())
    expect(headers).toContain('分类等级')
    expect(headers).not.toContain('上级分类')

    let rows = wrapper.findAll('.el-table__body tr')
    expect(rows).toHaveLength(1)
    expect(rows[0].text()).toContain('冷冻食品')
    expect(rows[0].text()).toContain('一级')
    expect(rows[0].text()).toContain('已启用')
    expect(rows[0].text()).toContain('2')
    expect(wrapper.text()).not.toContain('水产')

    const rootNameButton = wrapper.findAll('button').find((button) => button.text().includes('冷冻食品'))
    await rootNameButton?.trigger('click')
    await flushPromises()

    rows = wrapper.findAll('.el-table__body tr')
    expect(rows).toHaveLength(2)
    expect(rows[1].text()).toContain('水产')
    expect(rows[1].text()).toContain('二级')
    expect(rows[1].text()).toContain('已停用')
    expect(rows[1].text()).toContain('1')

    await rootNameButton?.trigger('click')
    await flushPromises()
    expect(wrapper.findAll('.el-table__body tr')).toHaveLength(1)
  })

  it('后端省略一级分类 parentId 时仍展示为一级分类', async () => {
    vi.mocked(categoryApi.listCategories).mockResolvedValue([
      { id: 8, name: '食材', active: true, sortOrder: 0 },
    ])
    const wrapper = mount(CategoryView, {
      global: { plugins: [ElementPlus] },
    })
    wrappers.push(wrapper)
    await flushPromises()

    const rows = wrapper.findAll('.el-table__body tr')
    expect(rows).toHaveLength(1)
    expect(rows[0].text()).toContain('食材')
    expect(rows[0].text()).toContain('一级')
  })

  it('必填名称未填写时保留新建表单并显示校验错误', async () => {
    vi.mocked(categoryApi.listCategories).mockResolvedValue([])
    const wrapper = mount(CategoryView, {
      global: { plugins: [ElementPlus] },
    })
    wrappers.push(wrapper)
    await flushPromises()

    await wrapper.get('button').trigger('click')
    await flushPromises()
    const saveButton = wrapper.findAll('button').find((button) => button.text().includes('保存'))
    expect(saveButton).toBeDefined()
    await saveButton?.trigger('click')
    await flushPromises()

    expect(categoryApi.createCategory).not.toHaveBeenCalled()
    expect(wrapper.text()).toContain('分类名称不能为空')
    expect(wrapper.text()).toContain('新增一级分类')
  })

  it('新增一级分类只提交空 parentId 并刷新完整列表', async () => {
    vi.mocked(categoryApi.listCategories)
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([
        { id: 3, parentId: null, name: '饮料', active: true, sortOrder: 0 },
      ])
    vi.mocked(categoryApi.createCategory).mockResolvedValue({
      id: 3,
      parentId: null,
      name: '饮料',
      active: true,
      sortOrder: 0,
    })
    const wrapper = mount(CategoryView, {
      global: { plugins: [ElementPlus] },
    })
    wrappers.push(wrapper)
    await flushPromises()

    const createRootButton = wrapper.findAll('button')
      .find((button) => button.text() === '新增一级分类')
    expect(createRootButton).toBeDefined()
    await createRootButton?.trigger('click')
    await flushPromises()
    expect(wrapper.text()).toContain('新增一级分类')
    const nameInput = wrapper.find('input[placeholder="请输入分类名称"]')
    expect(nameInput.exists()).toBe(true)
    await nameInput.setValue('饮料')
    await flushPromises()
    const saveButton = wrapper.findAll('button').find((button) => button.text().includes('保存'))
    await saveButton?.trigger('click')
    await flushPromises()

    expect(categoryApi.createCategory).toHaveBeenCalledWith({
      name: '饮料',
      parentId: null,
      sortOrder: 0,
    })
    expect(categoryApi.listCategories).toHaveBeenCalledTimes(2)
    expect(wrapper.text()).toContain('饮料')
  })

  it('取消一级分类停用确认时不发起写请求并说明整棵分类树会隐藏', async () => {
    vi.mocked(categoryApi.listCategories).mockResolvedValue([
      { id: 1, parentId: null, name: '冷冻食品', active: true, sortOrder: 0 },
    ])
    vi.spyOn(ElMessageBox, 'confirm').mockRejectedValue('cancel')
    const wrapper = mount(CategoryView, {
      global: { plugins: [ElementPlus] },
    })
    wrappers.push(wrapper)
    await flushPromises()

    const stopButton = wrapper.findAll('button').find((button) => button.text() === '停用')
    await stopButton?.trigger('click')
    await flushPromises()

    expect(ElMessageBox.confirm).toHaveBeenCalledWith(
      '停用一级分类“冷冻食品”将隐藏整棵分类树，是否继续？',
      '确认停用分类',
      expect.any(Object),
    )
    expect(categoryApi.setCategoryStatus).not.toHaveBeenCalled()
    expect(wrapper.text()).toContain('已启用')
  })

  it('删除返回 409 时提示先停用或处理关联内容', async () => {
    vi.mocked(categoryApi.listCategories).mockResolvedValue([
      { id: 2, parentId: null, name: '水产', active: true, sortOrder: 1 },
    ])
    const conflict = Object.assign(new Error('Conflict'), {
      isAxiosError: true,
      response: { status: 409, data: { success: false, data: null, message: 'Conflict' } },
    })
    vi.mocked(categoryApi.deleteCategory).mockRejectedValue(conflict)
    const wrapper = mount(CategoryView, {
      global: { plugins: [ElementPlus] },
    })
    wrappers.push(wrapper)
    await flushPromises()

    const deleteButton = wrapper.findAll('button').find((button) => button.text() === '删除')
    await deleteButton?.trigger('click')
    await flushPromises()
    await confirmDialog()

    expect(categoryApi.deleteCategory).toHaveBeenCalledWith(2)
    expect(wrapper.text()).toContain('无法删除')
    expect(wrapper.text()).toContain('请停用分类或先处理关联内容')
    expect(wrapper.text()).toContain('水产')
  })

  it('启停请求失败时保留后端返回的状态并显示错误', async () => {
    vi.mocked(categoryApi.listCategories).mockResolvedValue([
      { id: 2, parentId: null, name: '水产', active: true, sortOrder: 1 },
    ])
    const failure = Object.assign(new Error('Unavailable'), {
      isAxiosError: true,
      response: { status: 500, data: { success: false, data: null, message: '服务暂不可用' } },
    })
    vi.mocked(categoryApi.setCategoryStatus).mockRejectedValue(failure)
    const wrapper = mount(CategoryView, {
      global: { plugins: [ElementPlus] },
    })
    wrappers.push(wrapper)
    await flushPromises()

    const stopButton = wrapper.findAll('button').find((button) => button.text() === '停用')
    await stopButton?.trigger('click')
    await flushPromises()
    await confirmDialog()

    expect(categoryApi.setCategoryStatus).toHaveBeenCalledWith(2, { active: false })
    expect(wrapper.text()).toContain('已启用')
    expect(wrapper.text()).toContain('服务暂不可用')
  })

  it('确认启停成功后更新分类状态并反馈结果', async () => {
    vi.mocked(categoryApi.listCategories).mockResolvedValue([
      { id: 2, parentId: null, name: '水产', active: true, sortOrder: 1 },
    ])
    vi.mocked(categoryApi.setCategoryStatus).mockResolvedValue()
    const wrapper = mount(CategoryView, {
      global: { plugins: [ElementPlus] },
    })
    wrappers.push(wrapper)
    await flushPromises()

    const stopButton = wrapper.findAll('button').find((button) => button.text() === '停用')
    await stopButton?.trigger('click')
    await flushPromises()
    await confirmDialog()

    expect(categoryApi.setCategoryStatus).toHaveBeenCalledWith(2, { active: false })
    expect(wrapper.text()).toContain('已停用')
    expect(wrapper.text()).toContain('分类已停用')
  })

  it('编辑分类时提交更新后的名称、父级和排序', async () => {
    vi.mocked(categoryApi.listCategories)
      .mockResolvedValueOnce([
        { id: 1, parentId: null, name: '冷冻食品', active: true, sortOrder: 1 },
      ])
      .mockResolvedValueOnce([
        { id: 1, parentId: null, name: '冻品', active: true, sortOrder: 4 },
      ])
    vi.mocked(categoryApi.updateCategory).mockResolvedValue({
      id: 1,
      parentId: null,
      name: '冻品',
      active: true,
      sortOrder: 4,
    })
    const wrapper = mount(CategoryView, {
      global: { plugins: [ElementPlus] },
    })
    wrappers.push(wrapper)
    await flushPromises()

    const editButton = wrapper.findAll('button').find((button) => button.text() === '编辑')
    await editButton?.trigger('click')
    await flushPromises()
    await wrapper.find('input[placeholder="请输入分类名称"]').setValue('冻品')
    await wrapper.find('input[type="number"]').setValue('4')
    const saveButton = wrapper.findAll('button').find((button) => button.text().includes('保存'))
    await saveButton?.trigger('click')
    await flushPromises()

    expect(categoryApi.updateCategory).toHaveBeenCalledWith(1, {
      name: '冻品',
      parentId: null,
      sortOrder: 4,
    })
    expect(wrapper.text()).toContain('冻品')
  })

  it('从一级分类操作中直接创建其二级分类', async () => {
    vi.mocked(categoryApi.listCategories)
      .mockResolvedValueOnce([
        { id: 1, parentId: null, name: '冷冻食品', active: true, sortOrder: 1 },
        { id: 2, parentId: 1, name: '水产', active: true, sortOrder: 1 },
        { id: 4, parentId: null, name: '饮料', active: true, sortOrder: 2 },
      ])
      .mockResolvedValueOnce([
        { id: 1, parentId: null, name: '冷冻食品', active: true, sortOrder: 1 },
        { id: 2, parentId: 1, name: '水产', active: true, sortOrder: 1 },
        { id: 3, parentId: 1, name: '冻鱼', active: true, sortOrder: 0 },
        { id: 4, parentId: null, name: '饮料', active: true, sortOrder: 2 },
      ])
    vi.mocked(categoryApi.createCategory).mockResolvedValue({
      id: 3,
      parentId: 1,
      name: '冻鱼',
      active: true,
      sortOrder: 0,
    })
    const wrapper = mount(CategoryView, {
      global: { plugins: [ElementPlus] },
    })
    wrappers.push(wrapper)
    await flushPromises()

    const rootRow = wrapper.findAll('.el-table__body tr')
      .find((row) => row.text().includes('冷冻食品'))
    const addChildButton = rootRow?.findAll('button')
      .find((button) => button.text() === '新增二级分类')
    expect(addChildButton).toBeDefined()
    await addChildButton?.trigger('click')
    await flushPromises()
    expect(wrapper.text()).toContain('新增二级分类')
    expect(wrapper.text()).toContain('冷冻食品')
    expect(wrapper.find('.el-select').exists()).toBe(false)
    await wrapper.find('input[placeholder="请输入分类名称"]').setValue('冻鱼')
    const saveButton = wrapper.findAll('button').find((button) => button.text().includes('保存'))
    await saveButton?.trigger('click')
    await flushPromises()

    expect(categoryApi.createCategory).toHaveBeenCalledWith({
      name: '冻鱼',
      parentId: 1,
      sortOrder: 0,
    })
    const rows = wrapper.findAll('.el-table__body tr')
    expect(rows).toHaveLength(4)
    expect(rows[2].text()).toContain('冻鱼')
  })

  it('同一父级下名称重复时保留表单并阻止提交', async () => {
    vi.mocked(categoryApi.listCategories).mockResolvedValue([
      { id: 1, parentId: null, name: '冷冻食品', active: true, sortOrder: 1 },
    ])
    const wrapper = mount(CategoryView, {
      global: { plugins: [ElementPlus] },
    })
    wrappers.push(wrapper)
    await flushPromises()

    await wrapper.get('button').trigger('click')
    await flushPromises()
    await wrapper.find('input[placeholder="请输入分类名称"]').setValue('冷冻食品')
    const saveButton = wrapper.findAll('button').find((button) => button.text().includes('保存'))
    await saveButton?.trigger('click')
    await flushPromises()

    expect(categoryApi.createCategory).not.toHaveBeenCalled()
    expect(wrapper.text()).toContain('同一父分类下不能有重名分类')
    expect(wrapper.text()).toContain('新增一级分类')
    expect(
      wrapper.find<HTMLInputElement>('input[placeholder="请输入分类名称"]').element.value,
    ).toBe('冷冻食品')
  })

  it('后端拒绝分类更新时保留输入并展示冲突原因', async () => {
    vi.mocked(categoryApi.listCategories).mockResolvedValue([
      { id: 1, parentId: null, name: '冷冻食品', active: true, sortOrder: 1 },
    ])
    const conflict = Object.assign(new Error('Conflict'), {
      isAxiosError: true,
      response: {
        status: 409,
        data: { success: false, data: null, message: '该名称已被同级分类使用' },
      },
    })
    vi.mocked(categoryApi.updateCategory).mockRejectedValue(conflict)
    const wrapper = mount(CategoryView, {
      global: { plugins: [ElementPlus] },
    })
    wrappers.push(wrapper)
    await flushPromises()

    const editButton = wrapper.findAll('button').find((button) => button.text() === '编辑')
    await editButton?.trigger('click')
    await flushPromises()
    await wrapper.find('input[placeholder="请输入分类名称"]').setValue('冷冻品')
    const saveButton = wrapper.findAll('button').find((button) => button.text().includes('保存'))
    await saveButton?.trigger('click')
    await flushPromises()

    expect(wrapper.text()).toContain('该名称已被同级分类使用')
    expect(wrapper.text()).toContain('编辑分类')
    expect(
      wrapper.find<HTMLInputElement>('input[placeholder="请输入分类名称"]').element.value,
    ).toBe('冷冻品')
    expect(wrapper.text()).toContain('冷冻食品')
  })

  it('分类列表加载失败时提供重试并恢复展示', async () => {
    vi.mocked(categoryApi.listCategories)
      .mockRejectedValueOnce(new Error('网络暂不可用'))
      .mockResolvedValueOnce([
        { id: 1, parentId: null, name: '冷冻食品', active: true, sortOrder: 0 },
      ])
    const wrapper = mount(CategoryView, {
      global: { plugins: [ElementPlus] },
    })
    wrappers.push(wrapper)
    await flushPromises()

    expect(wrapper.text()).toContain('网络暂不可用')
    const retryButton = wrapper.findAll('button').find((button) => button.text() === '重试')
    await retryButton?.trigger('click')
    await flushPromises()

    expect(categoryApi.listCategories).toHaveBeenCalledTimes(2)
    expect(wrapper.text()).toContain('冷冻食品')
    expect(wrapper.text()).not.toContain('网络暂不可用')
  })

  it('确认删除成功后重新读取完整分类列表', async () => {
    vi.mocked(categoryApi.listCategories)
      .mockResolvedValueOnce([
        { id: 1, parentId: null, name: '冷冻食品', active: true, sortOrder: 0 },
      ])
      .mockResolvedValueOnce([])
    vi.mocked(categoryApi.deleteCategory).mockResolvedValue()
    const wrapper = mount(CategoryView, {
      global: { plugins: [ElementPlus] },
    })
    wrappers.push(wrapper)
    await flushPromises()

    const deleteButton = wrapper.findAll('button').find((button) => button.text() === '删除')
    await deleteButton?.trigger('click')
    await flushPromises()
    await confirmDialog()

    expect(categoryApi.deleteCategory).toHaveBeenCalledWith(1)
    expect(categoryApi.listCategories).toHaveBeenCalledTimes(2)
    expect(wrapper.text()).toContain('分类删除成功')
    expect(wrapper.text()).toContain('暂无分类')
  })

  it('新建一级分类弹窗展示层级指引和命名建议', async () => {
    vi.mocked(categoryApi.listCategories).mockResolvedValue([])
    const wrapper = mount(CategoryView, {
      global: { plugins: [ElementPlus] },
    })
    wrappers.push(wrapper)
    await flushPromises()

    await wrapper.get('button').trigger('click')
    await flushPromises()

    expect(wrapper.text()).toContain('创建商品大类，作为二级分类的上级目录')
    expect(wrapper.text()).toContain('分类信息')
    expect(wrapper.text()).toContain('一级目录')
    expect(wrapper.text()).toContain('创建后不可更改')
    expect(wrapper.text()).toContain('分类层级')
    expect(wrapper.text()).toContain('共 3 级')
    expect(wrapper.text()).toContain('二级分类')
    expect(wrapper.text()).toContain('产品')
    expect(wrapper.text()).toContain('命名建议')
    expect(wrapper.text()).toContain('同一层级下分类名称不可重复')
    expect(wrapper.text()).toContain('保存后在分类列表中继续维护')
  })
})
