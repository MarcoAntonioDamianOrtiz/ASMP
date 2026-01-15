import {
    collection,
    addDoc,
    getDocs,
    deleteDoc,
    doc,
    query,
    where,
    onSnapshot,
    updateDoc,
    setDoc,
    getDoc,
    writeBatch
} from "firebase/firestore";
import { db } from "./config";

export interface FirebaseUser {
    id: string;
    email: string;
    name: string;
    phone: string;
    role: 'guardian' | 'protegido';
    status: 'online' | 'offline';
    location?: string;
    coordinates?: [number, number];
    lastSeen?: Date;
    currentGroupId?: string;
}

export interface FirebaseUbicacion {
    id: string;
    userId: string;
    userEmail: string;
    userName: string;
    lat: number;
    lng: number;
    accuracy?: number;
    timestamp: any;
    isOnline: boolean;
}

// ========== CONSTANTES DE PRECISIÓN ==========
const MAX_ACCURACY_METERS = 50; // SOLO ACEPTAR UBICACIONES CON MENOS DE 50 METROS DE PRECISIÓN
const WARNING_ACCURACY_METERS = 30; // Advertencia si está entre 30-50 metros

// ========== OBTENER USUARIOS ==========
export const getUsers = async (): Promise<FirebaseUser[]> => {
    try {
        const snapshot = await getDocs(collection(db, 'users'));
        return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as FirebaseUser));
    } catch (error) {
        return [];
    }
};

export const getUserByEmail = async (email: string): Promise<FirebaseUser | null> => {
    try {
        const q = query(collection(db, 'users'), where('email', '==', email));
        const snapshot = await getDocs(q);
        if (snapshot.empty) return null;
        const doc = snapshot.docs[0];
        return { id: doc.id, ...doc.data() } as FirebaseUser;
    } catch (error) {
        return null;
    }
};

// ========== CREAR/ACTUALIZAR USUARIO ==========
export const createUser = async (userData: Omit<FirebaseUser, 'id'>): Promise<string> => {
    try {
        const existingUser = await getUserByEmail(userData.email);

        if (existingUser) {
            await updateDoc(doc(db, 'users', existingUser.id), {
                ...userData,
                lastSeen: new Date(),
                status: 'online'
            });
            return existingUser.id;
        }

        const docRef = await addDoc(collection(db, 'users'), {
            ...userData,
            createdAt: new Date(),
            lastSeen: new Date(),
            status: 'online'
        });
        return docRef.id;
    } catch (error) {
        console.error('Error creating user:', error);
        throw error;
    }
};

export const updateUserStatus = async (
    userId: string,
    status: 'online' | 'offline',
    locationData?: { lat: number; lng: number }
): Promise<void> => {
    try {
        const userRef = doc(db, 'users', userId);
        const updateData: any = {
            status,
            lastSeen: new Date()
        };

        if (locationData) {
            updateData.coordinates = [locationData.lng, locationData.lat];
            updateData.location = `${locationData.lat.toFixed(6)}, ${locationData.lng.toFixed(6)}`;
        }

        await updateDoc(userRef, updateData);
    } catch (error) {
        console.error('Error updating user status:', error);
        throw error;
    }
};

