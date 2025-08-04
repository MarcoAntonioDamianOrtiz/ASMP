<template>
  <div class="space-y-4">
    <div v-for="group in groups" :key="group.id" class="bg-white p-4 rounded shadow">
      <h3 class="font-bold text-lg mb-1">{{ group.name }}</h3>
      <p class="text-sm text-gray-600">{{ group.description }}</p>
      <p class="text-xs text-gray-500">{{ group.members?.length || 0 }} miembros</p>
      <span :class="group.members.length > 0 ? 'text-green-600' : 'text-red-600'">
        {{ group.members.length > 0 ? 'Grupo activo' : 'Grupo inactivo' }}
      </span>

      <div class="mt-3 space-y-2">
        <div
          v-for="user in users.filter(u => group.members.includes(u.email))"
          :key="user.id"
          class="bg-gray-100 p-2 rounded"
        >
          <div class="flex justify-between items-center">
            <div>
              <p class="text-sm font-semibold">{{ user.name }}</p>
              <p class="text-xs text-gray-500">{{ user.location || 'UTT Campus' }}</p>
            </div>
            <span
              :class="user.role === 'guardian'
                ? 'bg-green-100 text-green-700'
                : 'bg-blue-100 text-blue-700'"
              class="text-xs px-2 py-1 rounded"
            >
              {{ user.role }}
            </span>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { FirebaseUser, FirebaseGroup } from '@/firebase'
defineProps<{
  groups: FirebaseGroup[]
  users: FirebaseUser[]
}>()
</script>
