<script setup lang="ts">
import { ref, onMounted, onUnmounted, computed } from 'vue'
import { 
  subscribeToAlerts, 
  respondToInvitation,
  subscribeToUserInvitations,
  type FirebaseAlert,
  type GroupInvitation 
} from '@/firebase'

// IMPORTAR SISTEMA AUTO-SYNC
import {
  createAutoSyncGroup,
  addMemberAutoSync,
  subscribeToUserGroupsAutoSync,
  migrateExistingGroupsToAutoSync,
  checkAutoSyncHealth,
  type UnifiedGroup
} from '@/firebase/autoSync'

import MapPanel from '@/components/estadisticas/MapPanel.vue'
import LocationTracker from '@/components/locationTracker.vue'
import MainNav from '../../components/MainNav.vue'
import LayoutView from './LayoutView.vue'
import { useUserStore } from '@/stores/user'

const userStore = useUserStore()
const userGroups = ref<UnifiedGroup[]>([]) // Cambiar a UnifiedGroup
const alerts = ref<FirebaseAlert[]>([])
const pendingInvitations = ref<GroupInvitation[]>([])
const loading = ref(true)
const selectedGroup = ref<UnifiedGroup | null>(null) // Cambiar a UnifiedGroup
const alertFilter = ref<'dia' | 'semana' | 'mes'>('dia')

// Estados para crear grupo
const showCreateGroup = ref(false)
const showInviteModal = ref(false)
const selectedGroupForInvite = ref<UnifiedGroup | null>(null) // Cambiar a UnifiedGroup

// Estado de auto-sincronización
const autoSyncHealth = ref({
  totalGroups: 0,
  syncedGroups: 0,
  healthPercentage: 100,
  needsUpdate: []
})

const migrating = ref(false)
const migrationResult = ref<any>(null)

// Formularios
const newGroup = ref({
  name: '',
  description: ''
})

const inviteForm = ref({
  email: '',
  loading: false
})

const error = ref<string | null>(null)
const success = ref<string | null>(null)

// Computed para filtrar alertas según el período seleccionado
const filteredAlerts = computed(() => {
  const now = new Date()
  let filterDate = new Date()
  
  switch (alertFilter.value) {
    case 'dia':
      filterDate.setDate(now.getDate() - 1)
      break
    case 'semana':
      filterDate.setDate(now.getDate() - 7)
      break
    case 'mes':
      filterDate.setMonth(now.getMonth() - 1)
      break
  }
  
  return alerts.value.filter(alert => {
    const alertDate = alert.timestamp?.toDate ? alert.timestamp.toDate() : new Date(alert.timestamp)
    return alertDate >= filterDate
  }).sort((a, b) => {
    const dateA = a.timestamp?.toDate ? a.timestamp.toDate() : new Date(a.timestamp)
    const dateB = b.timestamp?.toDate ? b.timestamp.toDate() : new Date(b.timestamp)
    return dateB.getTime() - dateA.getTime()
  })
})

// FUNCIÓN ACTUALIZADA: Crear grupo con auto-sincronización
const createNewGroup = async () => {
  if (!newGroup.value.name.trim()) {
    error.value = 'El nombre del grupo es requerido'
    return
  }

  loading.value = true
  error.value = null

  try {
    await createAutoSyncGroup({
      name: newGroup.value.name.trim(),
      description: newGroup.value.description.trim(),
      createdBy: userStore.user?.email || '',
      members: [userStore.user?.email || ''],
      pendingInvitations: []
    })

    success.value = '🚀 Grupo creado y sincronizado automáticamente (Web ↔ Móvil)'
    newGroup.value = { name: '', description: '' }
    showCreateGroup.value = false
    
    // Actualizar salud de sincronización
    await updateSyncHealth()
  } catch (err: any) {
    error.value = err.message || 'Error al crear el grupo'
  } finally {
    loading.value = false
  }
}

// FUNCIÓN ACTUALIZADA: Invitar usuario con auto-sincronización
const inviteUser = async () => {
  if (!inviteForm.value.email.trim() || !selectedGroupForInvite.value) {
    error.value = 'El email es requerido'
    return
  }

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  if (!emailRegex.test(inviteForm.value.email)) {
    error.value = 'Formato de email inválido'
    return
  }

  inviteForm.value.loading = true
  error.value = null

  try {
    await addMemberAutoSync(selectedGroupForInvite.value.id, inviteForm.value.email.trim())

    success.value = `📱 ${inviteForm.value.email} agregado automáticamente (Web ↔ Móvil)`
    inviteForm.value.email = ''
    showInviteModal.value = false
    selectedGroupForInvite.value = null
    
    // Actualizar salud de sincronización
    await updateSyncHealth()
  } catch (err: any) {
    error.value = err.message || 'Error al enviar la invitación'
  } finally {
    inviteForm.value.loading = false
  }
}

