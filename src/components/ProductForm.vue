<script setup lang="ts">
import { computed, reactive, ref, watch } from 'vue'
import MediaPicker from './MediaPicker.vue'
import ProductRichTextEditor from './ProductRichTextEditor.vue'
import type { CategoryVO } from '../types/category'
import type { CustomerServiceVO } from '../types/contact'
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
    customerServices?: CustomerServiceVO[]
    saving?: boolean
    saveError?: string
  }>(),
  {
    customerServices: () => [],
    saving: false,
    saveError: '',
  },
)

const emit = defineEmits<{
  save: [payload: ProductDraftRequest]
  cancel: []
}>()

type ProductFormState = Omit<ProductDraftRequest, 'contactMode'>

const form = reactive<ProductFormState>({
  name: '',
  categoryId: null,
  detailText: '',
  mainImageMediaId: null,
  galleryMediaIds: [],
  keywords: [],
  contactServiceIds: [],
  sortOrder: 0,
  specifications: [],
})
const selectedRootId = ref<number | null>(null)
const keywordText = ref('')
const formError = ref('')
const mainImage = ref<ConfirmedMediaVO[]>([])
const galleryImages = ref<ConfirmedMediaVO[]>([])
const detailImages = ref<ConfirmedMediaVO[]>([])
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
  const currentCategory = product?.categoryId == null
    ? undefined
    : props.categories.find((category) => category.id === product.categoryId)
  selectedRootId.value = currentCategory?.parentId ?? null
  form.contactServiceIds = [...(product?.contactServiceIds ?? [])]
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
  formError.value = ''
}

watch(() => props.product, initialize, { immediate: true, deep: true })

const rootCategories = computed(() =>
  props.categories.filter((category) => category.parentId === null || category.parentId === undefined),
)

const secondLevelCategories = computed(() =>
  selectedRootId.value === null
    ? []
    : props.categories.filter((category) => category.parentId === selectedRootId.value),
)

const selectableSecondLevelCategories = computed(() => {
  const active = secondLevelCategories.value.filter((category) => category.active)
  const current = props.categories.find((category) => category.id === form.categoryId)
  if (
    current &&
    current.parentId === selectedRootId.value &&
    !active.some((category) => category.id === current.id)
  ) {
    return [...active, current]
  }
  return active
})

function onRootCategoryChange(value: number | null | undefined) {
  selectedRootId.value = value ?? null
  form.categoryId = null
}

const allowedMediaIds = computed(() => {
  const ids = [
    form.mainImageMediaId,
    ...form.galleryMediaIds,
    ...getProductImageMediaIds(form.detailText),
    ...mainImage.value.map((media) => media.id),
    ...galleryImages.value.map((media) => media.id),
    ...detailImages.value.map((media) => media.id),
  ]
  return [...new Set(ids.filter((id): id is number => id !== null))]
})

const resolvedContactMode = computed<ProductContactMode>(() => {
  if (form.contactServiceIds.length > 0) return 'OVERRIDE'
  return props.product?.contactMode === 'DISABLED' ? 'DISABLED' : 'INHERIT'
})

const contactServiceOptions = computed(() => {
  const selected = new Set(form.contactServiceIds)
  return props.customerServices.filter((service) => service.active || selected.has(service.id))
})

function contactServiceLabel(service: CustomerServiceVO): string {
  const contact = service.phone || service.wechatId || '未填写联系方式'
  return `${service.displayName}（${service.active ? '已启用' : '已停用'}，${contact}）`
}

const progressItems = computed(() => {
  const detailText = form.detailText.replace(/<[^>]*>/g, '').trim()
  return [
    {
      key: 'basic',
      label: '基础信息',
      done: form.name.trim().length > 0 && form.categoryId !== null,
    },
    {
      key: 'images',
      label: '图片素材',
      done: mainImage.value.length > 0,
    },
    {
      key: 'detail',
      label: '产品详情',
      done: detailText.length > 0,
    },
    {
      key: 'specs',
      label: '规格',
      done: form.specifications.some((specification) => specification.name.trim().length > 0),
    },
    {
      key: 'publish',
      label: '发布设置',
      done: keywordText.value.trim().length > 0,
    },
    {
      key: 'contact',
      label: '客服挂载',
      done: form.contactServiceIds.length > 0,
    },
  ]
})

