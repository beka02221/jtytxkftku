/* ============================================================
   specialgame1.js (оптимизированная версия)
   Что нового:
     1. Во время поиска соперника внизу отображается ссылка для приглашения друга (inviteLink).
     2. Функция copyInviteLink() копирует её в буфер обмена (вызывается, например, из кнопки).
     3. Сохранены все оптимизации:
        - Нет запросов .once() в renderGame
        - Используем .on() для соперника
        - Логика змейки (setInterval ~150 мс)
        - Отрисовка (requestAnimationFrame)
        - Убрали вывод @username соперника в надписи "Соперник найден"
 ============================================================ */

let specialGameCanvas;
let specialCtx;

// Позиция и размеры «игровой зоны» в центре канваса
const GAME_AREA_X = 50;
const GAME_AREA_Y = 175;
const GAME_AREA_WIDTH = 300;
const GAME_AREA_HEIGHT = 500;

// Размер клетки
const gridSize = 20;
const tileCountX = GAME_AREA_WIDTH / gridSize;  
const tileCountY = GAME_AREA_HEIGHT / gridSize; 

// Глобальные идентификаторы комнаты / игроков
let roomId = null;            
let playerId = null;          
let opponentId = null;        
let gameStateRef = null;      

// Локальное состояние нашей змейки
let localSnake = [];
let localDirection = 'right';
let score = 0;

// Локальное состояние соперника (через .on)
let opponentSnake = [];
let opponentScore = 0;
let opponentName = 'Opponent';

// Яблоко
let applePos = { x: 0, y: 0 };

// Флаги
let isGameRunning = false;    
let isGameOver = false;       
let countdownValue = 5;       
let showOpponentNameTimeout = null;

// Таймер (2 мин)
let timerTotal = 120;         
let timerCurrent = 120;       

// Интервалы
let logicTimer = null;        
let countdownInterval = null; 

// Цвета змей: player1 — фиолетовый, player2 — жёлтый
const snakeColors = {
  player1: '#800080',
  player2: '#FFFF00'
};

// Интервал логики (мс) — снизили до 150 мс для более медленной змейки
const LOGIC_INTERVAL = 150;

// Ссылка для приглашения (показываем во время поиска)
let inviteLink = "";

/* ======================================
   1. ИНИЦИАЛИЗАЦИЯ И СБРОС
====================================== */
function initSpecialGame1() {
  specialGameCanvas = document.getElementById('specialGameCanvas');
  specialCtx = specialGameCanvas.getContext('2d');

  resetSpecialGame1();
  drawWaitingScreen();    // Временно рисуем "ожидание"

  findOrCreateRoom();     // Начинаем поиск/создание комнаты
}

function resetSpecialGame1() {
  stopLogicLoop();
  clearInterval(countdownInterval);

  if (showOpponentNameTimeout) {
    clearTimeout(showOpponentNameTimeout);
    showOpponentNameTimeout = null;
  }

  roomId = null;
  playerId = null;
  opponentId = null;
  gameStateRef = null;

  localSnake = [];
  localDirection = 'right';
  score = 0;

  opponentSnake = [];
  opponentScore = 0;
  opponentName = 'Opponent';

  applePos = { x: 0, y: 0 };

  isGameRunning = false;
  isGameOver = false;
  countdownValue = 5;
  timerTotal = 120;
  timerCurrent = 120;

  inviteLink = "";

  removeSwipeListeners();
}