// ========== UBICACIONES CON VALIDACIÓN DE PRECISIÓN ==========
export const updateUserLocation = async (userEmail: string, locationData: {
    lat: number;
    lng: number;
    accuracy?: number;
}): Promise<void> => {
    try {
        console.log('📍 Intentando actualizar ubicación:', {
            email: userEmail,
            lat: locationData.lat,
            lng: locationData.lng,
            accuracy: locationData.accuracy
        });

        // ========== VALIDACIÓN 1: COORDENADAS BÁSICAS ==========
        if (!locationData.lat || !locationData.lng ||
            Math.abs(locationData.lat) > 90 || Math.abs(locationData.lng) > 180) {
            console.warn('⚠️ Coordenadas inválidas:', locationData.lat, locationData.lng);
            throw new Error('Coordenadas GPS inválidas');
        }

        // ========== VALIDACIÓN 2: PRECISIÓN ESTRICTA ==========
        if (!locationData.accuracy) {
            console.warn('⚠️ Sin dato de precisión GPS');
            throw new Error('No se proporcionó precisión GPS');
        }

        // 🚫 RECHAZAR SI LA PRECISIÓN ES MAYOR A 50 METROS
        if (locationData.accuracy > MAX_ACCURACY_METERS) {
            console.error(`🚫 UBICACIÓN RECHAZADA: Precisión insuficiente (${Math.round(locationData.accuracy)}m > ${MAX_ACCURACY_METERS}m)`);
            throw new Error(
                `Precisión GPS insuficiente: ${Math.round(locationData.accuracy)}m. ` +
                `Se requiere una precisión menor a ${MAX_ACCURACY_METERS}m. ` +
                `Por favor, espera a que el GPS obtenga una señal más precisa (mueve tu dispositivo a un lugar con mejor señal).`
            );
        }

        // ⚠️ ADVERTENCIA si está entre 30-50 metros
        if (locationData.accuracy > WARNING_ACCURACY_METERS) {
            console.warn(`⚠️ Precisión aceptable pero baja: ${Math.round(locationData.accuracy)}m`);
        } else {
            console.log(`✅ Precisión excelente: ${Math.round(locationData.accuracy)}m`);
        }

        // ========== BUSCAR USUARIO ==========
        const userQuery = query(collection(db, 'users'), where('email', '==', userEmail));
        const userSnapshot = await getDocs(userQuery);

        if (userSnapshot.empty) {
            throw new Error(`Usuario no encontrado: ${userEmail}`);
        }

        const userDoc = userSnapshot.docs[0];
        const userId = userDoc.id;
        const userData = userDoc.data();

        // ========== GUARDAR UBICACIÓN PRECISA ==========
        const locationRef = doc(db, 'ubicaciones', userId);

        const locationDoc = {
            userId: userId,
            userEmail: userEmail,
            userName: userData.name || userEmail.split('@')[0],
            lat: Number(locationData.lat),
            lng: Number(locationData.lng),
            accuracy: Math.round(locationData.accuracy), // Redondear para mejor legibilidad
            timestamp: new Date(),
            isOnline: true,
            lastUpdate: new Date(),
            // Agregar metadatos útiles
            precisionLevel: locationData.accuracy <= 10 ? 'excelente' :
                           locationData.accuracy <= 20 ? 'buena' :
                           locationData.accuracy <= 30 ? 'aceptable' : 'baja'
        };

        await setDoc(locationRef, locationDoc, { merge: true });

        console.log('✅ Ubicación GPS actualizada exitosamente:', {
            userId: userId,
            email: userEmail,
            coords: `${locationData.lat.toFixed(6)}, ${locationData.lng.toFixed(6)}`,
            accuracy: `${Math.round(locationData.accuracy)}m`,
            level: locationDoc.precisionLevel
        });

    } catch (error: any) {
        console.error('❌ Error al actualizar ubicación GPS:', error);
        
        // Re-lanzar el error para que el componente lo maneje
        throw error;
    }
};

export const getMyLocation = async (userEmail: string): Promise<FirebaseUbicacion | null> => {
    try {
        const userQuery = query(collection(db, 'users'), where('email', '==', userEmail));
        const userSnapshot = await getDocs(userQuery);

        if (userSnapshot.empty) return null;

        const userDoc = userSnapshot.docs[0];
        const userId = userDoc.id;
        const userData = userDoc.data();

        const locationDoc = await getDoc(doc(db, 'ubicaciones', userId));

        if (locationDoc.exists()) {
            const locationData = locationDoc.data();

            return {
                id: locationDoc.id,
                userId: userId,
                userEmail: userEmail,
                userName: userData.name || userEmail.split('@')[0],
                lat: locationData.lat || 0,
                lng: locationData.lng || 0,
                accuracy: locationData.accuracy || 0,
                timestamp: locationData.timestamp,
                isOnline: locationData.isOnline || false
            } as FirebaseUbicacion;
        }

        return null;
    } catch (error) {
        return null;
    }
};

