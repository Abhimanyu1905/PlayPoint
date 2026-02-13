/* 
====================================================================
   PLAYPOINTS - AUTHENTICATION LOGIC
   Handles: Login, Signup, Role Redirection with Firebase
====================================================================
*/

import { auth, db } from './firebase-config.js';
import {
    createUserWithEmailAndPassword,
    signInWithEmailAndPassword,
    onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import {
    doc,
    setDoc,
    getDoc
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

document.addEventListener('DOMContentLoaded', () => {

    // Elements
    const loginForm = document.getElementById('loginForm');
    const signupForm = document.getElementById('signupForm');
    const toSignup = document.getElementById('toSignup');
    const toLogin = document.getElementById('toLogin');
    const toSignupText = document.getElementById('toSignupText');
    const toLoginText = document.getElementById('toLoginText');
    const toast = document.getElementById('toast');
    const toastMsg = document.getElementById('toastMsg');

    // Toggle Forms
    toSignup.addEventListener('click', (e) => {
        e.preventDefault();
        loginForm.style.display = 'none';
        signupForm.style.display = 'flex';
        toSignupText.style.display = 'none';
        toLoginText.style.display = 'block';
    });

    toLogin.addEventListener('click', (e) => {
        e.preventDefault();
        signupForm.style.display = 'none';
        loginForm.style.display = 'flex';
        toLoginText.style.display = 'none';
        toSignupText.style.display = 'block';
    });

    // Login
    loginForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const email = document.getElementById('email').value;
        const password = document.getElementById('password').value;

        try {
            const userCredential = await signInWithEmailAndPassword(auth, email, password);
            const user = userCredential.user;

            // Check Role from Firestore
            const docRef = doc(db, "users", user.uid);
            const docSnap = await getDoc(docRef);

            if (docSnap.exists()) {
                const userData = docSnap.data();
                showToast(`Welcome back, ${userData.username}!`, 'success');
                setTimeout(() => {
                    if (userData.role === 'admin') {
                        window.location.href = 'admin.html';
                    } else {
                        window.location.href = 'dashboard.html';
                    }
                }, 1500);
            } else {
                // Self-healing: Create missing user doc
                console.warn("User authenticated but no Firestore doc found. Creating one now...");
                const username = email.split('@')[0]; // Fallback username
                const role = email === 'admin@playpoints.com' ? 'admin' : 'user';

                await setDoc(doc(db, "users", user.uid), {
                    username: username,
                    email: email,
                    role: role,
                    points: 0,
                    gamesPlayed: 0,
                    createdAt: new Date()
                });

                showToast(`Profile restored! Welcome, ${username}`, 'success');
                setTimeout(() => {
                    window.location.href = role === 'admin' ? 'admin.html' : 'dashboard.html';
                }, 1500);
            }

        } catch (error) {
            console.error(error);
            showToast(error.message, 'error');
        }
    });

    // Signup
    signupForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const username = document.getElementById('new-username').value;
        const email = document.getElementById('new-email').value;
        const password = document.getElementById('new-password').value;
        const role = document.getElementById('role-select').value;

        try {
            const userCredential = await createUserWithEmailAndPassword(auth, email, password);
            const user = userCredential.user;

            // Save additional info to Firestore
            await setDoc(doc(db, "users", user.uid), {
                username: username,
                email: email,
                role: role,
                points: 0,
                gamesPlayed: 0,
                createdAt: new Date()
            });

            showToast('Account created successfully!', 'success');
            setTimeout(() => {
                if (role === 'admin') {
                    window.location.href = 'admin.html';
                } else {
                    window.location.href = 'dashboard.html';
                }
            }, 1500);

        } catch (error) {
            console.error(error);
            showToast(error.message, 'error');
        }
    });

    function showToast(msg, type = 'info') {
        toastMsg.innerText = msg;
        toast.style.borderColor = type === 'error' ? '#ff0055' : 'var(--primary)';
        toast.classList.add('show');
        setTimeout(() => toast.classList.remove('show'), 3000);
    }

    // Auth State Observer (Optional for index page if we want redirect if already logged in)
    onAuthStateChanged(auth, async (user) => {
        if (user) {
            // User is signed in, check if we are on index.html and redirect
            if (window.location.pathname.endsWith('index.html') || window.location.pathname === '/') {
                // Optional: Auto redirect if desired. For now, let them login again or just stay.
                // const docRef = doc(db, "users", user.uid);
                // const docSnap = await getDoc(docRef);
                // if (docSnap.exists()) {
                //      const userData = docSnap.data();
                //      window.location.href = userData.role === 'admin' ? 'admin.html' : 'dashboard.html';
                // }
            }
        }
    });
});

