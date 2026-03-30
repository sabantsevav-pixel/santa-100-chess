// ============================================================
// FIREBASE CONFIGURATION
// ============================================================

const firebaseConfig = {
    apiKey: "AIzaSyAZDT9WWgYQQTXvGvIaZoVs8jnU4Hyg8sg",
    authDomain: "santa-100-chess.firebaseapp.com",
    databaseURL: "https://santa-100-chess-default-rtdb.firebaseio.com",
    projectId: "santa-100-chess",
    storageBucket: "santa-100-chess.firebasestorage.app",
    messagingSenderId: "198977328644",
    appId: "1:198977328644:web:3e7f80891a14fca7354751"
};

firebase.initializeApp(firebaseConfig);
const db = firebase.database();

// ============================================================
// PIECE IMAGES
// ============================================================

const PIECE_SET = 'pieces/cburnett';

function pieceHTML(type, color) {
    const prefix = color === 'white' ? 'w' : 'b';
    return `<img class="piece-img" src="${PIECE_SET}/${prefix}${type}.svg" alt="${color} ${type}" draggable="false">`;
}

// ============================================================
// GAME CONSTANTS
// ============================================================

const BOARD_SIZE = 10;
const FILES = ['a','b','c','d','e','f','g','h','i','j'];
const EMPTY = null;
const KING = 'K', QUEEN = 'Q', ROOK = 'R', BISHOP = 'B', KNIGHT = 'N', MUSKETEER = 'M', PAWN = 'P';
const WHITE = 'white', BLACK = 'black';

// ============================================================
// GAME STATE
// ============================================================

let board = [];
let currentTurn = WHITE;
let selectedSquare = null;
let validMoves = [];
let moveHistory = [];
let stateHistory = [];
let lastMove = null;
let kingMoved = { white: false, black: false };
let rookMoved = { white: { a: false, j: false }, black: { a: false, j: false } };
let enPassantTarget = null;
let pendingPromotion = null;

// ============================================================
// MULTIPLAYER STATE
// ============================================================

let gameMode = 'local';
let roomCode = null;
let playerColor = null;
let gameRef = null;
let gameListener = null;
let playerId = generatePlayerId();
let moveCounter = 0;          // Increments with each move
let lastSyncedMove = -1;      // Last move counter we processed from Firebase
let isSyncing = false;         // Prevents re-entrant updates
let gameOver = false;          // Prevents further moves after game ends

function generatePlayerId() {
    return 'player_' + Math.random().toString(36).substr(2, 9);
}

function generateRoomCode() {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let code = '';
    for (let i = 0; i < 6; i++) code += chars[Math.floor(Math.random() * chars.length)];
    return code;
}

// ============================================================
// BOARD INITIALIZATION
// ============================================================

function createStartingBoard() {
    let b = [];
    for (let r = 0; r < BOARD_SIZE; r++) {
        b[r] = [];
        for (let c = 0; c < BOARD_SIZE; c++) b[r][c] = EMPTY;
    }
    const backRank = [ROOK, KNIGHT, BISHOP, MUSKETEER, QUEEN, KING, MUSKETEER, BISHOP, KNIGHT, ROOK];
    for (let c = 0; c < 10; c++) {
        b[9][c] = { type: backRank[c], color: WHITE };
        b[8][c] = { type: PAWN, color: WHITE, hasMoved: false };
        b[0][c] = { type: backRank[c], color: BLACK };
        b[1][c] = { type: PAWN, color: BLACK, hasMoved: false };
    }
    return b;
}

function initGameState() {
    board = createStartingBoard();
    currentTurn = WHITE;
    selectedSquare = null;
    validMoves = [];
    moveHistory = [];
    stateHistory = [];
    lastMove = null;
    kingMoved = { white: false, black: false };
    rookMoved = { white: { a: false, j: false }, black: { a: false, j: false } };
    enPassantTarget = null;
    pendingPromotion = null;
    moveCounter = 0;
    lastSyncedMove = -1;
    isSyncing = false;
    gameOver = false;
}

// ============================================================
// SERIALIZATION (for Firebase)
// ============================================================

function serializeBoard(b) {
    let s = [];
    for (let r = 0; r < BOARD_SIZE; r++) {
        s[r] = [];
        for (let c = 0; c < BOARD_SIZE; c++) {
            if (b[r][c] === EMPTY) {
                s[r][c] = 0;  // Use 0 instead of null for Firebase
            } else {
                s[r][c] = {
                    t: b[r][c].type,
                    c: b[r][c].color === WHITE ? 'w' : 'b',
                    m: b[r][c].hasMoved || false
                };
            }
        }
    }
    return s;
}

function deserializeBoard(s) {
    let b = [];
    for (let r = 0; r < BOARD_SIZE; r++) {
        b[r] = [];
        for (let c = 0; c < BOARD_SIZE; c++) {
            if (!s[r][c] || s[r][c] === 0) {
                b[r][c] = EMPTY;
            } else {
                b[r][c] = {
                    type: s[r][c].t,
                    color: s[r][c].c === 'w' ? WHITE : BLACK,
                    hasMoved: s[r][c].m || false
                };
            }
        }
    }
    return b;
}

