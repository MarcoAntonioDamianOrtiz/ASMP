<script setup lang="ts">
import { ref, onMounted, onUnmounted, watch, computed } from 'vue'
import { 
  subscribeToUserGroups, 
  subscribeToGroupLocations, 
  subscribeToMyLocation,
  getUserGroups,
  type FirebaseUserLocation,
  type FirebaseGroup 
} from '@/firebase'
import { useUserStore } from '@/stores/user'

const props = defineProps<{
  loading: boolean
}>()

const userStore = useUserStore()
const mapContainer = ref<HTMLElement>()
const map = ref<any>(null)
const myLocation = ref<FirebaseUserLocation | null>(null)
const groupLocations = ref<FirebaseUserLocation[]>([])
const userGroups = ref<FirebaseGroup[]>([])
const currentGroup = ref<FirebaseGroup | null>(null)
const markers = ref<Map<string, any>>(new Map())

// Tu token de Mapbox
const MAPBOX_TOKEN = 'pk.eyJ1IjoiYW50b255MjcwNCIsImEiOiJjbWQweGg4d2IxOGdnMmtwemp3Nnp0YmIxIn0.-Hm3lVWw6U-NE10a0u2U2A'

// Función para generar colores consistentes para usuarios
const getUserColor = (name: string): string => {
  const colors = ['#10b981', '#3b82f6', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4', '#f97316']
  const hash = name.split('').reduce((a: number, b: string) => {
    a = ((a << 5) - a) + b.charCodeAt(0)
    return a & a
  }, 0)
  return colors[Math.abs(hash) % colors.length]
}

// Computed para mostrar ubicaciones relevantes
const relevantLocations = computed(() => {
  const locations: FirebaseUserLocation[] = []
  
  // Siempre mostrar mi ubicación
  if (myLocation.value) {
    locations.push(myLocation.value)
  }
  
  // Si tengo un grupo seleccionado, mostrar ubicaciones del grupo
  if (currentGroup.value) {
    groupLocations.value.forEach(loc => {
      // No duplicar mi ubicación
      if (loc.userId !== userStore.user?.uid) {
        locations.push(loc)
      }
    })
  }
  
  return locations
})

// Función para crear o actualizar marcadores
const updateMarkers = () => {
  if (!map.value) return

  // Limpiar marcadores existentes
  markers.value.forEach(marker => marker.remove())
  markers.value.clear()

  // Agregar marcadores de ubicaciones relevantes
  relevantLocations.value.forEach(location => {
    if (location.lat && location.lng) {
      const isMyLocation = location.userId === userStore.user?.uid
      const color = isMyLocation ? '#ef4444' : getUserColor(location.userName)
      
      // Crear elemento del marcador
      const el = document.createElement('div')
      el.className = isMyLocation ? 'my-location-marker' : 'group-member-marker'
      el.style.cssText = `
        background-color: ${color};
        width: ${isMyLocation ? '35px' : '30px'};
        height: ${isMyLocation ? '35px' : '30px'};
        border-radius: 50%;
        border: 3px solid white;
        box-shadow: 0 2px 8px rgba(0,0,0,0.3);
        cursor: pointer;
        display: flex;
        align-items: center;
        justify-content: center;
        color: white;
        font-weight: bold;
        font-size: ${isMyLocation ? '14px' : '12px'};
        ${isMyLocation ? 'animation: pulse 2s infinite;' : ''}
      `
      el.textContent = isMyLocation ? '📍' : location.userName.charAt(0).toUpperCase()
      
      // Agregar animación CSS si no existe
      if (isMyLocation && !document.querySelector('#pulse-animation')) {
        const style = document.createElement('style')
        style.id = 'pulse-animation'
        style.textContent = `
          @keyframes pulse {
            0% { transform: scale(1); opacity: 1; }
            50% { transform: scale(1.1); opacity: 0.8; }
            100% { transform: scale(1); opacity: 1; }
          }
        `
        document.head.appendChild(style)
      }
      
      // Crear popup
      const popup = new window.mapboxgl.Popup({ offset: 25 })
        .setHTML(`
          <div class="p-3">
            <h3 class="font-bold text-gray-800">
              ${isMyLocation ? '📍 Mi Ubicación' : location.userName}
            </h3>
            <p class="text-sm text-gray-600">${location.userEmail}</p>
            <p class="text-xs text-gray-500 mt-1">
              <span class="inline-block w-2 h-2 rounded-full mr-1" style="background-color: ${location.isOnline ? '#10b981' : '#6b7280'}"></span>
              ${location.isOnline ? 'En línea' : 'Desconectado'}
            </p>
            <p class="text-xs text-gray-400 mt-1">
              ${new Date(location.timestamp?.toDate ? location.timestamp.toDate() : location.timestamp).toLocaleString()}
            </p>
            ${location.accuracy ? `<p class="text-xs text-gray-400">Precisión: ${Math.round(location.accuracy)}m</p>` : ''}
          </div>
        `)

      // Crear marcador
      const marker = new window.mapboxgl.Marker(el)
        .setLngLat([location.lng, location.lat])
        .setPopup(popup)
        .addTo(map.value)

      markers.value.set(location.userId, marker)
    }
  })

  // Ajustar vista del mapa para mostrar todos los marcadores
  if (relevantLocations.value.length > 0) {
    const bounds = new window.mapboxgl.LngLatBounds()
    relevantLocations.value.forEach(location => {
      bounds.extend([location.lng, location.lat])
    })
    
    if (relevantLocations.value.length === 1) {
      // Si solo hay un marcador, centrar en él
      map.value.setCenter([relevantLocations.value[0].lng, relevantLocations.value[0].lat])
      map.value.setZoom(16)
    } else {
      // Si hay múltiples marcadores, ajustar para mostrar todos
      map.value.fitBounds(bounds, { padding: 50 })
    }
  }
}

// Cambiar grupo activo
const selectGroup = (group: FirebaseGroup | null) => {
  currentGroup.value = group
  // Limpiar ubicaciones del grupo anterior
  groupLocations.value = []
  
  // Si hay un grupo seleccionado, suscribirse a sus ubicaciones
  if (group) {
    subscribeToGroupLocations(group.id, (locations) => {
      groupLocations.value = locations
    })
  }
}

// Inicializar mapa
const initMap = () => {
  if (!mapContainer.value) return

  // Cargar Mapbox GL JS
  if (!window.mapboxgl) {
    const script = document.createElement('script')
    script.src = 'https://api.mapbox.com/mapbox-gl-js/v2.15.0/mapbox-gl.js'
    script.onload = () => {
      const link = document.createElement('link')
      link.href = 'https://api.mapbox.com/mapbox-gl-js/v2.15.0/mapbox-gl.css'
      link.rel = 'stylesheet'
      document.head.appendChild(link)
      
      setTimeout(createMap, 100)
    }
    document.head.appendChild(script)
  } else {
    createMap()
  }
}

const createMap = () => {
  if (!window.mapboxgl || !mapContainer.value) return

  window.mapboxgl.accessToken = MAPBOX_TOKEN

  map.value = new window.mapboxgl.Map({
    container: mapContainer.value,
    style: 'mapbox://styles/mapbox/streets-v12',
    center: [-97.9691, 19.3867], // Coordenadas de UTT
    zoom: 14
  })

  // Agregar controles de navegación
  map.value.addControl(new window.mapboxgl.NavigationControl())

  // Agregar control de geolocalización
  map.value.addControl(
    new window.mapboxgl.GeolocateControl({
      positionOptions: {
        enableHighAccuracy: true
      },
      trackUserLocation: true,
      showUserHeading: true
    })
  )

  map.value.on('load', () => {
    updateMarkers()
  })
}

let unsubscribeMyLocation: (() => void) | null = null
let unsubscribeUserGroups: (() => void) | null = null
let unsubscribeGroupLocations: (() => void) | null = null

onMounted(async () => {
  if (!userStore.isAuthenticated || !userStore.user) return
  
  initMap()

  // Suscribirse a mi ubicación
  unsubscribeMyLocation = subscribeToMyLocation(userStore.user.uid, (location) => {
    myLocation.value = location
  })

  // Suscribirse a mis grupos
  unsubscribeUserGroups = subscribeToUserGroups(userStore.user.email!, (groups) => {
    userGroups.value = groups
    
    // Si no hay grupo seleccionado y hay grupos disponibles, seleccionar el primero
    if (!currentGroup.value && groups.length > 0) {
      selectGroup(groups[0])
    }
    
    // Si el grupo actual ya no existe, deseleccionar
    if (currentGroup.value && !groups.find(g => g.id === currentGroup.value!.id)) {
      selectGroup(null)
    }
  })
})

onUnmounted(() => {
  if (unsubscribeMyLocation) unsubscribeMyLocation()
  if (unsubscribeUserGroups) unsubscribeUserGroups()
  if (unsubscribeGroupLocations) unsubscribeGroupLocations()
  if (map.value) {
    map.value.remove()
  }
})

watch(() => relevantLocations.value, () => {
  updateMarkers()
}, { deep: true })
</script>

<template>
  <div class="space-y-4">
    <!-- Selector de grupo -->
    <div v-if="userGroups.length > 0" class="bg-white rounded-lg shadow p-4">
      <h4 class="font-semibold text-gray-800 mb-3">Seleccionar Grupo</h4>
      <div class="flex flex-wrap gap-2">
        <button
          @click="selectGroup(null)"
          :class="[
            'px-3 py-2 rounded-lg text-sm font-medium transition-colors',
            !currentGroup 
              ? 'bg-blue-500 text-white' 
              : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
          ]"
        >
          Solo yo
        </button>
        <button
          v-for="group in userGroups"
          :key="group.id"
          @click="selectGroup(group)"
          :class="[
            'px-3 py-2 rounded-lg text-sm font-medium transition-colors',
            currentGroup && currentGroup.id === group.id 
              ? 'bg-green-500 text-white' 
              : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
          ]"
        >
          {{ group.name }} ({{ group.members.length }})
        </button>
      </div>
    </div>

    <!-- Mapa -->
    <div class="relative">
      <div 
        ref="mapContainer" 
        class="w-full h-96 rounded-lg overflow-hidden"
        style="min-height: 500px;"
      ></div>
      
      <!-- Overlay de carga -->
      <div 
        v-if="loading" 
        class="absolute inset-0 bg-white bg-opacity-75 flex items-center justify-center rounded-lg"
      >
        <div class="text-center">
          <div class="animate-spin rounded-full h-8 w-8 border-b-2 border-green-500 mx-auto mb-2"></div>
          <span class="text-gray-600 text-sm">Cargando mapa...</span>
        </div>
      </div>

      <!-- Leyenda -->
      <div class="absolute top-4 right-4 bg-white rounded-lg shadow-lg p-3 text-xs">
        <h4 class="font-semibold mb-2">Leyenda</h4>
        <div class="space-y-1">
          <div class="flex items-center">
            <div class="w-3 h-3 rounded-full bg-red-500 mr-2"></div>
            <span>Mi ubicación</span>
          </div>
          <div v-if="currentGroup" class="flex items-center">
            <div class="w-3 h-3 rounded-full bg-blue-500 mr-2"></div>
            <span>Miembros del grupo</span>
          </div>
        </div>
      </div>

      <!-- Panel de información -->
      <div class="absolute bottom-4 left-4 bg-white rounded-lg shadow-lg p-3 text-xs max-w-xs">
        <div class="space-y-1">
          <div><strong>Mi ubicación:</strong> {{ myLocation ? 'Activa' : 'Inactiva' }}</div>
          <div v-if="currentGroup">
            <strong>Grupo:</strong> {{ currentGroup.name }}
          </div>
          <div v-else>
            <strong>Modo:</strong> Solo mi ubicación
          </div>
          <div><strong>Miembros visibles:</strong> {{ relevantLocations.length }}</div>
          <div class="text-gray-500">
            Actualización: {{ new Date().toLocaleTimeString() }}
          </div>
        </div>
      </div>
    </div>

    <!-- Información del grupo actual -->
    <div v-if="currentGroup" class="bg-white rounded-lg shadow p-4">
      <div class="flex items-center justify-between mb-3">
        <h4 class="font-semibold text-gray-800">{{ currentGroup.name }}</h4>
        <span class="text-sm text-gray-500">{{ currentGroup.members.length }} miembros</span>
      </div>
      
      <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
        <!-- Mi información -->
        <div class="border rounded-lg p-3 bg-red-50 border-red-200">
          <div class="flex items-center">
            <div class="w-8 h-8 rounded-full bg-red-500 flex items-center justify-center text-white font-bold text-sm mr-3">
              📍
            </div>
            <div>
              <h5 class="font-medium text-gray-800">Tú</h5>
              <p class="text-xs text-gray-600">{{ userStore.user?.email }}</p>
              <p class="text-xs" :class="myLocation?.isOnline ? 'text-green-600' : 'text-gray-500'">
                {{ myLocation?.isOnline ? 'En línea' : 'Desconectado' }}
              </p>
            </div>
          </div>
        </div>

        <!-- Miembros del grupo -->
        <div 
          v-for="location in groupLocations.filter(loc => loc.userId !== userStore.user?.uid)"
          :key="location.userId"
          class="border rounded-lg p-3 bg-gray-50"
        >
          <div class="flex items-center">
            <div 
              class="w-8 h-8 rounded-full flex items-center justify-center text-white font-bold text-sm mr-3"
              :style="{ backgroundColor: getUserColor(location.userName) }"
            >
              {{ location.userName.charAt(0).toUpperCase() }}
            </div>
            <div>
              <h5 class="font-medium text-gray-800">{{ location.userName }}</h5>
              <p class="text-xs text-gray-600">{{ location.userEmail }}</p>
              <p class="text-xs" :class="location.isOnline ? 'text-green-600' : 'text-gray-500'">
                {{ location.isOnline ? 'En línea' : 'Desconectado' }}
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Mensaje cuando no hay grupos -->
    <div v-else-if="userGroups.length === 0" class="bg-yellow-50 border border-yellow-200 rounded-lg p-4 text-center">
      <div class="text-yellow-800">
        <svg class="w-8 h-8 mx-auto mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197m13.5-9a2.5 2.5 0 11-5 0 2.5 2.5 0 015 0z"></path>
        </svg>
        <h4 class="font-semibold mb-1">No tienes grupos</h4>
        <p class="text-sm">Crea un grupo o únete a uno para ver las ubicaciones de otros miembros.</p>
        <p class="text-sm mt-1">Por ahora solo se muestra tu ubicación.</p>
      </div>
    </div>
  </div>
</template>

