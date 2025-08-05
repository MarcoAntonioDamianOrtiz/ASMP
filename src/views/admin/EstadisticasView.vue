<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue'
import { subscribeToUsers, type FirebaseUser } from '@/firebase'
import MapPanel from '@/components/estadisticas/MapPanel.vue'
import MainNav from '../../components/MainNav.vue';
import LayoutView from './LayoutView.vue';

const users = ref<FirebaseUser[]>([])
const loading = ref(true)
const lastUpdate = ref(new Date().toLocaleTimeString())

// Función para generar colores consistentes para usuarios
const getUserColor = (name: string): string => {
  const colors = ['#10b981', '#3b82f6', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4', '#f97316']
  const hash = name.split('').reduce((a: number, b: string) => {
    a = ((a << 5) - a) + b.charCodeAt(0)
    return a & a
  }, 0)
  return colors[Math.abs(hash) % colors.length]
}

let unsubscribeUsers: (() => void) | null = null
let updateInterval: ReturnType<typeof setInterval> | null = null

onMounted(() => {
  // Suscribirse a los usuarios
  unsubscribeUsers = subscribeToUsers((data) => {
    users.value = data
    loading.value = false
    lastUpdate.value = new Date().toLocaleTimeString()
    console.log('Usuarios cargados:', data.length)
  })

  // Actualizar timestamp cada minuto
  updateInterval = setInterval(() => {
    lastUpdate.value = new Date().toLocaleTimeString()
  }, 60000)
})

onUnmounted(() => {
  if (unsubscribeUsers) unsubscribeUsers()
  if (updateInterval) clearInterval(updateInterval)
})
</script>

<template>
   <LayoutView>
        <MainNav />

    <div class="max-w-7xl mx-auto px-4 py-6 pt-24">
      
      <!-- Mapa principal -->
      <div class="bg-white rounded-lg shadow-lg mb-6">
        <div class="p-4 border-b border-gray-200">
          <h2 class="text-lg font-semibold text-gray-900 flex items-center">
            <span class="w-3 h-3 bg-green-500 rounded-full mr-2 animate-pulse"></span>
            Ubicaciones en Tiempo Real
          </h2>
        </div>
        <div class="p-4">
          <MapPanel :loading="loading" />
        </div>
      </div>

      <!-- Panel de información de usuarios -->
      <div class="bg-white rounded-lg shadow-lg">
        <div class="px-4 py-3 border-b border-gray-200">
          <h3 class="text-lg font-semibold text-gray-900">
            Usuarios Registrados ({{ users.length }})
          </h3>
        </div>
        <div v-if="loading" class="p-8 text-center">
          <div class="animate-spin rounded-full h-8 w-8 border-b-2 border-green-500 mx-auto mb-4"></div>
          <span class="text-gray-600">Cargando usuarios...</span>
        </div>
        <div v-else-if="users.length === 0" class="p-8 text-center">
          <div class="text-gray-500">
            <svg class="w-12 h-12 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197m13.5-9a2.5 2.5 0 11-5 0 2.5 2.5 0 015 0z"></path>
            </svg>
            <p>No hay usuarios registrados</p>
          </div>
        </div>
        <div v-else class="px-4 py-4 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          <div 
            v-for="user in users" 
            :key="user.id"
            class="border rounded-lg p-4 bg-gray-50 hover:shadow-md transition-shadow"
          >
            <div class="flex items-center mb-3">
              <div 
                class="w-10 h-10 rounded-full flex items-center justify-center text-white font-bold mr-3"
                :style="{ backgroundColor: getUserColor(user.name) }"
              >
                {{ user.name.charAt(0).toUpperCase() }}
              </div>
              <div>
                <h4 class="font-semibold text-gray-900">{{ user.name }}</h4>
                <span 
                  :class="user.role === 'guardian' ? 'bg-blue-100 text-blue-800' : 'bg-green-100 text-green-800'"
                  class="text-xs px-2 py-1 rounded-full"
                >
                  {{ user.role }}
                </span>
              </div>
            </div>
            
            <div class="space-y-1 text-sm text-gray-600">
              <p class="flex items-center">
                <svg class="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M16 12a4 4 0 10-8 0 4 4 0 008 0zm0 0v1.5a2.5 2.5 0 005 0V12a9 9 0 10-9 9m4.5-1.206a8.959 8.959 0 01-4.5 1.207"></path>
                </svg>
                {{ user.email }}
              </p>
              <p class="flex items-center">
                <svg class="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z"></path>
                </svg>
                {{ user.phone }}
              </p>
              <p class="flex items-center">
                <span 
                  :class="user.status === 'online' ? 'bg-green-500' : 'bg-gray-400'"
                  class="w-2 h-2 rounded-full mr-2"
                ></span>
                {{ user.status || 'offline' }}
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  </LayoutView>
</template>
