<script setup lang="ts">
import { RouterLink } from 'vue-router'

defineProps({
    to: {
        type: String,
        required: true
    }
})
</script>

<template>
    <RouterLink
        :to="{ name: to }"
        class="rounded hover:bg-orange-700 font-bold py-2 px-6 text-white bg-orange-600 transition-colors duration-200 inline-block"
    >
        <slot></slot>
    </RouterLink>
</template>