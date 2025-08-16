import { defineStore } from "pinia";
import { auth, googleProvider, createUser, getUserByEmail } from "@/firebase/index";
import {
    createUserWithEmailAndPassword,
    signInWithEmailAndPassword,
    signInWithPopup,
    signOut,
    onAuthStateChanged
} from "firebase/auth";
import router from "@/router";
import type { User } from "firebase/auth";

// ✨ IMPORTAR SISTEMA AUTO-SYNC SIMPLE
import {
    migrateExistingGroupsToAutoSync,
    checkAutoSyncHealth
} from "@/firebase/autoSync";

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
        loading: false,
        // ✨ SIMPLE: Solo flag de inicialización
        syncInitialized: false,
    }),

    getters: {
        isAuthenticated: (state) => !!state.user,
        isGuardian: (state) => state.userProfile?.role === 'guardian',
        isProtegido: (state) => state.userProfile?.role === 'protegido',
    },

    actions: {
        initAuthListener() {
            onAuthStateChanged(auth, async (user) => {
                this.user = user;
                if (user && user.email) {
                    try {
                        const firebaseUser = await getUserByEmail(user.email);
                        if (firebaseUser) {
                            this.userProfile = {
                                uid: user.uid,
                                email: user.email,
                                displayName: user.displayName || firebaseUser.name,
                                role: firebaseUser.role,
                                nombre: firebaseUser.name,
                                telefono: firebaseUser.phone,
                            };

                            // ✨ INICIALIZAR SIMPLE AUTO-SYNC
                            await this.initializeSimpleAutoSync(user.email);
                        }
                    } catch (error) {
                        console.error("Error cargando perfil:", error);
                    }
                } else {
                    this.userProfile = null;
                    this.syncInitialized = false;
                }
            });
        },

        // ✨ NUEVA FUNCIÓN SIMPLE: Solo agregar UIDs a grupos existentes
        async initializeSimpleAutoSync(userEmail: string) {
            if (this.syncInitialized) return;

            try {
                console.log('🚀 Inicializando auto-sync SIMPLE para:', userEmail);

                // 1. Verificar si hay grupos sin UIDs
                const health = await checkAutoSyncHealth(userEmail);
                console.log('📊 Salud SIMPLE:', health);

                // 2. Si hay grupos sin UIDs, agregarlos automáticamente
                if (health.healthPercentage < 100 && health.totalGroups > 0) {
                    console.log('🔄 Agregando UIDs automáticamente...');
                    
                    // Esperar un poco y ejecutar migración simple
                    setTimeout(async () => {
                        try {
                            const result = await migrateExistingGroupsToAutoSync();
                            console.log('✅ UIDs agregados automáticamente:', result);
                            
                            if (result.updated > 0) {
                                console.log(`🎉 ${result.updated} grupos ahora tienen UIDs para móvil`);
                            }
                        } catch (error) {
                            console.error('❌ Error agregando UIDs:', error);
                        }
                    }, 2000);
                }

                this.syncInitialized = true;
                console.log('✅ Auto-sync SIMPLE inicializado');

            } catch (error) {
                console.error('❌ Error inicializando auto-sync simple:', error);
            }
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
                this.loading = true;
                const userCredential = await createUserWithEmailAndPassword(auth, email, password);
                
                // Crear usuario en Firestore
                await createUser({
                    email: email,
                    name: `${userData.nombre} ${userData.apellidos}`,
                    phone: userData.telefono,
                    role: this.currentRole,
                    status: 'online',
                    location: 'UTT Campus',
                    coordinates: [-97.9691, 19.3867]
                });

                this.userProfile = {
                    uid: userCredential.user.uid,
                    email: email,
                    role: this.currentRole,
                    nombre: userData.nombre,
                    apellidos: userData.apellidos,
                    telefono: userData.telefono,
                };

                // ✨ INICIALIZAR AUTO-SYNC SIMPLE
                await this.initializeSimpleAutoSync(email);

                if (this.currentRole === 'guardian') {
                    router.push({ name: "Estadisticas" });
                } else {
                    router.push({ name: "Index" });
                }
            } catch (error: any) {
                console.error("Error en registro:", error);
                this.handleAuthError(error);
            } finally {
                this.loading = false;
            }
        },

        async login(email: string, password: string) {
            try {
                this.loading = true;
                const userCredential = await signInWithEmailAndPassword(auth, email, password);
                
                const firebaseUser = await getUserByEmail(email);
                if (firebaseUser) {
                    this.userProfile = {
                        uid: userCredential.user.uid,
                        email: email,
                        role: firebaseUser.role,
                        nombre: firebaseUser.name,
                        telefono: firebaseUser.phone,
                    };
                    
                    // ✨ INICIALIZAR AUTO-SYNC SIMPLE
                    await this.initializeSimpleAutoSync(email);
                    
                    if (firebaseUser.role === 'guardian') {
                        router.push({ name: "Estadisticas" });
                    } else {
                        router.push({ name: "Index" });
                    }
                } else {
                    alert("Usuario no encontrado en la base de datos");
                }
            } catch (error: any) {
                console.error("Error en login:", error);
                this.handleAuthError(error);
            } finally {
                this.loading = false;
            }
        },
        
        async loginWithGoogle() {
            try {
                this.loading = true;
                const result = await signInWithPopup(auth, googleProvider);
                
                let firebaseUser = await getUserByEmail(result.user.email!);
                
                if (!firebaseUser) {
                    await createUser({
                        email: result.user.email!,
                        name: result.user.displayName || 'Usuario Google',
                        phone: '000-000-0000',
                        role: this.currentRole,
                        status: 'online',
                        location: 'UTT Campus',
                        coordinates: [-97.9691, 19.3867]
                    });
                    
                    firebaseUser = await getUserByEmail(result.user.email!);
                }
                
                if (firebaseUser) {
                    this.userProfile = {
                        uid: result.user.uid,
                        email: result.user.email!,
                        displayName: result.user.displayName || '',
                        role: firebaseUser.role,
                        nombre: firebaseUser.name,
                        telefono: firebaseUser.phone,
                    };
                    
                    // ✨ INICIALIZAR AUTO-SYNC SIMPLE
                    await this.initializeSimpleAutoSync(result.user.email!);
                    
                    if (firebaseUser.role === 'guardian') {
                        router.push({ name: "Estadisticas" });
                    } else {
                        router.push({ name: "Index" });
                    }
                }
            } catch (error: any) {
                console.error("Error con Google:", error);
                this.handleAuthError(error);
            } finally {
                this.loading = false;
            }
        },
        
        async logout() {
            try {
                await signOut(auth);
                this.user = null;
                this.userProfile = null;
                this.syncInitialized = false;
                router.push({ name: "Index" });
            } catch (error) {
                console.error("Error al cerrar sesión:", error);
            }
        },

        handleAuthError(error: any) {
            switch (error.code) {
                case "auth/invalid-credential":
                    alert("Credenciales incorrectas");
                    break;
                case "auth/weak-password":
                    alert("La contraseña debe tener al menos 6 caracteres");
                    break;
                case "auth/email-already-in-use":
                    alert("Este correo ya está registrado");
                    break;
                default:
                    alert("Error: " + (error.message || "Error desconocido"));
            }
        },
    },
});