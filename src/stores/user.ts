import { defineStore } from "pinia";
import { auth, googleProvider  } from "@/firebase";
import {createUserWithEmailAndPassword,signInWithEmailAndPassword,signInWithPopup,signOut,} 

from "firebase/auth";
import router from "@/router";
import type { User } from "firebase/auth";

export const useUserStore = defineStore("user", {
    state: () => ({
        user: null as User | null,
    }),

    actions: {
        async register(email: string, password: string) {
            try {
                const userCredential = await createUserWithEmailAndPassword(
                    auth,
                    email,
                    password
                );
                this.user = userCredential.user;
                console.log("Usuario registrado exitosamente:", this.user);
                router.push({ name: "Login" }); 
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
                console.log("Usuario logueado exitosamente:", this.user);
                router.push({ name: "main" });
            } catch (error: any) {
                console.error("Error en login:", error);
                switch (error.code) {
                    case "auth/wrong-password":
                        alert("Contraseña incorrecta");
                        break;
                    case "auth/invalid-email":
                        alert("Correo electrónico no válido");
                        break;
                }
            }
        },
        
        // Login con Google
        async loginWithGoogle() {
            try {
                const result = await signInWithPopup(auth, googleProvider);
                this.user = result.user;
                console.log("Usuario logueado con Google:", this.user);
                router.push({ name: "main" });
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
                router.push({ name: "Login" });
            } catch (error) {
                console.error("Error al cerrar sesión:", error);
                throw new Error("Error al cerrar sesión");
            }
        },
    },
});
