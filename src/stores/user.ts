import { defineStore } from "pinia";
import { auth } from "@/firebase";
import { createUserWithEmailAndPassword, signInWithEmailAndPassword, signOut } from "firebase/auth";


export const useUserStore = defineStore("user", {
    state: () => {
        return {
            user: null ,
        };
    },
    actions: {
        async requied(email: string, password: string) {
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
                        alert("El correo electrónico ya está en uso");
                        break;
                    case "auth/invalid-email":
                        alert("El correo electrónico no es válido");
                        break;
                    case "auth/weak-password":
                        alert("La contraseña es demasiado débil");
                        break;
                }
                return;
            }
        },

        async login(email: string, password: string) {
            try {
                const userCredential = await signInWithEmailAndPassword(auth, email, password);
                this.user = userCredential.user;
                console.log("Usuario logueado exitosamente:", this.user);
                // Redirigir al panel principal después del login exitoso
                this.$router.push({ name: 'main' });
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
                return;
            }
        },

        async logout() {
            try {
                await signOut(auth);
                this.user = null;
                this.$router.push({ name:"/login"});
            } catch (error) {
                console.error("Error al cerrar sesión:", error);
                throw new Error("Error al cerrar sesión");
            }
        }
    },
});