/* ============================================================
   specialgame1.js
   Реализация онлайн-змейки (1 на 1) в стиле "Матрицы" с:
   1) Поиском соперника
   2) Обратным отсчётом 5...1
   3) 2-минутным таймером с прогресс-баром
   4) Синхронизацией позиций через Firebase Realtime Database
   5) Свайпы для управления (и отключение "свайпа вниз" в TG)
   6) Модалкой результата по окончании
   7) Разным цветом змей для игроков, красными яблоками
   8) Полупрозрачным полем в стиле "Матрицы" и зелёной рамкой
 ============================================================ */

let specialGameCanvas;
let specialCtx;

// Основные глобальные переменные
let roomId = null;             // ID комнаты в БД Firebase
let playerId = null;           // "player1" или "player2"
let opponentId = null;         // Кто соперник
let gameStateRef = null;       // Ссылка на данные игры (Firebase)
let localSnake = [];           // Массив с координатами тела нашей змейки
let localDirection = 'right';  // Текущее направление (начальное)
let applePos = { x: 0, y: 0 }; // Позиция яблока
let gridSize = 20;             // Размер одного "квадратика" (пикселей)
let tileCountX = 20;           // Сколько клеток по горизонтали (400 / 20 = 20)
let tileCountY = 10;           // Сколько клеток по вертикали   (200 / 20 = 10)
let gameInterval = null;       // setInterval для игрового цикла
let countdownInterval = null;  // setInterval для обратного отсчёта
let countdownValue = 5;        // Начальный отсчёт перед стартом
let isGameRunning = false;     // Игра запущена или нет
let isGameOver = false;        // Флаг окончания
let score = 0;                 // Наш счёт
let opponentScore = 0;         // Счёт соперника
let timerTotal = 120;          // Всего секунд (2 минуты)
let timerCurrent = 120;        // Оставшееся время

// Цвета змейки для каждого игрока
// player1 — зелёная, player2 — салатовая (пример)
const snakeColors = {
  player1: '#00FF00',
  player2: '#ADFF2F'
};

// === ИНИЦИАЛИЗАЦИЯ (вызывается из основного кода) ===
function initSpecialGame1() {
  specialGameCanvas = document.getElementById('specialGameCanvas');
  specialCtx = specialGameCanvas.getContext('2d');

  // Обнуляем
  resetSpecialGame1();

  // Очищаем поле
  drawWaitingScreen();

  // Запускаем поиск комнаты (или создание)
  findOrCreateRoom();
}

// === СБРОС (вызывается при выходе из игры/закрытии модалки) ===
function resetSpecialGame1() {
  clearInterval(gameInterval);
  clearInterval(countdownInterval);
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

  // Удалим слушатели (чтобы не плодились)
  removeSwipeListeners();
}

// === ПОИСК / СОЗДАНИЕ КОМНАТЫ ===
function findOrCreateRoom() {
  // Создадим ссылку на "очередь" в Firebase
  const queueRef = firebase.database().ref('snakeQueue');
  queueRef.once('value', (snapshot) => {
    const queueData = snapshot.val() || {};

    // Ищем существующую комнату, которая в статусе waiting
    let openRoomKey = null;
    for (const key in queueData) {
      if (queueData[key].status === 'waiting') {
        openRoomKey = key;
        break;
      }
    }

    if (openRoomKey) {
      // Нашли открытую комнату, присоединяемся
      roomId = openRoomKey;
      playerId = 'player2';
      opponentId = 'player1';

      // Обновим статус комнаты в БД
      firebase.database().ref('snakeQueue/' + roomId).update({
        status: 'ready'
      });

      // Переходим к настройке самой игры
      setupGameReferences();
    } else {
      // Нет доступных комнат — создаём новую
      roomId = queueRef.push().key; // генерируем unique key
      playerId = 'player1';
      opponentId = 'player2';

      // Запишем "waiting" в эту комнату
      const newRoomData = {
        status: 'waiting',
        createdAt: firebase.database.ServerValue.TIMESTAMP
      };
      // Сохраняем в snakeQueue
      firebase.database().ref('snakeQueue/' + roomId).set(newRoomData);

      // Настраиваем игру
      setupGameReferences();
    }

    // Запускаем экран "Поиск соперника..."
    // (на случай, если мы player1 и ждём, пока придёт player2)
    waitForOpponent();
  });
}