/* ======================================
   2. ПОИСК / СОЗДАНИЕ КОМНАТЫ
====================================== */
function findOrCreateRoom() {
  const queueRef = firebase.database().ref('snakeQueue');
  queueRef.once('value', (snapshot) => {
    const queueData = snapshot.val() || {};

    let openRoomKey = null;
    for (const key in queueData) {
      if (queueData[key].status === 'waiting') {
        openRoomKey = key;
        break;
      }
    }

    if (openRoomKey) {
      // Присоединяемся как player2
      roomId = openRoomKey;
      playerId = 'player2';
      opponentId = 'player1';

      firebase.database().ref('snakeQueue/' + roomId)
        .update({ status: 'ready' })
        .catch((err) => console.error('Error updating room status:', err));
      
      setupGameReferences();
    } else {
      // Создаём новую комнату как player1
      roomId = queueRef.push().key;
      playerId = 'player1';
      opponentId = 'player2';

      queueRef.child(roomId).set({
        status: 'waiting',
        createdAt: firebase.database.ServerValue.TIMESTAMP
      }).catch((err) => console.error('Error creating room:', err));

      setupGameReferences();
    }

    // Сформируем ссылку для приглашения
    // (подставьте ваш реальный адрес, если нужно)
    inviteLink = "https://mygame.example.com/invite?room=" + roomId;

    // Переходим на этап ожидания соперника
    waitForOpponent();
  }, (err) => {
    console.error('Error reading queue:', err);
  });
}

function waitForOpponent() {
  drawSearchScreen(); // "Поиск соперника…" + inviteLink

  const statusRef = firebase.database().ref('snakeQueue/' + roomId + '/status');
  statusRef.on('value', (snapshot) => {
    const currentStatus = snapshot.val();
    if (currentStatus === 'ready') {
      // Соперник зашёл!
      statusRef.off();
      drawOpponentFoundScreen(); 
      showOpponentNameTimeout = setTimeout(() => {
        startCountdown();
      }, 2000);
    }
  });
}

/* ======================================
   3. НАСТРОЙКА gameStateRef и СЛУШАТЕЛЕЙ
====================================== */
function setupGameReferences() {
  gameStateRef = firebase.database().ref('snakeGames/' + roomId);

  // Инициализируем данные нашего игрока (если нет)
  const playerRef = gameStateRef.child('players').child(playerId);
  playerRef.once('value', (snapshot) => {
    if (!snapshot.exists()) {
      // Разные стартовые точки
      let startX, startY;
      if (playerId === 'player1') {
        startX = 3;
        startY = Math.floor(tileCountY / 2);
      } else {
        startX = tileCountX - 4;
        startY = Math.floor(tileCountY / 2);
      }

      const initialSnake = [
        { x: startX,   y: startY },
        { x: startX-1, y: startY },
        { x: startX-2, y: startY }
      ];

      playerRef.set({
        snake: initialSnake,
        direction: 'right',
        score: 0,
        username: window.currentUser ? window.currentUser.username : 'Unknown'
      }).catch((err) => console.error('Error init player data:', err));
    }
  });

  // Подписка на соперника
  const oppRef = gameStateRef.child('players').child(opponentId);
  oppRef.on('value', (snap) => {
    const oppData = snap.val() || {};
    opponentSnake = oppData.snake || [];
    opponentScore = oppData.score || 0;
    opponentName  = oppData.username || 'Opponent';
  });

  // Подписка на яблоко
  gameStateRef.child('apple').on('value', (snapshot) => {
    const aData = snapshot.val() || {};
    if (typeof aData.x === 'number' && typeof aData.y === 'number') {
      applePos.x = aData.x;
      applePos.y = aData.y;
    }
  });

  // Подписка на gameOver
  gameStateRef.child('gameOver').on('value', (snapshot) => {
    if (snapshot.val() === true && !isGameOver) {
      isGameOver = true;
      endGame();
    }
  });
}

/* ======================================
   4. ОБРАТНЫЙ ОТСЧЁТ (5...1) И СТАРТ
====================================== */
function startCountdown() {
  countdownValue = 5;
  countdownInterval = setInterval(() => {
    drawCountdownScreen(countdownValue);
    countdownValue--;
    if (countdownValue < 1) {
      clearInterval(countdownInterval);
      launchGame();
    }
  }, 1000);
}

