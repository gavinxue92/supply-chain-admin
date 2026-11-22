<script setup lang="ts">
import axios from 'axios'
import { computed, onMounted, ref } from 'vue'
import { ElMessageBox } from 'element-plus'
import { useAuthStore } from '../stores/auth'
import * as categoryApi from '../api/category'
import * as contactApi from '../api/contact'
import * as productApi from '../api/product'
import ProductForm from '../components/ProductForm.vue'
import type { CategoryVO } from '../types/category'
import type { CustomerServiceVO } from '../types/contact'
import type {
  ProductAction,
  ProductApiResult,
  ProductContactMode,
  ProductDraftRequest,
  ProductStatus,
  ProductVO,
} from '../types/product'

const auth = useAuthStore()
const products = ref<ProductVO[]>([])
const categories = ref<CategoryVO[]>([])
const customerServices = ref<CustomerServiceVO[]>([])
const loading = ref(false)
const categoriesLoading = ref(false)
const categoryLoadError = ref('')
const serviceLoadError = ref('')
const loadError = ref('')
const operationError = ref('')
const successMessage = ref('')
const dialogVisible = ref(false)
const dialogTitle = ref('')
const dialogError = ref('')
const editingProduct = ref<ProductVO | null>(null)
const saving = ref(false)
const keyword = ref('')
const rootCategoryId = ref<number | null>(null)
const leafCategoryId = ref<number | null>(null)

const contactEditingId = ref<number | null>(null)
const contactSelection = ref<number | null>(null)
const contactSavingId = ref<number | null>(null)
const contactEditError = ref('')

const rootCategories = computed(() =>
  categories.value.filter((category) => category.parentId === null || category.parentId === undefined),
)

const leafCategories = computed(() =>
  rootCategoryId.value === null
    ? []
    : categories.value.filter((category) => category.parentId === rootCategoryId.value),
)

const categoryById = computed(
  () => new Map(categories.value.map((category) => [category.id, category])),
)

function categoryPath(id: number | null): string {
  if (id === null) return '未分类'
  const category = categoryById.value.get(id)
  if (!category) return '未分类'
  const parent = category.parentId == null ? null : categoryById.value.get(category.parentId)
  return parent ? `${parent.name} / ${category.name}` : category.name
}

const customerServiceById = computed(
  () => new Map(customerServices.value.map((service) => [service.id, service])),
)

const selectableContactServices = computed(() => {
  const selected = contactSelection.value
  return customerServices.value.filter(
    (service) => service.active || service.id === selected,
  )
})

function productContactLabel(product: ProductVO): string {
  if (product.contactMode === 'OVERRIDE' && product.contactServiceIds.length > 0) {
    return product.contactServiceIds
      .map((id) => customerServiceById.value.get(id)?.displayName ?? `客服 ${id}`)
      .join('、')
  }
  if (product.contactMode === 'DISABLED') return '已关闭客服'
  return '继承全局客服'
}

function openContactEditor(product: ProductVO) {
  if (product.status === 'ARCHIVED' || contactSavingId.value !== null) return
  contactEditingId.value = product.id
  contactSelection.value = product.contactServiceIds[0] ?? null
  contactEditError.value = ''
}

function closeContactEditor() {
  contactEditingId.value = null
  contactSelection.value = null
  contactEditError.value = ''
}

async function saveProductContacts(product: ProductVO) {
  if (contactSavingId.value !== null) return
  if (product.name === null || product.name.trim() === '') {
    contactEditError.value = '请先补全产品名称再修改客服'
    return
  }
  const availableIds = new Set(selectableContactServices.value.map((service) => service.id))
  if (contactSelection.value !== null && !availableIds.has(contactSelection.value)) {
    contactEditError.value = '所选客服不可用，请重新选择'
    return
  }

  const contactMode: ProductContactMode =
    contactSelection.value === null ? 'INHERIT' : 'OVERRIDE'
  const contactServiceIds = contactSelection.value === null ? [] : [contactSelection.value]
  const payload: ProductDraftRequest = {
    name: product.name,
    categoryId: product.categoryId,
    detailText: product.detailText ?? '',
    mainImageMediaId: product.mainImageMediaId,
    galleryMediaIds: [...product.galleryMediaIds],
    keywords: [...product.keywords],
    contactMode,
    contactServiceIds,
    sortOrder: product.sortOrder,
    specifications: product.specifications.map(({ name, referencePrice }) => ({
      name,
      referencePrice,
    })),
  }

  contactSavingId.value = product.id
  contactEditError.value = ''
  operationError.value = ''
  successMessage.value = ''
  try {
    await productApi.updateProduct(product.id, payload)
    closeContactEditor()
    successMessage.value = `产品“${product.name}”客服已更新`
    await loadProducts()
  } catch (error) {
    contactEditError.value = errorMessage(error, '客服保存失败，请稍后重试')
  } finally {
    contactSavingId.value = null
  }
}

