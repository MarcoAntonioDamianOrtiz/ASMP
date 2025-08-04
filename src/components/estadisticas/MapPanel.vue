<template>
  <div class="bg-white rounded shadow relative overflow-hidden h-[32rem]">
    <div ref="mapContainer" class="w-full h-full"></div>
    <div v-if="loading"
         class="absolute inset-0 bg-white bg-opacity-75 flex items-center justify-center">
      <span class="text-gray-600">Cargando mapa...</span>
    </div>
  </div>
</template>

<script setup lang="ts">
import { onMounted, ref } from 'vue'
import mapboxgl from 'mapbox-gl'
import type { FirebaseUser } from '@/firebase'

const props = defineProps<{
  users: FirebaseUser[]
  loading: boolean
}>()

const mapContainer = ref<HTMLElement | null>(null)
const map = ref<mapboxgl.Map | null>(null)

onMounted(() => {
  if (!mapContainer.value) return

  mapboxgl.accessToken =
    'pk.eyJ1IjoiYW50b255MjcwNCIsImEiOiJjbWQweGg4d2IxOGdnMmtwemp3Nnp0YmIxIn0.-Hm3lVWw6U-NE10a0u2U2A'

  map.value = new mapboxgl.Map({
    container: mapContainer.value,
    style: 'mapbox://styles/mapbox/streets-v12',
    center: [-97.9691, 19.3867],
    zoom: 12
  })

  map.value.on('load', () => {
    addMarkersToMap()
  })
})

function addMarkersToMap() {
  if (!map.value) return

  props.users.forEach((user) => {
    if (!user.coordinates) return

    const el = document.createElement('div')
    el.className = 'custom-marker'
    el.style.cssText = `
      width: 30px;
      height: 30px;
      border-radius: 50%;
      background-color: ${user.status === 'online' ? '#10b981' : '#ef4444'};
      color: white;
      display: flex;
      align-items: center;
      justify-content: center;
      font-weight: bold;
    `
    el.textContent = user.name.charAt(0).toUpperCase()

    new mapboxgl.Marker(el).setLngLat(user.coordinates).addTo(map.value!)
  })
}
</script>

<style scoped>
.custom-marker {
  cursor: pointer;
}
</style>
