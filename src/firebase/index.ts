// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
import { getAnalytics } from "firebase/analytics";
import { getAuth } from "firebase/auth";
// TODO: Add SDKs for Firebase products that you want to use
// https://firebase.google.com/docs/web/setup#available-libraries

// Your web app's Firebase configuration
// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
  apiKey: "AIzaSyDB2sm1mia4KRgFjhZeapNtj87gF3w5IAA",
  authDomain: "vue-authentication-app-ae1e5.firebaseapp.com",
  projectId: "vue-authentication-app-ae1e5",
  storageBucket: "vue-authentication-app-ae1e5.firebasestorage.app",
  messagingSenderId: "444066946293",
  appId: "1:444066946293:web:0a1bff96f700c1d70b79bc",
  measurementId: "G-83BFK6XEPK"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const analytics = getAnalytics(app);


const auth = getAuth(app);

export { analytics, auth };