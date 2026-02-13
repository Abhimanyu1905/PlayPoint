/* 
====================================================================
   PLAYPOINTS - DASHBOARD LOGIC
====================================================================
*/

import { auth, db } from './firebase-config.js';
import {
    onAuthStateChanged,
    signOut
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import {
    doc,
    getDoc,
    updateDoc,
    collection,
    query,
    orderBy,
    limit,
    getDocs,
    addDoc,
    serverTimestamp,
    where,
    onSnapshot
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

let currentUserData = null;
let currentUserUid = null;

document.addEventListener('DOMContentLoaded', () => {
    // Auth Check
    onAuthStateChanged(auth, async (user) => {
        if (user) {
            currentUserUid = user.uid;
            // Load User Data
            const docRef = doc(db, "users", user.uid);
            const docSnap = await getDoc(docRef);

            if (docSnap.exists()) {
                currentUserData = docSnap.data();
                loadDashboardData();
                setupEventListeners();

                // Initialize Snake Game Global
                window.startSnakeGame = startSnakeGame;
                window.logout = logout;
                window.switchTab = switchTab;
            } else {
                console.error("No user data found!");
                // Handle missing data or redirect
            }
        } else {
            window.location.href = 'index.html';
        }
    });
});


function loadDashboardData() {
    // User Info
    document.getElementById('userNameDisplay').innerText = currentUserData.username;
    document.getElementById('welcomeName').innerText = currentUserData.username;
    document.getElementById('userAvatar').innerText = currentUserData.username.charAt(0).toUpperCase();

    // Stats
    document.getElementById('userPoints').innerText = (currentUserData.points || 0).toLocaleString();
    document.getElementById('totalGames').innerText = currentUserData.gamesPlayed || 0;

    // Load History
    updateActivityTable();
    renderPointsChart(); // Keep mock or implement sub-collection for history
    loadLeaderboard();
}

let leaderboardUnsubscribe = null;

function loadLeaderboard() {
    // Prevent multiple listeners
    if (leaderboardUnsubscribe) {
        return;
    }

    const tableBody = document.querySelector('#leaderboardTable tbody');
    if (!tableBody) return;

    try {
        const usersRef = collection(db, "users");
        const q = query(usersRef, orderBy("points", "desc"), limit(20)); // Increased limit to ensure we get enough users after filtering

        leaderboardUnsubscribe = onSnapshot(q, (querySnapshot) => {
            tableBody.innerHTML = ''; // Clear existing

            const users = [];
            querySnapshot.forEach((doc) => {
                users.push(doc.data());
            });

            // Filter: Users only see other Users (Hide Admins)
            const validUsers = users.filter(u => u.role !== 'admin').slice(0, 10);

            if (validUsers.length === 0) {
                tableBody.innerHTML = '<tr><td colspan="4" style="text-align:center; color: #888;">No players yet. Be the first!</td></tr>';
                return;
            }

            validUsers.forEach((user, index) => {
                const rank = index + 1;
                let rankBadge = rank;

                if (rank === 1) rankBadge = `<div class="rank-badge rank-1">1</div>`;
                else if (rank === 2) rankBadge = `<div class="rank-badge rank-2">2</div>`;
                else if (rank === 3) rankBadge = `<div class="rank-badge rank-3">3</div>`;

                const level = Math.floor((user.points || 0) / 1000) + 1;
                const isCurrentUser = user.email === currentUserData.email;

                const row = `
                    <tr class="${isCurrentUser ? 'highlight-row' : ''}">
                        <td>${rankBadge}</td>
                        <td>${user.username} ${isCurrentUser ? '(You)' : ''}</td>
                        <td>${level}</td>
                        <td class="text-gradient">${(user.points || 0).toLocaleString()}</td>
                    </tr>
                `;
                tableBody.insertAdjacentHTML('beforeend', row);
            });
        }, (error) => {
            console.error("Error getting leaderboard updates: ", error);
        });

    } catch (e) {
        console.error("Error setting up leaderboard listener: ", e);
    }
}

function renderPointsChart() {
    const container = document.getElementById('pointsChartContainer');
    // Mock Data for visualization as we don't store historical points snapshots in this simple schema
    const currentPoints = currentUserData.points || 0;
    const data = [
        currentPoints * 0.5,
        currentPoints * 0.6,
        currentPoints * 0.55,
        currentPoints * 0.75,
        currentPoints * 0.85,
        currentPoints * 0.95,
        currentPoints
    ].map(x => Math.floor(x));

    const max = Math.max(...data, 100) * 1.2;
    const width = container.offsetWidth;
    const height = 250;

    // Generate SVG points
    let points = '';
    const stepX = width / (data.length - 1);

    data.forEach((val, index) => {
        const x = index * stepX;
        const y = height - ((val / max) * height);
        points += `${x},${y} `;
    });

    // Create SVG string
    const svgHTML = `
        <svg width="100%" height="100%" viewBox="0 0 ${width} ${height}" preserveAspectRatio="none">
            <defs>
                <linearGradient id="grad" x1="0%" y1="0%" x2="0%" y2="100%">
                    <stop offset="0%" style="stop-color:var(--primary);stop-opacity:0.5" />
                    <stop offset="100%" style="stop-color:var(--primary);stop-opacity:0" />
                </linearGradient>
            </defs>
            <polyline points="${points}" fill="url(#grad)" stroke="var(--primary)" stroke-width="3"/>
            <circle cx="${(data.length - 1) * stepX}" cy="${height - ((data[data.length - 1] / max) * height)}" r="6" fill="#fff" stroke="var(--primary)" stroke-width="2" />
        </svg>
    `;

    container.innerHTML = svgHTML;
}

async function updateActivityTable() {
    const tableBody = document.getElementById('activityTable');
    if (!tableBody) return;
    tableBody.innerHTML = '';

    // Fetch recent games
    try {
        const gamesRef = collection(db, "game_history");
        // Using client-side filter and sort to avoid complex index requirements for now
        // Ideally: orderBy("playedAt", "desc") with composite index
        const q = query(gamesRef, where("userId", "==", currentUserUid));
        const querySnapshot = await getDocs(q);

        const games = [];
        querySnapshot.forEach((doc) => {
            games.push(doc.data());
        });

        // Client-side Sort
        games.sort((a, b) => {
            const dateA = getJsDate(a.playedAt);
            const dateB = getJsDate(b.playedAt);
            return dateB - dateA; // Descending
        });

        const recentGames = games.slice(0, 5);

        recentGames.forEach(game => {
            const dateStr = getRelativeTime(game.playedAt);

            const row = `
                <tr>
                    <td>${game.game}</td>
                    <td>${Number(game.score).toLocaleString()}</td>
                    <td>${dateStr}</td>
                    <td class="text-gradient">+${game.points}</td>
                </tr>
            `;
            tableBody.insertAdjacentHTML('beforeend', row);
        });

    } catch (e) {
        console.error("Error loading activity:", e);
    }
}

function getJsDate(timestamp) {
    if (!timestamp) return 0;
    if (timestamp.toDate) return timestamp.toDate(); // Firestore Timestamp
    return new Date(timestamp); // Date string or number
}

function getRelativeTime(timestamp) {
    if (!timestamp) return 'Just now';
    const date = getJsDate(timestamp);
    const now = new Date();
    const diff = now - date;

    // Simple relative time
    const minutes = Math.floor(diff / 60000);
    if (minutes < 1) return 'Just now';
    if (minutes < 60) return `${minutes} mins ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours} hours ago`;
    return date.toLocaleDateString();
}

/* --- Actions --- */

function switchTab(tabId) {
    // Hide all sections
    document.querySelectorAll('.dashboard-section').forEach(section => {
        section.style.display = 'none';
    });

    // Show selected
    document.getElementById(`section-${tabId}`).style.display = 'block';

    // Update Sidebar Active State
    document.querySelectorAll('.nav-link').forEach(link => {
        link.classList.remove('active');
        if (link.getAttribute('onclick') && link.getAttribute('onclick').includes(tabId)) {
            link.classList.add('active');
        }
    });

    // Update Title
    const titles = {
        'overview': 'Dashboard',
        'games': 'Available Games',
        'leaderboard': 'Global Leaderboard'
    };
    document.getElementById('pageTitle').innerText = titles[tabId];
}

/* --- Snake Game Logic --- */

let canvas, ctx;
let snake = [];
let food = {};
let direction = 'RIGHT';
let gameInterval;
let gameRunning = false;
let score = 0;
const boxSize = 20;

function startSnakeGame() {
    canvas = document.getElementById('snakeCanvas');
    ctx = canvas.getContext('2d');

    // Reset Game State
    snake = [{ x: 10 * boxSize, y: 10 * boxSize }];
    direction = 'RIGHT';
    score = 0;
    gameRunning = true;

    document.getElementById('currentScore').innerText = '0';
    document.getElementById('gameOverlay').style.display = 'none';

    generateFood();

    if (gameInterval) clearInterval(gameInterval);
    gameInterval = setInterval(gameLoop, 100);

    // Focus for keyboard events
    window.addEventListener('keydown', changeDirection);
}

function changeDirection(event) {
    if (!gameRunning) return;

    const key = event.keyCode;
    // Prevent default scrolling for arrow keys
    if ([37, 38, 39, 40].indexOf(key) > -1) {
        event.preventDefault();
    }

    if (key === 37 && direction !== 'RIGHT') direction = 'LEFT';
    else if (key === 38 && direction !== 'DOWN') direction = 'UP';
    else if (key === 39 && direction !== 'LEFT') direction = 'RIGHT';
    else if (key === 40 && direction !== 'UP') direction = 'DOWN';
}

function gameLoop() {
    // Move Snake
    let headX = snake[0].x;
    let headY = snake[0].y;

    if (direction === 'LEFT') headX -= boxSize;
    if (direction === 'UP') headY -= boxSize;
    if (direction === 'RIGHT') headX += boxSize;
    if (direction === 'DOWN') headY += boxSize;

    // Check Collision (Walls)
    if (headX < 0 || headX >= canvas.width || headY < 0 || headY >= canvas.height) {
        gameOver();
        return;
    }

    // Check Collision (Self)
    for (let i = 0; i < snake.length; i++) {
        if (headX === snake[i].x && headY === snake[i].y) {
            gameOver();
            return;
        }
    }

    // Check Food
    if (headX === food.x && headY === food.y) {
        score += 10;
        document.getElementById('currentScore').innerText = score;
        generateFood();
    } else {
        snake.pop(); // Remove tail
    }

    const newHead = { x: headX, y: headY };
    snake.unshift(newHead);

    drawGame();
}

function drawGame() {
    // Clear Canvas
    ctx.fillStyle = '#0b0c15'; // Background
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Draw Food
    ctx.fillStyle = '#ff0055'; // Neon Pink Apple
    ctx.shadowBlur = 10;
    ctx.shadowColor = '#ff0055';
    ctx.fillRect(food.x, food.y, boxSize, boxSize);
    ctx.shadowBlur = 0;

    // Draw Snake
    for (let i = 0; i < snake.length; i++) {
        ctx.fillStyle = i === 0 ? '#00f3ff' : '#bc13fe'; // Head: Cyan, Body: Purple
        ctx.shadowBlur = i === 0 ? 15 : 0;
        ctx.shadowColor = '#00f3ff';
        ctx.fillRect(snake[i].x, snake[i].y, boxSize, boxSize);

        ctx.strokeStyle = '#000';
        ctx.strokeRect(snake[i].x, snake[i].y, boxSize, boxSize);
    }
}

function generateFood() {
    food = {
        x: Math.floor(Math.random() * (canvas.width / boxSize)) * boxSize,
        y: Math.floor(Math.random() * (canvas.height / boxSize)) * boxSize
    };

    // Ensure food doesn't spawn on snake
    for (let part of snake) {
        if (part.x === food.x && part.y === food.y) {
            generateFood();
        }
    }
}

async function gameOver() {
    clearInterval(gameInterval);
    gameRunning = false;

    // Update Overlay
    document.getElementById('overlayTitle').innerText = 'Game Over';
    document.getElementById('overlayScore').innerText = `Final Score: ${score}`;
    document.getElementById('overlayScore').style.display = 'block';
    document.getElementById('gameOverlay').style.display = 'flex';

    // Calculate Reward Points (1 point per 1 score)
    const pointsEarned = score;

    if (pointsEarned > 0 && currentUserUid) {
        try {
            const userRef = doc(db, "users", currentUserUid);
            // We fetch fresh data from user doc first to ensure we have latest points? 
            // We already have currentUserData in memory but it might be stale if other tabs open.
            // But updateDoc merges, so we are safe on other fields.
            // Problem: points is additive. We need to increment.
            // Firestore has increment() function for atomic updates!
            // But let's stick to simple read-modify-write as we have currentUserData for now or just fetch.

            // Re-fetch strictly to be safe for atomic-like update
            const docSnap = await getDoc(userRef);
            if (docSnap.exists()) {
                const userData = docSnap.data();
                const newPoints = (userData.points || 0) + pointsEarned;
                const newGamesPlayed = (userData.gamesPlayed || 0) + 1;

                await updateDoc(userRef, {
                    points: newPoints,
                    gamesPlayed: newGamesPlayed
                });

                // Update Local Data
                currentUserData.points = newPoints;
                currentUserData.gamesPlayed = newGamesPlayed;

                // Update Dashboard UI
                document.getElementById('userPoints').innerText = newPoints.toLocaleString();
                document.getElementById('totalGames').innerText = newGamesPlayed;
            }

            // Log History
            try {
                await addDoc(collection(db, "game_history"), {
                    userId: currentUserUid,
                    game: "Neon Snake",
                    score: score,
                    points: pointsEarned,
                    playedAt: serverTimestamp()
                });
            } catch (historyError) {
                console.error("Error saving history:", historyError);
                // Don't fail the whole flow if history fails
            }

            // Update Activity Table UI
            updateActivityTable(); // Refresh table from DB (or append manually for instant feedback)

            showToast(`Game Over! You earned ${pointsEarned} PlayPoints!`, 'success');

        } catch (e) {
            console.error("Error updating score:", e);
            showToast('Error saving score: ' + e.message, 'error');
        }

    } else {
        showToast('Game Over! Try again to earn points.', 'info');
    }
}

function logout() {
    signOut(auth).then(() => {
        window.location.href = 'index.html';
    }).catch((error) => {
        console.error("Sign out error", error);
    });
}

function setupEventListeners() {
    // Add any specific listeners here
}

/* --- Utils --- */
function showToast(msg, type = 'info') {
    const toast = document.getElementById('toast');
    const toastMsg = document.getElementById('toastMsg');

    if (toast && toastMsg) {
        toastMsg.innerText = msg;
        toast.style.borderColor = type === 'error' ? '#ff0055' : 'var(--primary)';
        toast.classList.add('show');

        setTimeout(() => {
            toast.classList.remove('show');
        }, 3000);
    }
}

// Global scope specifics for HTML onclick attributes
window.switchTab = switchTab;
window.startSnakeGame = startSnakeGame;
window.logout = logout;
