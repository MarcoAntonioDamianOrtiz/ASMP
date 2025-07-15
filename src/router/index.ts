import { createRouter, createWebHistory } from 'vue-router'
import Index from '../views/Index.vue'
import { auth } from '../firebase'

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
    // Rutas de autenticación
    {
      path: '/login',
      name: 'Login',
      component: () => import('../views/admin/LoginView.vue')
    },
    {
      path: '/register',
      name: 'Register',
      component: () => import('../views/admin/ResgistrarView.vue')
    },
    // Rutas administrativas protegidas
    {
      path: '/main',
      name: 'main',
      component: () => import('../views/admin/AdminLayout.vue'),
      children: [
        {
          path: '',
          name: 'Main-home',
          component: () => import('../views/admin/ContactoView.vue'),
        },
        {
          path: '/estadisticas',
          name: 'Estadisticas',
          component: () => import('../views/admin/EstadisticasView.vue'),
          meta: {
            auth: true // Esta ruta requiere autenticación
          },
        }
      ]
    }
  ]
})

router.beforeEach((to, from, next) => {
  const user = auth.currentUser;

  if (to.matched.some(record => record.meta.auth) && !user) {
    next('/login');
  } else {
    next(); 
  }
});
export default router;