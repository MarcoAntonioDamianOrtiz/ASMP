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
  currentGroupId?: string;
}

export interface FirebaseGroup {
  id: string;
  name: string;
  description: string;
  createdBy: string;
  members: string[];
  pendingInvitations: string[];
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
  groupId?: string;
}

export interface FirebaseUbicacion {
  id: string;
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

export const updateUserStatus = async (userId: string, status: 'online' | 'offline', locationData?: {
  lat: number;
  lng: number;
}): Promise<void> => {
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

// FUNCIONES DE UBICACIONES CORREGIDAS
export const updateUserLocation = async (userId: string, locationData: {
  userEmail: string;
  userName: string;
  lat: number;
  lng: number;
  accuracy?: number;
}): Promise<void> => {
  try {
    // USAR SIEMPRE userId como documento ID para evitar duplicados
    const locationRef = doc(db, 'ubicaciones', userId);
    
    await setDoc(locationRef, {
      userId,
      ...locationData,
      timestamp: new Date(),
      isOnline: true
    }, { merge: true });
    
    console.log('✅ Ubicación actualizada para userId:', userId);
  } catch (error) {
    console.error('❌ Error updating user location:', error);
    throw error;
  }
};

// FUNCIÓN CORREGIDA para limpiar ubicación
export const cleanupUserLocation = async (userId: string): Promise<void> => {
  try {
    const locationRef = doc(db, 'ubicaciones', userId);
    const locationDoc = await getDoc(locationRef);
    
    if (locationDoc.exists()) {
      await deleteDoc(locationRef);
      console.log('🧹 Documento de ubicación eliminado para userId:', userId);
    }
  } catch (error) {
    console.error('❌ Error cleaning user location:', error);
  }
};

// FUNCIÓN MEJORADA para marcar usuario offline
export const setUserOffline = async (userId: string): Promise<void> => {
  try {
    const locationRef = doc(db, 'ubicaciones', userId);
    const locationDoc = await getDoc(locationRef);
    
    if (locationDoc.exists()) {
      // En lugar de solo marcar offline, eliminar completamente el documento
      await deleteDoc(locationRef);
      console.log('✅ Ubicación eliminada para usuario offline:', userId);
    }

    // También actualizar el estado del usuario
    const userRef = doc(db, 'users', userId);
    const userDoc = await getDoc(userRef);
    
    if (userDoc.exists()) {
      await updateDoc(userRef, {
        status: 'offline',
        lastSeen: new Date()
      });
      console.log('✅ Usuario marcado como offline:', userId);
    }
  } catch (error) {
    console.error('❌ Error setting user offline:', error);
  }
};

export const getGroupMembersLocations = async (groupId: string): Promise<FirebaseUbicacion[]> => {
  try {
    const groupDoc = await getDoc(doc(db, 'circulos', groupId));
    if (!groupDoc.exists()) return [];
    
    const groupData = groupDoc.data() as FirebaseGroup;
    const memberEmails = groupData.members;

    if (memberEmails.length === 0) return [];

    const locations: FirebaseUbicacion[] = [];
    
    for (const email of memberEmails) {
      const user = await getUserByEmail(email);
      if (user) {
        const locationDoc = await getDoc(doc(db, 'ubicaciones', user.id));
        if (locationDoc.exists()) {
          const locationData = locationDoc.data();
          locations.push({ 
            id: locationDoc.id, 
            userId: user.id,
            userEmail: email,
            userName: user.name,
            lat: locationData.lat,
            lng: locationData.lng,
            accuracy: locationData.accuracy,
            timestamp: locationData.timestamp,
            isOnline: locationData.isOnline || false
          } as FirebaseUbicacion);
        }
      }
    }
    return locations;
  } catch (error) {
    console.error('Error getting group members locations:', error);
    return [];
  }
};

export const getMyLocation = async (userId: string): Promise<FirebaseUbicacion | null> => {
  try {
    const locationDoc = await getDoc(doc(db, 'ubicaciones', userId));
    if (locationDoc.exists()) {
      const locationData = locationDoc.data();
      const userDoc = await getDoc(doc(db, 'users', userId));
      const userData = userDoc.exists() ? userDoc.data() : null;
      
      return { 
        id: locationDoc.id, 
        userId: userId,
        userEmail: userData?.email || '',
        userName: userData?.name || 'Usuario',
        lat: locationData.lat,
        lng: locationData.lng,
        accuracy: locationData.accuracy,
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

// FUNCIÓN COMPLETAMENTE CORREGIDA para suscripción a ubicaciones del grupo
export const subscribeToGroupLocations = (groupId: string, callback: (locations: FirebaseUbicacion[]) => void) => {
  console.log('🔄 Suscribiéndose a ubicaciones del grupo:', groupId);

  const fetchLocations = async () => {
    try {
      // 1. Obtener miembros del grupo
      const groupDoc = await getDoc(doc(db, 'circulos', groupId));
      if (!groupDoc.exists()) {
        console.log('❌ Grupo no existe');
        callback([]);
        return;
      }
      
      const groupData = groupDoc.data() as FirebaseGroup;
      const memberEmails = groupData.members || [];
      console.log('👥 Emails de miembros:', memberEmails);
      
      if (memberEmails.length === 0) {
        callback([]);
        return;
      }

      // 2. Obtener TODOS los usuarios para mapear email -> userId
      const usersSnapshot = await getDocs(collection(db, 'users'));
      const emailToUserMap = new Map<string, { userId: string, userData: any }>();
      
      usersSnapshot.docs.forEach(userDoc => {
        const userData = userDoc.data();
        if (userData.email && memberEmails.includes(userData.email)) {
          emailToUserMap.set(userData.email, {
            userId: userDoc.id,
            userData: userData
          });
        }
      });
      
      console.log('📊 Usuarios mapeados:', emailToUserMap.size);

      // 3. Obtener ubicaciones de los miembros del grupo
      const locations: FirebaseUbicacion[] = [];
      
      for (const [email, { userId, userData }] of emailToUserMap.entries()) {
        try {
          const locationDoc = await getDoc(doc(db, 'ubicaciones', userId));
          
          if (locationDoc.exists()) {
            const locationData = locationDoc.data();
            console.log('🔍 Procesando ubicación de:', userData.name, locationData);

            if (locationData.lat && locationData.lng) {
              const location: FirebaseUbicacion = {
                id: locationDoc.id,
                userId: userId,
                userEmail: email,
                userName: userData.name || email.split('@')[0],
                lat: Number(locationData.lat),
                lng: Number(locationData.lng),
                accuracy: locationData.accuracy,
                timestamp: locationData.timestamp,
                isOnline: locationData.isOnline || false
              };
              
              locations.push(location);
              console.log('📍 Ubicación válida agregada:', userData.name, 'Online:', location.isOnline);
            } else {
              console.log('⚠️ Ubicación sin coordenadas válidas:', email);
            }
          } else {
            console.log('❌ No hay documento de ubicación para:', email);
          }
        } catch (err) {
          console.error('❌ Error obteniendo ubicación para', email, ':', err);
        }
      }
      
      console.log('🎯 Total ubicaciones encontradas:', locations.length);
      callback(locations);
      
    } catch (error) {
      console.error('❌ Error general obteniendo ubicaciones:', error);
      callback([]);
    }
  };

  // Ejecutar fetch inicial
  fetchLocations();

  // Configurar listeners para actualizaciones en tiempo real
  const unsubscribeGroup = onSnapshot(doc(db, 'circulos', groupId), () => {
    console.log('🔄 Grupo actualizado, refrescando ubicaciones...');
    fetchLocations();
  });

  const unsubscribeLocations = onSnapshot(collection(db, 'ubicaciones'), (snapshot) => {
    console.log('🔄 Cambios en ubicaciones detectados, docs:', snapshot.docs.length);
    fetchLocations();
  });

  // Retornar función de cleanup
  return () => {
    console.log('🧹 Limpiando suscripciones de grupo:', groupId);
    unsubscribeGroup();
    unsubscribeLocations();
  };
};

// Suscribirse a mi ubicación en tiempo real
export const subscribeToMyLocation = (userId: string, callback: (location: FirebaseUbicacion | null) => void) => {
  console.log('📍 Suscribiéndose a mi ubicación:', userId);
  
  return onSnapshot(doc(db, 'ubicaciones', userId), async (snapshot) => {
    if (snapshot.exists()) {
      const locationData = snapshot.data();
      console.log('📍 Mi ubicación actualizada:', locationData);
      
      const userDoc = await getDoc(doc(db, 'users', userId));
      const userData = userDoc.exists() ? userDoc.data() : null;
      
      callback({ 
        id: snapshot.id,
        userId: userId,
        userEmail: userData?.email || '',
        userName: userData?.name || 'Usuario',
        lat: locationData.lat,
        lng: locationData.lng,
        accuracy: locationData.accuracy,
        timestamp: locationData.timestamp,
        isOnline: locationData.isOnline || false
      } as FirebaseUbicacion);
    } else {
      console.log('❌ No existe mi documento de ubicación');
      callback(null);
    }
  }, (error) => {
    console.error('Error in my location subscription:', error);
    callback(null);
  });
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

// FUNCIONES CORREGIDAS PARA ACTIVAR/DESACTIVAR CÍRCULOS
export const activateMemberCircle = async (userEmail: string): Promise<void> => {
  try {
    console.log('🎯 Activando círculo para:', userEmail);
    
    const userQuery = query(collection(db, 'users'), where('email', '==', userEmail));
    const userSnapshot = await getDocs(userQuery);
    
    if (userSnapshot.empty) {
      throw new Error('Usuario no encontrado');
    }
    
    const userDoc = userSnapshot.docs[0];
    const userData = userDoc.data();
    const userId = userDoc.id;
    
    // USAR SIEMPRE userId como documento ID
    const locationRef = doc(db, 'ubicaciones', userId);
    
    // Crear o actualizar el documento de ubicación
    await setDoc(locationRef, {
      userId: userId,
      userEmail: userEmail,
      userName: userData.name || 'Usuario',
      lat: 19.4290767, // Coordenadas por defecto (UTT)
      lng: -98.1556253,
      accuracy: 50,
      timestamp: new Date(),
      isOnline: true
    }, { merge: true });
    
    console.log('✅ Círculo activado para:', userData.name);
    
  } catch (error) {
    console.error('❌ Error activando círculo:', error);
    throw error;
  }
};

export const deactivateMemberCircle = async (userEmail: string): Promise<void> => {
  try {
    console.log('🚫 Desactivando círculo para:', userEmail);
    
    const userQuery = query(collection(db, 'users'), where('email', '==', userEmail));
    const userSnapshot = await getDocs(userQuery);
    
    if (userSnapshot.empty) {
      throw new Error('Usuario no encontrado');
    }
    
    const userId = userSnapshot.docs[0].id;
    
    // En lugar de solo marcar como offline, eliminar el documento
    await setUserOffline(userId);
    
    console.log('✅ Círculo desactivado para:', userEmail);
    
  } catch (error) {
    console.error('❌ Error desactivando círculo:', error);
    throw error;
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
    console.error('❌ Error obteniendo estado del círculo:', error);
    return { active: false, lastUpdate: null };
  }
};