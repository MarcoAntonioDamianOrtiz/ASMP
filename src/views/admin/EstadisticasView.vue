<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue'
import { subscribeToUsers, type FirebaseUser } from '@/firebase'
import MapPanel from '@/components/estadisticas/MapPanel.vue'
import MainNav from '../../components/MainNav.vue';
import LayoutView from './LayoutView.vue';

const users = ref<FirebaseUser[]>([])
const loading = ref(true)
const lastUpdate = ref(new Date().toLocaleTimeString())

let unsubscribeUsers: (() => void) | null = null
let updateInterval: ReturnType<typeof setInterval> | null = null

 
onMounted(() => {
  unsubscribeUsers = subscribeToUsers((data) => {
    users.value = data
    loading.value = false
    lastUpdate.value = new Date().toLocaleTimeString()
  })

  updateInterval = setInterval(() => {
    lastUpdate.value = new Date().toLocaleTimeString()
  }, 60000)
})

onUnmounted(() => {
  if (unsubscribeUsers) unsubscribeUsers()
  if (updateInterval) clearInterval(updateInterval)
})
</script>

<template>
   <LayoutView>
        <MainNav />

    <div class="max-w-7xl mx-auto px-4 py-6">
      <div class="bg-white rounded-lg shadow mb-6">
        <div class="px-4 py-3 border-b border-gray-200">
          <h2 class="text-lg font-semibold text-gray-900">Ubicaciones en Tiempo Real</h2>
        </div>
        <div class="p-4">
          <MapPanel :users="users" :loading="loading" />
        </div>
      </div>

      <div class="bg-white rounded-lg shadow">
        <div class="px-4 py-3 border-b border-gray-200">
          <h3 class="text-lg font-semibold text-gray-900">Usuarios Registrados</h3>
        </div>
        <div class="px-4 py-4 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          <div 
            v-for="user in users" 
            :key="user.id"
            class="border rounded-lg p-4 bg-gray-50 hover:shadow"
          >
            <h4 class="font-semibold text-gray-900 mb-1">{{ user.name }}</h4>
            <p class="text-sm text-gray-600">{{ user.email }}</p>
            <p class="text-sm text-gray-600">📱 {{ user.phone }}</p>
          </div>
        </div>
      </div>
    </div>
  </LayoutView>
</template>

