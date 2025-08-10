<script setup lang="ts">
import { ref, onMounted, onUnmounted, computed } from 'vue'
import { 
  subscribeToUserGroups, 
  subscribeToAlerts, 
  createGroup,
  inviteToGroup,
  respondToInvitation,
  subscribeToUserInvitations,
  type FirebaseGroup, 
  type FirebaseAlert,
  type GroupInvitation 
} from '@/firebase'
import MapPanel from '@/components/estadisticas/MapPanel.vue'
import MainNav from '../../components/MainNav.vue'
import LayoutView from './LayoutView.vue'
import { useUserStore } from '@/stores/user'

const userStore = useUserStore()
const userGroups = ref<FirebaseGroup[]>([])
const alerts = ref<FirebaseAlert[]>([])
const pendingInvitations = ref<GroupInvitation[]>([])
const loading = ref(true)
const selectedGroup = ref<FirebaseGroup | null>(null)
const alertFilter = ref<'dia' | 'semana' | 'mes'>('dia')

// Estados para crear grupo
const showCreateGroup = ref(false)
const showInviteModal = ref(false)
const selectedGroupForInvite = ref<FirebaseGroup | null>(null)

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

// Crear grupo
const createNewGroup = async () => {
  if (!newGroup.value.name.trim()) {
    error.value = 'El nombre del grupo es requerido'
    return
  }

  loading.value = true
  error.value = null

  try {
    await createGroup({
      name: newGroup.value.name.trim(),
      description: newGroup.value.description.trim(),
      createdBy: userStore.user?.email || '',
      members: [userStore.user?.email || ''],
      pendingInvitations: []
    })

    success.value = 'Grupo creado exitosamente'
    newGroup.value = { name: '', description: '' }
    showCreateGroup.value = false
  } catch (err: any) {
    error.value = err.message || 'Error al crear el grupo'
  } finally {
    loading.value = false
  }
}

// Invitar usuario
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
    await inviteToGroup(
      selectedGroupForInvite.value.id,
      inviteForm.value.email.trim(),
      {
        email: userStore.user?.email || '',
        name: userStore.userProfile?.nombre || userStore.user?.displayName || 'Usuario'
      }
    )

    success.value = `Invitación enviada a ${inviteForm.value.email}`
    inviteForm.value.email = ''
    showInviteModal.value = false
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

// Abrir modal de invitación
const openInviteModal = (group: FirebaseGroup) => {
  selectedGroupForInvite.value = group
  showInviteModal.value = true
  inviteForm.value.email = ''
  error.value = null
}

