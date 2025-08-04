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
import { onMounted, ref, watch } from 'vue'
import type { FirebaseUser } from '@/firebase'

const props = defineProps<{
  users: FirebaseUser[]
  loading: boolean
}>()

const mapContainer = ref<HTMLElement | null>(null)
const map = ref<any>(null)

onMounted(async () => {
  if (!mapContainer.value) return

  try {
    // Importar mapbox dinámicamente para evitar problemas de tipos
    const mapboxgl = await import('mapbox-gl')
    
    mapboxgl.default.accessToken = 'pk.eyJ1IjoiYW50b255MjcwNCIsImEiOiJjbWQweGg4d2IxOGdnMmtwemp3Nnp0YmIxIn0.-Hm3lVWw6U-NE10a0u2U2A'

    map.value = new mapboxgl.default.Map({
      container: mapContainer.value,
      style: 'mapbox://styles/mapbox/streets-v12',
      center: [-97.9691, 19.3867],
      zoom: 12
    })

    map.value.on('load', () => {
      addMarkersToMap()
    })
  } catch (error) {
    console.error('Error loading map:', error)
  }
})

// Watch para actualizar marcadores cuando cambien los usuarios
watch(() => props.users, () => {
  if (map.value && map.value.loaded()) {
    addMarkersToMap()
  }
}, { deep: true })

function addMarkersToMap() {
  if (!map.value) return

  // Limpiar marcadores existentes
  const existingMarkers = document.querySelectorAll('.custom-marker')
  existingMarkers.forEach(marker => marker.remove())

  props.users.forEach((user) => {
    if (!user.coordinates) return

    try {
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
        font-size: 12px;
        cursor: pointer;
        border: 2px solid white;
        box-shadow: 0 2px 4px rgba(0,0,0,0.2);
      `
      el.textContent = user.name.charAt(0).toUpperCase()
      el.title = `${user.name} - ${user.status}`

      // Importar Marker dinámicamente
      import('mapbox-gl').then(mapboxgl => {
        new mapboxgl.default.Marker(el)
          .setLngLat(user.coordinates as [number, number])
          .addTo(map.value)
      })
    } catch (error) {
      console.error('Error adding marker:', error)
    }
  })
}
</script>

<style scoped>
.custom-marker {
  cursor: pointer;
}
</style>