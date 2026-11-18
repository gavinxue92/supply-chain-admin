<script setup lang="ts">
import axios from 'axios'
import { computed, onMounted, reactive, ref } from 'vue'
import { ElMessageBox } from 'element-plus'
import * as categoryApi from '../api/category'
import type { ApiResult, CategoryRequest, CategoryVO } from '../types/category'

const categories = ref<CategoryVO[]>([])
const loading = ref(false)
const loadError = ref('')
const operationError = ref('')
const successMessage = ref('')
const dialogVisible = ref(false)
const dialogError = ref('')
const editingCategoryId = ref<number | null>(null)
const expandedCategoryIds = ref(new Set<number>())

const form = reactive<CategoryRequest>({
  name: '',
  parentId: null,
  sortOrder: 0,
})

const parentOptions = computed(() =>
  categories.value.filter(
    (category) => category.parentId === null && category.id !== editingCategoryId.value,
  ),
)

const editingCategoryHasChildren = computed(
  () =>
    editingCategoryId.value !== null &&
    categories.value.some((category) => category.parentId === editingCategoryId.value),
)

const dialogTitle = computed(() => {
  if (editingCategoryId.value !== null) return '编辑分类'
  return form.parentId === null ? '新增一级分类' : '新增二级分类'
})

const visibleCategories = computed(() => {
  const visible: CategoryVO[] = []
  for (const category of categories.value) {
    if (category.parentId !== null) continue
    visible.push(category)
    if (expandedCategoryIds.value.has(category.id)) {
      visible.push(...categories.value.filter((child) => child.parentId === category.id))
    }
  }
  return visible
})

function errorMessage(error: unknown, fallback: string): string {
  if (axios.isAxiosError<ApiResult<unknown>>(error)) {
    const message = error.response?.data?.message
    if (typeof message === 'string' && message.length > 0) return message
    if (!error.response) return '无法连接服务器，请检查网络后重试'
  }
  if (error instanceof Error && error.message) return error.message
  return fallback
}

async function loadCategories() {
  loading.value = true
  loadError.value = ''
  try {
    categories.value = await categoryApi.listCategories()
  } catch (error) {
    loadError.value = errorMessage(error, '分类列表加载失败，请检查网络后重试')
  } finally {
    loading.value = false
  }
}

function hasChildren(category: CategoryVO): boolean {
  return categories.value.some((item) => item.parentId === category.id)
}

function parentCategoryName(): string {
  return categories.value.find((category) => category.id === form.parentId)?.name ?? '未知分类'
}

function isExpanded(category: CategoryVO): boolean {
  return expandedCategoryIds.value.has(category.id)
}

function toggleExpanded(category: CategoryVO) {
  const nextExpandedIds = new Set(expandedCategoryIds.value)
  if (nextExpandedIds.has(category.id)) {
    nextExpandedIds.delete(category.id)
  } else {
    nextExpandedIds.add(category.id)
  }
  expandedCategoryIds.value = nextExpandedIds
}

function expandCategory(categoryId: number | null) {
  if (categoryId === null || expandedCategoryIds.value.has(categoryId)) return
  expandedCategoryIds.value = new Set([...expandedCategoryIds.value, categoryId])
}

function openCreateDialog(parentId: number | null = null) {
  editingCategoryId.value = null
  form.name = ''
  form.parentId = parentId
  form.sortOrder = 0
  dialogError.value = ''
  operationError.value = ''
  successMessage.value = ''
  dialogVisible.value = true
}

function openCreateSubcategory(category: CategoryVO) {
  openCreateDialog(category.id)
}

function openEditDialog(category: CategoryVO) {
  editingCategoryId.value = category.id
  form.name = category.name
  form.parentId = category.parentId
  form.sortOrder = category.sortOrder
  dialogError.value = ''
  operationError.value = ''
  successMessage.value = ''
  dialogVisible.value = true
}

