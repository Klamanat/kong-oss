import { createApp } from 'vue'
import { createRouter, createWebHashHistory } from 'vue-router'
import App from './App.vue'
import { loadAuth, auth } from './auth'
import LoginView from './views/LoginView.vue'
import DashboardView from './views/DashboardView.vue'
import ServicesView from './views/ServicesView.vue'
import RoutesView from './views/RoutesView.vue'
import UpstreamsView from './views/UpstreamsView.vue'
import PluginsView from './views/PluginsView.vue'

loadAuth()

const router = createRouter({
  history: createWebHashHistory(),
  routes: [
    { path: '/login',     component: LoginView, meta: { public: true } },
    { path: '/',          redirect: '/dashboard' },
    { path: '/dashboard', component: DashboardView },
    { path: '/services',  component: ServicesView },
    { path: '/routes',    component: RoutesView },
    { path: '/upstreams', component: UpstreamsView },
    { path: '/plugins',   component: PluginsView },
  ],
})

router.beforeEach((to) => {
  if (!to.meta.public && !auth.loggedIn.value) {
    return '/login'
  }
})

createApp(App).use(router).mount('#app')
