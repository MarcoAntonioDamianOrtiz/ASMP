<script setup lang="ts">
import { ref, onMounted, onUnmounted, watch, computed } from 'vue'
import { 
  subscribeToGroupLocations, 
  subscribeToMyLocation,
  deleteUserGroup,
  type FirebaseUbicacion,
  type FirebaseGroup 
} from '@/firebase'
import { useUserStore } from '@/stores/user'

// ✅ AGREGAR PROPS PARA RECIBIR DATOS DESDE EL PADRE
const props = defineProps<{
  loading: boolean
  selectedGroup: FirebaseGroup | null  // ✅ NUEVO
  userGroups: FirebaseGroup[]          // ✅ NUEVO
}>()

const userStore = useUserStore()
const mapContainer = ref<HTMLElement>()
const map = ref<any>(null)
const myLocation = ref<FirebaseUbicacion | null>(null)
const groupLocations = ref<FirebaseUbicacion[]>([])
const markers = ref<Map<string, any>>(new Map())
const showDeleteModal = ref(false)
const groupToDelete = ref<FirebaseGroup | null>(null)
const deleting = ref(false)

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
  const locations: FirebaseUbicacion[] = []
  
  // Siempre mostrar mi ubicación
  if (myLocation.value) {
    locations.push(myLocation.value)
  }
  
  // ✅ USAR EL PROP SELECTED_GROUP EN LUGAR DE CURRENTGROUP
  // Si tengo un grupo seleccionado, mostrar ubicaciones del grupo
  if (props.selectedGroup) {
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
  if (!map.value) {
    console.log('Mapa no disponible para actualizar marcadores')
    return
  }

  console.log('Actualizando marcadores con ubicaciones:', relevantLocations.value)

  // Limpiar marcadores existentes
  markers.value.forEach(marker => {
    try {
      marker.remove()
    } catch (e) {
      console.warn('Error removiendo marcador:', e)
    }
  })
  markers.value.clear()

  // Verificar que tenemos ubicaciones
  if (relevantLocations.value.length === 0) {
    console.log('No hay ubicaciones para mostrar')
    return
  }

  // Agregar marcadores de ubicaciones relevantes
  relevantLocations.value.forEach(location => {
    if (!location.lat || !location.lng) {
      console.warn('Ubicación sin coordenadas:', location)
      return
    }

    console.log('Creando marcador para:', location.userName, 'en:', location.lat, location.lng)

    const isMyLocation = location.userId === userStore.user?.uid
    const color = isMyLocation ? '#ef4444' : getUserColor(location.userName)
      
    // Crear elemento del marcador
    const el = document.createElement('div')
    el.className = isMyLocation ? 'my-location-marker' : 'group-member-marker'
    el.style.cssText = `
      background-color: ${color};
      width: ${isMyLocation ? '40px' : '32px'};
      height: ${isMyLocation ? '40px' : '32px'};
      border-radius: 50%;
      border: 4px solid white;
      box-shadow: 0 4px 12px rgba(0,0,0,0.3);
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      color: white;
      font-weight: bold;
      font-size: ${isMyLocation ? '16px' : '14px'};
      position: relative;
      ${isMyLocation ? 'animation: pulseMarker 2s infinite;' : ''}
    `
    
    el.innerHTML = isMyLocation 
      ? '<div style="font-size: 20px;">📍</div>' 
      : `<div>${location.userName.charAt(0).toUpperCase()}</div>`
      
    // Agregar animación CSS si no existe
    if (isMyLocation && !document.querySelector('#pulse-marker-animation')) {
      const style = document.createElement('style')
      style.id = 'pulse-marker-animation'
      style.textContent = `
        @keyframes pulseMarker {
          0% { transform: scale(1); box-shadow: 0 4px 12px rgba(239, 68, 68, 0.5); }
          50% { transform: scale(1.15); box-shadow: 0 6px 20px rgba(239, 68, 68, 0.7); }
          100% { transform: scale(1); box-shadow: 0 4px 12px rgba(239, 68, 68, 0.5); }
        }
      `
      document.head.appendChild(style)
    }
      
    // Crear popup
    const popup = new (window as any).mapboxgl.Popup({ 
      offset: [0, -40],
      closeButton: false,
      closeOnClick: false
    }).setHTML(`
      <div class="p-4 min-w-[200px]">
        <div class="flex items-center mb-2">
          <div class="w-3 h-3 rounded-full mr-2" style="background-color: ${color}"></div>
          <h3 class="font-bold text-gray-800">
            ${isMyLocation ? '📍 Mi Ubicación' : location.userName}
          </h3>
        </div>
        <p class="text-sm text-gray-600 mb-2">${location.userEmail}</p>
        <div class="flex items-center text-xs mb-1">
          <span class="inline-block w-2 h-2 rounded-full mr-2" style="background-color: ${location.isOnline ? '#10b981' : '#6b7280'}"></span>
          <span class="${location.isOnline ? 'text-green-600' : 'text-gray-500'}">
            ${location.isOnline ? '🟢 En línea' : '⚫ Desconectado'}
          </span>
        </div>
        <p class="text-xs text-gray-400">
          📅 ${new Date(location.timestamp?.toDate ? location.timestamp.toDate() : location.timestamp).toLocaleString()}
        </p>
        ${location.accuracy ? `<p class="text-xs text-gray-400 mt-1">🎯 Precisión: ${Math.round(location.accuracy)}m</p>` : ''}
        <div class="mt-2 pt-2 border-t border-gray-200">
          <p class="text-xs text-gray-500">
            📍 ${location.lat.toFixed(6)}, ${location.lng.toFixed(6)}
          </p>
        </div>
      </div>
    `)

    try {
      // Crear y agregar marcador
      const marker = new (window as any).mapboxgl.Marker(el)
        .setLngLat([location.lng, location.lat])
        .setPopup(popup)
        .addTo(map.value)

      // Mostrar popup al hover
      el.addEventListener('mouseenter', () => {
        marker.togglePopup()
      })

      markers.value.set(location.userId, marker)
      
      console.log('Marcador creado exitosamente para:', location.userName)
    } catch (error) {
      console.error('Error creando marcador:', error)
    }
  })

  // Ajustar vista del mapa para mostrar todos los marcadores
  if (relevantLocations.value.length > 0) {
    const bounds = new (window as any).mapboxgl.LngLatBounds()
    relevantLocations.value.forEach(location => {
      if (location.lat && location.lng) {
        bounds.extend([location.lng, location.lat])
      }
    })
    
    if (!bounds.isEmpty()) {
      map.value.fitBounds(bounds, {
        padding: 50,
        maxZoom: 16
      })
    }
  }
}

