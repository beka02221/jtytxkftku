/********************************************************
  specialgame1.js

  Онлайн-игра «Змейка» в стиле «Матрицы» с поиском соперника:
  - Экран ожидания с тёмным фоном и пиксельным шрифтом.
  - После нахождения соперника появляется кнопка "Приготовиться".
  - Когда оба игрока готовы, на тёмном экране зелёными цифрами 
    (5,4,3,2,1) идёт обратный отсчёт, затем игра начинается.
  - Управление осуществляется свайпами: смена направления змейки.
  - Каждая змейка имеет свой цвет; яблоки появляются красными.
  - Имя соперника выводится над его змейкой и следует за ней.
  - Если змейка сталкивается с краями, со своим хвостом или со змейкой соперника – проигрыш.
  
  Для корректной работы предполагается, что глобально заданы:
    • db              – firebase.database()
    • currentUser     – объект пользователя (свойство username)
    • showEndGameModal(title, message) – функция показа окна результата
    • finishGame()    – функция завершения игры
    • В HTML имеется <canvas id="specialGameCanvas" width="400" height="600"></canvas>
  
  Структура данных в Firebase (пример):
  games/specialgame1/rooms/<roomKey> = {
    status: "waiting" | "ready" | "countdown" | "playing" | "finished",
    countdownValue: 5,  // при статусе "countdown"
    ready: { player1: false, player2: false },
    apple: { x: 200, y: 200 },
    player1: {
      username: "User1",
      color: "#00FF00",
      direction: "right",   // "up", "down", "left", "right"
      snake: [ {x, y}, {x, y}, ... ], // массив сегментов
      alive: true
    },
    player2: {
      username: "User2",
      color: "#FFFF00",
      direction: "left",
      snake: [ {x, y}, {x, y}, ... ],
      alive: true
    }
  }
********************************************************/

/********************************************************
  ГЛОБАЛЬНЫЕ ПЕРЕМЕННЫЕ
********************************************************/
let specialGameCanvas;
let specialCtx;

let specialGameRoomRef = null;   // Ссылка на комнату в Firebase
let specialGameKey = null;       // Идентификатор комнаты
let localPlayerId = null;        // "player1" или "player2"
let gameState = null;            // Текущее состояние игры (из Firebase)
let animationFrameId = null;     // Для requestAnimationFrame

// Размеры игрового поля (canvas)
const FIELD_WIDTH  = 400;
const FIELD_HEIGHT = 600;  // можно изменить по необходимости

// Размер сегмента змейки (ширина/высота)
const CELL_SIZE = 20;

// Интервал обновления змейки (в мс)
const GAME_SPEED = 150;  // примерно 150 мс между шагами

// Для обратного отсчёта
let countdownInterval = null;

// Переменные для определения свайпа
let touchStartX = 0;
let touchStartY = 0;
let touchEndX   = 0;
let touchEndY   = 0;

/********************************************************
  ИНИЦИАЛИЗАЦИЯ ИГРЫ
********************************************************/
function initSpecialGame1() {
  specialGameCanvas = document.getElementById("specialGameCanvas");
  specialCtx = specialGameCanvas.getContext("2d");

  // Поиск или создание комнаты
  findOrCreateRoom()
    .then(() => {
      // Добавляем обработчики свайпов для управления
      addTouchListeners();
      // Слушаем изменения в комнате (Firebase)
      listenToGameRoom();
      // Запускаем цикл анимации (игровой цикл)
      startGameLoop();
    })
    .catch(err => {
      console.error("Ошибка при инициализации комнаты:", err);
    });
}

