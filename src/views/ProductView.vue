<script setup lang="ts">
import axios from 'axios'
import { onMounted, ref } from 'vue'
import { ElMessageBox } from 'element-plus'
import { useAuthStore } from '../stores/auth'
import * as categoryApi from '../api/category'
import * as productApi from '../api/product'
import ProductForm from '../components/ProductForm.vue'
import type { CategoryVO } from '../types/category'
import type {
  ProductAction,
  ProductApiResult,
  ProductDraftRequest,
  ProductStatus,
  ProductVO,
} from '../types/product'

const auth = useAuthStore()
const products = ref<ProductVO[]>([])
const categories = ref<CategoryVO[]>([])
const loading = ref(false)
const categoriesLoading = ref(false)
const categoryLoadError = ref('')
const loadError = ref('')
const operationError = ref('')
const successMessage = ref('')
const dialogVisible = ref(false)
const dialogTitle = ref('')
const dialogError = ref('')
const editingProduct = ref<ProductVO | null>(null)
const saving = ref(false)

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

onMounted(() => {
  void loadProducts()
  void loadCategories()
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

    <el-table v-loading="loading" :data="products" row-key="id">
      <template #empty>
        <el-empty description="暂无产品" />
      </template>
      <el-table-column prop="id" label="产品编号" width="100" />
      <el-table-column label="产品名称" min-width="180">
        <template #default="{ row }">{{ row.name || '未命名产品' }}</template>
      </el-table-column>
      <el-table-column label="状态" width="140">
        <template #default="{ row }">
          <el-tag>{{ statusLabel(row.status) }}</el-tag>
        </template>
      </el-table-column>
      <el-table-column label="操作" min-width="340" fixed="right">
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
        </template>
      </el-table-column>
    </el-table>
  </el-card>

  <el-dialog
    v-model="dialogVisible"
    :title="dialogTitle"
    width="min(900px, calc(100vw - 32px))"
    destroy-on-close
    class="product-dialog"
  >
    <ProductForm
      v-if="dialogVisible"
      :product="editingProduct"
      :categories="categories"
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

.product-alert {
  margin-bottom: 16px;
}
</style>
