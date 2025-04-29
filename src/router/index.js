import Vue from 'vue'
import VueRouter from 'vue-router'
import Login from '../views/Login.vue'
import Home from '../views/Home.vue'
import store from '../store'

Vue.use(VueRouter)

const routes = [
  {
    path: '/',
    name: 'Login',
    component: Login,
    meta: { guest: true }
  },
  {
    path: '/home',
    name: 'Home',
    component: Home,
    meta: { requiresAuth: true }
  }
]

const router = new VueRouter({
  mode: 'hash',
  base: process.env.BASE_URL,
  routes
})

// Navigation guards
router.beforeEach((to, from, next) => {
  if (to.matched.some(record => record.meta.requiresAuth)) {
    // 检查是否已登录
    if (!store.getters.isAuthenticated) {
      next({ path: '/' })
    } else {
      next()
    }
  } else if (to.matched.some(record => record.meta.guest)) {
    // 如果已登录，访问登录页，则重定向到主页
    if (store.getters.isAuthenticated) {
      next({ path: '/home' })
    } else {
      next()
    }
  } else {
    next()
  }
})

export default router