function serializeGameState() {
    return {
        board: serializeBoard(board),
        currentTurn,
        kingMoved,
        rookMoved,
        enPassantTarget: enPassantTarget || null,
        lastMove: lastMove || null,
        moveHistory: moveHistory || [],
        moveCounter: moveCounter,
        lastMoveBy: playerColor,
        gameOverMessage: null
    };
}

function applyGameState(data) {
    board = deserializeBoard(data.board);
    currentTurn = data.currentTurn;
    kingMoved = data.kingMoved;
    rookMoved = data.rookMoved;
    enPassantTarget = data.enPassantTarget || null;
    lastMove = data.lastMove || null;
    moveHistory = data.moveHistory || [];
    moveCounter = data.moveCounter || 0;
    selectedSquare = null;
    validMoves = [];
    pendingPromotion = null;
}

// ============================================================
// RENDERING
// ============================================================

function renderBoard() {
    const boardEl = document.getElementById('board');
    boardEl.innerHTML = '';

    const flipped = (gameMode === 'online' && playerColor === BLACK);

    for (let ri = 0; ri < BOARD_SIZE; ri++) {
        for (let ci = 0; ci < BOARD_SIZE; ci++) {
            const r = flipped ? (BOARD_SIZE - 1 - ri) : ri;
            const c = flipped ? (BOARD_SIZE - 1 - ci) : ci;

            const sq = document.createElement('div');
            sq.classList.add('square', (r + c) % 2 === 0 ? 'light' : 'dark');

            if (lastMove) {
                if (lastMove.from.r === r && lastMove.from.c === c) sq.classList.add('last-move-from');
                if (lastMove.to.r === r && lastMove.to.c === c) sq.classList.add('last-move-to');
            }
            if (selectedSquare && selectedSquare.r === r && selectedSquare.c === c) sq.classList.add('selected');

            const vm = validMoves.find(m => m.r === r && m.c === c);
            if (vm) sq.classList.add(board[r][c] !== EMPTY || vm.enPassant ? 'valid-capture' : 'valid-move');

            if (board[r][c]) sq.innerHTML = pieceHTML(board[r][c].type, board[r][c].color);

            sq.addEventListener('click', () => onSquareClick(r, c));
            boardEl.appendChild(sq);
        }
    }

    const rankLabels = document.getElementById('rank-labels');
    rankLabels.innerHTML = '';
    for (let ri = 0; ri < BOARD_SIZE; ri++) {
        const r = flipped ? ri : (BOARD_SIZE - 1 - ri);
        const d = document.createElement('div');
        d.textContent = r + 1;
        rankLabels.appendChild(d);
    }

    const fileLabels = document.getElementById('file-labels');
    fileLabels.innerHTML = '';
    for (let ci = 0; ci < BOARD_SIZE; ci++) {
        const c = flipped ? (BOARD_SIZE - 1 - ci) : ci;
        const d = document.createElement('div');
        d.textContent = FILES[c];
        fileLabels.appendChild(d);
    }
}

function updateTurnIndicator() {
    const el = document.getElementById('turn-indicator');
    el.textContent = currentTurn === WHITE ? "White's turn" : "Black's turn";

    if (gameMode === 'online') {
        if (currentTurn === playerColor) {
            el.textContent += ' (Your turn)';
        } else {
            el.textContent += ' (Waiting...)';
        }
    }
}

function updateMoveHistory() {
    const el = document.getElementById('move-history');
    let html = '';
    for (let i = 0; i < moveHistory.length; i += 2) {
        html += `${Math.floor(i/2)+1}. ${moveHistory[i]}`;
        if (i+1 < moveHistory.length) html += `  ${moveHistory[i+1]}`;
        html += '&nbsp;&nbsp;&nbsp;';
    }
    el.innerHTML = html;
    el.parentElement.scrollTop = el.parentElement.scrollHeight;
}
// ============================================================
// LOBBY & MULTIPLAYER
// ============================================================

function showLobby() {
    document.getElementById('lobby').classList.remove('hidden');
    document.getElementById('game-screen').classList.add('hidden');
    document.getElementById('waiting-area').classList.add('hidden');
    document.getElementById('game-over-modal').classList.remove('active');
    document.getElementById('draw-modal').classList.remove('active');
    document.getElementById('lobby-status').textContent = '';
    if (gameRef) {
        gameRef.off();
        gameRef = null;
    }
    gameListener = null;
}

function showGameScreen() {
    document.getElementById('lobby').classList.add('hidden');
    document.getElementById('game-screen').classList.remove('hidden');
}