// === ОЖИДАНИЕ СОПЕРНИКА ===
function waitForOpponent() {
  // Рисуем экран ожидания
  drawSearchScreen();

  // Подпишемся на изменения статуса комнаты
  const statusRef = firebase.database().ref('snakeQueue/' + roomId + '/status');
  statusRef.on('value', (snapshot) => {
    const currentStatus = snapshot.val();
    if (currentStatus === 'ready') {
      // Соперник найден!
      // Снимаем слушатель, чтобы не повторялось
      statusRef.off();

      startCountdown();
    }
  });
}

// === НАСТРАИВАЕМ ССЫЛКИ В БД ДЛЯ СОСТОЯНИЯ ИГРЫ ===
function setupGameReferences() {
  // gameStateRef — отдельная ветка для конкретной комнаты
  gameStateRef = firebase.database().ref('snakeGames/' + roomId);

  // Записываем начальные данные для каждого игрока (если их нет)
  // Запись делаем в формате: snakeGames/<roomId>/players/player1 ...
  const playerRef = gameStateRef.child('players').child(playerId);
  playerRef.once('value', (snapshot) => {
    if (!snapshot.exists()) {
      // Инициализируем начальное состояние змейки
      const startX = playerId === 'player1' ? 3 : tileCountX - 4;
      const startY = Math.floor(tileCountY / 2);

      const initialSnake = [
        { x: startX, y: startY },
        { x: startX - 1, y: startY },
        { x: startX - 2, y: startY }
      ];

      playerRef.set({
        snake: initialSnake,
        direction: 'right',
        score: 0,
        username: window.currentUser ? window.currentUser.username : 'Guest'
      });
    }
  });

  // Слушаем обновления общего состояния (позиции змейки соперника, яблока и т.д.)
  gameStateRef.child('players').on('value', (snapshot) => {
    const playersData = snapshot.val() || {};
    if (playersData[opponentId]) {
      opponentScore = playersData[opponentId].score || 0;
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

  // Слушаем глобальный флаг окончания игры
  gameStateRef.child('gameOver').on('value', (snapshot) => {
    if (snapshot.val() === true && !isGameOver) {
      // Если кто-то уже завершил, просто "завершаемся"
      isGameOver = true;
      endGame();
    }
  });
}

// === СТАРТ ОБРАТНОГО ОТСЧЁТА (5...1) ===
function startCountdown() {
  countdownValue = 5;
  countdownInterval = setInterval(() => {
    drawCountdownScreen(countdownValue);

    countdownValue--;
    if (countdownValue < 1) {
      clearInterval(countdownInterval);
      // Готово, запускаем игру
      launchGame();
    }
  }, 1000);
}

// === ЗАПУСК ИГРЫ (главный цикл) ===
function launchGame() {
  isGameRunning = true;
  isGameOver = false;

  // Инициализируем локальные данные змейки (чтобы мы могли двигать её)
  gameStateRef.child('players').child(playerId).once('value', (snapshot) => {
    const data = snapshot.val();
    if (data && data.snake) {
      localSnake = data.snake;
    }
    // Запишем начальное направление
    localDirection = data && data.direction ? data.direction : 'right';

    // Если яблока нет — сгенерируем
    gameStateRef.child('apple').once('value', (appleSnap) => {
      if (!appleSnap.exists()) {
        spawnApple();
      }
    });

    // Добавим обработчики свайпов/клавиш
    addSwipeListeners();

    // Запускаем игровой цикл ~ 10 раз/сек
    gameInterval = setInterval(gameLoop, 100);

    // Запускаем таймер 2 минуты
    startTimer();
  });
}

// === ГЛАВНАЯ ФУНКЦИЯ ИГРОВОГО ЦИКЛА ===
function gameLoop() {
  if (!isGameRunning || isGameOver) return;

  // 1) Обновляем локальное состояние (змейку) на основе направления
  moveLocalSnake();

  // 2) Проверяем столкновения
  if (checkCollision()) {
    // Завершаем игру (мы проиграли)
    setGameOver();
    return;
  }

  // 3) Проверяем съедение яблока
  if (localSnake[0].x === applePos.x && localSnake[0].y === applePos.y) {
    // Увеличиваем счёт
    score++;
    // Увеличиваем длину змейки (не удаляем хвост)
    updatePlayerState(true);
    // Генерируем новое яблоко
    spawnApple();
  } else {
    // Обычное движение (без роста)
    updatePlayerState(false);
  }

  // 4) Отрисовываем всё
  renderGame();
}

// === ДВИЖЕНИЕ ЛОКАЛЬНОЙ ЗМЕЙКИ ===
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

  // Добавляем новую голову
  localSnake.unshift(head);
  // Убираем хвост (если не съедено яблоко — это сделаем позже)
  localSnake.pop();
}

// === ПРОВЕРКА СТОЛКНОВЕНИЙ ===
function checkCollision() {
  const head = localSnake[0];

  // 1) Столкновение с границами
  if (
    head.x < 0 ||
    head.x >= tileCountX ||
    head.y < 0 ||
    head.y >= tileCountY
  ) {
    return true;
  }

  // 2) Столкновение со своим хвостом
  for (let i = 1; i < localSnake.length; i++) {
    if (localSnake[i].x === head.x && localSnake[i].y === head.y) {
      return true;
    }
  }

  // 3) Столкновение с соперником (требуется соперника загрузить из БД)
  //   Можно хранить копию соперника локально,
  //   но здесь для простоты сделаем синхронный вызов once (не очень эффективно).
  //   Для продакшена лучше подписаться на on('value'), хранить локально.
  let collidedWithOpponent = false;
  gameStateRef.child('players').child(opponentId).once('value', (snap) => {
    const oppData = snap.val() || {};
    const oppSnake = oppData.snake || [];
    for (let segment of oppSnake) {
      if (segment.x === head.x && segment.y === head.y) {
        collidedWithOpponent = true;
        break;
      }
    }
  });
  if (collidedWithOpponent) return true;

  return false;
}

// === ОБНОВЛЕНИЕ СОСТОЯНИЯ В БД (POS, SCORE) ===
function updatePlayerState(ateApple) {
  // Если съели яблоко — не удаляем хвост
  if (ateApple) {
    // Добавили голову (moveLocalSnake), значит нужно вернуть удалённый "pop"
    // Но здесь мы уже "pop" сделали, поэтому просто добавим один сегмент в хвост
    const lastSegment = localSnake[localSnake.length - 1];
    localSnake.push({ ...lastSegment });
  }

  // Обновляем в БД
  gameStateRef.child('players').child(playerId).update({
    snake: localSnake,
    direction: localDirection,
    score: score
  });
}

// === СОЗДАНИЕ ЯБЛОКА В СЛУЧАЙНОЙ ТОЧКЕ ===
function spawnApple() {
  const newApple = {
    x: Math.floor(Math.random() * tileCountX),
    y: Math.floor(Math.random() * tileCountY)
  };
  gameStateRef.child('apple').set(newApple);
}

// === УСТАНОВКА ФЛАГА ОКОНЧАНИЯ ИГРЫ ===
function setGameOver() {
  isGameOver = true;
  gameStateRef.update({
    gameOver: true
  });
  endGame();
}

// === ДОПОЛНИТЕЛЬНАЯ ФУНКЦИЯ ЗАВЕРШЕНИЯ (ОТОБРАЗИТ МОДАЛКУ) ===
function endGame() {
  clearInterval(gameInterval);
  clearInterval(countdownInterval);

  // Вычислим итог: кто победил
  let resultTitle = 'Игра окончена';
  if (score > opponentScore) {
    resultTitle = 'Вы победили!';
  } else if (score < opponentScore) {
    resultTitle = 'Вы проиграли...';
  } else {
    resultTitle = 'Ничья';
  }

  // Показываем глобальную модалку конца игры
  // (Используем уже готовую функцию showEndGameModal из основного кода)
  const resultMessage = `Ваш счёт: ${score} | Счёт соперника: ${opponentScore}`;
  window.showEndGameModal(resultTitle, resultMessage);
}

// === ТАЙМЕР 2 МИНУТЫ ===
function startTimer() {
  timerCurrent = timerTotal;
  const timerInterval = setInterval(() => {
    if (!isGameRunning || isGameOver) {
      clearInterval(timerInterval);
      return;
    }

    timerCurrent--;
    if (timerCurrent <= 0) {
      // Время вышло — завершаем
      setGameOver();
      clearInterval(timerInterval);
    }
  }, 1000);
}

// === ОТРИСОВКА ИГРЫ ===
function renderGame() {
  // Очищаем канвас
  specialCtx.clearRect(0, 0, specialGameCanvas.width, specialGameCanvas.height);

  // Фон в стиле "Матрица" (тёмный + чуть прозрачный)
  specialCtx.fillStyle = 'rgba(0, 0, 0, 0.8)';
  specialCtx.fillRect(0, 0, specialGameCanvas.width, specialGameCanvas.height);

  // Сетка / "Матрица": рисуем зелёные линии
  specialCtx.strokeStyle = 'rgba(0, 255, 0, 0.3)';
  for (let i = 0; i < tileCountX; i++) {
    specialCtx.beginPath();
    specialCtx.moveTo(i * gridSize, 0);
    specialCtx.lineTo(i * gridSize, specialGameCanvas.height);
    specialCtx.stroke();
  }
  for (let j = 0; j < tileCountY; j++) {
    specialCtx.beginPath();
    specialCtx.moveTo(0, j * gridSize);
    specialCtx.lineTo(specialGameCanvas.width, j * gridSize);
    specialCtx.stroke();
  }

  // Границы (зелёная рамка)
  specialCtx.strokeStyle = 'rgba(0, 255, 0, 1)';
  specialCtx.lineWidth = 2;
  specialCtx.strokeRect(0, 0, specialGameCanvas.width, specialGameCanvas.height);

  // Рисуем яблоко (красным)
  specialCtx.fillStyle = '#FF0000';
  specialCtx.fillRect(applePos.x * gridSize, applePos.y * gridSize, gridSize, gridSize);

  // Рисуем нашу змейку
  specialCtx.fillStyle = snakeColors[playerId] || '#00FF00';
  for (let seg of localSnake) {
    specialCtx.fillRect(seg.x * gridSize, seg.y * gridSize, gridSize, gridSize);
  }

  // Рисуем змейку соперника (запросим из БД)
  // (лучше хранить локально через on('value'), но сделаем упрощённо)
  gameStateRef.child('players').child(opponentId).once('value', (snap) => {
    const oppData = snap.val() || {};
    const oppSnake = oppData.snake || [];
    const oppName = oppData.username || 'Opponent';
    specialCtx.fillStyle = snakeColors[opponentId] || '#ADFF2F';
    for (let seg of oppSnake) {
      specialCtx.fillRect(seg.x * gridSize, seg.y * gridSize, gridSize, gridSize);
    }

    // Имя соперника над "головой"
    if (oppSnake.length > 0) {
      const oppHead = oppSnake[0];
      specialCtx.fillStyle = '#00FF00';
      specialCtx.font = '12px "Press Start 2P", sans-serif';
      specialCtx.fillText(
        oppName,
        oppHead.x * gridSize,
        oppHead.y * gridSize - 5
      );
    }
  });

  // Имя игрока над его головой
  if (localSnake.length > 0) {
    const head = localSnake[0];
    specialCtx.fillStyle = '#00FF00';
    specialCtx.font = '12px "Press Start 2P", sans-serif';
    const myName = window.currentUser ? window.currentUser.username : 'You';
    specialCtx.fillText(myName, head.x * gridSize, head.y * gridSize - 5);
  }

  // Отображаем счёт
  specialCtx.fillStyle = '#00FF00';
  specialCtx.font = '12px "Press Start 2P", sans-serif';
  specialCtx.fillText(`Score: ${score}`, 10, 15);
  specialCtx.fillText(`Opp: ${opponentScore}`, 10, 30);

  // Рисуем тайм-бар (2 минуты)
  let barWidth = (timerCurrent / timerTotal) * specialGameCanvas.width;
  specialCtx.fillStyle = '#00FF00';
  specialCtx.fillRect(0, 0, barWidth, 4);
}

// === ОТРИСОВКА ЭКРАНА "ПОИСК СОПЕРНИКА" ===
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

// === ОТРИСОВКА ЭКРАНА "ОЖИДАНИЕ" (если нужно) ===
function drawWaitingScreen() {
  specialCtx.clearRect(0, 0, specialGameCanvas.width, specialGameCanvas.height);
  specialCtx.fillStyle = '#000';
  specialCtx.fillRect(0, 0, specialGameCanvas.width, specialGameCanvas.height);
}

// === ОТРИСОВКА ОБРАТНОГО ОТСЧЁТА ===
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

// =============== УПРАВЛЕНИЕ (СВАЙПЫ / КЛАВИШИ) ===============

// Добавить слушатели свайпов и клавиш
function addSwipeListeners() {
  // Для смартфонов/планшетов
  let touchStartX = null;
  let touchStartY = null;

  function onTouchStart(e) {
    // Сразу отменяем возможное поведение (чтобы не закрывался Telegram)
    e.preventDefault();
    // Берём первую точку касания
    const touch = e.touches[0];
    touchStartX = touch.clientX;
    touchStartY = touch.clientY;
  }

  function onTouchMove(e) {
    // Отменяем стандартное
    e.preventDefault();
  }

  function onTouchEnd(e) {
    // Сравниваем координаты
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

  // Для клавиатуры (при игре на ПК)
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

  // Сохраним функции в глобальные переменные, чтобы потом удалить
  window.__special_onKeyDown = onKeyDown;
  window.__special_onTouchStart = onTouchStart;
  window.__special_onTouchMove = onTouchMove;
  window.__special_onTouchEnd = onTouchEnd;
}

// Удалить слушатели свайпов/клавиш (при ресете)
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

