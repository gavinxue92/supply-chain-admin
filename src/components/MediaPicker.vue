<script setup lang="ts">
import { computed, ref } from 'vue'
import { uploadMedia } from '../api/media'
import type { ConfirmedMediaVO } from '../types/media'

interface FailedUpload {
  id: number
  file: File
  message: string
}

const props = withDefaults(
  defineProps<{
    modelValue: ConfirmedMediaVO[]
    label: string
    multiple?: boolean
    maxCount?: number
    allowInsert?: boolean
  }>(),
  {
    multiple: false,
    maxCount: 1,
    allowInsert: false,
  },
)

const emit = defineEmits<{
  'update:modelValue': [media: ConfirmedMediaVO[]]
  insert: [media: ConfirmedMediaVO]
}>()

const input = ref<HTMLInputElement | null>(null)
const activeFilename = ref('')
const failedUploads = ref<FailedUpload[]>([])
const nextFailureId = ref(0)
const selectedCount = computed(() => props.modelValue.length)
const accept = 'image/jpeg,image/png,image/webp'
const uploadDisabled = computed(
  () => activeFilename.value !== '' || (props.multiple && selectedCount.value >= props.maxCount),
)

function mediaUrl(media: ConfirmedMediaVO): string {
  return media.publicUrl || `/api/v1/media/${media.id}`
}

function openFilePicker() {
  if (!uploadDisabled.value) input.value?.click()
}

function removeMedia(mediaId: number) {
  emit(
    'update:modelValue',
    props.modelValue.filter((media) => media.id !== mediaId),
  )
}

