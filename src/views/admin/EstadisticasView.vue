<template>
  <div class="min-h-screen bg-gray-100">
    <!-- Header -->
    <div class="bg-white shadow-sm border-b">
      <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div class="flex justify-between items-center py-4">
          <h1 class="text-2xl font-bold text-gray-900">Panel de Control - Seguridad Personal</h1>
          <div class="flex items-center space-x-4">
            <span class="text-sm text-gray-600">
              Usuarios conectados: {{ onlineUsersCount }}
            </span>
            <span class="text-sm text-gray-600">
              Grupos activos: {{ activeGroupsCount }}
            </span>
          </div>
        </div>
      </div>
    </div>

    <!-- Main Content -->
    <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
      <div class="grid grid-cols-1 lg:grid-cols-5 gap-6">
        
        <!-- Panel Izquierdo - Grupos -->
        <div class="lg:col-span-1">
          <div class="bg-white rounded-lg shadow">
            <div class="px-4 py-3 border-b border-gray-200">
              <h2 class="text-lg font-semibold text-gray-900">Gestión de Grupos</h2>
            </div>
            <div class="p-4">
              <GroupPanel 
                :groups="groups" 
                :users="users"
                @group-created="handleGroupCreated"
                @group-deleted="handleGroupDeleted"
                @member-added="handleMemberAdded"
                @member-removed="handleMemberRemoved"
              />
            </div>
          </div>
        </div>

        <!-- Panel Central - Mapa -->
        <div class="lg:col-span-3">
          <div class="bg-white rounded-lg shadow">
            <div class="px-4 py-3 border-b border-gray-200">
              <h2 class="text-lg font-semibold text-gray-900">Ubicaciones en Tiempo Real</h2>
            </div>
            <div class="p-4">
              <MapPanel :users="users" :loading="loading" />
            </div>
          </div>
        </div>

        <!-- Panel Derecho - Alertas -->
        <div class="lg:col-span-1">
          <div class="bg-white rounded-lg shadow">
            <div class="px-4 py-3 border-b border-gray-200">
              <h2 class="text-lg font-semibold text-gray-900">Alertas Activas</h2>
            </div>
            <div class="p-4">
              <AlertPanel :alerts="recentAlerts" />
            </div>
          </div>
        </div>
      </div>

      <!-- Stats Cards -->
      <div class="grid grid-cols-1 md:grid-cols-4 gap-6 mt-6">
        <div class="bg-white overflow-hidden shadow rounded-lg">
          <div class="p-5">
            <div class="flex items-center">
              <div class="flex-shrink-0">
                <div class="w-8 h-8 bg-green-500 rounded-md flex items-center justify-center">
                  <span class="text-white font-bold text-sm">U</span>
                </div>
              </div>
              <div class="ml-5 w-0 flex-1">
                <dl>
                  <dt class="text-sm font-medium text-gray-500 truncate">Total Usuarios</dt>
                  <dd class="text-lg font-medium text-gray-900">{{ users.length }}</dd>
                </dl>
              </div>
            </div>
          </div>
        </div>

        <div class="bg-white overflow-hidden shadow rounded-lg">
          <div class="p-5">
            <div class="flex items-center">
              <div class="flex-shrink-0">
                <div class="w-8 h-8 bg-blue-500 rounded-md flex items-center justify-center">
                  <span class="text-white font-bold text-sm">G</span>
                </div>
              </div>
              <div class="ml-5 w-0 flex-1">
                <dl>
                  <dt class="text-sm font-medium text-gray-500 truncate">Grupos Creados</dt>
                  <dd class="text-lg font-medium text-gray-900">{{ groups.length }}</dd>
                </dl>
              </div>
            </div>
          </div>
        </div>

        <div class="bg-white overflow-hidden shadow rounded-lg">
          <div class="p-5">
            <div class="flex items-center">
              <div class="flex-shrink-0">
                <div class="w-8 h-8 bg-yellow-500 rounded-md flex items-center justify-center">
                  <span class="text-white font-bold text-sm">⚠</span>
                </div>
              </div>
              <div class="ml-5 w-0 flex-1">
                <dl>
                  <dt class="text-sm font-medium text-gray-500 truncate">Alertas Hoy</dt>
                  <dd class="text-lg font-medium text-gray-900">{{ recentAlerts.length }}</dd>
                </dl>
              </div>
            </div>
          </div>
        </div>

        <div class="bg-white overflow-hidden shadow rounded-lg">
          <div class="p-5">
            <div class="flex items-center">
              <div class="flex-shrink-0">
                <div class="w-8 h-8 bg-red-500 rounded-md flex items-center justify-center">
                  <span class="text-white font-bold text-sm">🚨</span>
                </div>
              </div>
              <div class="ml-5 w-0 flex-1">
                <dl>
                  <dt class="text-sm font-medium text-gray-500 truncate">Emergencias</dt>
                  <dd class="text-lg font-medium text-gray-900">0</dd>
                </dl>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted, computed } from 'vue'
