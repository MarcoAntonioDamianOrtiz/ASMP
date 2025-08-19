<script setup lang="ts">
import { ref, onMounted, onUnmounted, watch, computed } from 'vue'
import { 
  subscribeToGroupLocations, 
  subscribeToMyLocation,
  deleteUserGroup,
  activateMemberCircle,     
  deactivateMemberCircle,   
  type FirebaseUbicacion,
  type FirebaseGroup 
} from '@/firebase'
import { useUserStore } from '@/stores/user'

// Props para recibir datos desde el padre
const props = defineProps<{
  loading: boolean
  selectedGroup: FirebaseGroup | null
  userGroups: FirebaseGroup[]
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

const circleActionLoading = ref<string | null>(null)

// VARIABLES PARA ZONAS DE RIESGO
const showZonasRiesgo = ref(false)
const zonasRiesgoLayer = ref<any>(null)
const loadingZonas = ref(false)
const zonasData = ref<any>(null)
const currentPopup = ref<any>(null)

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
  
  // Siempre mostrar mi ubicación si existe
  if (myLocation.value) {
    locations.push(myLocation.value)
  }
  
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

// FUNCIÓN PARA ZONAS DE RIESGO
const toggleZonasRiesgo = async () => {
  if (!map.value) {
    console.log('Mapa no disponible')
    return
  }

  if (showZonasRiesgo.value) {
    hideZonasRiesgo()
  } else {
    await showZonasRiesgoOnMap()
  }
}

const showZonasRiesgoOnMap = async () => {
  if (!map.value) return

  loadingZonas.value = true
  
  try {
    console.log("🗺️ Cargando zonas de riesgo...")
    
    const response = await fetch('/geojson/tlaxcala_zonas.geojson')
    const geoJsonData = await response.json()
    
    console.log("✅ Datos cargados:", geoJsonData.features?.length, "zonas")
    
    zonasData.value = geoJsonData
    
    if (!map.value.getSource('zonas-riesgo')) {
      map.value.addSource('zonas-riesgo', {
        type: 'geojson',
        data: geoJsonData
      })
    }

    if (!map.value.getLayer('zonas-riesgo-fill')) {
      map.value.addLayer({
        id: 'zonas-riesgo-fill',
        type: 'fill',
        source: 'zonas-riesgo',
        paint: {
          'fill-color': [
            'case',
            ['==', ['get', 'riesgo'], 'ALTO'], '#ef4444',
            ['==', ['get', 'riesgo'], 'MEDIO'], '#f59e0b',
            ['==', ['get', 'riesgo'], 'BAJO'], '#10b981',
            ['!=', ['get', 'total_delitos'], null], [
              'interpolate',
              ['linear'],
              ['get', 'total_delitos'],
              0, '#10b981',
              10, '#f59e0b',
              50, '#ef4444'
            ],
            '#8b5cf6'
          ],
          'fill-opacity': 0.4
        }
      })
    }

    if (!map.value.getLayer('zonas-riesgo-line')) {
      map.value.addLayer({
        id: 'zonas-riesgo-line',
        type: 'line',
        source: 'zonas-riesgo',
        paint: {
          'line-color': [
            'case',
            ['==', ['get', 'riesgo'], 'ALTO'], '#dc2626',
            ['==', ['get', 'riesgo'], 'MEDIO'], '#d97706',
            ['==', ['get', 'riesgo'], 'BAJO'], '#059669',
            ['!=', ['get', 'total_delitos'], null], '#7c3aed',
            '#4b5563'
          ],
          'line-width': 2,
          'line-opacity': 0.9
        }
      })
    }

    map.value.on('click', 'zonas-riesgo-fill', (e: any) => {
      const properties = e.features[0].properties
      
      if (currentPopup.value) {
        currentPopup.value.remove()
        currentPopup.value = null
      }
      
      let colorZona = '#8b5cf6'
      let nivelRiesgo = 'Sin clasificar'
      
      if (properties.riesgo) {
        switch(properties.riesgo) {
          case 'ALTO':
            colorZona = '#ef4444'
            nivelRiesgo = 'ALTO'
            break
          case 'MEDIO':
            colorZona = '#f59e0b'
            nivelRiesgo = 'MEDIO'
            break
          case 'BAJO':
            colorZona = '#10b981'
            nivelRiesgo = 'BAJO'
            break
        }
      } else if (properties.total_delitos !== null) {
        const delitos = parseInt(properties.total_delitos)
        if (delitos >= 50) {
          colorZona = '#ef4444'
          nivelRiesgo = `ALTO (${delitos} delitos)`
        } else if (delitos >= 10) {
          colorZona = '#f59e0b' 
          nivelRiesgo = `MEDIO (${delitos} delitos)`
        } else {
          colorZona = '#10b981'
          nivelRiesgo = `BAJO (${delitos} delitos)`
        }
      }
      
      currentPopup.value = new (window as any).mapboxgl.Popup({
        offset: [0, -10],
        closeButton: true,
        closeOnClick: false,
        maxWidth: '320px',
        className: 'zona-riesgo-popup'
      })
        .setLngLat(e.lngLat)
        .setHTML(`
          <div class="p-3 max-w-[300px]">
            <h3 class="font-bold text-gray-800 mb-2 text-sm flex items-center">
              🏘️ ${properties.NOMLOC || 'Sin nombre'}
            </h3>
            
            <div class="grid grid-cols-2 gap-2 text-xs mb-3">
              <div class="bg-gray-50 p-2 rounded">
                <div class="text-gray-600 mb-1">Riesgo</div>
                <div class="flex items-center">
                  <span class="inline-block w-2 h-2 rounded-full mr-1" style="background-color: ${colorZona}"></span>
                  <span class="font-medium text-gray-800">${nivelRiesgo.replace(/\s*\(\d+\s*delitos\)/, '')}</span>
                </div>
              </div>
              
              ${properties.total_delitos !== null ? 
                `<div class="bg-red-50 p-2 rounded">
                  <div class="text-gray-600 mb-1">Delitos</div>
                  <div class="font-medium text-red-700">${properties.total_delitos}</div>
                </div>` : 
                `<div class="bg-gray-50 p-2 rounded">
                  <div class="text-gray-600 mb-1">Delitos</div>
                  <div class="text-gray-500">Sin datos</div>
                </div>`
              }
            </div>
            
            <div class="space-y-1 text-xs border-t pt-2">
              <div class="flex justify-between">
                <span class="text-gray-600">Tipo:</span>
                <span class="text-gray-800">${
                  properties.TIPO === 'R' ? '🌾 Rural' : 
                  properties.TIPO === 'U' ? '🏢 Urbano' : 
                  '❓ No definido'
                }</span>
              </div>
              
              <div class="flex justify-between">
                <span class="text-gray-600">Estado:</span>
                <span class="text-gray-800">${
                  properties.CONDICION === 'H' ? '✅ Habitada' :
                  properties.CONDICION === 'D' ? '❌ Deshabitada' :
                  '❓ No definido'
                }</span>
              </div>
              
              ${properties.CVE_ENT && properties.CVE_MUN ? 
                `<div class="flex justify-between">
                  <span class="text-gray-600">Código:</span>
                  <span class="text-gray-500 font-mono">${properties.CVE_ENT}-${properties.CVE_MUN}-${properties.CVE_LOC || '000'}</span>
                </div>` : 
                ''
              }
            </div>
          </div>
        `)
        .addTo(map.value)

      currentPopup.value.on('close', () => {
        currentPopup.value = null
      })
    })

    map.value.on('mouseenter', 'zonas-riesgo-fill', () => {
      map.value.getCanvas().style.cursor = 'pointer'
    })

    map.value.on('mouseleave', 'zonas-riesgo-fill', () => {
      map.value.getCanvas().style.cursor = ''
    })

    showZonasRiesgo.value = true
    console.log("✅ Zonas de riesgo mostradas en el mapa")
    
  } catch (error) {
    console.error("❌ Error cargando zonas de riesgo:", error)
    alert("Error al cargar las zonas de riesgo: " + error.message)
  } finally {
    loadingZonas.value = false
  }
}

const hideZonasRiesgo = () => {
  if (!map.value) return

  try {
    if (currentPopup.value) {
      currentPopup.value.remove()
      currentPopup.value = null
    }
    
    if (map.value.getLayer('zonas-riesgo-fill')) {
      map.value.removeLayer('zonas-riesgo-fill')
    }
    if (map.value.getLayer('zonas-riesgo-line')) {
      map.value.removeLayer('zonas-riesgo-line')
    }
    
    if (map.value.getSource('zonas-riesgo')) {
      map.value.removeSource('zonas-riesgo')
    }
    
    showZonasRiesgo.value = false
    console.log("🙈 Zonas de riesgo ocultadas")
    
  } catch (error) {
    console.error("❌ Error ocultando zonas:", error)
  }
}

// FUNCIÓN para actualizar marcadores
const updateMarkers = () => {
  if (!map.value) {
    console.log('Mapa no disponible para actualizar marcadores')
    return
  }

  console.log('🗺️ Actualizando marcadores. Ubicaciones:', relevantLocations.value.length)

  // Limpiar marcadores existentes
  markers.value.forEach((marker, key) => {
    try {
      marker.remove()
      console.log('🧹 Marcador removido:', key)
    } catch (e) {
      console.warn('⚠️ Error removiendo marcador:', e)
    }
  })
  markers.value.clear()

  if (relevantLocations.value.length === 0) {
    console.log('❌ No hay ubicaciones para mostrar')
    return
  }

  // Agregar marcadores de ubicaciones relevantes
  relevantLocations.value.forEach(location => {
    if (!location.lat || !location.lng) {
      console.warn('⚠️ Ubicación sin coordenadas:', location)
      return
    }

    const isMyLocation = location.userId === userStore.user?.uid
    if (!isMyLocation && !location.isOnline) {
      console.log('⚫ Saltando ubicación offline:', location.userName)
      return
    }

    console.log('📍 Creando marcador para:', location.userName, 'Online:', location.isOnline)

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
      ${!location.isOnline && !isMyLocation ? 'opacity: 0.5;' : ''}
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
      
      console.log('✅ Marcador creado exitosamente para:', location.userName)
    } catch (error) {
      console.error('❌ Error creando marcador:', error)
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
    console.log('🗺️ Mapa cargado, actualizando marcadores...')
    updateMarkers()
  })
}

// Funciones para gestión de miembros
const getMemberLocationStatus = (memberEmail: string) => {
  const memberLocation = groupLocations.value.find(loc => loc.userEmail === memberEmail)
  
  return {
    hasLocation: !!memberLocation,
    isOnline: memberLocation?.isOnline || false,
    lastUpdate: memberLocation?.timestamp || null
  }
}

const getMemberLocationDetails = (memberEmail: string) => {
  return groupLocations.value.find(loc => loc.userEmail === memberEmail)
}

const getMemberName = (memberEmail: string) => {
  const memberLocation = groupLocations.value.find(loc => loc.userEmail === memberEmail)
  if (memberLocation) {
    return memberLocation.userName
  }
  return memberEmail.split('@')[0]
}

// Función mejorada para formatear tiempo con mejor UI
const formatTime = (timestamp: any) => {
  if (!timestamp) return 'Nunca'
  
  const date = timestamp?.toDate ? timestamp.toDate() : new Date(timestamp)
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffMinutes = Math.floor(diffMs / (1000 * 60))
  
  if (diffMinutes < 1) return 'Ahora mismo'
  if (diffMinutes < 60) return `${diffMinutes}min`
  if (diffMinutes < 1440) return `${Math.floor(diffMinutes / 60)}h`
  return date.toLocaleDateString('es-ES', { day: '2-digit', month: 'short' })
}

// Función mejorada para obtener nombre truncado
const getTruncatedName = (email: string, maxLength: number = 10): string => {
  const memberLocation = groupLocations.value.find(loc => loc.userEmail === email)
  let name = memberLocation ? memberLocation.userName : email.split('@')[0]
  
  if (name.length > maxLength) {
    return name.substring(0, maxLength) + '...'
  }
  return name
}

// Función para obtener iniciales
const getInitials = (email: string): string => {
  const memberLocation = groupLocations.value.find(loc => loc.userEmail === email)
  const name = memberLocation ? memberLocation.userName : email.split('@')[0]
  
  const words = name.split(' ')
  if (words.length >= 2) {
    return words[0].charAt(0).toUpperCase() + words[1].charAt(0).toUpperCase()
  }
  return name.charAt(0).toUpperCase()
}

const toggleMemberCircle = async (memberEmail: string) => {
  const status = getMemberLocationStatus(memberEmail)
  circleActionLoading.value = memberEmail
  
  try {
    if (status.isOnline) {
      console.log('🚫 Desactivando círculo para:', memberEmail)
      await deactivateMemberCircle(memberEmail)
    } else {
      console.log('🎯 Activando círculo para:', memberEmail)
      await activateMemberCircle(memberEmail)
    }
    
    setTimeout(() => {
      refreshGroupLocations()
    }, 1500)
    
  } catch (error) {
    console.error('❌ Error toggling circle:', error)
    alert('Error al cambiar estado del círculo: ' + error.message)
  } finally {
    setTimeout(() => {
      circleActionLoading.value = null
    }, 2000)
  }
}

const refreshGroupLocations = () => {
  if (props.selectedGroup) {
    console.log('🔄 Refrescando ubicaciones manualmente para grupo:', props.selectedGroup.name)
    
    groupLocations.value = []
    
    if (unsubscribeGroupLocations) {
      console.log('🧹 Limpiando suscripción anterior')
      unsubscribeGroupLocations()
      unsubscribeGroupLocations = null
    }
    
    setTimeout(() => {
      console.log('🔄 Creando nueva suscripción')
      unsubscribeGroupLocations = subscribeToGroupLocations(props.selectedGroup!.id, (locations) => {
        console.log('📡 Ubicaciones actualizadas:', locations.length)
        groupLocations.value = locations
      })
    }, 1000)
  }
}

let unsubscribeMyLocation: (() => void) | null = null
let unsubscribeGroupLocations: (() => void) | null = null

onMounted(async () => {
  if (!userStore.isAuthenticated || !userStore.user) return
  
  initMap()

  console.log('🚀 Iniciando suscripciones para usuario:', userStore.user.uid)

  // Suscribirse a mi ubicación
  unsubscribeMyLocation = subscribeToMyLocation(userStore.user.uid, (location) => {
    console.log('📍 Mi ubicación actualizada:', location)
    myLocation.value = location
  })
})

onUnmounted(() => {
  console.log('🧹 Limpiando componente MapPanel')
  if (unsubscribeMyLocation) unsubscribeMyLocation()
  if (unsubscribeGroupLocations) unsubscribeGroupLocations()
  if (map.value) {
    map.value.remove()
  }
})

watch(() => props.selectedGroup, (newGroup, oldGroup) => {
  console.log('🔄 Grupo seleccionado cambió de', oldGroup?.name, 'a', newGroup?.name)
  
  if (unsubscribeGroupLocations) {
    console.log('🧹 Limpiando suscripción del grupo anterior')
    unsubscribeGroupLocations()
    unsubscribeGroupLocations = null
  }
  
  groupLocations.value = []
  
  if (newGroup) {
    console.log('📡 Suscribiéndose a ubicaciones del nuevo grupo:', newGroup.id)
    setTimeout(() => {
      unsubscribeGroupLocations = subscribeToGroupLocations(newGroup.id, (locations) => {
        console.log('📍 Ubicaciones del grupo recibidas:', locations.length)
        groupLocations.value = locations
      })
    }, 500)
  }
}, { immediate: true })

watch(() => relevantLocations.value, (newLocations, oldLocations) => {
  console.log('🗺️ Ubicaciones relevantes cambiaron:', newLocations.length)
  console.log('📊 Detalles:', newLocations.map(l => ({ name: l.userName, online: l.isOnline })))
  updateMarkers()
}, { deep: true })
</script>

<template>
  <div class="flex h-screen bg-gray-100">
    <!-- Panel izquierdo MEJORADO -->
    <div class="w-80 bg-white shadow-lg flex flex-col">
      <!-- Header -->
      <div class="p-4 border-b border-gray-200 bg-gradient-to-r from-blue-50 to-indigo-50">
        <h2 class="text-lg font-semibold text-gray-800 flex items-center">
          📍 Ubicaciones en tiempo real
        </h2>
        <p class="text-xs text-gray-600 mt-1">Monitoreo de familia y grupos</p>
      </div>

      <!-- Información del grupo seleccionado -->
      <div class="p-4 border-b border-gray-200 bg-gray-50">
        <div class="flex flex-wrap items-center gap-2 mb-3">
          <button
            v-for="group in userGroups"
            :key="group.id"
            :class="[
              'px-3 py-1.5 rounded-full text-xs font-medium transition-colors flex items-center gap-1 max-w-[120px]',
              selectedGroup && selectedGroup.id === group.id 
                ? 'bg-blue-500 text-white shadow-sm' 
                : 'bg-white text-gray-700 hover:bg-gray-100 border border-gray-200'
            ]"
          >
            <span class="truncate">{{ group.name }}</span>
            <button
              v-if="group.createdBy === userStore.user?.email"
              @click.stop="confirmDeleteGroup(group)"
              class="ml-1 text-red-400 hover:text-red-600 text-xs flex-shrink-0"
              title="Eliminar grupo"
            >
              ✕
            </button>
          </button>
        </div>
        
        <!-- Estadísticas rápidas -->
        <div v-if="selectedGroup" class="grid grid-cols-3 gap-2 text-xs">
          <div class="bg-white p-2 rounded-lg text-center border">
            <div class="font-semibold text-blue-600">{{ selectedGroup.members.length }}</div>
            <div class="text-gray-500">Miembros</div>
          </div>
          <div class="bg-white p-2 rounded-lg text-center border">
            <div class="font-semibold text-green-600">{{ groupLocations.filter(l => l.isOnline).length }}</div>
            <div class="text-gray-500">En línea</div>
          </div>
          <div class="bg-white p-2 rounded-lg text-center border">
            <div class="font-semibold text-orange-600">{{ groupLocations.filter(l => !l.isOnline).length }}</div>
            <div class="text-gray-500">Offline</div>
          </div>
        </div>
      </div>
      
      <!-- Lista de miembros COMPLETAMENTE REDISEÑADA -->
      <div class="flex-1 flex flex-col" style="min-height: 0;">
        <div class="px-4 py-2 flex-shrink-0">
          <h4 class="font-semibold text-gray-800 mb-2 flex items-center justify-between">
            <span class="text-sm">{{ selectedGroup ? `Miembros de ${selectedGroup.name}` : 'Mi ubicación' }}</span>
            <button 
              v-if="selectedGroup"
              @click="refreshGroupLocations"
              class="text-blue-500 hover:text-blue-700 text-xs p-1 rounded hover:bg-blue-50"
              title="Refrescar ubicaciones"
            >
              <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"></path>
              </svg>
            </button>
          </h4>
        </div>

        <!-- Mi ubicación - siempre arriba -->
        <div v-if="myLocation" class="px-4 mb-3 flex-shrink-0">
          <div class="bg-gradient-to-r from-red-50 to-pink-50 border border-red-200 rounded-lg p-3">
            <div class="flex items-center">
              <div class="w-10 h-10 bg-red-500 rounded-full flex items-center justify-center text-white font-bold text-sm mr-3 shadow-sm flex-shrink-0">
                <span>📍</span>
              </div>
              <div class="flex-1 min-w-0">
                <div class="flex items-center gap-2 mb-1">
                  <h5 class="font-medium text-red-800 text-sm">Mi Ubicación</h5>
                  <div class="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                </div>
                <p class="text-xs text-red-600 truncate">{{ myLocation.userEmail }}</p>
                <p class="text-xs text-red-500 mt-1 flex items-center">
                  <svg class="w-3 h-3 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"></path>
                  </svg>
                  {{ formatTime(myLocation.timestamp) }}
                </p>
              </div>
            </div>
          </div>
        </div>

        <!-- Lista scrolleable de miembros del grupo CON ALTURA FIJA Y PADDING EXTRA -->
        <div class="flex-1 overflow-y-auto px-4" style="max-height: calc(100vh - 280px); min-height: 280px;">
          <div v-if="selectedGroup" class="space-y-2 pb-16">
            <div 
              v-for="memberEmail in selectedGroup.members.filter(email => email !== userStore.user?.email)" 
              :key="memberEmail"
              class="rounded-lg transition-all duration-200 border"
              :class="getMemberLocationStatus(memberEmail).isOnline ? 
                'bg-gradient-to-r from-green-50 to-emerald-50 border-green-200 hover:shadow-sm' : 
                'bg-gray-50 border-gray-200 hover:bg-gray-100'"
            >
              <!-- Header del miembro -->
              <div class="p-3">
                <div class="flex items-center">
                  <!-- Avatar con iniciales -->
                  <div 
                    class="w-10 h-10 rounded-full flex items-center justify-center text-white font-bold text-sm mr-3 shadow-sm flex-shrink-0" 
                    :class="getMemberLocationStatus(memberEmail).isOnline ? 'bg-green-500' : 'bg-gray-400'"
                  >
                    {{ getInitials(memberEmail) }}
                  </div>
                  
                  <!-- Información del miembro -->
                  <div class="flex-1 min-w-0">
                    <div class="flex items-center gap-2 mb-1">
                      <h5 class="font-medium text-gray-800 text-sm truncate" :title="getMemberName(memberEmail)">
                        {{ getTruncatedName(memberEmail, 12) }}
                      </h5>
                      <div 
                        class="w-2 h-2 rounded-full flex-shrink-0" 
                        :class="getMemberLocationStatus(memberEmail).isOnline ? 'bg-green-500 animate-pulse' : 'bg-gray-400'"
                      ></div>
                    </div>
                    <p class="text-xs text-gray-500 truncate" :title="memberEmail">{{ memberEmail.split('@')[0] }}@...</p>
                    
                    <!-- Estado y última actividad -->
                    <div class="flex items-center justify-between mt-2">
                      <div class="flex items-center text-xs">
                        <svg class="w-3 h-3 mr-1 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"></path>
                        </svg>
                        <span :class="getMemberLocationStatus(memberEmail).isOnline ? 'text-green-600' : 'text-gray-500'">
                          {{ formatTime(getMemberLocationStatus(memberEmail).lastUpdate) }}
                        </span>
                      </div>
                      
                      <!-- Botón de acción compacto -->
                      <button
                        @click="toggleMemberCircle(memberEmail)"
                        :disabled="circleActionLoading === memberEmail"
                        :class="[
                          'px-2 py-1 text-xs rounded-md font-medium transition-all duration-200 min-w-[60px] flex items-center justify-center',
                          circleActionLoading === memberEmail 
                            ? 'bg-gray-400 text-white cursor-not-allowed' 
                            : getMemberLocationStatus(memberEmail).isOnline 
                            ? 'bg-red-500 hover:bg-red-600 text-white shadow-sm hover:shadow' 
                            : 'bg-green-500 hover:bg-green-600 text-white shadow-sm hover:shadow'
                        ]"
                      >
                        <span v-if="circleActionLoading === memberEmail" class="w-3 h-3 border border-white border-t-transparent rounded-full animate-spin"></span>
                        <span v-else class="text-xs">
                          {{ getMemberLocationStatus(memberEmail).isOnline ? '🚫' : '🎯' }}
                        </span>
                      </button>
                    </div>
                  </div>
                </div>
              </div>
              
              <!-- Información de ubicación expandible -->
              <div v-if="getMemberLocationStatus(memberEmail).hasLocation" 
                   class="px-3 pb-3 border-t border-white border-opacity-50">
                <div class="bg-white rounded-md p-2 mt-2 text-xs space-y-1">
                  <div class="flex items-center justify-between">
                    <span class="text-gray-600">Estado:</span>
                    <span :class="getMemberLocationStatus(memberEmail).isOnline ? 'text-green-600 font-medium' : 'text-gray-500'">
                      {{ getMemberLocationStatus(memberEmail).isOnline ? 'En línea' : 'Desconectado' }}
                    </span>
                  </div>
                  <div v-if="getMemberLocationDetails(memberEmail)" class="flex items-center justify-between">
                    <span class="text-gray-600">Ubicación:</span>
                    <span class="text-gray-800 font-mono text-xs">
                      {{ getMemberLocationDetails(memberEmail)?.lat.toFixed(3) }},{{ getMemberLocationDetails(memberEmail)?.lng.toFixed(3) }}
                    </span>
                  </div>
                  <div v-if="getMemberLocationDetails(memberEmail)?.accuracy" class="flex items-center justify-between">
                    <span class="text-gray-600">Precisión:</span>
                    <span class="text-gray-600">{{ Math.round(getMemberLocationDetails(memberEmail)?.accuracy || 0) }}m</span>
                  </div>
                </div>
              </div>
              
              <!-- Estado sin ubicación -->
              <div v-else class="px-3 pb-3">
                <div class="bg-yellow-50 border border-yellow-200 rounded-md p-2 mt-2 text-center">
                  <span class="text-xs text-yellow-700">📍 Sin ubicación disponible</span>
                </div>
              </div>
            </div>
          </div>

          <!-- Sin miembros -->
          <div v-if="selectedGroup && selectedGroup.members.length <= 1" class="text-center py-8 text-gray-500">
            <div class="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg class="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 715.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 919.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"></path>
              </svg>
            </div>
            <p class="text-sm font-medium">No hay otros miembros</p>
            <p class="text-xs mt-1">Invita a familiares o amigos</p>
          </div>

          <!-- Solo mi ubicación -->
          <div v-if="!selectedGroup && !myLocation" class="text-center py-8 text-gray-500">
            <div class="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg class="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"></path>
              </svg>
            </div>
            <p class="text-sm font-medium">Activa tu GPS</p>
            <p class="text-xs mt-1">Para ver tu ubicación</p>
          </div>
        </div>
      </div>
    </div>

    <!-- Panel del mapa -->
    <div class="flex-1 relative">
      <div ref="mapContainer" class="w-full h-full"></div>
      
      <div v-if="loading" class="absolute inset-0 bg-white bg-opacity-75 flex items-center justify-center">
        <div class="text-center">
          <div class="animate-spin rounded-full h-8 w-8 border-b-2 border-green-500 mx-auto mb-2"></div>
          <span class="text-gray-600 text-sm">Cargando mapa...</span>
        </div>
      </div>

      <!-- BOTÓN PARA MOSTRAR ZONAS DE RIESGO -->
      <div class="absolute top-4 left-4 z-10">
        <button
          @click="toggleZonasRiesgo"
          :disabled="loadingZonas"
          :class="[
            'px-4 py-2 rounded-lg font-medium transition-all duration-300 shadow-lg flex items-center gap-2',
            showZonasRiesgo 
              ? 'bg-red-500 hover:bg-red-600 text-white' 
              : 'bg-white hover:bg-gray-50 text-gray-700 border border-gray-200'
          ]"
        >
          {{ loadingZonas ? '⏳' : (showZonasRiesgo ? '🙈' : '🗺️') }}
          <span class="text-sm">
            {{ loadingZonas ? 'Cargando...' : 
              (showZonasRiesgo ? 'Ocultar Zonas' : 'Ver Zonas de Riesgo') }}
          </span>
        </button>
      </div>

      <!-- LEYENDA FLOTANTE -->
      <div v-if="showZonasRiesgo" class="absolute top-20 left-4 bg-white/95 backdrop-blur-sm rounded-lg shadow-xl border p-3 z-20 max-w-[180px]">
        <h4 class="font-semibold text-gray-800 mb-2 text-xs flex items-center">
          🏷️ Zonas de Riesgo
        </h4>
        <div class="space-y-1 text-xs">
          <div class="flex items-center justify-between">
            <div class="flex items-center">
              <div class="w-3 h-3 bg-red-500 rounded mr-2"></div>
              <span class="text-gray-700">Alto</span>
            </div>
            <span class="text-red-600 font-mono text-xs">🔴</span>
          </div>
          <div class="flex items-center justify-between">
            <div class="flex items-center">
              <div class="w-3 h-3 bg-yellow-500 rounded mr-2"></div>
              <span class="text-gray-700">Medio</span>
            </div>
            <span class="text-yellow-600 font-mono text-xs">🟡</span>
          </div>
          <div class="flex items-center justify-between">
            <div class="flex items-center">
              <div class="w-3 h-3 bg-green-500 rounded mr-2"></div>
              <span class="text-gray-700">Bajo</span>
            </div>
            <span class="text-green-600 font-mono text-xs">🟢</span>
          </div>
          <div class="flex items-center justify-between">
            <div class="flex items-center">
              <div class="w-3 h-3 bg-purple-500 rounded mr-2"></div>
              <span class="text-gray-700">Delitos</span>
            </div>
            <span class="text-purple-600 font-mono text-xs">🟣</span>
          </div>
        </div>
        <p class="text-xs text-gray-500 mt-2 pt-2 border-t">
          💡 Clic zona para info
        </p>
      </div>

      <!-- Panel de información -->
      <div class="absolute top-4 right-4 bg-white rounded-lg shadow-lg p-4 max-w-xs">
        <h4 class="font-semibold text-gray-800 mb-3 flex items-center">
          <svg class="w-4 h-4 mr-2 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path>
          </svg>
          Información
        </h4>
        <div class="space-y-2 text-sm">
          <div class="flex items-center justify-between">
            <div class="flex items-center">
              <div class="w-4 h-4 bg-red-500 rounded-full border-2 border-white shadow mr-2"></div>
              <span class="text-gray-600">Tu ubicación</span>
            </div>
            <span class="text-xs text-gray-500">{{ myLocation ? '🟢' : '⚫' }}</span>
          </div>
          <div class="flex items-center justify-between">
            <div class="flex items-center">
              <div class="w-3 h-3 bg-green-500 rounded-full border-2 border-white shadow mr-2"></div>
              <span class="text-gray-600">Miembros del grupo</span>
            </div>
            <span class="text-xs text-gray-500">{{ groupLocations.filter(l => l.isOnline).length }}</span>
          </div>
          <div class="flex items-center justify-between">
            <div class="flex items-center">
              <div class="w-3 h-3 bg-purple-500 rounded border-2 border-white shadow mr-2"></div>
              <span class="text-gray-600">Zonas de riesgo</span>
            </div>
            <span class="text-xs text-gray-500">{{ showZonasRiesgo ? '🟢' : '⚫' }}</span>
          </div>
          <div class="border-t border-gray-200 pt-2 space-y-1">
            <div class="text-xs text-gray-500 flex justify-between">
              <span>Total ubicaciones:</span>
              <span class="font-medium">{{ relevantLocations.length }}</span>
            </div>
            <div class="text-xs text-gray-500 flex justify-between">
              <span>Grupo activo:</span>
              <span class="font-medium truncate max-w-[100px]">{{ selectedGroup?.name || 'Ninguno' }}</span>
            </div>
            <div class="text-xs text-gray-500 flex justify-between">
              <span>Miembros online:</span>
              <span class="font-medium text-green-600">{{ groupLocations.filter(l => l.isOnline).length }}</span>
            </div>
            <div v-if="showZonasRiesgo && zonasData" class="text-xs text-gray-500 flex justify-between">
              <span>Zonas cargadas:</span>
              <span class="font-medium text-purple-600">{{ zonasData.features?.length || 0 }}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
      
    <!-- Modal de confirmación para eliminar grupo -->
    <div v-if="showDeleteModal" class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div class="bg-white rounded-lg p-6 w-full max-w-md mx-4">
        <h3 class="text-lg font-semibold text-gray-800 mb-4">Eliminar Grupo</h3>
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

