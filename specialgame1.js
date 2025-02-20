/************************************************************
  PvP Snake "Matrix Style" via Firebase
  --------------------------------------
  1) Поиск соперника (status="waiting")
  2) Готовность (readyCheck) + кнопка "Приготовиться"
  3) Отсчёт 5..1 (countdown)
  4) Игровой процесс (playing)
  5) Завершение (finished)

  - Управление свайпами
  - Каждый ход обновляет только player1 (host)
  - Столкновения: стена, свой хвост, соперник
  - Яблоки: красные, даёт +1 к длине
  - "username" над змейкой соперника
************************************************************/

/*
  ПРЕДПОЛОЖЕНИЯ/ОКРУЖЕНИЕ:
    - const db = firebase.database();            // Firebase
    - const currentUser = { username: "..." };   // Telegram user
    - showEndGameModal(title, msg)               // показать итог
    - finishGame()                               // закрытие модалки
    - HTML canvas id="specialGameCanvas" (размер, например, 400x650)
    - Кнопка "Приготовиться" в HTML (по желанию), 
      или создавайте её динамически.
    - Оформление "матрицы" (зелёный текст на чёрном) делается в CSS.

  ИСПОЛЬЗОВАНИЕ:
    В основном коде:
      1) initSpecialGame1()
      2) resetSpecialGame1() при выходе
*/

/********************************************************
  ГЛОБАЛЬНЫЕ ПЕРЕМЕННЫЕ
********************************************************/
let specialGameCanvas;
let specialCtx;
let specialGameRoomRef = null;
let specialGameKey     = null;
let localPlayerId      = null;   // 'player1' или 'player2'
let gameState          = null;   // данные Firebase
let animationFrameId   = null;

// Размер поля (сетка)
const CELL_SIZE = 20;         // px на клетку
const COLS      = 20;         // ширина поля в клетках => 400 px
const ROWS      = 20;         // высота поля в клетках => 400 px (пример)

// Чтобы поле занимало центральную часть canvas 400x650,
// можно сверху нарисовать поле 400x400, а снизу - чёрная зона.
// Но для упрощения - будем использовать только 400x400.

const TICK_INTERVAL = 200; // скорость игры (мс между шагами)

// Для обратного отсчёта
let countdownInterval = null;

// Локальные переменные для отслеживания свайпов
let touchStartX = 0;
let touchStartY = 0;

/********************************************************
  ИНИЦИАЛИЗАЦИЯ
********************************************************/
function initSpecialGame1() {
  specialGameCanvas = document.getElementById("specialGameCanvas");
  specialCtx = specialGameCanvas.getContext("2d");

  findOrCreateRoom()
    .then(() => {
      addTouchListeners();
      listenToGameRoom();

      // Запускаем рендер-цикл
      startRenderLoop();

      // Если хотим кнопку "Приготовиться" в коде (можно и в HTML):
      createOrShowReadyButton();
    })
    .catch(err => {
      console.error("Ошибка при инициализации:", err);
    });
}

/********************************************************
  ПОИСК/СОЗДАНИЕ КОМНАТЫ
********************************************************/
async function findOrCreateRoom() {
  const roomsRef = db.ref("games/specialgame1/rooms");

  // 1) Поищем комнату со статусом "waiting"
  const snap = await roomsRef.orderByChild("status").equalTo("waiting").once("value");
  const data = snap.val() || {};

  let foundKey = null;
  for (let key in data) {
    if (data.hasOwnProperty(key)) {
      foundKey = key;
      break;
    }
  }

  if (foundKey) {
    // Подключаемся как player2
    specialGameKey = foundKey;
    specialGameRoomRef = roomsRef.child(foundKey);

    // Переходим к readyCheck
    await specialGameRoomRef.update({
      "player2/username": currentUser.username,
      "player2/ready": false,
      status: "readyCheck"
    });
    localPlayerId = "player2";

  } else {
    // Создаём новую
    specialGameKey = roomsRef.push().key;
    specialGameRoomRef = roomsRef.child(specialGameKey);

    // Начальные змейки
    // player1 в левом нижнем углу, player2 - (когда придёт)
    // но пока username="", ready=false
    const startData = {
      status: "waiting",
      countdownValue: 0,
      // player1 snake
      player1: {
        username: currentUser.username,
        ready: false,
        color: "#00FF00", // зелёная
        dir: "up",        // направление
        // массив сегментов [ {x,y}, ... ] (начальная длина = 3)
        snake: [
          { x: 5, y: 15 },
          { x: 5, y: 16 },
          { x: 5, y: 17 }
        ],
        alive: true
      },
      // player2 пока будет заполнено при подключении
      player2: {
        username: "",
        ready: false,
        color: "#00FFFF", // бирюза
        dir: "up",
        snake: [
          { x: 14, y: 15 },
          { x: 14, y: 16 },
          { x: 14, y: 17 }
        ],
        alive: true
      },
      // Яблоко (одно), сгенерируем тут
      apple: {
        x: Math.floor(Math.random() * COLS),
        y: Math.floor(Math.random() * ROWS)
      }
    };

    await specialGameRoomRef.set(startData);
    localPlayerId = "player1";
  }
}