import { 
  subscribeToUsers, 
  subscribeToGroups, 
  addMemberToGroup,
  removeMemberFromGroup,
  type FirebaseUser, 
  type FirebaseGroup 
} from '@/firebase'
import GroupPanel from '@/components/estadisticas/GroupPanel.vue'
import AlertPanel from '@/components/estadisticas/AlertPanel.vue'
import MapPanel from '@/components/estadisticas/MapPanel.vue'

const users = ref<FirebaseUser[]>([])
const groups = ref<FirebaseGroup[]>([])
const loading = ref(true)

let unsubscribeUsers: (() => void) | null = null
let unsubscribeGroups: (() => void) | null = null

// Computed properties para estadísticas
const onlineUsersCount = computed(() => 
  users.value.filter(user => user.status === 'online').length
)

const activeGroupsCount = computed(() => 
  groups.value.filter(group => (group.members?.length || 0) > 0).length
)

// Mock data para alertas - en producción esto vendría de Firebase
const recentAlerts = ref([
  { id: 1, user: 'Antony De la Cruz', location: 'UTT', minutes: 10 },
  { id: 2, user: 'Daniel Apizaco', location: 'Apizaco', minutes: 45 },
  { id: 3, user: 'Marco Antonio Damian Ortiz', location: 'Apizaco', minutes: 10 },
  { id: 4, user: 'Rodrigo Audeano', location: 'Apizaco', minutes: 10 }
])

onMounted(() => {
  // Suscribirse a usuarios
  unsubscribeUsers = subscribeToUsers((data) => {
    users.value = data
    loading.value = false
  })

  // Suscribirse a grupos
  unsubscribeGroups = subscribeToGroups((data) => {
    groups.value = data.map(group => ({
      ...group,
      members: Array.isArray(group.members) ? group.members : []
    }))
  })
})

onUnmounted(() => {
  if (unsubscribeUsers) unsubscribeUsers()
  if (unsubscribeGroups) unsubscribeGroups()
})

// Handlers para eventos de grupos
const handleGroupCreated = () => {
  console.log('Grupo creado exitosamente')
}

const handleGroupDeleted = (groupId: string) => {
  console.log('Grupo eliminado:', groupId)
}

const handleMemberAdded = async (groupId: string, userEmail: string) => {
  try {
    await addMemberToGroup(groupId, userEmail)
    console.log('Miembro agregado exitosamente')
  } catch (error) {
    console.error('Error agregando miembro:', error)
    alert('Error al agregar miembro al grupo')
  }
}

const handleMemberRemoved = async (groupId: string, userEmail: string) => {
  try {
    await removeMemberFromGroup(groupId, userEmail)
    console.log('Miembro removido exitosamente')
  } catch (error) {
    console.error('Error removiendo miembro:', error)
    alert('Error al remover miembro del grupo')
  }
};
</script>
