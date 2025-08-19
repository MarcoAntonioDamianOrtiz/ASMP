<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue'
import { useUserStore } from '@/stores/user'
import { updateUserLocation, setUserOffline } from '@/firebase'

const userStore = useUserStore()
const isTracking = ref(false)
const lastUpdate = ref<Date | null>(null)
const watchId = ref<number | null>(null)
const error = ref<string | null>(null)
const currentPosition = ref<{ lat: number, lng: number } | null>(null)

// FUNCIÓN MEJORADA para validar coordenadas GPS
const isValidGPSCoordinate = (lat: number, lng: number): boolean => {
  // Verificar que sean números válidos
  if (typeof lat !== 'number' || typeof lng !== 'number') {
    console.error('❌ Coordenadas no son números:', { lat, lng, latType: typeof lat, lngType: typeof lng })
    return false
  }
  
  // Verificar que no sean NaN
  if (isNaN(lat) || isNaN(lng)) {
    console.error('❌ Coordenadas son NaN:', { lat, lng })
    return false
  }
  
  // Verificar que estén en rangos válidos
  if (Math.abs(lat) > 90 || Math.abs(lng) > 180) {
    console.error('❌ Coordenadas fuera de rango válido:', { lat, lng })
    return false
  }
  
  // Verificar que no sean 0,0 (ubicación inválida común)
  if (lat === 0 && lng === 0) {
    console.error('❌ Coordenadas son 0,0 (inválida):', { lat, lng })
    return false
  }
  
  return true
}

// Función para iniciar el rastreo GPS
const startTracking = () => {
  if (!navigator.geolocation) {
    error.value = 'La geolocalización no está soportada en este navegador'
    return
  }

  if (!userStore.isAuthenticated) {
    error.value = 'Debes iniciar sesión para usar el rastreo GPS'
    return
  }

  error.value = null
  isTracking.value = true

  const options = {
    enableHighAccuracy: true,
    timeout: 20000, // Aumentamos timeout a 20 segundos
    maximumAge: 15000 // Cache por 15 segundos
  }

  console.log('🎯 Iniciando rastreo GPS para usuario:', userStore.user?.uid)

  // Obtener posición inicial
  navigator.geolocation.getCurrentPosition(
    (position) => {
      console.log('📍 Posición inicial obtenida:', position.coords.latitude, position.coords.longitude)
      updateLocation(position)
    },
    (err) => {
      console.error('❌ Error obteniendo posición inicial:', err)
      handleError(err)
    },
    options
  )

  // Iniciar rastreo continuo
  watchId.value = navigator.geolocation.watchPosition(
    (position) => {
      console.log('📍 Nueva posición GPS:', position.coords.latitude, position.coords.longitude)
      updateLocation(position)
    },
    (err) => {
      console.error('❌ Error en rastreo continuo:', err)
      handleError(err)
    },
    options
  )

  console.log('✅ Rastreo GPS iniciado con watchId:', watchId.value)
}

// FUNCIÓN MEJORADA Y CORREGIDA para actualizar la ubicación
const updateLocation = async (position: GeolocationPosition) => {
  const { latitude, longitude, accuracy } = position.coords
  
  console.log('🔍 Verificando coordenadas recibidas:', {
    latitude,
    longitude,
    accuracy,
    timestamp: new Date().toISOString()
  })
  
  // VALIDACIÓN ESTRICTA DE COORDENADAS
  if (!isValidGPSCoordinate(latitude, longitude)) {
    console.error('❌ Coordenadas GPS inválidas, no se actualizará:', { latitude, longitude })
    error.value = 'Las coordenadas GPS recibidas son inválidas'
    return
  }
  
  console.log('✅ Coordenadas GPS válidas, actualizando...')
  
  currentPosition.value = { lat: latitude, lng: longitude }
  lastUpdate.value = new Date()

  try {
    // VALIDACIÓN DE USUARIO
    if (!userStore.user?.uid) {
      console.error('❌ No hay userId disponible')
      error.value = 'Error: Usuario no identificado'
      return
    }

    if (!userStore.user?.email) {
      console.error('❌ No hay email de usuario disponible')
      error.value = 'Error: Email de usuario no disponible'
      return
    }

    // PREPARAR DATOS PARA FIREBASE
    const locationData = {
      userEmail: userStore.user.email,
      userName: userStore.userProfile?.nombre || userStore.user.displayName || userStore.user.email?.split('@')[0] || 'Usuario',
      lat: latitude, // Usar directamente los valores validados
      lng: longitude,
      accuracy: accuracy || null
    }

    console.log('📤 Enviando ubicación a Firebase:', locationData)

    await updateUserLocation(userStore.user.uid, locationData)

    console.log('✅ Ubicación GPS actualizada exitosamente en Firebase')
    
    // Limpiar errores previos
    if (error.value && error.value.includes('coordenadas') || error.value.includes('inválida')) {
      error.value = null
    }
    
  } catch (err: any) {
    console.error('❌ Error al actualizar ubicación en Firebase:', err)
    error.value = 'Error al actualizar la ubicación: ' + (err.message || 'Error desconocido')
  }
}