/********************************************************
  ПОИСК ИЛИ СОЗДАНИЕ КОМНАТЫ
********************************************************/
async function findOrCreateRoom() {
  const roomsRef = db.ref("games/specialgame1/rooms");

  // Поищем комнату со статусом "waiting"
  const snapshot = await roomsRef.orderByChild("status").equalTo("waiting").once("value");
  const roomsData = snapshot.val() || {};

  let foundRoomKey = null;
  for (let key in roomsData) {
    if (roomsData.hasOwnProperty(key)) {
      foundRoomKey = key;
      break;
    }
  }

  if (foundRoomKey) {
    // Присоединяемся как player2
    specialGameKey = foundRoomKey;
    specialGameRoomRef = roomsRef.child(specialGameKey);
    // Обновляем: задаём player2 и переход в режим "ready"
    await specialGameRoomRef.update({
      "player2/username": currentUser.username,
      ready: { player1: false, player2: false },
      status: "ready"
    });
    localPlayerId = "player2";
  } else {
    // Создаём новую комнату, присваиваем себе player1
    specialGameKey = roomsRef.push().key;
    specialGameRoomRef = roomsRef.child(specialGameKey);

    // Задаём начальное состояние комнаты:
    // — статус "waiting" (ожидание соперника)
    // — пустой объект ready
    // — яблоко в случайном месте
    // — змейки: стартовые позиции, направление, длина 3 сегмента
    const startX = Math.floor(FIELD_WIDTH / 2 / CELL_SIZE) * CELL_SIZE;
    const startY1 = FIELD_HEIGHT - CELL_SIZE * 3;  // player1 снизу
    const startY2 = CELL_SIZE * 2;                   // player2 сверху

    const initialState = {
      status: "waiting",
      countdownValue: 0,
      ready: { player1: false, player2: false },
      apple: {
        x: Math.floor(Math.random() * (FIELD_WIDTH / CELL_SIZE)) * CELL_SIZE,
        y: Math.floor(Math.random() * (FIELD_HEIGHT / CELL_SIZE)) * CELL_SIZE
      },
      player1: {
        username: currentUser.username,
        color: "#00FF00",  // зеленая змейка
        direction: "right",
        snake: [
          { x: startX, y: startY1 },
          { x: startX - CELL_SIZE, y: startY1 },
          { x: startX - 2 * CELL_SIZE, y: startY1 }
        ],
        alive: true
      },
      player2: {
        username: "",
        color: "#FFFF00",  // жёлтая змейка
        direction: "left",
        snake: [
          { x: startX, y: startY2 },
          { x: startX + CELL_SIZE, y: startY2 },
          { x: startX + 2 * CELL_SIZE, y: startY2 }
        ],
        alive: true
      }
    };

    await specialGameRoomRef.set(initialState);
    localPlayerId = "player1";
  }
}

/********************************************************
  СЛУШАТЕЛЬ ИЗМЕНЕНИЙ В КОМНАТЕ (Firebase)
********************************************************/
function listenToGameRoom() {
  if (!specialGameRoomRef) return;
  specialGameRoomRef.on("value", (snapshot) => {
    if (!snapshot.exists()) return;
    gameState = snapshot.val();

    // Если комната в статусе "ready", показываем кнопку "Приготовиться"
    // (Эту кнопку можно реализовать вне canvas в HTML)
    // Если оба игрока нажали, обновляем статус в Firebase в "countdown"
    // (Обработку готовности запускает игрок, у которого localPlayerId === "player1")
    // Если статус "countdown", запускаем обратный отсчёт
    if (gameState.status === "ready") {
      // Если оба уже готовы – переведём статус в "countdown"
      if (gameState.ready.player1 && gameState.ready.player2) {
        specialGameRoomRef.update({ status: "countdown", countdownValue: 5 });
      }
    }

    // Если статус "playing", запускается игровой процесс (в gameLoop)
    checkForWinCondition();
  });
}

/********************************************************
  ОБРАТНЫЙ ОТСЧЁТ (5-1)
********************************************************/
function startCountdownTimer() {
  countdownInterval = setInterval(() => {
    const curVal = (gameState && gameState.countdownValue) || 0;
    if (curVal <= 1) {
      clearInterval(countdownInterval);
      countdownInterval = null;
      specialGameRoomRef.update({ countdownValue: 0, status: "playing" });
    } else {
      specialGameRoomRef.update({ countdownValue: curVal - 1 });
    }
  }, 1000);
}

/********************************************************
  РЕЖИМ ГОТОВНОСТИ (Нажатие кнопки "Приготовиться")
********************************************************/
function onReadyButtonPressed() {
  // Вызывается при нажатии кнопки "Приготовиться"
  if (!specialGameRoomRef || !gameState) return;
  // Обновляем готовность для своего игрока
  const update = {};
  update["ready/" + localPlayerId] = true;
  specialGameRoomRef.update(update);
  // Если localPlayerId === "player1" и оба готовы, то можно запустить обратный отсчёт
  // Остальные клиенты увидят обновление через listenToGameRoom
}

/********************************************************
  ИГРОВОЙ ЦИКЛ
********************************************************/
let lastUpdateTime = 0;
function startGameLoop(timestamp) {
  // Если статус не "playing", продолжаем анимацию, но не двигаем змейки
  if (!lastUpdateTime) lastUpdateTime = timestamp;
  const delta = timestamp - lastUpdateTime;

  if (gameState && gameState.status === "playing" && delta > GAME_SPEED) {
    // Для каждого игрока обновляем позицию змейки, если он alive
    updateSnake("player1");
    updateSnake("player2");

    // Проверяем столкновения
    checkCollisions();

    lastUpdateTime = timestamp;
  }

  render();
  animationFrameId = requestAnimationFrame(startGameLoop);
}

