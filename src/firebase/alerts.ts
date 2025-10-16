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
    getDoc,
    orderBy
} from "firebase/firestore";
import { db } from "./config";

export interface FirebaseAlert {
    id: string;
    circleIds?: string[];
    userId: string;
    userEmail: string;
    userName: string;
    location: string;
    coordinates?: [number, number];
    timestamp: any;
    type: 'panic' | 'geofence' | 'manual';
    resolved: boolean;
    groupId?: string;
    message?: string;
    phone?: string;
    destinatarios?: string[];
    emisorId?: string;
}

// ========== OBTENER ALERTAS DE GRUPO ==========
export const getGroupAlerts = async (groupId: string): Promise<FirebaseAlert[]> => {
    try {
        if (!groupId) return [];

        const queries = [
            query(collection(db, 'alertasCirculos'), where('circleIds', 'array-contains', groupId)),
            query(collection(db, 'alertasCirculos'), where('circleId', '==', groupId)),
            query(collection(db, 'alertasCirculos'), where('groupId', '==', groupId))
        ];

        let allAlerts: FirebaseAlert[] = [];

        for (const q of queries) {
            try {
                const snapshot = await getDocs(q);

                if (!snapshot.empty) {
                    const alerts = snapshot.docs.map(doc => {
                        const data = doc.data();
                        return {
                            id: doc.id,
                            userId: data.emisorId || data.userId || '',
                            userEmail: data.email || data.userEmail || '',
                            userName: data.name || data.userName || 'Usuario desconocido',
                            location: data.ubicacion ?
                                `${data.ubicacion.lat.toFixed(6)}, ${data.ubicacion.lng.toFixed(6)}` :
                                data.location || 'Ubicación no disponible',
                            coordinates: data.ubicacion ?
                                [data.ubicacion.lng, data.ubicacion.lat] :
                                data.coordinates || undefined,
                            timestamp: data.timestamp,
                            type: data.type || 'panic' as const,
                            resolved: !data.activatrue,
                            groupId: data.circleIds?.[0] || data.circleId || data.groupId || groupId,
                            message: data.mensaje || data.message || '',
                            phone: data.phone || '',
                            destinatarios: data.destinatarios || [],
                            emisorId: data.emisorId || data.userId || ''
                        } as FirebaseAlert;
                    });

                    allAlerts = [...allAlerts, ...alerts];
                    break;
                }
            } catch (queryError) {
                continue;
            }
        }

        const uniqueAlerts = allAlerts.filter((alert, index, self) =>
            index === self.findIndex(a => a.id === alert.id)
        );

        return uniqueAlerts.sort((a, b) => {
            const dateA = a.timestamp?.toDate ? a.timestamp.toDate() : new Date(a.timestamp);
            const dateB = b.timestamp?.toDate ? b.timestamp.toDate() : new Date(b.timestamp);
            return dateB.getTime() - dateA.getTime();
        });

    } catch (error) {
        console.error('Error getting group alerts:', error);

        try {
            const fallbackQuery = query(
                collection(db, 'alertasCirculos'),
                where('circleIds', 'array-contains', groupId)
            );

            const snapshot = await getDocs(fallbackQuery);

            const fallbackAlerts = snapshot.docs.map(doc => {
                const data = doc.data();
                return {
                    id: doc.id,
                    userId: data.emisorId || data.userId || '',
                    userEmail: data.email || data.userEmail || '',
                    userName: data.name || data.userName || 'Usuario desconocido',
                    location: data.ubicacion ?
                        `${data.ubicacion.lat.toFixed(6)}, ${data.ubicacion.lng.toFixed(6)}` :
                        data.location || 'Ubicación no disponible',
                    coordinates: data.ubicacion ?
                        [data.ubicacion.lng, data.ubicacion.lat] :
                        data.coordinates || undefined,
                    timestamp: data.timestamp,
                    type: data.type || 'panic' as const,
                    resolved: !data.activatrue,
                    groupId: data.circleIds?.[0] || data.circleId || data.groupId || groupId,
                    message: data.mensaje || data.message || '',
                    phone: data.phone || '',
                    destinatarios: data.destinatarios || [],
                    emisorId: data.emisorId || data.userId || ''
                } as FirebaseAlert;
            });

            return fallbackAlerts.sort((a, b) => {
                const dateA = a.timestamp?.toDate ? a.timestamp.toDate() : new Date(a.timestamp);
                const dateB = b.timestamp?.toDate ? b.timestamp.toDate() : new Date(b.timestamp);
                return dateB.getTime() - dateA.getTime();
            });

        } catch (fallbackError) {
            return [];
        }
    }
};