function startLocalGame() {
    gameMode = 'local';
    playerColor = null;
    roomCode = null;
    initGameState();
    showGameScreen();
    document.getElementById('player-color-label').textContent = 'Local Game';
    document.getElementById('room-code-small').textContent = '';
    document.getElementById('connection-status').textContent = '';
    renderBoard();
    updateTurnIndicator();
    updateMoveHistory();
}

function createGame() {
    roomCode = generateRoomCode();
    gameMode = 'online';
    playerColor = WHITE;

    document.getElementById('waiting-area').classList.remove('hidden');
    document.getElementById('room-code-big').textContent = roomCode;
    document.getElementById('lobby-status').textContent = '';

    gameRef = db.ref('games/' + roomCode);
    initGameState();

    const gameData = {
        status: 'waiting',
        white: playerId,
        black: null,
        gameState: serializeGameState(),
        drawOffer: null,
        resign: null,
        createdAt: firebase.database.ServerValue.TIMESTAMP
    };

    gameRef.set(gameData).then(() => {
        listenForOpponent();
    }).catch(err => {
        document.getElementById('lobby-status').textContent = 'Error: ' + err.message;
    });
}

function listenForOpponent() {
    gameRef.child('black').on('value', (snapshot) => {
        const blackPlayer = snapshot.val();
        if (blackPlayer) {
            gameRef.child('black').off();
            gameRef.child('status').set('playing');
            startOnlineGame();
        }
    });
}

function joinGame() {
    const code = document.getElementById('join-code').value.trim().toUpperCase();
    if (code.length !== 6) {
        document.getElementById('lobby-status').textContent = 'Please enter a 6-character room code.';
        return;
    }

    roomCode = code;
    gameMode = 'online';
    playerColor = BLACK;
    gameRef = db.ref('games/' + roomCode);

    gameRef.once('value').then((snapshot) => {
        const data = snapshot.val();
        if (!data) {
            document.getElementById('lobby-status').textContent = 'Game not found.';
            return;
        }
        if (data.status !== 'waiting') {
            document.getElementById('lobby-status').textContent = 'Game already started or finished.';
            return;
        }
        gameRef.child('black').set(playerId).then(() => {
            // Load the initial game state
            if (data.gameState) {
                applyGameState(data.gameState);
                lastSyncedMove = data.gameState.moveCounter || 0;
            }
            startOnlineGame();
        });
    }).catch(err => {
        document.getElementById('lobby-status').textContent = 'Error: ' + err.message;
    });
}

function startOnlineGame() {
    document.getElementById('waiting-area').classList.add('hidden');
    showGameScreen();

    document.getElementById('player-color-label').textContent =
        `You are: ${playerColor === WHITE ? '⬜ White' : '⬛ Black'}`;
    document.getElementById('room-code-small').textContent = `Room: ${roomCode}`;
    updateConnectionStatus(true);

    renderBoard();
    updateTurnIndicator();
    updateMoveHistory();

    listenForGameUpdates();
}

function listenForGameUpdates() {
    if (gameListener) {
        gameRef.off('value', gameListener);
    }

    gameListener = gameRef.on('value', (snapshot) => {
        const data = snapshot.val();
        if (!data) return;

        // Don't process while we're syncing our own move
        if (isSyncing) return;

        // Handle resignation
        if (data.resign) {
            const winner = data.resign === WHITE ? BLACK : WHITE;
            gameOver = true;
            showGameOver(`${winner === WHITE ? 'White' : 'Black'} wins — opponent resigned!`);
            return;
        }

        // Handle draw agreement
        if (data.status === 'draw') {
            gameOver = true;
            showGameOver('Game drawn by agreement!');
            return;
        }

        // Handle draw offer (show modal only if it's from the opponent)
        if (data.drawOffer && data.drawOffer !== playerColor) {
            document.getElementById('draw-modal').classList.add('active');
        }

        // Handle game over message from the other player
        if (data.gameState && data.gameState.gameOverMessage) {
            gameOver = true;
            applyGameState(data.gameState);
            renderBoard();
            updateTurnIndicator();
            updateMoveHistory();
            showGameOver(data.gameState.gameOverMessage);
            return;
        }

        // Handle game state updates (opponent's moves)
        if (data.gameState) {
            const remoteMoveCounter = data.gameState.moveCounter || 0;
            const lastMoveBy = data.gameState.lastMoveBy;

            // Only apply if this is a NEW move made by the OPPONENT
            if (remoteMoveCounter > lastSyncedMove && lastMoveBy !== playerColor) {
                lastSyncedMove = remoteMoveCounter;
                applyGameState(data.gameState);
                renderBoard();
                updateTurnIndicator();
                updateMoveHistory();
            }
        }
    });

    // Connection status
    db.ref('.info/connected').on('value', (snap) => {
        updateConnectionStatus(snap.val() === true);
    });
}

function syncGameToFirebase() {
    if (gameMode !== 'online' || !gameRef) return;

    isSyncing = true;
    const state = serializeGameState();

    gameRef.child('gameState').set(state).then(() => {
        lastSyncedMove = moveCounter;
        isSyncing = false;
    }).catch(err => {
        console.error('Sync error:', err);
        isSyncing = false;
    });
}

