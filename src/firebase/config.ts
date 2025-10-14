import { initializeApp } from "firebase/app";
import { getAuth, GoogleAuthProvider } from "firebase/auth";
import { getFirestore, writeBatch } from "firebase/firestore";

const firebaseConfig = {
    apiKey: "AIzaSyBrzB7lXrYmcSCPwssx3a1tCj2bG_j4RaA",
    authDomain: "amsp-4cca7.firebaseapp.com",
    projectId: "amsp-4cca7",
    storageBucket: "amsp-4cca7.firebasestorage.app",
    messagingSenderId: "661304028062",
    appId: "1:661304028062:web:07d329787d3925983f848f",
    measurementId: "G-FBXK39FEQ3"
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
export const googleProvider = new GoogleAuthProvider();
export { writeBatch };