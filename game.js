// ============================================================
// FIREBASE CONFIGURATION
// ============================================================

var firebaseConfig = {
    apiKey: "AIzaSyAZDT9WWgYQQTXvGvIaZoVs8jnU4Hyg8sg",
    authDomain: "santa-100-chess.firebaseapp.com",
    databaseURL: "https://santa-100-chess-default-rtdb.firebaseio.com",
    projectId: "santa-100-chess",
    storageBucket: "santa-100-chess.firebasestorage.app",
    messagingSenderId: "198977328644",
    appId: "1:198977328644:web:3e7f80891a14fca7354751"
};

firebase.initializeApp(firebaseConfig);
var db = firebase.database();

// ============================================================
// SOUND ENGINE
// ============================================================

var audioCtx = null;
var soundEnabled = true;

function getAudioContext() {
    if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    if (audioCtx.state === 'suspended') audioCtx.resume();
    return audioCtx;
}

function playTone(freq, dur, type, vol, decay) {
    if (!soundEnabled) return;
    type = type || 'sine'; vol = vol || 0.3; decay = decay !== false;
    try {
        var ctx = getAudioContext();
        var o = ctx.createOscillator(), g = ctx.createGain();
        o.connect(g); g.connect(ctx.destination);
        o.type = type; o.frequency.setValueAtTime(freq, ctx.currentTime);
        g.gain.setValueAtTime(vol, ctx.currentTime);
        if (decay) g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + dur);
        o.start(ctx.currentTime); o.stop(ctx.currentTime + dur);
    } catch(e) {}
}

function playNoise(dur, vol) {
    if (!soundEnabled) return; vol = vol || 0.15;
    try {
        var ctx = getAudioContext();
        var sz = ctx.sampleRate * dur, buf = ctx.createBuffer(1, sz, ctx.sampleRate);
        var d = buf.getChannelData(0);
        for (var i = 0; i < sz; i++) d[i] = (Math.random()*2-1) * Math.pow(1-i/sz, 3);
        var src = ctx.createBufferSource(), g = ctx.createGain();
        src.buffer = buf; src.connect(g); g.connect(ctx.destination);
        g.gain.setValueAtTime(vol, ctx.currentTime);
        g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + dur);
        src.start(ctx.currentTime);
    } catch(e) {}
}

function soundMove()     { playNoise(0.08,0.2); playTone(200,0.08,'sine',0.15); }
function soundCapture()  { playNoise(0.1,0.35); playTone(300,0.06,'square',0.15); setTimeout(function(){playTone(250,0.06,'square',0.1);},30); }
function soundCheck()    { playTone(880,0.12,'sine',0.25); setTimeout(function(){playTone(880,0.12,'sine',0.25);},150); }
function soundCheckmate(){ playTone(523,0.4,'sine',0.3); setTimeout(function(){playTone(659,0.4,'sine',0.25);},100); setTimeout(function(){playTone(784,0.4,'sine',0.25);},200); setTimeout(function(){playTone(1047,0.6,'sine',0.3);},300); }
function soundCastle()   { soundMove(); setTimeout(function(){soundMove();},150); }
function soundPromotion(){ playTone(400,0.12,'sine',0.2); setTimeout(function(){playTone(500,0.12,'sine',0.2);},80); setTimeout(function(){playTone(630,0.12,'sine',0.2);},160); setTimeout(function(){playTone(800,0.2,'sine',0.25);},240); }
function soundGameStart(){ playTone(523,0.3,'sine',0.15); setTimeout(function(){playTone(659,0.3,'sine',0.15);},120); setTimeout(function(){playTone(784,0.4,'sine',0.2);},240); }
function soundError()    { playTone(100,0.2,'sawtooth',0.15); }
function soundNotify()   { playTone(1200,0.15,'sine',0.2); setTimeout(function(){playTone(1600,0.2,'sine',0.15);},100); }
function soundVictory()  { playTone(523,0.2,'sine',0.2); setTimeout(function(){playTone(659,0.2,'sine',0.2);},150); setTimeout(function(){playTone(784,0.2,'sine',0.2);},300); setTimeout(function(){playTone(1047,0.4,'sine',0.3);},450); setTimeout(function(){playTone(1047,0.5,'sine',0.2);playTone(1319,0.5,'sine',0.2);playTone(1568,0.5,'sine',0.2);},650); }
function soundDefeat()   { playTone(400,0.3,'sine',0.2); setTimeout(function(){playTone(350,0.3,'sine',0.2);},200); setTimeout(function(){playTone(300,0.3,'sine',0.2);},400); setTimeout(function(){playTone(200,0.5,'sine',0.15);},600); }
function soundDraw()     { playTone(500,0.25,'sine',0.2); setTimeout(function(){playTone(500,0.25,'sine',0.2);},300); }
function soundLowTime()  { playTone(600,0.08,'sine',0.2); }
function soundFlag()     { playTone(200,0.5,'square',0.25); setTimeout(function(){playTone(150,0.5,'square',0.2);},200); }
function soundDisconnect(){ playTone(400,0.15,'sine',0.2); setTimeout(function(){playTone(300,0.2,'sine',0.2);},120); }
function soundReconnect(){ playTone(400,0.12,'sine',0.2); setTimeout(function(){playTone(600,0.15,'sine',0.2);},100); }

function toggleSound() {
    soundEnabled = !soundEnabled;
    document.getElementById('sound-toggle').textContent = soundEnabled ? '🔊 Sound' : '🔇 Muted';
    if (soundEnabled) playTone(800,0.1,'sine',0.15);
}

// ============================================================
// CONSTANTS
// ============================================================

var PIECE_SET = 'pieces/cburnett';
function pieceHTML(type, color) {
    var prefix = color === 'white' ? 'w' : 'b';
    return '<img class="piece-img" src="'+PIECE_SET+'/'+prefix+type+'.svg" alt="'+color+' '+type+'" draggable="false">';
}

var BOARD_SIZE = 10;
var FILES = ['a','b','c','d','e','f','g','h','i','j'];
var EMPTY = null;
var KING='K', QUEEN='Q', ROOK='R', BISHOP='B', KNIGHT='N', MUSKETEER='M', PAWN='P';
var WHITE='white', BLACK='black';

var TIME_CONTROLS = {
    'none':  { initial: 0, increment: 0, label: 'No Timer' },
    '1+0':   { initial: 60, increment: 0, label: '1+0 Bullet' },
    '1+1':   { initial: 60, increment: 1, label: '1+1 Bullet' },
    '2+1':   { initial: 120, increment: 1, label: '2+1 Bullet' },
    '3+0':   { initial: 180, increment: 0, label: '3+0 Blitz' },
    '3+2':   { initial: 180, increment: 2, label: '3+2 Blitz' },
    '5+0':   { initial: 300, increment: 0, label: '5+0 Blitz' },
    '5+3':   { initial: 300, increment: 3, label: '5+3 Blitz' },
    '10+0':  { initial: 600, increment: 0, label: '10+0 Rapid' },
    '10+5':  { initial: 600, increment: 5, label: '10+5 Rapid' },
    '15+10': { initial: 900, increment: 10, label: '15+10 Rapid' }
};