const filteredProducts = computed(() => {
  const term = keyword.value.trim().toLowerCase()
  return products.value.filter((product) => {
    if (leafCategoryId.value !== null && product.categoryId !== leafCategoryId.value) return false
    if (leafCategoryId.value === null && rootCategoryId.value !== null) {
      const inRoot =
        product.categoryId === rootCategoryId.value ||
        categories.value.some(
          (category) =>
            category.id === product.categoryId && category.parentId === rootCategoryId.value,
        )
      if (!inRoot) return false
    }
    if (!term) return true
    return (
      (product.name ?? '').toLowerCase().includes(term) ||
      product.keywords.some((item) => item.toLowerCase().includes(term))
    )
  })
})

const hasFilters = computed(
  () =>
    keyword.value.trim() !== '' ||
    rootCategoryId.value !== null ||
    leafCategoryId.value !== null,
)

function onRootCategoryChange(value: number | null | undefined) {
  rootCategoryId.value = value ?? null
  leafCategoryId.value = null
}

function onLeafCategoryChange(value: number | null | undefined) {
  leafCategoryId.value = value ?? null
}

const statusLabels: Record<ProductStatus, string> = {
  DRAFT: '草稿',
  PUBLISHED: '已上架',
  UNPUBLISHED: '已下架',
  ARCHIVED: '已归档',
}

function statusLabel(status: ProductStatus): string {
  return statusLabels[status]
}

function errorMessage(error: unknown, fallback: string): string {
  if (axios.isAxiosError<ProductApiResult<unknown>>(error)) {
    if (error.response?.status === 409) {
      const conflict = error.response.data?.message
      return typeof conflict === 'string' && conflict.length > 0
        ? conflict
        : '操作冲突（409），请检查产品状态后重试'
    }
    const message = error.response?.data?.message
    if (typeof message === 'string' && message.length > 0) return message
    if (!error.response) return '无法连接服务器，请检查网络后重试'
  }
  if (error instanceof Error && error.message) return error.message
  return fallback
}

async function loadProducts() {
  loading.value = true
  loadError.value = ''
  try {
    products.value = await productApi.listProducts()
  } catch (error) {
    loadError.value = errorMessage(error, '产品列表加载失败，请检查网络后重试')
  } finally {
    loading.value = false
  }
}

async function loadCategories() {
  categoriesLoading.value = true
  categoryLoadError.value = ''
  try {
    categories.value = await categoryApi.listCategories()
  } catch (error) {
    categoryLoadError.value = errorMessage(error, '分类列表加载失败，稍后可重试')
  } finally {
    categoriesLoading.value = false
  }
}

async function loadCustomerServices() {
  serviceLoadError.value = ''
  try {
    customerServices.value = await contactApi.listCustomerServices()
  } catch (error) {
    customerServices.value = []
    serviceLoadError.value = errorMessage(error, '客服联系人加载失败，产品挂载客服可能不可用')
  }
}

function openCreateDialog() {
  editingProduct.value = null
  dialogTitle.value = '新建产品草稿'
  dialogError.value = ''
  operationError.value = ''
  successMessage.value = ''
  dialogVisible.value = true
}

async function requestConfirmation(message: string, title: string): Promise<boolean> {
  try {
    await ElMessageBox.confirm(message, title, {
      confirmButtonText: '确认',
      cancelButtonText: '取消',
      type: 'warning',
    })
    return true
  } catch (action) {
    if (action === 'cancel' || action === 'close') return false
    operationError.value = errorMessage(action, '无法确认此操作')
    return false
  }
}

