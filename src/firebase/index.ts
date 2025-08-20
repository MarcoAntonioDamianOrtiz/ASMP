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

// ========== FUNCIONES DE USUARIOS ==========

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
    // Verificar si ya existe un usuario con este email
    const existingUser = await getUserByEmail(userData.email);
    if (existingUser) {
      console.log('⚠️ Usuario ya existe, actualizando:', existingUser.id);
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

// ========== FUNCIONES DE GRUPOS ==========

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

// ========== FUNCIONES DE ALERTAS CORREGIDAS COMPLETAMENTE ==========

export const getGroupAlerts = async (groupId: string): Promise<FirebaseAlert[]> => {
  try {
    console.log('🔍 Buscando alertas para el grupo:', groupId);
    
    if (!groupId) {
      console.warn('⚠️ GroupId vacío');
      return [];
    }
    
    // 🔧 CORRECCIÓN PRINCIPAL: Buscar por circleIds (array) Y circleId (string)
    const queries = [
      // Query 1: Buscar donde circleIds contiene el groupId (NUEVO FORMATO)
      query(
        collection(db, 'alertasCirculos'),
        where('circleIds', 'array-contains', groupId),
        orderBy('timestamp', 'desc'),
        limit(50)
      ),
      // Query 2: Buscar por circleId (formato anterior)
      query(
        collection(db, 'alertasCirculos'),
        where('circleId', '==', groupId),
        orderBy('timestamp', 'desc'),
        limit(50)
      ),
      // Query 3: Fallback por groupId
      query(
        collection(db, 'alertasCirculos'),
        where('groupId', '==', groupId),
        orderBy('timestamp', 'desc'),
        limit(50)
      )
    ];
    
    let allAlerts: FirebaseAlert[] = [];
    
    for (const q of queries) {
      try {
        const snapshot = await getDocs(q);
        console.log(`📊 Query encontró ${snapshot.docs.length} alertas`);
        
        if (!snapshot.empty) {
          const alerts = snapshot.docs.map(doc => {
            const data = doc.data();
            console.log('📄 Procesando alerta:', doc.id, {
              circleIds: data.circleIds,
              circleId: data.circleId,
              groupId: data.groupId,
              activatrue: data.activatrue, // 🔧 CAMPO CORRECTO
              name: data.name,
              emisorId: data.emisorId,
              timestamp: data.timestamp
            });
            
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
              // 🔧 CORRECCIÓN: Campo activatrue (no activa)
              resolved: data.activatrue === false || data.resolved === true,
              groupId: data.circleIds?.[0] || data.circleId || data.groupId || groupId,
              message: data.mensaje || data.message || '',
              phone: data.phone || '',
              destinatarios: data.destinatarios || [],
              emisorId: data.emisorId || data.userId || ''
            } as FirebaseAlert;
          });
          
          allAlerts = [...allAlerts, ...alerts];
        }
      } catch (queryError) {
        console.warn('⚠️ Query falló, probando siguiente:', queryError);
      }
    }
    
    // Eliminar duplicados por ID
    const uniqueAlerts = allAlerts.filter((alert, index, self) => 
      index === self.findIndex(a => a.id === alert.id)
    );
    
    console.log(`✅ ${uniqueAlerts.length} alertas únicas encontradas para el grupo ${groupId}`);
    return uniqueAlerts;
    
  } catch (error) {
    console.error('❌ Error getting group alerts:', error);
    
    // 🔧 FALLBACK MEJORADO: Sin orderBy + búsqueda por circleIds
    try {
      console.log('🔄 Intentando consulta fallback...');
      
      // Probar búsqueda por circleIds sin orderBy
      const fallbackQuery1 = query(
        collection(db, 'alertasCirculos'),
        where('circleIds', 'array-contains', groupId)
      );
      
      const snapshot1 = await getDocs(fallbackQuery1);
      console.log(`📊 Fallback 1 encontró ${snapshot1.docs.length} alertas`);
      
      let fallbackAlerts = snapshot1.docs.map(doc => {
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
          resolved: data.activatrue === false || data.resolved === true,
          groupId: data.circleIds?.[0] || data.circleId || data.groupId || groupId,
          message: data.mensaje || data.message || '',
          phone: data.phone || '',
          destinatarios: data.destinatarios || [],
          emisorId: data.emisorId || data.userId || ''
        } as FirebaseAlert;
      });
      
      // Si no encontró nada, probar con circleId
      if (fallbackAlerts.length === 0) {
        const fallbackQuery2 = query(
          collection(db, 'alertasCirculos'),
          where('circleId', '==', groupId)
        );
        
        const snapshot2 = await getDocs(fallbackQuery2);
        console.log(`📊 Fallback 2 encontró ${snapshot2.docs.length} alertas`);
        
        fallbackAlerts = snapshot2.docs.map(doc => {
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
            resolved: data.activatrue === false || data.resolved === true,
            groupId: data.circleIds?.[0] || data.circleId || data.groupId || groupId,
            message: data.mensaje || data.message || '',
            phone: data.phone || '',
            destinatarios: data.destinatarios || [],
            emisorId: data.emisorId || data.userId || ''
          } as FirebaseAlert;
        });
      }
      
      // Ordenar manualmente por timestamp
      const sortedAlerts = fallbackAlerts.sort((a, b) => {
        const dateA = a.timestamp?.toDate ? a.timestamp.toDate() : new Date(a.timestamp);
        const dateB = b.timestamp?.toDate ? b.timestamp.toDate() : new Date(b.timestamp);
        return dateB.getTime() - dateA.getTime();
      });
      
      console.log(`✅ ${sortedAlerts.length} alertas fallback procesadas`);
      return sortedAlerts;
      
    } catch (fallbackError) {
      console.error('❌ Error en consulta fallback:', fallbackError);
      return [];
    }
  }
};

