import { Icon } from '@iconify/vue'
import { createApp } from 'vue'
import { createRouter, createWebHistory } from 'vue-router'
import { routes } from 'vue-router/auto-routes'
import App from './App.vue'
import '@unocss/reset/tailwind.css'
import './styles/main.css'
import 'element-plus/theme-chalk/dark/css-vars.css'
import 'uno.css'

const app = createApp(App)
const router = createRouter({
  routes,
  history: createWebHistory(import.meta.env.BASE_URL),
})
app.component('Icon', Icon)
app.use(router)
app.mount('#app')