// Función para manejar errores de geolocalización
const handleError = (err: GeolocationPositionError) => {
  let errorMessage = ''
  
  switch (err.code) {
    case err.PERMISSION_DENIED:
      errorMessage = 'Permiso de ubicación denegado. Por favor, habilita el GPS en tu dispositivo y permite el acceso a la ubicación.'
      break
    case err.POSITION_UNAVAILABLE:
      errorMessage = 'Información de ubicación no disponible. Verifica que el GPS esté habilitado.'
      break
    case err.TIMEOUT:
      errorMessage = 'Tiempo de espera agotado para obtener la ubicación. Intenta de nuevo.'
      break
    default:
      errorMessage = `Error desconocido al obtener la ubicación (Código: ${err.code}).`
      break
  }
  
  error.value = errorMessage
  console.error('❌ Error de geolocalización:', errorMessage, err)
  
  // NO detener completamente el tracking por un error temporal
  // isTracking.value = false
}

// Función para obtener ubicación una sola vez
const getLocationOnce = () => {
  if (!navigator.geolocation) {
    error.value = 'La geolocalización no está soportada'
    return
  }

  console.log('📍 Obteniendo ubicación una sola vez...')
  
  // Limpiar error anterior
  error.value = null
  
  navigator.geolocation.getCurrentPosition(
    (position) => {
      console.log('📍 Ubicación única obtenida:', position.coords.latitude, position.coords.longitude)
      updateLocation(position)
    },
    (err) => {
      console.error('❌ Error obteniendo ubicación única:', err)
      handleError(err)
    },
    {
      enableHighAccuracy: true,
      timeout: 20000,
      maximumAge: 30000
    }
  )
}

// Función para limpiar ubicación cuando se desactiva el rastreo
const cleanupLocation = async () => {
  if (!userStore.user?.uid) return
  
  try {
    console.log('🧹 Limpiando ubicación del usuario:', userStore.user.uid)
    await setUserOffline(userStore.user.uid)
    currentPosition.value = null
    lastUpdate.value = null
    console.log('✅ Ubicación limpiada exitosamente')
  } catch (err: any) {
    console.error('❌ Error al limpiar ubicación:', err)
  }
}

// Función para detener el rastreo (versión básica)
const stopTracking = () => {
  if (watchId.value !== null) {
    navigator.geolocation.clearWatch(watchId.value)
    console.log('⏹️ Rastreo GPS detenido, watchId:', watchId.value)
    watchId.value = null
  }
  isTracking.value = false
  error.value = null
}

// FUNCIÓN MEJORADA para detener rastreo Y limpiar Firebase
const stopTrackingImproved = async () => {
  if (watchId.value !== null) {
    navigator.geolocation.clearWatch(watchId.value)
    console.log('⏹️ Rastreo GPS detenido, watchId:', watchId.value)
    watchId.value = null
  }
  isTracking.value = false
  error.value = null
  
  // Limpiar ubicación de Firebase
  await cleanupLocation()
}

// Función para reintentar tracking si falla
const retryTracking = () => {
  console.log('🔄 Reintentando rastreo GPS...')
  error.value = null
  
  if (isTracking.value) {
    stopTracking()
    setTimeout(() => {
      startTracking()
    }, 2000)
  }
}

