import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getAnalytics, isSupported } from "firebase/analytics";

// Your web app's Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyBeNmq1M2ujmBaqZCRDSGTs7PHuA7a9zfM",
  authDomain: "stich-ceeplex.firebaseapp.com",
  projectId: "stich-ceeplex",
  storageBucket: "stich-ceeplex.firebasestorage.app",
  messagingSenderId: "745054192653",
  appId: "1:745054192653:web:8ce60b2e279f1211588144",
  measurementId: "G-JKQ2DT3SJ4"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);

// Initialize Analytics conditionally to avoid errors in environments that don't support it
let analytics: any = null;
isSupported().then((supported) => {
  if (supported) {
    analytics = getAnalytics(app);
  }
}).catch((err) => {
  console.warn("Firebase Analytics not supported or failed to initialize", err);
});

export { analytics };