export const subscribeToGroupAlerts = (
  groupId: string, 
  callback: (alerts: FirebaseAlert[]) => void
) => {
  console.log('🚨 Suscribiéndose a alertas del grupo:', groupId);
  
  if (!groupId) {
    console.warn('⚠️ GroupId vacío en suscripción');
    callback([]);
    return () => {};
  }
  
  // 🔧 SUSCRIPCIÓN MEJORADA: Probar con circleIds primero
  try {
    // Intentar suscripción con circleIds (array-contains)
    const qWithArrayContains = query(
      collection(db, 'alertasCirculos'),
      where('circleIds', 'array-contains', groupId),
      orderBy('timestamp', 'desc')
    );
    
    return onSnapshot(qWithArrayContains, (snapshot) => {
      console.log(`🔄 Cambios detectados (circleIds) - ${snapshot.docs.length} documentos`);
      
      if (snapshot.empty) {
        console.log('📭 Snapshot vacío - probando con circleId...');
        
        // Fallback: probar con circleId
        const qWithCircleId = query(
          collection(db, 'alertasCirculos'),
          where('circleId', '==', groupId),
          orderBy('timestamp', 'desc')
        );
        
        return onSnapshot(qWithCircleId, (snapshot2) => {
          console.log(`🔄 Cambios detectados (circleId) - ${snapshot2.docs.length} documentos`);
          processAlertsSnapshot(snapshot2, groupId, callback);
        }, (error) => {
          console.error('❌ Error en suscripción circleId:', error);
          // Último fallback sin orderBy
          subscribeWithoutOrderBy(groupId, callback);
        });
      } else {
        processAlertsSnapshot(snapshot, groupId, callback);
      }
    }, (error) => {
      console.error('❌ Error en suscripción circleIds:', error);
      // Fallback sin orderBy
      subscribeWithoutOrderBy(groupId, callback);
    });
    
  } catch (subscriptionError) {
    console.error('❌ Error inicial en suscripción:', subscriptionError);
    callback([]);
    return () => {};
  }
};

// 🔧 FUNCIÓN AUXILIAR: Procesar snapshot de alertas
const processAlertsSnapshot = (
  snapshot: any, 
  groupId: string, 
  callback: (alerts: FirebaseAlert[]) => void
) => {
  const alerts = snapshot.docs.map((doc: any) => {
    const data = doc.data();
    console.log('📄 Procesando alerta en tiempo real:', doc.id, {
      circleIds: data.circleIds,
      circleId: data.circleId,
      activa: data.activa,
      timestamp: data.timestamp,
      name: data.name
    });
    
    // Validar datos esenciales
    if (!data.timestamp) {
      console.warn('⚠️ Alerta sin timestamp en suscripción:', doc.id);
      return null;
    }
    
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
      resolved: data.activatrue === false || data.resolved === true,
      groupId: data.circleIds?.[0] || data.circleId || data.groupId || groupId,
      message: data.mensaje || data.message || '',
      phone: data.phone || '',
      destinatarios: data.destinatarios || [],
      emisorId: data.emisorId || data.userId || ''
    } as FirebaseAlert;
  }).filter((alert: any) => alert !== null) as FirebaseAlert[];
  
  console.log(`📍 ${alerts.length} alertas válidas enviadas al callback para grupo ${groupId}`);
  callback(alerts);
};

// 🔧 FUNCIÓN AUXILIAR: Suscripción sin orderBy
const subscribeWithoutOrderBy = (groupId: string, callback: (alerts: FirebaseAlert[]) => void) => {
  console.log('🔄 Intentando suscripción sin orderBy...');
  
  // Probar con circleIds sin orderBy
  const qWithoutOrder1 = query(
    collection(db, 'alertasCirculos'),
    where('circleIds', 'array-contains', groupId)
  );
  
  return onSnapshot(qWithoutOrder1, (snapshot) => {
    if (snapshot.empty) {
      // Fallback final con circleId
      const qWithoutOrder2 = query(
        collection(db, 'alertasCirculos'),
        where('circleId', '==', groupId)
      );
      
      return onSnapshot(qWithoutOrder2, (snapshot2) => {
        const alerts = processAndSortAlerts(snapshot2, groupId);
        callback(alerts);
      }, (error) => {
        console.error('❌ Error en fallback final:', error);
        callback([]);
      });
    } else {
      const alerts = processAndSortAlerts(snapshot, groupId);
      callback(alerts);
    }
  }, (error) => {
    console.error('❌ Error en suscripción sin orderBy:', error);
    callback([]);
  });
};

// 🔧 FUNCIÓN AUXILIAR: Procesar y ordenar alertas manualmente
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
      resolved: data.activa === false || data.resolved === true,
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
      activatrue: false, // ✅ Campo correcto (no activa)
      resolved: true, // También marcar como resolved para compatibilidad
      resolvedAt: new Date()
    });
    
    console.log('✅ Alerta resuelta exitosamente:', alertId);
  } catch (error) {
    console.error('❌ Error resolviendo alerta:', error);
    throw error;
  }
};

// ========== RESTO DE FUNCIONES (UBICACIONES, ETC.) - SIN CAMBIOS ==========

