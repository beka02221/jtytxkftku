
    /* ============================================================
   specialgame1.js
   PvP-змейка (1 на 1) в стиле "Матрицы" с:
   - Поиском соперника и выводом имени
   - Отсчётом после 2с паузы
   - Полем по центру Canvas
   - Телепортом (сквозь стены)
   - Таймером и синхронизацией через Firebase
   - Свайпы (без закрытия Telegram WebApp)
 ============================================================ */

let specialGameCanvas;
let specialCtx;

// Позиция и размеры «игровой зоны» по центру канваса
const GAME_AREA_X = 50;       // Отступ слева
const GAME_AREA_Y = 175;      // Отступ сверху
const GAME_AREA_WIDTH = 300;
const GAME_AREA_HEIGHT = 300;

// Размер клетки
const gridSize = 20;

// Считаем количество клеток по горизонтали/вертикали
const tileCountX = GAME_AREA_WIDTH / gridSize;  // 15
const tileCountY = GAME_AREA_HEIGHT / gridSize; // 15

// Основные глобальные переменные
let roomId = null;            // ID комнаты в БД Firebase
let playerId = null;          // "player1" или "player2"
let opponentId = null;        // "player2" или "player1"
let gameStateRef = null;      // Ссылка на данные игры (Firebase)
let localSnake = [];          // Координаты тела нашей змейки
let localDirection = 'right'; // Текущее направление
let applePos = { x: 0, y: 0 }; 
let gameInterval = null;      // setInterval для игрового цикла
let countdownInterval = null; // setInterval для обратного отсчёта
let countdownValue = 5;       
let isGameRunning = false;    
let isGameOver = false;       
let score = 0;                
let opponentScore = 0;        
let timerTotal = 120;         // 2 минуты (секунд)
let timerCurrent = 120;       

// Цвета змейки: player1 — фиолетовый, player2 — жёлтый
const snakeColors = {
  player1: '#800080', // фиолетовый
  player2: '#FFFF00'  // жёлтый
};

// Будем хранить username соперника, чтобы отобразить после поиска.
let opponentUsername = 'Opponent';

// Флаг, чтобы показать «Нашли соперника: XXX» и подождать 2с
let showOpponentNameTimeout = null;

// =========== ИНИЦИАЛИЗАЦИЯ ===========

function initSpecialGame1() {
  specialGameCanvas = document.getElementById('specialGameCanvas');
  specialCtx = specialGameCanvas.getContext('2d');

  resetSpecialGame1(); // Сброс предыдущих состояний
  drawWaitingScreen(); // Пока — пустой экран

  // Стартуем поиск соперника
  findOrCreateRoom();
}

// =========== СБРОС (при закрытии/выходе) ===========

function resetSpecialGame1() {
  clearInterval(gameInterval);
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
  applePos = { x: 0, y: 0 };
  gameInterval = null;
  countdownInterval = null;
  countdownValue = 5;
  isGameRunning = false;
  isGameOver = false;
  score = 0;
  opponentScore = 0;
  timerTotal = 120;
  timerCurrent = 120;
  opponentUsername = 'Opponent';

  removeSwipeListeners();
}

// =========== ПОИСК / СОЗДАНИЕ КОМНАТЫ ===========

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
      firebase.database().ref('snakeQueue/' + roomId).update({ status: 'ready' });
      setupGameReferences();
    } else {
      // Создаём новую комнату как player1
      roomId = queueRef.push().key; 
      playerId = 'player1';
      opponentId = 'player2';
      queueRef.child(roomId).set({
        status: 'waiting',
        createdAt: firebase.database.ServerValue.TIMESTAMP
      });
      setupGameReferences();
    }

    waitForOpponent();
  });
}

// =========== ОЖИДАНИЕ СОПЕРНИКА ===========

function waitForOpponent() {
  drawSearchScreen();

  const statusRef = firebase.database().ref('snakeQueue/' + roomId + '/status');
  statusRef.on('value', (snapshot) => {
    const currentStatus = snapshot.val();
    if (currentStatus === 'ready') {
      // Нашли соперника!
      statusRef.off();

      // Получим username соперника для отображения
      const oppRef = gameStateRef.child('players').child(opponentId).child('username');
      oppRef.once('value', (snap) => {
        if (snap.exists()) {
          opponentUsername = snap.val();
        }
        // Сначала выводим имя соперника на 2 секунды
        drawOpponentFoundScreen(opponentUsername);
        showOpponentNameTimeout = setTimeout(() => {
          // Затем запускаем обратный отсчёт
          startCountdown();
        }, 2000);
      });
    }
  });
}

