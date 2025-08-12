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

// NUEVAS VARIABLES PARA ZONAS DE RIESGO
const showZonasRiesgo = ref(false)
const zonasRiesgoLayer = ref<any>(null)
const loadingZonas = ref(false)
const zonasData = ref<any>(null)
const currentPopup = ref<any>(null) // NUEVA VARIABLE PARA CONTROLAR POPUP ÚNICO

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

// NUEVA FUNCIÓN PARA CARGAR Y MOSTRAR ZONAS DE RIESGO
const toggleZonasRiesgo = async () => {
  if (!map.value) {
    console.log('Mapa no disponible')
    return
  }

  if (showZonasRiesgo.value) {
    // Ocultar zonas de riesgo
    hideZonasRiesgo()
  } else {
    // Mostrar zonas de riesgo
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
    console.log("📊 Zonas encontradas:", geoJsonData.features.map((f: any) => ({
      nombre: f.properties.NOMLOC,
      codigo: f.properties.CVE_ENT + f.properties.CVE_MUN
    })))
    
    zonasData.value = geoJsonData
    
    // Agregar fuente de datos al mapa
    if (!map.value.getSource('zonas-riesgo')) {
      map.value.addSource('zonas-riesgo', {
        type: 'geojson',
        data: geoJsonData
      })
    }

    // Agregar capa de polígonos (relleno) - ADAPTADO A TU ESTRUCTURA
    if (!map.value.getLayer('zonas-riesgo-fill')) {
      map.value.addLayer({
        id: 'zonas-riesgo-fill',
        type: 'fill',
        source: 'zonas-riesgo',
        paint: {
          'fill-color': [
            'case',
            // Usar el campo 'riesgo' de tu estructura (puede ser null)
            ['==', ['get', 'riesgo'], 'ALTO'], '#ef4444',      // Rojo para riesgo alto
            ['==', ['get', 'riesgo'], 'MEDIO'], '#f59e0b',     // Amarillo para riesgo medio  
            ['==', ['get', 'riesgo'], 'BAJO'], '#10b981',      // Verde para riesgo bajo
            // Si total_delitos existe, usar gradiente basado en número de delitos
            ['!=', ['get', 'total_delitos'], null], [
              'interpolate',
              ['linear'],
              ['get', 'total_delitos'],
              0, '#10b981',    // Verde para 0 delitos
              10, '#f59e0b',   // Amarillo para delitos medios
              50, '#ef4444'    // Rojo para muchos delitos
            ],
            '#8b5cf6'  // Morado por defecto para áreas sin clasificar
          ],
          'fill-opacity': 0.4
        }
      })
    }

    // Agregar capa de bordes - ADAPTADO
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
            ['!=', ['get', 'total_delitos'], null], '#7c3aed', // Morado para zonas con datos de delitos
            '#4b5563'  // Gris por defecto
          ],
          'line-width': 2,
          'line-opacity': 0.9
        }
      })
    }

    // Agregar eventos de click y hover - ADAPTADO A TU ESTRUCTURA
    map.value.on('click', 'zonas-riesgo-fill', (e: any) => {
      const properties = e.features[0].properties
      
      // CERRAR POPUP ANTERIOR SI EXISTE
      if (currentPopup.value) {
        currentPopup.value.remove()
        currentPopup.value = null
      }
      
      // Determinar el color basado en tu estructura de datos
      let colorZona = '#8b5cf6' // Morado por defecto
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
      
      // CREAR NUEVO POPUP Y GUARDARLO EN LA REFERENCIA
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

      // LIMPIAR REFERENCIA CUANDO SE CIERRE EL POPUP
      currentPopup.value.on('close', () => {
        currentPopup.value = null
      })
    })


    // Cambiar cursor al hover
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
    // CERRAR POPUP SI ESTÁ ABIERTO
    if (currentPopup.value) {
      currentPopup.value.remove()
      currentPopup.value = null
    }
    
    // Remover capas si existen
    if (map.value.getLayer('zonas-riesgo-fill')) {
      map.value.removeLayer('zonas-riesgo-fill')
    }
    if (map.value.getLayer('zonas-riesgo-line')) {
      map.value.removeLayer('zonas-riesgo-line')
    }
    
    // Remover fuente si existe
    if (map.value.getSource('zonas-riesgo')) {
      map.value.removeSource('zonas-riesgo')
    }
    
    showZonasRiesgo.value = false
    console.log("🙈 Zonas de riesgo ocultadas")
    
  } catch (error) {
    console.error("❌ Error ocultando zonas:", error)
  }
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