async function uploadFile(file: File, failureId?: number) {
  activeFilename.value = file.name
  failedUploads.value = failedUploads.value.filter((failed) => failed.id !== failureId)
  try {
    const media = await uploadMedia(file)
    if (props.multiple) {
      if (!props.modelValue.some((item) => item.id === media.id)) {
        emit('update:modelValue', [...props.modelValue, media])
      }
    } else {
      emit('update:modelValue', [media])
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : '媒体上传失败，请重试'
    failedUploads.value = [
      ...failedUploads.value,
      { id: nextFailureId.value++, file, message },
    ]
  } finally {
    activeFilename.value = ''
  }
}

async function handleFileSelection(event: Event) {
  const target = event.target
  if (!(target instanceof HTMLInputElement)) return

  const files = Array.from(target.files ?? [])
  target.value = ''
  if (files.length === 0) return

  const availableCount = props.multiple
    ? Math.max(0, props.maxCount - selectedCount.value)
    : 1
  if (files.length > availableCount) {
    failedUploads.value = [
      ...failedUploads.value,
      {
        id: nextFailureId.value++,
        file: files[0],
        message: `最多选择 ${props.maxCount} 张图片`,
      },
    ]
    return
  }

  for (const file of files) {
    await uploadFile(file)
  }
}
</script>

<template>
  <section class="media-picker" :aria-label="label">
    <div class="media-picker-heading">
      <strong>{{ label }}</strong>
      <span>{{ selectedCount }} / {{ maxCount }}</span>
    </div>
    <input
      ref="input"
      class="media-file-input"
      type="file"
      :accept="accept"
      :multiple="multiple"
      :aria-label="`上传${label}`"
      @change="handleFileSelection"
    />

    <div
      class="media-upload-box"
      :class="{ 'is-disabled': uploadDisabled, 'has-media': modelValue.length > 0 }"
      role="button"
      tabindex="0"
      @click="openFilePicker"
      @keydown.enter.prevent="openFilePicker"
      @keydown.space.prevent="openFilePicker"
    >
      <template v-if="modelValue.length === 0">
        <svg class="upload-icon" viewBox="0 0 24 24" aria-hidden="true">
          <path d="M12 16V4m0 0L8 8m4-4 4 4" />
          <path d="M4 16v3a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-3" />
        </svg>
        <span>上传{{ label }}</span>
        <small class="media-tip">可直接拍照或从相册选择</small>
      </template>
      <div v-else class="media-preview-grid">
        <div v-for="media in modelValue" :key="media.id" class="media-preview-item">
          <span class="media-preview-wrap" @click.stop>
            <el-image
              :src="mediaUrl(media)"
              fit="cover"
              class="media-preview"
              :preview-src-list="[mediaUrl(media)]"
            />
          </span>
          <span class="media-confirmed">已确认</span>
          <div class="media-preview-actions">
            <el-button
              v-if="allowInsert"
              link
              type="primary"
              @click.stop="emit('insert', media)"
            >
              插入详情
            </el-button>
            <el-button link type="danger" @click.stop="removeMedia(media.id)">移除</el-button>
          </div>
        </div>
      </div>
    </div>

    <span v-if="activeFilename" role="status">正在上传：{{ activeFilename }}</span>

    <ul v-if="failedUploads.length" class="upload-errors" aria-live="polite">
      <li v-for="failed in failedUploads" :key="failed.id">
        <span>{{ failed.file.name }}：{{ failed.message }}</span>
        <el-button
          link
          type="primary"
          :disabled="activeFilename !== ''"
          @click="uploadFile(failed.file, failed.id)"
        >
          重试
        </el-button>
      </li>
    </ul>
  </section>
</template>

<style scoped>
.media-picker {
  display: grid;
  gap: 8px;
  min-width: 0;
}

.media-picker-heading {
  display: flex;
  align-items: center;
  justify-content: space-between;
  font-size: 13px;
  color: var(--app-text);
}

.media-picker-heading span {
  color: var(--app-text-muted);
  font-size: 12px;
}

.media-file-input {
  position: absolute;
  width: 1px;
  height: 1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  white-space: nowrap;
  clip-path: inset(50%);
}

.media-upload-box {
  min-height: 96px;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 12px;
  border: 1px dashed var(--el-color-primary-light-5);
  border-radius: 10px;
  background: var(--app-surface-soft);
  color: var(--el-color-primary);
  font-size: 13px;
  cursor: pointer;
  transition: border-color 0.15s ease, background 0.15s ease;
}

.media-upload-box:hover {
  border-color: var(--el-color-primary);
  background: var(--app-brand-soft);
}

.media-upload-box.is-disabled {
  cursor: not-allowed;
  opacity: 0.65;
}

.media-upload-box.has-media {
  align-items: stretch;
  justify-content: flex-start;
}

.upload-icon {
  width: 20px;
  height: 20px;
  fill: none;
  stroke: currentColor;
  stroke-width: 1.8;
  stroke-linecap: round;
  stroke-linejoin: round;
}

.media-preview-grid {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  width: 100%;
}

.media-preview-item {
  display: grid;
  justify-items: center;
  gap: 4px;
  min-width: 0;
}

.media-preview-wrap {
  display: inline-flex;
}

.media-preview {
  width: 64px;
  height: 64px;
  border-radius: 8px;
}

.media-confirmed {
  font-size: 11px;
  color: var(--el-color-primary);
}

.media-preview-actions {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 11px;
}

.media-preview-actions .el-button {
  height: auto;
  padding: 0;
  font-size: 11px;
}

.upload-errors {
  display: grid;
  gap: 6px;
  padding: 0;
  margin: 0;
  list-style: none;
  color: var(--el-color-danger);
  font-size: 12px;
}

.upload-errors li {
  display: flex;
  align-items: center;
  gap: 8px;
}

/* 桌面端不显示，手机端才提示"可拍照" */
.media-tip {
  display: none;
  color: var(--app-text-muted);
  font-size: 11px;
}

@media (max-width: 899px) {
  .media-upload-box {
    min-height: 112px;
    flex-direction: column;
    gap: 6px;
  }

  /* 已有图片时是横向排布的缩略图区，不要再竖排 */
  .media-upload-box.has-media {
    flex-direction: row;
    min-height: 0;
    padding: 10px;
  }

  .media-tip {
    display: block;
  }

  .media-preview {
    width: 88px;
    height: 88px;
  }

  .media-preview-item {
    gap: 6px;
  }

  .media-preview-actions {
    gap: 10px;
    font-size: 12px;
  }

  /* 桌面 11px 的小链接在手机上按不准，抬到 40px 触摸高度 */
  .media-preview-actions .el-button {
    min-height: 40px;
    padding: 0 8px;
    font-size: 12px;
  }

  .upload-errors li {
    flex-wrap: wrap;
    gap: 6px;
  }

  .upload-errors .el-button {
    min-height: 40px;
  }
}
</style>
