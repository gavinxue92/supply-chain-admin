import { createRouter, createWebHistory, type RouterHistory } from 'vue-router'
import { ElMessage } from 'element-plus'
import { useAuthStore } from '../stores/auth'
import LoginView from '../views/LoginView.vue'
import ChangePasswordView from '../views/ChangePasswordView.vue'
import AppLayout from '../views/AppLayout.vue'
import CategoryView from '../views/CategoryView.vue'
import ProductView from '../views/ProductView.vue'
import ContactView from '../views/ContactView.vue'
import HotKeywordView from '../views/HotKeywordView.vue'
import ShopView from '../views/ShopView.vue'
import AccountView from '../views/AccountView.vue'
import PlaceholderView from '../views/PlaceholderView.vue'

export function createAppRouter(history: RouterHistory = createWebHistory()) {
  const router = createRouter({
    history,
    routes: [
      { path: '/login', name: 'login', component: LoginView, meta: { public: true } },
      { path: '/change-password', name: 'change-password', component: ChangePasswordView, meta: { requiresAuth: true } },
      {
        path: '/',
        component: AppLayout,
        meta: { requiresAuth: true },
        children: [
          { path: '', name: 'home', component: PlaceholderView, meta: { title: '首页' } },
          { path: 'products', name: 'products', component: ProductView, meta: { title: '产品管理' } },
          { path: 'categories', name: 'categories', component: CategoryView, meta: { title: '分类管理' } },
          { path: 'contact', name: 'contact', component: ContactView, meta: { title: '客服配置', roles: ['ADMIN'] } },
          { path: 'hot-keywords', name: 'hot-keywords', component: HotKeywordView, meta: { title: '搜索热词', roles: ['ADMIN'] } },
          { path: 'shop', name: 'shop', component: ShopView, meta: { title: '店铺信息', roles: ['ADMIN'] } },
          { path: 'accounts', name: 'accounts', component: AccountView, meta: { title: '账号管理', roles: ['ADMIN'] } },
        ],
      },
    ],
  })

  router.beforeEach((to) => {
    const auth = useAuthStore()
    if (to.meta.public) {
      return auth.isAuthenticated ? { name: 'home' } : true
    }
    if (!auth.isAuthenticated) {
      return { name: 'login' }
    }
    if (auth.mustChangePassword && to.name !== 'change-password') {
      return { name: 'change-password' }
    }
    const roles = to.meta.roles as string[] | undefined
    if (roles && auth.role && !roles.includes(auth.role)) {
      ElMessage.error(`没有权限访问“${String(to.meta.title ?? '该页面')}”（403）`)
      return { name: 'home' }
    }
    return true
  })

  return router
}