// =========== НАСТРОЙКА ССЫЛОК В БД (gameStateRef) ===========

function setupGameReferences() {
  gameStateRef = firebase.database().ref('snakeGames/' + roomId);

  // Инициализируем начальные данные змейки текущего игрока
  const playerRef = gameStateRef.child('players').child(playerId);
  playerRef.once('value', (snapshot) => {
    if (!snapshot.exists()) {
      // Разные стартовые точки:
      // player1 — слева, player2 — справа
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
        { x: startX-2, y: startY },
      ];

      playerRef.set({
        snake: initialSnake,
        direction: 'right',
        score: 0,
        username: window.currentUser ? window.currentUser.username : 'Unknown'
      });
    }
  });

  // Слушаем игроков — чтобы обновлять счёт соперника
  gameStateRef.child('players').on('value', (snapshot) => {
    const playersData = snapshot.val() || {};
    if (playersData[opponentId]) {
      opponentScore = playersData[opponentId].score || 0;
      // Если у нас вдруг не было имени соперника, подхватим
      if (playersData[opponentId].username) {
        opponentUsername = playersData[opponentId].username;
      }
    }
    if (playersData[playerId]) {
      score = playersData[playerId].score || 0;
    }
  });

  // Слушаем позицию яблока
  gameStateRef.child('apple').on('value', (snapshot) => {
    const aData = snapshot.val() || {};
    if (typeof aData.x === 'number' && typeof aData.y === 'number') {
      applePos.x = aData.x;
      applePos.y = aData.y;
    }
  });

  // Слушаем глобальный флаг gameOver
  gameStateRef.child('gameOver').on('value', (snapshot) => {
    if (snapshot.val() === true && !isGameOver) {
      isGameOver = true;
      endGame();
    }
  });
}

// =========== ОБРАТНЫЙ ОТСЧЁТ (5...1) ===========

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

// =========== ЗАПУСК ИГРЫ (главный цикл) ===========

function launchGame() {
  isGameRunning = true;
  isGameOver = false;

  // Инициализируем локальную копию змейки и направления
  gameStateRef.child('players').child(playerId).once('value', (snapshot) => {
    const data = snapshot.val();
    if (data && data.snake) {
      localSnake = data.snake;
    }
    localDirection = data && data.direction ? data.direction : 'right';

    // Генерируем яблоко, если его нет
    gameStateRef.child('apple').once('value', (appleSnap) => {
      if (!appleSnap.exists()) {
        spawnApple();
      }
    });

    addSwipeListeners();
    // Игровой цикл ~10 раз/сек
    gameInterval = setInterval(gameLoop, 100);

    // Запускаем таймер
    startTimer();
  });
}

// =========== ГЛАВНАЯ ФУНКЦИЯ ИГРОВОГО ЦИКЛА ===========

function gameLoop() {
  if (!isGameRunning || isGameOver) return;

  moveLocalSnake();
  // Столкновение со своим хвостом или соперником?
  if (checkSelfCollision() || checkOpponentCollision()) {
    setGameOver();
    return;
  }

  // Съели яблоко?
  if (localSnake[0].x === applePos.x && localSnake[0].y === applePos.y) {
    score++;
    updatePlayerState(true); // растём
    spawnApple();
  } else {
    updatePlayerState(false); // обычное движение
  }

  renderGame();
}

// =========== ДВИЖЕНИЕ + ПРОХОЖДЕНИЕ СКВОЗЬ СТЕНЫ ===========

function moveLocalSnake() {
  const head = { ...localSnake[0] };
  switch (localDirection) {
    case 'left':
      head.x--;
      break;
    case 'right':
      head.x++;
      break;
    case 'up':
      head.y--;
      break;
    case 'down':
      head.y++;
      break;
  }

  // Проверяем выход за границы (wrap-around)
  if (head.x < 0) head.x = tileCountX - 1;
  if (head.x >= tileCountX) head.x = 0;
  if (head.y < 0) head.y = tileCountY - 1;
  if (head.y >= tileCountY) head.y = 0;

  // Добавляем новую голову
  localSnake.unshift(head);
  // Убираем хвост (если не съели яблоко — удалим позже)
  localSnake.pop();
}

// =========== ПРОВЕРКА СТОЛКНОВЕНИЯ СО СВОИМ ХВОСТОМ ===========

function checkSelfCollision() {
  const head = localSnake[0];
  for (let i = 1; i < localSnake.length; i++) {
    if (localSnake[i].x === head.x && localSnake[i].y === head.y) {
      return true;
    }
  }
  return false;
}

// =========== ПРОВЕРКА СТОЛКНОВЕНИЯ С ОППОНЕНТОМ ===========

