<template>
    <!-- Footer UTT - Seguridad Personal -->
    <footer class="bg-green-950 text-white py-4 mt-2">
        <div class="container mx-auto px-6">
            <!-- 4 columnas: Universidad, Ubicación, Contacto, Soporte -->
            <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">

                <!-- Información Universidad -->
                <div class="space-y-4">
                    <div class="flex items-center gap-3 mb-4">
                        <!-- <img src="@/assets/logotipo.png" alt="Logo UTT" class="w-12 h-12" /> -->
                        <p class="text-sm text-gray-300 leading-relaxed">
                            Universidad Tecnológica de Tlaxcala.
                        </p>
                    </div>
                    <div class="space-y-2">
                        <h4 class="font-semibold text-white">Síguenos en nuestras redes sociales</h4>
                        <div class="flex gap-3">
                            <!-- Facebook -->
                            <!-- <img src="@/assets/icons/facebook.png" alt="Facebook" class="w-4 h-4" /> -->
                            <!-- Instagram -->
                            <!-- <img src="@/assets/icons/instagram.png" alt="Instagram" class="w-4 h-4" /> -->
                            <!-- YouTube -->
                            <!-- <img src="@/assets/icons/youtube.png" alt="YouTube" class="w-4 h-4" /> -->
                        </div>
                    </div>
                </div>

                <!-- Ubicación UTT -->
                <div class="space-y-4">
                    <h3 class="text-lg font-semibold text-white">Ubicación UTT</h3>
                    <div class="bg-gray-600 rounded-lg p-4">
                        <div class="flex items-center justify-center gap-2 text-sm mb-3">
                            <!-- <img src="@/assets/icons/location.png" alt="Ubicación" class="w-5 h-5" /> -->
                            <span class="text-white font-medium">Tlaxcala, México</span>
                        </div>
                        <div class="text-xs text-gray-300 text-center space-y-1 mb-2">
                            <p>Universidad Tecnológica de Tlaxcala</p>
                            <p>A El Carmen Xalpatlahuaya s/n, 90513 Huamantla, Tlax.</p>
                        </div>

                        <!-- Mapa responsivo más pequeño -->
                        <div class="w-full h-48 rounded overflow-hidden">
                            <iframe
                                src="https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d3763.594061543322!2d-97.96917432436344!3d19.386722042143607!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x85cffced901ddce7%3A0x900a8087658724ce!2sUniversidad%20Tecnol%C3%B3gica%20de%20Tlaxcala!5e0!3m2!1ses-419!2smx!4v1752564594487!5m2!1ses-419!2smx"
                                width="100%" height="100%" style="border:0;" loading="lazy"
                                referrerpolicy="no-referrer-when-downgrade">
                            </iframe>
                        </div>
                    </div>
                </div>

                <!-- Información de Contacto -->
                <div class="space-y-4">
                    <h3 class="text-lg font-semibold text-white">Contacto</h3>
                    <div class="space-y-3 text-sm text-gray-300">
                        <div class="flex items-start gap-2">
                            <!-- <img src="@/assets/icons/phone.png" alt="Teléfono" class="w-4 h-4 mt-0.5" /> -->
                            <span>+52(247) 47-25-300</span>
                        </div>
                        <div class="flex items-start gap-2">
                            <!-- <img src="@/assets/icons/email.png" alt="Email" class="w-4 h-4 mt-0.5" /> -->
                            <span>contacto@uttlaxcala.edu.mx</span>
                        </div>
                        <div class="flex items-start gap-2">
                            <!-- <img src="@/assets/icons/clock.png" alt="Horario" class="w-4 h-4 mt-0.5" /> -->
                            <div>
                                <p>Horario de atención:</p>
                                <p>Lunes a Viernes de 9:00 a 17:00 horas</p>
                            </div>
                        </div>
                    </div>
                </div>

                <!-- Soporte App -->
                <div class="space-y-4">
                    <h3 class="text-lg font-semibold text-white">Soporte App</h3>
                    <div class="space-y-3 text-sm text-gray-300">
                        <div class="flex items-center gap-2">
                            <!-- <img src="@/assets/icons/support-24.png" alt="Soporte 24/7" class="w-4 h-4" /> -->
                            <span>Centro de Monitoreo: 24/7</span>
                        </div>
                        <div class="flex items-center gap-2">
                            <!-- <img src="@/assets/icons/tech-support.png" alt="Soporte Técnico" class="w-4 h-4" /> -->
                            <span>Soporte Técnico: 8:00 - 20:00</span>
                        </div>
                        <div class="flex items-center gap-2">
                            <!-- <img src="@/assets/icons/emergency.png" alt="Emergencias" class="w-4 h-4" /> -->
                            <span>Emergencias: Línea Directa</span>
                        </div>
                    </div>
                </div>
            </div>

            <!-- Copyright  -->
            <div class="border-t border-gray-600 mt-8 pt-6 text-center">
                <p class="text-sm text-gray-400">
                    © 2024 Universidad Tecnológica de Tlaxcala - Todos los derechos reservados |
                    <span class="text-green-400">Sistema de Seguridad Personal</span>
                </p>
            </div>
        </div>
    </footer>
</template>
