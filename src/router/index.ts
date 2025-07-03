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
      component: () => import('../views/admin/NosotrosView.vue')
    },
    {
      path: '/contacto',
      name: 'Contacto',
      component: () => import('../views/admin/ContactoView.vue')
    },
    {
      path: '/main',
      name: 'main',
      component: () => import('../views/admin/AdminLayout.vue'),
      children: [
        {
          path: '',
          name: 'Main-home',
          component: () => import('../views/admin/ContactoView.vue')
        },
        {
          path: 'estadisticas',
          name: 'Estadisticas',
          component: () => import('../views/admin/EstadisticasView.vue')
        }
      ]
    }
  ]
})

export default router