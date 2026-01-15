<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue'
import { useUserStore } from '@/stores/user'
import { updateUserLocation, setUserOffline } from '@/firebase'

const userStore = useUserStore()
const isTracking = ref(false)
const lastUpdate = ref<Date | null>(null)
const watchId = ref<number | null>(null)
const error = ref<string | null>(null)
const currentPosition = ref<{ lat: number, lng: number, accuracy: number } | null>(null)
const precisionWarning = ref<string | null>(null)

// Contador de intentos de ubicación imprecisa
const impreciseAttempts = ref(0)
const MAX_IMPRECISE_ATTEMPTS = 3

// FUNCIÓN MEJORADA para validar coordenadas GPS
const isValidGPSCoordinate = (lat: number, lng: number): boolean => {
  if (typeof lat !== 'number' || typeof lng !== 'number') {
    console.error('❌ Coordenadas no son números:', { lat, lng })
    return false
  }
  
  if (isNaN(lat) || isNaN(lng)) {
    console.error('❌ Coordenadas son NaN:', { lat, lng })
    return false
  }
  
  if (Math.abs(lat) > 90 || Math.abs(lng) > 180) {
    console.error('❌ Coordenadas fuera de rango:', { lat, lng })
    return false
  }
  
  if (lat === 0 && lng === 0) {
    console.error('❌ Coordenadas son 0,0:', { lat, lng })
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
  precisionWarning.value = null
  impreciseAttempts.value = 0
  isTracking.value = true

  const options = {
    enableHighAccuracy: true, // ✅ CRUCIAL: Forzar alta precisión
    timeout: 30000, // 30 segundos para obtener posición
    maximumAge: 0 // ❌ NO usar cache, siempre nueva ubicación
  }

  console.log('🎯 Iniciando rastreo GPS de ALTA PRECISIÓN para:', userStore.user?.email)

  // Obtener posición inicial
  navigator.geolocation.getCurrentPosition(
    (position) => {
      console.log('📍 Posición inicial obtenida:', {
        lat: position.coords.latitude,
        lng: position.coords.longitude,
        accuracy: position.coords.accuracy
      })
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
      console.log('📍 Nueva posición GPS:', {
        lat: position.coords.latitude,
        lng: position.coords.longitude,
        accuracy: position.coords.accuracy
      })
      updateLocation(position)
    },
    (err) => {
      console.error('❌ Error en rastreo continuo:', err)
      handleError(err)
    },
    options
  )

  console.log('✅ Rastreo GPS de alta precisión iniciado con watchId:', watchId.value)
}

// ✅ FUNCIÓN COMPLETAMENTE CORREGIDA para actualizar la ubicación
const updateLocation = async (position: GeolocationPosition) => {
  const { latitude, longitude, accuracy } = position.coords
  
  console.log('🔍 Verificando ubicación recibida:', {
    latitude,
    longitude,
    accuracy: Math.round(accuracy),
    timestamp: new Date().toISOString()
  })
  
  // VALIDACIÓN 1: Coordenadas válidas
  if (!isValidGPSCoordinate(latitude, longitude)) {
    console.error('❌ Coordenadas GPS inválidas')
    error.value = 'Las coordenadas GPS recibidas son inválidas'
    return
  }
  
  // VALIDACIÓN 2: Precisión
  const roundedAccuracy = Math.round(accuracy)
  
  // 🚫 RECHAZAR si la precisión es mayor a 50 metros
  if (accuracy > 50) {
    impreciseAttempts.value++
    
    console.warn(`⚠️ Ubicación imprecisa rechazada (${roundedAccuracy}m). Intento ${impreciseAttempts.value}/${MAX_IMPRECISE_ATTEMPTS}`)
    
    precisionWarning.value = `🎯 Esperando señal GPS más precisa... (${roundedAccuracy}m)`
    
    if (impreciseAttempts.value >= MAX_IMPRECISE_ATTEMPTS) {
      error.value = `La señal GPS es muy imprecisa (${roundedAccuracy}m). Muévete a un lugar con mejor visibilidad del cielo.`
    }
    
    // NO actualizar la ubicación en Firebase
    return
  }
  
  // ✅ PRECISIÓN ACEPTABLE
  console.log(`✅ Precisión GPS aceptable: ${roundedAccuracy}m`)
  
  // Limpiar advertencias y errores previos
  precisionWarning.value = null
  if (error.value && error.value.includes('imprecisa')) {
    error.value = null
  }
  impreciseAttempts.value = 0
  
  // Actualizar estado local
  currentPosition.value = { 
    lat: latitude, 
    lng: longitude,
    accuracy: roundedAccuracy
  }
  lastUpdate.value = new Date()

  try {
    // Validar usuario
    if (!userStore.user?.email) {
      console.error('❌ No hay email de usuario disponible')
      error.value = 'Error: Email de usuario no disponible'
      return
    }

    if (!userStore.user?.uid) {
      console.error('❌ No hay userId disponible')
      error.value = 'Error: Usuario no identificado'
      return
    }

    // Preparar datos
    const locationData = {
      lat: latitude,
      lng: longitude,
      accuracy: roundedAccuracy
    }

    console.log('📤 Enviando ubicación precisa a Firebase:', {
      userEmail: userStore.user.email,
      userId: userStore.user.uid,
      locationData: locationData
    })

    // ✅ LLAMADA A FIREBASE (puede lanzar error si precisión insuficiente)
    await updateUserLocation(userStore.user.email, locationData)

    console.log('✅ Ubicación GPS precisa actualizada exitosamente en Firebase')
    
  } catch (err: any) {
    console.error('❌ Error al actualizar ubicación en Firebase:', err)
    
    // Mostrar error al usuario
    if (err.message && err.message.includes('Precisión GPS insuficiente')) {
      error.value = err.message
      precisionWarning.value = `⚠️ Precisión: ${roundedAccuracy}m (se requiere <50m)`
    } else {
      error.value = 'Error al actualizar la ubicación: ' + (err.message || 'Error desconocido')
    }
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
      errorMessage = 'Información de ubicación no disponible. Verifica que el GPS esté habilitado y que tengas buena visibilidad del cielo.'
      break
    case err.TIMEOUT:
      errorMessage = 'Tiempo de espera agotado para obtener la ubicación. Intenta moverte a un lugar con mejor señal GPS.'
      break
    default:
      errorMessage = `Error desconocido al obtener la ubicación (Código: ${err.code}).`
      break
  }
  
  error.value = errorMessage
  console.error('❌ Error de geolocalización:', errorMessage, err)
}

// Función para obtener ubicación una sola vez
const getLocationOnce = () => {
  if (!navigator.geolocation) {
    error.value = 'La geolocalización no está soportada'
    return
  }

  console.log('📍 Obteniendo ubicación precisa una sola vez...')
  
  error.value = null
  precisionWarning.value = null
  
  navigator.geolocation.getCurrentPosition(
    (position) => {
      console.log('📍 Ubicación única obtenida:', {
        lat: position.coords.latitude,
        lng: position.coords.longitude,
        accuracy: Math.round(position.coords.accuracy)
      })
      updateLocation(position)
    },
    (err) => {
      console.error('❌ Error obteniendo ubicación única:', err)
      handleError(err)
    },
    {
      enableHighAccuracy: true,
      timeout: 30000,
      maximumAge: 0
    }
  )
}

// Función para limpiar ubicación
const cleanupLocation = async () => {
  if (!userStore.user?.email) {
    console.warn('⚠️ No hay email de usuario para cleanup')
    return
  }
  
  try {
    console.log('🧹 Limpiando ubicación del usuario:', userStore.user.email)
    
    const { getUserByEmail } = await import('@/firebase')
    const user = await getUserByEmail(userStore.user.email)
    
    if (user?.id) {
      await setUserOffline(user.id)
      console.log('✅ Usuario marcado como offline')
    }
    
    currentPosition.value = null
    lastUpdate.value = null
    console.log('✅ Ubicación limpiada exitosamente')
  } catch (err: any) {
    console.error('❌ Error al limpiar ubicación:', err)
  }
}

// Función para detener el rastreo
const stopTracking = () => {
  if (watchId.value !== null) {
    navigator.geolocation.clearWatch(watchId.value)
    console.log('⏹️ Rastreo GPS detenido, watchId:', watchId.value)
    watchId.value = null
  }
  isTracking.value = false
  error.value = null
  precisionWarning.value = null
  impreciseAttempts.value = 0
}

// Función mejorada para detener rastreo Y limpiar Firebase
const stopTrackingImproved = async () => {
  if (watchId.value !== null) {
    navigator.geolocation.clearWatch(watchId.value)
    console.log('⏹️ Rastreo GPS detenido, watchId:', watchId.value)
    watchId.value = null
  }
  isTracking.value = false
  error.value = null
  precisionWarning.value = null
  impreciseAttempts.value = 0
  
  await cleanupLocation()
}

// Función para reintentar tracking
const retryTracking = () => {
  console.log('🔄 Reintentando rastreo GPS...')
  error.value = null
  precisionWarning.value = null
  impreciseAttempts.value = 0
  
  if (isTracking.value) {
    stopTracking()
    setTimeout(() => {
      startTracking()
    }, 2000)
  }
}

// Función de diagnóstico
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

const runDiagnostics = async () => {
  console.log('🔍 Ejecutando diagnósticos GPS...')
  
  if (!navigator.geolocation) {
    console.error('❌ Geolocalización no soportada')
    return
  }
  
  const permissionState = await checkGPSPermissions()
  console.log('📋 Permisos GPS:', permissionState)
  console.log('👤 Usuario autenticado:', userStore.isAuthenticated)
  console.log('👤 Email:', userStore.user?.email)
  console.log('📍 Estado tracking:', isTracking.value)
  console.log('📍 WatchID:', watchId.value)
  console.log('📍 Posición actual:', currentPosition.value)
  console.log('📍 Error:', error.value)
  console.log('⚠️ Advertencia precisión:', precisionWarning.value)
  console.log('🎯 Intentos imprecisos:', impreciseAttempts.value)
}

// Auto-iniciar el tracking cuando el componente se monta
onMounted(async () => {
  console.log('🚀 Montando componente LocationTracker con validación de precisión')
  
  await runDiagnostics()
  
  if (userStore.isAuthenticated && userStore.user?.email) {
    console.log('🚀 Usuario autenticado, iniciando rastreo de alta precisión para:', userStore.user.email)
    
    setTimeout(() => {
      startTracking()
    }, 1500)
  } else {
    console.log('⚠️ Usuario no autenticado, no se inicia rastreo GPS')
  }
})

// Limpiar al desmontar el componente
onUnmounted(async () => {
  console.log('🧹 Desmontando LocationTracker')
  
  if (watchId.value !== null) {
    navigator.geolocation.clearWatch(watchId.value)
    watchId.value = null
  }
  
  await cleanupLocation()
})
</script>

<template>
  <div class="bg-white rounded-lg shadow p-6">
    <h3 class="text-lg font-semibold text-gray-800 mb-4 flex items-center">
      <svg class="w-5 h-5 mr-2 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"></path>
      </svg>
      Rastreo GPS (Alta Precisión)
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
        v-if="error || precisionWarning"
        @click="retryTracking"
        class="px-3 py-2 bg-orange-500 hover:bg-orange-600 text-white text-sm rounded-lg transition-colors"
      >
        🔄 Reintentar
      </button>
      <button
        @click="runDiagnostics"
        class="px-3 py-2 bg-purple-500 hover:bg-purple-600 text-white text-sm rounded-lg transition-colors"
        title="Ejecutar diagnósticos (abrir consola)"
      >
        🔍 Debug
      </button>
    </div>

    <!-- Estado actual -->
    <div class="mb-4 text-sm">
      <div v-if="isTracking" class="text-green-600 flex items-center">
        <div class="animate-pulse w-3 h-3 bg-green-500 rounded-full mr-2"></div>
        <span class="font-medium">Rastreando ubicación con alta precisión...</span>
        <span v-if="watchId" class="ml-2 text-xs text-gray-500">(ID: {{ watchId }})</span>
      </div>
      <div v-else class="text-gray-500 flex items-center">
        <div class="w-3 h-3 bg-gray-400 rounded-full mr-2"></div>
        <span>Rastreo desactivado</span>
      </div>
    </div>

    <!-- Advertencia de precisión -->
    <div v-if="precisionWarning && isTracking" class="mb-4 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
      <div class="flex items-start">
        <svg class="w-5 h-5 text-yellow-500 mr-2 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.996-.833-2.764 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z"></path>
        </svg>
        <div>
          <p class="text-yellow-800 font-medium">{{ precisionWarning }}</p>
          <p class="text-yellow-700 text-xs mt-1">
            Muévete a un lugar con mejor visibilidad del cielo. Se requiere precisión menor a 50 metros.
          </p>
          <p class="text-yellow-600 text-xs mt-1">
            Intentos: {{ impreciseAttempts }}/{{ MAX_IMPRECISE_ATTEMPTS }}
          </p>
        </div>
      </div>
    </div>

    <!-- Información de ubicación -->
    <div v-if="currentPosition" class="mb-4 p-4 bg-gray-50 border border-gray-200 rounded-lg text-sm">
      <div class="flex items-center mb-3">
        <svg class="w-4 h-4 mr-2 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"></path>
        </svg>
        <span class="font-medium text-gray-700">Ubicación Precisa</span>
        <div :class="[
          'ml-2 px-2 py-1 text-xs rounded',
          currentPosition.accuracy <= 10 ? 'bg-green-100 text-green-700' :
          currentPosition.accuracy <= 20 ? 'bg-blue-100 text-blue-700' :
          currentPosition.accuracy <= 30 ? 'bg-yellow-100 text-yellow-700' : 'bg-orange-100 text-orange-700'
        ]">
          {{ currentPosition.accuracy <= 10 ? '🎯 Excelente' :
             currentPosition.accuracy <= 20 ? '✅ Buena' :
             currentPosition.accuracy <= 30 ? '⚠️ Aceptable' : '🔶 Baja' }}
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
      
      <div class="bg-white rounded p-2 mb-3">
        <div class="flex justify-between items-center">
          <span class="text-xs text-gray-600">Precisión GPS:</span>
          <span :class="[
            'font-bold text-sm',
            currentPosition.accuracy <= 10 ? 'text-green-600' :
            currentPosition.accuracy <= 20 ? 'text-blue-600' :
            currentPosition.accuracy <= 30 ? 'text-yellow-600' : 'text-orange-600'
          ]">{{ currentPosition.accuracy }}m</span>
        </div>
      </div>
      
      <div v-if="lastUpdate" class="flex items-center text-xs text-gray-500 bg-white rounded p-2">
        <svg class="w-3 h-3 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"></path>
        </svg>
        Última actualización: {{ lastUpdate.toLocaleTimeString() }}
      </div>
    </div>

    <!-- Error -->
    <div v-if="error" class="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg">
      <div class="flex items-start">
        <svg class="w-4 h-4 mr-2 text-red-500 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.996-.833-2.764 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z"></path>
        </svg>
        <div class="flex-1">
          <p class="text-red-600 text-sm font-medium mb-1">Error de GPS</p>
          <p class="text-red-500 text-sm">{{ error }}</p>
          <div class="mt-2 text-xs text-red-400">
            💡 Consejos: 
            <ul class="list-disc ml-4 mt-1">
              <li>Muévete a un lugar con mejor visibilidad del cielo</li>
              <li>Asegúrate de tener GPS habilitado</li>
              <li>Verifica que hayas dado permisos de ubicación</li>
              <li>Espera unos segundos para que el GPS se calibre</li>
            </ul>
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

    <!-- Info de desarrollo -->
    <div v-if="userStore.user" class="text-xs text-gray-400 mt-4 p-2 bg-gray-50 rounded border-t">
      <div><strong>Debug Info:</strong></div>
      <div>User ID: {{ userStore.user.uid }}</div>
      <div>User Email: {{ userStore.user.email }}</div>
      <div>Watch ID: {{ watchId || 'N/A' }}</div>
      <div>Tracking: {{ isTracking ? 'Activo' : 'Inactivo' }}</div>
      <div v-if="currentPosition">Position: {{ currentPosition.lat.toFixed(4) }}, {{ currentPosition.lng.toFixed(4) }}</div>
      <div v-if="currentPosition">Accuracy: {{ currentPosition.accuracy }}m</div>
      <div>Intentos imprecisos: {{ impreciseAttempts }}/{{ MAX_IMPRECISE_ATTEMPTS }}</div>
    </div>
  </div>
</template>