var DISCONNECT_TIMEOUT = 10; // seconds

// ============================================================
// GAME STATE
// ============================================================

var board = [];
var currentTurn = WHITE;
var selectedSquare = null;
var validMoves = [];
var moveHistory = [];
var stateHistory = [];
var lastMove = null;
var kingMoved = { white: false, black: false };
var rookMoved = { white: { a: false, j: false }, black: { a: false, j: false } };
var enPassantTarget = null;
var pendingPromotion = null;

// Timer state
var timeControl = 'none';
var timerWhite = 0;
var timerBlack = 0;
var timerIncrement = 0;
var timerInterval = null;
var lastTickTime = 0;
var timerStarted = false;
var lowTimeWarned = { white: false, black: false };

// Multiplayer state
var gameMode = 'local';
var roomCode = null;
var playerColor = null;
var gameRef = null;
var gameListener = null;
var playerId = generatePlayerId();
var moveCounter = 0;
var lastSyncedMove = -1;
var isSyncing = false;
var gameOver = false;

// Disconnect state
var opponentOnline = true;
var disconnectTimer = null;
var disconnectCountdown = DISCONNECT_TIMEOUT;
var disconnectInterval = null;
var presenceRef = null;
var opponentPresenceRef = null;

function generatePlayerId() { return 'player_' + Math.random().toString(36).substr(2, 9); }
function generateRoomCode() {
    var chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789', code = '';
    for (var i = 0; i < 6; i++) code += chars[Math.floor(Math.random() * chars.length)];
    return code;
}

// ============================================================
// TIMER FUNCTIONS
// ============================================================

function initTimers(tc) {
    timeControl = tc;
    var config = TIME_CONTROLS[tc];
    if (!config || tc === 'none') {
        timeControl = 'none'; timerWhite = 0; timerBlack = 0; timerIncrement = 0;
        timerStarted = false; lowTimeWarned = { white: false, black: false }; return;
    }
    timerWhite = config.initial * 1000;
    timerBlack = config.initial * 1000;
    timerIncrement = config.increment * 1000;
    timerStarted = false;
    lowTimeWarned = { white: false, black: false };
}

function startTimerTick() {
    if (timerInterval) clearInterval(timerInterval);
    if (timeControl === 'none') return;
    lastTickTime = Date.now();
    timerInterval = setInterval(function() {
        if (gameOver || !timerStarted || pendingPromotion) return;
        var now = Date.now(), elapsed = now - lastTickTime;
        lastTickTime = now;
        if (currentTurn === WHITE) {
            timerWhite = Math.max(0, timerWhite - elapsed);
            if (timerWhite <= 0) { timerWhite = 0; onTimeOut(WHITE); return; }
        } else {
            timerBlack = Math.max(0, timerBlack - elapsed);
            if (timerBlack <= 0) { timerBlack = 0; onTimeOut(BLACK); return; }
        }
        checkLowTime(WHITE); checkLowTime(BLACK);
        updateClockDisplay();
    }, 100);
}

function stopTimerTick() {
    if (timerInterval) { clearInterval(timerInterval); timerInterval = null; }
}

function checkLowTime(color) {
    var time = color === WHITE ? timerWhite : timerBlack;
    if (time > 0 && time <= 30000 && !lowTimeWarned[color]) {
        lowTimeWarned[color] = true;
        if (gameMode === 'local' || color === playerColor) soundLowTime();
    }
}

function onTimeOut(color) {
    stopTimerTick(); gameOver = true;
    var winner = color === WHITE ? 'Black' : 'White';
    var message = winner + ' wins on time!';
    soundFlag(); updateClockDisplay();
    if (gameMode === 'online') syncGameOverToFirebase(message);
    setTimeout(function() { showGameOver(message); }, 300);
}

function addIncrement(color) {
    if (timeControl === 'none' || timerIncrement === 0) return;
    if (color === WHITE) timerWhite += timerIncrement;
    else timerBlack += timerIncrement;
}

function formatTime(ms) {
    if (ms <= 0) return '0:00';
    var totalSeconds = Math.ceil(ms / 1000);
    var minutes = Math.floor(totalSeconds / 60);
    var seconds = totalSeconds % 60;
    if (ms <= 10000) {
        var tenths = Math.floor((ms % 1000) / 100);
        return seconds + '.' + tenths;
    }
    return minutes + ':' + (seconds < 10 ? '0' : '') + seconds;
}

function updateClockDisplay() {
    var flipped = (gameMode === 'online' && playerColor === BLACK);
    var topColor = flipped ? WHITE : BLACK;
    var bottomColor = flipped ? BLACK : WHITE;

    var clockTop = document.getElementById('clock-top');
    var clockBottom = document.getElementById('clock-bottom');

    if (timeControl === 'none') {
        clockTop.classList.add('hidden'); clockBottom.classList.add('hidden'); return;
    }
    clockTop.classList.remove('hidden'); clockBottom.classList.remove('hidden');

    var topMs = topColor === WHITE ? timerWhite : timerBlack;
    var bottomMs = bottomColor === WHITE ? timerWhite : timerBlack;

    document.getElementById('clock-top-time').textContent = formatTime(topMs);
    document.getElementById('clock-bottom-time').textContent = formatTime(bottomMs);

    if (gameMode === 'online') {
        document.getElementById('clock-top-label').textContent = topColor === playerColor ? 'You' : 'Opponent';
        document.getElementById('clock-bottom-label').textContent = bottomColor === playerColor ? 'You' : 'Opponent';
    } else {
        document.getElementById('clock-top-label').textContent = topColor === WHITE ? '⬜ White' : '⬛ Black';
        document.getElementById('clock-bottom-label').textContent = bottomColor === WHITE ? '⬜ White' : '⬛ Black';
    }

    clockTop.classList.toggle('active', timerStarted && currentTurn === topColor && !gameOver);
    clockBottom.classList.toggle('active', timerStarted && currentTurn === bottomColor && !gameOver);
    clockTop.classList.toggle('low-time', topMs > 0 && topMs <= 30000 && timerStarted && currentTurn === topColor);
    clockBottom.classList.toggle('low-time', bottomMs > 0 && bottomMs <= 30000 && timerStarted && currentTurn === bottomColor);
    clockTop.classList.toggle('flagged', topMs <= 0);
    clockBottom.classList.toggle('flagged', bottomMs <= 0);
}