async function openEditDialog(product: ProductVO) {
  if (product.status === 'ARCHIVED') return
  operationError.value = ''
  successMessage.value = ''
  if (
    product.status === 'PUBLISHED' &&
    !(await requestConfirmation(
      `保存“${product.name || '未命名产品'}”会立即影响小程序展示，是否继续编辑？`,
      '编辑已上架产品',
    ))
  ) {
    return
  }

  try {
    editingProduct.value = await productApi.getProduct(product.id)
    dialogTitle.value = '编辑产品'
    dialogError.value = ''
    dialogVisible.value = true
  } catch (error) {
    operationError.value = errorMessage(error, '读取产品详情失败，请稍后重试')
  }
}

async function saveProduct(payload: ProductDraftRequest) {
  if (saving.value) return
  saving.value = true
  dialogError.value = ''
  try {
    if (editingProduct.value === null) {
      await productApi.createProduct(payload)
      successMessage.value = '草稿创建成功'
    } else {
      const published = editingProduct.value.status === 'PUBLISHED'
      await productApi.updateProduct(editingProduct.value.id, payload)
      successMessage.value = published
        ? '产品保存成功，已立即生效'
        : '产品保存成功'
    }
    dialogVisible.value = false
    await loadProducts()
  } catch (error) {
    dialogError.value = errorMessage(error, '保存产品失败，请检查输入后重试')
  } finally {
    saving.value = false
  }
}

function actionConfirmation(product: ProductVO, action: ProductAction) {
  const name = product.name || '未命名产品'
  switch (action) {
    case 'publish':
      return {
        title: '上架产品',
        message: `上架“${name}”后将立即在小程序展示，是否继续？`,
        success: '产品已上架',
      }
    case 'unpublish':
      return {
        title: '下架产品',
        message: `下架“${name}”后将不再对用户展示，是否继续？`,
        success: '产品已下架',
      }
    case 'archive':
      return {
        title: '归档产品',
        message: `归档“${name}”后将无法普通编辑，只有管理员可以恢复。确定归档吗？`,
        success: '产品已归档',
      }
    case 'restore':
      return {
        title: '恢复产品',
        message: `恢复“${name}”后将变为已下架状态，需要重新检查后才能上架。确定恢复吗？`,
        success: '产品已恢复为已下架',
      }
  }
}

async function runProductAction(product: ProductVO, action: ProductAction) {
  const confirmation = actionConfirmation(product, action)
  operationError.value = ''
  successMessage.value = ''
  if (action === 'publish' && (product.specifications ?? []).length === 0) {
    operationError.value = '该产品还没有规格，请先编辑产品并添加至少一个规格后再上架'
    return
  }
  if (!(await requestConfirmation(confirmation.message, confirmation.title))) return

  try {
    switch (action) {
      case 'publish':
        await productApi.publishProduct(product.id)
        break
      case 'unpublish':
        await productApi.unpublishProduct(product.id)
        break
      case 'archive':
        await productApi.archiveProduct(product.id)
        break
      case 'restore':
        await productApi.restoreProduct(product.id)
        break
    }
    successMessage.value = confirmation.success
    await loadProducts()
  } catch (error) {
    operationError.value = errorMessage(error, `${confirmation.title}失败，请稍后重试`)
  }
}

async function hardDeleteProduct(product: ProductVO) {
  const name = product.name || '未命名产品'
  operationError.value = ''
  successMessage.value = ''
  if (
    !(await requestConfirmation(
      `硬删除“${name}”后不可恢复，其独占媒体也会同步清理。请先确认产品已归档，是否继续？`,
      '确认硬删除产品',
    ))
  ) {
    return
  }

  try {
    await productApi.deleteProduct(product.id)
    successMessage.value = `产品“${name}”已硬删除`
    await loadProducts()
  } catch (error) {
    operationError.value = errorMessage(error, '硬删除产品失败，请稍后重试')
  }
}

onMounted(() => {
  void loadProducts()
  void loadCategories()
  void loadCustomerServices()
})
</script>

