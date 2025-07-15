import './assets/main.css'; // Ajusta la ruta si es necesario
import { createApp, markRaw } from 'vue'
import { createPinia } from 'pinia'

import App from './App.vue'
import router from './router'

const app = createApp(App)
const pinia = createPinia()

pinia.use(({ store }) => {
    store.$router = markRaw(router)
})

app.use(pinia)
app.use(router)

app.mount('#app')
