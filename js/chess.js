/*
====================================================================
   PLAYPOINTS - CHESS ARENA
   Full playable Chess vs AI (random legal moves)
   Points: +50 per captured piece, +200 for checkmate win
====================================================================
*/

const CHESS = (() => {
    // Piece codes: uppercase = white, lowercase = black
    // K=King Q=Queen R=Rook B=Bishop N=Knight P=Pawn
    const INIT_BOARD = [
        ['r','n','b','q','k','b','n','r'],
        ['p','p','p','p','p','p','p','p'],
        [null,null,null,null,null,null,null,null],
        [null,null,null,null,null,null,null,null],
        [null,null,null,null,null,null,null,null],
        [null,null,null,null,null,null,null,null],
        ['P','P','P','P','P','P','P','P'],
        ['R','N','B','Q','K','B','N','R']
    ];

    const PIECE_UNICODE = {
        'K':'♔','Q':'♕','R':'♖','B':'♗','N':'♘','P':'♙',
        'k':'♚','q':'♛','r':'♜','b':'♝','n':'♞','p':'♟'
    };

    const PIECE_VALUES = { 'p':1,'n':3,'b':3,'r':5,'q':9,'k':100 };

    let board, selected, turn, gameActive, scorePoints;
    let canvas, ctx, cellSize;
    let moveCount = 0;

    function deepCopy(b) { return b.map(r => [...r]); }
    function isWhite(p) { return p && p === p.toUpperCase(); }
    function isBlack(p) { return p && p === p.toLowerCase(); }
    function isEnemy(p, white) { return white ? isBlack(p) : isWhite(p); }
    function isEmpty(b, r, c) { return r>=0&&r<8&&c>=0&&c<8&&!b[r][c]; }
    function inBounds(r,c) { return r>=0&&r<8&&c>=0&&c<8; }

    function getLegalMoves(b, r, c) {
        const p = b[r][c];
        if (!p) return [];
        const white = isWhite(p);
        const moves = [];
        const type = p.toLowerCase();

        const slide = (dr, dc) => {
            let nr=r+dr, nc=c+dc;
            while(inBounds(nr,nc)) {
                if (!b[nr][nc]) { moves.push([nr,nc]); }
                else { if(isEnemy(b[nr][nc],white)) moves.push([nr,nc]); break; }
                nr+=dr; nc+=dc;
            }
        };

        if (type==='p') {
            const dir = white ? -1 : 1;
            const startRow = white ? 6 : 1;
            if (inBounds(r+dir,c) && !b[r+dir][c]) {
                moves.push([r+dir,c]);
                if (r===startRow && !b[r+2*dir][c]) moves.push([r+2*dir,c]);
            }
            [[r+dir,c-1],[r+dir,c+1]].forEach(([nr,nc])=>{
                if(inBounds(nr,nc) && isEnemy(b[nr][nc],white)) moves.push([nr,nc]);
            });
        } else if (type==='n') {
            [[-2,-1],[-2,1],[-1,-2],[-1,2],[1,-2],[1,2],[2,-1],[2,1]].forEach(([dr,dc])=>{
                const nr=r+dr,nc=c+dc;
                if(inBounds(nr,nc) && !(!isEnemy(b[nr][nc],white) && b[nr][nc])) moves.push([nr,nc]);
            });
        } else if (type==='b') {
            [[-1,-1],[-1,1],[1,-1],[1,1]].forEach(([dr,dc])=>slide(dr,dc));
        } else if (type==='r') {
            [[-1,0],[1,0],[0,-1],[0,1]].forEach(([dr,dc])=>slide(dr,dc));
        } else if (type==='q') {
            [[-1,-1],[-1,1],[1,-1],[1,1],[-1,0],[1,0],[0,-1],[0,1]].forEach(([dr,dc])=>slide(dr,dc));
        } else if (type==='k') {
            [[-1,-1],[-1,0],[-1,1],[0,-1],[0,1],[1,-1],[1,0],[1,1]].forEach(([dr,dc])=>{
                const nr=r+dr,nc=c+dc;
                if(inBounds(nr,nc) && !(b[nr][nc] && !isEnemy(b[nr][nc],white))) moves.push([nr,nc]);
            });
        }
        // Filter: own pieces
        return moves.filter(([nr,nc])=>!(b[nr][nc] && !isEnemy(b[nr][nc],white)));
    }

    function getAllMoves(b, white) {
        const all = [];
        for(let r=0;r<8;r++) for(let c=0;c<8;c++) {
            const p=b[r][c];
            if(p && (white?isWhite(p):isBlack(p))) {
                getLegalMoves(b,r,c).forEach(([nr,nc])=>all.push({fr:r,fc:c,tr:nr,tc:nc}));
            }
        }
        return all;
    }

    function aiMove() {
        if (!gameActive || turn !== 'black') return;
        const moves = getAllMoves(board, false);
        if (!moves.length) { endGame('You Win! No moves for AI.'); return; }

        // Prefer captures, else random
        const captures = moves.filter(m => board[m.tr][m.tc]);
        const chosen = captures.length ? captures[Math.floor(Math.random()*captures.length)]
                                       : moves[Math.floor(Math.random()*moves.length)];
        board[chosen.tr][chosen.tc] = board[chosen.fr][chosen.fc];
        board[chosen.fr][chosen.fc] = null;

        // Pawn promotion
        if (board[chosen.tr][chosen.tc]==='p' && chosen.tr===7) board[chosen.tr][chosen.tc]='q';

        turn = 'white';
        moveCount++;
        drawBoard();
        updateStatus();

        // Check if white king captured
        let whiteKing = false;
        for(let r=0;r<8;r++) for(let c=0;c<8;c++) if(board[r][c]==='K') whiteKing=true;
        if (!whiteKing) endGame('AI Wins! Your king was captured.');
    }

    function handleClick(e) {
        if (!gameActive || turn !== 'white') return;
        const rect = canvas.getBoundingClientRect();
        const scaleX = canvas.width / rect.width;
        const scaleY = canvas.height / rect.height;
        const x = (e.clientX - rect.left) * scaleX;
        const y = (e.clientY - rect.top) * scaleY;
        const col = Math.floor(x / cellSize);
        const row = Math.floor(y / cellSize);
        if (!inBounds(row,col)) return;

        if (selected) {
            const moves = getLegalMoves(board, selected[0], selected[1]);
            const valid = moves.find(([r,c])=>r===row&&c===col);
            if (valid) {
                const captured = board[row][col];
                if (captured) {
                    const val = PIECE_VALUES[captured.toLowerCase()] || 0;
                    scorePoints += val * 10;
                    updateScoreDisplay();
                }
                board[row][col] = board[selected[0]][selected[1]];
                board[selected[0]][selected[1]] = null;
                // Pawn promotion
                if (board[row][col]==='P' && row===0) board[row][col]='Q';
                selected = null;
                turn = 'black';
                moveCount++;
                drawBoard();
                updateStatus();

                // Check black king
                let blackKing = false;
                for(let r=0;r<8;r++) for(let c=0;c<8;c++) if(board[r][c]==='k') blackKing=true;
                if (!blackKing) { endGame('You Win! Checkmate!'); return; }

                setTimeout(aiMove, 400);
            } else {
                selected = isWhite(board[row][col]) ? [row,col] : null;
                drawBoard();
            }
        } else {
            if (board[row][col] && isWhite(board[row][col])) {
                selected = [row,col];
                drawBoard();
            }
        }
    }

    function drawBoard() {
        ctx.clearRect(0,0,canvas.width,canvas.height);
        for(let r=0;r<8;r++) {
            for(let c=0;c<8;c++) {
                const light = (r+c)%2===0;
                ctx.fillStyle = light ? '#c8a96e' : '#4a3728';
                ctx.fillRect(c*cellSize, r*cellSize, cellSize, cellSize);

                // Highlight selected
                if (selected && selected[0]===r && selected[1]===c) {
                    ctx.fillStyle = 'rgba(255,179,32,0.5)';
                    ctx.fillRect(c*cellSize, r*cellSize, cellSize, cellSize);
                }

                // Highlight legal moves
                if (selected) {
                    const moves = getLegalMoves(board, selected[0], selected[1]);
                    if (moves.find(([mr,mc])=>mr===r&&mc===c)) {
                        ctx.fillStyle = board[r][c] ? 'rgba(255,32,95,0.5)' : 'rgba(255,179,32,0.3)';
                        ctx.fillRect(c*cellSize, r*cellSize, cellSize, cellSize);
                    }
                }

                // Draw piece
                const piece = board[r][c];
                if (piece) {
                    ctx.font = `${cellSize*0.72}px serif`;
                    ctx.textAlign = 'center';
                    ctx.textBaseline = 'middle';
                    ctx.fillStyle = isWhite(piece) ? '#ffb320' : '#fff';
                    ctx.shadowColor = isWhite(piece) ? '#ffb320' : '#000';
                    ctx.shadowBlur = 4;
                    ctx.fillText(PIECE_UNICODE[piece], c*cellSize+cellSize/2, r*cellSize+cellSize/2+2);
                    ctx.shadowBlur = 0;
                }
            }
        }
        // Rank/file labels
        ctx.font = `${cellSize*0.22}px Roboto,sans-serif`;
        ctx.fillStyle = '#aaa';
        ctx.textAlign = 'left'; ctx.textBaseline = 'top';
        'abcdefgh'.split('').forEach((l,i)=>ctx.fillText(l, i*cellSize+2, 7*cellSize+cellSize-14));
        '87654321'.split('').forEach((l,i)=>ctx.fillText(l, 2, i*cellSize+2));
    }

    function updateStatus() {
        const el = document.getElementById('chessStatus');
        if (el) el.innerText = turn === 'white' ? "Your turn (White ♔)" : "AI thinking... (Black ♚)";
    }

    function updateScoreDisplay() {
        const el = document.getElementById('chessScore');
        if (el) el.innerText = scorePoints;
        const el2 = document.getElementById('chessReward');
        if (el2) el2.innerText = scorePoints + ' pts';
    }

    function endGame(msg) {
        gameActive = false;
        const overlay = document.getElementById('chessOverlay');
        const title = document.getElementById('chessOverlayTitle');
        const scoreEl = document.getElementById('chessOverlayScore');
        if (overlay) overlay.style.display = 'flex';
        if (title) title.innerText = msg;
        if (scoreEl) { scoreEl.innerText = `Points Earned: ${scorePoints}`; scoreEl.style.display='block'; }

        // Save to Firebase via dashboard.js callback
        if (typeof window.onGameEnd === 'function') {
            window.onGameEnd('Chess Arena', moveCount, scorePoints);
        }
    }

    function init() {
        canvas = document.getElementById('chessCanvas');
        if (!canvas) return;
        ctx = canvas.getContext('2d');
        cellSize = Math.floor(canvas.width / 8);
        board = deepCopy(INIT_BOARD);
        selected = null;
        turn = 'white';
        gameActive = true;
        scorePoints = 0;
        moveCount = 0;

        canvas.removeEventListener('click', handleClick);
        canvas.addEventListener('click', handleClick);

        const overlay = document.getElementById('chessOverlay');
        if (overlay) overlay.style.display = 'none';
        const scoreEl = document.getElementById('chessOverlayScore');
        if (scoreEl) scoreEl.style.display = 'none';

        updateScoreDisplay();
        updateStatus();
        drawBoard();
    }

    return { init };
})();

window.startChessGame = CHESS.init;