function checkOpponentCollision() {
  const head = localSnake[0];
  let collided = false;
  gameStateRef.child('players').child(opponentId).once('value', (snap) => {
    const oppData = snap.val() || {};
    const oppSnake = oppData.snake || [];
    for (let seg of oppSnake) {
      if (seg.x === head.x && seg.y === head.y) {
        collided = true;
        break;
      }
    }
  });
  return collided;
}

// =========== СОХРАНЕНИЕ СОСТОЯНИЯ (ПОСЛЕ ДВИЖЕНИЯ) ===========

function updatePlayerState(ateApple) {
  if (ateApple) {
    // Мы уже удалили хвост (pop), значит сейчас нужно вернуть
    const lastSegment = localSnake[localSnake.length - 1];
    localSnake.push({ ...lastSegment });
  }

  gameStateRef.child('players').child(playerId).update({
    snake: localSnake,
    direction: localDirection,
    score: score
  });
}

// =========== СОЗДАНИЕ НОВОГО ЯБЛОКА ===========

function spawnApple() {
  const newApple = {
    x: Math.floor(Math.random() * tileCountX),
    y: Math.floor(Math.random() * tileCountY),
  };
  gameStateRef.child('apple').set(newApple);
}

// =========== УСТАНОВКА gameOver И ЗАВЕРШЕНИЕ ===========

function setGameOver() {
  isGameOver = true;
  gameStateRef.update({ gameOver: true });
  endGame();
}