const completedCount = computed(() => progressItems.value.filter((item) => item.done).length)
const remainingCount = computed(() => progressItems.value.length - completedCount.value)
const progressPercent = computed(() =>
  Math.round((completedCount.value / progressItems.value.length) * 100),
)

function addSpecification() {
  form.specifications.push({ name: '', referencePrice: null })
}

function removeSpecification(index: number) {
  form.specifications.splice(index, 1)
}

function stepSortOrder(delta: number) {
  const next = Number(form.sortOrder) + delta
  form.sortOrder = Number.isFinite(next) ? next : 0
}

function insertDetailImage(media: ConfirmedMediaVO) {
  detailEditor.value?.insertMedia(media)
}

function validateForm(): string | null {
  const name = form.name.trim()
  if (!name) return '产品名称不能为空'
  if (name.length > 200) return '产品名称不能超过 200 个字符'
  if (!Number.isInteger(form.sortOrder)) return '排序必须为整数'
  if (selectedRootId.value !== null && form.categoryId === null) return '请选择二级分类'
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

  if (form.contactServiceIds.length > 0) {
    const availableIds = new Set(contactServiceOptions.value.map((service) => service.id))
    if (form.contactServiceIds.some((id) => !availableIds.has(id))) {
      return '所选客服联系人不可用，请重新选择'
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

  const contactMode: ProductContactMode = resolvedContactMode.value
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
    contactServiceIds: contactMode === 'OVERRIDE' ? [...form.contactServiceIds] : [],
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
  <el-form class="draft-form" label-position="top" @submit.prevent="submit">
    <svg class="icon-sprite" aria-hidden="true">
      <symbol id="draft-icon-doc" viewBox="0 0 24 24">
        <rect x="4" y="3" width="16" height="18" rx="2" />
        <path d="M8 8h8M8 12h8M8 16h5" />
      </symbol>
      <symbol id="draft-icon-image" viewBox="0 0 24 24">
        <rect x="3" y="4" width="18" height="16" rx="2" />
        <circle cx="9" cy="10" r="2" />
        <path d="m4 18 5-5 4 4 3-3 4 4" />
      </symbol>
      <symbol id="draft-icon-article" viewBox="0 0 24 24">
        <rect x="4" y="3" width="16" height="18" rx="2" />
        <path d="M8 8h8M8 12h8M8 16h6" />
      </symbol>
      <symbol id="draft-icon-progress" viewBox="0 0 24 24">
        <circle cx="12" cy="12" r="9" />
        <path d="M12 7v5l3.5 2" />
      </symbol>
      <symbol id="draft-icon-settings" viewBox="0 0 24 24">
        <path d="M5 7h14M5 12h14M5 17h14" />
        <circle cx="9" cy="7" r="2" />
        <circle cx="15" cy="12" r="2" />
        <circle cx="11" cy="17" r="2" />
      </symbol>
    </svg>

    <div class="draft-grid">
      <div class="draft-main">
        <section class="form-card">
          <header class="card-header">
            <svg class="card-icon"><use href="#draft-icon-doc" /></svg>
            <strong>基础信息</strong>
            <span class="required-tag">必填</span>
          </header>
          <div class="field-label">产品名称 <em>*</em></div>
          <el-input
            v-model="form.name"
            placeholder="请输入产品名称"
            maxlength="200"
            show-word-limit
          />
          <div class="field-row">
            <div>
              <div class="field-label">一级分类</div>
              <el-select
                :model-value="selectedRootId"
                clearable
                placeholder="请选择一级分类"
                class="category-select"
                popper-class="product-form-root-popper"
                @update:model-value="onRootCategoryChange"
              >
                <el-option
                  v-for="category in rootCategories"
                  :key="category.id"
                  :label="`${category.name}${category.active ? '' : '（已停用）'}`"
                  :value="category.id"
                  :disabled="!category.active"
                />
              </el-select>
            </div>
            <div>
              <div class="field-label">二级分类</div>
              <el-select
                v-model="form.categoryId"
                clearable
                placeholder="请选择二级分类"
                class="category-select"
                popper-class="product-form-second-popper"
                :disabled="selectedRootId === null || selectableSecondLevelCategories.length === 0"
              >
                <el-option
                  v-for="category in selectableSecondLevelCategories"
                  :key="category.id"
                  :label="`${category.name}${category.active ? '' : '（当前分类已停用）'}`"
                  :value="category.id"
                  :disabled="!category.active"
                />
              </el-select>
            </div>
          </div>
        </section>

        <section class="form-card">
          <header class="card-header">
            <svg class="card-icon"><use href="#draft-icon-image" /></svg>
            <strong>图片素材</strong>
            <span class="card-hint">支持 JPG/PNG，单张不超过 5MB</span>
          </header>
          <div class="image-grid">
            <MediaPicker v-model="mainImage" label="主图" />
            <MediaPicker
              v-model="galleryImages"
              label="轮播图"
              multiple
              :max-count="8"
            />
            <MediaPicker
              v-model="detailImages"
              label="详情图片"
              multiple
              :max-count="1"
              allow-insert
              @insert="insertDetailImage"
            />
          </div>
        </section>

        <section class="form-card">
          <header class="card-header">
            <svg class="card-icon"><use href="#draft-icon-article" /></svg>
            <strong>产品详情</strong>
          </header>
          <ProductRichTextEditor
            ref="detailEditor"
            v-model="form.detailText"
            :allowed-media-ids="allowedMediaIds"
          />
        </section>
      </div>

      <aside class="draft-side">
        <section class="form-card progress-card">
          <header class="card-header">
            <svg class="card-icon"><use href="#draft-icon-progress" /></svg>
            <strong>填写进度</strong>
            <span class="live-tag">实时</span>
          </header>
          <p class="progress-summary">
            <strong>{{ completedCount }}/{{ progressItems.length }}</strong>
            项必填内容已完成
            <span>还有 {{ remainingCount }} 项待补充</span>
          </p>
          <div class="progress-track">
            <div class="progress-fill" :style="{ width: `${progressPercent}%` }" />
          </div>
          <ul class="progress-list">
            <li
              v-for="item in progressItems"
              :key="item.key"
              :class="{ 'is-done': item.done }"
            >
              <span class="progress-mark">{{ item.done ? '✓' : '' }}</span>
              {{ item.label }}
            </li>
          </ul>
        </section>

        <section class="form-card">
          <header class="card-header">
            <svg class="card-icon"><use href="#draft-icon-settings" /></svg>
            <strong>发布设置</strong>
          </header>
          <div class="field-label">关键词</div>
          <el-input
            v-model="keywordText"
            type="textarea"
            :rows="3"
            placeholder="每行输入一个关键词"
          />
          <div class="field-label sort-label">排序</div>
          <div class="sort-stepper">
            <el-button aria-label="减少排序" @click="stepSortOrder(-1)">−</el-button>
            <el-input-number
              v-model="form.sortOrder"
              :controls="false"
              :step="1"
              :precision="0"
              aria-label="产品排序"
            />
            <el-button aria-label="增加排序" @click="stepSortOrder(1)">+</el-button>
          </div>
          <div class="field-label spec-label">规格</div>
          <el-button class="add-spec-button" plain @click="addSpecification">
            添加规格
          </el-button>
          <div class="specification-editor">
            <div
              v-for="(specification, index) in form.specifications"
              :key="index"
              class="specification-row"
            >
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
          </div>
          <div class="field-label contact-label">挂载客服</div>
          <el-select
            v-model="form.contactServiceIds"
            multiple
            filterable
            collapse-tags
            placeholder="请选择已配置的客服联系人"
            class="contact-service-select"
          >
            <el-option
              v-for="service in contactServiceOptions"
              :key="service.id"
              :label="contactServiceLabel(service)"
              :value="service.id"
              :disabled="!service.active"
            />
          </el-select>
          <div class="contact-service-help">
            选择客服后产品展示所选客服；不选时沿用当前设置（新建产品默认继承全局客服）。仅已启用客服可新挂载，已停用的既有挂载会保留。
          </div>
        </section>
      </aside>
    </div>

    <el-alert
      v-if="formError || saveError"
      :title="formError || saveError"
      type="error"
      show-icon
      :closable="false"
      class="form-error"
    />

    <footer class="draft-footer">
      <span class="draft-note">带 * 为必填项，草稿保存后不会上架产品</span>
      <div class="form-actions">
        <el-button @click="emit('cancel')">取消</el-button>
        <el-button type="primary" :loading="saving" @click="submit">
          {{ product ? '保存产品' : '保存草稿' }}
        </el-button>
      </div>
    </footer>
  </el-form>
</template>

<style scoped>
.icon-sprite {
  position: absolute;
  width: 0;
  height: 0;
  overflow: hidden;
}

.card-icon {
  width: 18px;
  height: 18px;
  fill: none;
  stroke: var(--el-color-primary);
  stroke-width: 1.7;
  stroke-linecap: round;
  stroke-linejoin: round;
}

.draft-form {
  display: grid;
  gap: 16px;
}

.draft-grid {
  display: grid;
  grid-template-columns: minmax(0, 1.35fr) minmax(280px, 0.85fr);
  gap: 16px;
  align-items: start;
}

.draft-main,
.draft-side {
  display: grid;
  gap: 16px;
  min-width: 0;
}

.form-card {
  padding: 18px;
  border: 1px solid var(--app-border);
  border-radius: 12px;
  background: var(--app-surface);
}

.card-header {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 16px;
  font-size: 14px;
  color: var(--app-text);
}

.required-tag,
.live-tag {
  padding: 2px 8px;
  border-radius: 10px;
  background: var(--app-brand-soft);
  color: var(--el-color-primary);
  font-size: 11px;
}

.live-tag {
  margin-left: auto;
}

.card-hint {
  margin-left: auto;
  color: var(--app-text-muted);
  font-size: 12px;
}

.field-label {
  margin-bottom: 6px;
  color: var(--app-text);
  font-size: 13px;
}

.field-label em {
  color: var(--el-color-danger);
  font-style: normal;
}

.field-row {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 12px;
  margin-top: 14px;
}

.image-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 12px;
}

.category-select,
.contact-service-select {
  width: 100%;
}

.progress-card {
  background: linear-gradient(180deg, var(--app-brand-soft), var(--app-surface));
}

.progress-summary {
  margin: 0 0 12px;
  font-size: 13px;
  color: var(--app-text);
}

.progress-summary strong {
  color: var(--el-color-primary);
  font-size: 20px;
}

.progress-summary span {
  display: block;
  margin-top: 4px;
  color: var(--app-text-muted);
  font-size: 12px;
}

.progress-track {
  height: 6px;
  border-radius: 3px;
  background: var(--app-border);
  overflow: hidden;
}

.progress-fill {
  height: 100%;
  border-radius: 3px;
  background: var(--el-color-primary);
  transition: width 0.2s ease;
}

.progress-list {
  display: grid;
  gap: 10px;
  margin: 16px 0 0;
  padding: 0;
  list-style: none;
  font-size: 13px;
  color: var(--app-text-muted);
}

.progress-list li {
  display: flex;
  align-items: center;
  gap: 10px;
}

.progress-list li.is-done {
  color: var(--app-text);
}

.progress-mark {
  width: 18px;
  height: 18px;
  display: grid;
  place-items: center;
  border: 1px solid var(--app-border);
  border-radius: 50%;
  background: var(--app-surface);
  color: #ffffff;
  font-size: 12px;
}

.progress-list li.is-done .progress-mark {
  border-color: var(--el-color-primary);
  background: var(--el-color-primary);
}

.sort-label,
.spec-label,
.contact-label {
  margin-top: 16px;
}

.sort-stepper {
  display: flex;
  align-items: center;
  gap: 8px;
}

.sort-stepper .el-input-number {
  width: 96px;
}

.add-spec-button {
  width: 100%;
}

.add-spec-button::before {
  content: '+';
  margin-right: 6px;
  font-weight: 700;
}

.specification-editor {
  display: grid;
  gap: 10px;
  margin-top: 10px;
}

.specification-row {
  display: grid;
  grid-template-columns: minmax(100px, 1fr) minmax(110px, 130px) auto;
  align-items: center;
  gap: 8px;
}

.contact-service-help {
  margin-top: 8px;
  color: var(--app-text-muted);
  font-size: 12px;
  line-height: 1.5;
}

.form-error {
  margin: 0;
}

.draft-footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding-top: 4px;
}

.draft-note {
  display: flex;
  align-items: center;
  gap: 6px;
  color: var(--app-text-muted);
  font-size: 12px;
}

.form-actions {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
}

@media (max-width: 960px) {
  .draft-grid {
    grid-template-columns: 1fr;
  }
}

@media (max-width: 720px) {
  .field-row,
  .image-grid,
  .specification-row {
    grid-template-columns: 1fr;
  }

  .draft-footer {
    flex-direction: column;
    align-items: stretch;
  }
}
</style>
