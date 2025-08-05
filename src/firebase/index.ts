import { initializeApp } from "firebase/app";
import { getAuth, GoogleAuthProvider } from "firebase/auth";
import { 
  getFirestore, 
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
  setDoc,
  getDoc,
} from "firebase/firestore";

// Tu configuración de Firebase
const firebaseConfig = {
  apiKey: "AIzaSyBrzB7lXrYmcSCPwssx3a1tCj2bG_j4RaA",
  authDomain: "amsp-4cca7.firebaseapp.com",
  projectId: "amsp-4cca7",
  storageBucket: "amsp-4cca7.firebasestorage.app",
  messagingSenderId: "661304028062",
  appId: "1:661304028062:web:07d329787d3925983f848f",
  measurementId: "G-FBXK39FEQ3"
};

// Inicializar Firebase
const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);

// Google Auth Provider
const googleProvider = new GoogleAuthProvider();
export { googleProvider };

// Interfaces
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
  currentGroupId?: string; // ID del grupo actual del usuario
}

export interface FirebaseGroup {
  id: string;
  name: string;
  description: string;
  createdBy: string;
  members: string[]; // emails de los miembros
  pendingInvitations: string[]; // emails de invitaciones pendientes
  createdAt?: Date;
}

export interface FirebaseAlert {
  id: string;
  userId: string;
  userEmail: string;
  userName: string;
  location: string;
  coordinates?: [number, number];
  timestamp: Date;
  type: 'panic' | 'geofence' | 'manual';
  resolved: boolean;
  groupId?: string; // A qué grupo pertenece la alerta
}

// Nueva interfaz para ubicaciones (ahora un documento por usuario)
export interface FirebaseUserLocation {
  userId: string;
  userEmail: string;
  userName: string;
  lat: number;
  lng: number;
  accuracy?: number;
  timestamp: Date;
  isOnline: boolean;
}

export interface GroupInvitation {
  id: string;
  groupId: string;
  groupName: string;
  inviterEmail: string;
  inviterName: string;
  inviteeEmail: string;
  status: 'pending' | 'accepted' | 'rejected';
  createdAt: Date;
  expiresAt: Date;
}

// Funciones básicas de usuarios
export const getUsers = async (): Promise<FirebaseUser[]> => {
  try {
    const snapshot = await getDocs(collection(db, 'users'));
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as FirebaseUser));
  } catch (error) {
    console.error('Error getting users:', error);
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
    console.error('Error getting user by email:', error);
    return null;
  }
};

export const createUser = async (userData: Omit<FirebaseUser, 'id'>): Promise<string> => {
  try {
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

// Actualizar estado del usuario
export const updateUserStatus = async (userId: string, status: 'online' | 'offline'): Promise<void> => {
  try {
    const userRef = doc(db, 'users', userId);
    await updateDoc(userRef, {
      status,
      lastSeen: new Date()
    });
  } catch (error) {
    console.error('Error updating user status:', error);
  }
};

// Funciones de grupos
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
    console.error('Error getting groups:', error);
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
    console.error('Error getting user groups:', error);
    return [];
  }
};

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

