<script setup lang="ts">
import { ref, onMounted, nextTick, computed, onUnmounted } from 'vue';
import MainNav from '../../components/MainNav.vue';
import LayoutView from './LayoutView.vue';
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';
import { 
  getUsers, getUserByEmail, getGroups, createGroup, deleteGroup, 
  addMemberToGroup, getAlerts, markAlertAsRead, subscribeToGroups, 
  subscribeToAlerts, type FirebaseUser, type FirebaseGroup, type FirebaseAlert 
} from '@/firebase/firestore';

// Referencias reactivas
const mapContainer = ref<HTMLElement>();
const map = ref<mapboxgl.Map | null>(null);
const selectedTab = ref<'ubicaciones' | 'alertas' | 'grupos'>('ubicaciones');
const sidebarOpen = ref(true);
const showCreateGroup = ref(false);
const showAddMember = ref(false);
const selectedGroupId = ref<string | null>(null);
const loading = ref(true);

// Datos reactivos
const users = ref<FirebaseUser[]>([]);
const groups = ref<FirebaseGroup[]>([]);
const alerts = ref<FirebaseAlert[]>([]);

// Filtros
const alertTimeFilter = ref<'today' | 'week' | 'month'>('today');
const showAllAlerts = ref(false);

// Formularios
const newGroup = ref({ name: '', description: '' });
const memberEmail = ref('');
const searchResult = ref<FirebaseUser | null>(null);
const errorMessage = ref('');

// Token de Mapbox
const MAPBOX_TOKEN = 'pk.eyJ1IjoiYW50b255MjcwNCIsImEiOiJjbWQweGg4d2IxOGdnMmtwemp3Nnp0YmIxIn0.-Hm3lVWw6U-NE10a0u2U2A';

// Computed properties
const onlineUsers = computed(() => users.value.filter(u => u.status === 'online'));
const unreadAlerts = computed(() => alerts.value.filter(a => !a.read).length);

const filteredAlerts = computed(() => {
  const now = new Date();
  const filtered = alerts.value.filter(alert => {
    const alertDate = new Date(alert.timestamp);
    switch (alertTimeFilter.value) {
      case 'today':
        return alertDate.toDateString() === now.toDateString();
      case 'week':
        const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        return alertDate >= weekAgo;
      case 'month':
        const monthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        return alertDate >= monthAgo;
      default:
        return true;
    }
  });
  return showAllAlerts.value ? filtered : filtered.slice(0, 3);
});

const currentGroup = computed(() => 
  selectedGroupId.value ? groups.value.find(g => g.id === selectedGroupId.value) : null
);

const availableUsers = computed(() => 
  currentGroup.value ? users.value.filter(user => !currentGroup.value!.members.includes(user.email)) : []
);

// Listeners de Firebase
let unsubscribeGroups: (() => void) | null = null;
let unsubscribeAlerts: (() => void) | null = null;

// Funciones del mapa
const initMap = async () => {
  if (!mapContainer.value) return;

  mapboxgl.accessToken = MAPBOX_TOKEN;

  try {
    map.value = new mapboxgl.Map({
      container: mapContainer.value,
      style: 'mapbox://styles/mapbox/streets-v12',
      center: [-97.9691, 19.3867],
      zoom: 12
    });

    map.value.on('load', () => {
      addMarkersToMap();
      loading.value = false;
    });

  } catch (error) {
    console.error('Error inicializando mapa:', error);
    loading.value = false;
  }
};