function launchGame() {
  isGameRunning = true;
  isGameOver = false;

  // Считываем наше состояние
  gameStateRef.child('players').child(playerId).once('value', (snapshot) => {
    const data = snapshot.val();
    if (data && data.snake) {
      localSnake = data.snake;
    }
    localDirection = (data && data.direction) ? data.direction : 'right';
    score = (data && data.score) ? data.score : 0;

    // Проверим яблоко
    gameStateRef.child('apple').once('value', (appleSnap) => {
      if (!appleSnap.exists()) {
        spawnApple();
      }
    });

    addSwipeListeners();

    // Логика игры (setInterval)
    startLogicLoop();

    // Таймер 2 мин
    startTimer();

    // Отрисовка через requestAnimationFrame
    requestAnimationFrame(renderLoop);
  });
}

/* ======================================
   5. РАЗДЕЛЁННЫЕ ЛОГИКА И РЕНДЕР
====================================== */
function startLogicLoop() {
  logicTimer = setInterval(gameLogicUpdate, LOGIC_INTERVAL);
}

function stopLogicLoop() {
  if (logicTimer) {
    clearInterval(logicTimer);
    logicTimer = null;
  }
}

// Каждые 150 мс
function gameLogicUpdate() {
  if (!isGameRunning || isGameOver) return;

  moveLocalSnake();

  // Проверяем столкновения
  if (checkSelfCollision() || checkOpponentCollision()) {
    setGameOver();
    return;
  }

  // Проверяем яблоко
  const head = localSnake[0];
  if (head.x === applePos.x && head.y === applePos.y) {
    score++;
    updatePlayerState(true);
    spawnApple();
  } else {
    updatePlayerState(false);
  }
}

// requestAnimationFrame для плавной отрисовки
function renderLoop() {
  renderGame();
  if (!isGameOver) {
    requestAnimationFrame(renderLoop);
  }
}

/* ======================================
   6. ЛОГИКА ДВИЖЕНИЯ И СТОЛКНОВЕНИЙ
====================================== */
function moveLocalSnake() {
  const head = { ...localSnake[0] };

  switch (localDirection) {
    case 'left':  head.x--; break;
    case 'right': head.x++; break;
    case 'up':    head.y--; break;
    case 'down':  head.y++; break;
  }

  // Проход сквозь стены
  if (head.x < 0) head.x = tileCountX - 1;
  if (head.x >= tileCountX) head.x = 0;
  if (head.y < 0) head.y = tileCountY - 1;
  if (head.y >= tileCountY) head.y = 0;

  // Добавляем новую голову
  localSnake.unshift(head);
  // pop (если не выросла)
  localSnake.pop();
}

function checkSelfCollision() {
  const head = localSnake[0];
  for (let i = 1; i < localSnake.length; i++) {
    if (localSnake[i].x === head.x && localSnake[i].y === head.y) {
      return true;
    }
  }
  return false;
}

function checkOpponentCollision() {
  const head = localSnake[0];
  for (let seg of opponentSnake) {
    if (seg.x === head.x && seg.y === head.y) {
      return true;
    }
  }
  return false;
}

/* ======================================
   7. ОБНОВЛЕНИЕ В FIREBASE
====================================== */
function updatePlayerState(ateApple) {
  if (ateApple) {
    // Возвращаем хвост (змейка растёт)
    const lastSegment = localSnake[localSnake.length - 1];
    localSnake.push({ ...lastSegment });
  }

  gameStateRef.child('players').child(playerId).update({
    snake: localSnake,
    direction: localDirection,
    score: score
  }).catch((err) => console.error('Error updating player state:', err));
}

function spawnApple() {
  const newApple = {
    x: Math.floor(Math.random() * tileCountX),
    y: Math.floor(Math.random() * tileCountY)
  };
  gameStateRef.child('apple').set(newApple)
    .catch((err) => console.error('Error setting apple:', err));
}

/* ======================================
   8. ЗАВЕРШЕНИЕ ИГРЫ
====================================== */
function setGameOver() {
  isGameOver = true;
  gameStateRef.update({ gameOver: true })
    .catch((err) => console.error('Error setting gameOver:', err));
  endGame();
}