// Invitar miembro al grupo
export const inviteToGroup = async (groupId: string, inviteeEmail: string, inviterData: { email: string, name: string }): Promise<string> => {
  try {
    // Verificar que el usuario a invitar existe
    const inviteeUser = await getUserByEmail(inviteeEmail);
    if (!inviteeUser) {
      throw new Error('El usuario no está registrado en el sistema');
    }

    // Obtener información del grupo
    const groupDoc = await getDoc(doc(db, 'circulos', groupId));
    if (!groupDoc.exists()) {
      throw new Error('El grupo no existe');
    }
    
    const groupData = groupDoc.data() as FirebaseGroup;

    // Verificar que no sea ya miembro
    if (groupData.members.includes(inviteeEmail)) {
      throw new Error('El usuario ya es miembro del grupo');
    }

    // Crear la invitación
    const invitation: Omit<GroupInvitation, 'id'> = {
      groupId,
      groupName: groupData.name,
      inviterEmail: inviterData.email,
      inviterName: inviterData.name,
      inviteeEmail,
      status: 'pending',
      createdAt: new Date(),
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) // 7 días
    };

    // Guardar invitación
    const invitationRef = await addDoc(collection(db, 'invitations'), invitation);

    // Agregar email a invitaciones pendientes del grupo
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

// Responder a invitación
export const respondToInvitation = async (invitationId: string, response: 'accepted' | 'rejected'): Promise<void> => {
  try {
    const invitationRef = doc(db, 'invitations', invitationId);
    const invitationDoc = await getDoc(invitationRef);
    
    if (!invitationDoc.exists()) {
      throw new Error('La invitación no existe');
    }

    const invitation = invitationDoc.data() as GroupInvitation;
    
    // Actualizar estado de la invitación
    await updateDoc(invitationRef, {
      status: response,
      respondedAt: new Date()
    });

    const groupRef = doc(db, 'circulos', invitation.groupId);
    
    if (response === 'accepted') {
      // Agregar usuario al grupo
      await updateDoc(groupRef, {
        members: arrayUnion(invitation.inviteeEmail),
        pendingInvitations: arrayRemove(invitation.inviteeEmail)
      });

      // Actualizar el usuario con el ID del grupo
      const user = await getUserByEmail(invitation.inviteeEmail);
      if (user) {
        const userRef = doc(db, 'users', user.id);
        await updateDoc(userRef, {
          currentGroupId: invitation.groupId
        });
      }
    } else {
      // Solo remover de invitaciones pendientes
      await updateDoc(groupRef, {
        pendingInvitations: arrayRemove(invitation.inviteeEmail)
      });
    }
  } catch (error) {
    console.error('Error responding to invitation:', error);
    throw error;
  }
};

// Obtener invitaciones de un usuario
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

export const removeMemberFromGroup = async (groupId: string, userEmail: string): Promise<void> => {
  try {
    const groupRef = doc(db, 'circulos', groupId);
    await updateDoc(groupRef, {
      members: arrayRemove(userEmail)
    });

    // Actualizar el usuario para remover el grupo
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

// Funciones de alertas
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
    console.error('Error getting alerts:', error);
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

// Funciones de ubicaciones (NUEVA IMPLEMENTACIÓN EFICIENTE)
export const updateUserLocation = async (userId: string, locationData: {
  userEmail: string;
  userName: string;
  lat: number;
  lng: number;
  accuracy?: number;
}): Promise<void> => {
  try {
    // Usar el userId como ID del documento para actualizar en lugar de crear nuevo
    const locationRef = doc(db, 'user_locations', userId);
    await setDoc(locationRef, {
      userId,
      ...locationData,
      timestamp: new Date(),
      isOnline: true
    }, { merge: true }); // merge: true actualiza campos existentes
  } catch (error) {
    console.error('Error updating user location:', error);
    throw error;
  }
};

// Obtener ubicaciones de miembros del grupo
export const getGroupMembersLocations = async (groupId: string): Promise<FirebaseUserLocation[]> => {
  try {
    // Primero obtener los miembros del grupo
    const groupDoc = await getDoc(doc(db, 'circulos', groupId));
    if (!groupDoc.exists()) return [];
    
    const groupData = groupDoc.data() as FirebaseGroup;
    const memberEmails = groupData.members;

    if (memberEmails.length === 0) return [];

    // Obtener las ubicaciones de los miembros
    const locations: FirebaseUserLocation[] = [];
    
    for (const email of memberEmails) {
      const user = await getUserByEmail(email);
      if (user) {
        const locationDoc = await getDoc(doc(db, 'user_locations', user.id));
        if (locationDoc.exists()) {
        locations.push({ id: locationDoc.id, ...locationDoc.data() } as FirebaseUserLocation);
}
      }
    }

    return locations;
  } catch (error) {
    console.error('Error getting group members locations:', error);
    return [];
  }
};

// Obtener mi ubicación
export const getMyLocation = async (userId: string): Promise<FirebaseUserLocation | null> => {
  try {
    const locationDoc = await getDoc(doc(db, 'user_locations', userId));
    if (locationDoc.exists()) {
    return { id: locationDoc.id, ...locationDoc.data() } as FirebaseUserLocation;
}

    return null;
  } catch (error) {
    console.error('Error getting my location:', error);
    return null;
  }
};

// Marcar usuario como offline
export const setUserOffline = async (userId: string): Promise<void> => {
  try {
    const locationRef = doc(db, 'user_locations', userId);
    await updateDoc(locationRef, {
      isOnline: false,
      timestamp: new Date()
    });
    
    // También actualizar en users
    await updateUserStatus(userId, 'offline');
  } catch (error) {
    console.error('Error setting user offline:', error);
  }
};

// Listeners en tiempo real
export const subscribeToUsers = (callback: (users: FirebaseUser[]) => void) => {
  return onSnapshot(collection(db, 'users'), (snapshot) => {
    const users = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as FirebaseUser));
    callback(users);
  }, (error) => {
    console.error('Error in users subscription:', error);
  });
};

export const subscribeToUserGroups = (userEmail: string, callback: (groups: FirebaseGroup[]) => void) => {
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
    },
    (error) => {
      console.error('Error in user groups subscription:', error);
    }
  );
};

