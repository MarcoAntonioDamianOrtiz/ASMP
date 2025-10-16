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
    arrayUnion,
    arrayRemove,
    getDoc
} from "firebase/firestore";
import { db } from "./config";
import { getUserByEmail } from "./users";
import type { FirebaseUbicacion } from "./users";

export interface FirebaseGroup {
    id: string;
    name: string;
    description: string;
    createdBy: string;
    members: string[];
    pendingInvitations: string[];
    createdAt?: Date;
}

export interface GroupInvitation {
    id: string;
    groupId: string;
    groupName: string;
    inviterEmail: string;
    inviterName: string;
    inviteeEmail: string;
    status: 'pending' | 'accepted' | 'rejected';
    createdAt: any;
    expiresAt: any;
}

// ========== OBTENER GRUPOS ==========
export const getGroups = async (): Promise<FirebaseGroup[]> => {
    try {
        const snapshot = await getDocs(collection(db, 'circulos'));
        return snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data(),
            members: doc.data().members || [],
            pendingInvitations: doc.data().pendingInvitations || []
        } as FirebaseGroup));
    } catch (error) {
        return [];
    }
};

export const getUserGroups = async (userEmail: string): Promise<FirebaseGroup[]> => {
    try {
        const q = query(
            collection(db, 'circulos'),
            where('members', 'array-contains', userEmail)
        );
        const snapshot = await getDocs(q);
        return snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data(),
            members: doc.data().members || [],
            pendingInvitations: doc.data().pendingInvitations || []
        } as FirebaseGroup));
    } catch (error) {
        return [];
    }
};

// ========== CREAR/ELIMINAR GRUPOS ==========
export const createGroup = async (groupData: Omit<FirebaseGroup, 'id'>): Promise<string> => {
    try {
        const docRef = await addDoc(collection(db, 'circulos'), {
            ...groupData,
            members: groupData.members || [],
            pendingInvitations: groupData.pendingInvitations || [],
            createdAt: new Date()
        });
        return docRef.id;
    } catch (error) {
        console.error('Error creating group:', error);
        throw error;
    }
};

export const deleteGroup = async (groupId: string): Promise<void> => {
    try {
        await deleteDoc(doc(db, 'circulos', groupId));
    } catch (error) {
        console.error('Error deleting group:', error);
        throw error;
    }
};

export const deleteUserGroup = async (groupId: string, userEmail: string): Promise<void> => {
    try {
        const groupDoc = await getDoc(doc(db, 'circulos', groupId));
        if (!groupDoc.exists()) {
            throw new Error('El grupo no existe');
        }

        const groupData = groupDoc.data() as FirebaseGroup;
        if (groupData.createdBy !== userEmail) {
            throw new Error('Solo el creador del grupo puede eliminarlo');
        }

        const invitationsQuery = query(
            collection(db, 'invitations'),
            where('groupId', '==', groupId)
        );
        const invitationsSnapshot = await getDocs(invitationsQuery);

        const deletePromises = invitationsSnapshot.docs.map(doc => deleteDoc(doc.ref));
        await Promise.all(deletePromises);

        await deleteDoc(doc(db, 'circulos', groupId));
    } catch (error) {
        console.error('Error deleting group:', error);
        throw error;
    }
};

// ========== INVITACIONES ==========
export const inviteToGroup = async (
    groupId: string,
    inviteeEmail: string,
    inviterData: { email: string, name: string }
): Promise<string> => {
    try {
        const inviteeUser = await getUserByEmail(inviteeEmail);
        if (!inviteeUser) {
            throw new Error('El usuario no está registrado en el sistema');
        }

        const groupDoc = await getDoc(doc(db, 'circulos', groupId));
        if (!groupDoc.exists()) {
            throw new Error('El grupo no existe');
        }

        const groupData = groupDoc.data() as FirebaseGroup;

        if (groupData.members.includes(inviteeEmail)) {
            throw new Error('El usuario ya es miembro del grupo');
        }

        const invitation: Omit<GroupInvitation, 'id'> = {
            groupId,
            groupName: groupData.name,
            inviterEmail: inviterData.email,
            inviterName: inviterData.name,
            inviteeEmail,
            status: 'pending',
            createdAt: new Date(),
            expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
        };

        const invitationRef = await addDoc(collection(db, 'invitations'), invitation);

        const groupRef = doc(db, 'circulos', groupId);
        await updateDoc(groupRef, {
            pendingInvitations: arrayUnion(inviteeEmail)
        });

        return invitationRef.id;
    } catch (error) {
        console.error('Error inviting to group:', error);
        throw error;
    }
};