export const updateUserLocation = async (userEmail: string, locationData: {
  lat: number;
  lng: number;
  accuracy?: number;
}): Promise<void> => {
  try {
    console.log('📍 Actualizando ubicación para:', userEmail, locationData);
    
    // Validar coordenadas
    if (!locationData.lat || !locationData.lng || 
        Math.abs(locationData.lat) > 90 || Math.abs(locationData.lng) > 180) {
      console.warn('⚠️ Coordenadas inválidas:', locationData.lat, locationData.lng);
      return;
    }

    // 1. Buscar al usuario por email
    const userQuery = query(collection(db, 'users'), where('email', '==', userEmail));
    const userSnapshot = await getDocs(userQuery);
    
    if (userSnapshot.empty) {
      throw new Error(`Usuario no encontrado: ${userEmail}`);
    }
    
    const userDoc = userSnapshot.docs[0];
    const userId = userDoc.id;
    const userData = userDoc.data();
    
    // 2. Crear/actualizar documento de ubicación usando userId como ID
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
    
    console.log('✅ Ubicación actualizada para userId:', userId, 
                'Email:', userEmail, 'Coords:', locationData.lat, locationData.lng);
  } catch (error) {
    console.error('❌ Error updating user location:', error);
    throw error;
  }
};

export const cleanupDuplicateUsers = async (): Promise<{
  duplicatesFound: number;
  duplicatesCleaned: number;
  errors: string[];
}> => {
  console.log('🧹 Iniciando limpieza de usuarios duplicados...');
  
  const errors: string[] = [];
  let duplicatesFound = 0;
  let duplicatesCleaned = 0;
  
  try {
    // 1. Obtener todos los usuarios
    const usersSnapshot = await getDocs(collection(db, 'users'));
    const usersByEmail = new Map<string, any[]>();
    
    // 2. Agrupar por email para encontrar duplicados
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
    
    // 3. Procesar duplicados
    for (const [email, users] of usersByEmail.entries()) {
      if (users.length > 1) {
        duplicatesFound++;
        console.log(`🔍 Duplicados encontrados para ${email}:`, users.length);
        
        try {
          // Mantener el usuario más reciente
          const sortedUsers = users.sort((a, b) => 
            b.createdAt.getTime() - a.createdAt.getTime()
          );
          
          const keepUser = sortedUsers[0];
          const deleteUsers = sortedUsers.slice(1);
          
          console.log(`✅ Manteniendo usuario:`, keepUser.id);
          console.log(`🗑️ Eliminando usuarios:`, deleteUsers.map(u => u.id));
          
          // 4. Migrar ubicaciones al usuario principal
          for (const userToDelete of deleteUsers) {
            const oldLocationDoc = await getDoc(doc(db, 'ubicaciones', userToDelete.id));
            
            if (oldLocationDoc.exists()) {
              const oldLocationData = oldLocationDoc.data();
              
              // Copiar ubicación al usuario que se mantiene
              await setDoc(doc(db, 'ubicaciones', keepUser.id), {
                ...oldLocationData,
                userId: keepUser.id,
                userEmail: email,
                userName: keepUser.data.name || email.split('@')[0],
                lastUpdate: new Date(),
                migratedFrom: userToDelete.id // Para tracking
              }, { merge: true });
              
              // Eliminar ubicación antigua
              await deleteDoc(doc(db, 'ubicaciones', userToDelete.id));
              
              console.log(`🔄 Ubicación migrada de ${userToDelete.id} a ${keepUser.id}`);
            }
          }
          
          // 5. Eliminar usuarios duplicados
          const batch = writeBatch(db);
          deleteUsers.forEach(user => {
            batch.delete(doc(db, 'users', user.id));
          });
          
          await batch.commit();
          duplicatesCleaned += deleteUsers.length;
          
          console.log(`✅ Limpieza completada para ${email}`);
          
        } catch (error) {
          const errorMsg = `Error limpiando duplicados para ${email}: ${error}`;
          console.error('❌', errorMsg);
          errors.push(errorMsg);
        }
      }
    }
    
    console.log('🎉 Limpieza de duplicados completada:', {
      duplicatesFound,
      duplicatesCleaned,
      errors: errors.length
    });
    
    return { duplicatesFound, duplicatesCleaned, errors };
    
  } catch (error) {
    console.error('❌ Error general en limpieza:', error);
    return { 
      duplicatesFound: 0, 
      duplicatesCleaned: 0, 
      errors: [error instanceof Error ? error.message : 'Error desconocido'] 
    };
  }
};

export const cleanupOrphanedLocations = async (): Promise<{
  orphanedFound: number;
  orphanedCleaned: number;
  errors: string[];
}> => {
  console.log('🧹 Iniciando limpieza de ubicaciones huérfanas...');
  
  const errors: string[] = [];
  let orphanedFound = 0;
  let orphanedCleaned = 0;
  
  try {
    // 1. Obtener todas las ubicaciones
    const locationsSnapshot = await getDocs(collection(db, 'ubicaciones'));
    
    // 2. Obtener todos los userIds válidos
    const usersSnapshot = await getDocs(collection(db, 'users'));
    const validUserIds = new Set(usersSnapshot.docs.map(doc => doc.id));
    
    console.log('📊 Usuarios válidos:', validUserIds.size);
    console.log('📊 Ubicaciones totales:', locationsSnapshot.size);
    
    // 3. Identificar ubicaciones huérfanas
    const batch = writeBatch(db);
    
    for (const locationDoc of locationsSnapshot.docs) {
      const locationId = locationDoc.id;
      const locationData = locationDoc.data();
      
      // Verificar si el userId de la ubicación existe en users
      if (!validUserIds.has(locationId)) {
        orphanedFound++;
        
        console.log(`🗑️ Ubicación huérfana encontrada:`, {
          id: locationId,
          userEmail: locationData.userEmail,
          userName: locationData.userName
        });
        
        batch.delete(locationDoc.ref);
        orphanedCleaned++;
      }
    }
    
    // 4. Ejecutar limpieza
    if (orphanedCleaned > 0) {
      await batch.commit();
      console.log(`✅ ${orphanedCleaned} ubicaciones huérfanas eliminadas`);
    }
    
    return { orphanedFound, orphanedCleaned, errors };
    
  } catch (error) {
    console.error('❌ Error en limpieza de ubicaciones huérfanas:', error);
    return { 
      orphanedFound: 0, 
      orphanedCleaned: 0, 
      errors: [error instanceof Error ? error.message : 'Error desconocido'] 
    };
  }
};