/********************************************************
  СОБЫТИЯ ОТ BД
********************************************************/
function listenToGameRoom() {
  if (!specialGameRoomRef) return;

  specialGameRoomRef.on("value", snap => {
    if (!snap.exists()) return;
    const data = snap.val();
    gameState = data;

    if (data.status === "finished") {
      // Игра закончена, можно показать результат
      // Кто жив — тот победил
      const p1Alive = data.player1.alive;
      const p2Alive = data.player2.alive;

      let winner = "Ничья?";
      if (p1Alive && !p2Alive) winner = data.player1.username;
      if (!p1Alive && p2Alive) winner = data.player2.username;

      showEndGameModal("Игра завершена", `Победил: ${winner}`);
    }

    // Если мы player1 (host) и статус = "countdown", нужно вести отсчёт
    if (localPlayerId === "player1" && data.status === "countdown") {
      if (!countdownInterval) {
        startCountdown();
      }
    }

    // Если мы player1 и статус = "playing" — запускаем игровой цикл (tick)
    // (В простом варианте можно запускать таймер один раз)
    if (localPlayerId === "player1" && data.status === "playing") {
      // Запустим таймер-тик, если ещё не запущен
      if (!gameTickActive) {
        startGameTick();
      }
    }
  });
}

/********************************************************
  КНОПКА "ПРИГОТОВИТЬСЯ"
********************************************************/
function createOrShowReadyButton() {
  // Предположим, в HTML есть кнопка с id="readyBtn", скрытая по умолчанию
  // Если нет — создадим динамически.
  let btn = document.getElementById("readyBtn");
  if (!btn) {
    btn = document.createElement("button");
    btn.id = "readyBtn";
    btn.textContent = "Приготовиться";
    // Стили в "матрица"-стиле, например:
    btn.style.position = "absolute";
    btn.style.left = "50%";
    btn.style.top = "60%";
    btn.style.transform = "translateX(-50%)";
    btn.style.padding = "10px 20px";
    btn.style.fontFamily = "monospace";
    btn.style.fontSize = "18px";
    btn.style.color = "#00FF00";
    btn.style.background = "#000";
    btn.style.border = "1px solid #00FF00";
    document.body.appendChild(btn);
  }

  btn.style.display = "none";
  // Отслеживаем состояние и показываем кнопку только,
  // когда status = "readyCheck" и мы ещё не готовы
  function checkButtonVisibility() {
    if (!gameState) return;
    if (gameState.status === "readyCheck") {
      const me = gameState[localPlayerId];
      if (!me.ready) {
        btn.style.display = "block";
      } else {
        btn.style.display = "none";
      }
    } else {
      btn.style.display = "none";
    }
  }
  // Каждые 500 мс проверим
  setInterval(checkButtonVisibility, 500);

  // Обработчик нажатия
  btn.onclick = () => {
    if (!specialGameRoomRef || !gameState) return;
    // Ставим флаг ready=true
    specialGameRoomRef.child(localPlayerId).update({ ready: true })
      .then(() => {
        // Проверяем, готовы ли оба
        const p1 = gameState.player1;
        const p2 = gameState.player2;
        if (p1.ready && p2.ready) {
          // Меняем статус на countdown
          specialGameRoomRef.update({
            status: "countdown",
            countdownValue: 5
          });
        }
      })
      .catch(err => console.error(err));
  };
}

/********************************************************
  СТАРТ ОБРАТНОГО ОТСЧЁТА (ТОЛЬКО У HOST = player1)
********************************************************/
let countdownInterval = null;
function startCountdown() {
  clearInterval(countdownInterval);
  countdownInterval = setInterval(() => {
    if (!gameState) return;
    let val = gameState.countdownValue || 0;
    if (val <= 1) {
      // Ставим 0, статус=playing
      clearInterval(countdownInterval);
      countdownInterval = null;
      specialGameRoomRef.update({
        countdownValue: 0,
        status: "playing"
      });
    } else {
      val--;
      specialGameRoomRef.update({ countdownValue: val });
    }
  }, 1000);
}

/********************************************************
  ГЛАВНЫЙ ИГРОВОЙ ЦИКЛ (player1)
********************************************************/
let gameTickActive = false;
function startGameTick() {
  if (gameTickActive) return;
  gameTickActive = true;

  function tick() {
    if (!gameState || gameState.status !== "playing") {
      gameTickActive = false;
      return; // выходим
    }
    // Обновляем змейки, проверяем столкновения, записываем в БД
    updateSnakesAndCheckCollisions();
    // Следующий тик
    setTimeout(tick, TICK_INTERVAL);
  }
  tick();
}

