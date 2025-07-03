<script setup lang="ts">
import { RouterView } from 'vue-router';
import AdminNav from '@/components/AdminNav.vue';
</script>

<template>
    <div class="min-h-screen bg-gray-100">
        <AdminNav />
        <div class="pt-32">
            <h1>Inicio De Sesion</h1>
            <RouterView />
        </div>
    </div>
</template>