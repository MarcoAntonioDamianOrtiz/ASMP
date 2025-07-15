import { defineStore } from "pinia";
import { auth } from "@/firebase";
import { createUserWithEmailAndPassword, signInWithEmailAndPassword, signOut } from "firebase/auth";
import type { IntegerType } from "mongodb";

export const useUserStore = defineStore("user", {
    state: () => {
        return {
            user: null,
        };
    },
    actions: {
        async register(email: string, password: IntegerType) {
            try {
                const userCredential = await createUserWithEmailAndPassword(auth, email, password);
                this.user = userCredential.user;
                console.log("Usuario registrado exitosamente:", this.user);
                // Redirigir al login después del registro exitoso
                this.$router.push({ name: 'Login' });
            } catch (error: any) {
                console.error("Error en registro:", error);
                switch (error.code) {
                    case "auth/email-already-in-use":
                        throw new Error("El correo electrónico ya está en uso");
                    case "auth/invalid-email":
                        throw new Error("El correo electrónico no es válido");
                    case "auth/weak-password":
                        throw new Error("La contraseña es demasiado débil");
                    default:
                        throw new Error("Error al registrar el usuario");
                }
            }
        },

        async login(email: string, password: IntegerType) {
            try {
                const userCredential = await signInWithEmailAndPassword(auth, email, password);
                this.user = userCredential.user;
                console.log("Usuario logueado exitosamente:", this.user);
                // Redirigir al panel principal después del login exitoso
                this.$router.push({ name: 'main' });
            } catch (error: any) {
                console.error("Error en login:", error);
                switch (error.code) {
                    case "auth/user-not-found":
                        throw new Error("Usuario no encontrado");
                    case "auth/wrong-password":
                        throw new Error("Contraseña incorrecta");
                    case "auth/invalid-email":
                        throw new Error("Correo electrónico no válido");
                    case "auth/user-disabled":
                        throw new Error("Usuario deshabilitado");
                    default:
                        throw new Error("Error al iniciar sesión");
                }
            }
        },

        async logout() {
            try {
                await signOut(auth);
                this.user = null;
                this.$router.push({ name: 'Index' });
            } catch (error) {
                console.error("Error al cerrar sesión:", error);
                throw new Error("Error al cerrar sesión");
            }
        }
    },
});