/********************************************************
  ОБНОВЛЕНИЕ ЗМЕЕК
********************************************************/
function updateSnakesAndCheckCollisions() {
  // Получаем dir / snake каждой змейки
  const { player1, player2, apple } = gameState;
  if (!player1.alive || !player2.alive) return;

  // Обновим каждую змею
  const newP1 = moveSnake(player1, apple);
  const newP2 = moveSnake(player2, apple);

  // Проверка столкновений
  // 1) Змейка вышла за границы
  // 2) Змейка врезалась в свой хвост
  // 3) Змейка врезалась в соперника

  // player1
  const p1Head = newP1.snake[0];
  const p2Head = newP2.snake[0];

  let p1Alive = checkAlive(newP1.snake, newP2.snake);
  let p2Alive = checkAlive(newP2.snake, newP1.snake);

  // Если яблоко съедено, пересоздадим новое
  let newApple = apple;
  if (newP1.ateApple || newP2.ateApple) {
    newApple = {
      x: Math.floor(Math.random() * COLS),
      y: Math.floor(Math.random() * ROWS)
    };
  }

  // Если кто-то умер => игра finished
  let newStatus = gameState.status;
  if (!p1Alive || !p2Alive) {
    newStatus = "finished";
  }

  // Запишем изменения
  specialGameRoomRef.update({
    "player1/snake": newP1.snake,
    "player1/alive": p1Alive,
    "player1/dir": newP1.dir, // dir мог поменяться, если съели яблоко?
    "player2/snake": newP2.snake,
    "player2/alive": p2Alive,
    "player2/dir": newP2.dir,
    "apple": newApple,
    "status": newStatus
  });
}

/********************************************************
  ДВИЖЕНИЕ ОДНОЙ ЗМЕЙКИ
********************************************************/
function moveSnake(player, apple) {
  if (!player.alive) return player;

  // Копируем
  let snake = [...player.snake];
  const dir = player.dir;

  // Текущая голова
  const head = snake[0];
  let newHead = { x: head.x, y: head.y };
  // Изменяем согласно dir
  switch(dir) {
    case "up":    newHead.y -= 1; break;
    case "down":  newHead.y += 1; break;
    case "left":  newHead.x -= 1; break;
    case "right": newHead.x += 1; break;
  }

  // Добавляем новую голову
  snake.unshift(newHead);

  // Проверяем, съели ли яблоко
  let ateApple = false;
  if (newHead.x === apple.x && newHead.y === apple.y) {
    ateApple = true;
  } else {
    // если не съели — убираем последний сегмент (движение)
    snake.pop();
  }

  return {
    ...player,
    snake,
    ateApple
  };
}

/********************************************************
  ПРОВЕРКА СТОЛКНОВЕНИЙ: стена / свой хвост / соперник
********************************************************/
function checkAlive(snake, otherSnake) {
  const head = snake[0];

  // 1) Стена
  if (head.x < 0 || head.x >= COLS || head.y < 0 || head.y >= ROWS) {
    return false;
  }
  // 2) Собственный хвост
  for (let i = 1; i < snake.length; i++) {
    if (snake[i].x === head.x && snake[i].y === head.y) {
      return false;
    }
  }
  // 3) Соперник
  for (let j = 0; j < otherSnake.length; j++) {
    if (otherSnake[j].x === head.x && otherSnake[j].y === head.y) {
      return false;
    }
  }
  return true;
}

/********************************************************
  РЕНДЕР (requestAnimationFrame)
********************************************************/
function startRenderLoop() {
  function renderFrame() {
    draw();
    animationFrameId = requestAnimationFrame(renderFrame);
  }
  renderFrame();
}

/********************************************************
  ОТРИСОВКА
********************************************************/
function draw() {
  // Чёрный фон
  specialCtx.fillStyle = "#000";
  specialCtx.fillRect(0, 0, 400, 650);

  // Если нет gameState
  if (!gameState) {
    drawMatrixText("Загрузка...", 200, 200, 24);
    return;
  }

  // Разные экраны
  switch(gameState.status) {
    case "waiting":
      drawMatrixText("Поиск соперника...", 200, 200, 24);
      return;
    case "readyCheck":
      drawMatrixText("Ожидание готовности...", 200, 200, 24);
      drawPlayersSnakesAndApple();
      return;
    case "countdown":
      drawPlayersSnakesAndApple();
      // Крупный счёт
      const cValue = gameState.countdownValue || 0;
      drawMatrixText(String(cValue), 200, 200, 48);
      return;
    case "playing":
      drawPlayersSnakesAndApple();
      return;
    case "finished":
      drawPlayersSnakesAndApple();
      // Можно затемнить
      specialCtx.fillStyle = "rgba(0,0,0,0.5)";
      specialCtx.fillRect(0,0,400,650);
      drawMatrixText("Игра завершена", 200, 200, 24);
      return;
    default:
      // unknown
      drawMatrixText("Состояние: " + gameState.status, 200, 200, 24);
      break;
  }
}

