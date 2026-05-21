/*
====================================================================
   PLAYPOINTS - TETRIS BLITZ
   Full playable Tetris with scoring
   Points: 10 per line, 30 for double, 60 for triple, 120 for tetris
====================================================================
*/

const TETRIS = (() => {
    const COLS = 10, ROWS = 20, BLOCK = 30;
    const COLORS = ['#ffb320','#ff205f','#40abf5','#4eae60','#694eae','#ff20ae','#fb6e10'];

    const SHAPES = [
        [[1,1,1,1]],                          // I
        [[1,1],[1,1]],                         // O
        [[0,1,0],[1,1,1]],                     // T
        [[1,0],[1,0],[1,1]],                   // L
        [[0,1],[0,1],[1,1]],                   // J
        [[0,1,1],[1,1,0]],                     // S
        [[1,1,0],[0,1,1]]                      // Z
    ];

    let canvas, ctx, nextCanvas, nextCtx;
    let board, currentPiece, nextPiece, gameLoop, gameActive;
    let score, lines, level, scorePoints;
    let dropInterval, lastTime = 0;

    function newPiece() {
        const idx = Math.floor(Math.random() * SHAPES.length);
        const shape = SHAPES[idx].map(r=>[...r]);
        return {
            shape, color: COLORS[idx],
            x: Math.floor(COLS/2) - Math.floor(shape[0].length/2),
            y: 0
        };
    }

    function rotate(shape) {
        return shape[0].map((_,i)=>shape.map(r=>r[i]).reverse());
    }

    function valid(b, piece, ox=0, oy=0, shape=null) {
        const s = shape || piece.shape;
        for(let r=0;r<s.length;r++) for(let c=0;c<s[r].length;c++) {
            if (!s[r][c]) continue;
            const nr=piece.y+r+oy, nc=piece.x+c+ox;
            if (nc<0||nc>=COLS||nr>=ROWS) return false;
            if (nr>=0 && b[nr][nc]) return false;
        }
        return true;
    }

    function place(b, piece) {
        piece.shape.forEach((row,r)=>row.forEach((v,c)=>{
            if(v) b[piece.y+r][piece.x+c] = piece.color;
        }));
    }

    function clearLines(b) {
        let cleared = 0;
        for(let r=ROWS-1;r>=0;r--) {
            if (b[r].every(c=>c)) {
                b.splice(r,1);
                b.unshift(new Array(COLS).fill(null));
                cleared++; r++;
            }
        }
        return cleared;
    }

    function draw() {
        // Board
        ctx.fillStyle = '#0b0c15';
        ctx.fillRect(0,0,canvas.width,canvas.height);

        // Grid lines
        ctx.strokeStyle = '#1a1a2e';
        ctx.lineWidth = 0.5;
        for(let r=0;r<=ROWS;r++) { ctx.beginPath(); ctx.moveTo(0,r*BLOCK); ctx.lineTo(COLS*BLOCK,r*BLOCK); ctx.stroke(); }
        for(let c=0;c<=COLS;c++) { ctx.beginPath(); ctx.moveTo(c*BLOCK,0); ctx.lineTo(c*BLOCK,ROWS*BLOCK); ctx.stroke(); }

        // Placed blocks
        board.forEach((row,r)=>row.forEach((color,c)=>{
            if(color) drawBlock(ctx, c*BLOCK, r*BLOCK, BLOCK, color);
        }));

        // Ghost piece
        if (currentPiece && gameActive) {
            let ghost = {...currentPiece, shape: currentPiece.shape.map(r=>[...r])};
            while(valid(board, ghost, 0, 1)) ghost.y++;
            ghost.shape.forEach((row,r)=>row.forEach((v,c)=>{
                if(v) {
                    ctx.strokeStyle = currentPiece.color;
                    ctx.lineWidth = 1;
                    ctx.strokeRect(ghost.x*BLOCK+c*BLOCK+1, ghost.y*BLOCK+r*BLOCK+1, BLOCK-2, BLOCK-2);
                }
            }));
        }

        // Current piece
        if (currentPiece) {
            currentPiece.shape.forEach((row,r)=>row.forEach((v,c)=>{
                if(v) drawBlock(ctx, (currentPiece.x+c)*BLOCK, (currentPiece.y+r)*BLOCK, BLOCK, currentPiece.color);
            }));
        }

        // Next piece preview
        if (nextCtx && nextPiece) {
            nextCtx.fillStyle = '#0b0c15';
            nextCtx.fillRect(0,0,nextCanvas.width,nextCanvas.height);
            const offX = Math.floor((4-nextPiece.shape[0].length)/2);
            const offY = Math.floor((4-nextPiece.shape.length)/2);
            nextPiece.shape.forEach((row,r)=>row.forEach((v,c)=>{
                if(v) drawBlock(nextCtx, (offX+c)*BLOCK, (offY+r)*BLOCK, BLOCK, nextPiece.color);
            }));
        }
    }

    function drawBlock(c, x, y, size, color) {
        c.fillStyle = color;
        c.fillRect(x+1, y+1, size-2, size-2);
        c.fillStyle = 'rgba(255,255,255,0.2)';
        c.fillRect(x+1, y+1, size-2, 4);
        c.fillStyle = 'rgba(0,0,0,0.2)';
        c.fillRect(x+1, y+size-5, size-2, 4);
    }

    function updateUI() {
        const s = document.getElementById('tetrisScore'); if(s) s.innerText = score;
        const l = document.getElementById('tetrisLines'); if(l) l.innerText = lines;
        const lv = document.getElementById('tetrisLevel'); if(lv) lv.innerText = level;
        const r = document.getElementById('tetrisReward'); if(r) r.innerText = scorePoints + ' pts';
    }

    function tick(time=0) {
        if (!gameActive) return;
        const delta = time - lastTime;
        lastTime = time;
        dropInterval -= delta;
        if (dropInterval <= 0) {
            dropInterval = Math.max(100, 800 - level * 70);
            if (valid(board, currentPiece, 0, 1)) {
                currentPiece.y++;
            } else {
                place(board, currentPiece);
                const cleared = clearLines(board);
                if (cleared) {
                    const pts = [0,10,30,60,120][cleared] || 120;
                    score += pts * level;
                    scorePoints += pts * level;
                    lines += cleared;
                    level = Math.floor(lines / 10) + 1;
                }
                updateUI();
                currentPiece = nextPiece;
                nextPiece = newPiece();
                if (!valid(board, currentPiece)) { endGame(); return; }
            }
        }
        draw();
        gameLoop = requestAnimationFrame(tick);
    }

    function endGame() {
        gameActive = false;
        cancelAnimationFrame(gameLoop);
        const overlay = document.getElementById('tetrisOverlay');
        const title = document.getElementById('tetrisOverlayTitle');
        const scoreEl = document.getElementById('tetrisOverlayScore');
        if (overlay) overlay.style.display = 'flex';
        if (title) title.innerText = 'Game Over!';
        if (scoreEl) { scoreEl.innerText = `Score: ${score} | Points: ${scorePoints}`; scoreEl.style.display='block'; }
        if (typeof window.onGameEnd === 'function') window.onGameEnd('Tetris Blitz', lines, scorePoints);
    }

    function handleKey(e) {
        if (!gameActive || !currentPiece) return;
        if ([37,38,39,40,32].includes(e.keyCode)) e.preventDefault();
        if (e.keyCode===37 && valid(board,currentPiece,-1)) currentPiece.x--;
        else if (e.keyCode===39 && valid(board,currentPiece,1)) currentPiece.x++;
        else if (e.keyCode===40 && valid(board,currentPiece,0,1)) { currentPiece.y++; dropInterval=Math.max(100,800-level*70); }
        else if (e.keyCode===38) { const r=rotate(currentPiece.shape); if(valid(board,currentPiece,0,0,r)) currentPiece.shape=r; }
        else if (e.keyCode===32) { while(valid(board,currentPiece,0,1)) currentPiece.y++; dropInterval=0; }
        draw();
    }

    function init() {
        canvas = document.getElementById('tetrisCanvas');
        nextCanvas = document.getElementById('tetrisNextCanvas');
        if (!canvas) return;
        ctx = canvas.getContext('2d');
        if (nextCanvas) nextCtx = nextCanvas.getContext('2d');

        board = Array.from({length:ROWS},()=>new Array(COLS).fill(null));
        score = 0; lines = 0; level = 1; scorePoints = 0;
        gameActive = true;
        dropInterval = 800;
        lastTime = 0;

        currentPiece = newPiece();
        nextPiece = newPiece();

        const overlay = document.getElementById('tetrisOverlay');
        if (overlay) overlay.style.display = 'none';
        const scoreEl = document.getElementById('tetrisOverlayScore');
        if (scoreEl) scoreEl.style.display = 'none';

        cancelAnimationFrame(gameLoop);
        window.removeEventListener('keydown', handleKey);
        window.addEventListener('keydown', handleKey);

        updateUI();
        gameLoop = requestAnimationFrame(tick);
    }

    return { init };
})();

window.startTetrisGame = TETRIS.init;
