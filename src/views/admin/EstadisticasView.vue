<script setup lang="ts">
import { ref, onMounted, onUnmounted, computed, watch } from 'vue'
import { 
  respondToInvitation,
  subscribeToUserInvitations,
  inviteToGroup,
  resolveGroupAlert, // Nueva función
  subscribeToGroupAlerts, // Nueva función
  getUserGroupsAlerts, // Nueva función
  getGroupAlertStats, // Nueva función
  type FirebaseAlert,
  type GroupInvitation 
} from '@/firebase'

// IMPORTAR SISTEMA AUTO-SYNC
import {
  createAutoSyncGroup,
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
const userGroups = ref<UnifiedGroup[]>([])
const groupAlerts = ref<(FirebaseAlert & { message: string; phone: string; destinatarios: string[]; emisorId: string })[]>([])
const pendingInvitations = ref<GroupInvitation[]>([])
const loading = ref(true)
const selectedGroup = ref<UnifiedGroup | null>(null)
const alertFilter = ref<'dia' | 'semana' | 'mes'>('dia')

// Estados para estadísticas de alertas
const alertStats = ref({
  total: 0,
  active: 0,
  resolved: 0,
  today: 0,
  thisWeek: 0,
  thisMonth: 0
})

// Estados para crear grupo
const showCreateGroup = ref(false)
const showInviteModal = ref(false)
const selectedGroupForInvite = ref<UnifiedGroup | null>(null)

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

// Variable para manejar la suscripción a alertas
let unsubscribeGroupAlerts: (() => void) | null = null

// Computed para filtrar alertas según el período seleccionado Y el grupo seleccionado
const filteredAlerts = computed(() => {
  if (!selectedGroup.value || !selectedGroup.value.id) {
    return []
  }

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
  
  return groupAlerts.value.filter(alert => {
    // VALIDAR QUE LA ALERTA TENGA DATOS VÁLIDOS
    if (!alert || !alert.timestamp || alert.groupId !== selectedGroup.value?.id) {
      return false
    }
    
    const alertDate = alert.timestamp?.toDate ? alert.timestamp.toDate() : new Date(alert.timestamp)
    
    // VALIDAR QUE LA FECHA SEA VÁLIDA
    if (isNaN(alertDate.getTime())) {
      console.warn('Fecha inválida en alerta:', alert)
      return false
    }
    
    return alertDate >= filterDate
  }).sort((a, b) => {
    const dateA = a.timestamp?.toDate ? a.timestamp.toDate() : new Date(a.timestamp)
    const dateB = b.timestamp?.toDate ? b.timestamp.toDate() : new Date(b.timestamp)
    return dateB.getTime() - dateA.getTime()
  })
})

// Función para formatear ubicación
const formatLocation = (alert: any): string => {
  if (alert.coordinates && alert.coordinates.length === 2) {
    const [lng, lat] = alert.coordinates
    return `${lat.toFixed(6)}, ${lng.toFixed(6)}`
  }
  return alert.location || 'Ubicación no disponible'
}

// Función para obtener el tiempo relativo
const getRelativeTime = (timestamp: any): string => {
  const date = timestamp?.toDate ? timestamp.toDate() : new Date(timestamp)
  const now = new Date()
  const diffInMinutes = Math.floor((now.getTime() - date.getTime()) / (1000 * 60))
  
  if (diffInMinutes < 1) return 'Hace un momento'
  if (diffInMinutes < 60) return `Hace ${diffInMinutes} minuto${diffInMinutes > 1 ? 's' : ''}`
  
  const diffInHours = Math.floor(diffInMinutes / 60)
  if (diffInHours < 24) return `Hace ${diffInHours} hora${diffInHours > 1 ? 's' : ''}`
  
  const diffInDays = Math.floor(diffInHours / 24)
  if (diffInDays < 7) return `Hace ${diffInDays} día${diffInDays > 1 ? 's' : ''}`
  
  return date.toLocaleDateString('es-ES', { 
    day: '2-digit', 
    month: 'short', 
    year: 'numeric',
    hour: '2-digit', 
    minute: '2-digit' 
  })
}

// Función para resolver alerta
const resolveAlert = async (alertId: string) => {
  try {
    await resolveGroupAlert(alertId)
    success.value = 'Alerta marcada como resuelta'
    // Las alertas se actualizarán automáticamente por la suscripción
  } catch (err: any) {
    error.value = err.message || 'Error al resolver la alerta'
  }
}

// Función para actualizar las estadísticas de alertas
const updateAlertStats = async () => {
  if (!selectedGroup.value?.id) {
    alertStats.value = {
      total: 0, active: 0, resolved: 0, today: 0, thisWeek: 0, thisMonth: 0
    }
    return
  }
  
  try {
    const stats = await getGroupAlertStats(selectedGroup.value.id)
    alertStats.value = stats
  } catch (error) {
    console.error('Error actualizando estadísticas de alertas:', error)
  }
}

// Función para suscribirse a las alertas del grupo seleccionado
const subscribeToSelectedGroupAlerts = (groupId: string) => {
  // Limpiar suscripción anterior si existe
  if (unsubscribeGroupAlerts) {
    unsubscribeGroupAlerts()
    unsubscribeGroupAlerts = null
  }
  
  if (!groupId) {
    groupAlerts.value = []
    return
  }
  
  console.log('🚨 Suscribiéndose a alertas del grupo:', groupId)
  
  unsubscribeGroupAlerts = subscribeToGroupAlerts(groupId, (alerts) => {
    console.log(`📍 ${alerts.length} alertas recibidas para el grupo ${groupId}`)
    groupAlerts.value = alerts as any[]
    updateAlertStats()
  })
}

// Watcher para cambios en el grupo seleccionado
watch(selectedGroup, (newGroup, oldGroup) => {
  if (newGroup?.id !== oldGroup?.id) {
    if (newGroup?.id) {
      subscribeToSelectedGroupAlerts(newGroup.id)
    } else {
      groupAlerts.value = []
      if (unsubscribeGroupAlerts) {
        unsubscribeGroupAlerts()
        unsubscribeGroupAlerts = null
      }
    }
  }
}, { immediate: true })

// FUNCIÓN PARA VALIDAR COORDENADAS
const validateCoordinates = (lat: any, lng: any) => {
  const numLat = parseFloat(lat)
  const numLng = parseFloat(lng)
  
  return !isNaN(numLat) && !isNaN(numLng) && 
         numLat >= -90 && numLat <= 90 && 
         numLng >= -180 && numLng <= 180
}

// FUNCIÓN PARA MANEJAR ERRORES DEL MAPA
const handleMapError = (error: any) => {
  console.error('Error en MapPanel:', error)
}

// Crear grupo con auto-sincronización
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
    
    await updateSyncHealth()
  } catch (err: any) {
    error.value = err.message || 'Error al crear el grupo'
  } finally {
    loading.value = false
  }
}

