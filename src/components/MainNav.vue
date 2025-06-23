<script setup lang="ts">
import { RouterLink } from 'vue-router';
import Link from './Link.vue';
import Logo from './Logo.vue';
</script>
<template>
    <header class="px-10 py-5 bg-gray-700 flex justify-between absolute top-0 w-full z-10">
        <div>
            <Logo />
        </div>
        <nav>
            <RouterLink
            :to="{name: 'Nosotros'}"
            class=" rounded text-white font-bold p-2"
            >
                Nosotros
            </RouterLink>
            <Link to="admin">
            Iniciar sesión
            </Link>
        </nav>

    </header>
</template>