// ============================================================
// BOARD INITIALIZATION
// ============================================================

function createStartingBoard() {
    var b = [];
    for (var r = 0; r < BOARD_SIZE; r++) {
        b[r] = [];
        for (var c = 0; c < BOARD_SIZE; c++) b[r][c] = EMPTY;
    }
    var backRank = [ROOK,KNIGHT,BISHOP,MUSKETEER,QUEEN,KING,MUSKETEER,BISHOP,KNIGHT,ROOK];
    for (var c = 0; c < 10; c++) {
        b[9][c] = { type: backRank[c], color: WHITE };
        b[8][c] = { type: PAWN, color: WHITE, hasMoved: false };
        b[0][c] = { type: backRank[c], color: BLACK };
        b[1][c] = { type: PAWN, color: BLACK, hasMoved: false };
    }
    return b;
}

function initGameState() {
    board = createStartingBoard();
    currentTurn = WHITE; selectedSquare = null; validMoves = [];
    moveHistory = []; stateHistory = []; lastMove = null;
    kingMoved = { white: false, black: false };
    rookMoved = { white: { a: false, j: false }, black: { a: false, j: false } };
    enPassantTarget = null; pendingPromotion = null;
    moveCounter = 0; lastSyncedMove = -1; isSyncing = false; gameOver = false;
    opponentOnline = true;
    stopTimerTick();
    clearDisconnectTimer();
}

// ============================================================
// SERIALIZATION
// ============================================================

function serializeBoard(b) {
    var s = [];
    for (var r = 0; r < BOARD_SIZE; r++) {
        s[r] = [];
        for (var c = 0; c < BOARD_SIZE; c++) {
            if (b[r][c] === EMPTY) s[r][c] = 0;
            else s[r][c] = { t: b[r][c].type, c: b[r][c].color === WHITE ? 'w' : 'b', m: b[r][c].hasMoved || false };
        }
    }
    return s;
}

function deserializeBoard(s) {
    var b = [];
    for (var r = 0; r < BOARD_SIZE; r++) {
        b[r] = [];
        for (var c = 0; c < BOARD_SIZE; c++) {
            if (!s[r][c] || s[r][c] === 0) b[r][c] = EMPTY;
            else b[r][c] = { type: s[r][c].t, color: s[r][c].c === 'w' ? WHITE : BLACK, hasMoved: s[r][c].m || false };
        }
    }
    return b;
}

function serializeGameState() {
    return {
        board: serializeBoard(board),
        currentTurn: currentTurn, kingMoved: kingMoved, rookMoved: rookMoved,
        enPassantTarget: enPassantTarget || null, lastMove: lastMove || null,
        moveHistory: moveHistory || [], moveCounter: moveCounter,
        lastMoveBy: playerColor, gameOverMessage: null,
        timerWhite: timerWhite, timerBlack: timerBlack,
        timerTimestamp: Date.now(), timerStarted: timerStarted
    };
}

function applyGameState(data) {
    board = deserializeBoard(data.board);
    currentTurn = data.currentTurn; kingMoved = data.kingMoved; rookMoved = data.rookMoved;
    enPassantTarget = data.enPassantTarget || null; lastMove = data.lastMove || null;
    moveHistory = data.moveHistory || []; moveCounter = data.moveCounter || 0;
    selectedSquare = null; validMoves = []; pendingPromotion = null;

    if (timeControl !== 'none' && data.timerWhite !== undefined) {
        var elapsed = 0;
        if (data.timerTimestamp) {
            elapsed = Date.now() - data.timerTimestamp;
            if (elapsed < 0 || elapsed > 10000) elapsed = 0;
        }
        timerWhite = data.timerWhite; timerBlack = data.timerBlack;
        if (data.timerStarted) {
            if (currentTurn === WHITE) timerWhite = Math.max(0, timerWhite - elapsed);
            else timerBlack = Math.max(0, timerBlack - elapsed);
        }
        timerStarted = data.timerStarted || false;
        lastTickTime = Date.now();
    }
}

// ============================================================
// RENDERING
// ============================================================

function renderBoard() {
    var boardEl = document.getElementById('board');
    boardEl.innerHTML = '';
    var flipped = (gameMode === 'online' && playerColor === BLACK);

    for (var ri = 0; ri < BOARD_SIZE; ri++) {
        for (var ci = 0; ci < BOARD_SIZE; ci++) {
            var r = flipped ? (BOARD_SIZE - 1 - ri) : ri;
            var c = flipped ? (BOARD_SIZE - 1 - ci) : ci;
            var sq = document.createElement('div');
            sq.classList.add('square', (r + c) % 2 === 0 ? 'light' : 'dark');

            if (lastMove) {
                if (lastMove.from.r === r && lastMove.from.c === c) sq.classList.add('last-move-from');
                if (lastMove.to.r === r && lastMove.to.c === c) sq.classList.add('last-move-to');
            }
            if (selectedSquare && selectedSquare.r === r && selectedSquare.c === c) sq.classList.add('selected');

            var vm = validMoves.find(function(m) { return m.r === r && m.c === c; });
            if (vm) sq.classList.add(board[r][c] !== EMPTY || vm.enPassant ? 'valid-capture' : 'valid-move');
            if (board[r][c]) sq.innerHTML = pieceHTML(board[r][c].type, board[r][c].color);

            (function(row, col) {
                sq.addEventListener('click', function() { onSquareClick(row, col); });
            })(r, c);
            boardEl.appendChild(sq);
        }
    }

    var rankLabels = document.getElementById('rank-labels');
    rankLabels.innerHTML = '';
    for (var ri = 0; ri < BOARD_SIZE; ri++) {
        var r = flipped ? ri : (BOARD_SIZE - 1 - ri);
        var d = document.createElement('div');
        d.textContent = r + 1;
        rankLabels.appendChild(d);
    }

    var fileLabels = document.getElementById('file-labels');
    fileLabels.innerHTML = '';
    for (var ci = 0; ci < BOARD_SIZE; ci++) {
        var c = flipped ? (BOARD_SIZE - 1 - ci) : ci;
        var d = document.createElement('div');
        d.textContent = FILES[c];
        fileLabels.appendChild(d);
    }

    updateClockDisplay();
}

function updateTurnIndicator() {
    var el = document.getElementById('turn-indicator');
    el.textContent = currentTurn === WHITE ? "White's turn" : "Black's turn";
    if (gameMode === 'online') {
        el.textContent += currentTurn === playerColor ? ' (Your turn)' : ' (Waiting...)';
    }
}

