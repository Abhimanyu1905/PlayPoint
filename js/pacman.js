/*
====================================================================
   PLAYPOINTS - PAC-MAN ARENA
   Full playable Pac-Man with ghosts, dots, power pellets
   Points: 1 per dot, 5 per power pellet, 20 per ghost eaten
====================================================================
*/

const PACMAN_GAME = (() => {
    const CELL = 20;
    // 0=path, 1=wall, 2=dot, 3=power pellet, 4=ghost house
    const MAP_TEMPLATE = [
        [1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1],
        [1,3,2,2,2,2,2,2,2,2,1,2,2,2,2,2,2,2,2,3,1],
        [1,2,1,1,2,1,1,1,2,1,1,1,2,1,1,1,2,1,1,2,1],
        [1,2,1,1,2,1,1,1,2,1,1,1,2,1,1,1,2,1,1,2,1],
        [1,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,1],
        [1,2,1,1,2,1,2,1,1,1,1,1,1,1,2,1,2,1,1,2,1],
        [1,2,2,2,2,1,2,2,2,2,1,2,2,2,2,1,2,2,2,2,1],
        [1,1,1,1,2,1,1,1,0,0,0,0,0,1,1,1,2,1,1,1,1],
        [1,1,1,1,2,1,0,4,4,4,4,4,4,4,0,1,2,1,1,1,1],
        [1,1,1,1,2,1,0,4,4,4,4,4,4,4,0,1,2,1,1,1,1],
        [0,0,0,0,2,0,0,4,4,4,4,4,4,4,0,0,2,0,0,0,0],
        [1,1,1,1,2,1,0,4,4,4,4,4,4,4,0,1,2,1,1,1,1],
        [1,1,1,1,2,1,0,0,0,0,0,0,0,0,0,1,2,1,1,1,1],
        [1,1,1,1,2,1,0,1,1,1,1,1,1,1,0,1,2,1,1,1,1],
        [1,2,2,2,2,2,2,2,2,2,1,2,2,2,2,2,2,2,2,2,1],
        [1,2,1,1,2,1,1,1,2,1,1,1,2,1,1,1,2,1,1,2,1],
        [1,3,2,1,2,2,2,2,2,2,0,2,2,2,2,2,2,1,2,3,1],
        [1,1,2,1,2,1,2,1,1,1,1,1,1,1,2,1,2,1,2,1,1],
        [1,2,2,2,2,1,2,2,2,2,1,2,2,2,2,1,2,2,2,2,1],
        [1,2,1,1,1,1,1,1,2,1,1,1,2,1,1,1,1,1,1,2,1],
        [1,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,1],
        [1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1]
    ];

    const ROWS = MAP_TEMPLATE.length, COLS = MAP_TEMPLATE[0].length;
    const GHOST_COLORS = ['#ff205f','#40abf5','#ff20ae','#fb6e10'];
    const DIRS = [{x:0,y:-1},{x:0,y:1},{x:-1,y:0},{x:1,y:0}];

    let canvas, ctx, map, pac, ghosts, gameActive, animFrame;
    let score, scorePoints, lives, frightTimer, totalDots;

    function copyMap() { return MAP_TEMPLATE.map(r=>[...r]); }

    function countDots(m) {
        let n=0;
        m.forEach(r=>r.forEach(c=>{ if(c===2||c===3) n++; }));
        return n;
    }

    function initGhosts() {
        return GHOST_COLORS.map((color,i)=>({
            x:9+i%2, y:9+Math.floor(i/2),
            dx:0, dy:0, color,
            frightened:false, eaten:false,
            timer: i*30
        }));
    }

    function canMove(m, x, y) {
        if(x<0||x>=COLS||y<0||y>=ROWS) return false;
        return m[y][x]!==1;
    }

    function moveGhost(g) {
        if (g.timer > 0) { g.timer--; return; }
        // Try to continue or pick random valid direction
        const possible = DIRS.filter(d=>canMove(map,g.x+d.x,g.y+d.y));
        if (!possible.length) return;

        if (g.frightened) {
            const d = possible[Math.floor(Math.random()*possible.length)];
            g.dx=d.x; g.dy=d.y;
        } else {
            // Chase pac loosely
            const chase = possible.sort((a,b)=>{
                const da=Math.abs((g.x+a.x)-pac.x)+Math.abs((g.y+a.y)-pac.y);
                const db=Math.abs((g.x+b.x)-pac.x)+Math.abs((g.y+b.y)-pac.y);
                return Math.random()<0.4 ? 0 : da-db;
            });
            g.dx=chase[0].x; g.dy=chase[0].y;
        }
        g.x+=g.dx; g.y+=g.dy;
    }

    function drawPac(angle) {
        const cx = pac.x*CELL+CELL/2, cy = pac.y*CELL+CELL/2, r=CELL/2-2;
        ctx.beginPath();
        ctx.moveTo(cx,cy);
        ctx.arc(cx,cy,r, angle*Math.PI/180, (360-angle)*Math.PI/180);
        ctx.closePath();
        ctx.fillStyle='#ffb320';
        ctx.shadowColor='#ffb320'; ctx.shadowBlur=8;
        ctx.fill();
        ctx.shadowBlur=0;
        // Eye
        ctx.beginPath();
        ctx.arc(cx+3, cy-5, 2, 0, Math.PI*2);
        ctx.fillStyle='#131313';
        ctx.fill();
    }

    function drawGhost(g) {
        const cx=g.x*CELL+CELL/2, cy=g.y*CELL+CELL/2, r=CELL/2-2;
        ctx.fillStyle = g.frightened ? '#694eae' : g.color;
        ctx.shadowColor = g.frightened ? '#694eae' : g.color;
        ctx.shadowBlur = 6;
        ctx.beginPath();
        ctx.arc(cx,cy-2,r,Math.PI,0);
        ctx.lineTo(cx+r,cy+r);
        for(let i=0;i<3;i++) {
            ctx.quadraticCurveTo(cx+r-(i*2+1)*r/3,cy+r+4,cx+r-(i*2+2)*r/3,cy+r);
        }
        ctx.lineTo(cx-r,cy+r);
        ctx.closePath();
        ctx.fill();
        ctx.shadowBlur=0;
        // Eyes
        if (!g.frightened) {
            ctx.fillStyle='#fff';
            ctx.beginPath(); ctx.arc(cx-4,cy-2,3,0,Math.PI*2); ctx.fill();
            ctx.beginPath(); ctx.arc(cx+4,cy-2,3,0,Math.PI*2); ctx.fill();
            ctx.fillStyle='#00f';
            ctx.beginPath(); ctx.arc(cx-3,cy-2,1.5,0,Math.PI*2); ctx.fill();
            ctx.beginPath(); ctx.arc(cx+5,cy-2,1.5,0,Math.PI*2); ctx.fill();
        }
    }

    let mouthAngle=30, mouthDir=1, frameCount=0;

    function gameFrame() {
        if (!gameActive) return;
        frameCount++;

        // Move pac every 4 frames
        if (frameCount%4===0) {
            const nx=pac.x+pac.dx, ny=pac.y+pac.dy;
            if (canMove(map,nx,ny)) { pac.x=nx; pac.y=ny; }

            // Eat dot/pellet
            const cell=map[pac.y][pac.x];
            if (cell===2) { map[pac.y][pac.x]=0; score+=1; scorePoints+=1; totalDots--; }
            else if (cell===3) {
                map[pac.y][pac.x]=0; score+=5; scorePoints+=5; totalDots--;
                frightTimer=150;
                ghosts.forEach(g=>{ g.frightened=true; g.eaten=false; });
            }
            updateUI();
            if (totalDots<=0) { endGame(true); return; }
        }

        // Fright timer
        if (frightTimer>0) { frightTimer--; if(frightTimer===0) ghosts.forEach(g=>g.frightened=false); }

        // Move ghosts every 6 frames
        if (frameCount%6===0) ghosts.forEach(moveGhost);

        // Collision
        ghosts.forEach(g=>{
            if (Math.abs(g.x-pac.x)<=1 && Math.abs(g.y-pac.y)<=1) {
                if (g.frightened && !g.eaten) {
                    g.eaten=true; g.frightened=false;
                    score+=20; scorePoints+=20;
                    g.x=10; g.y=9; g.timer=60;
                    updateUI();
                } else if (!g.frightened && !g.eaten) {
                    lives--;
                    updateLives();
                    if (lives<=0) { endGame(false); return; }
                    pac.x=10; pac.y=16; pac.dx=0; pac.dy=0;
                    ghosts=initGhosts();
                }
            }
        });

        // Mouth animation
        mouthAngle+=5*mouthDir;
        if(mouthAngle>=35||mouthAngle<=5) mouthDir*=-1;

        // Draw
        ctx.fillStyle='#000010';
        ctx.fillRect(0,0,canvas.width,canvas.height);

        // Draw map
        for(let r=0;r<ROWS;r++) for(let c=0;c<COLS;c++) {
            const cell=map[r][c];
            if(cell===1) {
                ctx.fillStyle='#1a1aff';
                ctx.fillRect(c*CELL,r*CELL,CELL,CELL);
                ctx.strokeStyle='#0000aa';
                ctx.strokeRect(c*CELL+1,r*CELL+1,CELL-2,CELL-2);
            } else if(cell===2) {
                ctx.fillStyle='#ffb320';
                ctx.beginPath();
                ctx.arc(c*CELL+CELL/2,r*CELL+CELL/2,2.5,0,Math.PI*2);
                ctx.fill();
            } else if(cell===3) {
                ctx.fillStyle='#ffb320';
                ctx.shadowColor='#ffb320'; ctx.shadowBlur=8;
                ctx.beginPath();
                ctx.arc(c*CELL+CELL/2,r*CELL+CELL/2,6,0,Math.PI*2);
                ctx.fill();
                ctx.shadowBlur=0;
            }
        }

        ghosts.forEach(drawGhost);
        drawPac(mouthAngle);

        animFrame = requestAnimationFrame(gameFrame);
    }

    function updateUI() {
        const s=document.getElementById('pacScore'); if(s) s.innerText=score;
        const r=document.getElementById('pacReward'); if(r) r.innerText=scorePoints+' pts';
    }

    function updateLives() {
        const l=document.getElementById('pacLives'); if(l) l.innerText='❤'.repeat(lives);
    }

    function endGame(won) {
        gameActive=false;
        cancelAnimationFrame(animFrame);
        const overlay=document.getElementById('pacOverlay');
        const title=document.getElementById('pacOverlayTitle');
        const scoreEl=document.getElementById('pacOverlayScore');
        if(overlay) overlay.style.display='flex';
        if(title) title.innerText = won ? 'You Win! Board Cleared!' : 'Game Over!';
        if(scoreEl) { scoreEl.innerText=`Score: ${score} | Points: ${scorePoints}`; scoreEl.style.display='block'; }
        if(typeof window.onGameEnd==='function') window.onGameEnd('Pac-Man Arena', score, scorePoints);
    }

    function handleKey(e) {
        if(!gameActive) return;
        if([37,38,39,40].includes(e.keyCode)) e.preventDefault();
        if(e.keyCode===37) { pac.dx=-1; pac.dy=0; }
        else if(e.keyCode===39) { pac.dx=1; pac.dy=0; }
        else if(e.keyCode===38) { pac.dx=0; pac.dy=-1; }
        else if(e.keyCode===40) { pac.dx=0; pac.dy=1; }
    }

    function init() {
        canvas=document.getElementById('pacCanvas');
        if(!canvas) return;
        ctx=canvas.getContext('2d');
        canvas.width=COLS*CELL; canvas.height=ROWS*CELL;

        map=copyMap();
        totalDots=countDots(map);
        pac={x:10,y:16,dx:0,dy:0};
        ghosts=initGhosts();
        score=0; scorePoints=0; lives=3; frightTimer=0;
        gameActive=true; frameCount=0; mouthAngle=30; mouthDir=1;

        const overlay=document.getElementById('pacOverlay');
        if(overlay) overlay.style.display='none';
        const scoreEl=document.getElementById('pacOverlayScore');
        if(scoreEl) scoreEl.style.display='none';

        cancelAnimationFrame(animFrame);
        window.removeEventListener('keydown',handleKey);
        window.addEventListener('keydown',handleKey);

        updateUI(); updateLives();
        animFrame=requestAnimationFrame(gameFrame);
    }

    return { init };
})();

window.startPacmanGame = PACMAN_GAME.init;
