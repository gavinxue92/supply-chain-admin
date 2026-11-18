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

function mediaUrl(media: ConfirmedMediaVO): string {
  return media.publicUrl || `/api/v1/media/${media.id}`
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
    <el-button
      type="primary"
      plain
      :disabled="activeFilename !== '' || (multiple && selectedCount >= maxCount)"
      @click="input?.click()"
    >
      上传{{ label }}
    </el-button>
    <span v-if="activeFilename" role="status">正在上传：{{ activeFilename }}</span>

    <ul v-if="modelValue.length" class="media-list">
      <li v-for="media in modelValue" :key="media.id">
        <el-image :src="mediaUrl(media)" fit="cover" class="media-preview" />
        <span>{{ media.originalFilename }}（已确认）</span>
        <el-button
          v-if="allowInsert"
          link
          type="primary"
          @click="emit('insert', media)"
        >
          插入详情
        </el-button>
        <el-button link type="danger" @click="removeMedia(media.id)">移除</el-button>
      </li>
    </ul>

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
  justify-items: start;
  gap: 8px;
}

.media-picker-heading,
.media-list li,
.upload-errors li {
  display: flex;
  align-items: center;
  gap: 10px;
}

.media-picker-heading {
  justify-content: space-between;
  width: 100%;
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

.media-list,
.upload-errors {
  display: grid;
  gap: 8px;
  padding: 0;
  margin: 0;
  list-style: none;
}

.media-preview {
  width: 48px;
  height: 48px;
  border-radius: 4px;
}

.upload-errors {
  color: #f56c6c;
}
</style>