/********************************************************
  ОБНОВЛЕНИЕ ЗМЕЙКИ
********************************************************/
function updateSnake(playerId) {
  if (!gameState || !gameState[playerId] || !gameState[playerId].alive) return;

  const snake = gameState[playerId].snake;
  const direction = gameState[playerId].direction;
  const head = snake[0];

  // Вычисляем новую голову
  let newHead = { x: head.x, y: head.y };
  if (direction === "up") newHead.y -= CELL_SIZE;
  else if (direction === "down") newHead.y += CELL_SIZE;
  else if (direction === "left") newHead.x -= CELL_SIZE;
  else if (direction === "right") newHead.x += CELL_SIZE;

  // Добавляем новую голову в начало массива
  const newSnake = [newHead, ...snake];

  // Если яблоко съедено, не удаляем хвост
  if (newHead.x === gameState.apple.x && newHead.y === gameState.apple.y) {
    // Пересоздаём яблоко в случайном месте
    const newApple = {
      x: Math.floor(Math.random() * (FIELD_WIDTH / CELL_SIZE)) * CELL_SIZE,
      y: Math.floor(Math.random() * (FIELD_HEIGHT / CELL_SIZE)) * CELL_SIZE
    };
    specialGameRoomRef.update({ apple: newApple });
  } else {
    // Иначе удаляем последний сегмент
    newSnake.pop();
  }

  // Обновляем змейку в Firebase
  const update = {};
  update[playerId + "/snake"] = newSnake;
  specialGameRoomRef.update(update);
}

/********************************************************
  ПРОВЕРКА СТОЛКНОВЕНИЙ
********************************************************/
function checkCollisions() {
  if (!gameState) return;

  // Для каждого игрока проверяем столкновения
  ["player1", "player2"].forEach((playerId) => {
    const player = gameState[playerId];
    if (!player || !player.alive) return;
    const head = player.snake[0];

    // Проверка на столкновение со стенами
    if (head.x < 0 || head.x >= FIELD_WIDTH || head.y < 0 || head.y >= FIELD_HEIGHT) {
      onPlayerLose(playerId);
    }

    // Столкновение с собственным хвостом
    for (let i = 1; i < player.snake.length; i++) {
      if (head.x === player.snake[i].x && head.y === player.snake[i].y) {
        onPlayerLose(playerId);
      }
    }

    // Столкновение с противником
    const otherPlayerId = (playerId === "player1") ? "player2" : "player1";
    const other = gameState[otherPlayerId];
    if (other && other.alive) {
      // Если голова игрока пересекается с любым сегментом змейки противника
      other.snake.forEach(segment => {
        if (head.x === segment.x && head.y === segment.y) {
          onPlayerLose(playerId);
        }
      });
    }
  });
}

/********************************************************
  ОБРАБОТКА ПРОИГРЫША
********************************************************/
function onPlayerLose(playerId) {
  // Если игрок проиграл, помечаем его как не alive
  const update = {};
  update[playerId + "/alive"] = false;
  specialGameRoomRef.update(update);
  // И показываем окно результата (победитель – другой)
  let winner = (playerId === "player1") ? gameState.player2.username : gameState.player1.username;
  showEndGameModal("Проигрыш", `Вы проиграли! Победил ${winner}`);
}

/********************************************************
  РИСОВКА (Render)
********************************************************/
function render() {
  // Рисуем тёмный фон с эффектом "Матрицы"
  specialCtx.fillStyle = "#000";
  specialCtx.fillRect(0, 0, FIELD_WIDTH, FIELD_HEIGHT);

  // Если статус "waiting" – экран ожидания
  if (gameState && gameState.status === "waiting") {
    specialCtx.fillStyle = "#0F0";
    specialCtx.font = "24px 'Press Start 2P', monospace";
    specialCtx.textAlign = "center";
    specialCtx.fillText("Поиск соперника...", FIELD_WIDTH/2, FIELD_HEIGHT/2);
    return;
  }

  // Если статус "ready" – показываем кнопку "Приготовиться"
  if (gameState && gameState.status === "ready") {
    specialCtx.fillStyle = "#0F0";
    specialCtx.font = "24px 'Press Start 2P', monospace";
    specialCtx.textAlign = "center";
    specialCtx.fillText("Нажмите 'Приготовиться'", FIELD_WIDTH/2, FIELD_HEIGHT/2);
    return;
  }

  // Если статус "countdown" – показываем обратный отсчёт
  if (gameState && gameState.status === "countdown") {
    specialCtx.fillStyle = "#000";
    specialCtx.fillRect(0, 0, FIELD_WIDTH, FIELD_HEIGHT);
    specialCtx.fillStyle = "#0F0";
    specialCtx.font = "60px 'Press Start 2P', monospace";
    specialCtx.textAlign = "center";
    specialCtx.fillText(String(gameState.countdownValue), FIELD_WIDTH/2, FIELD_HEIGHT/2);
    return;
  }

  // Если статус "finished"
  if (gameState && gameState.status === "finished") {
    specialCtx.fillStyle = "rgba(0,0,0,0.7)";
    specialCtx.fillRect(0, 0, FIELD_WIDTH, FIELD_HEIGHT);
    specialCtx.fillStyle = "#0F0";
    specialCtx.font = "30px 'Press Start 2P', monospace";
    specialCtx.textAlign = "center";
    specialCtx.fillText("Игра завершена", FIELD_WIDTH/2, FIELD_HEIGHT/2);
    return;
  }

  // Статус "playing": рисуем яблоко, змейки и имя соперника над его головой
  // Рисуем яблоко (красное)
  if (gameState && gameState.apple) {
    specialCtx.fillStyle = "#F00";
    specialCtx.fillRect(gameState.apple.x, gameState.apple.y, CELL_SIZE, CELL_SIZE);
  }

  // Рисуем змейки
  ["player1", "player2"].forEach(playerId => {
    const player = gameState[playerId];
    if (!player) return;
    // Рисуем каждую клетку змейки
    specialCtx.fillStyle = player.color;
    player.snake.forEach((segment, index) => {
      specialCtx.fillRect(segment.x, segment.y, CELL_SIZE, CELL_SIZE);
      // Если это голова, и это не наш игрок, выводим его username над головой
      if (index === 0 && playerId !== localPlayerId && player.username) {
        specialCtx.fillStyle = "#0F0";
        specialCtx.font = "16px 'Press Start 2P', monospace";
        specialCtx.textAlign = "center";
        specialCtx.fillText(player.username, segment.x + CELL_SIZE/2, segment.y - 5);
      }
    });
  });
}