export const subscribeToGroupLocations = (groupId: string, callback: (locations: FirebaseUserLocation[]) => void) => {
  // Primero obtener los miembros del grupo y luego suscribirse a sus ubicaciones
  const groupRef = doc(db, 'circulos', groupId);
  
  return onSnapshot(groupRef, async (groupSnapshot) => {
    if (!groupSnapshot.exists()) {
      callback([]);
      return;
    }
    
    const groupData = groupSnapshot.data() as FirebaseGroup;
    const memberEmails = groupData.members;
    
    if (memberEmails.length === 0) {
      callback([]);
      return;
    }

    // Obtener ubicaciones de todos los miembros
    const locations = await getGroupMembersLocations(groupId);
    callback(locations);
  });
};

export const subscribeToMyLocation = (userId: string, callback: (location: FirebaseUserLocation | null) => void) => {
  return onSnapshot(doc(db, 'user_locations', userId), (snapshot) => {
    if (snapshot.exists()) {
    callback({ id: snapshot.id, ...snapshot.data() } as FirebaseUserLocation);
  } else {
    callback(null);
}

  }, (error) => {
    console.error('Error in my location subscription:', error);
  });
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

export const subscribeToAlerts = (callback: (alerts: FirebaseAlert[]) => void) => {
  return onSnapshot(
    query(collection(db, 'alerts'), where('resolved', '==', false)), 
    (snapshot) => {
      const alerts = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as FirebaseAlert));
      callback(alerts);
    }, 
    (error) => {
      console.error('Error in alerts subscription:', error);
    }
  );
};

export const deleteUserGroup = async (groupId: string, userEmail: string): Promise<void> => {
  try {
    // Verificar que el usuario sea el creador del grupo
    const groupDoc = await getDoc(doc(db, 'circulos', groupId));
    if (!groupDoc.exists()) {
      throw new Error('El grupo no existe');
    }
    
    const groupData = groupDoc.data() as FirebaseGroup;
    if (groupData.createdBy !== userEmail) {
      throw new Error('Solo el creador del grupo puede eliminarlo');
    }

    // Eliminar todas las invitaciones relacionadas con este grupo
    const invitationsQuery = query(
      collection(db, 'invitations'),
      where('groupId', '==', groupId)
    );
    const invitationsSnapshot = await getDocs(invitationsQuery);
    
    // Eliminar invitaciones en lote
    const deletePromises = invitationsSnapshot.docs.map(doc => deleteDoc(doc.ref));
    await Promise.all(deletePromises);

    // Eliminar el grupo
    await deleteDoc(doc(db, 'circulos', groupId));
  } catch (error) {
    console.error('Error deleting group:', error);
    throw error;
  }
};
