<script setup lang="ts">
import MainNav from '@/components/MainNav.vue'
import { useUserStore } from '@/stores/user'

const userStore = useUserStore()

const logout = () => {
    userStore.logout()
}
</script>

<template>
    <div class="min-h-screen custom-green-bg">
        <MainNav />
        <div class="text-right p-4">
            <button class="buttons__btn buttons__btn--logout" @click.prevent="logout">
                Logout
            </button>
        </div>
        <slot />
    </div>
</template>