// Responder a invitación (mantener lógica original)
const respondInvitation = async (invitationId: string, response: 'accepted' | 'rejected') => {
  loading.value = true
  error.value = null

  try {
    await respondToInvitation(invitationId, response)
    success.value = response === 'accepted' 
      ? 'Te has unido al grupo exitosamente' 
      : 'Invitación rechazada'
  } catch (err: any) {
    error.value = err.message || 'Error al responder la invitación'
  } finally {
    loading.value = false
  }
}

// Actualizar salud de sincronización
const updateSyncHealth = async () => {
  if (!userStore.user?.email) return
  
  try {
    const health = await checkAutoSyncHealth(userStore.user.email)
    autoSyncHealth.value = health
  } catch (error) {
    console.error('Error actualizando salud de sync:', error)
  }
}

// Ejecutar migración automática
const runAutoMigration = async () => {
  migrating.value = true
  error.value = null
  
  try {
    const result = await migrateExistingGroupsToAutoSync()
    migrationResult.value = result
    success.value = `🎉 Migración completada: ${result.updated}/${result.processed} grupos sincronizados`
    await updateSyncHealth()
  } catch (err: any) {
    error.value = 'Error en migración: ' + err.message
  } finally {
    migrating.value = false
  }
}

// Abrir modal de invitación
const openInviteModal = (group: UnifiedGroup) => {
  selectedGroupForInvite.value = group
  showInviteModal.value = true
  inviteForm.value.email = ''
  error.value = null
}

// Seleccionar grupo
const selectGroup = (group: UnifiedGroup | null) => {
  selectedGroup.value = group
}

// Obtener color para el estado de alerta
const getAlertTypeColor = (type: string) => {
  switch (type) {
    case 'panic': return 'bg-red-100 text-red-800 border-red-200'
    case 'geofence': return 'bg-yellow-100 text-yellow-800 border-yellow-200'
    default: return 'bg-gray-100 text-gray-800 border-gray-200'
  }
}

// Obtener estado del grupo
const getGroupStatus = (group: UnifiedGroup): string => {
  if (group.isAutoSynced && group.membersUids?.length) {
    return '🟢'
  } else if (group.isAutoSynced) {
    return '🟡'
  } else {
    return '🔴'
  }
}

// Obtener el nombre del usuario desde el email
const getUserDisplayName = (email: string): string => {
  if (email === userStore.user?.email) {
    return 'Tú'
  }
  return email.split('@')[0] // Usar la parte antes del @ como nombre
}

// Limpiar mensajes
const clearMessages = () => {
  error.value = null
  success.value = null
}

let unsubscribeUserGroups: (() => void) | null = null
let unsubscribeAlerts: (() => void) | null = null
let unsubscribeInvitations: (() => void) | null = null

onMounted(async () => {
  if (!userStore.isAuthenticated || !userStore.user?.email) return

  console.log('🚀 Iniciando EstadisticasView con auto-sync para:', userStore.user.email)

  // ACTUALIZADO: Suscribirse a grupos con auto-sincronización
  unsubscribeUserGroups = await subscribeToUserGroupsAutoSync(
    userStore.user.email,
    (groups) => {
      console.log('📊 Grupos auto-sync actualizados:', groups.length)
      userGroups.value = groups
      loading.value = false
      if (groups.length > 0 && !selectedGroup.value) {
        selectedGroup.value = groups[0]
      }
    }
  )

  // Suscribirse a las alertas (mantener original)
  unsubscribeAlerts = subscribeToAlerts((alertsData) => {
    alerts.value = alertsData
  })

  // Suscribirse a invitaciones pendientes (mantener original)
  unsubscribeInvitations = subscribeToUserInvitations(userStore.user.email, (invitations) => {
    pendingInvitations.value = invitations
  })

  // Actualizar salud de sincronización
  await updateSyncHealth()

  // Ejecutar migración automática si es necesario
  if (autoSyncHealth.value.healthPercentage < 100 && autoSyncHealth.value.totalGroups > 0) {
    console.log('🔄 Ejecutando migración automática en estadísticas...')
    setTimeout(() => runAutoMigration(), 2000)
  }
})