<template>
  <el-card>
    <template #header>
      <div class="product-header">
        <span>产品管理</span>
        <el-button type="primary" @click="openCreateDialog">新建产品草稿</el-button>
      </div>
    </template>

    <el-alert
      v-if="loadError"
      :title="loadError"
      type="error"
      show-icon
      :closable="false"
      class="product-alert"
    >
      <el-button link type="primary" @click="loadProducts">重试</el-button>
    </el-alert>
    <el-alert
      v-if="categoryLoadError"
      :title="categoryLoadError"
      type="error"
      show-icon
      :closable="false"
      class="product-alert"
    >
      <el-button link type="primary" :loading="categoriesLoading" @click="loadCategories">
        重试分类列表
      </el-button>
    </el-alert>
    <el-alert
      v-if="serviceLoadError"
      :title="serviceLoadError"
      type="error"
      show-icon
      :closable="false"
      class="product-alert"
    >
      <el-button link type="primary" @click="loadCustomerServices">重试客服联系人列表</el-button>
    </el-alert>
    <el-alert
      v-if="operationError"
      :title="operationError"
      type="error"
      show-icon
      :closable="false"
      class="product-alert"
    />
    <el-alert
      v-if="successMessage"
      :title="successMessage"
      type="success"
      show-icon
      :closable="false"
      class="product-alert"
    />

    <div class="product-filter">
      <el-input
        v-model="keyword"
        placeholder="搜索产品名称或关键词"
        clearable
        class="product-filter-search"
      />
      <el-select
        :model-value="rootCategoryId"
        placeholder="全部分类"
        clearable
        popper-class="product-filter-popper"
        class="product-filter-select"
        @update:model-value="onRootCategoryChange"
      >
        <el-option
          v-for="category in rootCategories"
          :key="category.id"
          :label="category.name"
          :value="category.id"
        />
      </el-select>
      <el-select
        :model-value="leafCategoryId"
        placeholder="全部二级分类"
        clearable
        popper-class="product-filter-popper"
        class="product-filter-select"
        :disabled="rootCategoryId === null || leafCategories.length === 0"
        @update:model-value="onLeafCategoryChange"
      >
        <el-option
          v-for="category in leafCategories"
          :key="category.id"
          :label="category.name"
          :value="category.id"
        />
      </el-select>
    </div>

    <el-table v-loading="loading" :data="filteredProducts" row-key="id">
      <template #empty>
        <el-empty :description="hasFilters ? '没有符合条件的产品' : '暂无产品'" />
      </template>
      <el-table-column prop="id" label="产品编号" width="100" />
      <el-table-column label="缩略图" width="90">
        <template #default="{ row }">
          <el-image
            v-if="row.mainImageMediaId"
            class="product-thumbnail"
            :src="`/api/v1/media/${row.mainImageMediaId}`"
            :preview-src-list="[`/api/v1/media/${row.mainImageMediaId}`]"
            fit="cover"
            preview-teleported
            :alt="`${row.name || '产品'}主图`"
          />
          <span v-else class="product-thumbnail-placeholder">无主图</span>
        </template>
      </el-table-column>
      <el-table-column label="产品名称" min-width="180">
        <template #default="{ row }">{{ row.name || '未命名产品' }}</template>
      </el-table-column>
      <el-table-column label="分类" min-width="140">
        <template #default="{ row }">{{ categoryPath(row.categoryId) }}</template>
      </el-table-column>
      <el-table-column label="客服" min-width="240">
        <template #default="{ row }">
          <template v-if="contactEditingId === row.id">
            <el-select
              v-model="contactSelection"
              filterable
              clearable
              placeholder="选择其他客服替换当前客服"
              class="product-contact-select"
              popper-class="product-contact-popper"
            >
              <el-option
                v-for="service in selectableContactServices"
                :key="service.id"
                :label="`${service.displayName}（${service.active ? '已启用' : '已停用'}）`"
                :value="service.id"
                :disabled="!service.active"
              />
            </el-select>
            <div class="product-contact-actions">
              <el-button
                link
                type="primary"
                :loading="contactSavingId === row.id"
                @click="saveProductContacts(row)"
              >
                保存
              </el-button>
              <el-button link :disabled="contactSavingId === row.id" @click="closeContactEditor">
                取消
              </el-button>
            </div>
            <div v-if="contactEditError" class="product-contact-error">
              {{ contactEditError }}
            </div>
          </template>
          <el-button
            v-else
            link
            type="primary"
            :disabled="row.status === 'ARCHIVED'"
            @click="openContactEditor(row)"
          >
            {{ productContactLabel(row) }}
          </el-button>
        </template>
      </el-table-column>
      <el-table-column label="状态" width="140">
        <template #default="{ row }">
          <el-tag>{{ statusLabel(row.status) }}</el-tag>
        </template>
      </el-table-column>
      <el-table-column label="操作" min-width="400" fixed="right">
        <template #default="{ row }">
          <el-button
            v-if="row.status !== 'ARCHIVED'"
            link
            type="primary"
            @click="openEditDialog(row)"
          >
            编辑
          </el-button>
          <el-button
            v-if="row.status === 'DRAFT' || row.status === 'UNPUBLISHED'"
            link
            type="primary"
            @click="runProductAction(row, 'publish')"
          >
            上架
          </el-button>
          <el-button
            v-if="row.status === 'PUBLISHED'"
            link
            type="primary"
            @click="runProductAction(row, 'unpublish')"
          >
            下架
          </el-button>
          <el-button
            v-if="auth.role === 'ADMIN' && row.status !== 'ARCHIVED'"
            link
            type="danger"
            @click="runProductAction(row, 'archive')"
          >
            归档
          </el-button>
          <el-button
            v-if="auth.role === 'ADMIN' && row.status === 'ARCHIVED'"
            link
            type="primary"
            @click="runProductAction(row, 'restore')"
          >
            恢复
          </el-button>
          <el-button
            v-if="auth.role === 'ADMIN' && row.status === 'ARCHIVED'"
            link
            type="danger"
            @click="hardDeleteProduct(row)"
          >
            硬删除
          </el-button>
        </template>
      </el-table-column>
    </el-table>
  </el-card>

  <el-dialog
    v-model="dialogVisible"
    width="min(1080px, calc(100vw - 32px))"
    destroy-on-close
    class="product-dialog"
    align-center
  >
    <template #header>
      <div class="dialog-brand-header">
        <span class="dialog-brand-icon">
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <rect x="4" y="3" width="16" height="18" rx="2" />
            <path d="M8 8h8M8 12h8M8 16h5" />
          </svg>
        </span>
        <span class="dialog-brand-text">
          <strong>{{ dialogTitle }}</strong>
          <small>完善产品信息，保存后可随时继续编辑</small>
        </span>
        <button type="button" class="dialog-close" aria-label="关闭" @click="dialogVisible = false">
          ×
        </button>
      </div>
    </template>
    <ProductForm
      v-if="dialogVisible"
      :product="editingProduct"
      :categories="categories"
      :customer-services="customerServices"
      :saving="saving"
      :save-error="dialogError"
      @save="saveProduct"
      @cancel="dialogVisible = false"
    />
  </el-dialog>
