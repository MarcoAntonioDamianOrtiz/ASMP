<script setup lang="ts">
import { ref } from "vue";
import { useUserStore } from "@/stores/user";
import { RouterLink } from "vue-router";

const email = ref("");
const password = ref("");
const showPassword = ref(false);
const selectedRole = ref<'guardian' | 'protegido'>('guardian');

const userStore = useUserStore();

const selectRole = (role: 'guardian' | 'protegido') => {
    selectedRole.value = role;
    userStore.setCurrentRole(role);
};

const login = () => {
    userStore.login(email.value, password.value)
        .then(() => {
            console.log("Usuario logueado exitosamente");
        })
        .catch((error) => {
            console.error("Error al iniciar sesión:", error);
        });
};

const loginWithGoogle = () => {
    userStore.loginWithGoogle()
        .then(() => {
            console.log("Usuario logueado con Google exitosamente");
        })
        .catch((error) => {
            console.error("Error al iniciar sesión con Google:", error);
        });
};
</script>

<template>
    <div class="min-h-screen custom-green-bg flex items-center justify-center px-4">
        <div class="bg-white rounded-3xl shadow-xl p-8 w-full max-w-md">
            <!-- Header -->
            <div class="text-center mb-8">
                <h2 class="text-2xl font-bold text-green-800 mb-2">Seguridad personal</h2>
                <h3 class="text-lg font-semibold text-gray-700 mb-1">Iniciar sesión</h3>
                <p class="text-sm text-gray-600">Accede a tu sistema de seguridad</p>
            </div>
            
            <!-- Toggle Buttons -->
            <div class="flex mb-4 bg-gray-100 rounded-lg p-1">
                <button 
                    @click="selectRole('guardian')"
                    :class="[
                        'flex-1 py-2 px-4 rounded-md font-medium text-sm transition-all',
                        selectedRole === 'guardian' 
                            ? 'bg-green-500 text-white' 
                            : 'text-gray-600 hover:bg-gray-200'
                    ]"
                >
                    Guardian
                </button>
                <button 
                    @click="selectRole('protegido')"
                    :class="[
                        'flex-1 py-2 px-4 rounded-md font-medium text-sm transition-all',
                        selectedRole === 'protegido' 
                            ? 'bg-green-500 text-white' 
                            : 'text-gray-600 hover:bg-gray-200'
                    ]"
                >
                    Protegido
                </button>
            </div>

            <!-- Mensaje informativo según rol -->
            <div class="mb-6 p-3 rounded-lg" :class="selectedRole === 'guardian' ? 'bg-blue-50 border border-blue-200' : 'bg-orange-50 border border-orange-200'">
                <div v-if="selectedRole === 'guardian'" class="text-sm text-blue-800">
                    <strong>Acceso Guardian:</strong> Panel de administración completo con estadísticas y monitoreo.
                </div>
                <div v-else class="text-sm text-orange-800">
                    <strong>Control parental activado:</strong> Las cuentas de los protegidos requieren supervisión parental y tienen funcionalidades limitadas por seguridad.
                </div>
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
                        placeholder="tu@correo.com"/>
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
                            placeholder="••••••••"/>
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
            
            <!-- Linea -->
            <div class="flex items-center my-6">
                <div class="flex-1 border-t border-gray-300"></div>
                <span class="px-4 text-sm text-gray-500">o</span>
                <div class="flex-1 border-t border-gray-300"></div>
            </div>

            <!-- Botón de Google -->
            <button
                @click="loginWithGoogle"
                type="button"
                class="w-full bg-white border border-gray-300 hover:bg-gray-50 text-gray-700 font-semibold py-2 px-4 rounded-lg transition-colors duration-200 flex items-center justify-center gap-2">
                <img src="https://developers.google.com/identity/images/g-logo.png" alt="Google" class="w-5 h-5" />
                Continuar con Google
            </button>

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