onUnmounted(() => {
  if (unsubscribeUserGroups) unsubscribeUserGroups()
  if (unsubscribeAlerts) unsubscribeAlerts()
  if (unsubscribeInvitations) unsubscribeInvitations()
})
</script>

<template>
  <LayoutView>
    <MainNav />

    <!-- COMPONENTE OCULTO PARA RASTREO GPS -->
    <div class="hidden">
      <LocationTracker />
    </div>
  
    <div class="min-h-screen custom-green-bg pt-20">
      <!-- Header compacto CON ESTADO DE AUTO-SYNC -->
      <div class="bg-white border-b border-gray-200 px-6 py-4 shadow-sm">
        <div class="flex items-center justify-between">
          <div>
            <h1 class="text-xl font-semibold text-gray-900 flex items-center">
              <svg class="w-6 h-6 mr-2 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"></path>
              </svg>
              Panel de Control 
              <span v-if="migrating" class="ml-2 text-sm text-blue-600 flex items-center">
                <svg class="w-4 h-4 mr-1 animate-spin" fill="none" viewBox="0 0 24 24">
                  <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                  <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                Migrando...
              </span>
            </h1>
            <p class="text-sm text-gray-600">Monitoreo en tiempo real con sincronización automática</p>
          </div>
          <div class="flex items-center space-x-4 text-sm">
            <!-- Estadísticas mejoradas -->
            <div class="flex items-center bg-green-50 px-3 py-2 rounded-lg">
              <span class="w-2 h-2 bg-green-500 rounded-full mr-2"></span>
              <span class="text-green-700 font-medium">{{ userGroups.length }} grupos</span>
            </div>
            <div class="flex items-center bg-blue-50 px-3 py-2 rounded-lg">
              <span class="w-2 h-2 bg-blue-500 rounded-full mr-2"></span>
              <span class="text-blue-700 font-medium">{{ userGroups.reduce((total, group) => total + group.members.length, 0) }} miembros</span>
            </div>
            <!-- Indicador de sincronización mejorado -->
            <div class="flex items-center px-3 py-2 rounded-lg" :class="{
              'bg-green-50': autoSyncHealth.healthPercentage >= 90,
              'bg-yellow-50': autoSyncHealth.healthPercentage >= 70,
              'bg-red-50': autoSyncHealth.healthPercentage < 70
            }">
              <div :class="[
                'w-2 h-2 rounded-full mr-2',
                autoSyncHealth.healthPercentage >= 90 ? 'bg-green-500' : 
                autoSyncHealth.healthPercentage >= 70 ? 'bg-yellow-500' : 'bg-red-500'
              ]"></div>
              <span :class="[
                'font-medium text-xs',
                autoSyncHealth.healthPercentage >= 90 ? 'text-green-700' : 
                autoSyncHealth.healthPercentage >= 70 ? 'text-yellow-700' : 'text-red-700'
              ]">Sync: {{ autoSyncHealth.healthPercentage }}%</span>
            </div>
            <!-- Indicador de GPS -->
            <div class="flex items-center bg-red-50 px-3 py-2 rounded-lg">
              <div class="w-2 h-2 bg-red-500 rounded-full mr-2 animate-pulse"></div>
              <span class="text-red-700 font-medium text-xs">GPS activo</span>
            </div>
          </div>
        </div>

        <!-- BARRA DE ESTADO DE MIGRACIÓN -->
        <div v-if="migrationResult" class="mt-3 p-3 bg-gradient-to-r from-green-50 to-green-100 border border-green-200 rounded-lg">
          <div class="flex items-center">
            <svg class="w-5 h-5 text-green-600 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"></path>
            </svg>
            <span class="text-green-700 font-medium">
              Migración completada: {{ migrationResult.updated }}/{{ migrationResult.processed }} grupos sincronizados
            </span>
          </div>
        </div>
      </div>

      <!-- Mensajes -->
      <div v-if="error" class="mx-6 mt-4">
        <div class="bg-red-50 border border-red-200 rounded-lg p-4 shadow-sm">
          <div class="flex justify-between items-center">
            <div class="flex items-center">
              <svg class="w-5 h-5 text-red-500 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.996-.833-2.764 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z"></path>
              </svg>
              <p class="text-red-600 text-sm">{{ error }}</p>
            </div>
            <button @click="clearMessages" class="text-red-400 hover:text-red-600">
              <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path>
              </svg>
            </button>
          </div>
        </div>
      </div>

      <div v-if="success" class="mx-6 mt-4">
        <div class="bg-green-50 border border-green-200 rounded-lg p-4 shadow-sm">
          <div class="flex justify-between items-center">
            <div class="flex items-center">
              <svg class="w-5 h-5 text-green-500 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"></path>
              </svg>
              <p class="text-green-600 text-sm">{{ success }}</p>
            </div>
            <button @click="clearMessages" class="text-green-400 hover:text-green-600">
              <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path>
              </svg>
            </button>
          </div>
        </div>
      </div>

      <!-- Invitaciones pendientes (MEJORADAS) -->
      <div v-if="pendingInvitations.length > 0" class="mx-6 mt-4">
        <div class="bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-lg p-4 shadow-sm">
          <h3 class="font-semibold text-blue-800 mb-3 flex items-center">
            <svg class="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 8l7.89 4.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"></path>
            </svg>
            Invitaciones Pendientes 
            <span class="ml-2 bg-blue-200 text-blue-800 px-2 py-1 rounded-full text-xs">
              {{ pendingInvitations.length }}
            </span>
          </h3>
          <div class="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div 
              v-for="invitation in pendingInvitations" 
              :key="invitation.id"
              class="bg-white rounded-lg p-4 border border-blue-100 hover:border-blue-200 transition-colors"
            >
              <div class="flex justify-between items-start">
                <div>
                  <h4 class="font-medium text-gray-800">{{ invitation.groupName }}</h4>
                  <p class="text-sm text-gray-600 mt-1">
                    Invitado por: <span class="font-medium">{{ invitation.inviterName }}</span>
                  </p>
                  <p class="text-xs text-gray-500 mt-1">
                    {{ invitation.inviterEmail }}
                  </p>
                  <p class="text-xs text-gray-400 mt-2 flex items-center">
                    <svg class="w-3 h-3 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"></path>
                    </svg>
                    {{ new Date(invitation.createdAt.toDate()).toLocaleDateString() }}
                  </p>
                </div>
                <div class="flex flex-col gap-2">
                  <button
                    @click="respondInvitation(invitation.id, 'accepted')"
                    :disabled="loading"
                    class="px-3 py-1 bg-green-500 hover:bg-green-600 text-white text-sm rounded-lg transition-colors disabled:opacity-50 flex items-center"
                  >
                    <svg class="w-3 h-3 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"></path>
                    </svg>
                    Aceptar
                  </button>
                  <button
                    @click="respondInvitation(invitation.id, 'rejected')"
                    :disabled="loading"
                    class="px-3 py-1 bg-red-500 hover:bg-red-600 text-white text-sm rounded-lg transition-colors disabled:opacity-50 flex items-center"
                  >
                    <svg class="w-3 h-3 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path>
                    </svg>
                    Rechazar
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Layout principal de 3 columnas -->
      <div class="flex overflow-hidden" style="height: calc(100vh - 200px);">
        <!-- Panel izquierdo - Grupos CON AUTO-SYNC MEJORADO -->
        <div class="w-80 bg-white border-r border-gray-200 flex flex-col flex-shrink-0 shadow-sm">
          <!-- Header de grupos -->
          <div class="p-4 border-b border-gray-200 bg-gradient-to-r from-green-50 to-blue-50">
            <div class="flex justify-between items-center mb-4">
              <h2 class="font-semibold text-gray-800 flex items-center">
                <svg class="w-5 h-5 mr-2 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"></path>
                </svg>
                Mis Grupos
                <span class="ml-2 bg-white px-2 py-1 rounded-full text-xs text-purple-600 border">
                  Auto-Sync
                </span>
              </h2>
              <button
                @click="showCreateGroup = !showCreateGroup"
                class="px-3 py-2 bg-green-500 hover:bg-green-600 text-white text-sm rounded-lg transition-colors flex items-center shadow-sm"
              >
                <svg class="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4"></path>
                </svg>
                Crear
              </button>
            </div>
            
            <!-- INDICADOR DE SALUD DE SINCRONIZACIÓN MEJORADO -->
            <div class="mb-4 p-3 bg-white border border-purple-200 rounded-lg shadow-sm">
              <div class="flex justify-between items-center text-xs mb-2">
                <span class="text-purple-700 font-medium flex items-center">
                  <svg class="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"></path>
                  </svg>
                  Estado Sync
                </span>
                <span :class="[
                  'font-bold px-2 py-1 rounded-full',
                  autoSyncHealth.healthPercentage >= 90 ? 'text-green-600 bg-green-100' : 
                  autoSyncHealth.healthPercentage >= 70 ? 'text-yellow-600 bg-yellow-100' : 'text-red-600 bg-red-100'
                ]">{{ autoSyncHealth.healthPercentage }}%</span>
              </div>
              <div class="grid grid-cols-2 gap-2 text-xs">
                <div class="text-center">
                  <div class="font-semibold text-gray-800">{{ autoSyncHealth.syncedGroups }}</div>
                  <div class="text-gray-500">Sincronizados</div>
                </div>
                <div class="text-center">
                  <div class="font-semibold text-gray-800">{{ autoSyncHealth.totalGroups }}</div>
                  <div class="text-gray-500">Total</div>
                </div>
              </div>
            </div>

            <!-- Formulario crear grupo ACTUALIZADO Y MEJORADO -->
            <div v-if="showCreateGroup" class="mb-4 p-4 bg-white border border-green-200 rounded-lg shadow-sm">
              <h4 class="font-medium text-gray-800 mb-3 flex items-center">
                <svg class="w-4 h-4 mr-2 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4"></path>
                </svg>
                Nuevo Grupo Auto-Sync
              </h4>
              <div class="space-y-3">
                <div>
                  <input
                    v-model="newGroup.name"
                    type="text"
                    class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 text-sm"
                    placeholder="Nombre del grupo"
                    maxlength="50"
                    @keyup.enter="createNewGroup"
                  />
                </div>
                <div>
                  <textarea
                    v-model="newGroup.description"
                    rows="2"
                    class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 resize-none text-sm"
                    placeholder="Descripción (opcional)"
                    maxlength="200"
                  ></textarea>
                </div>
                <div class="bg-blue-50 p-2 rounded border border-blue-200">
                  <p class="text-xs text-blue-800 flex items-center">
                    <svg class="w-3 h-3 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path>
                    </svg>
                    Se sincronizará automáticamente con la app móvil
                  </p>
                </div>
                <div class="flex gap-2">
                  <button
                    @click="createNewGroup"
                    :disabled="loading"
                    class="flex-1 px-3 py-2 bg-green-500 hover:bg-green-600 text-white text-sm rounded-lg transition-colors disabled:opacity-50 flex items-center justify-center"
                  >
                    <svg v-if="loading" class="w-4 h-4 mr-1 animate-spin" fill="none" viewBox="0 0 24 24">
                      <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                      <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    <span>{{ loading ? 'Creando...' : 'Crear' }}</span>
                  </button>
                  <button
                    @click="showCreateGroup = false"
                    class="px-3 py-2 bg-gray-300 hover:bg-gray-400 text-gray-700 text-sm rounded-lg transition-colors"
                  >
                    Cancelar
                  </button>
                </div>
              </div>
            </div>
          </div>

          <!-- Lista de grupos ACTUALIZADA Y MEJORADA -->
          <div class="flex-1 overflow-y-auto p-4">
            <div v-if="userGroups.length === 0 && !showCreateGroup" class="text-center py-8 text-gray-500">
              <svg class="w-12 h-12 mx-auto mb-4 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"></path>
              </svg>
              <p class="text-sm">No tienes grupos aún</p>
              <p class="text-xs text-gray-400">Crea tu primer grupo con auto-sincronización</p>
            </div>
            <div v-else class="space-y-3">
              <div 
                v-for="group in userGroups" 
                :key="group.id"
                @click="selectGroup(group)"
                :class="[
                  'p-4 rounded-xl border cursor-pointer transition-all duration-200 relative group',
                  selectedGroup && selectedGroup.id === group.id
                    ? 'bg-gradient-to-r from-green-50 to-blue-50 border-green-300 shadow-md'
                    : 'bg-white border-gray-200 hover:border-green-300 hover:shadow-sm'
                ]"
              >
                <!-- INDICADOR DE ESTADO DE SINCRONIZACIÓN MEJORADO -->
                <div class="absolute top-3 right-3">
                  <div class="flex items-center gap-1">
                    <span class="text-lg" :title="group.isAutoSynced ? 'Sincronizado' : 'Sin sincronizar'">
                      {{ getGroupStatus(group) }}
                    </span>
                    <button
                      @click.stop="openInviteModal(group)"
                      class="opacity-0 group-hover:opacity-100 transition-opacity p-1 text-blue-500 hover:text-blue-700 rounded"
                      title="Agregar miembro"
                    >
                      <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z"></path>
                      </svg>
                    </button>
                  </div>
                </div>

                <!-- Header del grupo -->
                <div class="flex items-center justify-between mb-3 pr-16">
                  <div>
                    <h3 class="font-semibold text-gray-900 text-sm mb-1">{{ group.name }}</h3>
                    <p v-if="group.description" class="text-xs text-gray-600 line-clamp-2 mb-2">
                      {{ group.description }}
                    </p>
                    <div class="flex items-center text-xs text-gray-500">
                      <svg class="w-3 h-3 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"></path>
                      </svg>
                      {{ group.createdBy === userStore.user?.email ? 'Creado por ti' : `Por: ${group.createdBy.split('@')[0]}` }}
                    </div>
                  </div>
                </div>

                <!-- INFORMACIÓN DE SINCRONIZACIÓN COMPACTA -->
                <div v-if="group.isAutoSynced" class="mb-3 p-2 bg-white/70 rounded border border-purple-100">
                  <div class="flex items-center justify-between text-xs">
                    <div class="flex items-center text-purple-600">
                      <svg class="w-3 h-3 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"></path>
                      </svg>
                      Auto-Sync
                    </div>
                    <div class="text-right">
                      <div class="text-gray-600">
                        UIDs: <span :class="group.membersUids?.length ? 'text-green-600 font-medium' : 'text-gray-400'">
                          {{ group.membersUids?.length || 0 }}/{{ group.members.length }}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>

                <!-- Lista de miembros COMPACTA -->
                <div>
                  <div class="flex items-center justify-between mb-2">
                    <h4 class="text-xs font-medium text-gray-700 uppercase tracking-wide">
                      Miembros ({{ group.members.length }})
                    </h4>
                  </div>
                  
                  <div class="space-y-1">
                    <div 
                      v-for="(member, index) in group.members.slice(0, 3)" 
                      :key="member"
                      class="flex items-center justify-between text-xs"
                    >
                      <div class="flex items-center">
                        <div :class="[
                          'w-2 h-2 rounded-full mr-2',
                          group.membersUids && group.membersUids[index] ? 'bg-green-500' : 'bg-gray-400'
                        ]"></div>
                        <span :class="member === userStore.user?.email ? 'font-medium text-green-700' : 'text-gray-600'">
                          {{ getUserDisplayName(member) }}
                        </span>
                        <!-- Indicadores compactos -->
                        <div class="flex items-center ml-1 space-x-0.5">
                          <span v-if="group.createdBy === member" class="text-yellow-500 text-xs">👑</span>
                          <span v-if="group.membersUids && group.membersUids[index]" class="text-green-500 text-xs">📱</span>
                        </div>
                      </div>
                    </div>
                    <div v-if="group.members.length > 3" class="text-xs text-gray-500 pl-4">
                      +{{ group.members.length - 3 }} más
                    </div>
                  </div>
                </div>

                <!-- Indicador de grupo seleccionado -->
                <div v-if="selectedGroup && selectedGroup.id === group.id" 
                     class="mt-3 pt-2 border-t border-green-200">
                  <div class="flex items-center text-green-600 text-xs">
                    <svg class="w-3 h-3 mr-1" fill="currentColor" viewBox="0 0 20 20">
                      <path fill-rule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clip-rule="evenodd"></path>
                    </svg>
                    Grupo activo en mapa
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- Panel central - Mapa (SIN CAMBIOS) -->
        <div class="flex-1 bg-white relative overflow-hidden">
          <div class="absolute inset-0">
            <MapPanel 
              :loading="loading" 
              :selected-group="selectedGroup"
              :user-groups="userGroups"
            />
          </div>
        </div>

        <!-- Panel derecho - Alertas (MEJORADO) -->
        <div class="w-80 bg-white border-l border-gray-200 flex flex-col flex-shrink-0 shadow-sm">
          <!-- Header de alertas con filtros -->
          <div class="p-4 border-b border-gray-200 bg-gradient-to-r from-red-50 to-orange-50">
            <div class="flex items-center justify-between mb-4">
              <h2 class="font-semibold text-gray-800 flex items-center">
                <svg class="w-5 h-5 mr-2 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.996-.833-2.764 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z"></path>
                </svg>
                Alertas Recientes
              </h2>
              <span class="bg-red-100 text-red-700 px-2 py-1 rounded-full text-xs font-medium">
                {{ filteredAlerts.length }}
              </span>
            </div>
            <!-- Filtros de tiempo mejorados -->
            <div class="flex space-x-1 bg-white rounded-lg p-1 shadow-sm">
              <button
                v-for="filter in [
                  { key: 'dia', label: 'Día', icon: '📅' },
                  { key: 'semana', label: 'Semana', icon: '📊' },
                  { key: 'mes', label: 'Mes', icon: '🗓️' }
                ]"
                :key="filter.key"
                @click="alertFilter = filter.key"
                :class="[
                  'flex-1 px-3 py-2 text-xs font-medium rounded-md transition-all flex items-center justify-center',
                  alertFilter === filter.key
                    ? 'bg-red-500 text-white shadow-sm'
                    : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
                ]"
              >
                <span class="mr-1">{{ filter.icon }}</span>
                {{ filter.label }}
              </button>
            </div>
          </div>

          <!-- Lista de alertas MEJORADA -->
          <div class="flex-1 overflow-y-auto p-4">
            <div v-if="filteredAlerts.length === 0" class="text-center py-12 text-gray-500">
              <svg class="w-16 h-16 mx-auto mb-4 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"></path>
              </svg>
              <p class="text-sm font-medium">Sin alertas en este período</p>
              <p class="text-xs text-gray-400 mt-1">Las alertas aparecerán aquí cuando ocurran</p>
            </div>
            <div v-else class="space-y-3">
              <div 
                v-for="alert in filteredAlerts" 
                :key="alert.id"
                class="bg-white border rounded-xl p-4 hover:shadow-md transition-all duration-200"
                :class="{
                  'border-red-200 bg-red-50': alert.type === 'panic',
                  'border-yellow-200 bg-yellow-50': alert.type === 'geofence',
                  'border-gray-200': alert.type !== 'panic' && alert.type !== 'geofence'
                }"
              >
                <!-- Header de la alerta -->
                <div class="flex items-start justify-between mb-3">
                  <div class="flex items-center">
                    <div :class="[
                      'w-3 h-3 rounded-full mr-3 mt-1',
                      alert.type === 'panic' ? 'bg-red-500' : 
                      alert.type === 'geofence' ? 'bg-yellow-500' : 'bg-gray-400'
                    ]"></div>
                    <div>
                      <h4 class="font-semibold text-gray-900 text-sm">{{ alert.userName }}</h4>
                      <p class="text-xs text-gray-600">{{ alert.userEmail }}</p>
                    </div>
                  </div>
                  <span :class="[
                    'px-2 py-1 text-xs rounded-full border font-medium',
                    getAlertTypeColor(alert.type)
                  ]">
                    {{ alert.type === 'panic' ? '🚨 Pánico' : alert.type === 'geofence' ? '⚠️ Geocerca' : '📝 Manual' }}
                  </span>
                </div>

                <!-- Detalles de la alerta -->
                <div class="space-y-2 mb-3">
                  <div class="flex items-start text-xs text-gray-600">
                    <svg class="w-4 h-4 mr-2 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"></path>
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"></path>
                    </svg>
                    <span>{{ alert.location }}</span>
                  </div>
                  <div class="flex items-center text-xs text-gray-600">
                    <svg class="w-4 h-4 mr-2 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"></path>
                    </svg>
                    <span>{{ new Date(alert.timestamp?.toDate ? alert.timestamp.toDate() : alert.timestamp).toLocaleString('es-MX', {
                      day: '2-digit',
                      month: 'short',
                      year: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit'
                    }) }}</span>
                  </div>
                </div>

                <!-- Estado de resolución mejorado -->
                <div class="pt-3 border-t border-gray-200">
                  <div v-if="alert.resolved" class="flex items-center justify-between">
                    <div class="flex items-center text-xs text-green-600">
                      <svg class="w-4 h-4 mr-1" fill="currentColor" viewBox="0 0 20 20">
                        <path fill-rule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clip-rule="evenodd"></path>
                      </svg>
                      <span class="font-medium">Resuelta</span>
                    </div>
                    <span class="px-2 py-1 bg-green-100 text-green-700 text-xs rounded-full">
                      ✅ Atendida
                    </span>
                  </div>
                  <div v-else class="flex items-center justify-between">
                    <div class="flex items-center text-xs text-orange-600">
                      <svg class="w-4 h-4 mr-1 animate-pulse" fill="currentColor" viewBox="0 0 20 20">
                        <path fill-rule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clip-rule="evenodd"></path>
                      </svg>
                      <span class="font-medium">Pendiente</span>
                    </div>
                    <span class="px-2 py-1 bg-orange-100 text-orange-700 text-xs rounded-full">
                      ⏳ En espera
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Modal de invitación MEJORADO -->
      <div v-if="showInviteModal" class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
        <div class="bg-white rounded-xl shadow-2xl p-6 w-full max-w-md mx-4 transform transition-all">
          <div class="text-center mb-6">
            <div class="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-blue-100 mb-4">
              <svg class="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z"></path>
              </svg>
            </div>
            <h3 class="text-xl font-semibold text-gray-900 mb-2">
              Agregar Miembro
            </h3>
            <p class="text-sm text-gray-600">
              Grupo: <span class="font-medium text-blue-600">{{ selectedGroupForInvite?.name }}</span>
            </p>
          </div>
          
          <div class="space-y-4">
            <!-- Información importante -->
            <div class="bg-gradient-to-r from-blue-50 to-purple-50 p-4 rounded-lg border border-blue-200">
              <div class="flex items-start">
                <svg class="w-5 h-5 text-blue-600 mt-0.5 mr-3 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"></path>
                </svg>
                <div>
                  <p class="text-sm font-medium text-blue-800 mb-1">Auto-Sincronización Activa</p>
                  <p class="text-xs text-blue-700">
                    El miembro será agregado automáticamente en web y móvil usando su UID de usuario registrado.
                  </p>
                </div>
              </div>
            </div>

            <!-- Campo de email -->
            <div>
              <label class="block text-sm font-medium text-gray-700 mb-2">
                Email del usuario *
              </label>
              <div class="relative">
                <input
                  v-model="inviteForm.email"
                  type="email"
                  class="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-colors"
                  placeholder="usuario@correo.com"
                  :disabled="inviteForm.loading"
                  @keyup.enter="inviteUser"
                />
                <svg class="absolute right-3 top-3 w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 8l7.89 4.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"></path>
                </svg>
              </div>
              <p class="text-xs text-gray-500 mt-2 flex items-center">
                <svg class="w-4 h-4 mr-1 text-yellow-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path>
                </svg>
                El usuario debe estar registrado en el sistema para obtener su UID
              </p>
            </div>
            
            <!-- Botones de acción -->
            <div class="flex gap-3 pt-2">
              <button
                @click="inviteUser"
                :disabled="inviteForm.loading || !inviteForm.email.trim()"
                class="flex-1 px-4 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center font-medium"
              >
                <svg v-if="inviteForm.loading" class="w-4 h-4 mr-2 animate-spin" fill="none" viewBox="0 0 24 24">
                  <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                  <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                <svg v-else class="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"></path>
                </svg>
                <span>{{ inviteForm.loading ? 'Agregando...' : 'Agregar y Sincronizar' }}</span>
              </button>
              <button
                @click="showInviteModal = false; selectedGroupForInvite = null"
                :disabled="inviteForm.loading"
                class="px-4 py-3 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg transition-colors disabled:opacity-50 font-medium"
              >
                Cancelar
              </button>
            </div>
          </div>
        </div>
      </div>

      <!-- Estado de carga -->
      <div v-if="loading" class="fixed inset-0 bg-white bg-opacity-90 flex items-center justify-center z-50">
        <div class="text-center">
          <div class="relative">
            <div class="animate-spin rounded-full h-12 w-12 border-4 border-green-500 border-t-transparent mx-auto mb-4"></div>
            <div class="absolute inset-0 flex items-center justify-center">
              <svg class="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"></path>
              </svg>
            </div>
          </div>
          <p class="text-gray-700 font-medium">Cargando datos con auto-sincronización...</p>
          <p class="text-sm text-gray-500 mt-1">Sincronizando entre web y móvil</p>
        </div>
      </div>
    </div>
  </LayoutView>
