```javascript
import { initializeApp } from "https://www.gstatic.com/firebasejs/11.6.0/firebase-app.js";
import {
  getAuth,
  GoogleAuthProvider
} from "https://www.gstatic.com/firebasejs/11.6.0/firebase-auth.js";
import {
  getFirestore
} from "https://www.gstatic.com/firebasejs/11.6.0/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyD8i0zIRiUFjJhYDl-d6JPVc5oQBy-KgoI",
  authDomain: "study-shelf-ce949.firebaseapp.com",
  projectId: "study-shelf-ce949",
  storageBucket: "study-shelf-ce949.firebasestorage.app",
  messagingSenderId: "612608972712",
  appId: "1:612608972712:web:b8a60e1feb435d68a16f9d",
  measurementId: "G-50QV1Y0SH0"
};

const app = initializeApp(firebaseConfig);

export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();
export const db = getFirestore(app);
```
