import { initializeApp } from "firebase/app"
import { getFirestore } from "firebase/firestore"
import { getAuth } from "firebase/auth"

const firebaseConfig = {
  apiKey: "AIzaSyAqpWAx2Uh7I_J9EXZi-dXWgt5hzAbEGIk",
  authDomain: "kevonics-audio.firebaseapp.com",
  projectId: "kevonics-audio",
  storageBucket: "kevonics-audio.firebasestorage.app",
  messagingSenderId: "30733527565",
  appId: "1:30733527565:web:99f89d11e8a40b383d0344",
  measurementId: "G-NCX7P95ETB"
};

const app = initializeApp(firebaseConfig)
export const db = getFirestore(app)
export const auth = getAuth(app)
export default app
