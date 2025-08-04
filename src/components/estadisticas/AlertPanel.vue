<template>
  <div class="bg-white p-4 rounded shadow space-y-4">
    <h3 class="font-bold text-lg">Alertas recientes</h3>
    <div
      v-for="alert in alerts"
      :key="alert.id"
      class="bg-red-50 p-3 rounded text-sm space-y-1"
    >
      <p class="text-red-700 font-medium">{{ alert.user }}</p>
      <p class="text-gray-500 text-xs">{{ alert.location }} — hace {{ alert.minutes }} min</p>
    </div>
  </div>
</template>

<script setup lang="ts">
defineProps<{
  alerts: { id: number; user: string; location: string; minutes: number }[]
}>()
</script>
