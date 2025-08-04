<template>
  <div class="grid grid-cols-1 lg:grid-cols-5 gap-4 p-6">
    <!-- Panel Izquierdo -->
    <div class="lg:col-span-1">
      <GroupPanel :groups="groups" :users="users" />
    </div>

    <!-- Panel Central - Mapa -->
    <div class="lg:col-span-3">
      <MapPanel :users="users" :loading="loading" />
    </div>

    <!-- Panel Derecho - Alertas -->
    <div class="lg:col-span-1">
      <AlertPanel :alerts="mockAlerts" />
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue'
import { subscribeToUsers, subscribeToGroups, type FirebaseUser, type FirebaseGroup } from '@/firebase'
import GroupPanel from '@/components/estadisticas/GroupPanel.vue'
import AlertPanel from '@/components/estadisticas/AlertPanel.vue'
import MapPanel from '@/components/estadisticas/MapPanel.vue'

const users = ref<FirebaseUser[]>([])
const groups = ref<FirebaseGroup[]>([])
const loading = ref(true)

let unsubscribeUsers: (() => void) | null = null
let unsubscribeGroups: (() => void) | null = null

onMounted(() => {
  unsubscribeUsers = subscribeToUsers((data) => {
    users.value = data
    loading.value = false
  })

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

const mockAlerts = ref([
  { id: 1, user: 'Antony De la Cruz', location: 'UTT', minutes: 10 },
  { id: 2, user: 'Daniel', location: 'Apizaco', minutes: 45 },
  { id: 3, user: 'Marco Antonio Damian Ortiz', location: 'Apizaco', minutes: 1440 }
])
</script>