function validateForm(): string | null {
  const name = form.name.trim()
  if (!name) return '分类名称不能为空'
  if (name.length > 120) return '分类名称不能超过 120 个字符'
  if (!Number.isInteger(form.sortOrder)) return '排序必须为整数'

  if (
    categories.value.some(
      (category) =>
        category.id !== editingCategoryId.value &&
        category.parentId === form.parentId &&
        category.name === name,
    )
  ) {
    return '同一父分类下不能有重名分类'
  }

  if (form.parentId !== null) {
    const parent = categories.value.find((category) => category.id === form.parentId)
    if (!parent || parent.parentId !== null) return '只能选择一级分类作为上级分类'
    if (editingCategoryHasChildren.value) return '含有子分类的一级分类不能调整上级分类'
  }

  return null
}

async function saveCategory() {
  dialogError.value = ''
  const validationError = validateForm()
  if (validationError) {
    dialogError.value = validationError
    return
  }

  const payload: CategoryRequest = {
    name: form.name.trim(),
    parentId: form.parentId,
    sortOrder: form.sortOrder,
  }

  try {
    if (editingCategoryId.value === null) {
      await categoryApi.createCategory(payload)
      expandCategory(payload.parentId)
      successMessage.value = '分类创建成功'
    } else {
      await categoryApi.updateCategory(editingCategoryId.value, payload)
      expandCategory(payload.parentId)
      successMessage.value = '分类保存成功'
    }
    dialogVisible.value = false
    await loadCategories()
  } catch (error) {
    dialogError.value = errorMessage(error, '保存分类失败，请检查输入后重试')
  }
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

async function toggleCategoryStatus(category: CategoryVO) {
  const active = !category.active
  const action = active ? '启用' : '停用'
  const message =
    !active && category.parentId === null
      ? `停用一级分类“${category.name}”将隐藏整棵分类树，是否继续？`
      : `确认${action}分类“${category.name}”吗？`

  operationError.value = ''
  successMessage.value = ''
  if (!(await requestConfirmation(message, `确认${action}分类`))) return

  try {
    await categoryApi.setCategoryStatus(category.id, { active })
    const currentCategory = categories.value.find((item) => item.id === category.id)
    if (currentCategory) currentCategory.active = active
    successMessage.value = `分类已${action}`
  } catch (error) {
    operationError.value = errorMessage(error, `${action}分类失败，请稍后重试`)
  }
}

async function removeCategory(category: CategoryVO) {
  operationError.value = ''
  successMessage.value = ''
  if (
    !(await requestConfirmation(
      `删除分类“${category.name}”后无法恢复，确定继续吗？`,
      '删除分类',
    ))
  ) {
    return
  }

  try {
    await categoryApi.deleteCategory(category.id)
    successMessage.value = '分类删除成功'
    await loadCategories()
  } catch (error) {
    if (axios.isAxiosError(error) && error.response?.status === 409) {
      operationError.value = '该分类仍有子分类或关联产品，无法删除。请停用分类或先处理关联内容。'
    } else {
      operationError.value = errorMessage(error, '删除分类失败，请稍后重试')
    }
  }
}

onMounted(loadCategories)
</script>

<template>
  <el-card>
    <template #header>
      <div class="category-header">
        <span>分类管理</span>
        <el-button type="primary" @click="openCreateDialog()">新增一级分类</el-button>
      </div>
    </template>

    <el-alert
      v-if="loadError"
      :title="loadError"
      type="error"
      show-icon
      :closable="false"
      class="category-alert"
    >
      <el-button link type="primary" @click="loadCategories">重试</el-button>
    </el-alert>
    <el-alert
      v-if="operationError"
      :title="operationError"
      type="error"
      show-icon
      :closable="false"
      class="category-alert"
    />
    <el-alert
      v-if="successMessage"
      :title="successMessage"
      type="success"
      show-icon
      :closable="false"
      class="category-alert"
    />

    <el-table v-loading="loading" :data="visibleCategories" row-key="id">
      <template #empty>
        <el-empty description="暂无分类" />
      </template>
      <el-table-column label="分类名称" min-width="180">
        <template #default="{ row }">
          <el-button
            v-if="row.parentId === null && hasChildren(row)"
            link
            type="primary"
            :aria-expanded="isExpanded(row)"
            @click="toggleExpanded(row)"
          >
            <span class="category-tree-indicator">{{ isExpanded(row) ? '−' : '+' }}</span>
            {{ row.name }}
          </el-button>
          <span v-else :class="{ 'category-child-name': row.parentId !== null }">
            {{ row.name }}
          </span>
        </template>
      </el-table-column>
      <el-table-column label="分类等级" width="120">
        <template #default="{ row }">
          {{ row.parentId === null ? '一级' : '二级' }}
        </template>
      </el-table-column>
      <el-table-column label="状态" width="120">
        <template #default="{ row }">
          <el-tag :type="row.active ? 'success' : 'info'">
            {{ row.active ? '已启用' : '已停用' }}
          </el-tag>
        </template>
      </el-table-column>
      <el-table-column prop="sortOrder" label="排序" width="100" />
      <el-table-column label="操作" width="240" fixed="right">
        <template #default="{ row }">
          <el-button
            v-if="row.parentId === null"
            link
            type="primary"
            @click="openCreateSubcategory(row)"
          >
            新增二级分类
          </el-button>
          <el-button link type="primary" @click="openEditDialog(row)">编辑</el-button>
          <el-button link type="primary" @click="toggleCategoryStatus(row)">
            {{ row.active ? '停用' : '启用' }}
          </el-button>
          <el-button link type="danger" @click="removeCategory(row)">删除</el-button>
        </template>
      </el-table-column>
    </el-table>
  </el-card>

  <el-dialog
    v-model="dialogVisible"
    :title="dialogTitle"
    width="520px"
    destroy-on-close
  >
    <el-form label-width="100px" @submit.prevent="saveCategory">
      <el-form-item label="分类名称" required>
        <el-input
          v-model="form.name"
          placeholder="请输入分类名称"
          maxlength="120"
          show-word-limit
        />
      </el-form-item>
      <el-form-item v-if="editingCategoryId === null" label="分类等级">
        {{ form.parentId === null ? '一级分类' : `二级分类（${parentCategoryName()}）` }}
      </el-form-item>
      <el-form-item v-else label="上级分类">
        <el-select
          v-model="form.parentId"
          placeholder="不选择则创建一级分类"
          no-data-text="暂无可选一级分类"
          clearable
          @clear="form.parentId = null"
          :disabled="editingCategoryHasChildren"
        >
          <el-option
            v-for="category in parentOptions"
            :key="category.id"
            :label="category.name"
            :value="category.id"
          />
        </el-select>
        <div v-if="editingCategoryHasChildren" class="field-help">
          该一级分类包含子分类，不能调整上级分类。
        </div>
      </el-form-item>
      <el-form-item label="排序" required>
        <el-input-number v-model="form.sortOrder" :step="1" aria-label="分类排序" />
      </el-form-item>
      <el-alert
        v-if="dialogError"
        :title="dialogError"
        type="error"
        show-icon
        :closable="false"
      />
    </el-form>
    <template #footer>
      <el-button @click="dialogVisible = false">取消</el-button>
      <el-button type="primary" @click="saveCategory">保存</el-button>
    </template>
  </el-dialog>
</template>

<style scoped>
.category-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.category-alert {
  margin-bottom: 16px;
}

.field-help {
  color: #909399;
  font-size: 12px;
  line-height: 1.5;
}

.category-tree-indicator {
  display: inline-block;
  width: 16px;
  margin-right: 4px;
  font-weight: 700;
}

.category-child-name {
  padding-left: 24px;
}
</style>
