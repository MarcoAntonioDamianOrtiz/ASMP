import { createRouter, createWebHistory } from 'vue-router'
import Index from '../views/Index.vue'
import { auth } from '../firebase'
import { useUserStore } from '../stores/user'

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
      path: '/login',
      name: 'Login',
      component: () => import('../views/admin/LoginView.vue'),
      meta: {
        requiresGuest: true // Solo accesible si no está autenticado
      }
    },
    {
      path: '/register',
      name: 'Register',
      component: () => import('../views/admin/ResgistrarView.vue'),
      meta: {
        requiresGuest: true // Solo accesible si no está autenticado
      }
    },
    {
      path: '/estadisticas',
      name: 'Estadisticas',
      component: () => import('../views/admin/EstadisticasView.vue'),
      meta: {
        requiresAuth: true 
      }
    }
  ]
})

router.beforeEach((to, from, next) => {
  const user = auth.currentUser;
  const userStore = useUserStore();
  
  // Si la ruta requiere estar deslogueado (login/register)
  if (to.matched.some(record => record.meta.requiresGuest) && user) {
    // Si ya está autenticado, redirigir según su rol
    if (userStore.isGuardian) {
      next('/estadisticas');
    } else {
      next('/');
    }
    return;
  }
  
  // Si la ruta requiere autenticación
  if (to.matched.some(record => record.meta.requiresAuth) && !user) {
    next('/login');
    return;
  }
  
  next();
});

export default router;