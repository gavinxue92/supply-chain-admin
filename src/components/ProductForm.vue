<script setup lang="ts">
import { computed, reactive, ref, watch } from 'vue'
import MediaPicker from './MediaPicker.vue'
import ProductRichTextEditor from './ProductRichTextEditor.vue'
import type { CategoryVO } from '../types/category'
import type { ConfirmedMediaVO } from '../types/media'
import type {
  ProductContactMode,
  ProductDraftRequest,
  ProductVO,
} from '../types/product'
import { getProductImageMediaIds, sanitizeProductHtml } from '../utils/product-html'

const props = withDefaults(
  defineProps<{
    product: ProductVO | null
    categories: CategoryVO[]
    saving?: boolean
    saveError?: string
  }>(),
  {
    saving: false,
    saveError: '',
  },
)

const emit = defineEmits<{
  save: [payload: ProductDraftRequest]
  cancel: []
}>()

const form = reactive<ProductDraftRequest>({
  name: '',
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
})
const keywordText = ref('')
const formError = ref('')
const mainImage = ref<ConfirmedMediaVO[]>([])
const galleryImages = ref<ConfirmedMediaVO[]>([])
const detailImages = ref<ConfirmedMediaVO[]>([])
const contactQrImage = ref<ConfirmedMediaVO[]>([])
const detailEditor = ref<InstanceType<typeof ProductRichTextEditor> | null>(null)

function mediaReference(mediaId: number, label: string): ConfirmedMediaVO {
  return {
    id: mediaId,
    originalFilename: `${label} #${mediaId}`,
    mediaType: 'image/*',
    byteSize: 0,
    status: 'CONFIRMED',
    publicUrl: `/api/v1/media/${mediaId}`,
  }
}

function initialize(product: ProductVO | null) {
  form.name = product?.name ?? ''
  form.categoryId = product?.categoryId ?? null
  form.detailText = product?.detailText ?? ''
  form.mainImageMediaId = product?.mainImageMediaId ?? null
  form.galleryMediaIds = [...(product?.galleryMediaIds ?? [])]
  form.keywords = [...(product?.keywords ?? [])]
  form.contactMode = product?.contactMode ?? 'INHERIT'
  form.contactWechatId = product?.contactWechatId ?? null
  form.contactQrMediaId = product?.contactQrMediaId ?? null
  form.sortOrder = product?.sortOrder ?? 0
  form.specifications = [...(product?.specifications ?? [])]
    .sort((left, right) => left.sortOrder - right.sortOrder)
    .map(({ name, referencePrice }) => ({ name, referencePrice }))
  keywordText.value = form.keywords.join('\n')
  mainImage.value = form.mainImageMediaId === null
    ? []
    : [mediaReference(form.mainImageMediaId, '主图')]
  galleryImages.value = form.galleryMediaIds.map((mediaId) =>
    mediaReference(mediaId, '轮播图'),
  )
  detailImages.value = getProductImageMediaIds(form.detailText).map((mediaId) =>
    mediaReference(mediaId, '详情图'),
  )
  contactQrImage.value = form.contactQrMediaId === null
    ? []
    : [mediaReference(form.contactQrMediaId, '客服二维码')]
  formError.value = ''
}

watch(() => props.product, initialize, { immediate: true, deep: true })

function hasChildren(categoryId: number): boolean {
  return props.categories.some((category) => category.parentId === categoryId)
}

const selectableCategories = computed(() => {
  const activeLeaves = props.categories.filter(
    (category) => category.active && !hasChildren(category.id),
  )
  const currentCategory = props.categories.find(
    (category) => category.id === form.categoryId,
  )
  if (
    currentCategory &&
    !activeLeaves.some((category) => category.id === currentCategory.id)
  ) {
    return [...activeLeaves, currentCategory]
  }
  return activeLeaves
})

const allowedMediaIds = computed(() => {
  const ids = [
    form.mainImageMediaId,
    ...form.galleryMediaIds,
    form.contactQrMediaId,
    ...getProductImageMediaIds(form.detailText),
    ...mainImage.value.map((media) => media.id),
    ...galleryImages.value.map((media) => media.id),
    ...detailImages.value.map((media) => media.id),
    ...contactQrImage.value.map((media) => media.id),
  ]
  return [...new Set(ids.filter((id): id is number => id !== null))]
})

function addSpecification() {
  form.specifications.push({ name: '', referencePrice: null })
}

function removeSpecification(index: number) {
  form.specifications.splice(index, 1)
}

function insertDetailImage(media: ConfirmedMediaVO) {
  detailEditor.value?.insertMedia(media)
}

function validateForm(): string | null {
  const name = form.name.trim()
  if (!name) return '产品名称不能为空'
  if (name.length > 200) return '产品名称不能超过 200 个字符'
  if (!Number.isInteger(form.sortOrder)) return '排序必须为整数'
  if (galleryImages.value.length > 8) return '轮播图最多选择八张'
  if (mainImage.value.length > 1) return '产品主图只能选择一张'

  for (const [index, specification] of form.specifications.entries()) {
    if (!specification.name.trim()) return `第 ${index + 1} 个规格名称不能为空`
    if (specification.name.trim().length > 120) {
      return `第 ${index + 1} 个规格名称不能超过 120 个字符`
    }
    if (
      specification.referencePrice !== null &&
      (!Number.isFinite(specification.referencePrice) ||
        specification.referencePrice <= 0 ||
        Math.abs(
          specification.referencePrice * 100 -
            Math.round(specification.referencePrice * 100),
        ) > 1e-8)
    ) {
      return `第 ${index + 1} 个规格参考价必须大于零且最多两位小数`
    }
  }

  if (form.contactMode === 'OVERRIDE') {
    if (!form.contactWechatId?.trim() && contactQrImage.value.length === 0) {
      return '覆盖客服时至少填写微信号或上传客服二维码'
    }
  }
  return null
}