// ========== ACTIVACIÓN/DESACTIVACIÓN DE CÍRCULO ==========
export const activateMemberCircle = async (userEmail: string): Promise<void> => {
    try {
        const userQuery = query(collection(db, 'users'), where('email', '==', userEmail));
        const userSnapshot = await getDocs(userQuery);

        if (userSnapshot.empty) {
            throw new Error('Usuario no encontrado');
        }

        const userDoc = userSnapshot.docs[0];
        const userData = userDoc.data();
        const userId = userDoc.id;

        const locationDoc = await getDoc(doc(db, 'ubicaciones', userId));

        if (locationDoc.exists()) {
            await updateDoc(doc(db, 'ubicaciones', userId), {
                isOnline: true,
                lastActivated: new Date()
            });
        } else {
            await setDoc(doc(db, 'ubicaciones', userId), {
                userId: userId,
                userEmail: userEmail,
                userName: userData.name || userEmail.split('@')[0],
                isOnline: true,
                lastActivated: new Date()
            });
        }

        await updateDoc(doc(db, 'users', userId), {
            status: 'online',
            lastSeen: new Date()
        });
    } catch (error) {
        console.error('Error activating circle:', error);
        throw error;
    }
};

export const deactivateMemberCircle = async (userEmail: string): Promise<void> => {
    try {
        const userQuery = query(collection(db, 'users'), where('email', '==', userEmail));
        const userSnapshot = await getDocs(userQuery);

        if (userSnapshot.empty) {
            throw new Error('Usuario no encontrado');
        }

        const userId = userSnapshot.docs[0].id;
        const locationRef = doc(db, 'ubicaciones', userId);
        const locationDoc = await getDoc(locationRef);

        if (locationDoc.exists()) {
            await updateDoc(locationRef, {
                isOnline: false,
                lastDeactivated: new Date()
            });
        }

        await updateDoc(doc(db, 'users', userId), {
            status: 'offline',
            lastSeen: new Date()
        });
    } catch (error) {
        console.error('Error deactivating circle:', error);
        throw error;
    }
};

export const setUserOffline = async (userId: string): Promise<void> => {
    try {
        const locationRef = doc(db, 'ubicaciones', userId);
        const locationDoc = await getDoc(locationRef);

        if (locationDoc.exists()) {
            await updateDoc(locationRef, {
                isOnline: false,
                lastSeen: new Date()
            });
        }

        const userRef = doc(db, 'users', userId);
        const userDoc = await getDoc(userRef);

        if (userDoc.exists()) {
            await updateDoc(userRef, {
                status: 'offline',
                lastSeen: new Date()
            });
        }
    } catch (error) {
        console.error('Error setting user offline:', error);
    }
};

export const getMemberCircleStatus = async (userEmail: string): Promise<{
    active: boolean;
    lastUpdate: Date | null
}> => {
    try {
        const userQuery = query(collection(db, 'users'), where('email', '==', userEmail));
        const userSnapshot = await getDocs(userQuery);

        if (userSnapshot.empty) {
            return { active: false, lastUpdate: null };
        }

        const userId = userSnapshot.docs[0].id;
        const locationDoc = await getDoc(doc(db, 'ubicaciones', userId));

        if (!locationDoc.exists()) {
            return { active: false, lastUpdate: null };
        }

        const locationData = locationDoc.data();
        return {
            active: locationData.isOnline || false,
            lastUpdate: locationData.timestamp?.toDate() || null
        };
    } catch (error) {
        return { active: false, lastUpdate: null };
    }
};

// ========== SUSCRIPCIONES ==========
export const subscribeToUsers = (callback: (users: FirebaseUser[]) => void) => {
    return onSnapshot(collection(db, 'users'), (snapshot) => {
        const users = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as FirebaseUser));
        callback(users);
    });
};

