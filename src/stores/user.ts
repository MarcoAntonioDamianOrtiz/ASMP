import { defineStore } from "pinia";
import { auth } from "@/firebase";
import { createUserWithEmailAndPassword, signInWithEmailAndPassword, signOut } from "firebase/auth";

export const useUserStore = defineStore("user", {
    state: () => {
        return {
            user: null,
        };
    },
        actions: {
    async required(email, password) {
        try {
            await createUserWithEmailAndPassword(auth, email, password);
        } catch (error) {
            switch (error.code) {
                case "auth/email-already-in-use":
                    alert("Correo electrónico ya en uso");
                    break;
                case "auth/invalid-email":
                    alert("Correo electrónico no válido");
                    break;
                default:
                    alert("Registro fallido");
                    break;
            }
            return;
        }
        this.user = auth.currentUser;
        this.$router.push("/admin/login");
        console.log("El usuario ha sido registrado satisfactoriamente:", this.user);
    },

    async login(email, password) {
        try {
            await signInWithEmailAndPassword(auth, email, password);
        } catch (error) {
            switch (error.code) {
                case "auth/user-not-found":
                    alert("Usuario no encontrado");
                    break;
                case "auth/wrong-password":
                    alert("Contraseña incorrecta");
                    break;
                case "auth/weak-password":
                    alert("Contraseña demasiado débil");
                    break;
            }
            return;
        }
        this.user = auth.currentUser;
        this.$router.push("/views/index.vue");
        console.log("Usuario logueado exitosamente:", this.user);
    },
},
        });