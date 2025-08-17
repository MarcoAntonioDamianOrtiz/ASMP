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
  writeBatch,
  orderBy,
  limit
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

// Exportar writeBatch
export { writeBatch };

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
  timestamp: any; // Firestore timestamp
  type: 'panic' | 'geofence' | 'manual';
  resolved: boolean;
  groupId?: string;
  message?: string;
  phone?: string;
  destinatarios?: string[];
  emisorId?: string;
}

export interface FirebaseUbicacion {
  id: string;
  userId: string;
  userEmail: string;
  userName: string;
  lat: number;
  lng: number;
  accuracy?: number;
  timestamp: any; // Firestore timestamp
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
  createdAt: any; // Firestore timestamp
  expiresAt: any; // Firestore timestamp
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

// FUNCIONES DE ALERTAS COMPLETAMENTE CORREGIDAS
export const getGroupAlerts = async (groupId: string): Promise<FirebaseAlert[]> => {
  try {
    console.log('🔍 Buscando alertas para el grupo (circleId):', groupId);
    
    if (!groupId) {
      console.warn('⚠️ GroupId vacío');
      return [];
    }
    
    const q = query(
      collection(db, 'alertasCirculos'),
      where('circleId', '==', groupId),
      orderBy('timestamp', 'desc'),
      limit(100)
    );
    
    const snapshot = await getDocs(q);
    console.log(`📊 Encontrados ${snapshot.docs.length} documentos de alertas`);
    
    if (snapshot.empty) {
      console.log('📭 No se encontraron alertas para este grupo');
      return [];
    }
    
    const alerts = snapshot.docs.map(doc => {
      const data = doc.data();
      console.log('📄 Procesando alerta:', doc.id, {
        circleId: data.circleId,
        activa: data.activa,
        name: data.name,
        timestamp: data.timestamp,
        mensaje: data.mensaje,
        // Agregando logs para ver todos los campos
        allFields: Object.keys(data)
      });
      
      // Validar que la alerta tiene los campos necesarios
      if (!data.timestamp) {
        console.warn('⚠️ Alerta sin timestamp:', doc.id);
        return null;
      }
      
      return {
        id: doc.id,
        userId: data.emisorId || '',
        userEmail: data.email || '',
        userName: data.name || 'Usuario desconocido',
        location: data.ubicacion ? 
          `${data.ubicacion.lat.toFixed(6)}, ${data.ubicacion.lng.toFixed(6)}` : 
          'Ubicación no disponible',
        coordinates: data.ubicacion ? 
          [data.ubicacion.lng, data.ubicacion.lat] : undefined,
        timestamp: data.timestamp,
        type: 'panic' as const,
        // ✅ CORRECCIÓN CRÍTICA: Las alertas del móvil NO tienen campo 'activa'
        // Las alertas del móvil están siempre ACTIVAS por defecto (resolved: false)
        // Solo se resuelven si explícitamente tienen resolved: true
        resolved: data.resolved === true ? true : false,
        groupId: data.circleId,
        message: data.mensaje || '',
        phone: data.phone || '',
        destinatarios: data.destinatarios || [],
        emisorId: data.emisorId || ''
      } as FirebaseAlert;
    }).filter(alert => alert !== null) as FirebaseAlert[];
    
    console.log(`✅ ${alerts.length} alertas válidas procesadas para el grupo ${groupId}`);
    return alerts;
    
  } catch (error) {
    console.error('❌ Error getting group alerts:', error);
    return [];
  }
};

export const subscribeToGroupAlerts = (
  groupId: string, 
  callback: (alerts: FirebaseAlert[]) => void
) => {
  console.log('🚨 Suscribiéndose a alertas del grupo (circleId):', groupId);
  
  if (!groupId) {
    console.warn('⚠️ GroupId vacío en suscripción');
    callback([]);
    return () => {};
  }
  
  const q = query(
    collection(db, 'alertasCirculos'),
    where('circleId', '==', groupId),
    orderBy('timestamp', 'desc')
  );
  
  return onSnapshot(q, (snapshot) => {
    console.log(`🔄 Cambios detectados - ${snapshot.docs.length} documentos en snapshot`);
    
    if (snapshot.empty) {
      console.log('📭 Snapshot vacío - no hay alertas');
      callback([]);
      return;
    }
    
    const alerts = snapshot.docs.map(doc => {
      const data = doc.data();
      console.log('📄 Procesando alerta en tiempo real:', doc.id, {
        circleId: data.circleId,
        activa: data.activa,
        timestamp: data.timestamp,
        name: data.name,
        resolved: data.resolved,
        // Mostrando todos los campos para debug
        allFields: Object.keys(data)
      });
      
      // Validar datos esenciales
      if (!data.timestamp) {
        console.warn('⚠️ Alerta sin timestamp en suscripción:', doc.id);
        return null;
      }
      
      return {
        id: doc.id,
        userId: data.emisorId || '',
        userEmail: data.email || '',
        userName: data.name || 'Usuario desconocido',
        location: data.ubicacion ? 
          `${data.ubicacion.lat.toFixed(6)}, ${data.ubicacion.lng.toFixed(6)}` : 
          'Ubicación no disponible',
        coordinates: data.ubicacion ? 
          [data.ubicacion.lng, data.ubicacion.lat] : undefined,
        timestamp: data.timestamp,
        type: 'panic' as const,
        // ✅ CORRECCIÓN CRÍTICA: Alertas móviles siempre están ACTIVAS por defecto
        resolved: data.resolved === true ? true : false,
        groupId: data.circleId,
        message: data.mensaje || '',
        phone: data.phone || '',
        destinatarios: data.destinatarios || [],
        emisorId: data.emisorId || ''
      } as FirebaseAlert;
    }).filter(alert => alert !== null) as FirebaseAlert[];
    
    console.log(`📍 ${alerts.length} alertas válidas enviadas al callback para grupo ${groupId}`);
    callback(alerts);
  }, (error) => {
    console.error('❌ Error in group alerts subscription:', error);
    callback([]);
  });
};

export const resolveGroupAlert = async (alertId: string): Promise<void> => {
  try {
    console.log('✅ Resolviendo alerta:', alertId);
    const alertRef = doc(db, 'alertasCirculos', alertId);
    
    // Verificar que la alerta existe antes de resolver
    const alertDoc = await getDoc(alertRef);
    if (!alertDoc.exists()) {
      throw new Error('La alerta no existe');
    }
    
    await updateDoc(alertRef, {
      activa: false, // ✅ Marcar como inactiva (resuelta)
      resolvedAt: new Date()
    });
    
    console.log('✅ Alerta resuelta exitosamente:', alertId);
  } catch (error) {
    console.error('❌ Error resolviendo alerta:', error);
    throw error;
  }
};

// Funciones auxiliares para debugging
export const debugGroupAlerts = async (groupId: string): Promise<void> => {
  try {
    console.log('🐛 DEBUG: Iniciando verificación de alertas para circleId:', groupId);
    
    // 1. Verificar que el grupo existe
    const groupDoc = await getDoc(doc(db, 'circulos', groupId));
    console.log('🐛 Grupo existe:', groupDoc.exists());
    if (groupDoc.exists()) {
      console.log('🐛 Datos del grupo:', groupDoc.data());
    }
    
    // 2. Verificar todas las alertas en la colección
    const allAlertsSnapshot = await getDocs(collection(db, 'alertasCirculos'));
    console.log('🐛 Total de alertas en la colección:', allAlertsSnapshot.docs.length);
    
    // 3. Buscar alertas que coincidan con el circleId
    const matchingAlerts = allAlertsSnapshot.docs.filter(doc => {
      const data = doc.data();
      return data.circleId === groupId;
    });
    
    console.log('🐛 Alertas que coinciden con circleId:', matchingAlerts.length);
    
    // 4. Mostrar detalles de cada alerta
    matchingAlerts.forEach((doc, index) => {
      const data = doc.data();
      console.log(`🐛 Alerta ${index + 1}:`, {
        id: doc.id,
        circleId: data.circleId,
        activa: data.activa,
        name: data.name,
        mensaje: data.mensaje,
        timestamp: data.timestamp,
        ubicacion: data.ubicacion
      });
    });
    
    // 5. Probar la query específica
    const q = query(
      collection(db, 'alertasCirculos'),
      where('circleId', '==', groupId)
    );
    const querySnapshot = await getDocs(q);
    console.log('🐛 Resultados de la query específica:', querySnapshot.docs.length);
    
  } catch (error) {
    console.error('🐛 Error en debug:', error);
  }
};

// Funciones de invitaciones y miembros
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

// Funciones de alertas tradicionales
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

// FUNCIONES DE UBICACIONES
export const updateUserLocation = async (userId: string, locationData: {
  userEmail: string;
  userName: string;
  lat: number;
  lng: number;
  accuracy?: number;
}): Promise<void> => {
  try {
    // Validar coordenadas
    if (!locationData.lat || !locationData.lng || 
        Math.abs(locationData.lat) > 90 || Math.abs(locationData.lng) > 180) {
      console.warn('⚠️ Coordenadas inválidas:', locationData.lat, locationData.lng);
      return;
    }

    const locationRef = doc(db, 'ubicaciones', userId);
    
    const locationDoc = {
      userId,
      userEmail: locationData.userEmail,
      userName: locationData.userName,
      lat: Number(locationData.lat),
      lng: Number(locationData.lng),
      accuracy: locationData.accuracy || 0,
      timestamp: new Date(),
      isOnline: true,
      lastUpdate: new Date()
    };
    
    await setDoc(locationRef, locationDoc, { merge: true });
    
    console.log('✅ Ubicación actualizada para userId:', userId, 
                'Coords:', locationData.lat, locationData.lng);
  } catch (error) {
    console.error('❌ Error updating user location:', error);
    throw error;
  }
};

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

export const setUserOffline = async (userId: string): Promise<void> => {
  try {
    const locationRef = doc(db, 'ubicaciones', userId);
    const locationDoc = await getDoc(locationRef);
    
    if (locationDoc.exists()) {
      await deleteDoc(locationRef);
      console.log('✅ Ubicación eliminada para usuario offline:', userId);
    }

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

export const subscribeToGroupLocations = (groupId: string, callback: (locations: FirebaseUbicacion[]) => void) => {
  console.log('🔄 Suscribiéndose a ubicaciones del grupo:', groupId);

  let isSubscriptionActive = true;
  let debounceTimer: NodeJS.Timeout | null = null;

  const fetchLocationsDebounced = () => {
    if (debounceTimer) {
      clearTimeout(debounceTimer);
    }

    debounceTimer = setTimeout(async () => {
      if (!isSubscriptionActive) return;
      
      try {
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

        const userPromises = memberEmails.map(async (email) => {
          try {
            const userQuery = query(collection(db, 'users'), where('email', '==', email));
            const userSnapshot = await getDocs(userQuery);
            
            if (!userSnapshot.empty) {
              const userDoc = userSnapshot.docs[0];
              return {
                userId: userDoc.id,
                userData: userDoc.data(),
                email: email
              };
            }
            return null;
          } catch (error) {
            console.error('❌ Error obteniendo usuario:', email, error);
            return null;
          }
        });

        const usersResults = await Promise.all(userPromises);
        const validUsers = usersResults.filter(Boolean);

        const locationPromises = validUsers.map(async (user) => {
          if (!user) return null;
          
          try {
            const locationDoc = await getDoc(doc(db, 'ubicaciones', user.userId));
            
            if (locationDoc.exists()) {
              const locationData = locationDoc.data();
              
              if (locationData.lat && locationData.lng) {
                return {
                  id: locationDoc.id,
                  userId: user.userId,
                  userEmail: user.email,
                  userName: user.userData.name || user.email.split('@')[0],
                  lat: Number(locationData.lat),
                  lng: Number(locationData.lng),
                  accuracy: locationData.accuracy || 0,
                  timestamp: locationData.timestamp,
                  isOnline: locationData.isOnline || false
                } as FirebaseUbicacion;
              }
            }
            return null;
          } catch (error) {
            console.error('❌ Error obteniendo ubicación para:', user.email, error);
            return null;
          }
        });

        const locationsResults = await Promise.all(locationPromises);
        const validLocations = locationsResults.filter(Boolean) as FirebaseUbicacion[];
        
        console.log('🎯 Ubicaciones válidas encontradas:', validLocations.length);
        
        if (isSubscriptionActive) {
          callback(validLocations);
        }
        
      } catch (error) {
        console.error('❌ Error general obteniendo ubicaciones:', error);
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
      console.log('🔄 Cambios en ubicaciones detectados');
      fetchLocationsDebounced();
    },
    (error) => {
      console.error('❌ Error en suscripción a ubicaciones:', error);
      if (isSubscriptionActive) {
        callback([]);
      }
    }
  );

  const unsubscribeGroup = onSnapshot(
    doc(db, 'circulos', groupId), 
    () => {
      if (!isSubscriptionActive) return;
      console.log('🔄 Grupo actualizado, refrescando ubicaciones...');
      fetchLocationsDebounced();
    },
    (error) => {
      console.error('❌ Error en suscripción al grupo:', error);
    }
  );

  return () => {
    console.log('🧹 Limpiando suscripciones de grupo:', groupId);
    isSubscriptionActive = false;
    
    if (debounceTimer) {
      clearTimeout(debounceTimer);
    }
    
    unsubscribeGroup();
    unsubscribeLocations();
  };
};

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

// FUNCIONES PARA ACTIVAR/DESACTIVAR CÍRCULOS
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
    
    const locationRef = doc(db, 'ubicaciones', userId);
    
    await setDoc(locationRef, {
      userId: userId,
      userEmail: userEmail,
      userName: userData.name || 'Usuario',
      lat: 19.4290767,
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

// FUNCIONES AUXILIARES DE DIAGNÓSTICO
export const checkCollectionCompatibility = async (): Promise<{
  webGroups: number;
  mobileGroups: number;
  syncMappings: number;
  needsMigration: boolean;
}> => {
  try {
    const [webSnapshot, mobileSnapshot, syncSnapshot] = await Promise.all([
      getDocs(collection(db, 'circulos')),
      getDocs(collection(db, 'mobile_groups')),
      getDocs(collection(db, 'sync_mappings'))
    ]);

    const webGroups = webSnapshot.size;
    const mobileGroups = mobileSnapshot.size;
    const syncMappings = syncSnapshot.size;
    
    const needsMigration = webGroups > 0 && syncMappings === 0;

    console.log('📊 Estado de colecciones:', {
      webGroups,
      mobileGroups,
      syncMappings,
      needsMigration
    });

    return {
      webGroups,
      mobileGroups,
      syncMappings,
      needsMigration
    };
  } catch (error) {
    console.error('❌ Error verificando compatibilidad:', error);
    return {
      webGroups: 0,
      mobileGroups: 0,
      syncMappings: 0,
      needsMigration: false
    };
  }
};

export const createGroupWithSync = async (groupData: Omit<FirebaseGroup, 'id'>): Promise<{
  webGroupId: string;
  mobileGroupId: string;
}> => {
  try {
    const webGroupId = await createGroup(groupData);
    
    let mobileGroupId = '';
    try {
      // Importación dinámica para evitar problemas de dependencias circulares
      const autoSyncModule = await import('./autoSync');
      mobileGroupId = await autoSyncModule.createAutoSyncGroup({
        name: groupData.name,
        description: groupData.description,
        createdBy: groupData.createdBy,
        members: groupData.members,
        pendingInvitations: groupData.pendingInvitations
      });
      console.log('✅ Grupo creado y sincronizado automáticamente');
    } catch (syncError) {
      console.warn('⚠️ Grupo creado pero sincronización falló:', syncError);
    }

    return { webGroupId, mobileGroupId };
  } catch (error) {
    console.error('❌ Error creando grupo con sincronización:', error);
    throw error;
  }
};

export const getUserSyncStatus = async (userEmail: string): Promise<{
  webGroups: FirebaseGroup[];
  mobileGroups: any[];
  syncedGroups: number;
  pendingInvitations: GroupInvitation[];
  needsAttention: boolean;
}> => {
  try {
    const [webGroups, pendingInvitations] = await Promise.all([
      getUserGroups(userEmail),
      getUserInvitations(userEmail)
    ]);

    const mobileSnapshot = await getDocs(collection(db, 'mobile_groups'));
    const mobileGroups = mobileSnapshot.docs
      .map(doc => ({ id: doc.id, ...doc.data() }))
      .filter((group: any) => 
        group.members && group.members.some((m: any) => m.email === userEmail)
      );

    const syncSnapshot = await getDocs(collection(db, 'sync_mappings'));
    const syncedGroups = syncSnapshot.docs.filter(doc => {
      const data = doc.data();
      const webGroup = webGroups.find(g => g.id === data.webGroupId);
      const mobileGroup = mobileGroups.find((g: any) => g.id === data.mobileGroupId);
      return webGroup && mobileGroup;
    }).length;

    const needsAttention = webGroups.length > syncedGroups || 
                          mobileGroups.length > syncedGroups ||
                          pendingInvitations.length > 0;

    return {
      webGroups,
      mobileGroups,
      syncedGroups,
      pendingInvitations,
      needsAttention
    };
  } catch (error) {
    console.error('❌ Error obteniendo estado de sincronización:', error);
    return {
      webGroups: [],
      mobileGroups: [],
      syncedGroups: 0,
      pendingInvitations: [],
      needsAttention: false
    };
  }
};

export const cleanupOrphanedSyncData = async (): Promise<{
  deletedMappings: number;
  deletedMobileGroups: number;
}> => {
  try {
    console.log('🧹 Iniciando limpieza de datos huérfanos...');
    
    const [syncSnapshot, mobileSnapshot, webSnapshot] = await Promise.all([
      getDocs(collection(db, 'sync_mappings')),
      getDocs(collection(db, 'mobile_groups')),
      getDocs(collection(db, 'circulos'))
    ]);

    const webGroupIds = new Set(webSnapshot.docs.map(doc => doc.id));
    const mobileGroupIds = new Set(mobileSnapshot.docs.map(doc => doc.id));
    
    let deletedMappings = 0;
    let deletedMobileGroups = 0;
    const batch = writeBatch(db);

    for (const mappingDoc of syncSnapshot.docs) {
      const data = mappingDoc.data();
      const webExists = webGroupIds.has(data.webGroupId);
      const mobileExists = mobileGroupIds.has(data.mobileGroupId);
      
      if (!webExists || !mobileExists) {
        batch.delete(mappingDoc.ref);
        deletedMappings++;
        console.log('🗑️ Eliminando mapeo huérfano:', mappingDoc.id);
      }
    }

    const validMobileIds = new Set(
      syncSnapshot.docs.map(doc => doc.data().mobileGroupId)
    );
    
    for (const mobileDoc of mobileSnapshot.docs) {
      if (!validMobileIds.has(mobileDoc.id)) {
        batch.delete(mobileDoc.ref);
        deletedMobileGroups++;
        console.log('🗑️ Eliminando grupo móvil huérfano:', mobileDoc.id);
      }
    }

    await batch.commit();
    
    console.log('✅ Limpieza completada:', { deletedMappings, deletedMobileGroups });
    return { deletedMappings, deletedMobileGroups };
  } catch (error) {
    console.error('❌ Error en limpieza:', error);
    throw error;
  }
};

export const validateGroupIntegrity = async (groupId: string): Promise<{
  isValid: boolean;
  issues: string[];
  fixable: boolean;
}> => {
  try {
    const groupDoc = await getDoc(doc(db, 'circulos', groupId));
    if (!groupDoc.exists()) {
      return { isValid: false, issues: ['Grupo no existe'], fixable: false };
    }

    const groupData = groupDoc.data();
    const issues: string[] = [];
    let fixable = true;

    if (!groupData.members || !Array.isArray(groupData.members)) {
      issues.push('Array de miembros faltante o inválido');
    }

    if (!groupData.name || groupData.name.trim() === '') {
      issues.push('Nombre del grupo faltante');
    }

    if (groupData.members && !groupData.miembros) {
      issues.push('Formato móvil faltante - requiere migración');
    }

    if (groupData.members && groupData.membersUids) {
      if (groupData.members.length !== groupData.membersUids.length) {
        issues.push('Desincronización entre emails y UIDs');
      }
    }

    return {
      isValid: issues.length === 0,
      issues,
      fixable
    };
  } catch (error) {
    console.error('❌ Error validando grupo:', error);
    return { isValid: false, issues: ['Error de validación'], fixable: false };
  }
};

export const autoFixGroup = async (groupId: string): Promise<{
  success: boolean;
  fixesApplied: string[];
  remainingIssues: string[];
}> => {
  try {
    console.log('🔧 Iniciando auto-reparación del grupo:', groupId);
    
    const groupRef = doc(db, 'circulos', groupId);
    const groupDoc = await getDoc(groupRef);
    
    if (!groupDoc.exists()) {
      throw new Error('Grupo no encontrado');
    }

    const groupData = groupDoc.data();
    const fixesApplied: string[] = [];
    const remainingIssues: string[] = [];
    const updates: any = {};

    if (!groupData.members || !Array.isArray(groupData.members)) {
      updates.members = [];
      fixesApplied.push('Creado array de miembros');
    }

    if (!groupData.pendingInvitations || !Array.isArray(groupData.pendingInvitations)) {
      updates.pendingInvitations = [];
      fixesApplied.push('Creado array de invitaciones pendientes');
    }

    updates.isAutoSynced = true;
    updates.lastSyncUpdate = new Date();

    if (Object.keys(updates).length > 0) {
      await updateDoc(groupRef, updates);
      fixesApplied.push('Metadatos de sincronización actualizados');
    }

    console.log('✅ Auto-reparación completada:', fixesApplied.length, 'correcciones');
    
    return {
      success: true,
      fixesApplied,
      remainingIssues
    };
  } catch (error) {
    console.error('❌ Error en auto-reparación:', error);
    return {
      success: false,
      fixesApplied: [],
      remainingIssues: [error instanceof Error ? error.message : 'Error desconocido']
    };
  }
};

export const cleanupInactiveLocations = async (maxAgeMinutes: number = 30): Promise<{
  cleaned: number;
  errors: number;
}> => {
  try {
    console.log('🧹 Limpiando ubicaciones inactivas...');
    
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
          batch.delete(locationDoc.ref);
          cleaned++;
          console.log('🗑️ Marcando ubicación inactiva para limpieza:', data.userEmail);
        }
      } catch (error) {
        console.error('❌ Error procesando ubicación:', locationDoc.id, error);
        errors++;
      }
    }

    if (cleaned > 0) {
      await batch.commit();
      console.log('✅ Ubicaciones inactivas limpiadas:', cleaned);
    }

    return { cleaned, errors };
  } catch (error) {
    console.error('❌ Error en limpieza de ubicaciones:', error);
    return { cleaned: 0, errors: 1 };
  }
};

// EXPORTAR FUNCIONES DE SINCRONIZACIÓN DESDE autoSync
// Nota: Estos imports se hacen dinámicamente para evitar dependencias circulares
export const createAutoSyncGroup = async (groupData: {
  name: string;
  description: string;
  createdBy: string;
  members: string[];
  pendingInvitations: string[];
}): Promise<string> => {
  try {
    const autoSyncModule = await import('./autoSync');
    return await autoSyncModule.createAutoSyncGroup(groupData);
  } catch (error) {
    console.error('❌ Error importando función de sincronización:', error);
    throw error;
  }
};

export const addMemberAutoSync = async (groupId: string, memberEmail: string): Promise<void> => {
  try {
    const autoSyncModule = await import('./autoSync');
    return await autoSyncModule.addMemberAutoSync(groupId, memberEmail);
  } catch (error) {
    console.error('❌ Error importando función de sincronización:', error);
    throw error;
  }
};

export const removeMemberAutoSync = async (groupId: string, memberEmail: string): Promise<void> => {
  try {
    const autoSyncModule = await import('./autoSync');
    return await autoSyncModule.removeMemberAutoSync(groupId, memberEmail);
  } catch (error) {
    console.error('❌ Error importando función de sincronización:', error);
    throw error;
  }
};

export const subscribeToUserGroupsAutoSync = async (
  userEmail: string,
  callback: (groups: any[]) => void
): Promise<() => void> => {
  try {
    const autoSyncModule = await import('./autoSync');
    return await autoSyncModule.subscribeToUserGroupsAutoSync(userEmail, callback);
  } catch (error) {
    console.error('❌ Error importando función de sincronización:', error);
    return () => {};
  }
};

export const migrateExistingGroupsToAutoSync = async (): Promise<{
  processed: number;
  updated: number;
  errors: number;
}> => {
  try {
    const autoSyncModule = await import('./autoSync');
    return await autoSyncModule.migrateExistingGroupsToAutoSync();
  } catch (error) {
    console.error('❌ Error importando función de sincronización:', error);
    return { processed: 0, updated: 0, errors: 1 };
  }
};

export const checkAutoSyncHealth = async (userEmail: string): Promise<{
  totalGroups: number;
  syncedGroups: number;
  healthPercentage: number;
  needsUpdate: string[];
}> => {
  try {
    const autoSyncModule = await import('./autoSync');
    return await autoSyncModule.checkAutoSyncHealth(userEmail);
  } catch (error) {
    console.error('❌ Error importando función de sincronización:', error);
    return { totalGroups: 0, syncedGroups: 0, healthPercentage: 0, needsUpdate: [] };
  }
};

export const setupMobileToWebSync = (userEmail: string): () => void => {
  try {
    return () => {}; // Función dummy para compatibilidad
  } catch (error) {
    console.error('❌ Error en setupMobileToWebSync:', error);
    return () => {};
  }
};

export const forceSyncGroup = async (groupId: string): Promise<void> => {
  try {
    const autoSyncModule = await import('./autoSync');
    return await autoSyncModule.forceSyncGroup(groupId);
  } catch (error) {
    console.error('❌ Error importando función de sincronización:', error);
    throw error;
  }
};

// Interface unificada para compatibilidad
export interface UnifiedGroup {
  id: string;
  name: string;
  description: string;
  createdBy: string;
  members: string[];
  membersUids?: string[];
  pendingInvitations: string[];
  createdAt: any; // Firestore timestamp
  isAutoSynced: boolean;
  lastSyncUpdate?: any; // Firestore timestamp
  codigo?: string;
  nombre?: string;
  tipo?: string;
  creator?: string;
  miembros?: Array<{
    email: string;
    name: string;
    phone: string;
    uid: string;
    rol?: string;
  }>;
};

// Al final de tu index.ts, después de todas las otras funciones
export const getGroupAlertStats = async (groupId: string): Promise<{
  total: number;
  active: number;
  resolved: number;
  today: number;
  thisWeek: number;
  thisMonth: number;
}> => {
  try {
    console.log('📊 Calculando estadísticas de alertas para grupo:', groupId);
    
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
      
      if (isNaN(alertDate.getTime())) {
        console.warn('⚠️ Fecha inválida en alerta:', alert.id, alert.timestamp);
        return;
      }
      
      if (alert.resolved) {
        stats.resolved++;
      } else {
        stats.active++;
      }
      
      if (alertDate >= today) stats.today++;
      if (alertDate >= thisWeek) stats.thisWeek++;
      if (alertDate >= thisMonth) stats.thisMonth++;
    });
    
    console.log('📊 Estadísticas calculadas:', stats);
    return stats;
    
  } catch (error) {
    console.error('❌ Error getting group alert stats:', error);
    return {
      total: 0, active: 0, resolved: 0, today: 0, thisWeek: 0, thisMonth: 0
    };
  }
};

export const testGroupAlerts = async (groupId: string = 'r0uNHyaM0Ux2vJPxdWBh'): Promise<void> => {
  console.log('🧪 PROBANDO ALERTAS PARA GRUPO:', groupId);
  
  try {
    // 1. Verificar que el grupo existe
    const groupDoc = await getDoc(doc(db, 'circulos', groupId));
    console.log('✅ Grupo existe:', groupDoc.exists());
    
    if (!groupDoc.exists()) {
      console.log('❌ El grupo no existe');
      return;
    }
    
    // 2. Contar todas las alertas en la colección
    const allAlertsSnapshot = await getDocs(collection(db, 'alertasCirculos'));
    console.log('📊 Total alertas en BD:', allAlertsSnapshot.docs.length);
    
    // 3. Mostrar todas las alertas
    allAlertsSnapshot.docs.forEach((doc, index) => {
      const data = doc.data();
      console.log(`📄 Alerta ${index + 1}:`, {
        id: doc.id,
        circleId: data.circleId,
        name: data.name,
        activa: data.activa,
        mensaje: data.mensaje,
        timestamp: data.timestamp
      });
    });
    
    // 4. Buscar alertas específicas del grupo
    const q = query(
      collection(db, 'alertasCirculos'),
      where('circleId', '==', groupId)
    );
    
    const snapshot = await getDocs(q);
    console.log(`🎯 Alertas encontradas para grupo ${groupId}:`, snapshot.docs.length);
    
    // 5. Mostrar alertas del grupo
    snapshot.docs.forEach((doc, index) => {
      const data = doc.data();
      console.log(`🚨 Alerta del grupo ${index + 1}:`, {
        id: doc.id,
        name: data.name,
        email: data.email,
        mensaje: data.mensaje,
        activa: data.activa,
        timestamp: data.timestamp?.toDate?.() || data.timestamp,
        ubicacion: data.ubicacion
      });
    });
    
    // 6. Probar función getGroupAlerts
    console.log('🔄 Probando función getGroupAlerts...');
    const alerts = await getGroupAlerts(groupId);
    console.log('📋 Resultado getGroupAlerts:', alerts.length, 'alertas');
    
    alerts.forEach((alert, index) => {
      console.log(`📌 Alerta procesada ${index + 1}:`, {
        id: alert.id,
        userName: alert.userName,
        resolved: alert.resolved,
        location: alert.location,
        timestamp: alert.timestamp
      });
    });
    
  } catch (error) {
    console.error('❌ Error en testGroupAlerts:', error);
  }
};
