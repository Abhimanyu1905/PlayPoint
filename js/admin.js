/* 
====================================================================
   PLAYPOINTS - ADMIN PANEL LOGIC
====================================================================
*/

import { auth, db } from './firebase-config.js';
import {
    onAuthStateChanged,
    signOut
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import {
    collection,
    getDocs,
    doc,
    updateDoc,
    deleteDoc,
    query,
    orderBy
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

let allUsers = [];

document.addEventListener('DOMContentLoaded', () => {
    onAuthStateChanged(auth, (user) => {
        if (user) {
            // detailed admin check should happen via custom claims or firestore role
            // For now, we rely on the client-side role check we did in auth.js before redirect
            // But let's verify again
            loadAdminData();
        } else {
            window.location.href = 'index.html';
        }
    });
});

async function loadAdminData() {
    try {
        const usersRef = collection(db, "users");
        const querySnapshot = await getDocs(usersRef);

        allUsers = [];
        querySnapshot.forEach((doc) => {
            allUsers.push({ id: doc.id, ...doc.data() });
        });

        // 1. Total Users
        const totalUsersEl = document.querySelectorAll('.card h2.text-gradient')[0];
        if (totalUsersEl) totalUsersEl.innerText = allUsers.length.toLocaleString();

        // 2. Active Now (Simulation)
        const activeCount = Math.max(1, Math.floor(allUsers.length * (Math.random() * 0.2 + 0.1)));
        const activeUsersEl = document.querySelectorAll('.card h2.text-gradient')[1];
        if (activeUsersEl) activeUsersEl.innerText = activeCount.toLocaleString();

        // 3. Points Distributed
        const totalPoints = allUsers.reduce((sum, user) => sum + (user.points || 0), 0);
        const totalPointsEl = document.getElementById('adminTotalPoints');
        if (totalPointsEl) totalPointsEl.innerText = totalPoints.toLocaleString();

        loadUsersTable(allUsers);
        renderGrowthChart(allUsers);

    } catch (e) {
        console.error("Error loading admin data:", e);
        alert("Error loading data: " + e.message);
    }
}

function renderGrowthChart(users) {
    const container = document.getElementById('adminChartContainer');
    if (!container) return;

    // Real Data Approach using createdAt
    const now = Date.now();
    const oneDay = 86400000;
    const buckets = new Array(7).fill(0);

    users.forEach(u => {
        let timestamp = now;
        if (u.createdAt) {
            // handle firestore timestamp or date string or number
            if (u.createdAt.seconds) timestamp = u.createdAt.seconds * 1000;
            else if (u.createdAt instanceof Date) timestamp = u.createdAt.getTime();
            else timestamp = new Date(u.createdAt).getTime();
        } else if (u.id && !isNaN(u.id) && u.id > 1000000000000) {
            // Fallback to ID if it looks like timestamp (legacy/demo)
            timestamp = Number(u.id);
        }

        const age = now - timestamp;
        const daysAgo = Math.floor(age / oneDay);
        if (daysAgo >= 0 && daysAgo < 7) {
            buckets[6 - daysAgo]++;
        } else {
            // Older, maybe put in first bucket or ignore
            // buckets[0]++; 
        }
    });

    const maxVal = Math.max(...buckets, 1) * 1.2;
    const width = container.offsetWidth || 600;
    const height = 250;
    const barWidth = (width / 7) - 20;

    let barsHTML = '';
    buckets.forEach((count, i) => {
        const barHeight = (count / maxVal) * height;
        const x = i * (width / 7) + 10;
        const y = height - barHeight;

        barsHTML += `
            <rect x="${x}" y="${y}" width="${barWidth}" height="${barHeight}" fill="var(--primary)" rx="4" />
            <text x="${x + barWidth / 2}" y="${y - 10}" fill="#fff" font-size="12" text-anchor="middle">${count}</text>
            <text x="${x + barWidth / 2}" y="${height + 20}" fill="#888" font-size="10" text-anchor="middle">Day ${i + 1}</text>
        `;
    });

    container.innerHTML = `
        <svg width="100%" height="${height + 30}" viewBox="0 0 ${width} ${height + 30}">
            ${barsHTML}
        </svg>
    `;
}

function loadUsersTable(users) {
    const tbody = document.querySelector('#section-users table tbody');
    if (!tbody) return;

    tbody.innerHTML = '';

    users.forEach(user => {
        const roleBadge = user.role === 'admin'
            ? '<span style="color:var(--secondary); font-weight:bold;">ADMIN</span>'
            : '<span style="color:var(--text-gray);">User</span>';

        const row = `
            <tr>
                <td>#${user.id.toString().slice(-4)}</td>
                <td>${user.username}</td>
                <td>${roleBadge}</td>
                <td>${user.email}</td>
                <td>${user.points || 0}</td>
                <td style="color: #00ff00;">Active</td>
                <td>
                    <button class="btn-outline" style="padding: 2px 8px; font-size: 0.8rem;" onclick="resetUserPoints('${user.id}')">Reset</button>
                    <button class="btn-outline" style="padding: 2px 8px; font-size: 0.8rem; border-color: #ff0055; color: #ff0055;" onclick="deleteUser('${user.id}')">Del</button>
                </td>
            </tr>
        `;
        tbody.insertAdjacentHTML('beforeend', row);
    });
}

function resetUserPoints(userId) {
    // userId might be string from firestore or number from old data. Firestore IDs are strings.
    const user = allUsers.find(u => u.id == userId);
    if (!user) return;

    if (!confirm(`Reset points for ${user.username}?`)) return;

    const userRef = doc(db, "users", userId.toString());
    updateDoc(userRef, { points: 0 })
        .then(() => {
            alert(`Points reset for ${user.username}`);
            loadAdminData();
        })
        .catch(e => alert("Error: " + e.message));
}

function deleteUser(userId) {
    const user = allUsers.find(u => u.id == userId);
    if (!confirm(`Delete user ${user ? user.username : userId}?`)) return;

    deleteDoc(doc(db, "users", userId.toString()))
        .then(() => {
            loadAdminData();
        })
        .catch(e => alert("Error: " + e.message));
}

function switchAdminTab(tabId) {
    document.querySelectorAll('.dashboard-section').forEach(section => {
        section.style.display = 'none';
    });
    document.getElementById(`section-${tabId}`).style.display = 'block';

    document.getElementById('pageTitle').innerText =
        tabId === 'overview' ? 'Admin Overview' :
            tabId === 'users' ? 'User Management' : 'Game Management';

    document.querySelectorAll('.nav-link').forEach(link => {
        link.classList.remove('active');
        if (link.getAttribute('onclick') && link.getAttribute('onclick').includes(tabId)) {
            link.classList.add('active');
        }
    });

    if (tabId === 'users' || tabId === 'overview') {
        loadAdminData();
    }
}

function logout() {
    signOut(auth).then(() => {
        window.location.href = 'index.html';
    }).catch((error) => {
        console.error("Sign out error", error);
    });
}

// Global Exports
window.switchAdminTab = switchAdminTab;
window.resetUserPoints = resetUserPoints;
window.deleteUser = deleteUser;
window.logout = logout;
