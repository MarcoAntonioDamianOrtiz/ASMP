import { defineStore } from "pinia";
import { auth } from "@/firebase";
import {
    createUserWithEmailAndPassword,
    signInWithEmailAndPassword,
    signOut,
} from "firebase/auth";
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
                router.push({ name: "Login" }); // ✅ Navegación usando router importado
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
                router.push({ name: "main" }); // ✅ Navegación usando router importado
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
