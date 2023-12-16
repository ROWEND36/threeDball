// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";
import { getAuth } from "firebase/auth";
import isServerSide from "@/utils/is_server_side";
// TODO: Add SDKs for Firebase products that you want to use
// https://firebase.google.com/docs/web/setup#available-libraries

// Your web app's Firebase configuration
export const firebaseConfig = {
  apiKey: "AIzaSyDQQeIYOjPxPyVsLx888hPVpCFXzbn0HJ4",
  authDomain: "csmsuniben.firebaseapp.com",
  projectId: "csmsuniben",
  storageBucket: "csmsuniben.appspot.com",
  messagingSenderId: "200030486685",
  appId: "1:200030486685:web:20a12082ace747391ad474",
};

// Initialize Firebase but only on client
const app = isServerSide ? null : initializeApp(firebaseConfig);
export const firestore = isServerSide ? null : getFirestore(app);
export const storage = isServerSide ? null : getStorage(app);
export const auth = isServerSide ? null : getAuth(app);

export const firestoreNS = "";