// FUNCIÓN DE DIAGNÓSTICO para verificar permisos
const checkGPSPermissions = async () => {
  try {
    if ('permissions' in navigator) {
      const permission = await navigator.permissions.query({name: 'geolocation'})
      console.log('🔍 Estado del permiso GPS:', permission.state)
      return permission.state
    }
  } catch (err) {
    console.warn('⚠️ No se pudo verificar permisos GPS:', err)
  }
  return 'unknown'
}

// FUNCIÓN DE DIAGNÓSTICO completa
const runDiagnostics = async () => {
  console.log('🔍 Ejecutando diagnósticos GPS...')
  
  // Verificar soporte de geolocalización
  if (!navigator.geolocation) {
    console.error('❌ Geolocalización no soportada')
    return
  }
  
  // Verificar permisos
  const permissionState = await checkGPSPermissions()
  console.log('📋 Permisos GPS:', permissionState)
  
  // Verificar usuario autenticado
  console.log('👤 Usuario autenticado:', userStore.isAuthenticated)
  console.log('👤 UID del usuario:', userStore.user?.uid)
  console.log('👤 Email del usuario:', userStore.user?.email)
  
  // Verificar estado actual
  console.log('📍 Estado tracking:', isTracking.value)
  console.log('📍 WatchID actual:', watchId.value)
  console.log('📍 Última ubicación:', currentPosition.value)
  console.log('📍 Último error:', error.value)
}

// Auto-iniciar el tracking cuando el componente se monta
onMounted(async () => {
  console.log('🚀 Montando componente LocationTracker')
  
  // Ejecutar diagnósticos
  await runDiagnostics()
  
  if (userStore.isAuthenticated && userStore.user?.uid) {
    console.log('🚀 Usuario autenticado, iniciando rastreo para:', userStore.user.uid)
    
    // Delay para asegurar que todo esté listo
    setTimeout(() => {
      startTracking()
    }, 1500)
  } else {
    console.log('⚠️ Usuario no autenticado, no se inicia rastreo GPS')
  }
})

// MEJORADO: Limpiar al desmontar el componente
onUnmounted(async () => {
  console.log('🧹 Desmontando LocationTracker')
  
  // Detener rastreo y limpiar ubicación
  if (watchId.value !== null) {
    navigator.geolocation.clearWatch(watchId.value)
    watchId.value = null
  }
  
  // Limpiar ubicación de Firebase
  await cleanupLocation()
})
</script>

