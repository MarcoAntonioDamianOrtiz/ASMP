<script setup lang="ts">
    import { RouterLink } from 'vue-router'

    defineProps({
        to: {
            type: String
        }
    })
</script>

<template>
    <RouterLink
    :to="{name: to}"
    class="rounded hover:bg-orange-600 font-bold py-2 px-10 text-white bg-orange-600"
    >
        <slot>

        </slot>
    </RouterLink>
</template>


