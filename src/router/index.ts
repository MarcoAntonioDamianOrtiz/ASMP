import { createRouter, createWebHistory } from 'vue-router'
import Index from '../views/Index.vue'

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    {
      path: '/',
      name: 'Index',
      component: Index
    },
    {
      path: '/nosotros',
      name: 'Nosotros',
      component: () => import('../views/Admin/NosotrosView.vue')
    },
    {
      path: '/contacto',
      name: 'Contacto',
      component: () => import('../views/Admin/ContactoView.vue')
    },
    {
      path: '/admin',
      name: 'admin',
      component: () => import('../views/admin/AdminLayout.vue'),
      children: [
        {
          path: '',
          name: 'admin-home',
          component: () => import('../views/Admin/ContactoView.vue')
        }
      ]
    }
  ]
})

export default router