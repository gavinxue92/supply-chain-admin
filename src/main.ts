import { createApp } from 'vue'
import { createPinia } from 'pinia'
import ElementPlus from 'element-plus'
import 'element-plus/dist/index.css'
import 'element-plus/theme-chalk/dark/css-vars.css'
import './styles.css'

import App from './App.vue'
import { createAppRouter } from './router'
import { useAuthStore } from './stores/auth'

const app = createApp(App)
const pinia = createPinia()
app.use(pinia)

const auth = useAuthStore()

void auth.restoreFromServer().finally(() => {
  const router = createAppRouter()
  app.use(router)

  window.addEventListener('auth:unauthorized', () => {
    auth.clearSession()
    void router.replace({ name: 'login' })
  })

  app.use(ElementPlus)
  void router.isReady().then(() => {
    app.mount('#app')
  })
})
