import firebase from "firebase/compat/app";
import "firebase/compat/auth";
import "firebase/compat/firestore";
import "firebase/compat/analytics";

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
if (!firebase.apps.length) {
    firebase.initializeApp(firebaseConfig);
} else {
    firebase.app(); // if already initialized, use that one
}

export const auth = firebase.auth();
export const db = firebase.firestore();

// Initialize Analytics conditionally
export const analytics = typeof window !== 'undefined' && firebase.analytics ? firebase.analytics() : null;

export default firebase;