const addMarkersToMap = () => {
  if (!map.value) return;

  // Limpiar marcadores existentes
  document.querySelectorAll('.custom-marker').forEach(marker => marker.remove());

  // Obtener usuarios a mostrar según la pestaña seleccionada
  let usersToShow = users.value;
  
  if (selectedTab.value === 'grupos' && currentGroup.value) {
    usersToShow = users.value.filter(user => currentGroup.value!.members.includes(user.email));
  }

  // Agregar marcadores de usuarios
  usersToShow.forEach(user => {
    if (!user.coordinates) return;

    const el = document.createElement('div');
    el.className = 'custom-marker';
    el.style.cssText = `
      width: 40px; height: 40px; border-radius: 50%;
      background-color: ${user.status === 'online' ? '#10b981' : '#ef4444'};
      color: white; display: flex; align-items: center; justify-content: center;
      font-weight: bold; border: 3px solid white; box-shadow: 0 2px 4px rgba(0,0,0,0.3);
      cursor: pointer; font-size: 14px; transition: transform 0.2s;
    `;
    el.textContent = user.name.charAt(0).toUpperCase();

    const popup = new mapboxgl.Popup({ offset: 25 }).setHTML(`
      <div class="p-3">
        <h3 class="font-bold text-sm mb-1">${user.name}</h3>
        <p class="text-xs text-gray-600 mb-1">${user.email}</p>
        <p class="text-xs text-gray-600 mb-2">${user.location || 'Ubicación no disponible'}</p>
        <div class="flex items-center gap-2">
          <div class="w-2 h-2 rounded-full ${user.status === 'online' ? 'bg-green-500' : 'bg-red-500'}"></div>
          <span class="text-xs ${user.status === 'online' ? 'text-green-600' : 'text-red-600'}">
            ${user.status === 'online' ? 'En línea' : 'Desconectado'}
          </span>
        </div>
        <span class="inline-block mt-2 px-2 py-1 text-xs rounded ${user.role === 'guardian' ? 'bg-green-100 text-green-800' : 'bg-blue-100 text-blue-800'}">
          ${user.role === 'guardian' ? 'Guardian' : 'Protegido'}
        </span>
      </div>
    `);

    new mapboxgl.Marker(el)
      .setLngLat(user.coordinates)
      .setPopup(popup)
      .addTo(map.value!);
  });

  // Agregar marcadores de alertas si está en la pestaña de alertas
  if (selectedTab.value === 'alertas') {
    filteredAlerts.value.forEach(alert => {
      const el = document.createElement('div');
      el.className = 'custom-marker alert-marker';
      el.style.cssText = `
        width: 32px; height: 32px; border-radius: 50%;
        background-color: ${getAlertColor(alert.type)};
        color: white; display: flex; align-items: center; justify-content: center;
        font-weight: bold; border: 2px solid white; box-shadow: 0 2px 8px rgba(0,0,0,0.3);
        cursor: pointer; animation: ${alert.type === 'emergency' ? 'pulse 1s infinite' : 'none'};
      `;
      el.innerHTML = getAlertIcon(alert.type);

      const popup = new mapboxgl.Popup({ offset: 25 }).setHTML(`
        <div class="p-3">
          <h3 class="font-bold text-sm mb-1">${alert.userName}</h3>
          <p class="text-sm text-gray-600 mb-2">${alert.message}</p>
          <p class="text-xs text-gray-500">${formatTimeAgo(alert.timestamp)}</p>
        </div>
      `);

      new mapboxgl.Marker(el)
        .setLngLat(alert.coordinates)
        .setPopup(popup)
        .addTo(map.value!);
    });
  }
};

// Funciones de utilidad
const getAlertColor = (type: string) => {
  switch (type) {
    case 'emergency': return '#dc2626';
    case 'warning': return '#f59e0b';
    case 'info': return '#3b82f6';
    default: return '#6b7280';
  }
};

const getAlertIcon = (type: string) => {
  switch (type) {
    case 'emergency': return '🚨';
    case 'warning': return '⚠️';
    case 'info': return 'ℹ️';
    default: return '📍';
  }
};

const formatTimeAgo = (date: Date) => {
  const now = new Date();
  const diff = now.getTime() - new Date(date).getTime();
  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);

  if (minutes < 1) return 'ahora';
  if (minutes < 60) return `hace ${minutes} min`;
  if (hours < 24) return `hace ${hours} hrs`;
  return `hace ${days} días`;
};

// Funciones de navegación
const switchTab = (tab: 'ubicaciones' | 'alertas' | 'grupos') => {
  selectedTab.value = tab;
  addMarkersToMap();
};

const toggleSidebar = () => {
  sidebarOpen.value = !sidebarOpen.value;
};

// Funciones de grupos
const handleCreateGroup = async () => {
  if (!newGroup.value.name.trim()) return;

  try {
    await createGroup({
      name: newGroup.value.name,
      description: newGroup.value.description,
      createdBy: 'current-user', // Reemplazar con usuario actual
      members: []
    });

    newGroup.value = { name: '', description: '' };
    showCreateGroup.value = false;
  } catch (error) {
    console.error('Error creando grupo:', error);
    alert('Error al crear el grupo');
  }
};

const handleDeleteGroup = async (groupId: string) => {
  if (confirm('¿Estás seguro de que quieres eliminar este grupo?')) {
    try {
      await deleteGroup(groupId);
    } catch (error) {
      console.error('Error eliminando grupo:', error);
      alert('Error al eliminar el grupo');
    }
  }
};

