import { defineStore } from "pinia";
import { auth, googleProvider } from "@/firebase";
import {
    createUserWithEmailAndPassword,
    signInWithEmailAndPassword,
    signInWithPopup,
    signOut,
    onAuthStateChanged
} from "firebase/auth";
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
        // Inicializar listener de autenticación
        initAuthListener() {
            onAuthStateChanged(auth, (user) => {
                this.user = user;
                if (!user) {
                    this.userProfile = null;
                }
            });
        },

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
                
                this.userProfile = {
                    uid: userCredential.user.uid,
                    email: email,
                    role: this.currentRole,
                    nombre: userData.nombre,
                    apellidos: userData.apellidos,
                    telefono: userData.telefono,
                };

                console.log("Usuario registrado exitosamente:", this.userProfile);
                
                if (this.currentRole === 'guardian') {
                    router.push({ name: "Estadisticas" });
                } else {
                    router.push({ name: "Index" });
                }
            } catch (error: any) {
                console.error("Error en registro:", error);
                this.handleAuthError(error);
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
                
                // Crear perfil simple para el login
                this.userProfile = {
                    uid: userCredential.user.uid,
                    email: email,
                    role: this.currentRole,
                };

                console.log("Usuario logueado exitosamente:", this.userProfile);
                
                // Redirigir según el rol seleccionado
                if (this.currentRole === 'guardian') {
                    router.push({ name: "Estadisticas" });
                } else {
                    router.push({ name: "Index" });
                }
            } catch (error: any) {
                console.error("Error en login:", error);
                this.handleAuthError(error);
            }
        },
        
        async loginWithGoogle() {
            try {
                const result = await signInWithPopup(auth, googleProvider);
                this.user = result.user;
                
                this.userProfile = {
                    uid: result.user.uid,
                    email: result.user.email || '',
                    displayName: result.user.displayName || '',
                    role: this.currentRole,
                };

                console.log("Usuario logueado con Google:", this.userProfile);
                
                if (this.currentRole === 'guardian') {
                    router.push({ name: "Estadisticas" });
                } else {
                    router.push({ name: "Index" });
                }
            } catch (error: any) {
                console.error("Error en login con Google:", error);
                this.handleAuthError(error);
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
                alert("Error al cerrar sesión");
            }
        },

        handleAuthError(error: any) {
            switch (error.code) {
                case "auth/invalid-credential":
                case "auth/wrong-password":
                case "auth/user-not-found":
                    alert("Credenciales incorrectas");
                    break;
                case "auth/invalid-email":
                    alert("Correo electrónico no válido");
                    break;
                case "auth/too-many-requests":
                    alert("Demasiados intentos. Intenta más tarde");
                    break;
                default:
                    alert("Error de autenticación:contraseña debil agrega numeros y palabras ");
            }
        },
    },
});