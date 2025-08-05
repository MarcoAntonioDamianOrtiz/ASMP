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
    timeout: 10000,
    maximumAge: 30000 // Cache por 30 segundos
  }

  // Obtener posición inicial
  navigator.geolocation.getCurrentPosition(
    (position) => {
      updateLocation(position)
    },
    (err) => {
      handleError(err)
    },
    options
  )

  // Iniciar rastreo continuo
  watchId.value = navigator.geolocation.watchPosition(
    (position) => {
      updateLocation(position)
    },
    (err) => {
      handleError(err)
    },
    options
  )
}

// Función para detener el rastreo
const stopTracking = () => {
  if (watchId.value !== null) {
    navigator.geolocation.clearWatch(watchId.value)
    watchId.value = null
  }
  isTracking.value = false
  error.value = null
}

// Función para actualizar la ubicación
const updateLocation = async (position: GeolocationPosition) => {
  const { latitude, longitude } = position.coords
  
  currentPosition.value = { lat: latitude, lng: longitude }
  lastUpdate.value = new Date()

  try {
    // Actualizar ubicación en Firebase (no crear nueva)
    await updateUserLocation(userStore.user?.uid || '', {
      userEmail: userStore.user?.email || '',
      userName: userStore.userProfile?.nombre || userStore.user?.displayName || 'Usuario',
      lat: latitude,
      lng: longitude,
      accuracy: position.coords.accuracy
    })

    console.log('Ubicación actualizada:', { lat: latitude, lng: longitude })
  } catch (err) {
    console.error('Error al actualizar ubicación:', err)
    error.value = 'Error al actualizar la ubicación'
  }
}

// Función para manejar errores de geolocalización
const handleError = (err: GeolocationPositionError) => {
  switch (err.code) {
    case err.PERMISSION_DENIED:
      error.value = 'Permiso de ubicación denegado. Por favor, habilita el GPS.'
      break
    case err.POSITION_UNAVAILABLE:
      error.value = 'Información de ubicación no disponible.'
      break
    case err.TIMEOUT:
      error.value = 'Tiempo de espera agotado para obtener la ubicación.'
      break
    default:
      error.value = 'Error desconocido al obtener la ubicación.'
      break
  }
  isTracking.value = false
}

// Función para obtener ubicación una sola vez
const getLocationOnce = () => {
  if (!navigator.geolocation) {
    error.value = 'La geolocalización no está soportada'
    return
  }

  navigator.geolocation.getCurrentPosition(
    (position) => {
      updateLocation(position)
    },
    (err) => {
      handleError(err)
    },
    {
      enableHighAccuracy: true,
      timeout: 10000,
      maximumAge: 60000
    }
  )
}

// Limpiar al desmontar el componente
onUnmounted(() => {
  stopTracking()
  // Marcar usuario como offline al salir
  if (userStore.user?.uid) {
    setUserOffline(userStore.user.uid)
  }
})
</script>

<template>
 

    <!-- Estado actual -->
    <div class="mb-4 text-sm">
      <div v-if="isTracking" class="text-green-600 flex items-center">
        <div class="animate-pulse w-2 h-2 bg-green-500 rounded-full mr-2"></div>
        Rastreando ubicación...
      </div>
      <div v-else class="text-gray-500">
        Rastreo desactivado
      </div>
    </div>

    <!-- Información de ubicación -->
    <div v-if="currentPosition" class="mb-4 p-3 bg-gray-50 rounded-lg text-sm">
      <div class="grid grid-cols-2 gap-2">
        <div>
          <span class="text-gray-600">Lat:</span>
          <span class="font-mono">{{ currentPosition.lat.toFixed(6) }}</span>
        </div>
        <div>
          <span class="text-gray-600">Lng:</span>
          <span class="font-mono">{{ currentPosition.lng.toFixed(6) }}</span>
        </div>
      </div>
      <div v-if="lastUpdate" class="mt-2 text-xs text-gray-500">
        Última actualización: {{ lastUpdate.toLocaleTimeString() }}
      </div>
    </div>

    <!-- Error -->
    <div v-if="error" class="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg">
      <p class="text-red-600 text-sm">{{ error }}</p>
    </div>

    </template>