<template>
  <div class="bg-white rounded-lg shadow p-6">
    <h3 class="text-lg font-semibold text-gray-800 mb-4 flex items-center">
      <svg class="w-5 h-5 mr-2 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"></path>
      </svg>
      Rastreo GPS
    </h3>

    <!-- Controles -->
    <div class="flex gap-2 mb-4 flex-wrap">
      <button
        v-if="!isTracking"
        @click="startTracking"
        :disabled="!userStore.isAuthenticated"
        class="px-4 py-2 bg-green-500 hover:bg-green-600 text-white text-sm rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center"
      >
        <svg class="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M14.828 14.828a4 4 0 01-5.656 0M9 10h1m4 0h1m-6 4h8M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path>
        </svg>
        Iniciar Rastreo
      </button>
      <button
        v-else
        @click="stopTrackingImproved"
        class="px-4 py-2 bg-red-500 hover:bg-red-600 text-white text-sm rounded-lg transition-colors flex items-center"
      >
        <svg class="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path>
        </svg>
        Detener Rastreo
      </button>
      <button
        @click="getLocationOnce"
        :disabled="!userStore.isAuthenticated"
        class="px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white text-sm rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center"
      >
        <svg class="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"></path>
        </svg>
        Ubicación Actual
      </button>
      <button
        v-if="error && isTracking"
        @click="retryTracking"
        class="px-3 py-2 bg-orange-500 hover:bg-orange-600 text-white text-sm rounded-lg transition-colors"
      >
        🔄 Reintentar
      </button>
      <!-- BOTÓN DE DIAGNÓSTICO PARA DEBUG -->
      <button
        @click="runDiagnostics"
        class="px-3 py-2 bg-purple-500 hover:bg-purple-600 text-white text-sm rounded-lg transition-colors"
        title="Ejecutar diagnósticos (abrir consola)"
      >
        🔍 Debug
      </button>
    </div>

    <!-- Estado actual MEJORADO -->
    <div class="mb-4 text-sm">
      <div v-if="isTracking" class="text-green-600 flex items-center">
        <div class="animate-pulse w-3 h-3 bg-green-500 rounded-full mr-2"></div>
        <span class="font-medium">Rastreando ubicación...</span>
        <span v-if="watchId" class="ml-2 text-xs text-gray-500">(ID: {{ watchId }})</span>
      </div>
      <div v-else class="text-gray-500 flex items-center">
        <div class="w-3 h-3 bg-gray-400 rounded-full mr-2"></div>
        <span>Rastreo desactivado</span>
      </div>
    </div>

    <!-- Información de ubicación MEJORADA -->
    <div v-if="currentPosition" class="mb-4 p-4 bg-gray-50 border border-gray-200 rounded-lg text-sm">
      <div class="flex items-center mb-3">
        <svg class="w-4 h-4 mr-2 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"></path>
        </svg>
        <span class="font-medium text-gray-700">Ubicación Actual</span>
        <div class="ml-2 px-2 py-1 bg-green-100 text-green-700 text-xs rounded">
          ✅ VÁLIDA
        </div>
      </div>
      
      <div class="grid grid-cols-2 gap-3 mb-3">
        <div class="bg-white rounded p-2">
          <div class="text-xs text-gray-600 mb-1">Latitud</div>
          <div class="font-mono text-gray-800">{{ currentPosition.lat.toFixed(6) }}</div>
        </div>
        <div class="bg-white rounded p-2">
          <div class="text-xs text-gray-600 mb-1">Longitud</div>
          <div class="font-mono text-gray-800">{{ currentPosition.lng.toFixed(6) }}</div>
        </div>
      </div>
      
      <div v-if="lastUpdate" class="flex items-center text-xs text-gray-500 bg-white rounded p-2">
        <svg class="w-3 h-3 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"></path>
        </svg>
        Última actualización: {{ lastUpdate.toLocaleTimeString() }}
      </div>
    </div>

    <!-- Error MEJORADO -->
    <div v-if="error" class="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg">
      <div class="flex items-start">
        <svg class="w-4 h-4 mr-2 text-red-500 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.996-.833-2.764 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z"></path>
        </svg>
        <div class="flex-1">
          <p class="text-red-600 text-sm font-medium mb-1">Error de GPS</p>
          <p class="text-red-500 text-sm">{{ error }}</p>
          <div class="mt-2 text-xs text-red-400">
            💡 Consejos: Verifica que tengas GPS habilitado, que hayas dado permisos de ubicación al navegador, y que tengas buena señal GPS.
          </div>
        </div>
      </div>
    </div>

    <!-- Info de autenticación -->
    <div v-if="!userStore.isAuthenticated" class="text-sm text-gray-500 bg-yellow-50 border border-yellow-200 rounded-lg p-3">
      <div class="flex items-center">
        <svg class="w-4 h-4 mr-2 text-yellow-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.996-.833-2.764 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z"></path>
        </svg>
        <span>Debes iniciar sesión para usar el rastreo GPS</span>
      </div>
    </div>

    <!-- Info adicional para desarrollo -->
    <div v-if="userStore.user && currentPosition" class="text-xs text-gray-400 mt-4 p-2 bg-gray-50 rounded">
      <div><strong>Debug Info:</strong></div>
      <div>User ID: {{ userStore.user.uid }}</div>
      <div>Watch ID: {{ watchId || 'N/A' }}</div>
      <div>Tracking: {{ isTracking ? 'Activo' : 'Inactivo' }}</div>
      <div>Position: {{ currentPosition.lat.toFixed(4) }}, {{ currentPosition.lng.toFixed(4) }}</div>
      <div>Valid Coords: {{ isValidGPSCoordinate(currentPosition.lat, currentPosition.lng) ? '✅' : '❌' }}</div>
    </div>
  </div>
</template>