<style scoped>
/* Scroll personalizado */
::-webkit-scrollbar {
  width: 4px;
}

::-webkit-scrollbar-track {
  background: #f1f5f9;
}

::-webkit-scrollbar-thumb {
  background: #cbd5e1;
  border-radius: 2px;
}

::-webkit-scrollbar-thumb:hover {
  background: #94a3b8;
}

/* Utilidades para truncado */
.truncate {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.min-w-0 {
  min-width: 0;
}

.flex-shrink-0 {
  flex-shrink: 0;
}

/* Animaciones suaves */
.transition-all {
  transition-property: all;
  transition-timing-function: cubic-bezier(0.4, 0, 0.2, 1);
}

/* Mejora visual para botones pequeños */
button:focus {
  outline: 2px solid transparent;
  outline-offset: 2px;
}

button:focus-visible {
  outline: 2px solid #3b82f6;
  outline-offset: 2px;
}

/* Asegurar que el contenedor tenga scroll visible y suficiente espacio */
.flex-1.overflow-y-auto {
  overflow-y: auto !important;
  scrollbar-width: thin;
  scrollbar-color: #cbd5e1 #f1f5f9;
  padding-bottom: 20px !important;
}

/* Mejorar visibilidad del scroll en navegadores webkit */
.flex-1.overflow-y-auto::-webkit-scrollbar {
  width: 8px;
}

.flex-1.overflow-y-auto::-webkit-scrollbar-track {
  background: #f1f5f9;
  border-radius: 4px;
  margin: 8px 0;
}

.flex-1.overflow-y-auto::-webkit-scrollbar-thumb {
  background: #94a3b8;
  border-radius: 4px;
  border: 1px solid #f1f5f9;
}

.flex-1.overflow-y-auto::-webkit-scrollbar-thumb:hover {
  background: #64748b;
}

/* Asegurar que el último elemento sea visible */
.space-y-2 > *:last-child {
  margin-bottom: 60px !important;
}
</style>