// Funciones de miembros
const searchMember = async () => {
  if (!memberEmail.value.trim()) return;
  
  errorMessage.value = '';
  searchResult.value = null;
  
  try {
    const user = await getUserByEmail(memberEmail.value.trim());
    
    if (user) {
      if (currentGroup.value?.members.includes(user.email)) {
        errorMessage.value = 'Este usuario ya pertenece al grupo';
      } else {
        searchResult.value = user;
      }
    } else {
      errorMessage.value = 'No se encontró un usuario con ese email';
    }
  } catch (error) {
    errorMessage.value = 'Error al buscar el usuario';
  }
};

const handleAddMember = async () => {
  if (!searchResult.value || !selectedGroupId.value) return;
  
  try {
    await addMemberToGroup(selectedGroupId.value, searchResult.value.email);
    memberEmail.value = '';
    searchResult.value = null;
    errorMessage.value = '';
    showAddMember.value = false;
  } catch (error) {
    errorMessage.value = 'Error al agregar el miembro al grupo';
  }
};

const quickAddMember = async (userEmail: string) => {
  if (!selectedGroupId.value) return;
  
  try {
    await addMemberToGroup(selectedGroupId.value, userEmail);
  } catch (error) {
    console.error('Error al agregar miembro:', error);
  }
};

// Funciones de alertas
const handleMarkAsRead = async (alertId: string) => {
  try {
    await markAlertAsRead(alertId);
  } catch (error) {
    console.error('Error marcando alerta como leída:', error);
  }
};

// Ciclo de vida
onMounted(async () => {
  try {
    // Cargar datos iniciales
    users.value = await getUsers();
    
    // Configurar listeners en tiempo real
    unsubscribeGroups = subscribeToGroups((newGroups) => {
      groups.value = newGroups;
    });
    
    unsubscribeAlerts = subscribeToAlerts((newAlerts) => {
      alerts.value = newAlerts;
      addMarkersToMap(); // Actualizar marcadores cuando cambien las alertas
    });

    await nextTick();
    setTimeout(initMap, 100);
  } catch (error) {
    console.error('Error cargando datos:', error);
    loading.value = false;
  }
});

onUnmounted(() => {
  if (unsubscribeGroups) unsubscribeGroups();
  if (unsubscribeAlerts) unsubscribeAlerts();
});
</script>

