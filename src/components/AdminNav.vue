<script setup lang="ts">
import Link from './Link.vue';
import Logo from './Logo.vue';
</script>
<template>
    <header class="px-10 py-5 bg-white flex justify-between absolute top-0 w-full z-10">
        <div>
            <Logo />
        </div>
        <nav>
            <Link to="Index">
            inicio
            </Link>
        </nav>

    </header>
</template>