export const getGroupMembersLocations = async (groupId: string): Promise<FirebaseUbicacion[]> => {
  try {
    console.log('🔍 Obteniendo ubicaciones del grupo:', groupId);
    
    const groupDoc = await getDoc(doc(db, 'circulos', groupId));
    if (!groupDoc.exists()) {
      console.warn('⚠️ Grupo no existe:', groupId);
      return [];
    }
    
    const groupData = groupDoc.data() as FirebaseGroup;
    const memberEmails = groupData.members || [];

    if (memberEmails.length === 0) {
      console.log('📭 Grupo sin miembros');
      return [];
    }
    
    console.log('👥 Miembros del grupo:', memberEmails);

    const locations: FirebaseUbicacion[] = [];
    
    for (const email of memberEmails) {
      try {
        // 1. Buscar usuario por email
        const userQuery = query(collection(db, 'users'), where('email', '==', email));
        const userSnapshot = await getDocs(userQuery);
        
        if (userSnapshot.empty) {
          console.warn(`⚠️ Usuario no encontrado en colección users: ${email}`);
          continue;
        }
        
        const userDoc = userSnapshot.docs[0];
        const userId = userDoc.id;
        const userData = userDoc.data();
        
        // 2. Buscar ubicación usando userId como ID del documento
        const locationDoc = await getDoc(doc(db, 'ubicaciones', userId));
        
        if (locationDoc.exists()) {
          const locationData = locationDoc.data();
          
          // 3. VALIDACIÓN ESTRICTA: Solo incluir si tiene coordenadas REALES
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
            
            console.log(`📍 Ubicación válida para ${userData.name}:`, {
              coords: `${location.lat}, ${location.lng}`,
              isOnline: location.isOnline,
              timestamp: locationData.timestamp?.toDate?.()
            });
          } else {
            console.log(`⏳ Usuario ${email} activo pero sin coordenadas válidas:`, {
              lat: locationData.lat,
              lng: locationData.lng,
              isOnline: locationData.isOnline
            });
          }
        } else {
          console.log(`📭 No hay documento de ubicación para: ${email} (userId: ${userId})`);
        }
        
      } catch (error) {
        console.error(`❌ Error procesando ubicación para ${email}:`, error);
      }
    }
    
    console.log(`✅ ${locations.length} ubicaciones válidas encontradas de ${memberEmails.length} miembros`);
    return locations;
    
  } catch (error) {
    console.error('❌ Error getting group members locations:', error);
    return [];
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
        const locations = await getGroupMembersLocations(groupId);
        
        if (isSubscriptionActive) {
          console.log(`🎯 Enviando ${locations.length} ubicaciones válidas al callback`);
          callback(locations);
        }
        
      } catch (error) {
        console.error('❌ Error obteniendo ubicaciones:', error);
        if (isSubscriptionActive) {
          callback([]);
        }
      }
    }, 300); // Debounce de 300ms
  };

  // Ejecutar una vez al inicio
  fetchLocationsDebounced();

  // Suscribirse a cambios en ubicaciones
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

  // Suscribirse a cambios en el grupo
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

  // Función de limpieza
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

export const activateMemberCircle = async (userEmail: string): Promise<void> => {
  try {
    console.log('🎯 Activando círculo para:', userEmail);
    
    // 1. Buscar el usuario
    const userQuery = query(collection(db, 'users'), where('email', '==', userEmail));
    const userSnapshot = await getDocs(userQuery);
    
    if (userSnapshot.empty) {
      throw new Error('Usuario no encontrado');
    }
    
    const userDoc = userSnapshot.docs[0];
    const userData = userDoc.data();
    const userId = userDoc.id;
    
    // 2. Verificar si ya tiene ubicación
    const locationDoc = await getDoc(doc(db, 'ubicaciones', userId));
    
    if (locationDoc.exists()) {
      // CASO 1: Ya tiene ubicación - solo marcar como online
      await updateDoc(doc(db, 'ubicaciones', userId), {
        isOnline: true,
        lastActivated: new Date(),
        // Mantener coordenadas existentes
      });
      
      const existingData = locationDoc.data();
      console.log('✅ Círculo activado manteniendo ubicación de:', userData.name, 
                  'Coords:', existingData.lat, existingData.lng);
    } else {
      // CASO 2: No tiene ubicación - crear entrada básica sin coordenadas
      await setDoc(doc(db, 'ubicaciones', userId), {
        userId: userId,
        userEmail: userEmail,
        userName: userData.name || userEmail.split('@')[0],
        isOnline: true,
        lastActivated: new Date(),
        // Sin lat/lng - aparecerá cuando comparta ubicación real
      });
      
      console.log('⚠️ Usuario sin ubicación previa. Activado, esperando coordenadas:', userData.name);
    }
    
    // 3. Actualizar estado del usuario
    await updateDoc(doc(db, 'users', userId), {
      status: 'online',
      lastSeen: new Date()
    });
    
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
    const locationRef = doc(db, 'ubicaciones', userId);
    const locationDoc = await getDoc(locationRef);
    
    if (locationDoc.exists()) {
      // Solo cambiar estado a offline - MANTENER coordenadas
      await updateDoc(locationRef, {
        isOnline: false,
        lastDeactivated: new Date(),
        // NO eliminar lat, lng, timestamp
      });
      
      console.log('✅ Círculo desactivado manteniendo ubicación para:', userEmail);
    }
    
    // Actualizar estado del usuario
    await updateDoc(doc(db, 'users', userId), {
      status: 'offline',
      lastSeen: new Date()
    });
    
  } catch (error) {
    console.error('❌ Error desactivando círculo:', error);
    throw error;
  }
};

