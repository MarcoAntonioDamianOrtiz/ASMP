<script setup lang="ts">
import { ref, onMounted, onUnmounted, computed } from 'vue'
import { useUserStore } from '@/stores/user'
import { 
  getUserSyncStatus,
  checkCollectionCompatibility,
  cleanupOrphanedSyncData
} from '@/firebase'

// IMPORTAR CORRECTAMENTE DESDE autoSync
import {
  migrateExistingGroupsToAutoSync,
  checkAutoSyncHealth
} from '@/firebase/autoSync'

const userStore = useUserStore()

// Estado del componente
const syncStatus = ref({
  webGroups: [],
  mobileGroups: [],
  syncedGroups: 0,
  pendingInvitations: [],
  needsAttention: false
})

const compatibility = ref({
  webGroups: 0,
  mobileGroups: 0,
  syncMappings: 0,
  needsMigration: false
})

const loading = ref(false)
const error = ref<string | null>(null)
const success = ref<string | null>(null)
const showDetails = ref(false)

// Estados computados
const syncHealthScore = computed(() => {
  const total = compatibility.value.webGroups + compatibility.value.mobileGroups
  if (total === 0) return 100
  
  const synced = compatibility.value.syncMappings * 2 // Cada mapeo representa 2 grupos
  return Math.round((synced / total) * 100)
})

const healthColor = computed(() => {
  const score = syncHealthScore.value
  if (score >= 90) return 'text-green-600'
  if (score >= 70) return 'text-yellow-600'
  return 'text-red-600'
})

const syncStatusText = computed(() => {
  if (syncStatus.value.needsAttention) return 'Requiere Atención'
  if (compatibility.value.needsMigration) return 'Migración Pendiente'
  if (syncHealthScore.value === 100) return 'Perfectamente Sincronizado'
  return 'Sincronización Parcial'
})

// Funciones
const refreshSyncStatus = async () => {
  if (!userStore.user?.email) return
  
  loading.value = true
  error.value = null
  
  try {
    const [status, compat] = await Promise.all([
      getUserSyncStatus(userStore.user.email),
      checkCollectionCompatibility()
    ])
    
    syncStatus.value = status
    compatibility.value = compat
    
    console.log('🔄 Estado de sincronización actualizado:', status, compat)
  } catch (err: any) {
    error.value = 'Error actualizando estado: ' + err.message
  } finally {
    loading.value = false
  }
}

const runMigration = async () => {
  loading.value = true
  error.value = null
  
  try {
    // USAR LA FUNCIÓN CORRECTA DE autoSync
    const result = await migrateExistingGroupsToAutoSync()
    success.value = `Migración completada: ${result.updated}/${result.processed} grupos actualizados`
    await refreshSyncStatus()
  } catch (err: any) {
    error.value = 'Error en migración: ' + err.message
  } finally {
    loading.value = false
  }
}

const cleanupData = async () => {
  if (!confirm('¿Seguro que deseas limpiar datos huérfanos? Esta acción no se puede deshacer.')) return
  
  loading.value = true
  error.value = null
  
  try {
    const result = await cleanupOrphanedSyncData()
    success.value = `Limpieza completada: ${result.deletedMappings} mapeos y ${result.deletedMobileGroups} grupos eliminados`
    await refreshSyncStatus()
  } catch (err: any) {
    error.value = 'Error en limpieza: ' + err.message
  } finally {
    loading.value = false
  }
}

const clearMessages = () => {
  error.value = null
  success.value = null
}

// Auto-refresh cada 30 segundos
let refreshInterval: NodeJS.Timeout | null = null

onMounted(async () => {
  await refreshSyncStatus()
  refreshInterval = setInterval(refreshSyncStatus, 30000)
})

onUnmounted(() => {
  if (refreshInterval) clearInterval(refreshInterval)
})
</script>

