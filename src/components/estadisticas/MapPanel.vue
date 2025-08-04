<template>
  <div class="bg-white rounded shadow relative overflow-hidden h-[500px]">
    <!-- Botones de control -->
    <div class="absolute top-4 left-4 z-10 space-y-2">
      <button 
        @click="centerOnMyLocation" 
        class="bg-white hover:bg-gray-100 px-3 py-2 rounded shadow text-sm font-medium">
        📍 Mi ubicación
      </button>
      <button 
        @click="toggleUserTracking" 
        :class="trackingUsers ? 'bg-green-500 text-white' : 'bg-white'"
        class="px-3 py-2 rounded shadow text-sm font-medium">
        {{ trackingUsers ? '👥 Rastreando' : '👥 Activar rastreo' }}
      </button>
    </div>

    <!-- Mapa -->
    <div ref="mapContainer" class="w-full h-full"></div>

    <!-- Estado de carga -->
    <div v-if="loading"
         class="absolute inset-0 bg-white bg-opacity-75 flex items-center justify-center">
      <span class="text-gray-600">Cargando mapa...</span>
    </div>

    <!-- Estado de error -->
    <div v-if="error"
         class="absolute inset-0 bg-red-50 flex items-center justify-center">
      <div class="text-center">
        <span class="text-red-600">Error al cargar el mapa</span>
        <button @click="initializeMap" class="block mt-2 text-blue-600 underline">Reintentar</button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { onMounted, ref, watch, onUnmounted } from 'vue'
import type { FirebaseUser, FirebaseUbicacion } from '@/firebase'
import { subscribeToLatestUbicaciones } from '@/firebase'

const props = defineProps<{
  users: FirebaseUser[]
  loading: boolean
}>()

const mapContainer = ref<HTMLElement | null>(null)
const map = ref<any>(null)
const error = ref(false)
const trackingUsers = ref(true)
const userLocation = ref<{ lat: number; lng: number } | null>(null)
const ubicaciones = ref<FirebaseUbicacion[]>([])

let unsubscribeUbicaciones: (() => void) | null = null

onMounted(() => {
  initializeMap()
  getCurrentLocation()

  unsubscribeUbicaciones = subscribeToLatestUbicaciones((data) => {
    ubicaciones.value = data
    if (map.value && map.value.loaded() && trackingUsers.value) {
      addMarkersToMap()
    }
  })
})

onUnmounted(() => {
  if (unsubscribeUbicaciones) unsubscribeUbicaciones()
})

watch(() => ubicaciones.value, () => {
  if (map.value && map.value.loaded() && trackingUsers.value) {
    addMarkersToMap()
  }
}, { deep: true })

watch(() => props.users, () => {
  if (map.value && map.value.loaded() && trackingUsers.value) {
    addMarkersToMap()
  }
}, { deep: true })

async function initializeMap() {
  if (!mapContainer.value) return

  try {
    error.value = false
    const mapboxgl = await import('mapbox-gl')

    mapboxgl.default.accessToken = 'pk.eyJ1IjoiYW50b255MjcwNCIsImEiOiJjbWQweGg4d2IxOGdnMmtwemp3Nnp0YmIxIn0.-Hm3lVWw6U-NE10a0u2U2A'

    map.value = new mapboxgl.default.Map({
      container: mapContainer.value,
      style: 'mapbox://styles/mapbox/streets-v12',
      center: [-97.9691, 19.3867],
      zoom: 12
    })

    map.value.on('load', () => {
      if (trackingUsers.value) {
        addMarkersToMap()
      }
    })

    map.value.on('error', () => {
      error.value = true
    })

  } catch (err) {
    console.error('Error al inicializar el mapa:', err)
    error.value = true
  }
}

function getCurrentLocation() {
  if (navigator.geolocation) {
    navigator.geolocation.getCurrentPosition(
      (position) => {
        userLocation.value = {
          lat: position.coords.latitude,
          lng: position.coords.longitude
        }
      },
      (error) => {
        console.error('Error obteniendo ubicación:', error)
      }
    )
  }
}

function centerOnMyLocation() {
  if (userLocation.value && map.value) {
    map.value.flyTo({
      center: [userLocation.value.lng, userLocation.value.lat],
      zoom: 15
    })
  } else {
    getCurrentLocation()
  }
}

function toggleUserTracking() {
  trackingUsers.value = !trackingUsers.value
  if (trackingUsers.value && map.value && map.value.loaded()) {
    addMarkersToMap()
  } else {
    clearMarkers()
  }
}

function addMarkersToMap() {
  if (!map.value) return
  clearMarkers()

  ubicaciones.value.forEach((ubicacion) => {
    if (!ubicacion.coordinates) return

    const user = props.users.find(u => u.email === ubicacion.userEmail)
    if (!user) return

    const el = document.createElement('div')
    el.className = 'user-marker'
    el.style.cssText = `
      width: 35px;
      height: 35px;
      border-radius: 50%;
      background-color: #10b981;
      color: white;
      display: flex;
      align-items: center;
      justify-content: center;
      font-weight: bold;
      font-size: 14px;
      border: 3px solid white;
      box-shadow: 0 2px 8px rgba(0,0,0,0.3);
    `
    el.textContent = user.name.charAt(0).toUpperCase()
    el.title = `${user.name}\n${user.email}\n${user.phone}`

    el.addEventListener('click', () => {
      alert(`Usuario: ${user.name}\nEmail: ${user.email}\nTel: ${user.phone}`)
    })

    import('mapbox-gl').then(mapboxgl => {
      new mapboxgl.default.Marker(el)
        .setLngLat(ubicacion.coordinates)
        .addTo(map.value)
    })
  })
}

function clearMarkers() {
  const existingMarkers = document.querySelectorAll('.user-marker')
  existingMarkers.forEach(marker => {
    const parent = marker.parentElement
    if (parent) parent.remove()
  })
}
</script>

<style scoped>
.user-marker {
  cursor: pointer;
}
:deep(.mapboxgl-map) {
  border-radius: 8px;
}
:deep(.mapboxgl-ctrl-bottom-left),
:deep(.mapboxgl-ctrl-bottom-right) {
  display: none;
}
</style>