export const respondToInvitation = async (
    invitationId: string,
    response: 'accepted' | 'rejected'
): Promise<void> => {
    try {
        const invitationRef = doc(db, 'invitations', invitationId);
        const invitationDoc = await getDoc(invitationRef);

        if (!invitationDoc.exists()) {
            throw new Error('La invitación no existe');
        }

        const invitation = invitationDoc.data() as GroupInvitation;

        await updateDoc(invitationRef, {
            status: response,
            respondedAt: new Date()
        });

        const groupRef = doc(db, 'circulos', invitation.groupId);

        if (response === 'accepted') {
            await updateDoc(groupRef, {
                members: arrayUnion(invitation.inviteeEmail),
                pendingInvitations: arrayRemove(invitation.inviteeEmail)
            });

            const user = await getUserByEmail(invitation.inviteeEmail);
            if (user) {
                const userRef = doc(db, 'users', user.id);
                await updateDoc(userRef, {
                    currentGroupId: invitation.groupId
                });
            }
        } else {
            await updateDoc(groupRef, {
                pendingInvitations: arrayRemove(invitation.inviteeEmail)
            });
        }
    } catch (error) {
        console.error('Error responding to invitation:', error);
        throw error;
    }
};

export const getUserInvitations = async (userEmail: string): Promise<GroupInvitation[]> => {
    try {
        const q = query(
            collection(db, 'invitations'),
            where('inviteeEmail', '==', userEmail),
            where('status', '==', 'pending')
        );
        const snapshot = await getDocs(q);
        return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as GroupInvitation));
    } catch (error) {
        return [];
    }
};

// ========== MIEMBROS ==========
export const removeMemberFromGroup = async (groupId: string, userEmail: string): Promise<void> => {
    try {
        const groupRef = doc(db, 'circulos', groupId);
        await updateDoc(groupRef, {
            members: arrayRemove(userEmail)
        });

        const user = await getUserByEmail(userEmail);
        if (user) {
            const userRef = doc(db, 'users', user.id);
            await updateDoc(userRef, {
                currentGroupId: null
            });
        }
    } catch (error) {
        console.error('Error removing member from group:', error);
        throw error;
    }
};

// ========== UBICACIONES DE MIEMBROS ==========
export const getGroupMembersLocations = async (groupId: string): Promise<FirebaseUbicacion[]> => {
    try {
        const groupDoc = await getDoc(doc(db, 'circulos', groupId));
        if (!groupDoc.exists()) return [];

        const groupData = groupDoc.data() as FirebaseGroup;
        const memberEmails = groupData.members || [];

        if (memberEmails.length === 0) return [];

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
                continue;
            }
        }

        return locations;

    } catch (error) {
        return [];
    }
};

export const subscribeToGroupLocations = (
    groupId: string,
    callback: (locations: FirebaseUbicacion[]) => void
) => {
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
                if (isSubscriptionActive) {
                    callback([]);
                }
            }
        }, 300);
    };

    fetchLocationsDebounced();

    const unsubscribeLocations = onSnapshot(
        collection(db, 'ubicaciones'),
        () => {
            if (!isSubscriptionActive) return;
            fetchLocationsDebounced();
        },
        () => {
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

// ========== SUSCRIPCIONES ==========
export const subscribeToUserGroups = (
    userEmail: string,
    callback: (groups: FirebaseGroup[]) => void
) => {
    return onSnapshot(
        query(collection(db, 'circulos'), where('members', 'array-contains', userEmail)),
        (snapshot) => {
            const groups = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data(),
                members: doc.data().members || [],
                pendingInvitations: doc.data().pendingInvitations || []
            } as FirebaseGroup));
            callback(groups);
        }
    );
};

export const subscribeToUserInvitations = (
    userEmail: string,
    callback: (invitations: GroupInvitation[]) => void
) => {
    return onSnapshot(
        query(
            collection(db, 'invitations'),
            where('inviteeEmail', '==', userEmail),
            where('status', '==', 'pending')
        ),
        (snapshot) => {
            const invitations = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            } as GroupInvitation));
            callback(invitations);
        }
    );
};