<template>
  <div class="bg-white rounded-lg shadow-lg p-4 max-w-sm">
    <!-- Header -->
    <div class="flex justify-between items-center mb-4">
      <h3 class="font-semibold text-gray-800 flex items-center text-sm">
        <svg class="w-4 h-4 mr-2 text-purple-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"></path>
        </svg>
        Estado Sync
      </h3>
      <button
        @click="showDetails = !showDetails"
        class="text-purple-600 hover:text-purple-800 text-xs"
      >
        {{ showDetails ? 'Ocultar' : 'Ver más' }}
      </button>
    </div>

    <!-- Mensajes -->
    <div v-if="error" class="mb-3 p-2 bg-red-50 border border-red-200 rounded text-xs">
      <div class="flex justify-between items-center">
        <span class="text-red-600">{{ error }}</span>
        <button @click="clearMessages" class="text-red-400 hover:text-red-600">✕</button>
      </div>
    </div>

    <div v-if="success" class="mb-3 p-2 bg-green-50 border border-green-200 rounded text-xs">
      <div class="flex justify-between items-center">
        <span class="text-green-600">{{ success }}</span>
        <button @click="clearMessages" class="text-green-400 hover:text-green-600">✕</button>
      </div>
    </div>

    <!-- Score de Sincronización -->
    <div class="text-center mb-4">
      <div class="relative w-16 h-16 mx-auto mb-2">
        <svg class="w-16 h-16 transform -rotate-90" viewBox="0 0 100 100">
          <!-- Círculo de fondo -->
          <circle cx="50" cy="50" r="40" fill="none" stroke="#e5e7eb" stroke-width="8"/>
          <!-- Círculo de progreso -->
          <circle 
            cx="50" 
            cy="50" 
            r="40" 
            fill="none" 
            :stroke="syncHealthScore >= 90 ? '#10b981' : syncHealthScore >= 70 ? '#f59e0b' : '#ef4444'"
            stroke-width="8"
            stroke-linecap="round"
            :stroke-dasharray="`${syncHealthScore * 2.51} 251`"
            class="transition-all duration-500"
          />
        </svg>
        <div class="absolute inset-0 flex items-center justify-center">
          <span :class="['text-lg font-bold', healthColor]">{{ syncHealthScore }}%</span>
        </div>
      </div>
      <p :class="['text-xs font-medium', healthColor]">{{ syncStatusText }}</p>
    </div>

    <!-- Estadísticas Rápidas -->
    <div class="grid grid-cols-2 gap-2 mb-4">
      <div class="bg-blue-50 rounded p-2 text-center">
        <div class="text-lg font-bold text-blue-600">{{ compatibility.webGroups }}</div>
        <div class="text-xs text-blue-600">Web</div>
      </div>
      <div class="bg-green-50 rounded p-2 text-center">
        <div class="text-lg font-bold text-green-600">{{ compatibility.mobileGroups }}</div>
        <div class="text-xs text-green-600">Móvil</div>
      </div>
    </div>

    <!-- Acciones Rápidas -->
    <div class="space-y-2">
      <button
        @click="refreshSyncStatus"
        :disabled="loading"
        class="w-full px-3 py-2 bg-purple-500 hover:bg-purple-600 text-white text-sm rounded-lg transition-colors disabled:opacity-50 flex items-center justify-center"
      >
        <svg v-if="loading" class="w-4 h-4 mr-2 animate-spin" fill="none" viewBox="0 0 24 24">
          <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
          <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
        </svg>
        {{ loading ? 'Actualizando...' : '🔄 Actualizar' }}
      </button>

      <div v-if="compatibility.needsMigration" class="space-y-1">
        <button
          @click="runMigration"
          :disabled="loading"
          class="w-full px-3 py-2 bg-orange-500 hover:bg-orange-600 text-white text-sm rounded-lg transition-colors disabled:opacity-50"
        >
          🚀 Migrar Auto-Sync
        </button>
      </div>
    </div>

    <!-- Panel de Detalles -->
    <div v-if="showDetails" class="mt-4 pt-4 border-t border-gray-200">
      <div class="space-y-3">
        <!-- Estadísticas Detalladas -->
        <div class="grid grid-cols-2 gap-2 text-xs">
          <div class="bg-gray-50 rounded p-2">
            <div class="font-medium text-gray-700">Sincronizados</div>
            <div class="text-lg font-bold text-purple-600">{{ compatibility.syncMappings }}</div>
          </div>
          <div class="bg-gray-50 rounded p-2">
            <div class="font-medium text-gray-700">Pendientes</div>
            <div class="text-lg font-bold text-orange-600">{{ syncStatus.pendingInvitations.length }}</div>
          </div>
        </div>

        <!-- Estado por Grupo -->
        <div class="space-y-2">
          <h4 class="text-xs font-medium text-gray-700">Estado por Grupo:</h4>
          <div class="max-h-24 overflow-y-auto space-y-1">
            <div v-for="group in syncStatus.webGroups.slice(0, 3)" :key="group.id" 
                class="flex justify-between items-center text-xs bg-gray-50 rounded p-2">
              <span class="truncate mr-2">{{ group.name }}</span>
              <span class="text-green-600 font-medium">✓</span>
            </div>
          </div>
        </div>

        <!-- Acciones Avanzadas -->
        <div class="space-y-1">
          <button
            @click="cleanupData"
            :disabled="loading"
            class="w-full px-3 py-2 bg-red-500 hover:bg-red-600 text-white text-xs rounded-lg transition-colors disabled:opacity-50"
          >
            🧹 Limpiar Datos
          </button>
        </div>

        <!-- Información de Estado -->
        <div class="text-xs text-gray-500 space-y-1">
          <div class="flex justify-between">
            <span>Última actualización:</span>
            <span>{{ new Date().toLocaleTimeString() }}</span>
          </div>
          <div class="flex justify-between">
            <span>Auto-refresh:</span>
            <span class="text-green-600">Cada 30s</span>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>