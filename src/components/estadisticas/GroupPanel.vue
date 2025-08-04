<template>
  <div class="space-y-4">
    <!-- Botón para crear nuevo grupo -->
    <div class="bg-white p-4 rounded shadow">
      <button 
        @click="showCreateForm = !showCreateForm"
        class="w-full bg-green-500 hover:bg-green-600 text-white font-semibold py-2 px-4 rounded transition-colors">
        {{ showCreateForm ? 'Cancelar' : 'Crear Nuevo Grupo' }}
      </button>
      
      <!-- Formulario para crear grupo -->
      <div v-if="showCreateForm" class="mt-4 space-y-3">
        <input
          v-model="newGroupName"
          type="text"
          placeholder="Nombre del grupo"
          class="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-green-500"
        />
        <input
          v-model="newGroupDescription"
          type="text"
          placeholder="Descripción del grupo"
          class="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-green-500"
        />
        <button
          @click="createGroup"
          :disabled="!newGroupName.trim()"
          class="w-full bg-blue-500 hover:bg-blue-600 disabled:bg-gray-300 text-white font-semibold py-2 px-4 rounded transition-colors">
          Crear Grupo
        </button>
      </div>
    </div>

    <!-- Lista de grupos -->
    <div v-if="groups.length === 0" class="bg-white p-4 rounded shadow text-center text-gray-500">
      No hay grupos creados. ¡Crea tu primer grupo!
    </div>
    
    <div v-for="group in groups" :key="group.id" class="bg-white p-4 rounded shadow">
      <div class="flex justify-between items-start mb-3">
        <div>
          <h3 class="font-bold text-lg">{{ group.name }}</h3>
          <p class="text-sm text-gray-600">{{ group.description }}</p>
          <p class="text-xs text-gray-500">{{ group.members?.length || 0 }} miembros</p>
        </div>
        <button
          @click="deleteGroup(group.id)"
          class="text-red-500 hover:text-red-700 text-sm">
          Eliminar
        </button>
      </div>
      
      <span :class="(group.members?.length || 0) > 0 ? 'text-green-600' : 'text-red-600'"
            class="text-sm font-medium">
        {{ (group.members?.length || 0) > 0 ? 'Grupo activo' : 'Grupo inactivo' }}
      </span>

      <!-- Agregar miembro -->
      <div class="mt-3 p-3 bg-gray-50 rounded">
        <div class="flex gap-2 mb-2">
          <select
            v-model="selectedUserEmail"
            class="flex-1 px-2 py-1 border border-gray-300 rounded text-sm">
            <option value="">Seleccionar usuario</option>
            <option 
              v-for="user in availableUsers(group)" 
              :key="user.email" 
              :value="user.email">
              {{ user.name }} ({{ user.email }})
            </option>
          </select>
          <button
            @click="addMemberToGroup(group.id)"
            :disabled="!selectedUserEmail"
            class="bg-green-500 hover:bg-green-600 disabled:bg-gray-300 text-white px-3 py-1 rounded text-sm">
            Agregar
          </button>
        </div>
      </div>

      <!-- Lista de miembros -->
      <div class="mt-3 space-y-2">
        <div
          v-for="user in users.filter(u => group.members?.includes(u.email))"
          :key="user.id"
          class="bg-gray-100 p-2 rounded"
        >
          <div class="flex justify-between items-center">
            <div>
              <p class="text-sm font-semibold">{{ user.name }}</p>
              <p class="text-xs text-gray-500">{{ user.location || 'UTT Campus' }}</p>
            </div>
            <div class="flex items-center gap-2">
              <span
                :class="user.role === 'guardian'
                  ? 'bg-green-100 text-green-700'
                  : 'bg-blue-100 text-blue-700'"
                class="text-xs px-2 py-1 rounded"
              >
                {{ user.role }}
              </span>
              <button
                @click="removeMemberFromGroup(group.id, user.email)"
                class="text-red-500 hover:text-red-700 text-xs">
                Quitar
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import type { FirebaseUser, FirebaseGroup } from '@/firebase'
import { createGroup as createFirebaseGroup, deleteGroup as deleteFirebaseGroup } from '@/firebase'

const props = defineProps<{
  groups: FirebaseGroup[]
  users: FirebaseUser[]
}>()

const emit = defineEmits<{
  groupCreated: []
  groupDeleted: [id: string]
  memberAdded: [groupId: string, userEmail: string]
  memberRemoved: [groupId: string, userEmail: string]
}>()

const showCreateForm = ref(false)
const newGroupName = ref('')
const newGroupDescription = ref('')
const selectedUserEmail = ref('')

// Obtener usuarios disponibles para agregar al grupo
const availableUsers = (group: FirebaseGroup) => {
  return props.users.filter(user => 
    !group.members?.includes(user.email)
  )
}

const createGroup = async () => {
  if (!newGroupName.value.trim()) return
  
  try {
    await createFirebaseGroup({
      name: newGroupName.value,
      description: newGroupDescription.value || 'Sin descripción',
      createdBy: 'admin', // Aquí deberías usar el email del usuario actual
      members: []
    })
    
    // Limpiar formulario
    newGroupName.value = ''
    newGroupDescription.value = ''
    showCreateForm.value = false
    
    emit('groupCreated')
  } catch (error) {
    console.error('Error creating group:', error)
    alert('Error al crear el grupo')
  }
}

const deleteGroup = async (groupId: string) => {
  if (!confirm('¿Estás seguro de que quieres eliminar este grupo?')) return
  
  try {
    await deleteFirebaseGroup(groupId)
    emit('groupDeleted', groupId)
  } catch (error) {
    console.error('Error deleting group:', error)
    alert('Error al eliminar el grupo')
  }
}

const addMemberToGroup = async (groupId: string) => {
  if (!selectedUserEmail.value) return
  
  // Aquí necesitarías implementar la función para agregar miembros en Firebase
  emit('memberAdded', groupId, selectedUserEmail.value)
  selectedUserEmail.value = ''
}

const removeMemberFromGroup = async (groupId: string, userEmail: string) => {
  if (!confirm('¿Quitar este usuario del grupo?')) return
  
  // Aquí necesitarías implementar la función para quitar miembros en Firebase
  emit('memberRemoved', groupId, userEmail)
}
</script>