</template>

<style scoped>
.product-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.dialog-brand-header {
  display: flex;
  align-items: center;
  gap: 12px;
  width: 100%;
}

.dialog-brand-icon {
  width: 36px;
  height: 36px;
  flex: none;
  display: grid;
  place-items: center;
  border-radius: 9px;
  background: var(--el-color-primary);
  color: #ffffff;
}

.dialog-brand-icon svg {
  width: 20px;
  height: 20px;
  fill: none;
  stroke: currentColor;
  stroke-width: 1.8;
  stroke-linecap: round;
  stroke-linejoin: round;
}

.dialog-brand-text {
  display: grid;
  gap: 3px;
}

.dialog-brand-text strong {
  color: var(--app-text);
  font-size: 17px;
}

.dialog-brand-text small {
  color: var(--app-text-muted);
  font-size: 12px;
}

.dialog-close {
  margin-left: auto;
  border: 0;
  background: transparent;
  color: var(--app-text-muted);
  font-size: 22px;
  line-height: 1;
  cursor: pointer;
}

.dialog-close:hover {
  color: var(--app-text);
}

.product-dialog :deep(.el-dialog__body) {
  max-height: calc(100vh - 170px);
  overflow: auto;
  padding-top: 8px;
}

.product-alert {
  margin-bottom: 16px;
}

.product-filter {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
  margin-bottom: 16px;
}

.product-filter-search {
  max-width: 320px;
}

.product-filter-select {
  width: 180px;
}

.product-thumbnail {
  width: 56px;
  height: 56px;
  border-radius: 4px;
  cursor: zoom-in;
}

.product-thumbnail-placeholder {
  color: var(--el-text-color-placeholder);
  font-size: 12px;
}

.product-contact-select {
  width: 100%;
}

.product-contact-actions {
  display: flex;
  gap: 8px;
}

.product-contact-error {
  color: var(--el-color-danger);
  font-size: 12px;
  line-height: 1.4;
}
</style>
