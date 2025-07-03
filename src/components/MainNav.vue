<script setup lang="ts">
import { RouterLink } from 'vue-router';
import Link from './Link.vue';
import Logo from './Logo.vue';
</script>
<template>
    <header class="px-10 py-5 bg-white flex justify-between absolute top-0 w-full z-10">
        <div>
            <Logo />
        </div>
        <nav class="flex items-center space-x-4">
            <RouterLink :to="{ name: 'Index' }"
                class="rounded text-green-500 font-bold p-2 hover:bg-gray-600 transition-colors">
                Inicio
            </RouterLink>
                
            <RouterLink :to="{ name: 'Nosotros' }"
                class="rounded text-green-500 font-bold p-2 hover:bg-gray-600 transition-colors">
                Nosotros
            </RouterLink>

            <RouterLink :to="{ name: 'Contacto' }"
                class="rounded text-green-500 font-bold p-2 hover:bg-gray-600 transition-colors">
                Contacto
            </RouterLink>
            
            <Link to="main">
            Iniciar sesión
            </Link>
        </nav>
    </header>
</template>