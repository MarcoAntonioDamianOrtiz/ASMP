<script setup lang="ts">
import MainNav from '../components/MainNav.vue';
</script>

<template>
    <div class="min-h-screen custom-green-bg">
        <MainNav />
        <div class="pt-32 container mx-auto lg:min-h-screen">
            <RouterView />

            <!-- Tarjeta Blanca -->
            <div class="bg-custom-bg rounded-3xl shadow-lg p-10 text-center">
                <h1 class="mifrase">
                    Protección inteligente<br />
                    para tu familia
                </h1>
                <p class="mt-12 text-base md:text-lg lg:text-xl">
                    Sistema avanzado de seguridad personal con localización GPS en tiempo real, alertas
                    automáticas y monitoreo 24/7 para mantener a tus seres queridos siempre seguros.
                </p>
                <!-- Tarjetas pequeñas -->
                <div class="grid grid-cols-1 md:grid-cols-3 gap-6 mt-12 mb-12">
                    <div class="border-3 border-orange-500 p-6 rounded-lg">
                        <h2 class="text-2xl font-semibold text-green-800">24/7</h2>
                        <p class="text-green-800">Monitoreo continuo</p>
                    </div>
                    <div class="border-3 border-orange-500 p-6 rounded-lg">
                        <h2 class="text-2xl font-semibold text-green-800">&lt; 30s</h2>
                        <p class="text-green-800">Tiempo de respuesta</p>
                    </div>
                    <div class="border-3 border-orange-500 p-6 rounded-lg">
                        <h2 class="text-2xl font-semibold text-green-800">99.9%</h2>
                        <p class="text-green-800">Disponibilidad</p>
                    </div>
                </div>
                <!--Funcionalidades Principales-->
                <h1 class="FuncionalidadesPrincipales">
                    Funcionalidades Principales
                </h1>
                <div class="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6">
                    <div class="border border-white bg-white p-6 rounded-lg">
                        <img src="@/assets/icons/ubicacion.png" alt="Icono GPS" class="w-12 h-12 mb-2 mx-auto" />
                        <h3 class="text-green-900 font-semibold mb-2">GPS avanzado</h3>
                        <p class="text-sm text-green-900">Localización precisa incluso en segundo 
                            plano con bajo consumo de batería.</p>
                    </div>
                    <div class="border border-white bg-white p-6 rounded-lg">
                        <img src="@/assets/icons/alerta.png" alt="Icono Alertas" class="w-12 h-12 mb-2 mx-auto" />
                        <h3 class="text-green-900 font-semibold mb-2">Alertas inteligentes</h3>
                        <p class="text-sm text-green-900">Notificaciones por voz.</p>
                    </div>
                    <div class="border border-white bg-white p-6 rounded-lg">
                        <img src="@/assets/icons/monitoreo.png" alt="Icono Zonas Seguras" class="w-12 h-12 mb-2 mx-auto" />
                        <h3 class="text-green-900 font-semibold mb-2">Zonas seguras</h3>
                        <p class="text-sm text-green-900">Geofencing inteligente que 
                            alerta de ubicaciones peligrosas.</p>
                    </div>
                    <div class="border border-white bg-white p-6 rounded-lg">
                        <img src="@/assets/icons/smartwatch.png" alt="Icono Smartwatch" class="w-12 h-12 mb-2 mx-auto" />
                        <h3 class="text-green-900 font-semibold mb-2">Smartwatch</h3>
                        <p class="text-sm text-green-900">Integración completa con 
                            dispositivos portátiles para máxima comodidad.</p>
                    </div>
                    <div class="border border-white bg-white p-6 rounded-lg">
                        <img src="@/assets/icons/estadisticas.png" alt="Icono Estadísticas" class="w-12 h-12 mb-2 mx-auto" />
                        <h3 class="text-green-900 font-semibold mb-2">Estadísticas</h3>
                        <p class="text-sm text-green-900">Análisis detallado de patrones 
                            de seguridad y zonas de riesgo.</p>
                    </div>
                    <div class="border border-white bg-white p-6 rounded-lg">
                        <img src="@/assets/icons/seguridad.png" alt="Icono Seguridad" class="w-12 h-12 mb-2 mx-auto" />
                        <h3 class="text-green-900 font-semibold mb-2">Máxima seguridad</h3>
                        <p class="text-sm text-green-900">Cifrado de datos y acceso 
                            restringido por grupos.</p>
                    </div>
                </div>
            </div>
        </div>
    </div>
</template>