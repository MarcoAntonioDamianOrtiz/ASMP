<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue'
import { useUserStore } from '@/stores/user'
import { 
  respondToInvitation,
  subscribeToUserInvitations,
  sendGroupInvitation,  // CAMBIAR: usar invitación normal, NO auto-sync
  type GroupInvitation 
} from '@/firebase'

// IMPORTAR SISTEMA AUTOMÁTICO SIMPLIFICADO
import {
  createAutoSyncGroup,
  removeMemberAutoSync,
  subscribeToUserGroupsAutoSync,
  migrateExistingGroupsToAutoSync,
  checkAutoSyncHealth,
  forceSyncGroup,
  type UnifiedGroup
} from '@/firebase/autoSync'

const userStore = useUserStore()

// Estado simplificado
const userGroups = ref<UnifiedGroup[]>([])
const pendingInvitations = ref<GroupInvitation[]>([])
const showCreateGroup = ref(false)
const showInviteModal = ref(false)
const selectedGroup = ref<UnifiedGroup | null>(null)

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

const loading = ref(false)
const error = ref<string | null>(null)
const success = ref<string | null>(null)

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

    success.value = '🚀 Grupo creado exitosamente con auto-sincronización ✅'
    newGroup.value = { name: '', description: '' }
    showCreateGroup.value = false
    
    await updateSyncHealth()
  } catch (err: any) {
    error.value = err.message || 'Error al crear el grupo'
  } finally {
    loading.value = false
  }
}

// CORREGIDO: Enviar invitación por correo (NO automático)
const inviteUser = async () => {
  if (!inviteForm.value.email.trim() || !selectedGroup.value) {
    error.value = 'El email es requerido'
    return
  }

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  if (!emailRegex.test(inviteForm.value.email)) {
    error.value = 'Formato de email inválido'
    return
  }

  // Verificar que no sea el mismo usuario
  if (inviteForm.value.email === userStore.user?.email) {
    error.value = 'No puedes invitarte a ti mismo'
    return
  }

  // Verificar que no sea ya miembro
  if (selectedGroup.value.members.includes(inviteForm.value.email)) {
    error.value = 'Este usuario ya es miembro del grupo'
    return
  }

  inviteForm.value.loading = true
  error.value = null

  try {
    // USAR LA FUNCIÓN CORRECTA: enviar invitación por correo
    await sendGroupInvitation({
      groupId: selectedGroup.value.id,
      groupName: selectedGroup.value.name,
      inviterEmail: userStore.user?.email || '',
      inviterName: userStore.user?.email?.split('@')[0] || 'Usuario',
      inviteeEmail: inviteForm.value.email.trim()
    })

    success.value = `📧 Invitación enviada a ${inviteForm.value.email}. Debe aceptarla para unirse al grupo.`
    inviteForm.value.email = ''
    showInviteModal.value = false
    selectedGroup.value = null
    
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
      ? '✅ Te has unido al grupo exitosamente' 
      : 'Invitación rechazada'
  } catch (err: any) {
    error.value = err.message || 'Error al responder la invitación'
  } finally {
    loading.value = false
  }
}

// Remover miembro con auto-sync
const removeMember = async (groupId: string, memberEmail: string) => {
  if (!confirm('¿Estás seguro de que quieres remover este miembro del grupo?')) return

  loading.value = true
  error.value = null

  try {
    await removeMemberAutoSync(groupId, memberEmail)
    success.value = '🗑️ Miembro removido del grupo ✅'
    await updateSyncHealth()
  } catch (err: any) {
    error.value = err.message || 'Error al remover el miembro'
  } finally {
    loading.value = false
  }
}

