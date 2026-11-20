import { flushPromises, mount } from '@vue/test-utils'
import ElementPlus from 'element-plus'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('../src/api/account', () => ({
  listAccounts: vi.fn(),
  createAccount: vi.fn(),
  deactivateAccount: vi.fn(),
  resetTemporaryPassword: vi.fn(),
  updateAccountNickname: vi.fn(),
  deleteAccount: vi.fn(),
}))

import * as accountApi from '../src/api/account'
import AccountView from '../src/views/AccountView.vue'
import type { AdminAccountVO } from '../src/types/account'

describe('后台账号管理页面', () => {
  const wrappers: ReturnType<typeof mount>[] = []
  const adminAccount: AdminAccountVO = {
    id: 1,
    username: 'admin',
    nickname: '超级管理员',
    role: 'ADMIN',
    active: true,
    mustChangePassword: false,
    createdAt: '2026-01-02T03:04:05Z',
  }
  const editorAccount: AdminAccountVO = {
    id: 2,
    username: 'editor01',
    nickname: null,
    role: 'EDITOR',
    active: false,
    mustChangePassword: true,
    createdAt: '2026-02-03T04:05:06Z',
  }

  function mountView() {
    const wrapper = mount(AccountView, {
      global: { plugins: [ElementPlus] },
    })
    wrappers.push(wrapper)
    return wrapper
  }

  function findButton(wrapper: ReturnType<typeof mount>, text: string) {
    return wrapper.findAll('button').find((button) => button.text() === text)
  }

  // 对话框默认不挂载到 document 上，需在组件容器内查询一次性密码输入框。
  function readonlyPasswordValues(wrapper: ReturnType<typeof mount>): string[] {
    return wrapper.findAll<HTMLInputElement>('input[readonly]').map((input) => input.element.value)
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
    vi.resetAllMocks()
    vi.mocked(accountApi.listAccounts).mockResolvedValue([])
  })

  afterEach(() => {
    wrappers.forEach((wrapper) => wrapper.unmount())
    wrappers.length = 0
    document.body.innerHTML = ''
    vi.restoreAllMocks()
  })

  it('按后端原始顺序展示用户名、角色、启用状态和改密状态', async () => {
    vi.mocked(accountApi.listAccounts).mockResolvedValue([adminAccount, editorAccount])
    const wrapper = mountView()
    await flushPromises()

    const rows = wrapper.findAll('.el-table__body tr')
    expect(rows).toHaveLength(2)
    expect(rows[0].text()).toContain('admin')
    expect(rows[0].text()).toContain('管理员')
    expect(rows[0].text()).toContain('已启用')
    expect(rows[0].text()).toContain('正常')
    expect(rows[1].text()).toContain('editor01')
    expect(rows[1].text()).toContain('运营编辑')
    expect(rows[1].text()).toContain('已停用')
    expect(rows[1].text()).toContain('需改密')
  })

  it('当前角色无权读取账号列表时展示 403 明确反馈', async () => {
    vi.mocked(accountApi.listAccounts).mockRejectedValue(
      Object.assign(new Error('Forbidden'), {
        isAxiosError: true,
        response: {
          status: 403,
          data: { success: false, data: null, message: 'Forbidden' },
        },
      }),
    )
    const wrapper = mountView()
    await flushPromises()

    expect(wrapper.text()).toContain('403')
    expect(wrapper.text()).toContain('请使用管理员账号登录')
  })

  it('创建账号时校验用户名和临时密码规则', async () => {
    const wrapper = mountView()
    await flushPromises()
    await findButton(wrapper, '新建账号')?.trigger('click')
    await flushPromises()

    await findButton(wrapper, '创建账号')?.trigger('click')
    await flushPromises()
    expect(accountApi.createAccount).not.toHaveBeenCalled()
    expect(wrapper.text()).toContain('用户名不能为空')

    await wrapper.get('input[placeholder="请输入用户名"]').setValue('editor 01')
    await wrapper.get('input[placeholder="12 至 200 个字符"]').setValue('short')
    await findButton(wrapper, '创建账号')?.trigger('click')
    await flushPromises()
    expect(accountApi.createAccount).not.toHaveBeenCalled()
    expect(wrapper.text()).toContain('用户名不能包含空白字符')

    await wrapper.get('input[placeholder="请输入用户名"]').setValue('editor01')
    await findButton(wrapper, '创建账号')?.trigger('click')
    await flushPromises()
    expect(accountApi.createAccount).not.toHaveBeenCalled()
    expect(wrapper.text()).toContain('临时密码长度必须为 12 至 200 个字符')
  })

  it('创建 EDITOR 账号后一次性展示可复制的临时密码并刷新列表', async () => {
    vi.mocked(accountApi.listAccounts)
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([{ ...editorAccount, active: true, mustChangePassword: true }])
    vi.mocked(accountApi.createAccount).mockResolvedValue({
      ...editorAccount,
      active: true,
      mustChangePassword: true,
    })
    const writeText = vi.fn().mockResolvedValue(undefined)
    Object.defineProperty(navigator, 'clipboard', {
      value: { writeText },
      configurable: true,
    })

    const wrapper = mountView()
    await flushPromises()
    await findButton(wrapper, '新建账号')?.trigger('click')
    await flushPromises()
    await wrapper.get('input[placeholder="请输入用户名"]').setValue('editor01')
    await wrapper.get('input[placeholder="12 至 200 个字符"]').setValue('temporary-pass-01')
    await findButton(wrapper, '创建账号')?.trigger('click')
    await flushPromises()

    expect(accountApi.createAccount).toHaveBeenCalledWith({
      username: 'editor01',
      temporaryPassword: 'temporary-pass-01',
      role: 'EDITOR',
      nickname: null,
    })
    expect(accountApi.listAccounts).toHaveBeenCalledTimes(2)
    expect(wrapper.text()).toContain('账号“editor01”创建成功')
    expect(readonlyPasswordValues(wrapper)).toContain('temporary-pass-01')
    expect(wrapper.text()).toContain('已启用')
    expect(wrapper.text()).toContain('需改密')

    await findButton(wrapper, '复制密码')?.trigger('click')
    await flushPromises()
    expect(writeText).toHaveBeenCalledWith('temporary-pass-01')
  })

  it('重置临时密码前二次确认，成功后展示新密码并刷新列表', async () => {
    vi.mocked(accountApi.listAccounts).mockResolvedValue([adminAccount])
    vi.mocked(accountApi.resetTemporaryPassword).mockResolvedValue()
    const wrapper = mountView()
    await flushPromises()

    await findButton(wrapper, '重置临时密码')?.trigger('click')
    await flushPromises()
    await wrapper.get('input[placeholder="请输入新的临时密码"]').setValue('reset-pass-0001')
    await findButton(wrapper, '确认重置')?.trigger('click')
    await flushPromises()

    expect(accountApi.resetTemporaryPassword).not.toHaveBeenCalled()
    await confirmAction()

    expect(accountApi.resetTemporaryPassword).toHaveBeenCalledWith(1, {
      temporaryPassword: 'reset-pass-0001',
    })
    expect(accountApi.listAccounts).toHaveBeenCalledTimes(2)
    expect(wrapper.text()).toContain('账号“admin”的临时密码已重置')
    expect(readonlyPasswordValues(wrapper)).toContain('reset-pass-0001')
  })

  it('停用账号前二次确认，成功后展示停用状态并刷新列表', async () => {
    vi.mocked(accountApi.listAccounts)
      .mockResolvedValueOnce([adminAccount])
      .mockResolvedValueOnce([{ ...adminAccount, active: false }])
    vi.mocked(accountApi.deactivateAccount).mockResolvedValue()
    const wrapper = mountView()
    await flushPromises()

    await findButton(wrapper, '停用')?.trigger('click')
    await flushPromises()
    expect(accountApi.deactivateAccount).not.toHaveBeenCalled()
    await confirmAction()

    expect(accountApi.deactivateAccount).toHaveBeenCalledWith(1)
    expect(accountApi.listAccounts).toHaveBeenCalledTimes(2)
    expect(wrapper.text()).toContain('账号“admin”已停用')
    expect(wrapper.findAll('.el-table__body tr')[0].text()).toContain('已停用')
  })

  it('管理员可维护他人昵称并刷新列表', async () => {
    vi.mocked(accountApi.listAccounts)
      .mockResolvedValueOnce([adminAccount])
      .mockResolvedValueOnce([{ ...adminAccount, nickname: '新昵称' }])
    vi.mocked(accountApi.updateAccountNickname).mockResolvedValue({
      ...adminAccount,
      nickname: '新昵称',
    })
    const wrapper = mountView()
    await flushPromises()

    expect(wrapper.text()).toContain('超级管理员')
    await findButton(wrapper, '编辑昵称')?.trigger('click')
    await flushPromises()
    await wrapper.get('input[placeholder="请输入昵称，留空可清除"]').setValue('新昵称')
    await findButton(wrapper, '保存昵称')?.trigger('click')
    await flushPromises()

    expect(accountApi.updateAccountNickname).toHaveBeenCalledWith(1, { nickname: '新昵称' })
    expect(wrapper.text()).toContain('账号“admin”的昵称已更新')
  })

  it('硬删除入口仅在账号停用后显示，需二次确认并展示 409 冲突提示', async () => {
    const deactivated = { ...editorAccount, nickname: null }
    vi.mocked(accountApi.listAccounts).mockResolvedValue([adminAccount, deactivated])
    vi.mocked(accountApi.deleteAccount).mockRejectedValue(
      Object.assign(new Error('Conflict'), {
        isAxiosError: true,
        response: {
          status: 409,
          data: { success: false, data: null, message: '不能删除最后一个启用管理员' },
        },
      }),
    )
    const wrapper = mountView()
    await flushPromises()

    const rows = wrapper.findAll('.el-table__body tr')
    expect(rows[0].findAll('button').map((button) => button.text())).not.toContain('硬删除')
    expect(rows[1].findAll('button').map((button) => button.text())).toContain('硬删除')

    await rows[1].findAll('button').find((button) => button.text() === '硬删除')?.trigger('click')
    await flushPromises()
    expect(accountApi.deleteAccount).not.toHaveBeenCalled()
    await confirmAction()

    expect(accountApi.deleteAccount).toHaveBeenCalledWith(2)
    expect(wrapper.text()).toContain('不能删除最后一个启用管理员')
  })
})
