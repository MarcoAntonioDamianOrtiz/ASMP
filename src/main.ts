import { createApp, markRaw } from 'vue'
import { createPinia } from 'pinia'
import './assets/main.css';

import App from './App.vue'
import router from './router'
import { useUserStore } from './stores/user'

const app = createApp(App)
const pinia = createPinia()

pinia.use(({ store }) => {
    store.$router = markRaw(router)
})

app.use(pinia)
app.use(router)

app.mount('#app')

// Inicializar listener de autenticación
const userStore = useUserStore()
userStore.initAuthListener()