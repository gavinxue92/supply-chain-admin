<script setup lang="ts">
import axios from 'axios'
import { computed, onMounted, reactive, ref } from 'vue'
import { ElMessageBox } from 'element-plus'
import * as categoryApi from '../api/category'
import { useIsMobile } from '../composables/useIsMobile'
import type { ApiResult, CategoryRequest, CategoryVO } from '../types/category'

const isMobile = useIsMobile()

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

function isRootCategory(category: CategoryVO): boolean {
  return category.parentId === null || category.parentId === undefined
}

const parentOptions = computed(() =>
  categories.value.filter(
    (category) => isRootCategory(category) && category.id !== editingCategoryId.value,
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

const dialogSubtitle = computed(() => {
  if (editingCategoryId.value !== null) return '维护分类名称、排序与上级分类'
  return form.parentId === null
    ? '创建商品大类，作为二级分类的上级目录'
    : `为「${parentCategoryName()}」创建二级分类，产品需挂在二级分类下`
})

const levelLabel = computed(() =>
  form.parentId === null ? '一级分类' : `二级分类（${parentCategoryName()}）`,
)

const hierarchySteps = computed(() => [
  {
    label: '一级分类',
    state: form.parentId === null ? 'current' : 'done',
    hint: form.parentId === null ? '当前' : '已完成',
  },
  {
    label: '二级分类',
    state: form.parentId !== null ? 'current' : 'next',
    hint: form.parentId !== null ? '当前' : '下一步',
  },
  {
    label: '产品',
    state: 'later',
    hint: '未选',
  },
])

function stepSortOrder(delta: number) {
  const next = Number(form.sortOrder) + delta
  form.sortOrder = Number.isFinite(next) ? next : 0
}

const visibleCategories = computed(() => {
  const visible: CategoryVO[] = []
  for (const category of categories.value) {
    if (!isRootCategory(category)) continue
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
  form.parentId = category.parentId ?? null
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
    if (!parent || !isRootCategory(parent)) return '只能选择一级分类作为上级分类'
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
    !active && isRootCategory(category)
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

    <div v-if="isMobile" v-loading="loading" class="category-cards">
      <el-empty v-if="visibleCategories.length === 0" description="暂无分类" />
      <article
        v-for="row in visibleCategories"
        :key="row.id"
        class="category-card"
        :class="{ 'is-child': !isRootCategory(row) }"
      >
        <div class="card-head">
          <el-button
            v-if="isRootCategory(row) && hasChildren(row)"
            link
            type="primary"
            :aria-expanded="isExpanded(row)"
            @click="toggleExpanded(row)"
          >
            <span class="category-tree-indicator">{{ isExpanded(row) ? '−' : '+' }}</span>
            {{ row.name }}
          </el-button>
          <span v-else class="card-name">{{ row.name }}</span>
          <el-tag :type="row.active ? 'success' : 'info'">{{ row.active ? '已启用' : '已停用' }}</el-tag>
        </div>
        <div class="card-meta">
          <span>{{ isRootCategory(row) ? '一级分类' : '二级分类' }}</span>
          <span>排序 {{ row.sortOrder }}</span>
        </div>
        <div class="card-actions">
          <el-button
            v-if="isRootCategory(row)"
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
        </div>
      </article>
    </div>

    <el-table v-if="!isMobile" v-loading="loading" :data="visibleCategories" row-key="id">
      <template #empty>
        <el-empty description="暂无分类" />
      </template>
      <el-table-column label="分类名称" min-width="180">
        <template #default="{ row }">
          <el-button
            v-if="isRootCategory(row) && hasChildren(row)"
            link
            type="primary"
            :aria-expanded="isExpanded(row)"
            @click="toggleExpanded(row)"
          >
            <span class="category-tree-indicator">{{ isExpanded(row) ? '−' : '+' }}</span>
            {{ row.name }}
          </el-button>
          <span v-else :class="{ 'category-child-name': !isRootCategory(row) }">
            {{ row.name }}
          </span>
        </template>
      </el-table-column>
      <el-table-column label="分类等级" width="120">
        <template #default="{ row }">
          {{ isRootCategory(row) ? '一级' : '二级' }}
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
            v-if="isRootCategory(row)"
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
    width="min(820px, calc(100vw - 32px))"
    destroy-on-close
    align-center
    class="category-dialog"
  >
    <template #header>
      <div class="category-dialog-header">
        <span class="category-dialog-icon">
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="M20.6 13.4 13.4 20.6a2 2 0 0 1-2.8 0l-7.2-7.2a2 2 0 0 1-.6-1.4V4a1 1 0 0 1 1-1h8a2 2 0 0 1 1.4.6l7.4 7.4a2 2 0 0 1 0 2.8Z" />
            <circle cx="7.5" cy="7.5" r="1.5" />
          </svg>
        </span>
        <span class="category-dialog-title">
          <strong>{{ dialogTitle }}</strong>
          <small>{{ dialogSubtitle }}</small>
        </span>
        <button type="button" class="dialog-close" aria-label="关闭" @click="dialogVisible = false">
          ×
        </button>
      </div>
    </template>

    <svg class="icon-sprite" aria-hidden="true">
      <symbol id="cat-icon-folder" viewBox="0 0 24 24">
        <path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7Z" />
      </symbol>
      <symbol id="cat-icon-lock" viewBox="0 0 24 24">
        <rect x="5" y="10" width="14" height="10" rx="2" />
        <path d="M8 10V7a4 4 0 0 1 8 0v3" />
      </symbol>
      <symbol id="cat-icon-layers" viewBox="0 0 24 24">
        <path d="M12 3 3 8l9 5 9-5-9-5Z" />
        <path d="m3 13 9 5 9-5" />
      </symbol>
      <symbol id="cat-icon-bulb" viewBox="0 0 24 24">
        <path d="M9 18h6M10 21h4" />
        <path d="M12 3a6 6 0 0 0-3.5 10.9c.6.5.9 1.2.9 2h5.2c0-.8.3-1.5.9-2A6 6 0 0 0 12 3Z" />
      </symbol>
    </svg>

    <el-form class="category-form" label-position="top" @submit.prevent="saveCategory">
      <div class="category-grid">
        <section class="category-card">
          <header class="card-header">
            <svg class="card-icon"><use href="#cat-icon-folder" /></svg>
            <strong>分类信息</strong>
            <span class="level-tag">{{ form.parentId === null ? '一级目录' : '二级目录' }}</span>
          </header>
          <div class="field-label">分类名称 <em>*</em></div>
          <el-input
            v-model="form.name"
            placeholder="请输入分类名称"
            maxlength="120"
            show-word-limit
          />
          <div class="field-label level-label">分类等级</div>
          <div v-if="editingCategoryId === null" class="level-readonly">
            <span>{{ levelLabel }}</span>
            <span class="level-lock">
              <svg class="card-icon"><use href="#cat-icon-lock" /></svg>
              创建后不可更改
            </span>
          </div>
          <template v-else>
            <el-select
              v-model="form.parentId"
              placeholder="不选择则创建一级分类"
              no-data-text="暂无可选一级分类"
              clearable
              :disabled="editingCategoryHasChildren"
              @clear="form.parentId = null"
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
          </template>
          <div class="field-label sort-label">排序</div>
          <div class="sort-stepper">
            <el-button aria-label="减少排序" @click="stepSortOrder(-1)">−</el-button>
            <el-input-number v-model="form.sortOrder" :step="1" aria-label="分类排序" />
            <el-button aria-label="增加排序" @click="stepSortOrder(1)">+</el-button>
          </div>
          <div class="field-help sort-help">数值越小，在分类列表中越靠前</div>
        </section>

        <aside class="category-side">
          <section class="category-card hierarchy-card">
            <header class="card-header">
              <svg class="card-icon"><use href="#cat-icon-layers" /></svg>
              <strong>分类层级</strong>
              <span class="level-count">共 3 级</span>
            </header>
            <ul class="hierarchy-list">
              <li
                v-for="step in hierarchySteps"
                :key="step.label"
                :class="`is-${step.state}`"
              >
                <span class="hierarchy-dot">{{ step.state === 'done' ? '✓' : '' }}</span>
                <span class="hierarchy-label">{{ step.label }}</span>
                <span class="hierarchy-hint">{{ step.hint }}</span>
              </li>
            </ul>
            <p class="hierarchy-note">一级分类下可继续创建二级分类，产品需挂在二级分类下。</p>
          </section>

          <section class="category-card">
            <header class="card-header">
              <svg class="card-icon"><use href="#cat-icon-bulb" /></svg>
              <strong>命名建议</strong>
            </header>
            <ul class="suggestion-list">
              <li>使用通用大类名称，如「肉类」「毛肚」</li>
              <li>名称保持简洁，便于后台快速检索</li>
              <li>同一层级下分类名称不可重复</li>
            </ul>
          </section>
        </aside>
      </div>

      <el-alert
        v-if="dialogError"
        :title="dialogError"
        type="error"
        show-icon
        :closable="false"
        class="category-form-alert"
      />

      <footer class="category-footer">
        <span class="footer-note">带 * 为必填项，保存后在分类列表中继续维护</span>
        <div class="form-actions">
          <el-button @click="dialogVisible = false">取消</el-button>
          <el-button type="primary" @click="saveCategory">保存</el-button>
        </div>
      </footer>
    </el-form>
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
  color: var(--app-text-muted);
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

.icon-sprite {
  position: absolute;
  width: 0;
  height: 0;
  overflow: hidden;
}

.category-dialog-header {
  display: flex;
  align-items: center;
  gap: 12px;
  width: 100%;
}

.category-dialog-icon {
  width: 36px;
  height: 36px;
  flex: none;
  display: grid;
  place-items: center;
  border-radius: 9px;
  background: var(--el-color-primary);
  color: #ffffff;
}

.category-dialog-icon svg {
  width: 20px;
  height: 20px;
  fill: none;
  stroke: currentColor;
  stroke-width: 1.8;
  stroke-linecap: round;
  stroke-linejoin: round;
}

.category-dialog-title {
  display: grid;
  gap: 3px;
}

.category-dialog-title strong {
  color: var(--app-text);
  font-size: 17px;
}

.category-dialog-title small {
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

.category-form {
  display: grid;
  gap: 16px;
}

.category-grid {
  display: grid;
  grid-template-columns: minmax(0, 1.2fr) minmax(260px, 0.8fr);
  gap: 16px;
  align-items: start;
}

.category-side {
  display: grid;
  gap: 16px;
}

.category-card {
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

.card-icon {
  width: 18px;
  height: 18px;
  flex: none;
  fill: none;
  stroke: var(--el-color-primary);
  stroke-width: 1.7;
  stroke-linecap: round;
  stroke-linejoin: round;
}

.level-tag,
.level-count {
  padding: 2px 8px;
  border-radius: 10px;
  background: var(--app-brand-soft);
  color: var(--el-color-primary);
  font-size: 11px;
}

.level-count {
  margin-left: auto;
}

.field-label {
  margin-bottom: 6px;
  font-size: 13px;
  color: var(--app-text);
}

.field-label em {
  color: var(--el-color-danger);
  font-style: normal;
}

.level-label,
.sort-label {
  margin-top: 16px;
}

.level-readonly {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  min-height: 40px;
  padding: 0 12px;
  border-radius: 6px;
  background: var(--app-surface-soft);
  color: var(--app-text);
  font-size: 13px;
}

.level-lock {
  display: flex;
  align-items: center;
  gap: 5px;
  color: var(--app-text-muted);
  font-size: 12px;
}

.level-lock .card-icon {
  width: 14px;
  height: 14px;
  color: var(--app-text-muted);
}

.sort-stepper {
  display: flex;
  align-items: center;
  gap: 8px;
}

.sort-stepper .el-input-number {
  width: 120px;
}

.sort-help {
  margin-top: 6px;
}

.hierarchy-card {
  background: linear-gradient(180deg, var(--app-brand-soft), var(--app-surface));
}

.hierarchy-list {
  display: grid;
  gap: 12px;
  margin: 0;
  padding: 0;
  list-style: none;
}

.hierarchy-list li {
  display: flex;
  align-items: center;
  gap: 10px;
  color: var(--app-text-muted);
  font-size: 13px;
}

.hierarchy-dot {
  width: 18px;
  height: 18px;
  flex: none;
  display: grid;
  place-items: center;
  border: 1px solid var(--app-border);
  border-radius: 50%;
  background: var(--app-surface);
  font-size: 11px;
  color: #ffffff;
}

.hierarchy-list li.is-done .hierarchy-dot,
.hierarchy-list li.is-current .hierarchy-dot {
  border-color: var(--el-color-primary);
  background: var(--el-color-primary);
}

.hierarchy-list li.is-current,
.hierarchy-list li.is-done {
  color: var(--app-text);
  font-weight: 600;
}

.hierarchy-hint {
  margin-left: auto;
  font-size: 12px;
  font-weight: 400;
}

.hierarchy-note {
  margin: 16px 0 0;
  color: var(--app-text-muted);
  font-size: 12px;
  line-height: 1.5;
}

.suggestion-list {
  display: grid;
  gap: 10px;
  margin: 0;
  padding-left: 18px;
  color: var(--app-text-muted);
  font-size: 12px;
  line-height: 1.6;
}

.suggestion-list li::marker {
  color: var(--el-color-primary);
}

.category-form-alert {
  margin: 0;
}

.category-footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.footer-note {
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

.category-dialog :deep(.el-dialog__body) {
  max-height: calc(100vh - 180px);
  overflow: auto;
  padding-top: 8px;
}

/* ---------- 手机端卡片列表 ---------- */
.category-cards {
  display: grid;
  gap: 10px;
}

.category-card {
  display: grid;
  gap: 8px;
  padding: 12px 14px;
  border: 1px solid var(--app-border);
  border-radius: 12px;
  background: var(--app-surface);
}

.category-card.is-child {
  margin-left: 16px;
  border-left: 3px solid var(--app-brand-soft);
}

.card-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
}

.card-name {
  overflow: hidden;
  color: var(--app-text);
  font-size: 14px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.card-meta {
  display: flex;
  gap: 12px;
  color: var(--app-text-muted);
  font-size: 12px;
}

.card-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 2px;
  padding-top: 6px;
  border-top: 1px dashed var(--app-border);
}

@media (max-width: 720px) {
  .category-grid {
    grid-template-columns: 1fr;
  }

  .category-footer {
    flex-direction: column;
    align-items: stretch;
  }

  /* svh 跟随手机地址栏收缩，避免对话框底部被遮住 */
  .category-dialog :deep(.el-dialog__body) {
    max-height: calc(100svh - 150px);
  }
}
</style>