<template>
  <LayoutView>
    <MainNav />
    
    <div class="pt-20 pb-8 flex">
      <!-- Sidebar -->
      <div class="fixed left-0 top-20 h-full z-40 transition-all duration-300"
           :class="sidebarOpen ? 'w-80' : 'w-16'">
        
        <!-- Toggle Button -->
        <button 
          @click="toggleSidebar"
          class="absolute -right-3 top-4 bg-white border border-gray-300 rounded-full p-1 shadow-md hover:shadow-lg z-50">
          <svg class="w-4 h-4" :class="{ 'rotate-180': !sidebarOpen }" fill="none" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7" />
          </svg>
        </button>

        <div class="bg-white h-full shadow-lg overflow-hidden">
          <div class="p-4 space-y-6">
            
            <!-- Navegación -->
            <div v-if="sidebarOpen" class="space-y-2">
              <h3 class="font-semibold text-gray-800 text-sm">Navegación</h3>
              <div class="space-y-1">
                <button 
                  @click="switchTab('ubicaciones')"
                  :class="`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${selectedTab === 'ubicaciones' ? 'bg-green-500 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`">
                  📍 Ubicaciones
                </button>
                <button 
                  @click="switchTab('alertas')"
                  :class="`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${selectedTab === 'alertas' ? 'bg-green-500 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`">
                  🚨 Alertas
                  <span v-if="unreadAlerts > 0" class="ml-auto px-2 py-0.5 bg-red-500 text-white text-xs rounded-full">{{ unreadAlerts }}</span>
                </button>
                <button 
                  @click="switchTab('grupos')"
                  :class="`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${selectedTab === 'grupos' ? 'bg-green-500 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`">
                  👥 Grupos
                </button>
              </div>
            </div>

            <!-- Iconos (cuando está cerrado) -->
            <div v-else class="space-y-4 flex flex-col items-center">
              <button 
                @click="switchTab('ubicaciones')"
                :class="`p-2 rounded-lg transition-colors ${selectedTab === 'ubicaciones' ? 'bg-green-500 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`">
                📍
              </button>
              <button 
                @click="switchTab('alertas')"
                :class="`p-2 rounded-lg transition-colors relative ${selectedTab === 'alertas' ? 'bg-green-500 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`">
                🚨
                <span v-if="unreadAlerts > 0" class="absolute -top-1 -right-1 w-5 h-5 bg-red-500 text-white text-xs rounded-full flex items-center justify-center">{{ unreadAlerts }}</span>
              </button>
              <button 
                @click="switchTab('grupos')"
                :class="`p-2 rounded-lg transition-colors ${selectedTab === 'grupos' ? 'bg-green-500 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`">
                👥
              </button>
            </div>

            <!-- Estadísticas -->
            <div v-if="sidebarOpen" class="bg-gray-50 rounded-lg p-4">
              <h3 class="font-semibold text-gray-800 mb-3 text-sm">Resumen</h3>
              <div class="grid grid-cols-2 gap-3">
                <div class="text-center p-2 bg-green-50 rounded-lg">
                  <div class="text-xl font-bold text-green-600">{{ onlineUsers.length }}</div>
                  <div class="text-xs text-green-600">En línea</div>
                </div>
                <div class="text-center p-2 bg-blue-50 rounded-lg">
                  <div class="text-xl font-bold text-blue-600">{{ users.length }}</div>
                  <div class="text-xs text-blue-600">Total</div>
                </div>
              </div>
            </div>

            <!-- Grupos -->
            <div v-if="sidebarOpen" class="bg-white border border-gray-200 rounded-lg p-4">
              <div class="flex items-center justify-between mb-3">
                <h3 class="font-semibold text-gray-800 text-sm">Mis Grupos</h3>
                <button 
                  @click="showCreateGroup = true"
                  class="px-2 py-1 bg-green-500 text-white text-xs rounded hover:bg-green-600 transition-colors">
                  + Crear
                </button>
              </div>
              
              <div v-if="groups.length === 0" class="text-center py-3 text-gray-500 text-xs">
                No tienes grupos creados
              </div>
              
              <div v-else class="space-y-2 max-h-48 overflow-y-auto">
                <div v-for="group in groups" :key="group.id" class="p-2 bg-gray-50 rounded border">
                  <div class="flex items-start justify-between">
                    <div class="flex-1 min-w-0">
                      <h4 class="font-medium text-gray-800 text-xs truncate">{{ group.name }}</h4>
                      <p class="text-xs text-gray-600 truncate">{{ group.description }}</p>
                      <div class="text-xs text-gray-500 mt-1">
                        {{ group.members.length }} miembros
                      </div>
                    </div>
                    <div class="flex gap-1 ml-2">
                      <button 
                        @click="selectedGroupId = group.id; showAddMember = true"
                        class="text-blue-600 hover:text-blue-800 text-xs"
                        title="Agregar miembro">
                        ➕
                      </button>
                      <button 
                        @click="handleDeleteGroup(group.id)"
                        class="text-red-600 hover:text-red-800 text-xs"
                        title="Eliminar grupo">
                        🗑️
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Contenido Principal -->
      <div class="flex-1 px-4" :class="{ 'ml-80': sidebarOpen, 'ml-16': !sidebarOpen }">
        <div class="grid grid-cols-1 lg:grid-cols-3 gap-6">
          
          <!-- Mapa -->
          <div class="lg:col-span-2">
            <div class="bg-white rounded-lg shadow-sm overflow-hidden">
              <div class="p-4 border-b border-gray-200">
                <h2 class="font-semibold text-gray-800 mb-4">Panel de Control</h2>
              </div>
              
              <div class="relative">
                <div ref="mapContainer" class="w-full h-96"></div>
                <div v-if="loading" class="absolute inset-0 bg-gray-100 flex items-center justify-center">
                  <div class="text-center">
                    <div class="animate-spin rounded-full h-8 w-8 border-b-2 border-green-500 mx-auto mb-2"></div>
                    <p class="text-sm text-gray-600">Cargando mapa...</p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <!-- Panel de Alertas -->
          <div class="lg:col-span-1">
            <div class="bg-white rounded-lg shadow-sm p-4">
              <div class="mb-4">
                <h3 class="font-semibold text-gray-800 mb-3">Alertas Recibidas</h3>
                <div class="flex gap-1 mb-3">
                  <button 
                    @click="alertTimeFilter = 'today'"
                    :class="`px-2 py-1 text-xs rounded transition-colors ${alertTimeFilter === 'today' ? 'bg-blue-500 text-white' : 'bg-gray-100 text-gray-600'}`">
                    Hoy
                  </button>
                  <button 
                    @click="alertTimeFilter = 'week'"
                    :class="`px-2 py-1 text-xs rounded transition-colors ${alertTimeFilter === 'week' ? 'bg-blue-500 text-white' : 'bg-gray-100 text-gray-600'}`">
                    Semana
                  </button>
                  </div>
              </div>
              </div>
          </div>
          </div>
          </div>
          </div>
  </LayoutView>
  </template>