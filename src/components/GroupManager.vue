<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue'
import { useUserStore } from '@/stores/user'
import { 
  respondToInvitation,
  subscribeToUserInvitations,
  type GroupInvitation 
} from '@/firebase'

// IMPORTAR SISTEMA AUTOMÁTICO SIMPLIFICADO
import {
  createAutoSyncGroup,
  addMemberAutoSync,
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
    // Usar la función auto-sync
    await createAutoSyncGroup({
      name: newGroup.value.name.trim(),
      description: newGroup.value.description.trim(),
      createdBy: userStore.user?.email || '',
      members: [userStore.user?.email || ''],
      pendingInvitations: []
    })

    success.value = '🚀 Grupo creado y sincronizado automáticamente (Web ↔ Móvil) ✅'
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

// Invitar usuario con auto-sync
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

  inviteForm.value.loading = true
  error.value = null

  try {
    // Usar la función auto-sync para agregar miembro
    await addMemberAutoSync(selectedGroup.value.id, inviteForm.value.email.trim())

    success.value = `📱 ${inviteForm.value.email} agregado automáticamente (Web ↔ Móvil) ✅`
    inviteForm.value.email = ''
    showInviteModal.value = false
    
    // Actualizar salud de sincronización
    await updateSyncHealth()
  } catch (err: any) {
    error.value = err.message || 'Error al agregar miembro'
  } finally {
    inviteForm.value.loading = false
  }
}

