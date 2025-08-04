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
  arrayRemove
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

// Funciones de grupos
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

// Listeners en tiempo real
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