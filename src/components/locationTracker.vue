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
  <div class="bg-white rounded-lg shadow-lg p-4 max-w-sm">
    <div class="flex items-center justify-between mb-4">
      <h3 class="text-lg font-semibold text-gray-800 flex items-center">
        <svg class="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"></path>
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"></path>
        </svg>
        Rastreo GPS
      </h3>
      <div 
        :class="isTracking ? 'bg-green-500' : 'bg-gray-400'"
        class="w-3 h-3 rounded-full"
        :title="isTracking ? 'Activo' : 'Inactivo'"
      ></div>
    </div>

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

    <!-- Controles -->
    <div class="flex gap-2">
      <button
        v-if="!isTracking"
        @click="startTracking"
        class="flex-1 bg-green-500 hover:bg-green-600 text-white font-medium py-2 px-4 rounded-lg transition-colors duration-200 text-sm"
      >
        Iniciar Rastreo
      </button>
      <button
        v-else
        @click="stopTracking"
        class="flex-1 bg-red-500 hover:bg-red-600 text-white font-medium py-2 px-4 rounded-lg transition-colors duration-200 text-sm"
      >
        Detener Rastreo
      </button>
      
      <button
        @click="getLocationOnce"
        class="bg-blue-500 hover:bg-blue-600 text-white font-medium py-2 px-4 rounded-lg transition-colors duration-200 text-sm"
        title="Obtener ubicación actual"
      >
        📍
      </button>
    </div>

    <!-- Información adicional -->
    <div class="mt-3 text-xs text-gray-500 text-center">
      <p>El rastreo GPS se actualiza automáticamente</p>
      <p>Asegúrate de permitir el acceso a la ubicación</p>
    </div>
  </div>
</template>
