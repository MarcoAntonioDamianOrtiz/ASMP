import {
    collection,
    query,
    where,
    getDocs,
    doc,
    setDoc,
    updateDoc,
    onSnapshot,
    deleteDoc,
    getDoc,
    writeBatch
} from "firebase/firestore";
import { db, writeBatch as wb } from "./config";
import type { FirebaseUbicacion, FirebaseGroup } from "./types";
import { getUserByEmail } from "./users";
import { getUserGroups } from "./groups";

export const updateUserLocation = async (userEmail: string, locationData: {
    lat: number;
    lng: number;
    accuracy?: number;
}): Promise<void> => {
    try {
        if (!locationData.lat || !locationData.lng ||
            Math.abs(locationData.lat) > 90 || Math.abs(locationData.lng) > 180) {
            return;
        }

        const userQuery = query(collection(db, 'users'), where('email', '==', userEmail));
        const userSnapshot = await getDocs(userQuery);

        if (userSnapshot.empty) {
            throw new Error(`Usuario no encontrado: ${userEmail}`);
        }

        const userDoc = userSnapshot.docs[0];
        const userId = userDoc.id;
        const userData = userDoc.data();

        const locationRef = doc(db, 'ubicaciones', userId);

        const locationDoc = {
            userId: userId,
            userEmail: userEmail,
            userName: userData.name || userEmail.split('@')[0],
            lat: Number(locationData.lat),
            lng: Number(locationData.lng),
            accuracy: locationData.accuracy || 0,
            timestamp: new Date(),
            isOnline: true,
            lastUpdate: new Date()
        };

        await setDoc(locationRef, locationDoc, { merge: true });

    } catch (error) {
        console.error('Error updating user location:', error);
        throw error;
    }
};

export const getGroupMembersLocations = async (groupId: string): Promise<FirebaseUbicacion[]> => {
    try {
        const groupDoc = await getDoc(doc(db, 'circulos', groupId));
        if (!groupDoc.exists()) {
            return [];
        }

        const groupData = groupDoc.data() as FirebaseGroup;
        const memberEmails = groupData.members || [];

        if (memberEmails.length === 0) {
            return [];
        }

        const locations: FirebaseUbicacion[] = [];

        for (const email of memberEmails) {
            try {
                const userQuery = query(collection(db, 'users'), where('email', '==', email));
                const userSnapshot = await getDocs(userQuery);

                if (userSnapshot.empty) continue;

                const userDoc = userSnapshot.docs[0];
                const userId = userDoc.id;
                const userData = userDoc.data();

                const locationDoc = await getDoc(doc(db, 'ubicaciones', userId));

                if (locationDoc.exists()) {
                    const locationData = locationDoc.data();

                    if (locationData.lat && locationData.lng &&
                        !isNaN(locationData.lat) && !isNaN(locationData.lng) &&
                        locationData.lat !== 0 && locationData.lng !== 0 &&
                        Math.abs(locationData.lat) <= 90 && Math.abs(locationData.lng) <= 180) {

                        const location: FirebaseUbicacion = {
                            id: locationDoc.id,
                            userId: userId,
                            userEmail: email,
                            userName: userData.name || email.split('@')[0],
                            lat: Number(locationData.lat),
                            lng: Number(locationData.lng),
                            accuracy: locationData.accuracy || 0,
                            timestamp: locationData.timestamp,
                            isOnline: locationData.isOnline || false
                        };

                        locations.push(location);
                    }
                }

            } catch (error) {
                console.error(`Error processing location for ${email}:`, error);
            }
        }

        return locations;

    } catch (error) {
        console.error('Error getting group members locations:', error);
        return [];
    }
};

export const subscribeToGroupLocations = (groupId: string, callback: (locations: FirebaseUbicacion[]) => void) => {
    let isSubscriptionActive = true;
    let debounceTimer: NodeJS.Timeout | null = null;

    const fetchLocationsDebounced = () => {
        if (debounceTimer) {
            clearTimeout(debounceTimer);
        }

        debounceTimer = setTimeout(async () => {
            if (!isSubscriptionActive) return;

            try {
                const locations = await getGroupMembersLocations(groupId);

                if (isSubscriptionActive) {
                    callback(locations);
                }

            } catch (error) {
                console.error('Error getting locations:', error);
                if (isSubscriptionActive) {
                    callback([]);
                }
            }
        }, 300);
    };

    fetchLocationsDebounced();

    const unsubscribeLocations = onSnapshot(
        collection(db, 'ubicaciones'),
        (snapshot) => {
            if (!isSubscriptionActive) return;
            fetchLocationsDebounced();
        },
        (error) => {
            console.error('Error in locations subscription:', error);
            if (isSubscriptionActive) {
                callback([]);
            }
        }
    );

    const unsubscribeGroup = onSnapshot(
        doc(db, 'circulos', groupId),
        () => {
            if (!isSubscriptionActive) return;
            fetchLocationsDebounced();
        },
        (error) => {
            console.error('Error in group subscription:', error);
        }
    );

    return () => {
        isSubscriptionActive = false;

        if (debounceTimer) {
            clearTimeout(debounceTimer);
        }

        unsubscribeGroup();
        unsubscribeLocations();
    };
};

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
                lastActivated: new Date(),
            });
        } else {
            await setDoc(doc(db, 'ubicaciones', userId), {
                userId: userId,
                userEmail: userEmail,
                userName: userData.name || userEmail.split('@')[0],
                isOnline: true,
                lastActivated: new Date(),
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
                lastDeactivated: new Date(),
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

export const getMyLocation = async (userEmail: string): Promise<FirebaseUbicacion | null> => {
    try {
        const userQuery = query(collection(db, 'users'), where('email', '==', userEmail));
        const userSnapshot = await getDocs(userQuery);

        if (userSnapshot.empty) {
            return null;
        }

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
        console.error('Error getting my location:', error);
        return null;
    }
};

export const subscribeToMyLocation = (userEmail: string, callback: (location: FirebaseUbicacion | null) => void) => {
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
            }, (error) => {
                console.error('Error in location subscription:', error);
                callback(null);
            });

        } catch (error) {
            console.error('Error setting up subscription:', error);
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

export const getMemberCircleStatus = async (userEmail: string): Promise<{ active: boolean, lastUpdate: Date | null }> => {
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
        console.error('Error getting circle status:', error);
        return { active: false, lastUpdate: null };
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
        console.error('Error cleaning orphaned locations:', error);
        return {
            orphanedFound: 0,
            orphanedCleaned: 0,
            errors: [error instanceof Error ? error.message : 'Error desconocido']
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
                console.error('Error processing location:', locationDoc.id, error);
                errors++;
            }
        }

        if (cleaned > 0) {
            await batch.commit();
        }

        return { cleaned, errors };
    } catch (error) {
        console.error('Error cleaning inactive locations:', error);
        return { cleaned: 0, errors: 1 };
    }
};