function syncGameOverToFirebase(message) {
    if (gameMode !== 'online' || !gameRef) return;

    isSyncing = true;
    const state = serializeGameState();
    state.gameOverMessage = message;

    gameRef.child('gameState').set(state).then(() => {
        lastSyncedMove = moveCounter;
        isSyncing = false;
    }).catch(err => {
        console.error('Sync error:', err);
        isSyncing = false;
    });
}

function cancelGame() {
    if (gameRef) {
        gameRef.off();
        gameRef.remove();
        gameRef = null;
    }
    showLobby();
}

function backToLobby() {
    if (gameRef) {
        gameRef.off();
        gameRef = null;
    }
    gameListener = null;
    document.getElementById('game-over-modal').classList.remove('active');
    showLobby();
}

function copyRoomCode() {
    navigator.clipboard.writeText(roomCode).then(() => {
        document.getElementById('lobby-status').textContent = 'Code copied!';
        setTimeout(() => {
            document.getElementById('lobby-status').textContent = '';
        }, 2000);
    });
}

function updateConnectionStatus(connected) {
    const el = document.getElementById('connection-status');
    if (connected) {
        el.textContent = '● Connected';
        el.className = 'connected';
    } else {
        el.textContent = '● Disconnected';
        el.className = 'disconnected';
    }
}

function offerDraw() {
    if (gameOver) return;
    if (gameMode === 'local') {
        showGameOver('Game drawn by agreement!');
        return;
    }
    if (gameMode === 'online' && gameRef) {
        if (currentTurn !== playerColor) {
            alert("You can only offer a draw on your turn.");
            return;
        }
        gameRef.child('drawOffer').set(playerColor);
    }
}

function respondDraw(accepted) {
    document.getElementById('draw-modal').classList.remove('active');
    if (!gameRef) return;

    if (accepted) {
        gameRef.child('status').set('draw');
    } else {
        gameRef.child('drawOffer').set(null);
    }
}

function resignGame() {
    if (gameOver) return;
    if (gameMode === 'local') {
        showGameOver(`${currentTurn === WHITE ? 'Black' : 'White'} wins — opponent resigned!`);
        return;
    }
    if (gameMode === 'online' && gameRef) {
        if (confirm('Are you sure you want to resign?')) {
            gameRef.child('resign').set(playerColor);
        }
    }
}

// ============================================================
// CLICK HANDLER
// ============================================================

function onSquareClick(r, c) {
    if (pendingPromotion) return;
    if (gameOver) return;

    // In online mode, only allow moves on your turn
    if (gameMode === 'online' && currentTurn !== playerColor) return;

    const piece = board[r][c];

    if (selectedSquare) {
        const vm = validMoves.find(m => m.r === r && m.c === c);
        if (vm) {
            executeMove(selectedSquare.r, selectedSquare.c, r, c, vm);
            selectedSquare = null;
            validMoves = [];
            renderBoard();
            return;
        }
        if (piece && piece.color === currentTurn) {
            selectedSquare = { r, c };
            validMoves = getValidMoves(r, c);
            renderBoard();
            return;
        }
        selectedSquare = null;
        validMoves = [];
        renderBoard();
        return;
    }

    if (piece && piece.color === currentTurn) {
        selectedSquare = { r, c };
        validMoves = getValidMoves(r, c);
        renderBoard();
    }
}

// ============================================================
// MOVE GENERATION
// ============================================================

function getValidMoves(r, c) {
    const piece = board[r][c];
    if (!piece) return [];
    let moves = [];
    switch (piece.type) {
        case PAWN:      moves = getPawnMoves(r, c, piece.color); break;
        case KNIGHT:    moves = getKnightMoves(r, c, piece.color); break;
        case BISHOP:    moves = getSlidingMoves(r, c, piece.color, [[-1,-1],[-1,1],[1,-1],[1,1]]); break;
        case ROOK:      moves = getSlidingMoves(r, c, piece.color, [[-1,0],[1,0],[0,-1],[0,1]]); break;
        case QUEEN:     moves = getSlidingMoves(r, c, piece.color, [[-1,-1],[-1,1],[1,-1],[1,1],[-1,0],[1,0],[0,-1],[0,1]]); break;
        case KING:      moves = getKingMoves(r, c, piece.color); break;
        case MUSKETEER: moves = getMusketeerMoves(r, c, piece.color); break;
    }
    return moves.filter(m => !wouldBeInCheck(r, c, m.r, m.c, piece.color, m));
}

function inBounds(r, c) {
    return r >= 0 && r < BOARD_SIZE && c >= 0 && c < BOARD_SIZE;
}