function endGame() {
  stopLogicLoop();
  clearInterval(countdownInterval);

  let resultTitle = 'Игра окончена';
  if (score > opponentScore) {
    resultTitle = 'Вы победили!';
  } else if (score < opponentScore) {
    resultTitle = 'Вы проиграли...';
  } else {
    resultTitle = 'Ничья';
  }
  const msg = `Ваш счёт: ${score} | Соперник: ${opponentScore}`;
  window.showEndGameModal(resultTitle, msg);
}

/* ======================================
   9. ТАЙМЕР (2 МИН)
====================================== */
function startTimer() {
  timerCurrent = timerTotal;
  const timerInterval = setInterval(() => {
    if (!isGameRunning || isGameOver) {
      clearInterval(timerInterval);
      return;
    }
    timerCurrent--;
    if (timerCurrent <= 0) {
      setGameOver();
      clearInterval(timerInterval);
    }
  }, 1000);
}

/* ======================================
   10. ОТРИСОВКА (renderGame)
====================================== */
function renderGame() {
  // Очищаем весь canvas
  specialCtx.clearRect(0, 0, specialGameCanvas.width, specialGameCanvas.height);

  // Тёмный фон
  specialCtx.fillStyle = 'rgba(0,0,0,0.8)';
  specialCtx.fillRect(0, 0, specialGameCanvas.width, specialGameCanvas.height);

  // Рисуем "игровую" матричную сетку
  drawMatrixGrid();

  // Яблоко (красное)
  specialCtx.fillStyle = '#FF0000';
  specialCtx.fillRect(
    GAME_AREA_X + applePos.x * gridSize,
    GAME_AREA_Y + applePos.y * gridSize,
    gridSize,
    gridSize
  );

  // Наша змейка (фиолетовая или жёлтая)
  specialCtx.fillStyle = snakeColors[playerId] || '#800080';
  localSnake.forEach(seg => {
    specialCtx.fillRect(
      GAME_AREA_X + seg.x * gridSize,
      GAME_AREA_Y + seg.y * gridSize,
      gridSize,
      gridSize
    );
  });

  // Соперник
  specialCtx.fillStyle = snakeColors[opponentId] || '#FFFF00';
  opponentSnake.forEach(seg => {
    specialCtx.fillRect(
      GAME_AREA_X + seg.x * gridSize,
      GAME_AREA_Y + seg.y * gridSize,
      gridSize,
      gridSize
    );
  });

  // Имя соперника над его головой
  if (opponentSnake.length > 0) {
    const oppHead = opponentSnake[0];
    specialCtx.fillStyle = '#00FF00';
    specialCtx.font = '12px "Press Start 2P", sans-serif';
    specialCtx.fillText(
      opponentName,
      GAME_AREA_X + oppHead.x * gridSize,
      GAME_AREA_Y + oppHead.y * gridSize - 5
    );
  }

  // Имя игрока над головой
  if (localSnake.length > 0) {
    const myHead = localSnake[0];
    specialCtx.fillStyle = '#00FF00';
    specialCtx.font = '12px "Press Start 2P", sans-serif';
    const myName = window.currentUser ? window.currentUser.username : 'You';
    specialCtx.fillText(
      myName,
      GAME_AREA_X + myHead.x * gridSize,
      GAME_AREA_Y + myHead.y * gridSize - 5
    );
  }

  // Счёт (справа вверху "игровой зоны")
  specialCtx.fillStyle = '#00FF00';
  specialCtx.font = '12px "Press Start 2P", sans-serif';
  specialCtx.fillText(`Score: ${score}`, GAME_AREA_X + GAME_AREA_WIDTH - 100, GAME_AREA_Y + 15);
  specialCtx.fillText(`Opp: ${opponentScore}`, GAME_AREA_X + GAME_AREA_WIDTH - 100, GAME_AREA_Y + 30);

  // Тайм-бар
  const barWidth = (timerCurrent / timerTotal) * GAME_AREA_WIDTH;
  specialCtx.fillStyle = '#00FF00';
  specialCtx.fillRect(GAME_AREA_X, GAME_AREA_Y - 5, barWidth, 4);
}