// Confirmar eliminación de grupo
const confirmDeleteGroup = (group: FirebaseGroup) => {
  if (group.createdBy !== userStore.user?.email) {
    alert('Solo el creador del grupo puede eliminarlo')
    return
  }
  groupToDelete.value = group
  showDeleteModal.value = true
}

// Eliminar grupo
const deleteGroup = async () => {
  if (!groupToDelete.value || !userStore.user?.email) return
  
  deleting.value = true
  
  try {
    await deleteUserGroup(groupToDelete.value.id, userStore.user.email)
    showDeleteModal.value = false
    groupToDelete.value = null
  } catch (error: any) {
    alert(error.message || 'Error al eliminar el grupo')
  } finally {
    deleting.value = false
  }
}

// Inicializar mapa
const initMap = () => {
  if (!mapContainer.value) return;

  if (!(window as any).mapboxgl) {
    // Cargar CSS primero
    const link = document.createElement('link')
    link.href = 'https://api.mapbox.com/mapbox-gl-js/v2.15.0/mapbox-gl.css'
    link.rel = 'stylesheet'
    document.head.appendChild(link)
    
    // Luego cargar el script
    const script = document.createElement('script')
    script.src = 'https://api.mapbox.com/mapbox-gl-js/v2.15.0/mapbox-gl.js'
    script.onload = () => {
      // Verificar que tanto el script como CSS estén listos
      const checkReady = () => {
        if ((window as any).mapboxgl && document.styleSheets.length > 0) {
          createMap()
        } else {
          setTimeout(checkReady, 50)
        }
      }
      checkReady()
    }
    document.head.appendChild(script)
  } else {
    createMap()
  }
}

const createMap = () => {
  if (!(window as any).mapboxgl || !mapContainer.value) return

  ;(window as any).mapboxgl.accessToken = MAPBOX_TOKEN

  map.value = new (window as any).mapboxgl.Map({
    container: mapContainer.value,
    style: 'mapbox://styles/mapbox/streets-v12',
    center: [-97.9691, 19.3867],
    zoom: 14
  })

  map.value.addControl(new (window as any).mapboxgl.NavigationControl())
  map.value.addControl(
    new (window as any).mapboxgl.GeolocateControl({
      positionOptions: { enableHighAccuracy: true },
      trackUserLocation: true,
      showUserHeading: true
    })
  )

  map.value.on('load', () => {
    console.log('Mapa cargado, actualizando marcadores...')
    updateMarkers()
  })
}