export const subscribeToMyLocation = (
    userEmail: string,
    callback: (location: FirebaseUbicacion | null) => void
) => {
    const setupSubscription = async () => {
        try {
            const userQuery = query(collection(db, 'users'), where('email', '==', userEmail));
            const userSnapshot = await getDocs(userQuery);

            if (userSnapshot.empty) {
                callback(null);
                return () => { };
            }

            const userId = userSnapshot.docs[0].id;
            const userData = userSnapshot.docs[0].data();

            return onSnapshot(doc(db, 'ubicaciones', userId), (snapshot) => {
                if (snapshot.exists()) {
                    const locationData = snapshot.data();

                    const location: FirebaseUbicacion = {
                        id: snapshot.id,
                        userId: userId,
                        userEmail: userEmail,
                        userName: userData.name || userEmail.split('@')[0],
                        lat: locationData.lat || 0,
                        lng: locationData.lng || 0,
                        accuracy: locationData.accuracy || 0,
                        timestamp: locationData.timestamp,
                        isOnline: locationData.isOnline || false
                    };

                    callback(location);
                } else {
                    callback(null);
                }
            }, () => {
                callback(null);
            });

        } catch (error) {
            callback(null);
            return () => { };
        }
    };

    let unsubscribe: (() => void) | null = null;

    setupSubscription().then(unsub => {
        unsubscribe = unsub;
    });

    return () => {
        if (unsubscribe) {
            unsubscribe();
        }
    };
};

// ========== LIMPIEZA Y MANTENIMIENTO ==========
export const cleanupDuplicateUsers = async (): Promise<{
    duplicatesFound: number;
    duplicatesCleaned: number;
    errors: string[];
}> => {
    const errors: string[] = [];
    let duplicatesFound = 0;
    let duplicatesCleaned = 0;

    try {
        const usersSnapshot = await getDocs(collection(db, 'users'));
        const usersByEmail = new Map<string, any[]>();

        usersSnapshot.docs.forEach(doc => {
            const data = doc.data();
            const email = data.email;

            if (!usersByEmail.has(email)) {
                usersByEmail.set(email, []);
            }

            usersByEmail.get(email)!.push({
                id: doc.id,
                data: data,
                createdAt: data.createdAt?.toDate() || new Date(0)
            });
        });

        for (const [email, users] of usersByEmail.entries()) {
            if (users.length > 1) {
                duplicatesFound++;

                try {
                    const sortedUsers = users.sort((a, b) =>
                        b.createdAt.getTime() - a.createdAt.getTime()
                    );

                    const keepUser = sortedUsers[0];
                    const deleteUsers = sortedUsers.slice(1);

                    for (const userToDelete of deleteUsers) {
                        const oldLocationDoc = await getDoc(doc(db, 'ubicaciones', userToDelete.id));

                        if (oldLocationDoc.exists()) {
                            const oldLocationData = oldLocationDoc.data();

                            await setDoc(doc(db, 'ubicaciones', keepUser.id), {
                                ...oldLocationData,
                                userId: keepUser.id,
                                userEmail: email,
                                userName: keepUser.data.name || email.split('@')[0],
                                lastUpdate: new Date(),
                                migratedFrom: userToDelete.id
                            }, { merge: true });

                            await deleteDoc(doc(db, 'ubicaciones', userToDelete.id));
                        }
                    }

                    const batch = writeBatch(db);
                    deleteUsers.forEach(user => {
                        batch.delete(doc(db, 'users', user.id));
                    });

                    await batch.commit();
                    duplicatesCleaned += deleteUsers.length;

                } catch (error) {
                    const errorMsg = `Error cleaning duplicates for ${email}: ${error}`;
                    errors.push(errorMsg);
                }
            }
        }

        return { duplicatesFound, duplicatesCleaned, errors };

    } catch (error) {
        return {
            duplicatesFound: 0,
            duplicatesCleaned: 0,
            errors: [error instanceof Error ? error.message : 'Unknown error']
        };
    }
};