// Responder a invitación (mantiene la lógica original)
const respondInvitation = async (invitationId: string, response: 'accepted' | 'rejected') => {
  loading.value = true
  error.value = null

  try {
    await respondToInvitation(invitationId, response)
    success.value = response === 'accepted' 
      ? '✅ Te has unido al grupo (sincronizado automáticamente)' 
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
    success.value = '🗑️ Miembro removido automáticamente (Web ↔ Móvil) ✅'
    
    // Actualizar salud de sincronización
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

let unsubscribeGroups: (() => void) | null = null
let unsubscribeInvitations: (() => void) | null = null

onMounted(async () => {
  if (!userStore.isAuthenticated || !userStore.user?.email) return

  console.log('🚀 Iniciando auto-sync para:', userStore.user.email)

  // Suscribirse a grupos con auto-sync
  unsubscribeGroups = await subscribeToUserGroupsAutoSync(
    userStore.user.email,
    (groups) => {
      console.log('📊 Grupos auto-sync actualizados:', groups.length)
      userGroups.value = groups
    }
  )

  // Suscribirse a invitaciones (lógica original)
  unsubscribeInvitations = subscribeToUserInvitations(userStore.user.email, (invitations) => {
    pendingInvitations.value = invitations
  })

  // Actualizar salud de sincronización
  await updateSyncHealth()

  // Ejecutar migración automática si es necesario
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
    <div class="bg-white rounded-lg shadow p-6">
      <div class="flex justify-between items-center mb-4">
        <h3 class="text-lg font-semibold text-gray-800">Mis Grupos (Auto-Sync Web ↔ Móvil) 🔄</h3>
        <button
          @click="showCreateGroup = !showCreateGroup"
          class="px-4 py-2 bg-green-500 hover:bg-green-600 text-white text-sm rounded-lg transition-colors"
        >
          + Crear Grupo
        </button>
      </div>

      <!-- Formulario crear grupo -->
      <div v-if="showCreateGroup" class="mb-6 p-4 bg-gradient-to-r from-green-50 to-blue-50 rounded-lg border border-green-200">
        <h4 class="font-medium text-gray-800 mb-3 flex items-center">
          🚀 Nuevo Grupo (Se sincroniza automáticamente con móvil)
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
          <div class="bg-blue-50 p-3 rounded border border-blue-200">
            <p class="text-sm text-blue-800 flex items-center">
              ℹ️ Este grupo será accesible automáticamente desde tu app móvil usando UIDs de usuario
            </p>
          </div>
          <div class="flex gap-2">
            <button
              @click="createNewGroup"
              :disabled="loading"
              class="px-4 py-2 bg-green-500 hover:bg-green-600 text-white text-sm rounded-lg transition-colors disabled:opacity-50 flex items-center"
            >
              {{ loading ? '🔄 Creando...' : '🚀 Crear y Auto-Sincronizar' }}
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

      <!-- Lista de grupos -->
      <div v-if="userGroups.length === 0 && !showCreateGroup" class="text-center py-8 text-gray-500">
        <svg class="w-12 h-12 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"></path>
        </svg>
        <p>No tienes grupos aún</p>
        <p class="text-sm">Crea tu primer grupo para empezar la sincronización automática</p>
      </div>

      <div v-else class="space-y-4">
        <div 
          v-for="group in userGroups" 
          :key="group.id"
          class="border rounded-lg p-4 hover:shadow-md transition-shadow relative"
          :class="{
            'border-green-200 bg-green-50': group.isAutoSynced && group.membersUids?.length,
            'border-yellow-200 bg-yellow-50': group.isAutoSynced && !group.membersUids?.length,
            'border-red-200 bg-red-50': !group.isAutoSynced
          }"
        >
          <!-- Badge de estado -->
          <div class="absolute top-2 right-2">
            <span class="px-2 py-1 text-xs rounded-full font-medium border"
                  :class="getGroupBadgeColor(group)">
              {{ getGroupStatus(group) }}
            </span>
          </div>

          <div class="flex justify-between items-start mb-3 pr-32">
            <div>
              <h4 class="font-medium text-gray-800">{{ group.name }}</h4>
              <p v-if="group.description" class="text-sm text-gray-600 mt-1">{{ group.description }}</p>
              <p class="text-xs text-gray-500 mt-1">
                Creado por: {{ group.createdBy === userStore.user?.email ? 'Ti' : group.createdBy }}
              </p>
              <!-- Información de sincronización mejorada -->
              <div class="mt-2 text-xs space-y-1">
                <p v-if="group.lastSyncUpdate" class="text-purple-600">
                  🔄 Última sync: {{ new Date(group.lastSyncUpdate).toLocaleString() }}
                </p>
                <p v-if="group.membersUids?.length" class="text-blue-600">
                  📱 UIDs sincronizados: {{ group.membersUids.length }}/{{ group.members.length }} miembros
                </p>
                <p v-if="group.mobileGroupId" class="text-green-600">
                  📱 ID Móvil: {{ group.mobileGroupId }}
                </p>
              </div>
            </div>
            <div class="flex gap-2 flex-col">
              <button
                @click="openInviteModal(group)"
                class="px-3 py-1 bg-blue-500 hover:bg-blue-600 text-white text-sm rounded-lg transition-colors"
              >
                + Agregar Miembro
              </button>
              <button
                v-if="!group.isAutoSynced || !group.membersUids?.length"
                @click="forceSyncSpecificGroup(group.id)"
                :disabled="loading"
                class="px-3 py-1 bg-orange-500 hover:bg-orange-600 text-white text-xs rounded-lg transition-colors disabled:opacity-50"
              >
                🔄 Forzar Sync
              </button>
            </div>
          </div>

          <!-- Miembros -->
          <div>
            <h5 class="text-sm font-medium text-gray-700 mb-2">
              Miembros ({{ group.members.length }})
            </h5>
            <div class="grid grid-cols-1 md:grid-cols-2 gap-2">
              <div 
                v-for="(member, index) in group.members" 
                :key="member"
                class="flex items-center justify-between text-sm bg-white rounded px-3 py-2"
              >
                <div class="flex items-center">
                  <span :class="member === userStore.user?.email ? 'font-medium' : ''">
                    {{ member === userStore.user?.email ? `${member} (Tú)` : member }}
                  </span>
                  <!-- Indicador de UID sincronizado -->
                  <span v-if="group.membersUids && group.membersUids[index]" 
                        class="ml-2 text-green-500 text-xs" 
                        :title="`UID: ${group.membersUids[index]}`">
                    📱✅
                  </span>
                </div>
                <div class="flex items-center gap-2">
                  <button
                    v-if="group.createdBy === userStore.user?.email && member !== userStore.user?.email"
                    @click="removeMember(group.id, member)"
                    class="text-red-500 hover:text-red-700 text-xs"
                    title="Remover miembro"
                  >
                    ✕
                  </button>
                </div>
              </div>
            </div>
          </div>

          <!-- Invitaciones pendientes -->
          <div v-if="group.pendingInvitations && group.pendingInvitations.length > 0" class="mt-3">
            <h5 class="text-sm font-medium text-gray-700 mb-2">
              Invitaciones Pendientes ({{ group.pendingInvitations.length }})
            </h5>
            <div class="flex flex-wrap gap-2">
              <span 
                v-for="email in group.pendingInvitations" 
                :key="email"
                class="px-2 py-1 bg-yellow-100 text-yellow-800 text-xs rounded"
              >
                {{ email }}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Modal de invitación / agregar miembro -->
    <div v-if="showInviteModal" class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div class="bg-white rounded-lg p-6 w-full max-w-md mx-4">
        <h3 class="text-lg font-semibold text-gray-800 mb-4">
          Agregar Miembro a: {{ selectedGroup?.name }}
        </h3>
        
        <div class="space-y-4">
          <div class="bg-blue-50 p-3 rounded border border-blue-200">
            <p class="text-sm text-blue-800 flex items-center">
              🔄 El miembro será agregado automáticamente en web y móvil usando su UID
            </p>
          </div>

          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">Email del usuario</label>
            <input
              v-model="inviteForm.email"
              type="email"
              class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="usuario@correo.com"
              @keyup.enter="inviteUser"
            />
            <p class="text-xs text-gray-500 mt-1">
              💡 El usuario debe estar registrado en el sistema para obtener su UID
            </p>
          </div>
          
          <div class="flex gap-2">
            <button
              @click="inviteUser"
              :disabled="inviteForm.loading"
              class="flex-1 px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-lg transition-colors disabled:opacity-50 flex items-center justify-center"
            >
              {{ inviteForm.loading ? '🔄 Agregando...' : '🚀 Agregar y Sincronizar' }}
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
  </div>
</template>