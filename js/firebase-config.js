import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import {
    getFirestore,
    initializeFirestore,
    persistentLocalCache,
    persistentMultipleTabManager
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

// TODO: Replace the following with your app's Firebase project configuration
// See: https://firebase.google.com/docs/web/learn-more#config-object
const firebaseConfig = {
    apiKey: "AIzaSyCtB2Vj5l5OTKupW9cjbRwG7BzvhHkJSPQ",
    authDomain: "playpoints-89c84.firebaseapp.com",
    projectId: "playpoints-89c84",
    storageBucket: "playpoints-89c84.firebasestorage.app",
    messagingSenderId: "1078139693941",
    appId: "1:1078139693941:web:a621a89428f80e66a3413c",
    measurementId: "G-J57RT2SPQ4"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Initialize Firebase Authentication and get a reference to the service
const auth = getAuth(app);

// Initialize Cloud Firestore and get a reference to the service
const db = initializeFirestore(app, {
    localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() })
});

export { auth, db };
