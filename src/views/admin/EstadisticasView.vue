<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue'
import { subscribeToUserGroups, type FirebaseGroup } from '@/firebase'
import MapPanel from '@/components/estadisticas/MapPanel.vue'
import GroupManager from '@/components/GroupManager.vue'
import MainNav from '../../components/MainNav.vue'
import LayoutView from './LayoutView.vue'
import { useUserStore } from '@/stores/user'

const userStore = useUserStore()
const userGroups = ref<FirebaseGroup[]>([])
const loading = ref(true)
const lastUpdate = ref(new Date().toLocaleTimeString())
const activeTab = ref<'map' | 'groups'>('map')

let unsubscribeUserGroups: (() => void) | null = null
let updateInterval: ReturnType<typeof setInterval> | null = null

onMounted(() => {
  if (!userStore.isAuthenticated || !userStore.user?.email) return

  // Suscribirse a los grupos del usuario
  unsubscribeUserGroups = subscribeToUserGroups(userStore.user.email, (groups) => {
    userGroups.value = groups
    loading.value = false
    lastUpdate.value = new Date().toLocaleTimeString()
    console.log('Grupos cargados:', groups.length)
  })

  // Actualizar timestamp cada minuto
  updateInterval = setInterval(() => {
    lastUpdate.value = new Date().toLocaleTimeString()
  }, 60000)
})

onUnmounted(() => {
  if (unsubscribeUserGroups) unsubscribeUserGroups()
  if (updateInterval) clearInterval(updateInterval)
})

const setActiveTab = (tab: 'map' | 'groups') => {
  activeTab.value = tab
}
</script>