/********************************************************
  УПРАВЛЕНИЕ СВАЙПАМИ (Touch Events)
********************************************************/
function addTouchListeners() {
  if (!specialGameCanvas) return;
  specialGameCanvas.addEventListener("touchstart", onTouchStart, false);
  specialGameCanvas.addEventListener("touchmove", onTouchMove, false);
  specialGameCanvas.addEventListener("touchend", onTouchEnd, false);
}

function onTouchStart(e) {
  e.preventDefault();
  const touch = e.touches[0];
  touchStartX = touch.clientX;
  touchStartY = touch.clientY;
}

function onTouchMove(e) {
  // Здесь можно добавить визуальный эффект, если нужно
  e.preventDefault();
}

function onTouchEnd(e) {
  e.preventDefault();
  const touch = e.changedTouches[0];
  touchEndX = touch.clientX;
  touchEndY = touch.clientY;

  const dx = touchEndX - touchStartX;
  const dy = touchEndY - touchStartY;

  // Определяем преобладающее направление свайпа
  if (Math.abs(dx) > Math.abs(dy)) {
    // Горизонтальный свайп
    if (dx > 0) {
      changeDirection("right");
    } else {
      changeDirection("left");
    }
  } else {
    // Вертикальный свайп
    if (dy > 0) {
      changeDirection("down");
    } else {
      changeDirection("up");
    }
  }
}

/********************************************************
  СМЕНА НАПРАВЛЕНИЯ ЗМЕЙКИ
********************************************************/
function changeDirection(newDirection) {
  if (!specialGameRoomRef || !gameState) return;
  // Обновляем только свою змейку; запретим обратное направление
  const currentDir = gameState[localPlayerId].direction;
  if ((currentDir === "up" && newDirection === "down") ||
      (currentDir === "down" && newDirection === "up") ||
      (currentDir === "left" && newDirection === "right") ||
      (currentDir === "right" && newDirection === "left")) {
    return;
  }
  specialGameRoomRef.child(localPlayerId).update({ direction: newDirection });
}

/********************************************************
  СБРОС ИГРЫ
********************************************************/
function resetSpecialGame1() {
  if (specialGameRoomRef) {
    specialGameRoomRef.off();
  }
  if (animationFrameId) {
    cancelAnimationFrame(animationFrameId);
    animationFrameId = null;
  }
  if (specialGameCanvas) {
    specialGameCanvas.removeEventListener("touchstart", onTouchStart);
    specialGameCanvas.removeEventListener("touchmove", onTouchMove);
    specialGameCanvas.removeEventListener("touchend", onTouchEnd);
  }
  if (countdownInterval) {
    clearInterval(countdownInterval);
    countdownInterval = null;
  }
  if (specialGameRoomRef && gameState && gameState.status !== "finished") {
    specialGameRoomRef.update({ status: "finished" });
  }
  specialGameRoomRef = null;
  specialGameKey = null;
  localPlayerId = null;
  gameState = null;
}

/********************************************************
  Экспорт функций для основного скрипта
********************************************************/
window.initSpecialGame1 = initSpecialGame1;
window.resetSpecialGame1 = resetSpecialGame1;
window.onReadyButtonPressed = onReadyButtonPressed;
