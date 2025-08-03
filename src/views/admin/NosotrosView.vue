<script setup lang="ts">
import MainNav from '../../components/MainNav.vue';
import LayoutView from './LayoutView.vue';
</script>

<template>
    <LayoutView>
        <MainNav />

        <!-- Contenedor principal -->
        <div class="pt-20 pb-8 px-4">
            <div class="container mx-auto">
                <!-- Tarjeta Principal -->
                <div class="bg-custom-bg rounded-3xl shadow-lg p-8 md:p-12 text-center mt-8 mb-8">

                    <!-- Header con logo y título -->
                    <div class="text-center mb-12">
                        <div class="flex justify-center mb-6">
                            <div class="bg-blue-600 rounded-lg p-4">
                                <img src="@/assets/icons/palomita.png" alt="Logo" class="w-16 h-16 filter invert" />
                            </div>
                        </div>
                        <h1 class="text-4xl font-bold text-green-600 mb-4">UTT</h1>
                        <h2 class="text-3xl text-orange-500 font-semibold">Tu seguridad es nuestra misión</h2>
                    </div>

                    <!-- Misión y Visión -->
                    <div class="grid grid-cols-1 md:grid-cols-2 gap-8 mb-12">
                        <!-- Nuestra Misión -->
                        <div class="border border-gray-200 bg-white p-6 rounded-lg shadow-sm hover:shadow-md transition-shadow">
                            <div class="flex items-center mb-4">
                                <div class="bg-red-100 rounded-full p-3 mr-4">
                                    <img src="@/assets/icons/diana.png" alt="Misión" class="w-12 h-12" />
                                </div>
                                <h3 class="text-xl font-bold text-green-600">Nuestra misión</h3>
                            </div>
                            <p class="text-gray-700 leading-relaxed">
                                Proporcionar tecnología de seguridad personal innovadora y accesible que empodere a las
                                personas para protegerse a sí mismas y a sus seres queridos en cualquier situación.
                            </p>
                        </div>

                        <!-- Nuestra Visión -->
                        <div class="border border-gray-200 bg-white p-6 rounded-lg shadow-sm hover:shadow-md transition-shadow">
                            <div class="flex items-center mb-4">
                                <div class="bg-blue-100 rounded-full p-3 mr-4">
                                    <img src="@/assets/icons/vision.png" alt="Visión" class="w-12 h-12" />
                                </div>
                                <h3 class="text-xl font-bold text-green-600">Nuestra visión</h3>
                            </div>
                            <p class="text-gray-700 leading-relaxed">
                                Ser una plataforma eficiente en la seguridad personal donde cada persona se sienta
                                segura y protegida mediante la tecnología inteligente y la respuesta rápida.
                            </p>
                        </div>
                    </div>

                    <!-- Nuestros Valores -->
                    <div class="mb-12">
                        <div class="flex items-center justify-center mb-8">
                            <img src="@/assets/icons/corazon.png" alt="Valores" class="w-12 h-12 mr-3" />
                            <h3 class="text-2xl font-bold text-green-600">Nuestros valores</h3>
                        </div>

                        <div class="grid grid-cols-1 md:grid-cols-3 gap-6">
                            <!-- Confianza -->
                            <div class="border border-gray-200 bg-white p-6 rounded-lg shadow-sm hover:shadow-md transition-shadow">
                                <div
                                    class="bg-blue-100 rounded-full w-16 h-16 flex items-center justify-center mx-auto mb-4">
                                    <img src="@/assets/icons/confianza.png" alt="Confianza" class="w-12 h-12" />
                                </div>
                                <h4 class="text-lg font-semibold text-green-600 mb-3">Confianza</h4>
                                <p class="text-sm text-gray-600">
                                    Construimos relaciones basadas en la transparencia y la confiabilidad
                                </p>
                            </div>

                            <!-- Innovación -->
                            <div class="border border-gray-200 bg-white p-6 rounded-lg shadow-sm hover:shadow-md transition-shadow">
                                <div
                                    class="bg-yellow-100 rounded-full w-16 h-16 flex items-center justify-center mx-auto mb-4">
                                    <img src="@/assets/icons/innovacion.png" alt="Innovación" class="w-12 h-12" />
                                </div>
                                <h4 class="text-lg font-semibold text-green-600 mb-3">Innovación</h4>
                                <p class="text-sm text-gray-600">
                                    Utilizamos la última tecnología para crear soluciones efectivas
                                </p>
                            </div>

                            <!-- Comunidad -->
                            <div class="border border-gray-200 bg-white p-6 rounded-lg shadow-sm hover:shadow-md transition-shadow">
                                <div
                                    class="bg-green-100 rounded-full w-16 h-16 flex items-center justify-center mx-auto mb-4">
                                    <img src="@/assets/icons/comunidad.png" alt="Comunidad" class="w-12 h-12" />
                                </div>
                                <h4 class="text-lg font-semibold text-green-600 mb-3">Comunidad</h4>
                                <p class="text-sm text-gray-600">
                                    Creamos una red segura que conecta y protege a todos
                                </p>
                            </div>
                        </div>
                    </div>

                    <!-- Nuestro Equipo -->
                    <div>
                        <div class="flex items-center mb-8">
                            <img src="@/assets/icons/equipo.png" alt="Equipo" class="w-12 h-12 mr-3" />
                            <h3 class="text-2xl font-bold text-green-600">Nuestro Equipo</h3>
                        </div>

                        <div class="grid grid-cols-2 md:grid-cols-4 gap-6">
                            <!-- Marco Antonio -->
                            <div class="border border-gray-200 bg-white p-6 rounded-lg shadow-sm hover:shadow-md transition-shadow">
                                <div
                                    class=" flex items-center justify-center mx-auto mb-3">
                                    <img src="@/assets/img/marco.jpg" alt="Usuario" style="border-radius: 50%" class="w-20 h-20" />
                                </div>
                                <h4 class="font-semibold text-gray-800 text-sm">MARCO ANTONIO DAMIAN ORTIZ</h4>
                                <p class="text-xs text-gray-600 mt-1">Sistema de gestión web de seguridad</p>
                            </div>

                            <!-- Antony de la Cruz -->
                            <div class="border border-gray-200 bg-white p-6 rounded-lg shadow-sm hover:shadow-md transition-shadow">
                                <div
                                    class="bg-gray-200 rounded-full w-20 h-20 flex items-center justify-center mx-auto mb-3">
                                    <!-- <img src="@/assets/icons/usuario.png" alt="Usuario" class="w-10 h-10" /> -->
                                </div>
                                <h4 class="font-semibold text-gray-800 text-sm">Antony de la cruz</h4>
                                <p class="text-xs text-gray-600 mt-1">App móvil</p>
                            </div>

                            <!-- Daniel -->
                            <div class="border border-gray-200 bg-white p-6 rounded-lg shadow-sm hover:shadow-md transition-shadow">
                                <div
                                    class="bg-gray-200 rounded-full w-20 h-20 flex items-center justify-center mx-auto mb-3">
                                    <!-- <img src="@/assets/icons/usuario.png" alt="Usuario" class="w-10 h-10" /> -->
                                </div>
                                <h4 class="font-semibold text-gray-800 text-sm">DANIEL</h4>
                                <p class="text-xs text-gray-600 mt-1">IOT</p>
                            </div>

                            <!-- Rodrigo Smartwatch -->
                            <div class="border border-gray-200 bg-white p-6 rounded-lg shadow-sm hover:shadow-md transition-shadow">
                                <div
                                    class="bg-gray-200 rounded-full w-20 h-20 flex items-center justify-center mx-auto mb-3">
                                    <!-- <img src="@/assets/icons/usuario.png" alt="Usuario" class="w-10 h-10" /> -->
                                </div>
                                <h4 class="font-semibold text-gray-800 text-sm">Rodrigo</h4>
                                <p class="text-xs text-gray-600 mt-1">Smartwatch</p>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    </LayoutView>
</template>