function submit() {
  formError.value = ''
  if (props.saving) return
  const validationError = validateForm()
  if (validationError) {
    formError.value = validationError
    return
  }

  const contactMode: ProductContactMode = form.contactMode
  const detailText = sanitizeProductHtml(form.detailText, allowedMediaIds.value)
  const payload: ProductDraftRequest = {
    name: form.name.trim(),
    categoryId: form.categoryId,
    detailText,
    mainImageMediaId: mainImage.value[0]?.id ?? null,
    galleryMediaIds: galleryImages.value.map((media) => media.id),
    keywords: keywordText.value
      .split(/\r?\n/)
      .map((keyword) => keyword.trim())
      .filter(Boolean),
    contactMode,
    contactWechatId:
      contactMode === 'OVERRIDE' ? form.contactWechatId?.trim() || null : null,
    contactQrMediaId:
      contactMode === 'OVERRIDE' ? contactQrImage.value[0]?.id ?? null : null,
    sortOrder: form.sortOrder,
    specifications: form.specifications.map((specification) => ({
      name: specification.name.trim(),
      referencePrice: specification.referencePrice,
    })),
  }
  emit('save', payload)
}
</script>

<template>
  <el-form label-width="120px" @submit.prevent="submit">
    <el-form-item label="产品名称" required>
      <el-input
        v-model="form.name"
        placeholder="请输入产品名称"
        maxlength="200"
        show-word-limit
      />
    </el-form-item>
    <el-form-item label="启用末级分类">
      <el-select v-model="form.categoryId" clearable placeholder="请选择启用的末级分类">
        <el-option
          v-for="category in selectableCategories"
          :key="category.id"
          :label="`${category.name}${category.active && !hasChildren(category.id) ? '' : '（当前分类不可再选）'}`"
          :value="category.id"
          :disabled="!category.active || hasChildren(category.id)"
        />
      </el-select>
    </el-form-item>
    <el-form-item label="主图">
      <MediaPicker v-model="mainImage" label="主图" />
    </el-form-item>
    <el-form-item label="轮播图">
      <MediaPicker
        v-model="galleryImages"
        label="轮播图"
        multiple
        :max-count="8"
      />
    </el-form-item>
    <el-form-item label="产品详情">
      <div class="detail-editor">
        <ProductRichTextEditor
          ref="detailEditor"
          v-model="form.detailText"
          :allowed-media-ids="allowedMediaIds"
        />
        <MediaPicker
          v-model="detailImages"
          label="详情图片"
          multiple
          allow-insert
          @insert="insertDetailImage"
        />
      </div>
    </el-form-item>
    <el-form-item label="关键词">
      <el-input
        v-model="keywordText"
        type="textarea"
        :rows="3"
        placeholder="每行输入一个关键词"
      />
    </el-form-item>
    <el-form-item label="排序">
      <el-input-number v-model="form.sortOrder" :step="1" :precision="0" aria-label="产品排序" />
    </el-form-item>

    <el-form-item label="规格">
      <div class="specification-editor">
        <div v-for="(specification, index) in form.specifications" :key="index" class="specification-row">
          <el-input
            v-model="specification.name"
            placeholder="请输入规格名称"
            maxlength="120"
          />
          <el-input-number
            v-model="specification.referencePrice"
            :min="0.01"
            :step="0.01"
            :precision="2"
            placeholder="参考价（可空）"
            aria-label="规格参考价"
          />
          <el-button link type="danger" @click="removeSpecification(index)">删除</el-button>
        </div>
        <el-button plain @click="addSpecification">添加规格</el-button>
      </div>
    </el-form-item>

    <el-form-item label="客服策略">
      <el-select v-model="form.contactMode">
        <el-option label="继承全局客服" value="INHERIT" />
        <el-option label="覆盖全局客服" value="OVERRIDE" />
        <el-option label="关闭客服入口" value="DISABLED" />
      </el-select>
    </el-form-item>
    <template v-if="form.contactMode === 'OVERRIDE'">
      <el-form-item label="客服微信号">
        <el-input v-model="form.contactWechatId" placeholder="请输入客服微信号" />
      </el-form-item>
      <el-form-item label="客服二维码">
        <MediaPicker v-model="contactQrImage" label="客服二维码" />
      </el-form-item>
    </template>

    <el-alert
      v-if="formError || saveError"
      :title="formError || saveError"
      type="error"
      show-icon
      :closable="false"
      class="form-error"
    />
    <div class="form-actions">
      <el-button @click="emit('cancel')">取消</el-button>
      <el-button type="primary" :loading="saving" @click="submit">
        {{ product ? '保存产品' : '保存草稿' }}
      </el-button>
    </div>
  </el-form>
</template>

<style scoped>
.detail-editor,
.specification-editor {
  display: grid;
  width: 100%;
  gap: 12px;
}

.specification-row {
  display: grid;
  grid-template-columns: minmax(120px, 1fr) minmax(140px, 220px) auto;
  align-items: center;
  gap: 8px;
}

.form-error {
  margin: 12px 0;
}

.form-actions {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
}

@media (max-width: 720px) {
  .specification-row {
    grid-template-columns: 1fr;
  }
}
</style>