function getSlidingMoves(r, c, color, directions) {
    let moves = [];
    for (const [dr, dc] of directions) {
        let nr = r + dr, nc = c + dc;
        while (inBounds(nr, nc)) {
            if (board[nr][nc] === EMPTY) {
                moves.push({ r: nr, c: nc });
            } else {
                if (board[nr][nc].color !== color) moves.push({ r: nr, c: nc });
                break;
            }
            nr += dr; nc += dc;
        }
    }
    return moves;
}

function getMusketeerMoves(r, c, color) {
    let moves = [];
    const dirs = [[-1,-1],[-1,0],[-1,1],[0,-1],[0,1],[1,-1],[1,0],[1,1]];
    for (const [dr, dc] of dirs) {
        for (let step = 1; step <= 2; step++) {
            const nr = r + dr * step, nc = c + dc * step;
            if (!inBounds(nr, nc)) break;
            if (board[nr][nc] === EMPTY) {
                moves.push({ r: nr, c: nc });
            } else {
                if (board[nr][nc].color !== color) moves.push({ r: nr, c: nc });
                break;
            }
        }
    }
    return moves;
}

function getKnightMoves(r, c, color) {
    let moves = [];
    const offsets = [
        [-2,-1],[-2,1],[-1,-2],[-1,2],[1,-2],[1,2],[2,-1],[2,1],
        [-3,-1],[-3,1],[-1,-3],[-1,3],[1,-3],[1,3],[3,-1],[3,1]
    ];
    for (const [dr, dc] of offsets) {
        const nr = r + dr, nc = c + dc;
        if (inBounds(nr, nc) && (board[nr][nc] === EMPTY || board[nr][nc].color !== color)) {
            moves.push({ r: nr, c: nc });
        }
    }
    return moves;
}

function getPawnMoves(r, c, color) {
    let moves = [];
    const dir = color === WHITE ? -1 : 1;
    const startRow = color === WHITE ? 8 : 1;

    if (inBounds(r + dir, c) && board[r + dir][c] === EMPTY) {
        moves.push({ r: r + dir, c });
        if (r === startRow && board[r + 2 * dir][c] === EMPTY) {
            moves.push({ r: r + 2 * dir, c });
            if (inBounds(r + 3 * dir, c) && board[r + 3 * dir][c] === EMPTY) {
                moves.push({ r: r + 3 * dir, c });
            }
        }
    }

    for (const dc of [-1, 1]) {
        const nr = r + dir, nc = c + dc;
        if (inBounds(nr, nc) && board[nr][nc] !== EMPTY && board[nr][nc].color !== color) {
            moves.push({ r: nr, c: nc });
        }
    }

    if (enPassantTarget && enPassantTarget.color !== color) {
        for (const epSq of enPassantTarget.squares) {
            if (epSq.r === r + dir && Math.abs(epSq.c - c) === 1) {
                moves.push({
                    r: epSq.r, c: epSq.c,
                    enPassant: true,
                    captureR: enPassantTarget.pawnRow,
                    captureC: enPassantTarget.pawnCol
                });
            }
        }
    }

    return moves;
}

function getKingMoves(r, c, color) {
    let moves = [];
    const dirs = [[-1,-1],[-1,0],[-1,1],[0,-1],[0,1],[1,-1],[1,0],[1,1]];
    for (const [dr, dc] of dirs) {
        const nr = r + dr, nc = c + dc;
        if (inBounds(nr, nc) && (board[nr][nc] === EMPTY || board[nr][nc].color !== color)) {
            moves.push({ r: nr, c: nc });
        }
    }

    if (!kingMoved[color] && !isSquareAttacked(r, c, color)) {
        const row = color === WHITE ? 9 : 0;
        if (!rookMoved[color].j && board[row][9] && board[row][9].type === ROOK && board[row][9].color === color) {
            if (canCastle(row, 5, 7, 9, color)) moves.push({ r: row, c: 7, castling: 'kingSide2' });
            if (canCastle(row, 5, 8, 9, color)) moves.push({ r: row, c: 8, castling: 'kingSide3' });
        }
        if (!rookMoved[color].a && board[row][0] && board[row][0].type === ROOK && board[row][0].color === color) {
            if (canCastle(row, 5, 3, 0, color)) moves.push({ r: row, c: 3, castling: 'queenSide2' });
            if (canCastle(row, 5, 2, 0, color)) moves.push({ r: row, c: 2, castling: 'queenSide3' });
            if (canCastle(row, 5, 1, 0, color)) moves.push({ r: row, c: 1, castling: 'queenSide4' });
        }
    }

    return moves;
}

function canCastle(row, kingCol, targetCol, rookCol, color) {
    const minCol = Math.min(kingCol, targetCol, rookCol);
    const maxCol = Math.max(kingCol, targetCol, rookCol);
    for (let c = minCol + 1; c < maxCol; c++) {
        if (c === kingCol || c === rookCol) continue;
        if (board[row][c] !== EMPTY) return false;
    }
    if (board[row][targetCol] !== EMPTY && targetCol !== rookCol) return false;
    const step = targetCol > kingCol ? 1 : -1;
    for (let c = kingCol; c !== targetCol + step; c += step) {
        if (isSquareAttacked(row, c, color)) return false;
    }
    return true;
}