export const cleanupOrphanedLocations = async (): Promise<{
    orphanedFound: number;
    orphanedCleaned: number;
    errors: string[];
}> => {
    const errors: string[] = [];
    let orphanedFound = 0;
    let orphanedCleaned = 0;

    try {
        const locationsSnapshot = await getDocs(collection(db, 'ubicaciones'));
        const usersSnapshot = await getDocs(collection(db, 'users'));
        const validUserIds = new Set(usersSnapshot.docs.map(doc => doc.id));

        const batch = writeBatch(db);

        for (const locationDoc of locationsSnapshot.docs) {
            const locationId = locationDoc.id;

            if (!validUserIds.has(locationId)) {
                orphanedFound++;
                batch.delete(locationDoc.ref);
                orphanedCleaned++;
            }
        }

        if (orphanedCleaned > 0) {
            await batch.commit();
        }

        return { orphanedFound, orphanedCleaned, errors };

    } catch (error) {
        return {
            orphanedFound: 0,
            orphanedCleaned: 0,
            errors: [error instanceof Error ? error.message : 'Unknown error']
        };
    }
};

export const cleanupInactiveLocations = async (maxAgeMinutes: number = 30): Promise<{
    cleaned: number;
    errors: number;
}> => {
    try {
        const locationsSnapshot = await getDocs(collection(db, 'ubicaciones'));
        const cutoffTime = new Date(Date.now() - maxAgeMinutes * 60 * 1000);

        let cleaned = 0;
        let errors = 0;
        const batch = writeBatch(db);

        for (const locationDoc of locationsSnapshot.docs) {
            try {
                const data = locationDoc.data();
                const timestamp = data.timestamp?.toDate();

                if (!timestamp || timestamp < cutoffTime) {
                    batch.update(locationDoc.ref, {
                        isOnline: false,
                        lastSeen: new Date()
                    });
                    cleaned++;
                }
            } catch (error) {
                errors++;
            }
        }

        if (cleaned > 0) {
            await batch.commit();
        }

        return { cleaned, errors };
    } catch (error) {
        return { cleaned: 0, errors: 1 };
    }
};

export const cleanupUserLocation = async (userId: string): Promise<void> => {
    try {
        const locationRef = doc(db, 'ubicaciones', userId);
        const locationDoc = await getDoc(locationRef);

        if (locationDoc.exists()) {
            await deleteDoc(locationRef);
        }
    } catch (error) {
        console.error('Error cleaning user location:', error);
    }
};

// ========== DIAGNÓSTICO ==========
export const checkMemberLocationStatus = async (userEmail: string): Promise<{
    hasLocationRecord: boolean;
    hasRealCoordinates: boolean;
    isOnline: boolean;
    lastKnownLocation: { lat: number, lng: number } | null;
    lastUpdate: Date | null;
}> => {
    try {
        const user = await getUserByEmail(userEmail);
        if (!user) {
            return {
                hasLocationRecord: false,
                hasRealCoordinates: false,
                isOnline: false,
                lastKnownLocation: null,
                lastUpdate: null
            };
        }

        const locationDoc = await getDoc(doc(db, 'ubicaciones', user.id));

        if (!locationDoc.exists()) {
            return {
                hasLocationRecord: false,
                hasRealCoordinates: false,
                isOnline: false,
                lastKnownLocation: null,
                lastUpdate: null
            };
        }

        const data = locationDoc.data();
        const hasRealCoords = !!(data.lat && data.lng && data.lat !== 0 && data.lng !== 0);

        return {
            hasLocationRecord: true,
            hasRealCoordinates: hasRealCoords,
            isOnline: data.isOnline || false,
            lastKnownLocation: hasRealCoords ? { lat: data.lat, lng: data.lng } : null,
            lastUpdate: data.timestamp?.toDate() || null
        };
    } catch (error) {
        return {
            hasLocationRecord: false,
            hasRealCoordinates: false,
            isOnline: false,
            lastKnownLocation: null,
            lastUpdate: null
        };
    }
};