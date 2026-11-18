import { flushPromises, mount } from '@vue/test-utils'
import ElementPlus from 'element-plus'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('../src/api/media', () => ({
  uploadMedia: vi.fn(),
}))

import * as mediaApi from '../src/api/media'
import MediaPicker from '../src/components/MediaPicker.vue'
import type { ConfirmedMediaVO } from '../src/types/media'

describe('媒体选择与上传', () => {
  const wrappers: ReturnType<typeof mount>[] = []

  beforeEach(() => {
    vi.resetAllMocks()
  })

  afterEach(() => {
    wrappers.forEach((wrapper) => wrapper.unmount())
    wrappers.length = 0
    document.body.innerHTML = ''
    vi.restoreAllMocks()
  })

  it('展示上传校验错误且不改变已选媒体', async () => {
    vi.mocked(mediaApi.uploadMedia).mockRejectedValue(
      new Error('只支持 JPEG、PNG 或 WebP 格式'),
    )
    const wrapper = mount(MediaPicker, {
      props: {
        modelValue: [],
        label: '轮播图',
        multiple: true,
        maxCount: 8,
      },
      global: { plugins: [ElementPlus] },
    })
    wrappers.push(wrapper)

    const fileInput = wrapper.get<HTMLInputElement>('input[type="file"]').element
    Object.defineProperty(fileInput, 'files', {
      value: [new File(['not an image'], 'sample.gif', { type: 'image/gif' })],
    })
    await wrapper.get('input[type="file"]').trigger('change')
    await flushPromises()

    expect(wrapper.text()).toContain('只支持 JPEG、PNG 或 WebP 格式')
    expect(mediaApi.uploadMedia).toHaveBeenCalledWith(
      expect.objectContaining({ name: 'sample.gif', type: 'image/gif' }),
    )
    expect(wrapper.emitted('update:modelValue')).toBeUndefined()
  })

  it('失败重试成功后才把已确认媒体加入选择', async () => {
    const confirmedMedia: ConfirmedMediaVO = {
      id: 304,
      originalFilename: 'photo.png',
      mediaType: 'image/png',
      byteSize: 4,
      status: 'CONFIRMED',
      publicUrl: '/api/v1/media/304',
    }
    vi.mocked(mediaApi.uploadMedia)
      .mockRejectedValueOnce(new Error('上传凭证已过期，请重试以重新申请'))
      .mockResolvedValueOnce(confirmedMedia)
    const wrapper = mount(MediaPicker, {
      props: {
        modelValue: [],
        label: '主图',
      },
      global: { plugins: [ElementPlus] },
    })
    wrappers.push(wrapper)
    const file = new File(['data'], 'photo.png', { type: 'image/png' })
    const fileInput = wrapper.get<HTMLInputElement>('input[type="file"]').element
    Object.defineProperty(fileInput, 'files', { value: [file] })

    await wrapper.get('input[type="file"]').trigger('change')
    await flushPromises()

    expect(wrapper.text()).toContain('上传凭证已过期')
    expect(wrapper.emitted('update:modelValue')).toBeUndefined()
    await wrapper.findAll('button').find((button) => button.text() === '重试')?.trigger('click')
    await flushPromises()

    expect(mediaApi.uploadMedia).toHaveBeenCalledTimes(2)
    expect(mediaApi.uploadMedia).toHaveBeenLastCalledWith(file)
    expect(wrapper.emitted('update:modelValue')?.[0]).toEqual([[confirmedMedia]])
    await wrapper.setProps({ modelValue: [confirmedMedia] })
    await flushPromises()
    expect(wrapper.text()).toContain('已确认')
  })

  it('轮播图达到八张上限后拒绝更多上传', async () => {
    const selectedMedia: ConfirmedMediaVO[] = Array.from({ length: 8 }, (_, index) => ({
      id: index + 1,
      originalFilename: `gallery-${index + 1}.png`,
      mediaType: 'image/png',
      byteSize: 4,
      status: 'CONFIRMED',
      publicUrl: `/api/v1/media/${index + 1}`,
    }))
    const wrapper = mount(MediaPicker, {
      props: {
        modelValue: selectedMedia,
        label: '轮播图',
        multiple: true,
        maxCount: 8,
      },
      global: { plugins: [ElementPlus] },
    })
    wrappers.push(wrapper)
    const fileInput = wrapper.get<HTMLInputElement>('input[type="file"]').element
    Object.defineProperty(fileInput, 'files', {
      value: [new File(['data'], 'extra.png', { type: 'image/png' })],
    })
    await wrapper.get('input[type="file"]').trigger('change')
    await flushPromises()

    expect(wrapper.text()).toContain('最多选择 8 张图片')
    expect(mediaApi.uploadMedia).not.toHaveBeenCalled()
    expect(wrapper.emitted('update:modelValue')).toBeUndefined()
  })

  it('单张媒体已选择时允许上传替换', async () => {
    const replacement: ConfirmedMediaVO = {
      id: 2,
      originalFilename: 'replacement.png',
      mediaType: 'image/png',
      byteSize: 4,
      status: 'CONFIRMED',
      publicUrl: '/api/v1/media/2',
    }
    vi.mocked(mediaApi.uploadMedia).mockResolvedValue(replacement)
    const wrapper = mount(MediaPicker, {
      props: {
        modelValue: [{
          id: 1,
          originalFilename: 'current.png',
          mediaType: 'image/png',
          byteSize: 4,
          status: 'CONFIRMED',
          publicUrl: '/api/v1/media/1',
        }],
        label: '主图',
      },
      global: { plugins: [ElementPlus] },
    })
    wrappers.push(wrapper)
    const fileInput = wrapper.get<HTMLInputElement>('input[type="file"]').element
    Object.defineProperty(fileInput, 'files', {
      value: [new File(['data'], 'replacement.png', { type: 'image/png' })],
    })
    await wrapper.get('input[type="file"]').trigger('change')
    await flushPromises()

    expect(mediaApi.uploadMedia).toHaveBeenCalledTimes(1)
    expect(wrapper.emitted('update:modelValue')?.[0]).toEqual([[replacement]])
  })
})