// ========== SUSCRIPCIÓN A ALERTAS EN TIEMPO REAL ==========
export const subscribeToGroupAlerts = (
    groupId: string,
    callback: (alerts: FirebaseAlert[]) => void
) => {
    if (!groupId) {
        callback([]);
        return () => { };
    }

    try {
        const qWithArrayContains = query(
            collection(db, 'alertasCirculos'),
            where('circleIds', 'array-contains', groupId),
            orderBy('timestamp', 'desc')
        );

        return onSnapshot(qWithArrayContains, (snapshot) => {
            if (snapshot.empty) {
                const qWithCircleId = query(
                    collection(db, 'alertasCirculos'),
                    where('circleId', '==', groupId),
                    orderBy('timestamp', 'desc')
                );

                return onSnapshot(qWithCircleId, (snapshot2) => {
                    processAlertsSnapshot(snapshot2, groupId, callback);
                }, () => {
                    subscribeWithoutOrderBy(groupId, callback);
                });
            } else {
                processAlertsSnapshot(snapshot, groupId, callback);
            }
        }, () => {
            subscribeWithoutOrderBy(groupId, callback);
        });

    } catch (subscriptionError) {
        callback([]);
        return () => { };
    }
};

const processAlertsSnapshot = (
    snapshot: any,
    groupId: string,
    callback: (alerts: FirebaseAlert[]) => void
) => {
    const alerts = snapshot.docs.map((doc: any) => {
        const data = doc.data();

        if (!data.timestamp) return null;

        return {
            id: doc.id,
            userId: data.emisorId || data.userId || '',
            userEmail: data.email || data.userEmail || '',
            userName: data.name || data.userName || 'Usuario desconocido',
            location: data.ubicacion ?
                `${data.ubicacion.lat.toFixed(6)}, ${data.ubicacion.lng.toFixed(6)}` :
                data.location || 'Ubicación no disponible',
            coordinates: data.ubicacion ?
                [data.ubicacion.lng, data.ubicacion.lat] :
                data.coordinates || undefined,
            timestamp: data.timestamp,
            type: data.type || 'panic' as const,
            resolved: !data.activatrue,
            groupId: data.circleIds?.[0] || data.circleId || data.groupId || groupId,
            message: data.mensaje || data.message || '',
            phone: data.phone || '',
            destinatarios: data.destinatarios || [],
            emisorId: data.emisorId || data.userId || ''
        } as FirebaseAlert;
    }).filter((alert: any) => alert !== null) as FirebaseAlert[];

    callback(alerts);
};

const subscribeWithoutOrderBy = (groupId: string, callback: (alerts: FirebaseAlert[]) => void) => {
    const qWithoutOrder1 = query(
        collection(db, 'alertasCirculos'),
        where('circleIds', 'array-contains', groupId)
    );

    return onSnapshot(qWithoutOrder1, (snapshot) => {
        if (snapshot.empty) {
            const qWithoutOrder2 = query(
                collection(db, 'alertasCirculos'),
                where('circleId', '==', groupId)
            );

            return onSnapshot(qWithoutOrder2, (snapshot2) => {
                const alerts = processAndSortAlerts(snapshot2, groupId);
                callback(alerts);
            }, () => {
                callback([]);
            });
        } else {
            const alerts = processAndSortAlerts(snapshot, groupId);
            callback(alerts);
        }
    }, () => {
        callback([]);
    });
};

const processAndSortAlerts = (snapshot: any, groupId: string): FirebaseAlert[] => {
    const alerts = snapshot.docs.map((doc: any) => {
        const data = doc.data();
        if (!data.timestamp) return null;

        return {
            id: doc.id,
            userId: data.emisorId || data.userId || '',
            userEmail: data.email || data.userEmail || '',
            userName: data.name || data.userName || 'Usuario desconocido',
            location: data.ubicacion ?
                `${data.ubicacion.lat.toFixed(6)}, ${data.ubicacion.lng.toFixed(6)}` :
                data.location || 'Ubicación no disponible',
            coordinates: data.ubicacion ?
                [data.ubicacion.lng, data.ubicacion.lat] :
                data.coordinates || undefined,
            timestamp: data.timestamp,
            type: data.type || 'panic' as const,
            resolved: !data.activatrue,
            groupId: data.circleIds?.[0] || data.circleId || data.groupId || groupId,
            message: data.mensaje || data.message || '',
            phone: data.phone || '',
            destinatarios: data.destinatarios || [],
            emisorId: data.emisorId || data.userId || ''
        } as FirebaseAlert;
    }).filter((alert: any) => alert !== null).sort((a: FirebaseAlert, b: FirebaseAlert) => {
        const dateA = a.timestamp?.toDate ? a.timestamp.toDate() : new Date(a.timestamp);
        const dateB = b.timestamp?.toDate ? b.timestamp.toDate() : new Date(b.timestamp);
        return dateB.getTime() - dateA.getTime();
    }) as FirebaseAlert[];

    return alerts;
};