// Enviar invitación por correo
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

  if (inviteForm.value.email === userStore.user?.email) {
    error.value = 'No puedes invitarte a ti mismo'
    return
  }

  if (selectedGroupForInvite.value.members.includes(inviteForm.value.email)) {
    error.value = 'Este usuario ya es miembro del grupo'
    return
  }

  inviteForm.value.loading = true
  error.value = null

  try {
    await inviteToGroup(
      selectedGroupForInvite.value.id,
      inviteForm.value.email.trim(),
      {
        email: userStore.user?.email || '',
        name: userStore.user?.email?.split('@')[0] || 'Usuario'
      }
    )

    success.value = `📧 Invitación enviada a ${inviteForm.value.email}. Debe aceptarla para unirse al grupo.`
    inviteForm.value.email = ''
    showInviteModal.value = false
    selectedGroupForInvite.value = null
    
    await updateSyncHealth()
  } catch (err: any) {
    error.value = err.message || 'Error al enviar la invitación'
  } finally {
    inviteForm.value.loading = false
  }
}

// Responder a invitación
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
const getAlertTypeColor = (type: string, resolved: boolean) => {
  if (resolved) return 'bg-gray-100 text-gray-600 border-gray-200'
  
  switch (type) {
    case 'panic': return 'bg-red-100 text-red-800 border-red-200'
    case 'geofence': return 'bg-yellow-100 text-yellow-800 border-yellow-200'
    default: return 'bg-orange-100 text-orange-800 border-orange-200'
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

// Función para obtener nombre truncado
const getUserDisplayName = (email: string, maxLength: number = 15): string => {
  if (email === userStore.user?.email) {
    return 'Tú'
  }
  const name = email.split('@')[0]
  return name.length > maxLength ? name.substring(0, maxLength) + '...' : name
}

// Limpiar mensajes
const clearMessages = () => {
  error.value = null
  success.value = null
}

let unsubscribeUserGroups: (() => void) | null = null
let unsubscribeInvitations: (() => void) | null = null

onMounted(async () => {
  if (!userStore.isAuthenticated || !userStore.user?.email) return

  console.log('🚀 Iniciando EstadisticasView con auto-sync para:', userStore.user.email)

  // Suscribirse a grupos con auto-sincronización
  unsubscribeUserGroups = await subscribeToUserGroupsAutoSync(
    userStore.user.email,
    (groups) => {
      console.log('📊 Grupos auto-sync actualizados:', groups.length)
      userGroups.value = groups
      loading.value = false
      
      // Seleccionar el primer grupo automáticamente si no hay ninguno seleccionado
      if (groups.length > 0 && !selectedGroup.value) {
        selectedGroup.value = groups[0]
      }
      
      // Si el grupo seleccionado ya no existe, seleccionar otro
      if (selectedGroup.value && !groups.find(g => g.id === selectedGroup.value?.id)) {
        selectedGroup.value = groups[0] || null
      }
    }
  )

  // Suscribirse a invitaciones pendientes
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
  if (unsubscribeGroupAlerts) unsubscribeGroupAlerts()
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
  
    <div class="min-h-screen bg-gray-50 pt-20">
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
                  <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 714 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                Migrando...
              </span>
            </h1>
            <p class="text-sm text-gray-600">Monitoreo en tiempo real con sincronización automática</p>
          </div>
          <div class="flex items-center space-x-4 text-sm">
            <div class="flex items-center bg-green-50 px-3 py-2 rounded-lg">
              <span class="w-2 h-2 bg-green-500 rounded-full mr-2"></span>
              <span class="text-green-700 font-medium">{{ userGroups.length }} grupos</span>
            </div>
            <div class="flex items-center bg-blue-50 px-3 py-2 rounded-lg">
              <span class="w-2 h-2 bg-blue-500 rounded-full mr-2"></span>
              <span class="text-blue-700 font-medium">{{ userGroups.reduce((total, group) => total + group.members.length, 0) }} miembros</span>
            </div>
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

      <!-- Invitaciones pendientes -->
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
                <div class="min-w-0 flex-1 pr-3">
                  <h4 class="font-medium text-gray-800 truncate">{{ invitation.groupName }}</h4>
                  <p class="text-sm text-gray-600 mt-1 truncate">
                    Invitado por: <span class="font-medium">{{ invitation.inviterName }}</span>
                  </p>
                  <p class="text-xs text-gray-500 truncate">
                    {{ invitation.inviterEmail }}
                  </p>
                  <p class="text-xs text-gray-400 mt-2 flex items-center">
                    <svg class="w-3 h-3 mr-1 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"></path>
                    </svg>
                    <span class="truncate">{{ new Date(invitation.createdAt.toDate()).toLocaleDateString() }}</span>
                  </p>
                </div>
                <div class="flex flex-col gap-2 flex-shrink-0">
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
        <!-- Panel izquierdo - Grupos -->
        <div class="w-80 bg-white border-r border-gray-200 flex flex-col flex-shrink-0 shadow-sm">
          <!-- Header de grupos -->
          <div class="p-4 border-b border-gray-200 bg-gradient-to-r from-green-50 to-blue-50">
            <div class="flex justify-between items-center mb-4">
              <h2 class="font-semibold text-gray-800 flex items-center">
                <svg class="w-5 h-5 mr-2 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"></path>
                </svg>
                <span class="truncate">Mis Grupos</span>
                <span class="ml-2 bg-white px-2 py-1 rounded-full text-xs text-purple-600 border flex-shrink-0">
                  Auto-Sync
                </span>
              </h2>
              <button
                @click="showCreateGroup = !showCreateGroup"
                class="px-3 py-2 bg-green-500 hover:bg-green-600 text-white text-sm rounded-lg transition-colors flex items-center shadow-sm flex-shrink-0"
              >
                <svg class="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4"></path>
                </svg>
                Crear
              </button>
            </div>
            
            <!-- INDICADOR DE SALUD DE SINCRONIZACIÓN -->
            <div class="mb-4 p-3 bg-white border border-gray-200 rounded-lg shadow-sm">
              <div class="flex justify-between items-center text-xs mb-2">
                <span class="text-gray-700 font-medium flex items-center">
                  <svg class="w-4 h-4 mr-1 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"></path>
                  </svg>
                  <span class="truncate">Estado Sync</span>
                </span>
                <span :class="[
                  'font-bold px-2 py-1 rounded-full flex-shrink-0',
                  autoSyncHealth.healthPercentage >= 90 ? 'text-green-600 bg-green-100' : 
                  autoSyncHealth.healthPercentage >= 70 ? 'text-yellow-600 bg-yellow-100' : 'text-red-600 bg-red-100'
                ]">{{ autoSyncHealth.healthPercentage }}%</span>
              </div>
              <div class="grid grid-cols-2 gap-2 text-xs">
                <div class="text-center">
                  <div class="font-semibold text-gray-800">{{ autoSyncHealth.syncedGroups }}</div>
                  <div class="text-gray-500 truncate">Sincronizados</div>
                </div>
                <div class="text-center">
                  <div class="font-semibold text-gray-800">{{ autoSyncHealth.needsUpdate.length }}</div>
                  <div class="text-gray-500 truncate">Pendientes</div>
                </div>
              </div>
              <div v-if="autoSyncHealth.needsUpdate.length > 0" class="mt-2">
                <button
                  @click="runAutoMigration"
                  :disabled="migrating"
                  class="w-full px-2 py-1 bg-orange-500 hover:bg-orange-600 text-white text-xs rounded transition-colors disabled:opacity-50"
                >
                  🔄 Sincronizar
                </button>
              </div>
            </div>

            <!-- Formulario crear grupo -->
            <div v-if="showCreateGroup" class="mb-4 p-4 bg-gray-50 rounded-lg border border-gray-200">
              <h4 class="font-medium text-gray-800 mb-3 flex items-center">
                <svg class="w-4 h-4 mr-2 text-green-600 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4"></path>
                </svg>
                <span class="truncate">Nuevo Grupo (Auto-Sync)</span>
              </h4>
              <div class="space-y-3">
                <div>
                  <label class="block text-sm font-medium text-gray-700 mb-1">Nombre del grupo *</label>
                  <input
                    v-model="newGroup.name"
                    type="text"
                    class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 text-sm"
                    placeholder="Ej: Familia Pérez"
                    maxlength="50"
                    @keyup.enter="createNewGroup"
                  />
                </div>
                <div>
                  <label class="block text-sm font-medium text-gray-700 mb-1">Descripción</label>
                  <textarea
                    v-model="newGroup.description"
                    rows="2"
                    class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 resize-none text-sm"
                    placeholder="Descripción opcional del grupo"
                    maxlength="200"
                  ></textarea>
                </div>
                <div class="flex gap-2">
                  <button
                    @click="createNewGroup"
                    :disabled="loading"
                    class="px-3 py-2 bg-green-500 hover:bg-green-600 text-white text-sm rounded-lg transition-colors disabled:opacity-50 flex items-center"
                  >
                    <svg v-if="loading" class="w-4 h-4 mr-2 animate-spin flex-shrink-0" fill="none" viewBox="0 0 24 24">
                      <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                      <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 714 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    <span class="truncate">{{ loading ? 'Creando...' : 'Crear' }}</span>
                  </button>
                  <button
                    @click="showCreateGroup = false"
                    class="px-3 py-2 bg-gray-300 hover:bg-gray-400 text-gray-700 text-sm rounded-lg transition-colors flex-shrink-0"
                  >
                    Cancelar
                  </button>
                </div>
              </div>
            </div>
          </div>

          <!-- Lista de grupos CON SCROLL ARREGLADO -->
          <div class="flex-1 overflow-y-auto" style="max-height: calc(100vh - 450px);">
            <div v-if="userGroups.length === 0 && !loading" class="flex flex-col items-center justify-center py-12 text-gray-500">
              <svg class="w-16 h-16 mb-4 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 715.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 919.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"></path>
              </svg>
              <p class="text-lg font-medium">No tienes grupos aún</p>
              <p class="text-sm mt-1">Crea tu primer grupo para comenzar</p>
            </div>

            <div v-if="loading && userGroups.length === 0" class="flex items-center justify-center py-12">
              <div class="flex items-center text-gray-600">
                <svg class="w-5 h-5 mr-2 animate-spin" fill="none" viewBox="0 0 24 24">
                  <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                  <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 714 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                <span>Cargando grupos...</span>
              </div>
            </div>

            <div v-else class="space-y-3 p-4">
              <div 
                v-for="group in userGroups" 
                :key="group.id"
                class="border rounded-lg p-4 bg-white hover:shadow-md transition-all cursor-pointer"
                :class="{ 'border-blue-500 shadow-md bg-blue-50': selectedGroup?.id === group.id }"
                @click="selectGroup(group)"
              >
                <!-- Header del grupo -->
                <div class="flex justify-between items-start mb-3">
                  <div class="flex-1 min-w-0 pr-4">
                    <h4 class="text-lg font-semibold text-gray-800 mb-1 truncate" :title="group.name">{{ group.name }}</h4>
                    <p v-if="group.description" class="text-sm text-gray-600 mb-2 line-clamp-2" :title="group.description">{{ group.description }}</p>
                    <div class="flex items-center text-xs text-gray-500 min-w-0">
                      <svg class="w-4 h-4 mr-1 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"></path>
                      </svg>
                      <span class="truncate">Creado por: {{ group.createdBy === userStore.user?.email ? 'Ti' : getUserDisplayName(group.createdBy, 20) }}</span>
                    </div>
                  </div>
                  
                  <!-- Botones de acción -->
                  <div class="flex flex-col gap-2 flex-shrink-0">
                    <button
                      @click.stop="openInviteModal(group)"
                      class="px-3 py-2 bg-blue-500 hover:bg-blue-600 text-white text-sm rounded-lg transition-colors flex items-center"
                    >
                      <svg class="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z"></path>
                      </svg>
                      Invitar
                    </button>
                  </div>
                </div>

                <!-- Lista de miembros CON ALTURA FIJA Y SCROLL -->
                <div>
                  <h5 class="text-sm font-semibold text-gray-700 mb-3 flex items-center">
                    <svg class="w-4 h-4 mr-2 text-blue-600 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197m13.5-9a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0z"></path>
                    </svg>
                    Miembros ({{ group.members.length }})
                  </h5>
                  
                  <!-- Contenedor con scroll para miembros -->
                  <div class="space-y-2 max-h-40 overflow-y-auto pr-2" :class="{ 'border-t border-gray-100 pt-2': group.members.length > 3 }">
                    <div 
                      v-for="(member, index) in group.members" 
                      :key="member"
                      class="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
                    >
                      <div class="flex items-center flex-1 min-w-0">
                        <!-- Avatar simple -->
                        <div class="w-8 h-8 rounded-full flex items-center justify-center mr-3 text-white text-sm font-semibold flex-shrink-0"
                             :class="member === userStore.user?.email ? 'bg-green-500' : 'bg-blue-500'">
                          {{ getUserDisplayName(member).charAt(0).toUpperCase() }}
                        </div>
                        
                        <!-- Info del miembro -->
                        <div class="flex-1 min-w-0">
                          <p class="text-sm font-medium text-gray-900 truncate"
                             :class="member === userStore.user?.email ? 'text-green-700' : ''"
                             :title="getUserDisplayName(member)">
                            {{ getUserDisplayName(member, 20) }}
                            <span v-if="group.createdBy === member" class="text-yellow-500 ml-1">👑</span>
                          </p>
                          <p class="text-xs text-gray-500 truncate" :title="member">{{ member }}</p>
                        </div>

                        <!-- Indicadores de estado -->
                        <div class="flex items-center space-x-2 ml-2 flex-shrink-0">
                          <span v-if="group.membersUids && group.membersUids[index]" 
                                class="text-green-500 text-sm" title="Sincronizado con móvil">
                            📱✅
                          </span>
                          <span v-else-if="group.isAutoSynced" 
                                class="text-orange-500 text-sm" title="Pendiente de sincronizar">
                            📱⏳
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                <!-- Estado de sincronización -->
                <div v-if="group.isAutoSynced" class="mt-4 pt-4 border-t border-gray-200">
                  <div class="flex items-center justify-between text-sm">
                    <div class="flex items-center text-purple-600 min-w-0">
                      <svg class="w-4 h-4 mr-2 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"></path>
                      </svg>
                      <span class="truncate">Auto-Sync Activo</span>
                    </div>
                    <div class="text-xs text-gray-600 flex-shrink-0">
                      UIDs: {{ group.membersUids?.length || 0 }}/{{ group.members.length }}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- Panel central - Mapa -->
        <div class="flex-1 bg-white relative overflow-hidden">
          <div class="absolute inset-0">
            <MapPanel 
              :loading="loading" 
              :selected-group="selectedGroup"
              :user-groups="userGroups"
              @error="handleMapError"
            />
          </div>
        </div>

        <!-- Panel derecho - Alertas del Grupo Seleccionado -->
        <div class="w-80 bg-white border-l border-gray-200 flex flex-col flex-shrink-0 shadow-sm">
          <!-- Header de alertas con filtros -->
          <div class="p-4 border-b border-gray-200 bg-gradient-to-r from-red-50 to-orange-50">
            <div class="flex items-center justify-between mb-4">
              <h2 class="font-semibold text-gray-800 flex items-center">
                <svg class="w-5 h-5 mr-2 text-red-600 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.996-.833-2.764 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z"></path>
                </svg>
                <span class="truncate">Alertas del Grupo</span>
              </h2>
              <span class="text-xs bg-red-100 text-red-700 px-2 py-1 rounded-full flex-shrink-0">
                {{ filteredAlerts.length }}
              </span>
            </div>

            <!-- Nombre del grupo seleccionado -->
            <div v-if="selectedGroup" class="mb-4 p-3 bg-white border border-gray-200 rounded-lg">
              <div class="flex items-center justify-between">
                <div class="flex items-center min-w-0">
                  <svg class="w-4 h-4 mr-2 text-blue-600 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 919.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"></path>
                  </svg>
                  <span class="text-sm font-medium text-gray-800 truncate" :title="selectedGroup.name">
                    {{ selectedGroup.name }}
                  </span>
                </div>
                </div>
            </div>
          

            <div v-else class="mb-4 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
              <div class="flex items-center">
                <svg class="w-4 h-4 mr-2 text-yellow-600 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path>
                </svg>
                <span class="text-sm text-yellow-700">Selecciona un grupo para ver sus alertas</span>
              </div>
            </div>

            <!-- Filtros de tiempo -->
            <div class="flex space-x-1 bg-gray-100 rounded-lg p-1">
              <button
                v-for="filter in [
                  { key: 'dia', label: 'Día' },
                  { key: 'semana', label: 'Semana' },
                  { key: 'mes', label: 'Mes' }
                ]"
                :key="filter.key"
                @click="alertFilter = filter.key"
                :class="[
                  'flex-1 px-3 py-1.5 text-xs font-medium rounded-md transition-all truncate',
                  alertFilter === filter.key
                    ? 'bg-white text-gray-900 shadow-sm'
                    : 'text-gray-600 hover:text-gray-900'
                ]"
              >
                {{ filter.label }}
              </button>
            </div>
          </div>
          
          <!-- Lista de alertas -->
          <div class="flex-1 overflow-y-auto p-4">
            <div v-if="!selectedGroup" class="flex flex-col items-center justify-center py-12 text-gray-500">
              <svg class="w-16 h-16 mb-4 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 715.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 919.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"></path>
              </svg>
              <p class="text-lg font-medium">Selecciona un grupo</p>
              <p class="text-sm mt-1">Para ver las alertas del grupo</p>
            </div>

            <div v-else-if="filteredAlerts.length === 0" class="flex flex-col items-center justify-center py-12 text-gray-500">
              <svg class="w-16 h-16 mb-4 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"></path>
              </svg>
              <p class="text-lg font-medium">Sin alertas</p>
              <p class="text-sm mt-1">No hay alertas en el período seleccionado</p>
            </div>
            
            <div v-else class="space-y-3">
              <div 
                v-for="alert in filteredAlerts" 
                :key="alert.id"
                class="border rounded-lg p-4 hover:shadow-md transition-all"
                :class="alert.resolved ? 'bg-gray-50 border-gray-200' : 'bg-red-50 border-red-200'"
              >
                <!-- Header de la alerta -->
                <div class="flex items-start justify-between mb-3">
                  <div class="flex items-center flex-1 min-w-0">
                    <div 
                      :class="[
                        'w-3 h-3 rounded-full mr-3 mt-1 flex-shrink-0',
                        alert.resolved ? 'bg-gray-400' : 'bg-red-500 animate-pulse'
                      ]"
                    ></div>
                    <div class="min-w-0 flex-1">
                      <h4 class="font-medium text-gray-900 text-sm truncate" :title="alert.userName">
                        {{ alert.userName }}
                      </h4>
                      <p class="text-xs text-gray-600 truncate" :title="alert.userEmail">
                        {{ alert.userEmail }}
                      </p>
                      <p v-if="alert.phone" class="text-xs text-gray-500 truncate">
                        📞 {{ alert.phone }}
                      </p>
                    </div>
                  </div>
                  <div class="flex flex-col items-end gap-2 flex-shrink-0">
                    <span :class="[
                      'px-2 py-1 text-xs rounded-full border',
                      getAlertTypeColor(alert.type, alert.resolved)
                    ]">
                      {{ alert.resolved ? 'Resuelta' : 'SOS Activa' }}
                    </span>
                    <div class="text-xs text-gray-500">
                      {{ getRelativeTime(alert.timestamp) }}
                    </div>
                  </div>
                </div>

                <!-- Mensaje de la alerta -->
                <div v-if="alert.message" class="mb-3 p-3 bg-white border border-gray-200 rounded-lg">
                  <div class="flex items-start">
                    <svg class="w-4 h-4 mr-2 text-blue-600 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"></path>
                    </svg>
                    <p class="text-sm text-gray-700">{{ alert.message }}</p>
                  </div>
                </div>
                
                <!-- Detalles de la alerta -->
                <div class="space-y-2 mb-3">
                  <!-- Ubicación -->
                  <div class="flex items-start text-xs text-gray-600">
                    <svg class="w-4 h-4 mr-2 mt-0.5 flex-shrink-0 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"></path>
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"></path>
                    </svg>
                    <div class="flex-1 min-w-0">
                      <p class="font-medium text-gray-700 mb-1">Ubicación de emergencia:</p>
                      <p class="break-words font-mono" :title="formatLocation(alert)">
                        {{ formatLocation(alert) }}
                      </p>
                      <!-- Botón para abrir en Google Maps -->
                      <button 
                        v-if="alert.coordinates"
                        @click="window.open(`https://www.google.com/maps?q=${alert.coordinates[1]},${alert.coordinates[0]}`, '_blank')"
                        class="mt-2 px-2 py-1 bg-blue-100 hover:bg-blue-200 text-blue-700 text-xs rounded transition-colors flex items-center"
                      >
                        <svg class="w-3 h-3 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"></path>
                        </svg>
                        Ver en Maps
                      </button>
                    </div>
                  </div>

                  <!-- Fecha y hora detallada -->
                  <div class="flex items-center text-xs text-gray-600">
                    <svg class="w-4 h-4 mr-2 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"></path>
                    </svg>
                    <span>
                      {{ new Date(alert.timestamp?.toDate ? alert.timestamp.toDate() : alert.timestamp).toLocaleDateString('es-ES', { 
                        weekday: 'long',
                        year: 'numeric',
                        month: 'long', 
                        day: 'numeric',
                        hour: '2-digit', 
                        minute: '2-digit',
                        second: '2-digit'
                      }) }}
                    </span>
                  </div>

                  <!-- Destinatarios de la alerta -->
                  <div v-if="alert.destinatarios && alert.destinatarios.length > 0" class="flex items-start text-xs text-gray-600">
                    <svg class="w-4 h-4 mr-2 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 919.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"></path>
                    </svg>
                    <div>
                      <p class="font-medium text-gray-700 mb-1">Notificado a {{ alert.destinatarios.length }} miembro(s)</p>
                      <div class="text-xs text-gray-500">
                        {{ alert.destinatarios.length }} persona(s) recibieron la alerta
                      </div>
                    </div>
                  </div>
                </div>
                
                <!-- Acciones -->
                <div class="pt-3 border-t border-gray-200">
                  <div v-if="alert.resolved" class="flex items-center text-xs text-green-600">
                    <svg class="w-4 h-4 mr-2 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                      <path fill-rule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clip-rule="evenodd"></path>
                    </svg>
                    <span>Alerta resuelta</span>
                  </div>
                  <div v-else class="flex items-center justify-between">
                    <div class="flex items-center text-xs text-red-600">
                      <svg class="w-4 h-4 mr-2 animate-pulse flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                        <path fill-rule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clip-rule="evenodd"></path>
                      </svg>
                      <span>Alerta activa</span>
                    </div>
                    <!-- Botón para resolver alerta -->
                    <button
                      @click="resolveAlert(alert.id)"
                      class="px-3 py-1 bg-green-500 hover:bg-green-600 text-white text-xs rounded-lg transition-colors flex items-center"
                    >
                      <svg class="w-3 h-3 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"></path>
                      </svg>
                      Resolver
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Modal de invitación -->
      <div v-if="showInviteModal" class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
        <div class="bg-white rounded-xl shadow-2xl p-6 w-full max-w-md mx-4">
          <div class="text-center mb-6">
            <div class="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-blue-100 mb-4">
              <svg class="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 8l7.89 4.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"></path>
              </svg>
            </div>
            <h3 class="text-xl font-semibold text-gray-900 mb-2">
              Enviar Invitación
            </h3>
            <p class="text-sm text-gray-600 truncate" :title="selectedGroupForInvite?.name">
              Grupo: <span class="font-medium text-blue-600">{{ selectedGroupForInvite?.name }}</span>
            </p>
          </div>
          
          <div class="space-y-4">
            <!-- Información importante -->
            <div class="bg-gradient-to-r from-blue-50 to-purple-50 p-4 rounded-lg border border-blue-200">
              <div class="flex items-start">
                <svg class="w-5 h-5 text-blue-600 mt-0.5 mr-3 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 8l7.89 4.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"></path>
                </svg>
                <div class="min-w-0">
                  <p class="text-sm font-medium text-blue-800 mb-1">Invitación por Correo</p>
                  <p class="text-xs text-blue-700">
                    Se enviará una invitación por email. El usuario debe aceptarla para unirse al grupo.
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
                <svg class="absolute right-3 top-3 w-5 h-5 text-gray-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 8l7.89 4.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"></path>
                </svg>
              </div>
              <p class="text-xs text-gray-500 mt-2 flex items-center">
                <svg class="w-4 h-4 mr-1 text-yellow-500 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path>
                </svg>
                <span>El usuario recibirá un correo para aceptar la invitación</span>
              </p>
            </div>
            
            <!-- Botones de acción -->
            <div class="flex gap-3 pt-2">
              <button
                @click="inviteUser"
                :disabled="inviteForm.loading || !inviteForm.email.trim()"
                class="flex-1 px-4 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center font-medium min-w-0"
              >
                <svg v-if="inviteForm.loading" class="w-4 h-4 mr-2 animate-spin flex-shrink-0" fill="none" viewBox="0 0 24 24">
                  <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                  <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 714 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                <svg v-else class="w-4 h-4 mr-2 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 8l7.89 4.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"></path>
                </svg>
                <span class="truncate">{{ inviteForm.loading ? 'Enviando...' : 'Enviar Invitación' }}</span>
              </button>
              <button
                @click="showInviteModal = false; selectedGroupForInvite = null"
                :disabled="inviteForm.loading"
                class="px-4 py-3 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg transition-colors disabled:opacity-50 font-medium flex-shrink-0"
              >
                Cancelar
              </button>
            </div>
          </div>
        </div>
      </div>

      <!-- Estado de carga -->
      <div v-if="loading && userGroups.length === 0" class="fixed inset-0 bg-white bg-opacity-75 flex items-center justify-center z-50">
        <div class="text-center">
          <div class="animate-spin rounded-full h-8 w-8 border-b-2 border-green-500 mx-auto mb-4"></div>
          <span class="text-gray-600">Cargando datos con auto-sincronización...</span>
        </div>
      </div>
    </div>
  </LayoutView>
</template>

<style scoped>
/* Clase para truncar texto en múltiples líneas */
.line-clamp-2 {
  overflow: hidden;
  display: -webkit-box;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 2;
}

/* Mejorar la responsividad */
.min-w-0 {
  min-width: 0;
}

.truncate {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.flex-shrink-0 {
  flex-shrink: 0;
}

.flex-1 {
  flex: 1 1 0%;
}

.break-words {
  word-break: break-words;
}

/* Scroll personalizado */
::-webkit-scrollbar {
  width: 6px;
}

::-webkit-scrollbar-track {
  background: #f1f1f1;
}

::-webkit-scrollbar-thumb {
  background: #888;
  border-radius: 3px;
}

::-webkit-scrollbar-thumb:hover {
  background: #555;
}
</style>