import { createRouter, createWebHistory } from 'vue-router'
import Index from '../views/Index.vue'

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    {
      path: '/',
      name: 'index',
      component: Index
    },
    {
      path: '/admin',
      name: 'admin',
      component: () => import('../views/Admin/Layout.vue'),
      children: [
        {
          path: '',
          name: 'admin-home',
          component: () => import('../views/Admin/ConocenosView.vue')
        },
        {
          path: 'conocenos',
          name: 'conocenos',
          component: () => import('../views/Admin/ConocenosView.vue')
        }
      ]
    }
  ]
})

export default router