function endGame() {
  clearInterval(gameInterval);
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

// =========== ТАЙМЕР 2 МИНУТЫ ===========

function startTimer() {
  timerCurrent = timerTotal;
  const timerInterval = setInterval(() => {
    if (!isGameRunning || isGameOver) {
      clearInterval(timerInterval);
      return;
    }
    timerCurrent--;
    if (timerCurrent <= 0) {
      // Время вышло
      setGameOver();
      clearInterval(timerInterval);
    }
  }, 1000);
}

// =========== ОТРИСОВКА (RENDER) ===========

function renderGame() {
  specialCtx.clearRect(0, 0, specialGameCanvas.width, specialGameCanvas.height);

  // Тёмный фон для всего канваса
  specialCtx.fillStyle = 'rgba(0, 0, 0, 0.8)';
  specialCtx.fillRect(0, 0, specialGameCanvas.width, specialGameCanvas.height);

  // Рисуем сетку только в зоне [GAME_AREA_X, GAME_AREA_Y, GAME_AREA_WIDTH, GAME_AREA_HEIGHT]
  drawMatrixGrid();

  // Яблоко (красное)
  specialCtx.fillStyle = '#FF0000';
  specialCtx.fillRect(
    GAME_AREA_X + applePos.x * gridSize,
    GAME_AREA_Y + applePos.y * gridSize,
    gridSize,
    gridSize
  );

  // Наша змейка
  specialCtx.fillStyle = snakeColors[playerId] || '#800080';
  for (let seg of localSnake) {
    specialCtx.fillRect(
      GAME_AREA_X + seg.x * gridSize,
      GAME_AREA_Y + seg.y * gridSize,
      gridSize,
      gridSize
    );
  }

  // Соперник (запрашиваем snake из БД один раз — лучше хранить локально, но для примера)
  gameStateRef.child('players').child(opponentId).once('value', (snap) => {
    const oppData = snap.val() || {};
    const oppSnake = oppData.snake || [];
    const oppName = oppData.username || 'Opponent';

    // Желтая змея (или другой цвет)
    specialCtx.fillStyle = snakeColors[opponentId] || '#FFFF00';
    for (let seg of oppSnake) {
      specialCtx.fillRect(
        GAME_AREA_X + seg.x * gridSize,
        GAME_AREA_Y + seg.y * gridSize,
        gridSize,
        gridSize
      );
    }

    // Имя соперника над головой
    if (oppSnake.length > 0) {
      const head = oppSnake[0];
      specialCtx.fillStyle = '#00FF00';
      specialCtx.font = '12px "Press Start 2P", sans-serif';
      specialCtx.fillText(
        oppName,
        GAME_AREA_X + head.x * gridSize,
        GAME_AREA_Y + head.y * gridSize - 5
      );
    }
  });

  // Имя игрока над головой его змейки
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

  // Счёт в правом верхнем углу "игровой зоны"
  specialCtx.fillStyle = '#00FF00';
  specialCtx.font = '12px "Press Start 2P", sans-serif';
  specialCtx.fillText(
    `Score: ${score}`,
    GAME_AREA_X + GAME_AREA_WIDTH - 100,
    GAME_AREA_Y + 15
  );
  specialCtx.fillText(
    `Opp: ${opponentScore}`,
    GAME_AREA_X + GAME_AREA_WIDTH - 100,
    GAME_AREA_Y + 30
  );

  // Рисуем тайм-бар (горизонтальная полоска) в самом верху канваса или над сеткой
  const barWidth = (timerCurrent / timerTotal) * GAME_AREA_WIDTH;
  specialCtx.fillStyle = '#00FF00';
  // Пусть будет прямо над сеткой
  specialCtx.fillRect(GAME_AREA_X, GAME_AREA_Y - 5, barWidth, 4);
}

// =========== ДОП. ФУНКЦИИ ОТРИСОВКИ ===========

// Сетка/рамка в зоне [GAME_AREA_X, GAME_AREA_Y, GAME_AREA_WIDTH, GAME_AREA_HEIGHT]
function drawMatrixGrid() {
  // Полупрозрачная заливка
  specialCtx.fillStyle = 'rgba(0, 0, 0, 0.5)';
  specialCtx.fillRect(GAME_AREA_X, GAME_AREA_Y, GAME_AREA_WIDTH, GAME_AREA_HEIGHT);

  // Зелёные линии (горизонтальные / вертикальные)
  specialCtx.strokeStyle = 'rgba(0, 255, 0, 0.3)';
  for (let i = 0; i <= tileCountX; i++) {
    // Вертикаль
    const x = GAME_AREA_X + i * gridSize;
    specialCtx.beginPath();
    specialCtx.moveTo(x, GAME_AREA_Y);
    specialCtx.lineTo(x, GAME_AREA_Y + GAME_AREA_HEIGHT);
    specialCtx.stroke();
  }
  for (let j = 0; j <= tileCountY; j++) {
    // Горизонталь
    const y = GAME_AREA_Y + j * gridSize;
    specialCtx.beginPath();
    specialCtx.moveTo(GAME_AREA_X, y);
    specialCtx.lineTo(GAME_AREA_X + GAME_AREA_WIDTH, y);
    specialCtx.stroke();
  }

  // Яркая зелёная рамка по периметру
  specialCtx.strokeStyle = 'rgb(0, 255, 0)';
  specialCtx.lineWidth = 2;
  specialCtx.strokeRect(GAME_AREA_X, GAME_AREA_Y, GAME_AREA_WIDTH, GAME_AREA_HEIGHT);
}

// Рисуем экран "Поиск соперника..."
function drawSearchScreen() {
  specialCtx.clearRect(0, 0, specialGameCanvas.width, specialGameCanvas.height);
  specialCtx.fillStyle = '#000000';
  specialCtx.fillRect(0, 0, specialGameCanvas.width, specialGameCanvas.height);

  specialCtx.fillStyle = '#00FF00';
  specialCtx.font = '16px "Press Start 2P", sans-serif';
  specialCtx.textAlign = 'center';
  specialCtx.fillText(
    'Поиск соперника...',
    specialGameCanvas.width / 2,
    specialGameCanvas.height / 2
  );
}

// Простой экран "Ожидание..."
function drawWaitingScreen() {
  specialCtx.clearRect(0, 0, specialGameCanvas.width, specialGameCanvas.height);
  specialCtx.fillStyle = '#000';
  specialCtx.fillRect(0, 0, specialGameCanvas.width, specialGameCanvas.height);
}

// Когда нашли соперника, показываем его имя 2с
function drawOpponentFoundScreen(name) {
  specialCtx.clearRect(0, 0, specialGameCanvas.width, specialGameCanvas.height);
  specialCtx.fillStyle = '#000000';
  specialCtx.fillRect(0, 0, specialGameCanvas.width, specialGameCanvas.height);

  specialCtx.fillStyle = '#00FF00';
  specialCtx.font = '16px "Press Start 2P", sans-serif';
  specialCtx.textAlign = 'center';
  specialCtx.fillText(
    `Соперник найден: @${name}`,
    specialGameCanvas.width / 2,
    specialGameCanvas.height / 2
  );
}

// Отрисовка обратного отсчёта
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

// =========== СВАЙПЫ / КЛАВИШИ УПРАВЛЕНИЯ ===========

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
      // Горизонтальный свайп
      if (dx > 0 && localDirection !== 'left') {
        localDirection = 'right';
      } else if (dx < 0 && localDirection !== 'right') {
        localDirection = 'left';
      }
    } else {
      // Вертикальный свайп
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

  // Сохраняем ссылки, чтобы потом снять подписки
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

/* =============================================
   Экспортируем (если нужно), иначе достаточно
   просто подключить <script src="specialgame1.js">
============================================= */