// Forzar sincronización de un grupo específico
const forceSyncSpecificGroup = async (groupId: string) => {
  loading.value = true
  error.value = null

  try {
    await forceSyncGroup(groupId)
    success.value = '🔄 Grupo sincronizado forzadamente ✅'
    await updateSyncHealth()
  } catch (err: any) {
    error.value = 'Error en sincronización forzada: ' + err.message
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
  selectedGroup.value = group
  showInviteModal.value = true
  inviteForm.value.email = ''
  error.value = null
}

// Limpiar mensajes
const clearMessages = () => {
  error.value = null
  success.value = null
}

// Obtener estado del grupo
const getGroupStatus = (group: UnifiedGroup): string => {
  if (group.isAutoSynced && group.membersUids?.length) {
    return '🟢 Sincronizado Completo'
  } else if (group.isAutoSynced) {
    return '🟡 Sincronización Parcial'
  } else {
    return '🔴 Sin Sincronizar'
  }
}

// Obtener color del badge
const getGroupBadgeColor = (group: UnifiedGroup): string => {
  if (group.isAutoSynced && group.membersUids?.length) {
    return 'bg-green-100 text-green-800 border-green-200'
  } else if (group.isAutoSynced) {
    return 'bg-yellow-100 text-yellow-800 border-yellow-200'
  } else {
    return 'bg-red-100 text-red-800 border-red-200'
  }
}

// Obtener el nombre del usuario desde el email
const getUserDisplayName = (email: string): string => {
  if (email === userStore.user?.email) {
    return 'Tú'
  }
  return email.split('@')[0]
}

let unsubscribeGroups: (() => void) | null = null
let unsubscribeInvitations: (() => void) | null = null

onMounted(async () => {
  if (!userStore.isAuthenticated || !userStore.user?.email) return

  console.log('🚀 Iniciando auto-sync para:', userStore.user.email)

  unsubscribeGroups = await subscribeToUserGroupsAutoSync(
    userStore.user.email,
    (groups) => {
      console.log('📊 Grupos auto-sync actualizados:', groups.length)
      userGroups.value = groups
    }
  )

  unsubscribeInvitations = subscribeToUserInvitations(userStore.user.email, (invitations) => {
    pendingInvitations.value = invitations
  })

  await updateSyncHealth()

  if (autoSyncHealth.value.healthPercentage < 100 && autoSyncHealth.value.totalGroups > 0) {
    console.log('🔄 Ejecutando migración automática...')
    setTimeout(() => runAutoMigration(), 3000)
  }
})

onUnmounted(() => {
  if (unsubscribeGroups) unsubscribeGroups()
  if (unsubscribeInvitations) unsubscribeInvitations()
})
</script>

<template>
  <div class="space-y-6">
    <!-- Mensajes -->
    <div v-if="error" class="bg-red-50 border border-red-200 rounded-lg p-4">
      <div class="flex justify-between items-center">
        <p class="text-red-600 text-sm">{{ error }}</p>
        <button @click="clearMessages" class="text-red-400 hover:text-red-600">✕</button>
      </div>
    </div>

    <div v-if="success" class="bg-green-50 border border-green-200 rounded-lg p-4">
      <div class="flex justify-between items-center">
        <p class="text-green-600 text-sm">{{ success }}</p>
        <button @click="clearMessages" class="text-green-400 hover:text-green-600">✕</button>
      </div>
    </div>

    <!-- Estado de Auto-Sincronización -->
    <div class="bg-gradient-to-r from-purple-50 to-blue-50 border border-purple-200 rounded-lg p-4">
      <h3 class="font-semibold text-purple-800 mb-3 flex items-center">
        🔄 Auto-Sincronización Web ↔ Móvil
      </h3>
      
      <div class="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
        <div class="bg-white rounded p-3 text-center">
          <div class="text-lg font-bold text-purple-600">{{ autoSyncHealth.totalGroups }}</div>
          <div class="text-xs text-gray-600">Total Grupos</div>
        </div>
        <div class="bg-white rounded p-3 text-center">
          <div class="text-lg font-bold text-green-600">{{ autoSyncHealth.syncedGroups }}</div>
          <div class="text-xs text-gray-600">Sincronizados</div>
        </div>
        <div class="bg-white rounded p-3 text-center">
          <div class="text-lg font-bold" :class="{
            'text-green-600': autoSyncHealth.healthPercentage >= 90,
            'text-yellow-600': autoSyncHealth.healthPercentage >= 70,
            'text-red-600': autoSyncHealth.healthPercentage < 70
          }">{{ autoSyncHealth.healthPercentage }}%</div>
          <div class="text-xs text-gray-600">Salud</div>
        </div>
        <div class="bg-white rounded p-3 text-center">
          <div class="text-lg font-bold text-orange-600">{{ autoSyncHealth.needsUpdate.length }}</div>
          <div class="text-xs text-gray-600">Pendientes</div>
        </div>
      </div>

      <!-- Migración automática -->
      <div v-if="migrating" class="bg-white rounded p-3 text-center">
        <div class="flex items-center justify-center text-blue-600">
          <svg class="w-5 h-5 mr-2 animate-spin" fill="none" viewBox="0 0 24 24">
            <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
            <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
          </svg>
          Ejecutando migración automática...
        </div>
      </div>

      <div v-if="migrationResult" class="bg-white rounded p-3 text-sm">
        <p class="text-gray-700">
          ✅ Migración completada: 
          <span class="font-medium">{{ migrationResult.updated }}/{{ migrationResult.processed }}</span> 
          grupos sincronizados automáticamente
        </p>
      </div>

      <!-- Botón de migración manual -->
      <div v-if="autoSyncHealth.healthPercentage < 100 && autoSyncHealth.totalGroups > 0 && !migrating" class="mt-3">
        <button
          @click="runAutoMigration"
          class="w-full px-4 py-2 bg-orange-500 hover:bg-orange-600 text-white text-sm rounded-lg transition-colors"
        >
          🔄 Ejecutar Sincronización Automática
        </button>
      </div>
    </div>

    <!-- Invitaciones pendientes -->
    <div v-if="pendingInvitations.length > 0" class="bg-blue-50 border border-blue-200 rounded-lg p-4">
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

    <!-- Crear grupo -->
    <div class="bg-white rounded-lg shadow-sm border p-6">
      <div class="flex justify-between items-center mb-4">
        <h3 class="text-lg font-semibold text-gray-800 flex items-center">
          <svg class="w-5 h-5 mr-2 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"></path>
          </svg>
          Mis Grupos
        </h3>
        <button
          @click="showCreateGroup = !showCreateGroup"
          class="px-4 py-2 bg-green-500 hover:bg-green-600 text-white text-sm rounded-lg transition-colors flex items-center"
        >
          <svg class="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4"></path>
          </svg>
          Crear Grupo
        </button>
      </div>

      <!-- Formulario crear grupo -->
      <div v-if="showCreateGroup" class="mb-6 p-4 bg-gradient-to-r from-green-50 to-blue-50 rounded-lg border border-green-200">
        <h4 class="font-medium text-gray-800 mb-3 flex items-center">
          🚀 Nuevo Grupo (Auto-Sync)
        </h4>
        <div class="space-y-3">
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">Nombre del grupo *</label>
            <input
              v-model="newGroup.name"
              type="text"
              class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
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
              class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 resize-none"
              placeholder="Descripción opcional del grupo"
              maxlength="200"
            ></textarea>
          </div>
          <div class="flex gap-2">
            <button
              @click="createNewGroup"
              :disabled="loading"
              class="px-4 py-2 bg-green-500 hover:bg-green-600 text-white text-sm rounded-lg transition-colors disabled:opacity-50 flex items-center"
            >
              <svg v-if="loading" class="w-4 h-4 mr-2 animate-spin" fill="none" viewBox="0 0 24 24">
                <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              <span>{{ loading ? 'Creando...' : 'Crear' }}</span>
            </button>
            <button
              @click="showCreateGroup = false"
              class="px-4 py-2 bg-gray-300 hover:bg-gray-400 text-gray-700 text-sm rounded-lg transition-colors"
            >
              Cancelar
            </button>
          </div>
        </div>
      </div>

      <!-- Lista de grupos CORREGIDA -->
      <div v-if="userGroups.length === 0 && !showCreateGroup" class="text-center py-12 text-gray-500">
        <svg class="w-16 h-16 mx-auto mb-4 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 715.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"></path>
        </svg>
        <p class="text-lg font-medium">No tienes grupos aún</p>
        <p class="text-sm mt-1">Crea tu primer grupo</p>
      </div>

      <!-- LISTA DE GRUPOS CORREGIDA - DISEÑO SIMPLE Y CLARO -->
      <div v-else class="space-y-4">
        <div 
          v-for="group in userGroups" 
          :key="group.id"
          class="border rounded-lg p-4 bg-white hover:shadow-md transition-shadow"
        >
          <!-- Header del grupo -->
          <div class="flex justify-between items-start mb-4">
            <div class="flex-1">
              <h4 class="text-lg font-semibold text-gray-800 mb-1">{{ group.name }}</h4>
              <p v-if="group.description" class="text-sm text-gray-600 mb-2">{{ group.description }}</p>
              <div class="flex items-center text-xs text-gray-500">
                <svg class="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"></path>
                </svg>
                Creado por: {{ group.createdBy === userStore.user?.email ? 'Ti' : group.createdBy }}
              </div>
            </div>
            
            <!-- Botones de acción -->
            <div class="flex flex-col gap-2">
              <button
                @click="openInviteModal(group)"
                class="px-3 py-2 bg-blue-500 hover:bg-blue-600 text-white text-sm rounded-lg transition-colors flex items-center"
              >
                <svg class="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z"></path>
                </svg>
                Invitar
              </button>
              
              <button
                v-if="!group.isAutoSynced || !group.membersUids?.length"
                @click="forceSyncSpecificGroup(group.id)"
                :disabled="loading"
                class="px-3 py-2 bg-orange-500 hover:bg-orange-600 text-white text-xs rounded-lg transition-colors disabled:opacity-50"
              >
                🔄 Sync
              </button>
            </div>
          </div>

          <!-- LISTA DE MIEMBROS CORREGIDA - DISEÑO SIMPLE -->
          <div>
            <h5 class="text-sm font-semibold text-gray-700 mb-3 flex items-center">
              <svg class="w-4 h-4 mr-2 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197m13.5-9a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0z"></path>
              </svg>
              Miembros ({{ group.members.length }})
            </h5>
            
            <!-- DISEÑO SIMPLE DE LISTA - UNA COLUMNA -->
            <div class="space-y-2">
              <div 
                v-for="(member, index) in group.members" 
                :key="member"
                class="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
              >
                <div class="flex items-center flex-1">
                  <!-- Avatar simple -->
                  <div class="w-8 h-8 rounded-full flex items-center justify-center mr-3 text-white text-sm font-semibold"
                       :class="member === userStore.user?.email ? 'bg-green-500' : 'bg-blue-500'">
                    {{ getUserDisplayName(member).charAt(0).toUpperCase() }}
                  </div>
                  
                  <!-- Info del miembro -->
                  <div class="flex-1 min-w-0">
                    <p class="text-sm font-medium text-gray-900"
                       :class="member === userStore.user?.email ? 'text-green-700' : ''">
                      {{ getUserDisplayName(member) }}
                      <span v-if="group.createdBy === member" class="text-yellow-500 ml-1">👑</span>
                    </p>
                    <p class="text-xs text-gray-500 truncate">{{ member }}</p>
                  </div>

                  <!-- Indicadores de estado -->
                  <div class="flex items-center space-x-2 ml-2">
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
                
                <!-- Botón eliminar -->
                <button
                  v-if="group.createdBy === userStore.user?.email && member !== userStore.user?.email"
                  @click="removeMember(group.id, member)"
                  class="text-red-500 hover:text-red-700 p-2 rounded-full hover:bg-red-50 transition-colors ml-2"
                  title="Remover miembro"
                >
                  <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path>
                  </svg>
                </button>
              </div>
            </div>
          </div>

          <!-- Invitaciones pendientes -->
          <div v-if="group.pendingInvitations && group.pendingInvitations.length > 0" class="mt-4 pt-4 border-t border-gray-200">
            <h5 class="text-sm font-medium text-gray-700 mb-3 flex items-center">
              <svg class="w-4 h-4 mr-2 text-yellow-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"></path>
              </svg>
              Invitaciones Pendientes ({{ group.pendingInvitations.length }})
            </h5>
            <div class="space-y-2">
              <div 
                v-for="email in group.pendingInvitations" 
                :key="email"
                class="flex items-center justify-between p-2 bg-yellow-50 rounded-lg border border-yellow-200"
              >
                <div class="flex items-center">
                  <svg class="w-4 h-4 mr-2 text-yellow-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 8l7.89 4.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"></path>
                  </svg>
                  <span class="text-sm text-gray-700">{{ email }}</span>
                </div>
                <span class="text-xs bg-yellow-100 text-yellow-800 px-2 py-1 rounded-full">
                  📧 Enviada
                </span>
              </div>
            </div>
          </div>

          <!-- Estado de sincronización -->
          <div v-if="group.isAutoSynced" class="mt-4 pt-4 border-t border-gray-200">
            <div class="flex items-center justify-between text-sm">
              <div class="flex items-center text-purple-600">
                <svg class="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"></path>
                </svg>
                Auto-Sync Activo
              </div>
              <div class="text-xs text-gray-600">
                UIDs: {{ group.membersUids?.length || 0 }}/{{ group.members.length }}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Modal de invitación CORREGIDO -->
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
          <p class="text-sm text-gray-600">
            Grupo: <span class="font-medium text-blue-600">{{ selectedGroup?.name }}</span>
          </p>
        </div>
        
        <div class="space-y-4">
          <!-- Información importante CORREGIDA -->
          <div class="bg-gradient-to-r from-blue-50 to-purple-50 p-4 rounded-lg border border-blue-200">
            <div class="flex items-start">
              <svg class="w-5 h-5 text-blue-600 mt-0.5 mr-3 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 8l7.89 4.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"></path>
              </svg>
              <div>
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
              <svg class="absolute right-3 top-3 w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 8l7.89 4.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"></path>
              </svg>
            </div>
            <p class="text-xs text-gray-500 mt-2 flex items-center">
              <svg class="w-4 h-4 mr-1 text-yellow-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path>
              </svg>
              El usuario recibirá un correo para aceptar la invitación
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
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 8l7.89 4.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"></path>
              </svg>
              <span>{{ inviteForm.loading ? 'Enviando...' : 'Enviar Invitación' }}</span>
            </button>
            <button
              @click="showInviteModal = false; selectedGroup = null"
              :disabled="inviteForm.loading"
              class="px-4 py-3 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg transition-colors disabled:opacity-50 font-medium"
            >
              Cancelar
            </button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

