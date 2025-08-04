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
  orderBy,
  limit as limitToLast
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
}

export interface FirebaseGroup {
  id: string;
  name: string;
  description: string;
  createdBy: string;
  members: string[];
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
}

// Nueva interfaz para ubicaciones
export interface FirebaseUbicacion {
  id: string;
  userId: string;
  userEmail: string;
  userName: string;
  coordinates: [number, number]; // [longitude, latitude]
  accuracy?: number; // precisión del GPS
  timestamp: Date;
  address?: string; // dirección legible
  speed?: number; // velocidad si está disponible
  heading?: number; // dirección si está disponible
  altitude?: number; // altitud si está disponible
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
      createdAt: new Date()
    });
    return docRef.id;
  } catch (error) {
    console.error('Error creating user:', error);
    throw error;
  }
};

// Funciones para manejar ubicaciones
export const createUbicacion = async (ubicacionData: Omit<FirebaseUbicacion, 'id'>): Promise<string> => {
  try {
    const docRef = await addDoc(collection(db, 'ubicaciones'), {
      ...ubicacionData,
      timestamp: new Date()
    });
    return docRef.id;
  } catch (error) {
    console.error('Error creating ubicacion:', error);
    throw error;
  }
};

export const getUbicaciones = async (limitCount: number = 100): Promise<FirebaseUbicacion[]> => {
  try {
    const q = query(
      collection(db, 'ubicaciones'), 
      orderBy('timestamp', 'desc'),
      limitToLast(limitCount)
    );
    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as FirebaseUbicacion));
  } catch (error) {
    console.error('Error getting ubicaciones:', error);
    return [];
  }
};

export const getUbicacionesByUser = async (userEmail: string, limitCount: number = 50): Promise<FirebaseUbicacion[]> => {
  try {
    const q = query(
      collection(db, 'ubicaciones'),
      where('userEmail', '==', userEmail),
      orderBy('timestamp', 'desc'),
      limitToLast(limitCount)
    );
    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as FirebaseUbicacion));
  } catch (error) {
    console.error('Error getting user ubicaciones:', error);
    return [];
  }
};

export const getLatestUbicaciones = async (): Promise<FirebaseUbicacion[]> => {
  try {
    // Obtener la ubicación más reciente de cada usuario
    const ubicacionesSnapshot = await getDocs(collection(db, 'ubicaciones'));
    const ubicacionesMap = new Map<string, FirebaseUbicacion>();

    ubicacionesSnapshot.docs.forEach(doc => {
      const ubicacion = { id: doc.id, ...doc.data() } as FirebaseUbicacion;
      const existing = ubicacionesMap.get(ubicacion.userEmail);
      
      if (!existing || new Date(ubicacion.timestamp) > new Date(existing.timestamp)) {
        ubicacionesMap.set(ubicacion.userEmail, ubicacion);
      }
    });

    return Array.from(ubicacionesMap.values());
  } catch (error) {
    console.error('Error getting latest ubicaciones:', error);
    return [];
  }
};

// Función para actualizar la ubicación de un usuario
export const updateUserLocation = async (
  userEmail: string, 
  coordinates: [number, number], 
  additionalData?: Partial<FirebaseUbicacion>
): Promise<string> => {
  try {
    // Obtener datos del usuario
    const user = await getUserByEmail(userEmail);
    if (!user) {
      throw new Error('Usuario no encontrado');
    }

    // Crear nueva ubicación
    const ubicacionData: Omit<FirebaseUbicacion, 'id'> = {
      userId: user.id,
      userEmail: userEmail,
      userName: user.name,
      coordinates,
      timestamp: new Date(),
      ...additionalData
    };

    return await createUbicacion(ubicacionData);
  } catch (error) {
    console.error('Error updating user location:', error);
    throw error;
  }
};

// Listeners en tiempo real para ubicaciones
export const subscribeToUbicaciones = (callback: (ubicaciones: FirebaseUbicacion[]) => void) => {
  return onSnapshot(
    query(collection(db, 'ubicaciones'), orderBy('timestamp', 'desc')),
    (snapshot) => {
      const ubicaciones = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as FirebaseUbicacion));
      callback(ubicaciones);
    },
    (error) => {
      console.error('Error in ubicaciones subscription:', error);
    }
  );
};

// Listener para ubicaciones más recientes por usuario
export const subscribeToLatestUbicaciones = (callback: (ubicaciones: FirebaseUbicacion[]) => void) => {
  return onSnapshot(
    collection(db, 'ubicaciones'),
    (snapshot) => {
      const ubicacionesMap = new Map<string, FirebaseUbicacion>();

      snapshot.docs.forEach(doc => {
        const ubicacion = { id: doc.id, ...doc.data() } as FirebaseUbicacion;
        const existing = ubicacionesMap.get(ubicacion.userEmail);
        
        if (!existing || new Date(ubicacion.timestamp) > new Date(existing.timestamp)) {
          ubicacionesMap.set(ubicacion.userEmail, ubicacion);
        }
      });

      const latestUbicaciones = Array.from(ubicacionesMap.values());
      callback(latestUbicaciones);
    },
    (error) => {
      console.error('Error in latest ubicaciones subscription:', error);
    }
  );
};

// Funciones de grupos (mantenidas como estaban)
export const getGroups = async (): Promise<FirebaseGroup[]> => {
  try {
    const snapshot = await getDocs(collection(db, 'circulos'));
    return snapshot.docs.map(doc => ({ 
      id: doc.id, 
      ...doc.data(),
      members: doc.data().members || []
    } as FirebaseGroup));
  } catch (error) {
    console.error('Error getting groups:', error);
    return [];
  }
};

export const createGroup = async (groupData: Omit<FirebaseGroup, 'id'>): Promise<string> => {
  try {
    const docRef = await addDoc(collection(db, 'circulos'), {
      ...groupData,
      members: groupData.members || [],
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

export const addMemberToGroup = async (groupId: string, userEmail: string): Promise<void> => {
  try {
    const groupRef = doc(db, 'circulos', groupId);
    await updateDoc(groupRef, {
      members: arrayUnion(userEmail)
    });
  } catch (error) {
    console.error('Error adding member to group:', error);
    throw error;
  }
};

export const removeMemberFromGroup = async (groupId: string, userEmail: string): Promise<void> => {
  try {
    const groupRef = doc(db, 'circulos', groupId);
    await updateDoc(groupRef, {
      members: arrayRemove(userEmail)
    });
  } catch (error) {
    console.error('Error removing member from group:', error);
    throw error;
  }
};

// Funciones de alertas (mantenidas como estaban)
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

// Listeners en tiempo real (mantenidos como estaban)
export const subscribeToUsers = (callback: (users: FirebaseUser[]) => void) => {
  return onSnapshot(collection(db, 'users'), (snapshot) => {
    const users = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as FirebaseUser));
    callback(users);
  }, (error) => {
    console.error('Error in users subscription:', error);
  });
};

export const subscribeToGroups = (callback: (groups: FirebaseGroup[]) => void) => {
  return onSnapshot(collection(db, 'circulos'), (snapshot) => {
    const groups = snapshot.docs.map(doc => ({ 
      id: doc.id, 
      ...doc.data(),
      members: doc.data().members || []
    } as FirebaseGroup));
    callback(groups);
  }, (error) => {
    console.error('Error in groups subscription:', error);
  });
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