let unsubscribeMyLocation: (() => void) | null = null
let unsubscribeGroupLocations: (() => void) | null = null

onMounted(async () => {
  if (!userStore.isAuthenticated || !userStore.user) return
  
  initMap()

  console.log('Iniciando suscripciones para usuario:', userStore.user.uid)

  // Suscribirse a mi ubicación
  unsubscribeMyLocation = subscribeToMyLocation(userStore.user.uid, (location) => {
    console.log('Mi ubicación actualizada:', location)
    myLocation.value = location
  })
})

onUnmounted(() => {
  if (unsubscribeMyLocation) unsubscribeMyLocation()
  if (unsubscribeGroupLocations) unsubscribeGroupLocations()
  if (map.value) {
    map.value.remove()
  }
})

// ✅ WATCH PARA REACCIONAR CUANDO CAMBIE EL GRUPO SELECCIONADO
watch(() => props.selectedGroup, (newGroup, oldGroup) => {
  console.log('Grupo seleccionado cambió:', newGroup)
  
  // Limpiar suscripción anterior
  if (unsubscribeGroupLocations) {
    unsubscribeGroupLocations()
    unsubscribeGroupLocations = null
  }
  
  // Limpiar ubicaciones del grupo anterior
  groupLocations.value = []
  
  // Si hay un grupo seleccionado, suscribirse a sus ubicaciones
  if (newGroup) {
    console.log('Suscribiéndose a ubicaciones del grupo:', newGroup.id)
    unsubscribeGroupLocations = subscribeToGroupLocations(newGroup.id, (locations) => {
      console.log('Ubicaciones del grupo recibidas:', locations)
      groupLocations.value = locations
    })
  }
}, { immediate: true }) // ✅ immediate: true para ejecutar inmediatamente

// ✅ WATCH PARA ACTUALIZAR MARCADORES CUANDO CAMBIEN LAS UBICACIONES
watch(() => relevantLocations.value, () => {
  console.log('Ubicaciones relevantes cambiaron:', relevantLocations.value)
  updateMarkers()
}, { deep: true })
</script>