function updateMoveHistory() {
    var el = document.getElementById('move-history');
    var html = '';
    for (var i = 0; i < moveHistory.length; i += 2) {
        html += (Math.floor(i/2)+1) + '. ' + moveHistory[i];
        if (i+1 < moveHistory.length) html += '  ' + moveHistory[i+1];
        html += '&nbsp;&nbsp;&nbsp;';
    }
    el.innerHTML = html;
    el.parentElement.scrollTop = el.parentElement.scrollHeight;
}

// ============================================================
// DISCONNECT DETECTION
// ============================================================

function setupPresence() {
    if (gameMode !== 'online' || !gameRef) return;

    // My presence node
    var myKey = playerColor === WHITE ? 'whiteOnline' : 'blackOnline';
    var opponentKey = playerColor === WHITE ? 'blackOnline' : 'whiteOnline';

    presenceRef = gameRef.child(myKey);

    // When I disconnect, set my presence to false
    presenceRef.onDisconnect().set(false);
    // Set myself as online
    presenceRef.set(true);

    // Also re-set presence when reconnecting
    db.ref('.info/connected').on('value', function(snap) {
        if (snap.val() === true) {
            presenceRef.onDisconnect().set(false);
            presenceRef.set(true);
        }
        updateConnectionStatus(snap.val() === true);
    });

    // Watch opponent's presence
    opponentPresenceRef = gameRef.child(opponentKey);
    opponentPresenceRef.on('value', function(snap) {
        var online = snap.val();

        if (online === true) {
            if (!opponentOnline) {
                // Opponent reconnected!
                opponentOnline = true;
                clearDisconnectTimer();
                showReconnected();
                soundReconnect();
            }
            opponentOnline = true;
        } else if (online === false) {
            if (opponentOnline && !gameOver) {
                // Opponent just disconnected
                opponentOnline = false;
                soundDisconnect();
                startDisconnectCountdown();
            }
        }
    });
}

function cleanupPresence() {
    if (presenceRef) {
        presenceRef.onDisconnect().cancel();
        presenceRef.set(false);
        presenceRef = null;
    }
    if (opponentPresenceRef) {
        opponentPresenceRef.off();
        opponentPresenceRef = null;
    }
    clearDisconnectTimer();
}

function startDisconnectCountdown() {
    clearDisconnectTimer();
    disconnectCountdown = DISCONNECT_TIMEOUT;

    var banner = document.getElementById('disconnect-banner');
    banner.classList.remove('hidden', 'reconnected');
    document.getElementById('disconnect-text').textContent = 'Opponent disconnected —';
    document.getElementById('disconnect-countdown').textContent = disconnectCountdown + 's';

    disconnectInterval = setInterval(function() {
        disconnectCountdown--;
        document.getElementById('disconnect-countdown').textContent = disconnectCountdown + 's';

        if (disconnectCountdown <= 0) {
            clearDisconnectTimer();
            onOpponentAbandoned();
        }
    }, 1000);
}

function clearDisconnectTimer() {
    if (disconnectInterval) {
        clearInterval(disconnectInterval);
        disconnectInterval = null;
    }
    disconnectCountdown = DISCONNECT_TIMEOUT;
}

function showReconnected() {
    var banner = document.getElementById('disconnect-banner');
    banner.classList.remove('hidden');
    banner.classList.add('reconnected');
    document.getElementById('disconnect-text').textContent = 'Opponent reconnected!';
    document.getElementById('disconnect-countdown').textContent = '✓';

    setTimeout(function() {
        banner.classList.add('hidden');
        banner.classList.remove('reconnected');
    }, 3000);
}

function hideDisconnectBanner() {
    var banner = document.getElementById('disconnect-banner');
    banner.classList.add('hidden');
    banner.classList.remove('reconnected');
}

function onOpponentAbandoned() {
    if (gameOver) return;
    gameOver = true;
    stopTimerTick();
    hideDisconnectBanner();

    var winner = playerColor === WHITE ? 'White' : 'Black';
    var message = winner + ' wins — opponent abandoned the game!';

    syncGameOverToFirebase(message);
    setTimeout(function() { showGameOver(message); }, 300);
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
    hideDisconnectBanner();
    cleanupPresence();
    if (gameRef) { gameRef.off(); gameRef = null; }
    gameListener = null;
    stopTimerTick();
}

function showGameScreen() {
    document.getElementById('lobby').classList.add('hidden');
    document.getElementById('game-screen').classList.remove('hidden');
}

function getSelectedTimeControl() {
    return document.getElementById('time-control').value;
}

function startLocalGame() {
    gameMode = 'local'; playerColor = null; roomCode = null;
    var tc = getSelectedTimeControl();
    initGameState(); initTimers(tc);
    showGameScreen();
    document.getElementById('player-color-label').textContent = 'Local Game';
    document.getElementById('room-code-small').textContent = '';
    document.getElementById('connection-status').textContent = '';
    hideDisconnectBanner();
    renderBoard(); updateTurnIndicator(); updateMoveHistory(); updateClockDisplay();
    soundGameStart();
}

function createGame() {
    roomCode = generateRoomCode();
    gameMode = 'online'; playerColor = WHITE;
    var tc = getSelectedTimeControl();

    document.getElementById('waiting-area').classList.remove('hidden');
    document.getElementById('room-code-big').textContent = roomCode;
    document.getElementById('lobby-status').textContent = '';

    var tcConfig = TIME_CONTROLS[tc];
    document.getElementById('waiting-time-control').textContent =
        'Time control: ' + (tcConfig ? tcConfig.label : 'No Timer');

    gameRef = db.ref('games/' + roomCode);
    initGameState(); initTimers(tc);

    var gameData = {
        status: 'waiting', white: playerId, black: null,
        timeControl: tc, gameState: serializeGameState(),
        drawOffer: null, resign: null,
        whiteOnline: true, blackOnline: false,
        createdAt: firebase.database.ServerValue.TIMESTAMP
    };

    gameRef.set(gameData).then(function() {
        listenForOpponent();
    }).catch(function(err) {
        document.getElementById('lobby-status').textContent = 'Error: ' + err.message;
    });
}

function listenForOpponent() {
    gameRef.child('black').on('value', function(snapshot) {
        var blackPlayer = snapshot.val();
        if (blackPlayer) {
            gameRef.child('black').off();
            gameRef.child('status').set('playing');
            startOnlineGame();
        }
    });
}