export const getMyLocation = async (userEmail: string): Promise<FirebaseUbicacion | null> => {
  try {
    // Buscar usuario por email
    const userQuery = query(collection(db, 'users'), where('email', '==', userEmail));
    const userSnapshot = await getDocs(userQuery);
    
    if (userSnapshot.empty) {
      console.warn('⚠️ Usuario no encontrado:', userEmail);
      return null;
    }
    
    const userDoc = userSnapshot.docs[0];
    const userId = userDoc.id;
    const userData = userDoc.data();
    
    // Buscar ubicación usando userId
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
    console.error('❌ Error getting my location:', error);
    return null;
  }
};

export const subscribeToMyLocation = (userEmail: string, callback: (location: FirebaseUbicacion | null) => void) => {
  console.log('📍 Suscribiéndose a mi ubicación:', userEmail);
  
  // Primero obtener el userId
  const setupSubscription = async () => {
    try {
      const userQuery = query(collection(db, 'users'), where('email', '==', userEmail));
      const userSnapshot = await getDocs(userQuery);
      
      if (userSnapshot.empty) {
        console.warn('⚠️ Usuario no encontrado para suscripción:', userEmail);
        callback(null);
        return () => {};
      }
      
      const userId = userSnapshot.docs[0].id;
      const userData = userSnapshot.docs[0].data();
      
      // Suscribirse al documento de ubicación usando userId
      return onSnapshot(doc(db, 'ubicaciones', userId), (snapshot) => {
        if (snapshot.exists()) {
          const locationData = snapshot.data();
          console.log('📍 Mi ubicación actualizada:', locationData);
          
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
          console.log('❌ No existe mi documento de ubicación');
          callback(null);
        }
      }, (error) => {
        console.error('❌ Error en suscripción a mi ubicación:', error);
        callback(null);
      });
      
    } catch (error) {
      console.error('❌ Error configurando suscripción:', error);
      callback(null);
      return () => {};
    }
  };
  
  // Ejecutar configuración y retornar función de limpieza
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

// ========== FUNCIONES DE INVITACIONES Y MIEMBROS ==========

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

// ========== FUNCIONES DE ALERTAS TRADICIONALES ==========

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

// ========== LISTENERS EN TIEMPO REAL ==========

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

// ========== FUNCIONES DE ESTADÍSTICAS Y DEBUGGING ==========

export const getUserGroupsAlerts = async (userEmail: string): Promise<FirebaseAlert[]> => {
  try {
    console.log('🔍 Buscando alertas para todos los grupos del usuario:', userEmail);
    
    // Primero obtener todos los grupos del usuario
    const userGroups = await getUserGroups(userEmail);
    
    if (userGroups.length === 0) {
      console.log('📭 Usuario no tiene grupos');
      return [];
    }
    
    // Obtener alertas de todos los grupos
    const allAlerts: FirebaseAlert[] = [];
    
    for (const group of userGroups) {
      try {
        const groupAlerts = await getGroupAlerts(group.id);
        allAlerts.push(...groupAlerts);
        console.log(`📊 ${groupAlerts.length} alertas del grupo ${group.name}`);
      } catch (error) {
        console.error(`❌ Error obteniendo alertas del grupo ${group.name}:`, error);
      }
    }
    
    // Eliminar duplicados y ordenar por fecha
    const uniqueAlerts = allAlerts
      .filter((alert, index, self) => index === self.findIndex(a => a.id === alert.id))
      .sort((a, b) => {
        const dateA = a.timestamp?.toDate ? a.timestamp.toDate() : new Date(a.timestamp);
        const dateB = b.timestamp?.toDate ? b.timestamp.toDate() : new Date(b.timestamp);
        return dateB.getTime() - dateA.getTime();
      });
    
    console.log(`✅ ${uniqueAlerts.length} alertas únicas encontradas para usuario ${userEmail}`);
    return uniqueAlerts;
    
  } catch (error) {
    console.error('❌ Error getting user groups alerts:', error);
    return [];
  }
};

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

// 🔧 FUNCIÓN DE DEBUGGING MEJORADA
export const debugGroupAlerts = async (groupId: string): Promise<void> => {
  try {
    console.log('🐛 DEBUG: Iniciando verificación de alertas para grupo:', groupId);
    
    // 1. Verificar que el grupo existe
    const groupDoc = await getDoc(doc(db, 'circulos', groupId));
    console.log('🐛 Grupo existe:', groupDoc.exists());
    if (groupDoc.exists()) {
      console.log('🐛 Datos del grupo:', groupDoc.data());
    }
    
    // 2. Verificar todas las alertas en la colección
    const allAlertsSnapshot = await getDocs(collection(db, 'alertasCirculos'));
    console.log('🐛 Total de alertas en la colección:', allAlertsSnapshot.docs.length);
    
    // 3. Mostrar TODAS las alertas con detalles completos
    allAlertsSnapshot.docs.forEach((doc, index) => {
      const data = doc.data();
      console.log(`🐛 Alerta ${index + 1}:`, {
        id: doc.id,
        circleIds: data.circleIds, // 🔧 NUEVO CAMPO
        circleId: data.circleId,
        groupId: data.groupId,
        activatrue: data.activatrue, // 🔧 CAMPO CORRECTO
        resolved: data.resolved,
        name: data.name,
        userName: data.userName,
        email: data.email,
        userEmail: data.userEmail,
        emisorId: data.emisorId,
        userId: data.userId,
        mensaje: data.mensaje,
        message: data.message,
        timestamp: data.timestamp,
        ubicacion: data.ubicacion,
        location: data.location,
        phone: data.phone,
        destinatarios: data.destinatarios
      });
    });
    
    // 4. Buscar alertas que coincidan con el grupo (TODAS LAS VARIANTES)
    console.log(`🔍 Buscando alertas que coincidan con grupo: ${groupId}`);
    
    const matchingByCircleIds = allAlertsSnapshot.docs.filter(doc => {
      const data = doc.data();
      return data.circleIds && Array.isArray(data.circleIds) && data.circleIds.includes(groupId);
    });
    console.log(`🎯 Alertas con circleIds que contienen ${groupId}:`, matchingByCircleIds.length);
    
    const matchingByCircleId = allAlertsSnapshot.docs.filter(doc => {
      const data = doc.data();
      return data.circleId === groupId;
    });
    console.log(`🎯 Alertas con circleId == ${groupId}:`, matchingByCircleId.length);
    
    const matchingByGroupId = allAlertsSnapshot.docs.filter(doc => {
      const data = doc.data();
      return data.groupId === groupId;
    });
    console.log(`🎯 Alertas con groupId == ${groupId}:`, matchingByGroupId.length);
    
    // 5. Mostrar detalles de alertas que coinciden
    [...matchingByCircleIds, ...matchingByCircleId, ...matchingByGroupId].forEach((doc, index) => {
      const data = doc.data();
      console.log(`🚨 Alerta coincidente ${index + 1}:`, {
        id: doc.id,
        circleIds: data.circleIds,
        circleId: data.circleId,
        groupId: data.groupId,
        activatrue: data.activatrue,
        resolved: data.resolved,
        name: data.name,
        mensaje: data.mensaje,
        timestamp: data.timestamp?.toDate?.() || data.timestamp,
        ubicacion: data.ubicacion
      });
    });
    
    // 6. Probar las funciones principales
    console.log('🔄 Probando getGroupAlerts...');
    const alerts = await getGroupAlerts(groupId);
    console.log('📋 Resultado getGroupAlerts:', alerts.length, 'alertas');
    
    alerts.forEach((alert, index) => {
      console.log(`📌 Alerta procesada ${index + 1}:`, {
        id: alert.id,
        userName: alert.userName,
        resolved: alert.resolved,
        location: alert.location,
        coordinates: alert.coordinates,
        timestamp: alert.timestamp?.toDate?.() || alert.timestamp
      });
    });
    
    // 7. Probar estadísticas
    console.log('🔄 Probando getGroupAlertStats...');
    const stats = await getGroupAlertStats(groupId);
    console.log('📊 Estadísticas:', stats);
    
  } catch (error) {
    console.error('❌ Error en debug:', error);
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
    
    // 3. Mostrar todas las alertas con sus campos relevantes
    allAlertsSnapshot.docs.forEach((doc, index) => {
      const data = doc.data();
      console.log(`📄 Alerta ${index + 1}:`, {
        id: doc.id,
        circleIds: data.circleIds,
        circleId: data.circleId,
        groupId: data.groupId,
        name: data.name,
        userName: data.userName,
        email: data.email,
        userEmail: data.userEmail,
        activa: data.activa,
        resolved: data.resolved,
        mensaje: data.mensaje,
        message: data.message,
        timestamp: data.timestamp?.toDate?.() || data.timestamp,
        ubicacion: data.ubicacion,
        location: data.location
      });
    });
    
    // 4. Buscar alertas específicas del grupo
    console.log(`🎯 Buscando alertas para grupo: ${groupId}`);
    const alerts = await getGroupAlerts(groupId);
    console.log(`📋 ${alerts.length} alertas encontradas`);
    
    alerts.forEach((alert, index) => {
      console.log(`🚨 Alerta ${index + 1}:`, {
        id: alert.id,
        userName: alert.userName,
        userEmail: alert.userEmail,
        message: alert.message,
        resolved: alert.resolved,
        location: alert.location,
        coordinates: alert.coordinates,
        timestamp: alert.timestamp?.toDate?.() || alert.timestamp
      });
    });
    
    // 5. Probar estadísticas
    const stats = await getGroupAlertStats(groupId);
    console.log('📊 Estadísticas del grupo:', stats);
    
  } catch (error) {
    console.error('❌ Error en testGroupAlerts:', error);
  }
};

export const createTestAlert = async (groupId: string): Promise<string> => {
  try {
    console.log('🧪 Creando alerta de prueba para grupo:', groupId);
    
    const testAlert = {
      circleIds: [groupId], // 🔧 NUEVO FORMATO: Array de IDs
      circleId: groupId, // Mantener compatibilidad
      groupId: groupId, // Compatibilidad adicional
      name: 'Usuario de Prueba',
      userName: 'Usuario de Prueba',
      email: 'test@example.com',
      userEmail: 'test@example.com',
      mensaje: 'Esta es una alerta de prueba',
      message: 'Esta es una alerta de prueba',
      activatrue: true, // 🔧 CAMPO CORRECTO
      resolved: false,
      timestamp: new Date(),
      ubicacion: {
        lat: 19.4326,
        lng: -99.1332
      },
      location: '19.432600, -99.133200',
      coordinates: [-99.1332, 19.4326],
      phone: '+52 55 1234 5678',
      destinatarios: ['admin@example.com'],
      emisorId: 'test-user-id',
      userId: 'test-user-id',
      type: 'panic'
    };
    
    const docRef = await addDoc(collection(db, 'alertasCirculos'), testAlert);
    console.log('✅ Alerta de prueba creada:', docRef.id);
    return docRef.id;
    
  } catch (error) {
    console.error('❌ Error creando alerta de prueba:', error);
    throw error;
  }
};

// ========== FUNCIONES AUXILIARES ==========

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
      await updateDoc(locationRef, {
        isOnline: false,
        lastSeen: new Date()
      });
      console.log('✅ Usuario marcado como offline:', userId);
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
    console.error('❌ Error setting user offline:', error);
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

// ========== FUNCIONES DE DIAGNÓSTICO AVANZADAS ==========

export const diagnoseLocationIssues = async (userEmail?: string): Promise<{
  totalUsers: number;
  usersWithLocations: number;
  usersWithValidCoords: number;
  duplicateUsers: string[];
  orphanedLocations: string[];
  issues: string[];
  suggestions: string[];
}> => {
  console.log('🔍 Diagnosticando problemas de ubicaciones...');
  
  const issues: string[] = [];
  const suggestions: string[] = [];
  const duplicateUsers: string[] = [];
  const orphanedLocations: string[] = [];
  
  try {
    // 1. Obtener todos los usuarios
    const usersSnapshot = await getDocs(collection(db, 'users'));
    const totalUsers = usersSnapshot.size;
    
    // 2. Obtener todas las ubicaciones
    const locationsSnapshot = await getDocs(collection(db, 'ubicaciones'));
    
    // 3. Mapear usuarios por email para detectar duplicados
    const usersByEmail = new Map<string, string[]>();
    const userIds = new Set<string>();
    
    usersSnapshot.docs.forEach(doc => {
      const data = doc.data();
      const email = data.email;
      
      userIds.add(doc.id);
      
      if (!usersByEmail.has(email)) {
        usersByEmail.set(email, []);
      }
      usersByEmail.get(email)!.push(doc.id);
    });
    
    // 4. Detectar duplicados
    for (const [email, ids] of usersByEmail.entries()) {
      if (ids.length > 1) {
        duplicateUsers.push(email);
        issues.push(`Usuario duplicado: ${email} (${ids.length} copias)`);
      }
    }
    
    // 5. Verificar ubicaciones huérfanas
    let usersWithLocations = 0;
    let usersWithValidCoords = 0;
    
    locationsSnapshot.docs.forEach(doc => {
      const locationId = doc.id;
      const locationData = doc.data();
      
      if (!userIds.has(locationId)) {
        orphanedLocations.push(locationId);
        issues.push(`Ubicación huérfana: ${locationId} (${locationData.userEmail})`);
      } else {
        usersWithLocations++;
        
        if (locationData.lat && locationData.lng && 
            !isNaN(locationData.lat) && !isNaN(locationData.lng) &&
            locationData.lat !== 0 && locationData.lng !== 0) {
          usersWithValidCoords++;
        }
      }
    });
    
    // 6. Generar sugerencias
    if (duplicateUsers.length > 0) {
      suggestions.push(`Ejecutar cleanupDuplicateUsers() para limpiar ${duplicateUsers.length} duplicados`);
    }
    
    if (orphanedLocations.length > 0) {
      suggestions.push(`Ejecutar cleanupOrphanedLocations() para limpiar ${orphanedLocations.length} ubicaciones huérfanas`);
    }
    
    if (usersWithValidCoords < usersWithLocations) {
      suggestions.push(`${usersWithLocations - usersWithValidCoords} usuarios necesitan actualizar sus coordenadas`);
    }
    
    // 7. Diagnóstico específico por usuario
    if (userEmail) {
      const userQuery = query(collection(db, 'users'), where('email', '==', userEmail));
      const userSnapshot = await getDocs(userQuery);
      
      if (userSnapshot.empty) {
        issues.push(`Usuario específico no encontrado: ${userEmail}`);
      } else if (userSnapshot.size > 1) {
        issues.push(`Usuario específico duplicado: ${userEmail}`);
      } else {
        const userId = userSnapshot.docs[0].id;
        const locationDoc = await getDoc(doc(db, 'ubicaciones', userId));
        
        if (!locationDoc.exists()) {
          issues.push(`Usuario específico sin ubicación: ${userEmail}`);
          suggestions.push(`Ejecutar activateMemberCircle('${userEmail}') para crear ubicación`);
        } else {
          const locationData = locationDoc.data();
          if (!locationData.lat || !locationData.lng || locationData.lat === 0 || locationData.lng === 0) {
            issues.push(`Usuario específico sin coordenadas válidas: ${userEmail}`);
            suggestions.push(`Usuario debe compartir su ubicación desde la app`);
          }
        }
      }
    }
    
    const result = {
      totalUsers,
      usersWithLocations,
      usersWithValidCoords,
      duplicateUsers,
      orphanedLocations,
      issues,
      suggestions
    };
    
    console.log('📊 Diagnóstico completado:', result);
    return result;
    
  } catch (error) {
    console.error('❌ Error en diagnóstico:', error);
    return {
      totalUsers: 0,
      usersWithLocations: 0,
      usersWithValidCoords: 0,
      duplicateUsers: [],
      orphanedLocations: [],
      issues: ['Error ejecutando diagnóstico'],
      suggestions: ['Revisar logs para más detalles']
    };
  }
};

export const autoFixLocationIssues = async (): Promise<{
  duplicatesCleaned: number;
  orphansCleaned: number;
  usersFixed: number;
  errors: string[];
}> => {
  console.log('🔧 Iniciando reparación automática...');
  
  const errors: string[] = [];
  let duplicatesCleaned = 0;
  let orphansCleaned = 0;
  let usersFixed = 0;
  
  try {
    // 1. Limpiar usuarios duplicados
    const duplicateResult = await cleanupDuplicateUsers();
    duplicatesCleaned = duplicateResult.duplicatesCleaned;
    errors.push(...duplicateResult.errors);
    
    // 2. Limpiar ubicaciones huérfanas
    const orphanResult = await cleanupOrphanedLocations();
    orphansCleaned = orphanResult.orphanedCleaned;
    errors.push(...orphanResult.errors);
    
    // 3. Verificar que todos los usuarios tengan documento de ubicación
    const usersSnapshot = await getDocs(collection(db, 'users'));
    
    for (const userDoc of usersSnapshot.docs) {
      try {
        const userId = userDoc.id;
        const userData = userDoc.data();
        const locationDoc = await getDoc(doc(db, 'ubicaciones', userId));
        
        if (!locationDoc.exists()) {
          // Crear documento de ubicación básico
          await setDoc(doc(db, 'ubicaciones', userId), {
            userId: userId,
            userEmail: userData.email,
            userName: userData.name || userData.email.split('@')[0],
            isOnline: false,
            lastActivated: new Date(),
            // Sin coordenadas hasta que el usuario las comparta
          });
          
          usersFixed++;
          console.log(`✅ Documento de ubicación creado para: ${userData.email}`);
        }
      } catch (error) {
        const errorMsg = `Error creando ubicación para usuario ${userDoc.id}: ${error}`;
        console.error('❌', errorMsg);
        errors.push(errorMsg);
      }
    }
    
    console.log('🎉 Reparación automática completada:', {
      duplicatesCleaned,
      orphansCleaned,
      usersFixed,
      errors: errors.length
    });
    
    return { duplicatesCleaned, orphansCleaned, usersFixed, errors };
    
  } catch (error) {
    console.error('❌ Error en reparación automática:', error);
    return {
      duplicatesCleaned: 0,
      orphansCleaned: 0,
      usersFixed: 0,
      errors: [error instanceof Error ? error.message : 'Error desconocido']
    };
  }
};

// ========== FUNCIONES DE COMPATIBILIDAD Y MIGRACIÓN ==========

export const getUserLocationHistory = async (userEmail: string, limitCount: number = 10): Promise<FirebaseUbicacion[]> => {
  try {
    const user = await getUserByEmail(userEmail);
    if (!user) return [];
    
    // Buscar en una colección de historial si existe
    const historyQuery = query(
      collection(db, 'ubicaciones_historial'), 
      where('userEmail', '==', userEmail),
      orderBy('timestamp', 'desc'),
      limit(limitCount)
    );
    
    const snapshot = await getDocs(historyQuery);
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as FirebaseUbicacion));
  } catch (error) {
    console.error('Error getting user location history:', error);
    return [];
  }
};

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
    console.error('Error checking member location status:', error);
    return {
      hasLocationRecord: false,
      hasRealCoordinates: false,
      isOnline: false,
      lastKnownLocation: null,
      lastUpdate: null
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
          batch.update(locationDoc.ref, {
            isOnline: false,
            lastSeen: new Date()
          });
          cleaned++;
          console.log('🗑️ Marcando ubicación como inactiva:', data.userEmail);
        }
      } catch (error) {
        console.error('❌ Error procesando ubicación:', locationDoc.id, error);
        errors++;
      }
    }

    if (cleaned > 0) {
      await batch.commit();
      console.log(`✅ ${cleaned} ubicaciones inactivas marcadas`);
    }

    return { cleaned, errors };
  } catch (error) {
    console.error('❌ Error en limpieza de ubicaciones:', error);
    return { cleaned: 0, errors: 1 };
  }
};

// ========== EXPORTACIONES ADICIONALES PARA COMPATIBILIDAD ==========

export interface UnifiedGroup {
  id: string;
  name: string;
  description: string;
  createdBy: string;
  members: string[];
  membersUids?: string[];
  pendingInvitations: string[];
  createdAt: any;
  isAutoSynced: boolean;
  lastSyncUpdate?: any;
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
}

// Funciones de sincronización (importación dinámica para evitar dependencias circulares)
export const createAutoSyncGroup = async (groupData: any): Promise<string> => {
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

// ========== EXPORTACIÓN FINAL ==========

console.log('✅ Firebase index cargado con soporte completo para alertas con circleIds');

// DEBUG solo en navegador
if (typeof window !== "undefined") {
  (window as any).createTestAlert = createTestAlert;
  (window as any).testGroupAlerts = testGroupAlerts;
  (window as any).debugGroupAlerts = debugGroupAlerts;
}
