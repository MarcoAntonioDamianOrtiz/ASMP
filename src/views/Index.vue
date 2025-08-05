<script setup lang="ts">
import MainNav from '../components/MainNav.vue';
import LayoutView from './admin/LayoutView.vue';
import LocationTracker from '../components/locationTracker.vue';
import { useUserStore } from '@/stores/user';
import { computed } from 'vue';

const userStore = useUserStore();
const isAuthenticated = computed(() => userStore.isAuthenticated);
</script>


<template>
    <LayoutView>
        <MainNav />
        <!-- Contenedor principal -->
        <div class="pt-20 pb-8 px-4">
            <div class="container mx-auto">

                <!-- Tarjeta Blanca -->
                <div class="bg-custom-bg rounded-3xl shadow-lg p-8 md:p-12 text-center mt-8 mb-8">
                    <h1 class="mifrase">
                        Protección inteligente<br />
                        para tu familia
                    </h1>
                    <p class="mt-8 text-base md:text-lg lg:text-xl text-gray-700 max-w-4xl mx-auto">
                        Sistema avanzado de seguridad personal con localización GPS en tiempo real, alertas
                        automáticas y monitoreo 24/7 para mantener a tus seres queridos siempre seguros.
                    </p>
                    
                    <!-- Tarjetas pequeñas -->
                    <div class="grid grid-cols-1 md:grid-cols-3 gap-6 mt-10 mb-12">
                        <div class="border-3 border-orange-500 p-6 rounded-lg bg-white/50">
                            <h2 class="text-2xl font-semibold text-green-800">24/7</h2>
                            <p class="text-green-800">Monitoreo continuo</p>
                        </div>
                        <div class="border-3 border-orange-500 p-6 rounded-lg bg-white/50">
                            <h2 class="text-2xl font-semibold text-green-800">&lt; 30s</h2>
                            <p class="text-green-800">Tiempo de respuesta</p>
                        </div>
                        <div class="border-3 border-orange-500 p-6 rounded-lg bg-white/50">
                            <h2 class="text-2xl font-semibold text-green-800">99.9%</h2>
                            <p class="text-green-800">Disponibilidad</p>
                        </div>
                    </div>
                    
                    <!-- Funcionalidades Principales -->
                    <h2 class="text-3xl font-bold text-green-800 mb-8 FuncionalidadesPrincipales">
                        Funcionalidades Principales
                    </h2>
                    
                    <div class="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6">
                        <div class="border border-gray-200 bg-white p-6 rounded-lg shadow-sm hover:shadow-md transition-shadow">
                            <img src="@/assets/icons/ubicacion.png" alt="Icono GPS" class="w-12 h-12 mb-4 mx-auto" />
                            <h3 class="text-green-900 font-semibold mb-3">GPS avanzado</h3>
                            <p class="text-sm text-green-900">Localización precisa incluso en segundo 
                                plano con bajo consumo de batería.</p>
                        </div>
                        <div class="border border-gray-200 bg-white p-6 rounded-lg shadow-sm hover:shadow-md transition-shadow">
                            <img src="@/assets/icons/alerta.png" alt="Icono Alertas" class="w-12 h-12 mb-4 mx-auto" />
                            <h3 class="text-green-900 font-semibold mb-3">Alertas inteligentes</h3>
                            <p class="text-sm text-green-900">Notificaciones por voz.</p>
                        </div>
                        <div class="border border-gray-200 bg-white p-6 rounded-lg shadow-sm hover:shadow-md transition-shadow">
                            <img src="@/assets/icons/monitoreo.png" alt="Icono Zonas Seguras" class="w-12 h-12 mb-4 mx-auto" />
                            <h3 class="text-green-900 font-semibold mb-3">Zonas seguras</h3>
                            <p class="text-sm text-green-900">Geofencing inteligente que 
                                alerta de ubicaciones peligrosas.</p>
                        </div>
                        <div class="border border-gray-200 bg-white p-6 rounded-lg shadow-sm hover:shadow-md transition-shadow">
                            <img src="@/assets/icons/smartwatch.png" alt="Icono Smartwatch" class="w-12 h-12 mb-4 mx-auto" />
                            <h3 class="text-green-900 font-semibold mb-3">Smartwatch</h3>
                            <p class="text-sm text-green-900">Integración completa con 
                                dispositivos portátiles para máxima comodidad.</p>
                        </div>
                        <div class="border border-gray-200 bg-white p-6 rounded-lg shadow-sm hover:shadow-md transition-shadow">
                            <img src="@/assets/icons/estadisticas.png" alt="Icono Estadísticas" class="w-12 h-12 mb-4 mx-auto" />
                            <h3 class="text-green-900 font-semibold mb-3">Estadísticas</h3>
                            <p class="text-sm text-green-900">Análisis detallado de patrones 
                                de seguridad y zonas de riesgo.</p>
                        </div>
                        <div class="border border-gray-200 bg-white p-6 rounded-lg shadow-sm hover:shadow-md transition-shadow">
                            <img src="@/assets/icons/seguridad.png" alt="Icono Seguridad" class="w-12 h-12 mb-4 mx-auto" />
                            <h3 class="text-green-900 font-semibold mb-3">Máxima seguridad</h3>
                            <p class="text-sm text-green-900">Cifrado de datos y acceso 
                                restringido por grupos.</p>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    </LayoutView>
</template>
