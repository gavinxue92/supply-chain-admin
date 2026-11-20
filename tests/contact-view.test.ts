import { flushPromises, mount } from '@vue/test-utils'
import ElementPlus, { ElMessageBox } from 'element-plus'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('../src/api/contact', () => ({
  listCustomerServices: vi.fn(),
  createCustomerService: vi.fn(),
  updateCustomerService: vi.fn(),
  setCustomerServiceActive: vi.fn(),
  deleteCustomerService: vi.fn(),
  getGlobalContact: vi.fn(),
  saveGlobalContact: vi.fn(),
}))

import * as contactApi from '../src/api/contact'
import ContactView from '../src/views/ContactView.vue'
import type { CustomerServiceVO } from '../src/types/contact'

describe('客服配置页面', () => {
  const wrappers: ReturnType<typeof mount>[] = []

  function service(overrides: Partial<CustomerServiceVO> = {}): CustomerServiceVO {
    return {
      id: 301,
      displayName: '客服小李',
      wechatId: 'kefu-li',
      qrMediaId: null,
      qrImageUrl: null,
      phone: '13800138000',
      active: true,
      ...overrides,
    }
  }

  function mountView() {
    const wrapper = mount(ContactView, { global: { plugins: [ElementPlus] } })
    wrappers.push(wrapper)
    return wrapper
  }

  function findButton(wrapper: ReturnType<typeof mount>, text: string) {
    return wrapper.findAll('button').find((button) => button.text() === text)
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
    vi.mocked(contactApi.listCustomerServices).mockResolvedValue([])
    vi.mocked(contactApi.getGlobalContact).mockResolvedValue(null)
  })

  afterEach(() => {
    wrappers.forEach((wrapper) => wrapper.unmount())
    wrappers.length = 0
    document.body.innerHTML = ''
    vi.restoreAllMocks()
  })

  it('未配置客服联系人和全局客服时展示明确空状态', async () => {
    const wrapper = mountView()
    await flushPromises()

    expect(wrapper.text()).toContain('暂无客服联系人')
    expect(wrapper.text()).toContain('尚未配置全局客服')
    expect(wrapper.text()).toContain('新建客服联系人')
    expect(wrapper.text()).toContain('保存全局客服')
  })

  it('创建客服联系人时校验联系方式和手机号格式，并提交手机号', async () => {
    const wrapper = mountView()
    await flushPromises()
    await findButton(wrapper, '新建客服联系人')?.trigger('click')
    await flushPromises()

    await findButton(wrapper, '保存客服联系人')?.trigger('click')
    await flushPromises()
    expect(contactApi.createCustomerService).not.toHaveBeenCalled()
    expect(wrapper.text()).toContain('客服名称不能为空')

    await wrapper.get('input[placeholder="请输入客服名称"]').setValue('客服小王')
    await findButton(wrapper, '保存客服联系人')?.trigger('click')
    await flushPromises()
    expect(wrapper.text()).toContain('微信号、手机号和二维码至少填写一项')

    await wrapper.get('input[placeholder="请输入中国大陆手机号"]').setValue('12345')
    await findButton(wrapper, '保存客服联系人')?.trigger('click')
    await flushPromises()
    expect(wrapper.text()).toContain('手机号须为有效的中国大陆手机号')

    await wrapper.get('input[placeholder="请输入中国大陆手机号"]').setValue('13900139000')
    vi.mocked(contactApi.createCustomerService).mockResolvedValue(service({ phone: '13900139000' }))
    await findButton(wrapper, '保存客服联系人')?.trigger('click')
    await flushPromises()

    expect(contactApi.createCustomerService).toHaveBeenCalledWith({
      displayName: '客服小王',
      wechatId: null,
      phone: '13900139000',
      qrMediaId: null,
    })
    expect(wrapper.text()).toContain('客服联系人“客服小王”已创建')
  })

  it('编辑客服联系人时回显手机号并提交更新', async () => {
    vi.mocked(contactApi.listCustomerServices).mockResolvedValue([service()])
    vi.mocked(contactApi.updateCustomerService).mockResolvedValue(service({ phone: '13700137000' }))
    const wrapper = mountView()
    await flushPromises()

    expect(wrapper.text()).toContain('13800138000')
    await findButton(wrapper, '编辑')?.trigger('click')
    await flushPromises()
    expect(wrapper.get<HTMLInputElement>('input[placeholder="请输入中国大陆手机号"]').element.value)
      .toBe('13800138000')

    await wrapper.get('input[placeholder="请输入中国大陆手机号"]').setValue('13700137000')
    await findButton(wrapper, '保存客服联系人')?.trigger('click')
    await flushPromises()

    expect(contactApi.updateCustomerService).toHaveBeenCalledWith(301, {
      displayName: '客服小李',
      wechatId: 'kefu-li',
      phone: '13700137000',
      qrMediaId: null,
    })
  })

  it('停用和硬删除客服联系人均需二次确认', async () => {
    vi.mocked(contactApi.listCustomerServices).mockResolvedValue([service()])
    vi.mocked(contactApi.setCustomerServiceActive).mockResolvedValue()
    vi.mocked(contactApi.deleteCustomerService).mockResolvedValue()
    vi.spyOn(ElMessageBox, 'confirm')
    const wrapper = mountView()
    await flushPromises()

    await findButton(wrapper, '停用')?.trigger('click')
    await flushPromises()
    expect(contactApi.setCustomerServiceActive).not.toHaveBeenCalled()
    await confirmAction()
    expect(contactApi.setCustomerServiceActive).toHaveBeenCalledWith(301, { active: false })

    await findButton(wrapper, '硬删除')?.trigger('click')
    await flushPromises()
    expect(contactApi.deleteCustomerService).not.toHaveBeenCalled()
    await confirmAction()
    expect(contactApi.deleteCustomerService).toHaveBeenCalledWith(301)
  })

  it('全局客服按客服联系人 ID 列表提交，且不允许选择停用客服', async () => {
    vi.mocked(contactApi.listCustomerServices).mockResolvedValue([
      service(),
      service({ id: 302, displayName: '停用客服', wechatId: null, phone: null, active: false }),
    ])
    vi.mocked(contactApi.saveGlobalContact).mockRejectedValue(
      Object.assign(new Error('Invalid contact'), {
        isAxiosError: true,
        response: {
          status: 400,
          data: { success: false, data: null, message: '客服联系人未启用' },
        },
      }),
    )
    const wrapper = mountView()
    await flushPromises()

    await findButton(wrapper, '保存全局客服')?.trigger('click')
    await flushPromises()
    expect(contactApi.saveGlobalContact).not.toHaveBeenCalled()
    expect(wrapper.text()).toContain('请至少选择一个已启用客服联系人')

    const select = wrapper.find('.contact-service-select .el-select__wrapper')
    await select.trigger('click')
    await flushPromises()
    const optionLabels = Array.from(document.body.querySelectorAll('.el-select-dropdown__item'))
      .map((item) => item.textContent ?? '')
    expect(optionLabels.some((label) => label.includes('停用客服'))).toBe(false)
    expect(optionLabels.some((label) => label.includes('客服小李'))).toBe(true)

    const enabled = Array.from(document.body.querySelectorAll('.el-select-dropdown__item'))
      .find((item) => item.textContent?.includes('客服小李'))
    enabled?.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    await flushPromises()
    await findButton(wrapper, '保存全局客服')?.trigger('click')
    await flushPromises()

    expect(contactApi.saveGlobalContact).toHaveBeenCalledWith({ serviceIds: [301] })
    expect(wrapper.text()).toContain('客服联系人未启用')
  })

  it('无权读取客服配置时展示 403 明确反馈', async () => {
    vi.mocked(contactApi.listCustomerServices).mockRejectedValue(
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
})
