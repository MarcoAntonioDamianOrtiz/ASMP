<script setup lang="ts">
    import Link from './Link.vue';
</script>
<template>
    <header class="px-10 py-5 bg-gray-700 flex justify-between absolute top-0 w-full z-10">
        <div>
            <h1 class="text-3xl font-black">
                POS
                <span class="text-green-500">Vue.js</span>
            </h1>
        </div>

        <nav>
            <Link to="admin">Iniciar sesión</Link>
        </nav>

    </header>
</template>

