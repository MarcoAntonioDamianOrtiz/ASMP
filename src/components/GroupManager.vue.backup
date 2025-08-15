<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue'
import { useUserStore } from '@/stores/user'
import { 
  createGroup, 
  inviteToGroup, 
  respondToInvitation,
  subscribeToUserGroups,
  subscribeToUserInvitations,
  removeMemberFromGroup,
  type FirebaseGroup,
  type GroupInvitation 
} from '@/firebase'

const userStore = useUserStore()

// Estado
const userGroups = ref<FirebaseGroup[]>([])
const pendingInvitations = ref<GroupInvitation[]>([])
const showCreateGroup = ref(false)
const showInviteModal = ref(false)
const selectedGroup = ref<FirebaseGroup | null>(null)

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
      members: [userStore.user?.email || ''], // El creador es automáticamente miembro
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
  if (!inviteForm.value.email.trim() || !selectedGroup.value) {
    error.value = 'El email es requerido'
    return
  }

  // Validar formato de email
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  if (!emailRegex.test(inviteForm.value.email)) {
    error.value = 'Formato de email inválido'
    return
  }

  inviteForm.value.loading = true
  error.value = null

  try {
    await inviteToGroup(
      selectedGroup.value.id,
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

// Remover miembro
const removeMember = async (groupId: string, memberEmail: string) => {
  if (!confirm('¿Estás seguro de que quieres remover este miembro del grupo?')) return

  loading.value = true
  error.value = null

  try {
    await removeMemberFromGroup(groupId, memberEmail)
    success.value = 'Miembro removido del grupo'
  } catch (err: any) {
    error.value = err.message || 'Error al remover el miembro'
  } finally {
    loading.value = false
  }
}

// Abrir modal de invitación
const openInviteModal = (group: FirebaseGroup) => {
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

let unsubscribeGroups: (() => void) | null = null
let unsubscribeInvitations: (() => void) | null = null

onMounted(() => {
  if (!userStore.isAuthenticated || !userStore.user?.email) return

  // Suscribirse a grupos del usuario
  unsubscribeGroups = subscribeToUserGroups(userStore.user.email, (groups) => {
    userGroups.value = groups
  })

  // Suscribirse a invitaciones pendientes
  unsubscribeInvitations = subscribeToUserInvitations(userStore.user.email, (invitations) => {
    pendingInvitations.value = invitations
  })
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
        <h3 class="text-lg font-semibold text-gray-800">Mis Grupos</h3>
        <button
          @click="showCreateGroup = !showCreateGroup"
          class="px-4 py-2 bg-green-500 hover:bg-green-600 text-white text-sm rounded-lg transition-colors"
        >
          + Crear Grupo
        </button>
      </div>

      <!-- Formulario crear grupo -->
      <div v-if="showCreateGroup" class="mb-6 p-4 bg-gray-50 rounded-lg">
        <h4 class="font-medium text-gray-800 mb-3">Nuevo Grupo</h4>
        <div class="space-y-3">
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">Nombre del grupo *</label>
            <input
              v-model="newGroup.name"
              type="text"
              class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
              placeholder="Ej: Familia Pérez"
              maxlength="50"
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
              class="px-4 py-2 bg-green-500 hover:bg-green-600 text-white text-sm rounded-lg transition-colors disabled:opacity-50"
            >
              {{ loading ? 'Creando...' : 'Crear Grupo' }}
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
        <p class="text-sm">Crea tu primer grupo para empezar</p>
      </div>

      <div v-else class="space-y-4">
        <div 
          v-for="group in userGroups" 
          :key="group.id"
          class="border rounded-lg p-4 hover:shadow-md transition-shadow"
        >
          <div class="flex justify-between items-start mb-3">
            <div>
              <h4 class="font-medium text-gray-800">{{ group.name }}</h4>
              <p v-if="group.description" class="text-sm text-gray-600 mt-1">{{ group.description }}</p>
              <p class="text-xs text-gray-500 mt-1">
                Creado por: {{ group.createdBy === userStore.user?.email ? 'Ti' : group.createdBy }}
              </p>
            </div>
            <div class="flex gap-2">
              <button
                @click="openInviteModal(group)"
                class="px-3 py-1 bg-blue-500 hover:bg-blue-600 text-white text-sm rounded-lg transition-colors"
              >
                Invitar
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
                v-for="member in group.members" 
                :key="member"
                class="flex items-center justify-between text-sm bg-gray-50 rounded px-3 py-2"
              >
                <span :class="member === userStore.user?.email ? 'font-medium' : ''">
                  {{ member === userStore.user?.email ? `${member} (Tú)` : member }}
                </span>
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

    <!-- Modal de invitación -->
    <div v-if="showInviteModal" class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div class="bg-white rounded-lg p-6 w-full max-w-md mx-4">
        <h3 class="text-lg font-semibold text-gray-800 mb-4">
          Invitar a: {{ selectedGroup?.name }}
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
  </div>
</template>

