<script setup lang="ts">
import { RouterLink } from 'vue-router';
import { computed } from 'vue';
import Link from './Link.vue';
import Logo from './Logo.vue';
import { useUserStore } from '@/stores/user';

const userStore = useUserStore();

const isAuthenticated = computed(() => userStore.isAuthenticated);
const isGuardian = computed(() => userStore.isGuardian);
const userEmail = computed(() => userStore.userProfile?.email || userStore.user?.email);

const logout = () => {
    userStore.logout();
};
</script>

<template>
    <header class="px-10 py-5 bg-white flex justify-between absolute top-0 w-full z-10">
        <div>
            <Logo />
        </div>
        <nav class="flex items-center space-x-4">
            <RouterLink :to="{ name: 'Index' }"
                class="rounded text-green-500 font-bold p-2 hover:bg-gray-100 transition-colors">
                Inicio
            </RouterLink>
                
            <RouterLink :to="{ name: 'Nosotros' }"
                class="rounded text-green-500 font-bold p-2 hover:bg-gray-100 transition-colors">
                Nosotros
            </RouterLink>

            <RouterLink :to="{ name: 'Contacto' }"
                class="rounded text-green-500 font-bold p-2 hover:bg-gray-100 transition-colors">
                Contacto
            </RouterLink>
            <RouterLink 
                v-if="isAuthenticated" 
                :to="{ name: 'Estadisticas' }"
                class="rounded text-green-500 font-bold p-2 hover:bg-gray-100 transition-colors">
                Estadísticas
            </RouterLink>
            
            <!-- Mostrar botón de login/logout según estado de autenticación -->
            <div v-if="!isAuthenticated">
                <Link to="Login">
                    Iniciar sesión
                </Link>
            </div>
            
            <div v-else class="flex items-center space-x-3">
                <span class="text-sm text-gray-600">
                    {{ userEmail }}
                </span>
                <button 
                    @click="logout"
                    class="rounded hover:bg-red-700 font-bold py-2 px-6 text-white bg-red-600 transition-colors duration-200">
                    Cerrar sesión
                </button>
            </div>
        </nav>
    </header>
</template>