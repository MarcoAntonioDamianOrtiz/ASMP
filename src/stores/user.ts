import { defineStore } from "pinia";
import { auth, googleProvider  } from "@/firebase";
import {createUserWithEmailAndPassword,signInWithEmailAndPassword,signInWithPopup,signOut,} 

from "firebase/auth";
import router from "@/router";
import type { User } from "firebase/auth";

export interface UserProfile {
    uid: string;
    email: string;
    displayName?: string;
    role: 'guardian' | 'protegido';
    nombre?: string;
    apellidos?: string;
    telefono?: string;
}

export const useUserStore = defineStore("user", {
    state: () => ({
        user: null as User | null,
        userProfile: null as UserProfile | null,
        currentRole: 'guardian' as 'guardian' | 'protegido',
    }),

    getters: {
        isAuthenticated: (state) => !!state.user,
        isGuardian: (state) => state.userProfile?.role === 'guardian',
        isProtegido: (state) => state.userProfile?.role === 'protegido',
    },

    actions: {
        setCurrentRole(role: 'guardian' | 'protegido') {
            this.currentRole = role;
        },

        async register(email: string, password: string, userData: {
            nombre: string;
            apellidos: string;
            telefono: string;
        }) {
            try {
                const userCredential = await createUserWithEmailAndPassword(
                    auth,
                    email,
                    password
                );
                this.user = userCredential.user;
                
                // Crear perfil de usuario con el rol seleccionado
                this.userProfile = {
                    uid: userCredential.user.uid,
                    email: email,
                    role: this.currentRole,
                    nombre: userData.nombre,
                    apellidos: userData.apellidos,
                    telefono: userData.telefono,
                };

                console.log("Usuario registrado exitosamente:", this.userProfile);
                
                // Redirigir según el rol
                if (this.currentRole === 'guardian') {
                    router.push({ name: "Estadisticas" });
                } else {
                    router.push({ name: "Index" });
                }
            } catch (error: any) {
                console.error("Error en registro:", error);
                switch (error.code) {
                    case "auth/email-already-in-use":
                        alert("El correo electrónico ya está en uso");
                        break;
                    case "auth/invalid-email":
                        alert("El correo electrónico no es válido");
                        break;
                    case "auth/weak-password":
                        alert("La contraseña es demasiado débil");
                        break;
                    default:
                        alert("Error al registrar usuario");
                }
            }
        },

        async login(email: string, password: string) {
            try {
                const userCredential = await signInWithEmailAndPassword(
                    auth,
                    email,
                    password
                );
                this.user = userCredential.user;
                this.userProfile = {
                    uid: userCredential.user.uid,
                    email: email,
                    role: this.currentRole, 
                };

                console.log("Usuario logueado exitosamente:", this.userProfile);
                
                // Redirigir según el rol
                if (this.userProfile.role === 'guardian') {
                    router.push({ name: "Estadisticas" });
                } else {
                    router.push({ name: "Index" });
                }
            } catch (error: any) {
                console.error("Error en login:", error);
                switch (error.code) {
                    case "auth/wrong-password":
                        alert("Contraseña incorrecta");
                        break;
                    case "auth/invalid-email":
                        alert("Correo electrónico no válido");
                        break;
                    case "auth/user-not-found":
                        alert("Usuario no encontrado");
                        break;
                    default:
                        alert("Error al iniciar sesión");
                }
            }
        },
        
        // Login con Google
        async loginWithGoogle() {
            try {
                const result = await signInWithPopup(auth, googleProvider);
                this.user = result.user;
                
                // Crear perfil básico con Google
                this.userProfile = {
                    uid: result.user.uid,
                    email: result.user.email || '',
                    displayName: result.user.displayName || '',
                    role: this.currentRole,
                };

                console.log("Usuario logueado con Google:", this.userProfile);
                
                // Redirigir según el rol
                if (this.userProfile.role === 'guardian') {
                    router.push({ name: "Estadisticas" });
                } else {
                    router.push({ name: "Index" });
                }
            } catch (error: any) {
                console.error("Error en login con Google:", error);
                switch (error.code) {
                    case "auth/popup-closed-by-user":
                        alert("Popup cerrado por el usuario");
                        break;
                    case "auth/popup-blocked":
                        alert("Popup bloqueado por el navegador");
                        break;
                    case "auth/cancelled-popup-request":
                        alert("Solicitud de popup cancelada");
                        break;
                    default:
                        alert("Error al iniciar sesión con Google");
                }
            }
        },
        
        async logout() {
            try {
                await signOut(auth);
                this.user = null;
                this.userProfile = null;
                router.push({ name: "Index" });
            } catch (error) {
                console.error("Error al cerrar sesión:", error);
                throw new Error("Error al cerrar sesión");
            }
        },
    },
});