// ============================================================
// CHECK DETECTION
// ============================================================

function findKing(color) {
    for (let r = 0; r < BOARD_SIZE; r++) {
        for (let c = 0; c < BOARD_SIZE; c++) {
            if (board[r][c] && board[r][c].type === KING && board[r][c].color === color) return { r, c };
        }
    }
    return null;
}

function isSquareAttacked(r, c, byColor) {
    const enemy = byColor === WHITE ? BLACK : WHITE;

    const pawnDir = enemy === WHITE ? -1 : 1;
    for (const dc of [-1, 1]) {
        const pr = r - pawnDir, pc = c + dc;
        if (inBounds(pr, pc) && board[pr][pc] && board[pr][pc].type === PAWN && board[pr][pc].color === enemy) return true;
    }

    const knightOffsets = [
        [-2,-1],[-2,1],[-1,-2],[-1,2],[1,-2],[1,2],[2,-1],[2,1],
        [-3,-1],[-3,1],[-1,-3],[-1,3],[1,-3],[1,3],[3,-1],[3,1]
    ];
    for (const [dr, dc] of knightOffsets) {
        const nr = r + dr, nc = c + dc;
        if (inBounds(nr, nc) && board[nr][nc] && board[nr][nc].type === KNIGHT && board[nr][nc].color === enemy) return true;
    }

    for (const [dr, dc] of [[-1,-1],[-1,0],[-1,1],[0,-1],[0,1],[1,-1],[1,0],[1,1]]) {
        const nr = r + dr, nc = c + dc;
        if (inBounds(nr, nc) && board[nr][nc] && board[nr][nc].type === KING && board[nr][nc].color === enemy) return true;
    }

    const slidingChecks = [
        { dirs: [[-1,-1],[-1,1],[1,-1],[1,1]], types: [BISHOP, QUEEN] },
        { dirs: [[-1,0],[1,0],[0,-1],[0,1]], types: [ROOK, QUEEN] }
    ];
    for (const { dirs, types } of slidingChecks) {
        for (const [dr, dc] of dirs) {
            let nr = r + dr, nc = c + dc;
            while (inBounds(nr, nc)) {
                if (board[nr][nc] !== EMPTY) {
                    if (board[nr][nc].color === enemy && types.includes(board[nr][nc].type)) return true;
                    break;
                }
                nr += dr; nc += dc;
            }
        }
    }

    for (const [dr, dc] of [[-1,-1],[-1,0],[-1,1],[0,-1],[0,1],[1,-1],[1,0],[1,1]]) {
        for (let step = 1; step <= 2; step++) {
            const nr = r + dr * step, nc = c + dc * step;
            if (!inBounds(nr, nc)) break;
            if (board[nr][nc] !== EMPTY) {
                if (board[nr][nc].color === enemy && board[nr][nc].type === MUSKETEER) return true;
                break;
            }
        }
    }

    return false;
}

function isInCheck(color) {
    const king = findKing(color);
    if (!king) return false;
    return isSquareAttacked(king.r, king.c, color);
}

function wouldBeInCheck(fromR, fromC, toR, toC, color, moveInfo) {
    const savedBoard = JSON.parse(JSON.stringify(board));
    const savedEP = enPassantTarget ? JSON.parse(JSON.stringify(enPassantTarget)) : null;

    board[toR][toC] = board[fromR][fromC];
    board[fromR][fromC] = EMPTY;

    if (moveInfo && moveInfo.enPassant) {
        board[moveInfo.captureR][moveInfo.captureC] = EMPTY;
    }

    if (moveInfo && moveInfo.castling) {
        const row = fromR;
        switch (moveInfo.castling) {
            case 'kingSide2':  board[row][6] = board[row][9]; board[row][9] = EMPTY; break;
            case 'kingSide3':  board[row][7] = board[row][9]; board[row][9] = EMPTY; break;
            case 'queenSide2': board[row][4] = board[row][0]; board[row][0] = EMPTY; break;
            case 'queenSide3': board[row][3] = board[row][0]; board[row][0] = EMPTY; break;
            case 'queenSide4': board[row][2] = board[row][0]; board[row][0] = EMPTY; break;
        }
    }

    const inCheck = isInCheck(color);
    board = savedBoard;
    enPassantTarget = savedEP;
    return inCheck;
}

function hasAnyLegalMoves(color) {
    for (let r = 0; r < BOARD_SIZE; r++) {
        for (let c = 0; c < BOARD_SIZE; c++) {
            if (board[r][c] && board[r][c].color === color) {
                if (getValidMoves(r, c).length > 0) return true;
            }
        }
    }
    return false;
}

// ============================================================
// MOVE EXECUTION
// ============================================================