// FUNCIÓN MEJORADA para actualizar marcadores
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

  // Verificar que tenemos ubicaciones
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

    // Solo mostrar ubicaciones online o la mía propia
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

// [Resto del código se mantiene igual...]
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

// [El resto de las funciones se mantienen iguales...]
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

const formatTime = (timestamp: any) => {
  if (!timestamp) return 'Nunca'
  
  const date = timestamp?.toDate ? timestamp.toDate() : new Date(timestamp)
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffMinutes = Math.floor(diffMs / (1000 * 60))
  
  if (diffMinutes < 1) return 'Ahora mismo'
  if (diffMinutes < 60) return `Hace ${diffMinutes} min`
  if (diffMinutes < 1440) return `Hace ${Math.floor(diffMinutes / 60)} h`
  return date.toLocaleDateString()
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
      <div class="p-4 flex-1 overflow-y-auto">
        <h4 class="font-semibold text-gray-800 mb-3 flex items-center justify-between">
          <span>{{ selectedGroup ? `Miembros de ${selectedGroup.name}` : 'Mi ubicación' }}</span>
          <button 
            v-if="selectedGroup"
            @click="refreshGroupLocations"
            class="text-blue-500 hover:text-blue-700 text-sm"
            title="Refrescar ubicaciones"
          >
            🔄
          </button>
        </h4>
        
        <!-- Mi ubicación -->
        <div v-if="myLocation" class="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg">
          <div class="flex items-center justify-between">
            <div class="flex items-center">
              <div class="w-3 h-3 bg-red-500 rounded-full mr-3 animate-pulse"></div>
              <div>
                <p class="font-medium text-red-800">📍 Mi Ubicación</p>
                <p class="text-sm text-red-600">{{ myLocation.userEmail }}</p>
                <p class="text-xs text-red-500 mt-1">
                  <span class="inline-block w-2 h-2 rounded-full mr-1 bg-green-500"></span>
                  En línea
                </p>
              </div>
            </div>
            <div class="text-xs text-red-400">
              {{ formatTime(myLocation.timestamp) }}
            </div>
          </div>
        </div>

        <!-- Miembros del grupo -->
        <div v-if="selectedGroup" class="space-y-3">
          <div 
            v-for="memberEmail in selectedGroup.members.filter(email => email !== userStore.user?.email)" 
            :key="memberEmail"
            class="p-3 border rounded-lg transition-all duration-300"
            :class="getMemberLocationStatus(memberEmail).isOnline ? 'bg-green-50 border-green-200' : 'bg-gray-50 border-gray-200'"
          >
            <div class="flex items-center justify-between mb-2">
              <div class="flex items-center">
                <div 
                  class="w-3 h-3 rounded-full mr-3 transition-all duration-300" 
                  :class="getMemberLocationStatus(memberEmail).isOnline ? 'bg-green-500 animate-pulse' : 'bg-gray-400'"
                ></div>
                <div>
                  <p class="font-medium text-gray-800">{{ getMemberName(memberEmail) }}</p>
                  <p class="text-sm text-gray-600">{{ memberEmail }}</p>
                </div>
              </div>
              
              <div class="flex items-center gap-2">
                <div class="text-xs text-gray-500">
                  {{ getMemberLocationStatus(memberEmail).isOnline ? 'Activo' : 'Inactivo' }}
                </div>
                <button
                  @click="toggleMemberCircle(memberEmail)"
                  :disabled="circleActionLoading === memberEmail"
                  :class="[
                    'px-3 py-1 text-xs rounded-md font-medium transition-all duration-300 min-w-[80px]',
                    circleActionLoading === memberEmail 
                      ? 'bg-gray-400 text-white cursor-not-allowed' 
                      : getMemberLocationStatus(memberEmail).isOnline 
                      ? 'bg-red-500 hover:bg-red-600 text-white shadow-sm' 
                      : 'bg-green-500 hover:bg-green-600 text-white shadow-sm'
                  ]"
                >
                  {{ circleActionLoading === memberEmail ? '⏳' : 
                    (getMemberLocationStatus(memberEmail).isOnline ? '🚫 Desactivar' : '🎯 Activar') }}
                </button>
              </div>
            </div>
            
            <!-- Información de ubicación -->
            <div v-if="getMemberLocationStatus(memberEmail).hasLocation" class="text-xs text-gray-500 space-y-1 bg-white rounded p-2">
              <div class="flex items-center justify-between">
                <div class="flex items-center">
                  <span class="w-2 h-2 rounded-full mr-2" 
                        :class="getMemberLocationStatus(memberEmail).isOnline ? 'bg-green-500 animate-pulse' : 'bg-gray-400'"></span>
                  {{ getMemberLocationStatus(memberEmail).isOnline ? '🟢 En línea' : '⚫ Desconectado' }}
                </div>
                <span class="text-xs font-mono">
                  {{ getMemberLocationStatus(memberEmail).isOnline ? '🟢' : '⚫' }}
                </span>
              </div>
              <div class="flex items-center">
                <svg class="w-3 h-3 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"></path>
                </svg>
                {{ formatTime(getMemberLocationStatus(memberEmail).lastUpdate) }}
              </div>
              <div v-if="getMemberLocationDetails(memberEmail)" class="flex items-center">
                <svg class="w-3 h-3 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"></path>
                </svg>
                {{ getMemberLocationDetails(memberEmail)?.lat.toFixed(4) }}, 
                {{ getMemberLocationDetails(memberEmail)?.lng.toFixed(4) }}
              </div>
              <div v-if="getMemberLocationDetails(memberEmail)?.accuracy" class="flex items-center">
                <svg class="w-3 h-3 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"></path>
                </svg>
                Precisión: {{ Math.round(getMemberLocationDetails(memberEmail)?.accuracy || 0) }}m
              </div>
            </div>
            
            <!-- Estado sin ubicación -->
            <div v-else class="text-xs text-gray-400 bg-gray-100 rounded p-2 text-center">
              📍 Sin ubicación disponible
            </div>
          </div>
        </div>

        <!-- Sin miembros -->
        <div v-if="selectedGroup && selectedGroup.members.length <= 1" class="text-center py-8 text-gray-500">
          <svg class="w-12 h-12 mx-auto mb-4 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"></path>
          </svg>
          <p class="text-sm">No hay otros miembros en el grupo</p>
          <p class="text-xs">Invita miembros para ver sus ubicaciones</p>
        </div>

        <!-- Solo mi ubicación -->
        <div v-if="!selectedGroup && !myLocation" class="text-center py-8 text-gray-500">
          <svg class="w-12 h-12 mx-auto mb-4 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"></path>
          </svg>
          <p class="text-sm">Activa tu GPS para ver tu ubicación</p>
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

      <!-- LEYENDA FLOTANTE MEJORADA -->
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

      <!-- Panel de información MEJORADO -->
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
          <!-- NUEVO INDICADOR DE ZONAS DE RIESGO -->
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
              <span class="font-medium">{{ selectedGroup?.name || 'Ninguno' }}</span>
            </div>
            <div class="text-xs text-gray-500 flex justify-between">
              <span>Miembros online:</span>
              <span class="font-medium text-green-600">{{ groupLocations.filter(l => l.isOnline).length }}</span>
            </div>
            <!-- NUEVA INFO DE ZONAS -->
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