<template>
  <LayoutView>
    <MainNav />

    <div class="max-w-7xl mx-auto px-4 py-6 pt-24">
      <!-- Header con estadísticas rápidas -->
      <div class="bg-white rounded-lg shadow-lg mb-6">
        <div class="p-6">
          <h1 class="text-2xl font-bold text-gray-900 mb-2">Panel de Control</h1>
          <p class="text-gray-600 mb-4">Monitoreo y gestión de grupos de seguridad</p>
          
          <!-- Estadísticas rápidas -->
          <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div class="bg-green-50 border border-green-200 rounded-lg p-4">
              <div class="flex items-center">
                <div class="bg-green-500 rounded-full p-2 mr-3">
                  <svg class="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"></path>
                  </svg>
                </div>
                <div>
                  <h3 class="text-2xl font-bold text-green-800">{{ userGroups.length }}</h3>
                  <p class="text-green-600 text-sm">Grupos activos</p>
                </div>
              </div>
            </div>
            
            <div class="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <div class="flex items-center">
                <div class="bg-blue-500 rounded-full p-2 mr-3">
                  <svg class="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"></path>
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"></path>
                  </svg>
                </div>
                <div>
                  <h3 class="text-2xl font-bold text-blue-800">
                    {{ userGroups.reduce((total, group) => total + group.members.length, 0) }}
                  </h3>
                  <p class="text-blue-600 text-sm">Miembros totales</p>
                </div>
              </div>
            </div>
            
            <div class="bg-orange-50 border border-orange-200 rounded-lg p-4">
              <div class="flex items-center">
                <div class="bg-orange-500 rounded-full p-2 mr-3">
                  <svg class="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"></path>
                  </svg>
                </div>
                <div>
                  <h3 class="text-lg font-bold text-orange-800">{{ lastUpdate }}</h3>
                  <p class="text-orange-600 text-sm">Última actualización</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Navegación por pestañas -->
      <div class="bg-white rounded-lg shadow-lg mb-6">
        <div class="border-b border-gray-200">
          <nav class="flex space-x-8 px-6">
            <button
              @click="setActiveTab('map')"
              :class="[
                'py-4 px-1 border-b-2 font-medium text-sm',
                activeTab === 'map'
                  ? 'border-green-500 text-green-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              ]"
            >
              <svg class="w-5 h-5 inline mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-1.447-.894L15 4m0 13V4m0 0L9 7"></path>
              </svg>
              Mapa en Tiempo Real
            </button>
            <button
              @click="setActiveTab('groups')"
              :class="[
                'py-4 px-1 border-b-2 font-medium text-sm',
                activeTab === 'groups'
                  ? 'border-green-500 text-green-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              ]"
            >
              <svg class="w-5 h-5 inline mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197m13.5-9a2.5 2.5 0 11-5 0 2.5 2.5 0 015 0z"></path>
              </svg>
              Gestión de Grupos
            </button>
          </nav>
        </div>
      </div>

      <!-- Contenido de las pestañas -->
      <div v-if="activeTab === 'map'">
        <!-- Panel del mapa -->
        <div class="bg-white rounded-lg shadow-lg">
          <div class="p-4 border-b border-gray-200">
            <h2 class="text-lg font-semibold text-gray-900 flex items-center">
              <span class="w-3 h-3 bg-green-500 rounded-full mr-2 animate-pulse"></span>
              Ubicaciones en Tiempo Real
              <span class="ml-2 text-sm text-gray-500">
                ({{ userGroups.reduce((total, group) => total + group.members.length, 0) }} miembros monitoreados)
              </span>
            </h2>
          </div>
          <div class="p-4">
            <MapPanel :loading="loading" />
          </div>
        </div>

        <!-- Resumen de grupos activos en el mapa -->
        <div v-if="userGroups.length > 0" class="bg-white rounded-lg shadow-lg mt-6">
          <div class="p-4 border-b border-gray-200">
            <h3 class="text-lg font-semibold text-gray-900">
              Resumen de Grupos Activos
            </h3>
          </div>
          <div class="p-4">
            <div class="grid grid-cols-1 MD:grid-cols-2 lg:grid-cols-3 gap-4">
              <div 
                v-for="group in userGroups" 
                :key="group.id"
                class="border rounded-lg p-4 hover:shadow-md transition-shadow"
              >
                <div class="flex items-center justify-between mb-3">
                  <h4 class="font-semibold text-gray-800">{{ group.name }}</h4>
                  <span class="text-sm text-gray-500">{{ group.members.length }} miembros</span>
                </div>
                <p v-if="group.description" class="text-sm text-gray-600 mb-2">{{ group.description }}</p>
                <div class="flex flex-wrap gap-1">
                  <span 
                    v-for="member in group.members.slice(0, 3)" 
                    :key="member"
                    class="px-2 py-1 bg-green-100 text-green-800 text-xs rounded"
                  >
                    {{ member === userStore.user?.email ? 'Tú' : member.split('@')[0] }}
                  </span>
                  <span 
                    v-if="group.members.length > 3"
                    class="px-2 py-1 bg-gray-100 text-gray-600 text-xs rounded"
                  >
                    +{{ group.members.length - 3 }} más
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Panel de gestión de grupos -->
      <div v-if="activeTab === 'groups'">
        <div class="bg-white rounded-lg shadow-lg">
          <div class="p-4 border-b border-gray-200">
            <h2 class="text-lg font-semibold text-gray-900 flex items-center">
              <svg class="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197m13.5-9a2.5 2.5 0 11-5 0 2.5 2.5 0 015 0z"></path>
              </svg>
              Gestión de Grupos de Seguridad
            </h2>
          </div>
          <div class="p-6">
            <GroupManager />
          </div>
        </div>
      </div>

      <!-- Estado de carga -->
      <div v-if="loading" class="bg-white rounded-lg shadow-lg p-8 text-center">
        <div class="animate-spin rounded-full h-8 w-8 border-b-2 border-green-500 mx-auto mb-4"></div>
        <span class="text-gray-600">Cargando datos...</span>
      </div>

      <!-- Mensaje cuando no hay autenticación -->
      <div v-if="!userStore.isAuthenticated" class="bg-yellow-50 border border-yellow-200 rounded-lg p-6 text-center">
        <div class="text-yellow-800">
          <svg class="w-12 h-12 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.996-.833-2.764 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z"></path>
          </svg>
          <h3 class="text-lg font-semibold mb-2">Acceso Requerido</h3>
          <p class="text-sm">Debes iniciar sesión para acceder al panel de estadísticas.</p>
          <RouterLink 
            :to="{ name: 'Login' }" 
            class="inline-block mt-4 px-4 py-2 bg-yellow-500 hover:bg-yellow-600 text-white rounded-lg transition-colors"
          >
            Iniciar Sesión
          </RouterLink>
        </div>
      </div>
    </div>
  </LayoutView>
</template>