import { initializeApp } from "firebase/app";
import { getAuth, GoogleAuthProvider } from "firebase/auth";
import { getFirestore, collection, addDoc, getDocs, deleteDoc, doc, query, where, onSnapshot } from "firebase/firestore";

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
}

// Funciones básicas
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

export const createUser = async (userData: Omit<FirebaseUser, 'id'>): Promise<string> => {
  const docRef = await addDoc(collection(db, 'users'), userData);
  return docRef.id;
};

export const getGroups = async (): Promise<FirebaseGroup[]> => {
  const snapshot = await getDocs(collection(db, 'circulos'));
  return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as FirebaseGroup));
};

export const createGroup = async (groupData: Omit<FirebaseGroup, 'id'>): Promise<string> => {
  const docRef = await addDoc(collection(db, 'circulos'), groupData);
  return docRef.id;
};

export const deleteGroup = async (groupId: string): Promise<void> => {
  await deleteDoc(doc(db, 'circulos', groupId));
};

// Listeners en tiempo real
export const subscribeToUsers = (callback: (users: FirebaseUser[]) => void) => {
  return onSnapshot(collection(db, 'users'), (snapshot) => {
    const users = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as FirebaseUser));
    callback(users);
  });
};

export const subscribeToGroups = (callback: (groups: FirebaseGroup[]) => void) => {
  return onSnapshot(collection(db, 'circulos'), (snapshot) => {
    const groups = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as FirebaseGroup));
    callback(groups);
  });
};