function joinGame() {
    var code = document.getElementById('join-code').value.trim().toUpperCase();
    if (code.length !== 6) {
        document.getElementById('lobby-status').textContent = 'Please enter a 6-character room code.';
        return;
    }

    roomCode = code; gameMode = 'online'; playerColor = BLACK;
    gameRef = db.ref('games/' + roomCode);

    gameRef.once('value').then(function(snapshot) {
        var data = snapshot.val();
        if (!data) { document.getElementById('lobby-status').textContent = 'Game not found.'; return; }
        if (data.status !== 'waiting') { document.getElementById('lobby-status').textContent = 'Game already started or finished.'; return; }

        var tc = data.timeControl || 'none';
        initGameState(); initTimers(tc);
        if (data.gameState) {
            applyGameState(data.gameState);
            lastSyncedMove = data.gameState.moveCounter || 0;
        }

        gameRef.child('black').set(playerId).then(function() {
            startOnlineGame();
        });
    }).catch(function(err) {
        document.getElementById('lobby-status').textContent = 'Error: ' + err.message;
    });
}

function startOnlineGame() {
    document.getElementById('waiting-area').classList.add('hidden');
    showGameScreen();

    document.getElementById('player-color-label').textContent =
        'You are: ' + (playerColor === WHITE ? '⬜ White' : '⬛ Black');
    document.getElementById('room-code-small').textContent = 'Room: ' + roomCode;
    updateConnectionStatus(true);
    hideDisconnectBanner();

    renderBoard(); updateTurnIndicator(); updateMoveHistory(); updateClockDisplay();
    listenForGameUpdates();
    setupPresence();
    startTimerTick();
    soundGameStart();
}

function listenForGameUpdates() {
    if (gameListener) gameRef.off('value', gameListener);

    gameListener = gameRef.on('value', function(snapshot) {
        var data = snapshot.val();
        if (!data) return;
        if (isSyncing) return;

        if (data.resign) {
            var winner = data.resign === WHITE ? BLACK : WHITE;
            gameOver = true; stopTimerTick();
            showGameOver((winner === WHITE ? 'White' : 'Black') + ' wins — opponent resigned!');
            return;
        }

        if (data.status === 'draw') {
            gameOver = true; stopTimerTick(); soundDraw();
            showGameOver('Game drawn by agreement!');
            return;
        }

        if (data.drawOffer && data.drawOffer !== playerColor) {
            document.getElementById('draw-modal').classList.add('active');
            soundNotify();
        }

        if (data.gameState && data.gameState.gameOverMessage) {
            gameOver = true; stopTimerTick();
            applyGameState(data.gameState);
            renderBoard(); updateTurnIndicator(); updateMoveHistory(); updateClockDisplay();
            showGameOver(data.gameState.gameOverMessage);
            return;
        }

        if (data.gameState) {
            var remoteMoveCounter = data.gameState.moveCounter || 0;
            var lastMoveBy = data.gameState.lastMoveBy;

            if (remoteMoveCounter > lastSyncedMove && lastMoveBy !== playerColor) {
                lastSyncedMove = remoteMoveCounter;
                applyGameState(data.gameState);
                if (timerStarted && timeControl !== 'none' && !timerInterval) startTimerTick();
                renderBoard(); updateTurnIndicator(); updateMoveHistory(); updateClockDisplay();
                soundMove();
            }
        }
    });
}

function syncGameToFirebase() {
    if (gameMode !== 'online' || !gameRef) return;
    isSyncing = true;
    var state = serializeGameState();
    gameRef.child('gameState').set(state).then(function() {
        lastSyncedMove = moveCounter;
        setTimeout(function() { isSyncing = false; }, 200);
    }).catch(function(err) { console.error('Sync error:', err); isSyncing = false; });
}

function syncGameOverToFirebase(message) {
    if (gameMode !== 'online' || !gameRef) return;
    isSyncing = true;
    var state = serializeGameState();
    state.gameOverMessage = message;
    gameRef.child('gameState').set(state).then(function() {
        lastSyncedMove = moveCounter;
        setTimeout(function() { isSyncing = false; }, 200);
    }).catch(function(err) { console.error('Sync error:', err); isSyncing = false; });
}

function cancelGame() {
    cleanupPresence();
    if (gameRef) { gameRef.off(); gameRef.remove(); gameRef = null; }
    stopTimerTick(); showLobby();
}

function backToLobby() {
    cleanupPresence();
    if (gameRef) { gameRef.off(); gameRef = null; }
    gameListener = null; stopTimerTick();
    document.getElementById('game-over-modal').classList.remove('active');
    showLobby();
}

function copyRoomCode() {
    navigator.clipboard.writeText(roomCode).then(function() {
        document.getElementById('lobby-status').textContent = 'Code copied!';
        setTimeout(function() { document.getElementById('lobby-status').textContent = ''; }, 2000);
    });
}

function updateConnectionStatus(connected) {
    var el = document.getElementById('connection-status');
    if (connected) { el.textContent = '● Connected'; el.className = 'connected'; }
    else { el.textContent = '● Disconnected'; el.className = 'disconnected'; }
}

function offerDraw() {
    if (gameOver) return;
    if (gameMode === 'local') { soundDraw(); showGameOver('Game drawn by agreement!'); return; }
    if (gameMode === 'online' && gameRef) {
        if (currentTurn !== playerColor) { soundError(); alert("You can only offer a draw on your turn."); return; }
        gameRef.child('drawOffer').set(playerColor);
    }
}

function respondDraw(accepted) {
    document.getElementById('draw-modal').classList.remove('active');
    if (!gameRef) return;
    if (accepted) gameRef.child('status').set('draw');
    else gameRef.child('drawOffer').set(null);
}

function resignGame() {
    if (gameOver) return;
    if (gameMode === 'local') {
        showGameOver((currentTurn === WHITE ? 'Black' : 'White') + ' wins — opponent resigned!');
        return;
    }
    if (gameMode === 'online' && gameRef) {
        if (confirm('Are you sure you want to resign?')) gameRef.child('resign').set(playerColor);
    }
}

// ============================================================
// CLICK HANDLER
// ============================================================

function onSquareClick(r, c) {
    if (pendingPromotion || gameOver) return;
    if (gameMode === 'online' && currentTurn !== playerColor) return;

    var piece = board[r][c];

    if (selectedSquare) {
        var vm = validMoves.find(function(m) { return m.r === r && m.c === c; });
        if (vm) {
            executeMove(selectedSquare.r, selectedSquare.c, r, c, vm);
            selectedSquare = null; validMoves = [];
            renderBoard(); return;
        }
        if (piece && piece.color === currentTurn) {
            selectedSquare = { r: r, c: c }; validMoves = getValidMoves(r, c);
            renderBoard(); return;
        }
        selectedSquare = null; validMoves = [];
        renderBoard(); return;
    }

    if (piece && piece.color === currentTurn) {
        selectedSquare = { r: r, c: c }; validMoves = getValidMoves(r, c);
        renderBoard();
    }
}

// ============================================================
// MOVE GENERATION
// ============================================================