<template>
  <div class="flex h-screen bg-gray-100">
    <!-- Panel izquierdo -->
    <div class="w-80 bg-white shadow-lg flex flex-col">
      <!-- Header -->
      <div class="p-4 border-b border-gray-200">
        <h2 class="text-lg font-semibold text-gray-800 flex items-center">
          📍 Ubicaciones en tiempo real
        </h2>
      </div>

      <!-- Información del grupo -->
      <div class="p-4 border-b border-gray-200">
        <div class="flex flex-wrap items-center gap-2 mb-4">
          <!-- ✅ MOSTRAR GRUPOS USANDO LOS PROPS -->
          <button
            v-for="group in userGroups"
            :key="group.id"
            :class="[
              'px-3 py-1.5 rounded-full text-sm font-medium transition-colors flex items-center gap-1',
              selectedGroup && selectedGroup.id === group.id 
                ? 'bg-green-500 text-white' 
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            ]"
          >
            {{ group.name }}
            <button
              v-if="group.createdBy === userStore.user?.email"
              @click.stop="confirmDeleteGroup(group)"
              class="ml-1 text-red-500 hover:text-red-700 text-xs"
              title="Eliminar grupo"
            >
              ✕
            </button>
          </button>
        </div>
      </div>
       
      <!-- Lista de miembros -->
      <div class="p-4 flex-1">
        <h4 class="font-semibold text-gray-800 mb-3">
          {{ selectedGroup ? `Miembros de ${selectedGroup.name}` : 'Mi ubicación' }}
        </h4>
        
        <!-- Mi ubicación -->
        <div v-if="myLocation" class="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg">
          <div class="flex items-center justify-between">
            <div class="flex items-center">
              <div class="w-3 h-3 bg-red-500 rounded-full mr-3"></div>
              <div>
                <p class="font-medium text-red-800">📍 Mi Ubicación</p>
                <p class="text-sm text-red-600">{{ myLocation.userEmail }}</p>
                <p class="text-xs text-red-500 mt-1">
                  <span class="inline-block w-2 h-2 rounded-full mr-1" :class="myLocation.isOnline ? 'bg-green-500' : 'bg-gray-400'"></span>
                  {{ myLocation.isOnline ? 'En línea' : 'Desconectado' }}
                </p>
              </div>
            </div>
            <div class="text-xs text-red-400">
              {{ new Date(myLocation.timestamp?.toDate ? myLocation.timestamp.toDate() : myLocation.timestamp).toLocaleTimeString() }}
            </div>
          </div>
        </div>

        <!-- Ubicaciones del grupo -->
        <div v-if="selectedGroup && groupLocations.length > 0" class="space-y-3">
          <div 
            v-for="location in groupLocations.filter(loc => loc.userId !== userStore.user?.uid)" 
            :key="location.userId"
            class="p-3 bg-green-50 border border-green-200 rounded-lg"
          >
            <div class="flex items-center justify-between">
              <div class="flex items-center">
                <div class="w-3 h-3 rounded-full mr-3" :style="{ backgroundColor: getUserColor(location.userName) }"></div>
                <div>
                  <p class="font-medium text-green-800">{{ location.userName }}</p>
                  <p class="text-sm text-green-600">{{ location.userEmail }}</p>
                  <p class="text-xs text-green-500 mt-1">
                    <span class="inline-block w-2 h-2 rounded-full mr-1" :class="location.isOnline ? 'bg-green-500' : 'bg-gray-400'"></span>
                    {{ location.isOnline ? 'En línea' : 'Desconectado' }}
                  </p>
                </div>
              </div>
              <div class="text-xs text-green-400">
                {{ new Date(location.timestamp?.toDate ? location.timestamp.toDate() : location.timestamp).toLocaleTimeString() }}
              </div>
            </div>
          </div>
        </div>

        <!-- Sin miembros -->
        <div v-if="selectedGroup && groupLocations.length === 0" class="text-center py-4 text-gray-500">
          <p class="text-sm">No hay ubicaciones de miembros</p>
          <p class="text-xs">Los miembros aparecerán cuando activen su GPS</p>
        </div>

        <!-- Solo mi ubicación -->
        <div v-if="!selectedGroup && !myLocation" class="text-center py-4 text-gray-500">
          <p class="text-sm">Activa tu GPS para ver tu ubicación</p>
        </div>
      </div>
    </div>

    <!-- Mapa principal -->
    <div class="flex-1 relative">
      <div 
        ref="mapContainer" 
        class="w-full h-full"
      ></div>
      
      <!-- Overlay de carga -->
      <div 
        v-if="loading" 
        class="absolute inset-0 bg-white bg-opacity-75 flex items-center justify-center"
      >
        <div class="text-center">
          <div class="animate-spin rounded-full h-8 w-8 border-b-2 border-green-500 mx-auto mb-2"></div>
          <span class="text-gray-600 text-sm">Cargando mapa...</span>
        </div>
      </div>

      <!-- Info panel -->
      <div class="absolute top-4 right-4 bg-white rounded-lg shadow-lg p-4 max-w-xs">
        <h4 class="font-semibold text-gray-800 mb-2">Información</h4>
        <div class="space-y-2 text-sm">
          <div class="flex items-center">
            <div class="w-4 h-4 bg-red-500 rounded-full border-2 border-white shadow mr-2"></div>
            <span class="text-gray-600">Tu ubicación</span>
          </div>
          <div class="flex items-center">
            <div class="w-3 h-3 bg-green-500 rounded-full border-2 border-white shadow mr-2"></div>
            <span class="text-gray-600">Miembros del grupo</span>
          </div>
          <div class="text-xs text-gray-500 mt-2">
            Total ubicaciones: {{ relevantLocations.length }}
          </div>
        </div>
      </div>
    </div>

    <!-- Modal de confirmación para eliminar grupo -->
    <div v-if="showDeleteModal" class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div class="bg-white rounded-lg p-6 w-full max-w-md mx-4">
        <h3 class="text-lg font-semibold text-gray-800 mb-4">
          Eliminar Grupo
        </h3>
        
        <p class="text-gray-600 mb-6">
          ¿Estás seguro de que quieres eliminar el grupo "{{ groupToDelete?.name }}"? 
          Esta acción no se puede deshacer y se removerán todos los miembros.
        </p>
        
        <div class="flex gap-3">
          <button
            @click="deleteGroup"
            :disabled="deleting"
            class="flex-1 px-4 py-2 bg-red-500 hover:bg-red-600 text-white rounded-lg transition-colors disabled:opacity-50"
          >
            {{ deleting ? 'Eliminando...' : 'Eliminar' }}
          </button>
          <button
            @click="showDeleteModal = false"
            :disabled="deleting"
            class="flex-1 px-4 py-2 bg-gray-300 hover:bg-gray-400 text-gray-700 rounded-lg transition-colors disabled:opacity-50"
          >
            Cancelar
          </button>
        </div>
      </div>
    </div>
  </div>
</template>