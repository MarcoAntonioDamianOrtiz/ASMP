<script setup lang="ts">
import { ref } from "vue";
import { useUserStore } from "@/stores/user";
import { RouterLink } from "vue-router";

const email = ref("");
const password = ref("");
const showPassword = ref(false);

const userStore = useUserStore();

const login = () => {
    userStore.login(email.value, password.value)
        .then(() => {
            console.log("Usuario logueado exitosamente");
        })
        .catch((error) => {
            console.error("Error al iniciar sesión:", error);
        });
};
</script>

<template>
    <div class="min-h-screen custom-green-bg flex items-center justify-center px-4">
        <div class="bg-white rounded-3xl shadow-xl p-8 w-full max-w-md">
            <!-- Header -->
            <div class="text-center mb-8">
                <h2 class="text-2xl font-bold text-green-800 mb-2">Seguridad personal</h2>
                <h3 class="text-lg font-semibold text-gray-700 mb-1">Crear cuenta</h3>
                <p class="text-sm text-gray-600">Únete a nuestro sistema de seguridad</p>
            </div>
            




            <!-- Buttons -->
            <div class="flex mb-6 bg-gray-100 rounded-lg p-1">
                <button 
                    class="flex-1 py-2 px-4 rounded-md bg-green-500 text-white font-medium text-sm transition-all">Guardian
                </button>
                <button 
                    class="flex-1 py-2 px-4 rounded-md text-gray-600 font-medium text-sm transition-all hover:bg-gray-200">Protegido
                </button>
            </div>

            <!-- Formulario -->
            <form @submit.prevent="login" class="space-y-4">
                <div>
                    <label for="email" class="block text-sm font-medium text-gray-700 mb-1">
                        Correo electrónico
                    </label>
                    <input
                        id="email"
                        type="email"
                        v-model="email"
                        required
                        class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-green-500"
                        placeholder="utt@correo.com"/>
                </div>

                <!-- Password -->
                <div>
                    <label for="password" class="block text-sm font-medium text-gray-700 mb-1">
                        Contraseña
                    </label>
                    <div class="relative">
                        <input
                            id="password"
                            :type="showPassword ? 'text' : 'password'"
                            v-model="password"
                            required
                            class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-green-500 pr-10"
                            placeholder="Juan1234#"/>
                        <button
                            type="button"
                            @click="showPassword = !showPassword"
                            class="absolute inset-y-0 right-0 pr-3 flex items-center">
                            <span class="text-gray-500 text-sm">
                                {{ showPassword ? '👁️' : '👁️‍🗨️' }}
                            </span>
                        </button>
                    </div>
                </div>
                <div class="flex items-center justify-between">
                    <label class="flex items-center">
                        <input type="checkbox" class="mr-2 rounded border-gray-300 text-green-600 focus:ring-green-500" />
                        <span class="text-sm text-gray-600">Recordarme</span>
                    </label>
                    <a href="#" class="text-sm text-orange-600 hover:text-orange-700">
                        ¿Olvidaste tu contraseña?
                    </a>
                </div>
                <button
                    type="submit"
                    class="w-full bg-green-500 hover:bg-green-600 text-white font-semibold py-2 px-4 rounded-lg transition-colors duration-200">
                    Iniciar sesión
                </button>
            </form>



            <!-- Registrarse -->
            <div class="text-center mt-6">
                <span class="text-gray-600 text-sm">¿No tienes cuenta? </span>
                <RouterLink 
                    :to="{ name: 'Register' }" 
                    class="text-green-600 hover:text-green-700 font-semibold text-sm"
                >
                    Regístrate aquí
                </RouterLink>
            </div>
        </div>
    </div>
</template>