// Seleccionar grupo
const selectGroup = (group: FirebaseGroup | null) => {
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

// Limpiar mensajes
const clearMessages = () => {
  error.value = null
  success.value = null
}

let unsubscribeUserGroups: (() => void) | null = null
let unsubscribeAlerts: (() => void) | null = null
let unsubscribeInvitations: (() => void) | null = null

onMounted(() => {
  if (!userStore.isAuthenticated || !userStore.user?.email) return

  // Suscribirse a los grupos del usuario
  unsubscribeUserGroups = subscribeToUserGroups(userStore.user.email, (groups) => {
    userGroups.value = groups
    loading.value = false
    if (groups.length > 0 && !selectedGroup.value) {
      selectedGroup.value = groups[0]
    }
  })

  // Suscribirse a las alertas
  unsubscribeAlerts = subscribeToAlerts((alertsData) => {
    alerts.value = alertsData
  })

  // Suscribirse a invitaciones pendientes
  unsubscribeInvitations = subscribeToUserInvitations(userStore.user.email, (invitations) => {
    pendingInvitations.value = invitations
  })
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

    <div class="min-h-screen custom-green-bg pt-20">
      <!-- Header compacto -->
      <div class="bg-white border-b border-gray-200 px-6 py-4">
        <div class="flex items-center justify-between">
          <div>
            <h1 class="text-xl font-semibold text-gray-900">Panel de Control</h1>
            <p class="text-sm text-gray-600">Monitoreo en tiempo real</p>
          </div>
          <div class="flex items-center space-x-4 text-sm">
            <div class="flex items-center">
              <span class="w-2 h-2 bg-green-500 rounded-full mr-2"></span>
              <span class="text-gray-600">{{ userGroups.length }} grupos</span>
            </div>
            <div class="flex items-center">
              <span class="w-2 h-2 bg-blue-500 rounded-full mr-2"></span>
              <span class="text-gray-600">{{ userGroups.reduce((total, group) => total + group.members.length, 0) }} miembros</span>
            </div>
          </div>
        </div>
      </div>

      <!-- Mensajes -->
      <div v-if="error" class="mx-6 mt-4">
        <div class="bg-red-50 border border-red-200 rounded-lg p-4">
          <div class="flex justify-between items-center">
            <p class="text-red-600 text-sm">{{ error }}</p>
            <button @click="clearMessages" class="text-red-400 hover:text-red-600">✕</button>
          </div>
        </div>
      </div>

      <div v-if="success" class="mx-6 mt-4">
        <div class="bg-green-50 border border-green-200 rounded-lg p-4">
          <div class="flex justify-between items-center">
            <p class="text-green-600 text-sm">{{ success }}</p>
            <button @click="clearMessages" class="text-green-400 hover:text-green-600">✕</button>
          </div>
        </div>
      </div>

      <!-- Invitaciones pendientes -->
      <div v-if="pendingInvitations.length > 0" class="mx-6 mt-4">
        <div class="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <h3 class="font-semibold text-blue-800 mb-3 flex items-center">
            <svg class="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 8l7.89 4.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"></path>
            </svg>
            Invitaciones Pendientes ({{ pendingInvitations.length }})
          </h3>

          <div class="space-y-3">
            <div 
              v-for="invitation in pendingInvitations" 
              :key="invitation.id"
              class="bg-white rounded-lg p-4 border"
            >
              <div class="flex justify-between items-start">
                <div>
                  <h4 class="font-medium text-gray-800">{{ invitation.groupName }}</h4>
                  <p class="text-sm text-gray-600">
                    Invitado por: {{ invitation.inviterName }} ({{ invitation.inviterEmail }})
                  </p>
                  <p class="text-xs text-gray-500 mt-1">
                    {{ new Date(invitation.createdAt.toDate()).toLocaleDateString() }}
                  </p>
                </div>
                <div class="flex gap-2">
                  <button
                    @click="respondInvitation(invitation.id, 'accepted')"
                    :disabled="loading"
                    class="px-3 py-1 bg-green-500 hover:bg-green-600 text-white text-sm rounded-lg transition-colors disabled:opacity-50"
                  >
                    Aceptar
                  </button>
                  <button
                    @click="respondInvitation(invitation.id, 'rejected')"
                    :disabled="loading"
                    class="px-3 py-1 bg-red-500 hover:bg-red-600 text-white text-sm rounded-lg transition-colors disabled:opacity-50"
                  >
                    Rechazar
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Layout principal de 3 columnas -->
      <div class="flex overflow-hidden" style="height: calc(100vh - 180px);">
        
        <!-- Panel izquierdo - Grupos -->
        <div class="w-80 bg-white border-r border-gray-200 flex flex-col flex-shrink-0">
          <!-- Header de grupos -->
          <div class="p-4 border-b border-gray-200">
            <div class="flex justify-between items-center mb-4">
              <h2 class="font-semibold text-gray-800 flex items-center">
                <svg class="w-5 h-5 mr-2 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"></path>
                </svg>
                Mis Grupos
              </h2>
              <button
                @click="showCreateGroup = !showCreateGroup"
                class="px-3 py-1.5 bg-green-500 hover:bg-green-600 text-white text-sm rounded-lg transition-colors"
              >
                + Crear
              </button>
            </div>

            <!-- Formulario crear grupo -->
            <div v-if="showCreateGroup" class="mb-4 p-3 bg-gray-50 rounded-lg">
              <h4 class="font-medium text-gray-800 mb-3">Nuevo Grupo</h4>
              <div class="space-y-3">
                <div>
                  <input
                    v-model="newGroup.name"
                    type="text"
                    class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 text-sm"
                    placeholder="Nombre del grupo"
                    maxlength="50"
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
                <div class="flex gap-2">
                  <button
                    @click="createNewGroup"
                    :disabled="loading"
                    class="flex-1 px-3 py-2 bg-green-500 hover:bg-green-600 text-white text-sm rounded-lg transition-colors disabled:opacity-50"
                  >
                    {{ loading ? 'Creando...' : 'Crear' }}
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

          <!-- Lista de grupos -->
          <div class="flex-1 overflow-y-auto p-4">
            <div v-if="userGroups.length === 0 && !showCreateGroup" class="text-center py-8 text-gray-500">
              <svg class="w-12 h-12 mx-auto mb-4 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"></path>
              </svg>
              <p class="text-sm">No tienes grupos aún</p>
              <p class="text-xs text-gray-400">Crea tu primer grupo</p>
            </div>

            <div v-else class="space-y-3">
              <div 
                v-for="group in userGroups" 
                :key="group.id"
                @click="selectGroup(group)"
                :class="[
                  'p-3 rounded-lg border cursor-pointer transition-all duration-200',
                  selectedGroup && selectedGroup.id === group.id
                    ? 'bg-green-50 border-green-200 shadow-sm'
                    : 'bg-white border-gray-200 hover:border-green-300 hover:shadow-sm'
                ]"
              >
                <!-- Header del grupo -->
                <div class="flex items-center justify-between mb-2">
                  <h3 class="font-medium text-gray-900 truncate text-sm">{{ group.name }}</h3>
                  <div class="flex items-center gap-2">
                    <span class="text-xs bg-gray-100 text-gray-600 px-2 py-1 rounded-full">
                      {{ group.members.length }}
                    </span>
                    <button
                      @click.stop="openInviteModal(group)"
                      class="text-xs text-blue-500 hover:text-blue-700"
                      title="Invitar"
                    >
                      +
                    </button>
                  </div>
                </div>

                <!-- Descripción -->
                <p v-if="group.description" class="text-xs text-gray-600 mb-2 line-clamp-2">
                  {{ group.description }}
                </p>

                <!-- Miembros activos -->
                <div class="space-y-1">
                  <h4 class="text-xs font-medium text-gray-700 uppercase tracking-wide">
                    Miembros Activos
                  </h4>
                  <div class="space-y-1">
                    <div 
                      v-for="member in group.members.slice(0, 2)" 
                      :key="member"
                      class="flex items-center justify-between text-xs"
                    >
                      <div class="flex items-center">
                        <div class="w-2 h-2 bg-green-500 rounded-full mr-2"></div>
                        <span :class="member === userStore.user?.email ? 'font-medium text-green-700' : 'text-gray-600'">
                          {{ member === userStore.user?.email ? 'Tú' : member.split('@')[0] }}
                        </span>
                      </div>
                      <span v-if="group.createdBy === member" class="text-yellow-600 text-xs">👑</span>
                    </div>
                    <div v-if="group.members.length > 2" class="text-xs text-gray-500 pl-4">
                      +{{ group.members.length - 2 }} más
                    </div>
                  </div>
                </div>

                <!-- Indicador de grupo seleccionado -->
                <div v-if="selectedGroup && selectedGroup.id === group.id" 
                     class="mt-2 pt-2 border-t border-green-200">
                  <div class="flex items-center text-green-600 text-xs">
                    <svg class="w-3 h-3 mr-1" fill="currentColor" viewBox="0 0 20 20">
                      <path fill-rule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clip-rule="evenodd"></path>
                    </svg>
                    Grupo seleccionado
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- Panel central - Mapa -->
        <div class="flex-1 bg-white relative overflow-hidden">
          <div class="absolute inset-0">
            <MapPanel :loading="loading" />
          </div>
        </div>

        <!-- Panel derecho - Alertas -->
        <div class="w-80 bg-white border-l border-gray-200 flex flex-col flex-shrink-0">
          <!-- Header de alertas con filtros -->
          <div class="p-4 border-b border-gray-200">
            <div class="flex items-center justify-between mb-4">
              <h2 class="font-semibold text-gray-800 flex items-center">
                <svg class="w-5 h-5 mr-2 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.996-.833-2.764 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z"></path>
                </svg>
                Alertas Recientes
              </h2>
              <span class="text-xs bg-red-100 text-red-700 px-2 py-1 rounded-full">
                {{ filteredAlerts.length }}
              </span>
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
                  'flex-1 px-3 py-1.5 text-xs font-medium rounded-md transition-all',
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
            <div v-if="filteredAlerts.length === 0" class="text-center py-8 text-gray-500">
              <svg class="w-12 h-12 mx-auto mb-4 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"></path>
              </svg>
              <p class="text-sm">No hay alertas en este período</p>
              <p class="text-xs text-gray-400 mt-1">Las alertas aparecerán aquí</p>
            </div>

            <div v-else class="space-y-3">
              <div 
                v-for="alert in filteredAlerts" 
                :key="alert.id"
                class="bg-gray-50 border rounded-lg p-3 hover:shadow-sm transition-shadow"
              >
                <!-- Header de la alerta -->
                <div class="flex items-start justify-between mb-2">
                  <div class="flex items-center">
                    <div class="w-2 h-2 bg-red-500 rounded-full mr-2 mt-2"></div>
                    <div>
                      <h4 class="font-medium text-gray-900 text-sm">{{ alert.userName }}</h4>
                      <p class="text-xs text-gray-600">{{ alert.userEmail }}</p>
                    </div>
                  </div>
                  <span :class="[
                    'px-2 py-1 text-xs rounded-full border',
                    getAlertTypeColor(alert.type)
                  ]">
                    {{ alert.type === 'panic' ? 'Pánico' : alert.type === 'geofence' ? 'Geocerca' : 'Manual' }}
                  </span>
                </div>

                <!-- Detalles de la alerta -->
                <div class="space-y-1">
                  <div class="flex items-center text-xs text-gray-600">
                    <svg class="w-3 h-3 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"></path>
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"></path>
                    </svg>
                    {{ alert.location }}
                  </div>
                  <div class="flex items-center text-xs text-gray-600">
                    <svg class="w-3 h-3 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"></path>
                    </svg>
                    {{ new Date(alert.timestamp?.toDate ? alert.timestamp.toDate() : alert.timestamp).toLocaleString() }}
                  </div>
                </div>

                <!-- Estado de resolución -->
                <div class="mt-2 pt-2 border-t border-gray-200">
                  <div v-if="alert.resolved" class="flex items-center text-xs text-green-600">
                    <svg class="w-3 h-3 mr-1" fill="currentColor" viewBox="0 0 20 20">
                      <path fill-rule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clip-rule="evenodd"></path>
                    </svg>
                    Resuelta
                  </div>
                  <div v-else class="flex items-center text-xs text-orange-600">
                    <svg class="w-3 h-3 mr-1 animate-pulse" fill="currentColor" viewBox="0 0 20 20">
                      <path fill-rule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clip-rule="evenodd"></path>
                    </svg>
                    Pendiente
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Modal de invitación -->
    <div v-if="showInviteModal" class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div class="bg-white rounded-lg p-6 w-full max-w-md mx-4">
        <h3 class="text-lg font-semibold text-gray-800 mb-4">
          Invitar a: {{ selectedGroupForInvite?.name }}
        </h3>
        
        <div class="space-y-4">
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">Email del usuario</label>
            <input
              v-model="inviteForm.email"
              type="email"
              class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="usuario@correo.com"
              @keyup.enter="inviteUser"
            />
          </div>
          
          <div class="flex gap-2">
            <button
              @click="inviteUser"
              :disabled="inviteForm.loading"
              class="flex-1 px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-lg transition-colors disabled:opacity-50"
            >
              {{ inviteForm.loading ? 'Enviando...' : 'Enviar Invitación' }}
            </button>
            <button
              @click="showInviteModal = false"
              class="px-4 py-2 bg-gray-300 hover:bg-gray-400 text-gray-700 rounded-lg transition-colors"
            >
              Cancelar
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- Estado de carga -->
    <div v-if="loading" class="fixed inset-0 bg-white bg-opacity-75 flex items-center justify-center z-50">
      <div class="text-center">
        <div class="animate-spin rounded-full h-8 w-8 border-b-2 border-green-500 mx-auto mb-4"></div>
        <span class="text-gray-600">Cargando datos...</span>
      </div>
    </div>

  </LayoutView>
</template>

