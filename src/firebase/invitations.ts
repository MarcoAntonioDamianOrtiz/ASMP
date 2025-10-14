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
import type { GroupInvitation, FirebaseGroup } from "./types";
import { getUserByEmail } from "./users";

export const inviteToGroup = async (groupId: string, inviteeEmail: string, inviterData: { email: string, name: string }): Promise<string> => {
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

export const respondToInvitation = async (invitationId: string, response: 'accepted' | 'rejected'): Promise<void> => {
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
        console.error('Error getting user invitations:', error);
        return [];
    }
};

export const subscribeToUserInvitations = (userEmail: string, callback: (invitations: GroupInvitation[]) => void) => {
    return onSnapshot(
        query(
            collection(db, 'invitations'),
            where('inviteeEmail', '==', userEmail),
            where('status', '==', 'pending')
        ),
        (snapshot) => {
            const invitations = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as GroupInvitation));
            callback(invitations);
        },
        (error) => {
            console.error('Error in invitations subscription:', error);
        }
    );
};

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