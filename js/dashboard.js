/* 
====================================================================
   PLAYPOINTS - DASHBOARD LOGIC
   - Real-time leaderboard with avatars
   - Profile picture upload to Firebase Storage
   - Live stats (points, rank, level)
====================================================================
*/

import { auth, db, storage } from './firebase-config.js';
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
    onSnapshot,
    getCountFromServer
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";
import {
    ref,
    uploadBytesResumable,
    getDownloadURL
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-storage.js";

let currentUserData = null;
let currentUserUid = null;

/* ============================================================
   RANK SYSTEM (consistent across the whole app)
   ============================================================ */
function getRankInfo(points) {
    if (points >= 10000) return { name: 'Legend',   color: '#ff205f',  icon: '★' };
    if (points >= 5000)  return { name: 'Diamond',  color: '#694eae',  icon: '◆' };
    if (points >= 2000)  return { name: 'Gold',     color: '#ffb320',  icon: '⬡' };
    if (points >= 500)   return { name: 'Silver',   color: '#aaaaaa',  icon: '⬡' };
    return                      { name: 'Bronze',   color: '#cd7f32',  icon: '⬡' };
}

/* ============================================================
   AVATAR HELPERS
   ============================================================ */
function setAvatarEl(el, photoURL, username) {
    if (!el) return;
    if (photoURL) {
        el.style.backgroundImage = `url('${photoURL}')`;
        el.style.backgroundSize = 'cover';
        el.style.backgroundPosition = 'center';
        el.innerText = '';
    } else {
        el.style.backgroundImage = '';
        el.innerText = (username || 'U').charAt(0).toUpperCase();
    }
}

function makeAvatarHTML(photoURL, username, size = 36) {
    if (photoURL) {
        return `<img src="${photoURL}" alt="${username}" style="width:${size}px;height:${size}px;border-radius:50%;object-fit:cover;border:2px solid #ffb320;">`;
    }
    const initial = (username || '?').charAt(0).toUpperCase();
    return `<div style="width:${size}px;height:${size}px;border-radius:50%;background:#ffb320;color:#131313;display:inline-flex;align-items:center;justify-content:center;font-weight:700;font-size:${Math.floor(size*0.45)}px;border:2px solid #ffb320;">${initial}</div>`;
}

/* ============================================================
   AUTH + INIT
   ============================================================ */
document.addEventListener('DOMContentLoaded', () => {
    onAuthStateChanged(auth, async (user) => {
        if (user) {
            currentUserUid = user.uid;
            const docRef = doc(db, "users", user.uid);
            const docSnap = await getDoc(docRef);
            if (docSnap.exists()) {
                currentUserData = docSnap.data();
                loadDashboardData();
                setupAvatarUpload();
                window.startSnakeGame = startSnakeGame;
                window.logout = logout;
                window.switchTab = switchTab;
                window.onGameEnd = handleGameEnd;
            } else {
                console.error("No user data found!");
            }
        } else {
            window.location.href = 'index.html';
        }
    });
});

/* ============================================================
   LOAD DASHBOARD DATA
   ============================================================ */
function loadDashboardData() {
    const points = currentUserData.points || 0;
    const rank = getRankInfo(points);
    const level = Math.floor(points / 1000) + 1;

    // Sidebar
    document.getElementById('userNameDisplay').innerText = currentUserData.username;
    setAvatarEl(document.getElementById('userAvatar'), currentUserData.photoURL, currentUserData.username);
    const rankEl = document.getElementById('userRank');
    if (rankEl) { rankEl.innerText = rank.name; rankEl.style.color = rank.color; }

    // Header welcome
    const welcomeEl = document.getElementById('welcomeName');
    if (welcomeEl) welcomeEl.innerText = currentUserData.username;

    // Points badge
    const pointsEl = document.getElementById('userPoints');
    if (pointsEl) pointsEl.innerText = points.toLocaleString();

    // Metric cards
    const totalGamesEl = document.getElementById('totalGames');
    if (totalGamesEl) totalGamesEl.innerText = currentUserData.gamesPlayed || 0;
    const levelEl = document.getElementById('userLevel');
    if (levelEl) levelEl.innerText = level;

    // Next rank card
    const nextRankEl = document.getElementById('nextRankName');
    const nextRankPtsEl = document.getElementById('nextRankPts');
    const nextRankMap = [
        { threshold: 500,   name: 'Silver',  color: '#aaaaaa' },
        { threshold: 2000,  name: 'Gold',    color: '#ffb320' },
        { threshold: 5000,  name: 'Diamond', color: '#694eae' },
        { threshold: 10000, name: 'Legend',  color: '#ff205f' },
    ];
    const next = nextRankMap.find(r => points < r.threshold);
    if (nextRankEl && next) { nextRankEl.innerText = next.name; nextRankEl.style.color = next.color; }
    else if (nextRankEl) { nextRankEl.innerText = 'MAX'; nextRankEl.style.color = '#ff205f'; }
    if (nextRankPtsEl && next) nextRankPtsEl.innerText = `${(next.threshold - points).toLocaleString()} pts to go`;
    else if (nextRankPtsEl) nextRankPtsEl.innerText = 'You are at the top!';

    updateActivityTable();
    renderPointsChart();
    loadLeaderboard();
}

/* ============================================================
   PROFILE PICTURE UPLOAD
   ============================================================ */
function setupAvatarUpload() {
    const input = document.getElementById('avatarFileInput');
    if (!input) return;

    input.addEventListener('change', async (e) => {
        const file = e.target.files[0];
        if (!file) return;

        // Validate: image, max 5MB
        if (!file.type.startsWith('image/')) { showToast('Please select an image file.', 'error'); return; }
        if (file.size > 5 * 1024 * 1024) { showToast('Image must be under 5MB.', 'error'); return; }

        const progressWrap = document.getElementById('avatarUploadProgress');
        const progressFill = document.getElementById('avatarProgressFill');
        if (progressWrap) progressWrap.style.display = 'block';

        try {
            const storageRef = ref(storage, `avatars/${currentUserUid}`);
            const uploadTask = uploadBytesResumable(storageRef, file);

            uploadTask.on('state_changed',
                (snapshot) => {
                    const pct = Math.round((snapshot.bytesTransferred / snapshot.totalBytes) * 100);
                    if (progressFill) progressFill.style.width = pct + '%';
                },
                (error) => {
                    console.error('Upload error:', error);
                    showToast('Upload failed: ' + error.message, 'error');
                    if (progressWrap) progressWrap.style.display = 'none';
                },
                async () => {
                    const downloadURL = await getDownloadURL(uploadTask.snapshot.ref);

                    // Save to Firestore
                    await updateDoc(doc(db, "users", currentUserUid), { photoURL: downloadURL });
                    currentUserData.photoURL = downloadURL;

                    // Update avatar in UI
                    setAvatarEl(document.getElementById('userAvatar'), downloadURL, currentUserData.username);

                    if (progressWrap) progressWrap.style.display = 'none';
                    showToast('Profile picture updated!', 'success');

                    // Reset input so same file can be re-selected
                    input.value = '';
                }
            );
        } catch (err) {
            console.error(err);
            showToast('Upload error: ' + err.message, 'error');
            if (progressWrap) progressWrap.style.display = 'none';
        }
    });
}

/* ============================================================
   LEADERBOARD — real-time with avatars + rank titles
   ============================================================ */
let leaderboardUnsubscribe = null;

function loadLeaderboard() {
    if (leaderboardUnsubscribe) return;

    const tableBody = document.querySelector('#leaderboardTable tbody');
    if (!tableBody) return;

    try {
        const usersRef = collection(db, "users");
        const q = query(usersRef, orderBy("points", "desc"), limit(25));

        leaderboardUnsubscribe = onSnapshot(q, (querySnapshot) => {
            tableBody.innerHTML = '';

            const users = [];
            querySnapshot.forEach((d) => users.push({ id: d.id, ...d.data() }));

            const validUsers = users.filter(u => u.role !== 'admin').slice(0, 15);

            if (validUsers.length === 0) {
                tableBody.innerHTML = '<tr><td colspan="5" style="text-align:center;color:#888;">No players yet. Be the first!</td></tr>';
                return;
            }

            validUsers.forEach((user, index) => {
                const pos = index + 1;
                let rankBadge;
                if (pos === 1) rankBadge = `<div class="rank-badge rank-1">1</div>`;
                else if (pos === 2) rankBadge = `<div class="rank-badge rank-2">2</div>`;
                else if (pos === 3) rankBadge = `<div class="rank-badge rank-3">3</div>`;
                else rankBadge = `<span style="color:#878787;font-weight:700;">${pos}</span>`;

                const level = Math.floor((user.points || 0) / 1000) + 1;
                const rankInfo = getRankInfo(user.points || 0);
                const isCurrentUser = user.id === currentUserUid;
                const avatarHTML = makeAvatarHTML(user.photoURL, user.username, 36);

                const row = `
                    <tr class="${isCurrentUser ? 'highlight-row' : ''}">
                        <td style="text-align:center;">${rankBadge}</td>
                        <td>
                            <div style="display:flex;align-items:center;gap:10px;">
                                ${avatarHTML}
                                <span>${user.username}${isCurrentUser ? ' <span style="color:#ffb320;font-size:11px;">(You)</span>' : ''}</span>
                            </div>
                        </td>
                        <td><span style="color:${rankInfo.color};font-weight:700;">${rankInfo.name}</span></td>
                        <td>${level}</td>
                        <td style="color:#ffb320;font-weight:700;">${(user.points || 0).toLocaleString()}</td>
                    </tr>
                `;
                tableBody.insertAdjacentHTML('beforeend', row);
            });
        }, (error) => {
            console.error("Leaderboard error:", error);
        });
    } catch (e) {
        console.error("Leaderboard setup error:", e);
    }
}

/* ============================================================
   POINTS CHART
   ============================================================ */
function renderPointsChart() {
    const container = document.getElementById('pointsChartContainer');
    if (!container) return;
    const currentPoints = currentUserData.points || 0;
    const data = [0.5,0.6,0.55,0.75,0.85,0.95,1].map(x => Math.floor(x * currentPoints));
    const labels = ['6d ago','5d ago','4d ago','3d ago','2d ago','Yesterday','Today'];
    const max = Math.max(...data, 100) * 1.2;
    const width = container.offsetWidth || 600;
    const height = 230;
    const stepX = width / (data.length - 1);

    let polyPoints = '';
    let areaPoints = `0,${height} `;
    data.forEach((val, i) => {
        const x = i * stepX;
        const y = height - ((val / max) * height);
        polyPoints += `${x},${y} `;
        areaPoints += `${x},${y} `;
    });
    areaPoints += `${(data.length-1)*stepX},${height}`;

    const dots = data.map((val, i) => {
        const x = i * stepX;
        const y = height - ((val / max) * height);
        return `<circle cx="${x}" cy="${y}" r="5" fill="#ffb320" stroke="#131313" stroke-width="2"/>
                <title>${labels[i]}: ${val.toLocaleString()} pts</title>`;
    }).join('');

    container.innerHTML = `
        <svg width="100%" height="${height+30}" viewBox="0 0 ${width} ${height+30}" preserveAspectRatio="none">
            <defs>
                <linearGradient id="chartGrad" x1="0%" y1="0%" x2="0%" y2="100%">
                    <stop offset="0%" style="stop-color:#ffb320;stop-opacity:0.4"/>
                    <stop offset="100%" style="stop-color:#ffb320;stop-opacity:0"/>
                </linearGradient>
            </defs>
            <polygon points="${areaPoints}" fill="url(#chartGrad)"/>
            <polyline points="${polyPoints}" fill="none" stroke="#ffb320" stroke-width="2.5"/>
            ${dots}
            ${labels.map((l,i)=>`<text x="${i*stepX}" y="${height+20}" text-anchor="middle" font-size="10" fill="#878787">${l}</text>`).join('')}
        </svg>`;
}

/* ============================================================
   ACTIVITY TABLE
   ============================================================ */
async function updateActivityTable() {
    const tableBody = document.getElementById('activityTable');
    if (!tableBody) return;
    tableBody.innerHTML = '';

    try {
        const gamesRef = collection(db, "game_history");
        const q = query(gamesRef, where("userId", "==", currentUserUid));
        const querySnapshot = await getDocs(q);

        const games = [];
        querySnapshot.forEach((d) => games.push(d.data()));
        games.sort((a, b) => getJsDate(b.playedAt) - getJsDate(a.playedAt));
        const recent = games.slice(0, 8);

        if (recent.length === 0) {
            tableBody.innerHTML = '<tr><td colspan="4" style="text-align:center;color:#888;">No games played yet. Head to the Games tab!</td></tr>';
            return;
        }

        recent.forEach(game => {
            const row = `
                <tr>
                    <td>${game.game}</td>
                    <td>${Number(game.score).toLocaleString()}</td>
                    <td>${getRelativeTime(game.playedAt)}</td>
                    <td style="color:#ffb320;font-weight:700;">+${game.points}</td>
                </tr>`;
            tableBody.insertAdjacentHTML('beforeend', row);
        });
    } catch (e) {
        console.error("Activity load error:", e);
    }
}

function getJsDate(ts) {
    if (!ts) return 0;
    if (ts.toDate) return ts.toDate();
    return new Date(ts);
}

function getRelativeTime(ts) {
    if (!ts) return 'Just now';
    const diff = Date.now() - getJsDate(ts);
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return 'Just now';
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h ago`;
    return getJsDate(ts).toLocaleDateString();
}

/* ============================================================
   TAB SWITCHING
   ============================================================ */
function switchTab(tabId) {
    document.querySelectorAll('.dashboard-section').forEach(s => s.style.display = 'none');
    const section = document.getElementById(`section-${tabId}`);
    if (section) section.style.display = 'block';

    document.querySelectorAll('.dashboard-menu li a').forEach(a => {
        a.classList.remove('active');
        if (a.getAttribute('onclick') && a.getAttribute('onclick').includes(tabId)) a.classList.add('active');
    });

    const titles = { overview: 'Dashboard', games: 'Game Arena', leaderboard: 'Global Leaderboard' };
    const titleEl = document.getElementById('pageTitle');
    if (titleEl) titleEl.innerText = titles[tabId] || 'Dashboard';
}

/* ============================================================
   SHARED GAME END HANDLER
   ============================================================ */
async function handleGameEnd(gameName, scoreVal, pointsEarned) {
    if (pointsEarned <= 0 || !currentUserUid) {
        showToast('Game Over! Try again to earn points.', 'info');
        return;
    }
    try {
        const userRef = doc(db, "users", currentUserUid);
        const docSnap = await getDoc(userRef);
        if (docSnap.exists()) {
            const userData = docSnap.data();
            const newPoints = (userData.points || 0) + pointsEarned;
            const newGamesPlayed = (userData.gamesPlayed || 0) + 1;
            await updateDoc(userRef, { points: newPoints, gamesPlayed: newGamesPlayed });
            currentUserData.points = newPoints;
            currentUserData.gamesPlayed = newGamesPlayed;

            // Update all UI elements
            const pointsEl = document.getElementById('userPoints');
            if (pointsEl) pointsEl.innerText = newPoints.toLocaleString();
            const totalGamesEl = document.getElementById('totalGames');
            if (totalGamesEl) totalGamesEl.innerText = newGamesPlayed;
            const level = Math.floor(newPoints / 1000) + 1;
            const levelEl = document.getElementById('userLevel');
            if (levelEl) levelEl.innerText = level;

            const rankInfo = getRankInfo(newPoints);
            const rankEl = document.getElementById('userRank');
            if (rankEl) { rankEl.innerText = rankInfo.name; rankEl.style.color = rankInfo.color; }
        }

        try {
            await addDoc(collection(db, "game_history"), {
                userId: currentUserUid,
                game: gameName,
                score: scoreVal,
                points: pointsEarned,
                playedAt: serverTimestamp()
            });
        } catch (e) { console.error("History save error:", e); }

        updateActivityTable();
        showToast(`+${pointsEarned} PlayPoints earned!`, 'success');
    } catch (e) {
        console.error("Score update error:", e);
        showToast('Error saving score: ' + e.message, 'error');
    }
}

/* ============================================================
   SNAKE GAME LOGIC
   ============================================================ */
let canvas, ctx;
let snake = [], food = {}, direction = 'RIGHT';
let gameInterval, gameRunning = false, score = 0;
const boxSize = 20;

function startSnakeGame() {
    canvas = document.getElementById('snakeCanvas');
    ctx = canvas.getContext('2d');
    snake = [{ x: 10 * boxSize, y: 10 * boxSize }];
    direction = 'RIGHT';
    score = 0;
    gameRunning = true;
    document.getElementById('currentScore').innerText = '0';
    const rewardEl = document.getElementById('currentPointsReward');
    if (rewardEl) rewardEl.innerText = '0 pts';
    document.getElementById('gameOverlay').style.display = 'none';
    generateFood();
    if (gameInterval) clearInterval(gameInterval);
    gameInterval = setInterval(gameLoop, 100);
    window.addEventListener('keydown', changeDirection);
}

function changeDirection(e) {
    if (!gameRunning) return;
    if ([37,38,39,40].includes(e.keyCode)) e.preventDefault();
    if (e.keyCode===37 && direction!=='RIGHT') direction='LEFT';
    else if (e.keyCode===38 && direction!=='DOWN') direction='UP';
    else if (e.keyCode===39 && direction!=='LEFT') direction='RIGHT';
    else if (e.keyCode===40 && direction!=='UP') direction='DOWN';
}

function gameLoop() {
    let hx = snake[0].x, hy = snake[0].y;
    if (direction==='LEFT') hx -= boxSize;
    if (direction==='UP') hy -= boxSize;
    if (direction==='RIGHT') hx += boxSize;
    if (direction==='DOWN') hy += boxSize;
    if (hx<0||hx>=canvas.width||hy<0||hy>=canvas.height) { snakeGameOver(); return; }
    for (let i=0;i<snake.length;i++) if (hx===snake[i].x&&hy===snake[i].y) { snakeGameOver(); return; }
    if (hx===food.x&&hy===food.y) {
        score += 10;
        document.getElementById('currentScore').innerText = score;
        const r = document.getElementById('currentPointsReward');
        if (r) r.innerText = `${score} pts`;
        generateFood();
    } else { snake.pop(); }
    snake.unshift({ x: hx, y: hy });
    drawSnake();
}

function drawSnake() {
    ctx.fillStyle = '#0f0f0f';
    ctx.fillRect(0,0,canvas.width,canvas.height);
    ctx.fillStyle = '#ff205f';
    ctx.shadowBlur = 15; ctx.shadowColor = '#ff205f';
    ctx.fillRect(food.x, food.y, boxSize, boxSize);
    ctx.shadowBlur = 0;
    snake.forEach((seg, i) => {
        ctx.fillStyle = i===0 ? '#ffb320' : '#cc8f1a';
        ctx.shadowBlur = i===0 ? 15 : 0; ctx.shadowColor = '#ffb320';
        ctx.fillRect(seg.x, seg.y, boxSize, boxSize);
        ctx.strokeStyle = '#131313';
        ctx.strokeRect(seg.x, seg.y, boxSize, boxSize);
    });
    ctx.shadowBlur = 0;
}

function generateFood() {
    food = {
        x: Math.floor(Math.random()*(canvas.width/boxSize))*boxSize,
        y: Math.floor(Math.random()*(canvas.height/boxSize))*boxSize
    };
    for (let p of snake) if (p.x===food.x&&p.y===food.y) generateFood();
}

async function snakeGameOver() {
    clearInterval(gameInterval);
    gameRunning = false;
    document.getElementById('overlayTitle').innerText = 'Game Over';
    document.getElementById('overlayScore').innerText = `Final Score: ${score}`;
    document.getElementById('overlayScore').style.display = 'block';
    document.getElementById('gameOverlay').style.display = 'flex';
    await handleGameEnd('Neon Snake', score, score);
}

/* ============================================================
   LOGOUT
   ============================================================ */
function logout() {
    signOut(auth).then(() => { window.location.href = 'index.html'; })
                 .catch(e => console.error("Sign out error", e));
}

/* ============================================================
   TOAST
   ============================================================ */
function showToast(msg, type = 'info') {
    const toast = document.getElementById('toast');
    const toastMsg = document.getElementById('toastMsg');
    if (toast && toastMsg) {
        toastMsg.innerText = msg;
        toast.style.borderColor = type === 'error' ? '#ff205f' : '#ffb320';
        toast.classList.add('show');
        setTimeout(() => toast.classList.remove('show'), 3500);
    }
}

function setupEventListeners() {}

// Global scope
window.switchTab = switchTab;
window.startSnakeGame = startSnakeGame;
window.logout = logout;
window.onGameEnd = handleGameEnd;
