<script setup lang="ts">
import { ref } from 'vue';
import MainNav from '../../components/MainNav.vue';
import LayoutView from './LayoutView.vue';

const nombre = ref('');
const apellidos = ref('');
const email = ref('');
const telefono = ref('');
const mensaje = ref('');

// Cambia 'YOUR_FORM_ID' por tu ID real de Formspree
const FORMSPREE_ID = 'xeozleow';

const enviarMensaje = () => {
    // El formulario se enviará automáticamente por Formspree
    console.log('Enviando mensaje a Formspree...');
};
</script>

<template>
    <LayoutView>
        <MainNav />
        
        <!-- Contenedor principal -->
        <div class="pt-20 pb-8 px-4">
            <div class="container mx-auto max-w-6xl">
                
                <div class="bg-white rounded-3xl shadow-lg p-8 text-center mb-8">
                    <div class="flex justify-center mb-4">
                        <div class="bg-green-100 rounded-full p-4">
                            <!-- <img src="@/assets/icons/ayuda.png" alt="Ayuda" class="w-12 h-12" /> -->
                        </div>
                    </div>
                    <h2 class="text-2xl font-bold text-gray-800 mb-2">¿Necesitas ayuda?</h2>
                    <p class="text-gray-600">Estamos aquí para ti</p>
                    <p class="text-sm text-green-600 font-medium mt-2">Contáctanos las 24 horas, los 7 días de la semana</p>
                </div>

                <!-- Contenedor principal de contacto -->
                <div class="grid grid-cols-1 lg:grid-cols-2 gap-8">
                    
                    <div class="bg-white rounded-3xl shadow-lg p-8">
                        <h3 class="text-2xl font-bold text-gray-800 mb-2">Envíanos un mensaje</h3>
                        <p class="text-gray-600 mb-6">Completa el formulario y te responderemos pronto</p>
                        
                        <!-- FORMULARIO CON FORMSPREE -->
                        <form :action="`https://formspree.io/f/${FORMSPREE_ID}`" method="POST" @submit="enviarMensaje" class="space-y-4">
                            <!-- Nombre y Apellidos -->
                            <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div>
                                    <label class="block text-sm font-medium text-orange-600 mb-2">Nombre *</label>
                                    <input
                                        v-model="nombre"
                                        name="nombre"
                                        type="text"
                                        required
                                        class="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-green-500"
                                        placeholder="Tu nombre"
                                    />
                                </div>
                                <div>
                                    <label class="block text-sm font-medium text-orange-600 mb-2">Apellidos *</label>
                                    <input
                                        v-model="apellidos"
                                        name="apellidos"
                                        type="text"
                                        required
                                        class="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-green-500"
                                        placeholder="Tus apellidos"
                                    />
                                </div>
                            </div>

                            <!-- Email y Teléfono -->
                            <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div>
                                    <label class="block text-sm font-medium text-orange-600 mb-2">Email *</label>
                                    <input
                                        v-model="email"
                                        name="email"
                                        type="email"
                                        required
                                        class="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-green-500"
                                        placeholder="tu@email.com"
                                    />
                                </div>
                                <div>
                                    <label class="block text-sm font-medium text-gray-700 mb-2">Teléfono</label>
                                    <input
                                        v-model="telefono"
                                        name="telefono"
                                        type="tel"
                                        class="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-green-500"
                                        placeholder="241 123 4567"
                                    />
                                </div>
                            </div>

                            <!-- Mensaje -->
                            <div>
                                <label class="block text-sm font-medium text-orange-600 mb-2">Mensaje *</label>
                                <textarea
                                    v-model="mensaje"
                                    name="mensaje"
                                    required
                                    rows="4"
                                    class="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-green-500 resize-none"
                                    placeholder="Escribe tu mensaje aquí..."
                                ></textarea>
                            </div>

                            <!-- Botón enviar -->
                            <button
                                type="submit"
                                class="w-full bg-green-500 hover:bg-green-600 text-white font-semibold py-3 px-6 rounded-lg transition-colors duration-200"
                            >
                                Enviar mensaje
                            </button>
                        </form>
                    </div>

                    <!-- Información de contacto -->
                    <div class="bg-white rounded-3xl shadow-lg p-8">
                        <h3 class="text-2xl font-bold text-gray-800 mb-6">Información de contacto</h3>
                        
                        <div class="space-y-6">
                            <!-- Correo principal -->
                            <div class="bg-gray-100 rounded-lg p-4">
                                <p class="text-sm text-gray-600 mb-1">Correo principal</p>
                                <p class="text-green-600 font-medium">contacto@utseguard.com</p>
                            </div>

                            <!-- Teléfono -->
                            <div class="bg-gray-100 rounded-lg p-4">
                                <p class="text-sm text-gray-600 mb-1">Teléfono</p>
                                <p class="text-green-600 font-medium">241 108 7863</p>
                            </div>

                            <!-- WhatsApp -->
                            <div class="bg-gray-100 rounded-lg p-4">
                                <p class="text-sm text-gray-600 mb-1">WhatsApp</p>
                                <p class="text-green-600 font-medium">245 234 4532</p>
                            </div>

                            <!-- Dirección -->
                            <div class="bg-gray-100 rounded-lg p-4">
                                <p class="text-sm text-gray-600 mb-1">Dirección</p>
                                <p class="text-green-600 font-medium">Universidad Tecnológica de Tlaxcala</p>
                            </div>

                            <!-- Horarios de atención -->
                            <div class="bg-gray-100 rounded-lg p-4">
                                <p class="text-sm text-gray-600 mb-3">Horarios de atención</p>
                                <div class="space-y-2 text-sm">
                                    <div class="flex justify-between">
                                        <span class="text-gray-700">Lunes - Viernes:</span>
                                        <span class="text-gray-900 font-medium">8:00 AM - 8:00 PM</span>
                                    </div>
                                    <div class="flex justify-between">
                                        <span class="text-gray-700">Sábados:</span>
                                        <span class="text-gray-900 font-medium">9:00 AM - 6:00 PM</span>
                                    </div>
                                    <div class="flex justify-between">
                                        <span class="text-gray-700">Domingos:</span>
                                        <span class="text-gray-900 font-medium">Emergencias únicamente</span>
                                    </div>
                                    <div class="flex justify-between border-t pt-2 mt-2">
                                        <span class="text-gray-700">Chat en vivo:</span>
                                        <span class="text-green-600 font-medium">24/7</span>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                <!-- Sección de emergencia -->
                <div class="bg-white rounded-3xl shadow-lg p-8 mt-8 text-center">
                    <h3 class="text-2xl font-bold text-red-600 mb-4">¿Tienes una emergencia?</h3>
                    <p class="text-gray-700 mb-6">
                        Para situaciones urgentes de seguridad, utiliza nuestro botón de pánico en la app o llama directamente
                    </p>
                    
                    <div class="bg-red-600 text-white rounded-lg p-6 inline-block">
                        <p class="text-lg font-bold mb-2">Línea de emergencia: 911</p>
                    </div>
                </div>
            </div>
        </div>
    </LayoutView>
</template>