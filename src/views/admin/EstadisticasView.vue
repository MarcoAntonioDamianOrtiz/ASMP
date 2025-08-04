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
                        </div>
                        </div>
                        </div>
                        </div>
    </LayoutView>
    </template>