function getValidMoves(r, c) {
    var piece = board[r][c];
    if (!piece) return [];
    var moves = [];
    switch (piece.type) {
        case PAWN:      moves = getPawnMoves(r, c, piece.color); break;
        case KNIGHT:    moves = getKnightMoves(r, c, piece.color); break;
        case BISHOP:    moves = getSlidingMoves(r, c, piece.color, [[-1,-1],[-1,1],[1,-1],[1,1]]); break;
        case ROOK:      moves = getSlidingMoves(r, c, piece.color, [[-1,0],[1,0],[0,-1],[0,1]]); break;
        case QUEEN:     moves = getSlidingMoves(r, c, piece.color, [[-1,-1],[-1,1],[1,-1],[1,1],[-1,0],[1,0],[0,-1],[0,1]]); break;
        case KING:      moves = getKingMoves(r, c, piece.color); break;
        case MUSKETEER: moves = getMusketeerMoves(r, c, piece.color); break;
    }
    return moves.filter(function(m) { return !wouldBeInCheck(r, c, m.r, m.c, piece.color, m); });
}

function inBounds(r, c) { return r >= 0 && r < BOARD_SIZE && c >= 0 && c < BOARD_SIZE; }

function getSlidingMoves(r, c, color, directions) {
    var moves = [];
    for (var i = 0; i < directions.length; i++) {
        var dr = directions[i][0], dc = directions[i][1];
        var nr = r + dr, nc = c + dc;
        while (inBounds(nr, nc)) {
            if (board[nr][nc] === EMPTY) { moves.push({ r: nr, c: nc }); }
            else { if (board[nr][nc].color !== color) moves.push({ r: nr, c: nc }); break; }
            nr += dr; nc += dc;
        }
    }
    return moves;
}

function getMusketeerMoves(r, c, color) {
    var moves = [];
    var dirs = [[-1,-1],[-1,0],[-1,1],[0,-1],[0,1],[1,-1],[1,0],[1,1]];
    for (var i = 0; i < dirs.length; i++) {
        for (var step = 1; step <= 2; step++) {
            var nr = r + dirs[i][0]*step, nc = c + dirs[i][1]*step;
            if (!inBounds(nr, nc)) break;
            if (board[nr][nc] === EMPTY) { moves.push({ r: nr, c: nc }); }
            else { if (board[nr][nc].color !== color) moves.push({ r: nr, c: nc }); break; }
        }
    }
    return moves;
}

function getKnightMoves(r, c, color) {
    var moves = [];
    var offsets = [[-2,-1],[-2,1],[-1,-2],[-1,2],[1,-2],[1,2],[2,-1],[2,1],[-3,-1],[-3,1],[-1,-3],[-1,3],[1,-3],[1,3],[3,-1],[3,1]];
    for (var i = 0; i < offsets.length; i++) {
        var nr = r + offsets[i][0], nc = c + offsets[i][1];
        if (inBounds(nr, nc) && (board[nr][nc] === EMPTY || board[nr][nc].color !== color)) moves.push({ r: nr, c: nc });
    }
    return moves;
}

function getPawnMoves(r, c, color) {
    var moves = [];
    var dir = color === WHITE ? -1 : 1;
    var startRow = color === WHITE ? 8 : 1;
    if (inBounds(r+dir, c) && board[r+dir][c] === EMPTY) {
        moves.push({ r: r+dir, c: c });
        if (r === startRow && board[r+2*dir][c] === EMPTY) {
            moves.push({ r: r+2*dir, c: c });
            if (inBounds(r+3*dir, c) && board[r+3*dir][c] === EMPTY) moves.push({ r: r+3*dir, c: c });
        }
    }
    for (var di = 0; di < 2; di++) {
        var dc = di === 0 ? -1 : 1;
        var nr = r + dir, nc = c + dc;
        if (inBounds(nr, nc) && board[nr][nc] !== EMPTY && board[nr][nc].color !== color) moves.push({ r: nr, c: nc });
    }
    if (enPassantTarget && enPassantTarget.color !== color) {
        for (var ei = 0; ei < enPassantTarget.squares.length; ei++) {
            var epSq = enPassantTarget.squares[ei];
            if (epSq.r === r + dir && Math.abs(epSq.c - c) === 1) {
                moves.push({ r: epSq.r, c: epSq.c, enPassant: true, captureR: enPassantTarget.pawnRow, captureC: enPassantTarget.pawnCol });
            }
        }
    }
    return moves;
}

