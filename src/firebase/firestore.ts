import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore, collection, addDoc, getDocs, deleteDoc, doc, updateDoc, query, where, onSnapshot } from "firebase/firestore";

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

// Interfaces
export interface FirebaseUser {
  id: string;
  email: string;
  name: string;
  phone: string;
  role: 'guardian' | 'protegido';
  createdAt: Date;
  lastSeen: Date;
  status: 'online' | 'offline';
  location?: string;
  coordinates?: [number, number];
}

export interface FirebaseGroup {
  id: string;
  name: string;
  description: string;
  createdBy: string;
  members: string[]; // emails de los miembros
  createdAt: Date;
}

export interface FirebaseAlert {
  id: string;
  userEmail: string;
  userName: string;
  message: string;
  type: 'emergency' | 'warning' | 'info';
  coordinates: [number, number];
  timestamp: Date;
  read: boolean;
}

// Funciones para usuarios
export const getUsers = async (): Promise<FirebaseUser[]> => {
  const snapshot = await getDocs(collection(db, 'users'));
  return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as FirebaseUser));
};

export const getUserByEmail = async (email: string): Promise<FirebaseUser | null> => {
  const q = query(collection(db, 'users'), where('email', '==', email));
  const snapshot = await getDocs(q);
  if (snapshot.empty) return null;
  const doc = snapshot.docs[0];
  return { id: doc.id, ...doc.data() } as FirebaseUser;
};

// Funciones para grupos
export const createGroup = async (groupData: Omit<FirebaseGroup, 'id' | 'createdAt'>): Promise<string> => {
  const docRef = await addDoc(collection(db, 'circulos'), {
    ...groupData,
    createdAt: new Date()
  });
  return docRef.id;
};

export const getGroups = async (): Promise<FirebaseGroup[]> => {
  const snapshot = await getDocs(collection(db, 'circulos'));
  return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as FirebaseGroup));
};

export const deleteGroup = async (groupId: string): Promise<void> => {
  await deleteDoc(doc(db, 'circulos', groupId));
};

export const addMemberToGroup = async (groupId: string, memberEmail: string): Promise<void> => {
  const groupRef = doc(db, 'circulos', groupId);
  const groupSnapshot = await getDocs(query(collection(db, 'circulos'), where('__name__', '==', groupId)));
  
  if (!groupSnapshot.empty) {
    const groupData = groupSnapshot.docs[0].data() as FirebaseGroup;
    const updatedMembers = [...groupData.members, memberEmail];
    await updateDoc(groupRef, { members: updatedMembers });
  }
};

export const removeMemberFromGroup = async (groupId: string, memberEmail: string): Promise<void> => {
  const groupRef = doc(db, 'circulos', groupId);
  const groupSnapshot = await getDocs(query(collection(db, 'circulos'), where('__name__', '==', groupId)));
  
  if (!groupSnapshot.empty) {
    const groupData = groupSnapshot.docs[0].data() as FirebaseGroup;
    const updatedMembers = groupData.members.filter(email => email !== memberEmail);
    await updateDoc(groupRef, { members: updatedMembers });
  }
};

// Funciones para alertas
export const createAlert = async (alertData: Omit<FirebaseAlert, 'id' | 'timestamp'>): Promise<string> => {
  const docRef = await addDoc(collection(db, 'alerts'), {
    ...alertData,
    timestamp: new Date()
  });
  return docRef.id;
};

export const getAlerts = async (): Promise<FirebaseAlert[]> => {
  const snapshot = await getDocs(collection(db, 'alerts'));
  return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as FirebaseAlert));
};

export const markAlertAsRead = async (alertId: string): Promise<void> => {
  const alertRef = doc(db, 'alerts', alertId);
  await updateDoc(alertRef, { read: true });
};

// Listener en tiempo real para grupos
export const subscribeToGroups = (callback: (groups: FirebaseGroup[]) => void) => {
  return onSnapshot(collection(db, 'circulos'), (snapshot) => {
    const groups = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as FirebaseGroup));
    callback(groups);
  });
};

// Listener en tiempo real para alertas
export const subscribeToAlerts = (callback: (alerts: FirebaseAlert[]) => void) => {
  return onSnapshot(collection(db, 'alerts'), (snapshot) => {
    const alerts = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as FirebaseAlert))
      .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
    callback(alerts);
  });
};