function executeMove(fromR, fromC, toR, toC, moveInfo) {
    if (gameOver) return;

    // Save state for undo (local only)
    if (gameMode === 'local') {
        stateHistory.push({
            board: JSON.parse(JSON.stringify(board)),
            currentTurn,
            kingMoved: JSON.parse(JSON.stringify(kingMoved)),
            rookMoved: JSON.parse(JSON.stringify(rookMoved)),
            enPassantTarget: enPassantTarget ? JSON.parse(JSON.stringify(enPassantTarget)) : null,
            lastMove: lastMove ? JSON.parse(JSON.stringify(lastMove)) : null,
            moveHistoryLength: moveHistory.length
        });
    }

    const piece = board[fromR][fromC];
    const captured = board[toR][toC];
    let notation = buildNotation(fromR, fromC, toR, toC, piece, captured, moveInfo);

    // En passant capture
    if (moveInfo && moveInfo.enPassant) {
        board[moveInfo.captureR][moveInfo.captureC] = EMPTY;
    }

    // Castling rook movement
    if (moveInfo && moveInfo.castling) {
        const row = fromR;
        switch (moveInfo.castling) {
            case 'kingSide2':  board[row][6] = board[row][9]; board[row][9] = EMPTY; break;
            case 'kingSide3':  board[row][7] = board[row][9]; board[row][9] = EMPTY; break;
            case 'queenSide2': board[row][4] = board[row][0]; board[row][0] = EMPTY; break;
            case 'queenSide3': board[row][3] = board[row][0]; board[row][0] = EMPTY; break;
            case 'queenSide4': board[row][2] = board[row][0]; board[row][0] = EMPTY; break;
        }
    }

    // Move piece
    board[toR][toC] = piece;
    board[fromR][fromC] = EMPTY;

    // Update castling flags
    if (piece.type === KING) kingMoved[piece.color] = true;
    if (piece.type === ROOK) {
        if (fromC === 0) rookMoved[piece.color].a = true;
        if (fromC === 9) rookMoved[piece.color].j = true;
    }
    if (captured && captured.type === ROOK) {
        const capturedColor = captured.color;
        const rookRow = capturedColor === WHITE ? 9 : 0;
        if (toR === rookRow && toC === 0) rookMoved[capturedColor].a = true;
        if (toR === rookRow && toC === 9) rookMoved[capturedColor].j = true;
    }

    // Update en passant
    enPassantTarget = null;
    if (piece.type === PAWN) {
        const distance = Math.abs(toR - fromR);
        if (distance >= 2) {
            const dir = piece.color === WHITE ? -1 : 1;
            let squares = [];
            for (let step = 1; step < distance; step++) {
                squares.push({ r: fromR + dir * step, c: fromC });
            }
            enPassantTarget = {
                color: piece.color,
                pawnRow: toR,
                pawnCol: toC,
                squares: squares
            };
        }
        board[toR][toC].hasMoved = true;
    }

    // Update last move
    lastMove = { from: { r: fromR, c: fromC }, to: { r: toR, c: toC } };

    // Increment move counter
    moveCounter++;

    // Check for promotion
    const promoRow = piece.color === WHITE ? 0 : 9;
    if (piece.type === PAWN && toR === promoRow) {
        pendingPromotion = { r: toR, c: toC, color: piece.color, notation };
        showPromotionModal(piece.color);
        return;
    }

    finalizeMove(notation);
}

function finalizeMove(notation) {
    const mover = currentTurn;
    const opponent = currentTurn === WHITE ? BLACK : WHITE;

    if (isInCheck(opponent)) {
        if (hasAnyLegalMoves(opponent)) {
            notation += '+';
        } else {
            notation += '#';
            moveHistory.push(notation);
            currentTurn = opponent;
            gameOver = true;

            const message = mover === WHITE ? 'White wins by checkmate!' : 'Black wins by checkmate!';

            if (gameMode === 'online') {
                syncGameOverToFirebase(message);
            }

            updateMoveHistory();
            renderBoard();
            updateTurnIndicator();
            showGameOver(message);
            return;
        }
    } else if (!hasAnyLegalMoves(opponent)) {
        moveHistory.push(notation);
        currentTurn = opponent;
        gameOver = true;

        const message = 'Stalemate — Draw!';

        if (gameMode === 'online') {
            syncGameOverToFirebase(message);
        }

        updateMoveHistory();
        renderBoard();
        updateTurnIndicator();
        showGameOver(message);
        return;
    }

    moveHistory.push(notation);
    currentTurn = opponent;

    // Clear draw offers on move
    if (gameMode === 'online' && gameRef) {
        gameRef.child('drawOffer').set(null);
    }

    syncGameToFirebase();
    updateMoveHistory();
    renderBoard();
    updateTurnIndicator();
}

// ============================================================
// NOTATION
// ============================================================

function squareName(r, c) {
    return FILES[c] + (BOARD_SIZE - r);
}