// "Матрица"
function drawMatrixGrid() {
  specialCtx.fillStyle = 'rgba(0, 0, 0, 0.5)';
  specialCtx.fillRect(GAME_AREA_X, GAME_AREA_Y, GAME_AREA_WIDTH, GAME_AREA_HEIGHT);

  specialCtx.strokeStyle = 'rgba(0,255,0,0.3)';
  for (let i = 0; i <= tileCountX; i++) {
    let x = GAME_AREA_X + i * gridSize;
    specialCtx.beginPath();
    specialCtx.moveTo(x, GAME_AREA_Y);
    specialCtx.lineTo(x, GAME_AREA_Y + GAME_AREA_HEIGHT);
    specialCtx.stroke();
  }
  for (let j = 0; j <= tileCountY; j++) {
    let y = GAME_AREA_Y + j * gridSize;
    specialCtx.beginPath();
    specialCtx.moveTo(GAME_AREA_X, y);
    specialCtx.lineTo(GAME_AREA_X + GAME_AREA_WIDTH, y);
    specialCtx.stroke();
  }
  specialCtx.strokeStyle = 'rgb(0,255,0)';
  specialCtx.lineWidth = 2;
  specialCtx.strokeRect(GAME_AREA_X, GAME_AREA_Y, GAME_AREA_WIDTH, GAME_AREA_HEIGHT);
}

/* ======================================
   11. ЭКРАНЫ "ОЖИДАНИЕ / ПОИСК..."
====================================== */
function drawSearchScreen() {
  specialCtx.clearRect(0, 0, specialGameCanvas.width, specialGameCanvas.height);
  specialCtx.fillStyle = '#000';
  specialCtx.fillRect(0, 0, specialGameCanvas.width, specialGameCanvas.height);

  specialCtx.fillStyle = '#00FF00';
  specialCtx.font = '16px "Press Start 2P", sans-serif';
  specialCtx.textAlign = 'center';
  specialCtx.fillText(
    'Поиск соперника...',
    specialGameCanvas.width / 2,
    specialGameCanvas.height / 2
  );

  // Ниже рисуем ссылку для приглашения друга (inviteLink)
  specialCtx.font = '10px "Press Start 2P", sans-serif';
  specialCtx.fillText(
    'Пригласить друга:',
    specialGameCanvas.width / 2,
    specialGameCanvas.height / 2 + 40
  );

  // Чтобы поместить саму ссылку на следующую строчку
  specialCtx.fillText(
    inviteLink,
    specialGameCanvas.width / 2,
    specialGameCanvas.height / 2 + 60
  );

  // Подсказка, как скопировать (зависит от вашей реализации)
  specialCtx.font = '8px "Press Start 2P", sans-serif';
  specialCtx.fillText(
    'Нажмите копировать',
    specialGameCanvas.width / 2,
    specialGameCanvas.height / 2 + 80
  );
}

function drawWaitingScreen() {
  specialCtx.clearRect(0, 0, specialGameCanvas.width, specialGameCanvas.height);
  specialCtx.fillStyle = '#000';
  specialCtx.fillRect(0, 0, specialGameCanvas.width, specialGameCanvas.height);
}

function drawOpponentFoundScreen() {
  specialCtx.clearRect(0, 0, specialGameCanvas.width, specialGameCanvas.height);
  specialCtx.fillStyle = '#000000';
  specialCtx.fillRect(0, 0, specialGameCanvas.width, specialGameCanvas.height);

  specialCtx.fillStyle = '#00FF00';
  specialCtx.font = '16px "Press Start 2P", sans-serif';
  specialCtx.textAlign = 'center';
  specialCtx.fillText(
    'Соперник найден',
    specialGameCanvas.width / 2,
    specialGameCanvas.height / 2
  );
}