function getKingMoves(r, c, color) {
    var moves = [];
    var dirs = [[-1,-1],[-1,0],[-1,1],[0,-1],[0,1],[1,-1],[1,0],[1,1]];
    for (var i = 0; i < dirs.length; i++) {
        var nr = r + dirs[i][0], nc = c + dirs[i][1];
        if (inBounds(nr, nc) && (board[nr][nc] === EMPTY || board[nr][nc].color !== color)) moves.push({ r: nr, c: nc });
    }
    if (!kingMoved[color] && !isSquareAttacked(r, c, color)) {
        var row = color === WHITE ? 9 : 0;
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
    var minCol = Math.min(kingCol, targetCol, rookCol);
    var maxCol = Math.max(kingCol, targetCol, rookCol);
    for (var c = minCol + 1; c < maxCol; c++) {
        if (c === kingCol || c === rookCol) continue;
        if (board[row][c] !== EMPTY) return false;
    }
    if (board[row][targetCol] !== EMPTY && targetCol !== rookCol) return false;
    var step = targetCol > kingCol ? 1 : -1;
    for (var c = kingCol; c !== targetCol + step; c += step) {
        if (isSquareAttacked(row, c, color)) return false;
    }
    return true;
}

// ============================================================
// CHECK DETECTION
// ============================================================

function findKing(color) {
    for (var r = 0; r < BOARD_SIZE; r++)
        for (var c = 0; c < BOARD_SIZE; c++)
            if (board[r][c] && board[r][c].type === KING && board[r][c].color === color) return { r: r, c: c };
    return null;
}

function isSquareAttacked(r, c, byColor) {
    var enemy = byColor === WHITE ? BLACK : WHITE;
    var pawnDir = enemy === WHITE ? -1 : 1;
    for (var di = 0; di < 2; di++) {
        var dc = di === 0 ? -1 : 1;
        var pr = r - pawnDir, pc = c + dc;
        if (inBounds(pr, pc) && board[pr][pc] && board[pr][pc].type === PAWN && board[pr][pc].color === enemy) return true;
    }
    var knightOffsets = [[-2,-1],[-2,1],[-1,-2],[-1,2],[1,-2],[1,2],[2,-1],[2,1],[-3,-1],[-3,1],[-1,-3],[-1,3],[1,-3],[1,3],[3,-1],[3,1]];
    for (var i = 0; i < knightOffsets.length; i++) {
        var nr = r + knightOffsets[i][0], nc = c + knightOffsets[i][1];
        if (inBounds(nr, nc) && board[nr][nc] && board[nr][nc].type === KNIGHT && board[nr][nc].color === enemy) return true;
    }
    var kingDirs = [[-1,-1],[-1,0],[-1,1],[0,-1],[0,1],[1,-1],[1,0],[1,1]];
    for (var i = 0; i < kingDirs.length; i++) {
        var nr = r + kingDirs[i][0], nc = c + kingDirs[i][1];
        if (inBounds(nr, nc) && board[nr][nc] && board[nr][nc].type === KING && board[nr][nc].color === enemy) return true;
    }
    var slidingChecks = [
        { dirs: [[-1,-1],[-1,1],[1,-1],[1,1]], types: [BISHOP, QUEEN] },
        { dirs: [[-1,0],[1,0],[0,-1],[0,1]], types: [ROOK, QUEEN] }
    ];
    for (var si = 0; si < slidingChecks.length; si++) {
        var check = slidingChecks[si];
        for (var di = 0; di < check.dirs.length; di++) {
            var dr = check.dirs[di][0], dc = check.dirs[di][1];
            var nr = r + dr, nc = c + dc;
            while (inBounds(nr, nc)) {
                if (board[nr][nc] !== EMPTY) {
                    if (board[nr][nc].color === enemy && check.types.indexOf(board[nr][nc].type) !== -1) return true;
                    break;
                }
                nr += dr; nc += dc;
            }
        }
    }
    var muskDirs = [[-1,-1],[-1,0],[-1,1],[0,-1],[0,1],[1,-1],[1,0],[1,1]];
    for (var i = 0; i < muskDirs.length; i++) {
        for (var step = 1; step <= 2; step++) {
            var nr = r + muskDirs[i][0]*step, nc = c + muskDirs[i][1]*step;
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
    var king = findKing(color);
    if (!king) return false;
    return isSquareAttacked(king.r, king.c, color);
}

function wouldBeInCheck(fromR, fromC, toR, toC, color, moveInfo) {
    var savedBoard = JSON.parse(JSON.stringify(board));
    var savedEP = enPassantTarget ? JSON.parse(JSON.stringify(enPassantTarget)) : null;
    board[toR][toC] = board[fromR][fromC]; board[fromR][fromC] = EMPTY;
    if (moveInfo && moveInfo.enPassant) board[moveInfo.captureR][moveInfo.captureC] = EMPTY;
    if (moveInfo && moveInfo.castling) {
        var row = fromR;
        switch (moveInfo.castling) {
            case 'kingSide2':  board[row][6] = board[row][9]; board[row][9] = EMPTY; break;
            case 'kingSide3':  board[row][7] = board[row][9]; board[row][9] = EMPTY; break;
            case 'queenSide2': board[row][4] = board[row][0]; board[row][0] = EMPTY; break;
            case 'queenSide3': board[row][3] = board[row][0]; board[row][0] = EMPTY; break;
            case 'queenSide4': board[row][2] = board[row][0]; board[row][0] = EMPTY; break;
        }
    }
    var inCheck = isInCheck(color);
    board = savedBoard; enPassantTarget = savedEP;
    return inCheck;
}

function hasAnyLegalMoves(color) {
    for (var r = 0; r < BOARD_SIZE; r++)
        for (var c = 0; c < BOARD_SIZE; c++)
            if (board[r][c] && board[r][c].color === color)
                if (getValidMoves(r, c).length > 0) return true;
    return false;
}

// ============================================================
// MOVE EXECUTION
// ============================================================

function executeMove(fromR, fromC, toR, toC, moveInfo) {
    if (gameOver) return;

    if (gameMode === 'local') {
        stateHistory.push({
            board: JSON.parse(JSON.stringify(board)),
            currentTurn: currentTurn,
            kingMoved: JSON.parse(JSON.stringify(kingMoved)),
            rookMoved: JSON.parse(JSON.stringify(rookMoved)),
            enPassantTarget: enPassantTarget ? JSON.parse(JSON.stringify(enPassantTarget)) : null,
            lastMove: lastMove ? JSON.parse(JSON.stringify(lastMove)) : null,
            moveHistoryLength: moveHistory.length,
            timerWhite: timerWhite, timerBlack: timerBlack, timerStarted: timerStarted
        });
    }

    var piece = board[fromR][fromC];
    var captured = board[toR][toC];
    var notation = buildNotation(fromR, fromC, toR, toC, piece, captured, moveInfo);

    if (moveInfo && moveInfo.enPassant) board[moveInfo.captureR][moveInfo.captureC] = EMPTY;

    if (moveInfo && moveInfo.castling) {
        var row = fromR;
        switch (moveInfo.castling) {
            case 'kingSide2':  board[row][6] = board[row][9]; board[row][9] = EMPTY; break;
            case 'kingSide3':  board[row][7] = board[row][9]; board[row][9] = EMPTY; break;
            case 'queenSide2': board[row][4] = board[row][0]; board[row][0] = EMPTY; break;
            case 'queenSide3': board[row][3] = board[row][0]; board[row][0] = EMPTY; break;
            case 'queenSide4': board[row][2] = board[row][0]; board[row][0] = EMPTY; break;
        }
    }

    board[toR][toC] = piece; board[fromR][fromC] = EMPTY;

    if (piece.type === KING) kingMoved[piece.color] = true;
    if (piece.type === ROOK) {
        if (fromC === 0) rookMoved[piece.color].a = true;
        if (fromC === 9) rookMoved[piece.color].j = true;
    }
    if (captured && captured.type === ROOK) {
        var capturedColor = captured.color;
        var rookRow = capturedColor === WHITE ? 9 : 0;
        if (toR === rookRow && toC === 0) rookMoved[capturedColor].a = true;
        if (toR === rookRow && toC === 9) rookMoved[capturedColor].j = true;
    }

    enPassantTarget = null;
    if (piece.type === PAWN) {
        var distance = Math.abs(toR - fromR);
        if (distance >= 2) {
            var pdir = piece.color === WHITE ? -1 : 1;
            var squares = [];
            for (var step = 1; step < distance; step++) {
                squares.push({ r: fromR + pdir * step, c: fromC });
            }
            enPassantTarget = { color: piece.color, pawnRow: toR, pawnCol: toC, squares: squares };
        }
        board[toR][toC].hasMoved = true;
    }

    lastMove = { from: { r: fromR, c: fromC }, to: { r: toR, c: toC } };
    moveCounter++;

    // Sound
    if (moveInfo && moveInfo.castling) soundCastle();
    else if (captured || (moveInfo && moveInfo.enPassant)) soundCapture();
    else soundMove();

    // Timer
    if (timeControl !== 'none') {
        if (!timerStarted) {
            timerStarted = true;
            lastTickTime = Date.now();
            if (gameMode === 'local') startTimerTick();
        }
        addIncrement(currentTurn);
        lastTickTime = Date.now();
    }

    // Promotion check
    var promoRow = piece.color === WHITE ? 0 : 9;
    if (piece.type === PAWN && toR === promoRow) {
        pendingPromotion = { r: toR, c: toC, color: piece.color, notation: notation };
        showPromotionModal(piece.color);
        return;
    }

    finalizeMove(notation);
}

function finalizeMove(notation) {
    var mover = currentTurn;
    var opponent = currentTurn === WHITE ? BLACK : WHITE;

    if (isInCheck(opponent)) {
        if (hasAnyLegalMoves(opponent)) {
            notation += '+';
            soundCheck();
        } else {
            notation += '#';
            moveHistory.push(notation);
            currentTurn = opponent;
            gameOver = true; stopTimerTick();
            var message = mover === WHITE ? 'White wins by checkmate!' : 'Black wins by checkmate!';
            soundCheckmate();
            if (gameMode === 'online') syncGameOverToFirebase(message);
            updateMoveHistory(); renderBoard(); updateTurnIndicator(); updateClockDisplay();
            setTimeout(function() { showGameOver(message); }, 500);
            return;
        }
    } else if (!hasAnyLegalMoves(opponent)) {
        moveHistory.push(notation);
        currentTurn = opponent;
        gameOver = true; stopTimerTick();
        var message = 'Stalemate — Draw!';
        soundDraw();
        if (gameMode === 'online') syncGameOverToFirebase(message);
        updateMoveHistory(); renderBoard(); updateTurnIndicator(); updateClockDisplay();
        setTimeout(function() { showGameOver(message); }, 500);
        return;
    }

    moveHistory.push(notation);
    currentTurn = opponent;
    if (gameMode === 'online' && gameRef) gameRef.child('drawOffer').set(null);
    syncGameToFirebase();
    updateMoveHistory(); renderBoard(); updateTurnIndicator(); updateClockDisplay();
}

// ============================================================
// NOTATION
// ============================================================

function squareName(r, c) { return FILES[c] + (BOARD_SIZE - r); }

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
    var n = '';
    if (piece.type === PAWN) {
        if (captured || (moveInfo && moveInfo.enPassant)) {
            n += FILES[fromC] + '×' + squareName(toR, toC);
            if (moveInfo && moveInfo.enPassant) n += ' e.p.';
        } else {
            n += squareName(toR, toC);
        }
    } else {
        n += piece.type;
        var ambiguous = false, sameFile = false, sameRank = false;
        for (var r = 0; r < BOARD_SIZE; r++) {
            for (var c = 0; c < BOARD_SIZE; c++) {
                if (r === fromR && c === fromC) continue;
                var p = board[r][c];
                if (p && p.type === piece.type && p.color === piece.color) {
                    var moves = getRawMoves(r, c, p);
                    var canReach = false;
                    for (var mi = 0; mi < moves.length; mi++) {
                        if (moves[mi].r === toR && moves[mi].c === toC) { canReach = true; break; }
                    }
                    if (canReach) {
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
    var modal = document.getElementById('promotion-modal');
    var buttonsDiv = document.getElementById('promo-buttons');
    buttonsDiv.innerHTML = '';
    var options = [QUEEN, ROOK, BISHOP, KNIGHT, MUSKETEER];
    for (var i = 0; i < options.length; i++) {
        var btn = document.createElement('span');
        btn.classList.add('promo-option');
        btn.innerHTML = pieceHTML(options[i], color);
        (function(type) {
            btn.addEventListener('click', function() { completePromotion(type); });
        })(options[i]);
        buttonsDiv.appendChild(btn);
    }
    modal.classList.add('active');
}

function completePromotion(type) {
    document.getElementById('promotion-modal').classList.remove('active');
    var r = pendingPromotion.r, c = pendingPromotion.c;
    var color = pendingPromotion.color, notation = pendingPromotion.notation;
    board[r][c] = { type: type, color: color };
    var fullNotation = notation + '=' + type;
    pendingPromotion = null;
    soundPromotion();
    finalizeMove(fullNotation);
}

// ============================================================
// UNDO (local only)
// ============================================================

function undoMove() {
    if (gameMode === 'online') { soundError(); alert('Undo is not available in online games.'); return; }
    if (gameOver || stateHistory.length === 0) return;

    if (pendingPromotion) {
        document.getElementById('promotion-modal').classList.remove('active');
        pendingPromotion = null;
    }

    var prev = stateHistory.pop();
    board = prev.board; currentTurn = prev.currentTurn;
    kingMoved = prev.kingMoved; rookMoved = prev.rookMoved;
    enPassantTarget = prev.enPassantTarget; lastMove = prev.lastMove;
    moveHistory.length = prev.moveHistoryLength;

    if (prev.timerWhite !== undefined) {
        timerWhite = prev.timerWhite; timerBlack = prev.timerBlack;
        timerStarted = prev.timerStarted; lastTickTime = Date.now();
    }

    selectedSquare = null; validMoves = [];
    soundMove();
    renderBoard(); updateTurnIndicator(); updateMoveHistory(); updateClockDisplay();
}

// ============================================================
// GAME OVER
// ============================================================

function showGameOver(message) {
    gameOver = true; stopTimerTick();
    document.getElementById('game-over-text').textContent = message;
    document.getElementById('game-over-modal').classList.add('active');

    if (message.indexOf('Draw') !== -1 || message.indexOf('Stalemate') !== -1) {
        // already played
    } else if (message.indexOf('time') !== -1 || message.indexOf('abandoned') !== -1) {
        // already played
    } else if (gameMode === 'local') {
        soundVictory();
    } else if (gameMode === 'online') {
        var weWon =
            (message.indexOf('White wins') !== -1 && playerColor === WHITE) ||
            (message.indexOf('Black wins') !== -1 && playerColor === BLACK);
        if (weWon) soundVictory();
        else soundDefeat();
    }
    updateClockDisplay();
}

// ============================================================
// CLEANUP & INIT
// ============================================================

function cleanupOldGames() {
    var cutoff = Date.now() - (24 * 60 * 60 * 1000);
    db.ref('games').orderByChild('createdAt').endAt(cutoff).once('value', function(snapshot) {
        snapshot.forEach(function(child) { child.ref.remove(); });
    });
}

// Handle page unload — ensure presence is cleaned up
window.addEventListener('beforeunload', function() {
    if (presenceRef) {
        presenceRef.set(false);
    }
});

showLobby();
cleanupOldGames();