</template>

<style scoped>
/* Animaciones personalizadas */
@keyframes slideIn {
  from {
    opacity: 0;
    transform: translateY(-10px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

@keyframes fadeIn {
  from {
    opacity: 0;
  }
  to {
    opacity: 1;
  }
}

.group-card {
  animation: slideIn 0.3s ease-out;
}

.alert-card {
  animation: fadeIn 0.4s ease-out;
}

/* Efecto hover mejorado para las tarjetas de grupo */
.group:hover {
  transform: translateY(-2px);
}

/* Estilo para el texto truncado */
.line-clamp-2 {
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

/* Efecto de glassmorphism para modales */
.modal-backdrop {
  backdrop-filter: blur(5px);
}

/* Efectos de transición suaves */
.transition-all {
  transition-property: all;
  transition-timing-function: cubic-bezier(0.4, 0, 0.2, 1);
  transition-duration: 150ms;
}

/* Estilos para scrollbar personalizada */
.overflow-y-auto::-webkit-scrollbar {
  width: 4px;
}

.overflow-y-auto::-webkit-scrollbar-track {
  background: #f1f5f9;
}

.overflow-y-auto::-webkit-scrollbar-thumb {
  background: #cbd5e1;
  border-radius: 2px;
}

.overflow-y-auto::-webkit-scrollbar-thumb:hover {
  background: #94a3b8;
}
</style>