/* ======================================
   12. ОБРАТНЫЙ ОТСЧЁТ (5..1)
====================================== */
function drawCountdownScreen(value) {
  specialCtx.clearRect(0, 0, specialGameCanvas.width, specialGameCanvas.height);
  specialCtx.fillStyle = '#000000';
  specialCtx.fillRect(0, 0, specialGameCanvas.width, specialGameCanvas.height);

  specialCtx.fillStyle = '#00FF00';
  specialCtx.font = '48px "Press Start 2P", sans-serif';
  specialCtx.textAlign = 'center';
  specialCtx.fillText(
    value.toString(),
    specialGameCanvas.width / 2,
    specialGameCanvas.height / 2
  );
}

/* ======================================
   13. УПРАВЛЕНИЕ (СВАЙП + КЛАВИШИ)
====================================== */
function addSwipeListeners() {
  let touchStartX = null;
  let touchStartY = null;

  function onTouchStart(e) {
    e.preventDefault();
    const touch = e.touches[0];
    touchStartX = touch.clientX;
    touchStartY = touch.clientY;
  }
  function onTouchMove(e) {
    e.preventDefault();
  }
  function onTouchEnd(e) {
    if (!touchStartX || !touchStartY) return;
    const touch = e.changedTouches[0];
    const dx = touch.clientX - touchStartX;
    const dy = touch.clientY - touchStartY;

    if (Math.abs(dx) > Math.abs(dy)) {
      // Горизонталь
      if (dx > 0 && localDirection !== 'left') {
        localDirection = 'right';
      } else if (dx < 0 && localDirection !== 'right') {
        localDirection = 'left';
      }
    } else {
      // Вертикаль
      if (dy > 0 && localDirection !== 'up') {
        localDirection = 'down';
      } else if (dy < 0 && localDirection !== 'down') {
        localDirection = 'up';
      }
    }
    touchStartX = null;
    touchStartY = null;
  }

  specialGameCanvas.addEventListener('touchstart', onTouchStart, { passive: false });
  specialGameCanvas.addEventListener('touchmove', onTouchMove, { passive: false });
  specialGameCanvas.addEventListener('touchend', onTouchEnd, { passive: false });

  function onKeyDown(e) {
    switch (e.key) {
      case 'ArrowLeft':
        if (localDirection !== 'right') localDirection = 'left';
        break;
      case 'ArrowRight':
        if (localDirection !== 'left') localDirection = 'right';
        break;
      case 'ArrowUp':
        if (localDirection !== 'down') localDirection = 'up';
        break;
      case 'ArrowDown':
        if (localDirection !== 'up') localDirection = 'down';
        break;
    }
  }
  window.addEventListener('keydown', onKeyDown);

  // Сохраняем для remove
  window.__special_onKeyDown = onKeyDown;
  window.__special_onTouchStart = onTouchStart;
  window.__special_onTouchMove = onTouchMove;
  window.__special_onTouchEnd = onTouchEnd;
}

function removeSwipeListeners() {
  if (!specialGameCanvas) return;

  specialGameCanvas.removeEventListener('touchstart', window.__special_onTouchStart);
  specialGameCanvas.removeEventListener('touchmove', window.__special_onTouchMove);
  specialGameCanvas.removeEventListener('touchend', window.__special_onTouchEnd);
  window.removeEventListener('keydown', window.__special_onKeyDown);

  window.__special_onTouchStart = null;
  window.__special_onTouchMove = null;
  window.__special_onTouchEnd = null;
  window.__special_onKeyDown = null;
}

/* ======================================
   14. КОПИРОВАНИЕ ССЫЛКИ (inviteLink)
====================================== */
/**
 * Копирует inviteLink в буфер обмена.
 * Вызывайте, например, из HTML-кнопки:
 * <button onclick="copyInviteLink()">Скопировать ссылку</button>
 */
function copyInviteLink() {
  if (!inviteLink) return;
  navigator.clipboard.writeText(inviteLink)
    .then(() => {
      console.log("Ссылка скопирована:", inviteLink);
      // Можно показать всплывающее уведомление, что скопировано
    })
    .catch(err => console.error("Ошибка при копировании ссылки:", err));
}

/* 
========================================================
Подключение в HTML:
<script src="specialgame1.js"></script>
и в вашем основном коде вызов:
initSpecialGame1();
========================================================
*/