function buildNotation(fromR, fromC, toR, toC, piece, captured, moveInfo) {
    if (moveInfo && moveInfo.castling) {
        switch (moveInfo.castling) {
            case 'kingSide2':  return 'O-O(k)';
            case 'kingSide3':  return 'O-O-O(k)';
            case 'queenSide2': return 'O-O(q)';
            case 'queenSide3': return 'O-O-O(q)';
            case 'queenSide4': return 'O-O-O-O(q)';
        }
    }

    let n = '';

    if (piece.type === PAWN) {
        if (captured || (moveInfo && moveInfo.enPassant)) {
            n += FILES[fromC] + '×' + squareName(toR, toC);
            if (moveInfo && moveInfo.enPassant) n += ' e.p.';
        } else {
            n += squareName(toR, toC);
        }
    } else {
        n += piece.type;

        let ambiguous = false, sameFile = false, sameRank = false;
        for (let r = 0; r < BOARD_SIZE; r++) {
            for (let c = 0; c < BOARD_SIZE; c++) {
                if (r === fromR && c === fromC) continue;
                const p = board[r][c];
                if (p && p.type === piece.type && p.color === piece.color) {
                    const moves = getRawMoves(r, c, p);
                    if (moves.some(m => m.r === toR && m.c === toC)) {
                        ambiguous = true;
                        if (c === fromC) sameFile = true;
                        if (r === fromR) sameRank = true;
                    }
                }
            }
        }
        if (ambiguous) {
            if (!sameFile) n += FILES[fromC];
            else if (!sameRank) n += (BOARD_SIZE - fromR);
            else n += FILES[fromC] + (BOARD_SIZE - fromR);
        }

        if (captured) n += '×';
        n += squareName(toR, toC);
    }

    return n;
}

function getRawMoves(r, c, piece) {
    switch (piece.type) {
        case PAWN:      return getPawnMoves(r, c, piece.color);
        case KNIGHT:    return getKnightMoves(r, c, piece.color);
        case BISHOP:    return getSlidingMoves(r, c, piece.color, [[-1,-1],[-1,1],[1,-1],[1,1]]);
        case ROOK:      return getSlidingMoves(r, c, piece.color, [[-1,0],[1,0],[0,-1],[0,1]]);
        case QUEEN:     return getSlidingMoves(r, c, piece.color, [[-1,-1],[-1,1],[1,-1],[1,1],[-1,0],[1,0],[0,-1],[0,1]]);
        case KING:      return getKingMoves(r, c, piece.color);
        case MUSKETEER: return getMusketeerMoves(r, c, piece.color);
        default:        return [];
    }
}

// ============================================================
// PROMOTION
// ============================================================

function showPromotionModal(color) {
    const modal = document.getElementById('promotion-modal');
    const buttonsDiv = document.getElementById('promo-buttons');
    buttonsDiv.innerHTML = '';

    const options = [QUEEN, ROOK, BISHOP, KNIGHT, MUSKETEER];
    for (const type of options) {
        const btn = document.createElement('span');
        btn.classList.add('promo-option');
        btn.innerHTML = pieceHTML(type, color);
        btn.addEventListener('click', () => completePromotion(type));
        buttonsDiv.appendChild(btn);
    }

    modal.classList.add('active');
}

function completePromotion(type) {
    document.getElementById('promotion-modal').classList.remove('active');

    const { r, c, color, notation } = pendingPromotion;
    board[r][c] = { type: type, color: color };

    const fullNotation = notation + '=' + type;
    pendingPromotion = null;

    finalizeMove(fullNotation);
}

// ============================================================
// UNDO (local only)
// ============================================================

function undoMove() {
    if (gameMode === 'online') {
        alert('Undo is not available in online games.');
        return;
    }
    if (gameOver) return;
    if (stateHistory.length === 0) return;

    if (pendingPromotion) {
        document.getElementById('promotion-modal').classList.remove('active');
        pendingPromotion = null;
    }

    const prev = stateHistory.pop();
    board = prev.board;
    currentTurn = prev.currentTurn;
    kingMoved = prev.kingMoved;
    rookMoved = prev.rookMoved;
    enPassantTarget = prev.enPassantTarget;
    lastMove = prev.lastMove;
    moveHistory.length = prev.moveHistoryLength;

    selectedSquare = null;
    validMoves = [];

    renderBoard();
    updateTurnIndicator();
    updateMoveHistory();
}

// ============================================================
// GAME OVER
// ============================================================

function showGameOver(message) {
    gameOver = true;
    document.getElementById('game-over-text').textContent = message;
    document.getElementById('game-over-modal').classList.add('active');
}

// ============================================================
// CLEANUP OLD GAMES
// ============================================================

function cleanupOldGames() {
    const cutoff = Date.now() - (24 * 60 * 60 * 1000);
    db.ref('games').orderByChild('createdAt').endAt(cutoff).once('value', (snapshot) => {
        snapshot.forEach((child) => {
            child.ref.remove();
        });
    });
}

// ============================================================
// INIT
// ============================================================

showLobby();
cleanupOldGames();