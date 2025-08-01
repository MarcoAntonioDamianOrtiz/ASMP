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
                <!-- Tarjeta Blanca -->
                <div class="bg-custom-bg rounded-3xl shadow-lg p-8 md:p-12 text-center mt-8 mb-8">
                    <h1 class="mifrase">
                        Prote inteligente<br />
                        para tu familia
                    </h1>
                    <p class="mt-8 text-base md:text-lg lg:text-xl text-gray-700 max-w-4xl mx-auto">
                        Sistema avanzado de seguridad personal con localización GPS en tiempo real, alertas
                        automáticas y monitoreo 24/7 para mantener a tus seres queridos siempre seguros.
                    </p>
                </div>
            </div>
        </div>
</LayoutView>
</template>