/********************************************************
  РИСУЕМ ПОЛЕ (СЕТКУ), ЗМЕЕК, ЯБЛОКО
********************************************************/
function drawPlayersSnakesAndApple() {
  // Игровое поле — нарисуем квадрат 400x400
  // (Можно нарисовать сетку, но в стиле "Матрицы" можно
  // оставить просто чёрный фон.)

  if (!gameState.apple) return;
  // Рисуем яблоко (красное)
  drawApple(gameState.apple.x, gameState.apple.y);

  // Змейки
  drawSnake(gameState.player1);
  drawSnake(gameState.player2);
}

function drawSnake(player) {
  if (!player || !player.snake) return;
  const segments = player.snake;
  // Цвет
  specialCtx.fillStyle = player.color || "#0F0"; 
  // Рисуем квадраты
  for (let i = 0; i < segments.length; i++) {
    const seg = segments[i];
    specialCtx.fillRect(seg.x * CELL_SIZE, seg.y * CELL_SIZE, CELL_SIZE, CELL_SIZE);
  }

  // Вывести имя игрока над "головой"
  if (player.username) {
    const head = segments[0];
    // Координаты в пикселях
    const px = head.x * CELL_SIZE + CELL_SIZE/2;
    const py = head.y * CELL_SIZE - 5; 
    drawMatrixText(player.username, px, py, 14, "center");
  }
}

function drawApple(ax, ay) {
  specialCtx.fillStyle = "#F00";
  specialCtx.fillRect(ax*CELL_SIZE, ay*CELL_SIZE, CELL_SIZE, CELL_SIZE);
}

/********************************************************
  ФУНКЦИЯ ДЛЯ ВЫВОДА "МАТРИЧНОГО" ТЕКСТА
********************************************************/
function drawMatrixText(txt, x, y, fontSize=24, align="center") {
  specialCtx.fillStyle = "#00FF00";
  specialCtx.font = `${fontSize}px 'Press Start 2P', monospace`; 
  specialCtx.textAlign = align;
  specialCtx.fillText(txt, x, y);
}

/********************************************************
  УПРАВЛЕНИЕ СВАЙПАМИ
********************************************************/
function addTouchListeners() {
  specialGameCanvas.addEventListener("touchstart", onTouchStart, false);
  specialGameCanvas.addEventListener("touchend", onTouchEnd, false);
}

function onTouchStart(e) {
  e.preventDefault();
  if (e.touches.length > 0) {
    const touch = e.touches[0];
    const rect = specialGameCanvas.getBoundingClientRect();
    touchStartX = touch.clientX - rect.left;
    touchStartY = touch.clientY - rect.top;
  }
}
function onTouchEnd(e) {
  e.preventDefault();
  if (!gameState) return;
  if (e.changedTouches.length > 0) {
    const touch = e.changedTouches[0];
    const rect = specialGameCanvas.getBoundingClientRect();
    const endX = touch.clientX - rect.left;
    const endY = touch.clientY - rect.top;

    const dx = endX - touchStartX;
    const dy = endY - touchStartY;
    if (Math.abs(dx) > Math.abs(dy)) {
      // Горизонталь
      if (dx > 0) sendDirection("right");
      else sendDirection("left");
    } else {
      // Вертикаль
      if (dy > 0) sendDirection("down");
      else sendDirection("up");
    }
  }
}

function sendDirection(dir) {
  // Обновляем в Firebase
  if (!specialGameRoomRef || !gameState) return;
  if (gameState.status !== "playing" && gameState.status !== "countdown") return;

  // Записываем в player1.dir или player2.dir
  specialGameRoomRef.child(localPlayerId).update({ dir });
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
  specialGameCanvas.removeEventListener("touchstart", onTouchStart);
  specialGameCanvas.removeEventListener("touchend", onTouchEnd);

  clearInterval(countdownInterval);
  countdownInterval = null;

  gameTickActive = false;

  // Если хотим завершить комнату, если не finished
  if (specialGameRoomRef && gameState && gameState.status !== "finished") {
    specialGameRoomRef.update({ status: "finished" });
  }

  gameState = null;
  localPlayerId = null;
  specialGameRoomRef = null;
  specialGameKey = null;
}

/********************************************************
  Экспорт
********************************************************/
window.initSpecialGame1 = initSpecialGame1;
window.resetSpecialGame1 = resetSpecialGame1;