// ========== RESOLVER ALERTA ==========
export const resolveGroupAlert = async (alertId: string): Promise<void> => {
    try {
        const alertRef = doc(db, 'alertasCirculos', alertId);
        const alertDoc = await getDoc(alertRef);

        if (!alertDoc.exists()) {
            throw new Error('La alerta no existe');
        }

        await updateDoc(alertRef, {
            activatrue: false,
            resolved: true,
            resolvedAt: new Date()
        });
    } catch (error) {
        console.error('Error resolving alert:', error);
        throw error;
    }
};

// ========== ESTADÍSTICAS DE ALERTAS ==========
export const getGroupAlertStats = async (groupId: string): Promise<{
    total: number;
    active: number;
    resolved: number;
    today: number;
    thisWeek: number;
    thisMonth: number;
}> => {
    try {
        const alerts = await getGroupAlerts(groupId);
        const now = new Date();
        const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        const thisWeek = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        const thisMonth = new Date(now.getFullYear(), now.getMonth(), 1);

        const stats = {
            total: alerts.length,
            active: 0,
            resolved: 0,
            today: 0,
            thisWeek: 0,
            thisMonth: 0
        };

        alerts.forEach(alert => {
            let alertDate: Date;

            if (alert.timestamp?.toDate) {
                alertDate = alert.timestamp.toDate();
            } else if (alert.timestamp?.seconds) {
                alertDate = new Date(alert.timestamp.seconds * 1000);
            } else {
                alertDate = new Date(alert.timestamp);
            }

            if (isNaN(alertDate.getTime())) return;

            if (alert.resolved) {
                stats.resolved++;
            } else {
                stats.active++;
            }

            if (alertDate >= today) stats.today++;
            if (alertDate >= thisWeek) stats.thisWeek++;
            if (alertDate >= thisMonth) stats.thisMonth++;
        });

        return stats;

    } catch (error) {
        return {
            total: 0, active: 0, resolved: 0, today: 0, thisWeek: 0, thisMonth: 0
        };
    }
};

// ========== ALERTAS TRADICIONALES (COLECCIÓN alerts) ==========
export const createAlert = async (alertData: Omit<FirebaseAlert, 'id'>): Promise<string> => {
    try {
        const docRef = await addDoc(collection(db, 'alerts'), {
            ...alertData,
            timestamp: new Date(),
            resolved: false
        });
        return docRef.id;
    } catch (error) {
        console.error('Error creating alert:', error);
        throw error;
    }
};

export const getAlerts = async (): Promise<FirebaseAlert[]> => {
    try {
        const snapshot = await getDocs(collection(db, 'alerts'));
        return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as FirebaseAlert));
    } catch (error) {
        return [];
    }
};

export const resolveAlert = async (alertId: string): Promise<void> => {
    try {
        const alertRef = doc(db, 'alerts', alertId);
        await updateDoc(alertRef, {
            resolved: true,
            resolvedAt: new Date()
        });
    } catch (error) {
        console.error('Error resolving alert:', error);
        throw error;
    }
};

export const subscribeToAlerts = (callback: (alerts: FirebaseAlert[]) => void) => {
    return onSnapshot(
        query(collection(db, 'alerts'), where('resolved', '==', false)),
        (snapshot) => {
            const alerts = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as FirebaseAlert));
            callback(alerts);
        }
    );
};

// ========== OBTENER ALERTAS DE TODOS LOS GRUPOS DEL USUARIO ==========
export const getUserGroupsAlerts = async (userEmail: string): Promise<FirebaseAlert[]> => {
    try {
        const { getUserGroups } = await import('./groups');
        const userGroups = await getUserGroups(userEmail);

        if (userGroups.length === 0) return [];

        const allAlerts: FirebaseAlert[] = [];

        for (const group of userGroups) {
            try {
                const groupAlerts = await getGroupAlerts(group.id);
                allAlerts.push(...groupAlerts);
            } catch (error) {
                continue;
            }
        }

        const uniqueAlerts = allAlerts
            .filter((alert, index, self) => index === self.findIndex(a => a.id === alert.id))
            .sort((a, b) => {
                const dateA = a.timestamp?.toDate ? a.timestamp.toDate() : new Date(a.timestamp);
                const dateB = b.timestamp?.toDate ? b.timestamp.toDate() : new Date(b.timestamp);
                return dateB.getTime() - dateA.getTime();
            });

        return uniqueAlerts;

    } catch (error) {
        return [];
    }
};