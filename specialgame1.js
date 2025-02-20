/***********************************************
 * specialgame1.js
 * Пример онлайн-игры по типу "Air Hockey"
 ***********************************************/

// Глобальные ссылки и переменные
let specialCanvas, specialCtx;
let gameDataRef = null;           // Ссылка на данные игры в Firebase
let localPlayerName = null;       // Имя (username) локального игрока
let localPlayerRole = null;       // 'player1' или 'player2'
let isHost = false;               // Являемся ли мы хозяином (кто считает физику)
let animationFrameId = null;      // Id для requestAnimationFrame

// Константы и настройки
const FIELD_WIDTH = 400;
const FIELD_HEIGHT = 200;
const BALL_RADIUS = 10;
const PADDLE_RADIUS = 15;
const GOAL_HALF_HEIGHT = 20; // Высота "окошка ворот" по центру (вверх/вниз от центра поля)
const GOAL_X_LEFT = 0;       // Координата x левых ворот
const GOAL_X_RIGHT = FIELD_WIDTH; // Координата x правых ворот
const WIN_SCORE = 3;         // Нужно 3 гола

// Локальная копия состояния (чтобы отрисовывать без задержек)
let gameState = {
  player1: { x: 50,  y: FIELD_HEIGHT / 2, dy: 0, score: 0 },
  player2: { x: 350, y: FIELD_HEIGHT / 2, dy: 0, score: 0 },
  ball:    { x: FIELD_WIDTH / 2, y: FIELD_HEIGHT / 2, vx: 3, vy: 2 },
  status:  "waiting", // "waiting" | "running" | "ended"
  host:    "",        // username хоста
};

// Инициализация игры (вызывается из главного скрипта)
function initSpecialGame1() {
  console.log("[SpecialGame1] init");

  // Получаем canvas и контекст
  specialCanvas = document.getElementById("specialGameCanvas");
  specialCtx = specialCanvas.getContext("2d");

  // Определяем локального игрока (из глобальной переменной currentUser)
  localPlayerName = currentUser ? currentUser.username : "Guest" + Math.floor(Math.random() * 1000);

  // 1. Пытаемся найти/создать «комнату» (в упрощённом виде используем одну общую запись в БД).
  //    Если уже есть незаполненный player1 или player2 — занимаем слот, иначе — заново сбрасываем.
  gameDataRef = db.ref("specialgame1/room1");
  gameDataRef.once("value", (snapshot) => {
    let data = snapshot.val();

    if (!data) {
      // Если данных нет, создаём новую игру
      console.log("No existing room. Creating new one...");
      createNewRoom();
    } else {
      // Если данные есть, проверяем, есть ли свободный слот
      const p1 = data.player1 || {};
      const p2 = data.player2 || {};

      if (!p1.username) {
        // Становимся player1
        console.log("Joining as player1...");
        localPlayerRole = "player1";
        isHost = true;
        joinRoomAsPlayer(data, localPlayerRole);
      } else if (!p2.username) {
        // Становимся player2
        console.log("Joining as player2...");
        localPlayerRole = "player2";
        isHost = false;
        joinRoomAsPlayer(data, localPlayerRole);
      } else {
        // Оба слота заняты — перезапишем?
        // Для демо: просто создаём новую игру заново
        console.log("Both slots are taken, resetting...");
        createNewRoom();
      }
    }

    // Подписываемся на изменения
    setupRealtimeListener();
  });

  // Навешиваем обработчики управления (клавиатура)
  window.addEventListener("keydown", onKeyDown);
  window.addEventListener("keyup", onKeyUp);
}

// Создать новую запись игры в Firebase
function createNewRoom() {
  localPlayerRole = "player1";
  isHost = true;

  gameState = {
    player1: { x: 50, y: FIELD_HEIGHT / 2, dy: 0, score: 0, username: localPlayerName },
    player2: { x: 350, y: FIELD_HEIGHT / 2, dy: 0, score: 0, username: "" },
    ball:    { x: FIELD_WIDTH / 2, y: FIELD_HEIGHT / 2, vx: 3, vy: 2 },
    status:  "waiting", 
    host:    localPlayerName,
  };

  gameDataRef.set(gameState);
}

// Занимаем слот player1 или player2
function joinRoomAsPlayer(existingData, role) {
  const updates = {};
  if (role === "player1") {
    existingData.player1 = {
      x: 50,
      y: FIELD_HEIGHT / 2,
      dy: 0,
      score: 0,
      username: localPlayerName,
    };
    existingData.host = localPlayerName; // Перезаписываем хост
  } else {
    existingData.player2 = {
      x: 350,
      y: FIELD_HEIGHT / 2,
      dy: 0,
      score: 0,
      username: localPlayerName,
    };
  }

  // Если оба игрока заняты — переводим игру в status: "running"
  if (existingData.player1.username && existingData.player2.username) {
    existingData.status = "running";
  }

  // Обновляем Firebase
  gameDataRef.set(existingData);
}

// Подписка на изменения в Firebase
function setupRealtimeListener() {
  gameDataRef.on("value", (snapshot) => {
    const data = snapshot.val();
    if (!data) return;

    // Обновляем локальную копию
    gameState = data;

    // Если статус "ended", показываем результат
    if (gameState.status === "ended") {
      // Отображаем финальный счёт
      showEndGameModal(
        "Game Over",
        `Score: ${gameState.player1.score} - ${gameState.player2.score}. 
         ${
           gameState.player1.score >= WIN_SCORE
             ? gameState.player1.username + " wins!"
             : gameState.player2.username + " wins!"
         }`
      );
    }

    // Если оба игрока есть, а статус "waiting" — переходим в "running"
    if (gameState.player1.username && gameState.player2.username && gameState.status === "waiting") {
      gameDataRef.update({ status: "running" });
    }
  });

  // Запускаем игровой цикл рендера
  gameLoop();
}

// Игровой цикл
function gameLoop() {
  // 1. Если мы "хост" (player1), считаем физику и обновляем БД
  if (isHost && gameState.status === "running") {
    updatePhysics();
    // Записываем изменения в Firebase
    gameDataRef.update(gameState);
  }

  // 2. Рисуем
  renderGame();

  // 3. Следующий кадр
  animationFrameId = requestAnimationFrame(gameLoop);
}

// Обновление физики (выполняется только у хоста)
function updatePhysics() {
  const p1 = gameState.player1;
  const p2 = gameState.player2;
  const ball = gameState.ball;

  // Обновляем позиции игроков (пока только вертикаль)
  p1.y += p1.dy;
  p2.y += p2.dy;

  // Не выходим за границы поля
  if (p1.y < PADDLE_RADIUS) p1.y = PADDLE_RADIUS;
  if (p1.y > FIELD_HEIGHT - PADDLE_RADIUS) p1.y = FIELD_HEIGHT - PADDLE_RADIUS;
  if (p2.y < PADDLE_RADIUS) p2.y = PADDLE_RADIUS;
  if (p2.y > FIELD_HEIGHT - PADDLE_RADIUS) p2.y = FIELD_HEIGHT - PADDLE_RADIUS;

  // Движение мяча
  ball.x += ball.vx;
  ball.y += ball.vy;

  // Столкновение с верх/низ
  if (ball.y < BALL_RADIUS) {
    ball.y = BALL_RADIUS;
    ball.vy *= -1;
  }
  if (ball.y > FIELD_HEIGHT - BALL_RADIUS) {
    ball.y = FIELD_HEIGHT - BALL_RADIUS;
    ball.vy *= -1;
  }

  // Проверка голов:
  // Левая сторона (x < 0) и мяч по вертикали в зоне ворот
  if (ball.x - BALL_RADIUS < GOAL_X_LEFT) {
    if (
      ball.y > FIELD_HEIGHT / 2 - GOAL_HALF_HEIGHT &&
      ball.y < FIELD_HEIGHT / 2 + GOAL_HALF_HEIGHT
    ) {
      // Гол в ворота player1 -> Очко player2
      p2.score++;
      checkWinCondition();
    }
    resetBall();
    return;
  }

  // Правая сторона (x > FIELD_WIDTH) и мяч по вертикали в зоне ворот
  if (ball.x + BALL_RADIUS > GOAL_X_RIGHT) {
    if (
      ball.y > FIELD_HEIGHT / 2 - GOAL_HALF_HEIGHT &&
      ball.y < FIELD_HEIGHT / 2 + GOAL_HALF_HEIGHT
    ) {
      // Гол в ворота player2 -> Очко player1
      p1.score++;
      checkWinCondition();
    }
    resetBall();
    return;
  }

  // Столкновение с "пушками" (paddle)
  checkPaddleCollision(p1);
  checkPaddleCollision(p2);
}

// Проверка столкновения мяча с "клюшкой" игрока
function checkPaddleCollision(player) {
  const dx = gameState.ball.x - player.x;
  const dy = gameState.ball.y - player.y;
  const dist = Math.sqrt(dx * dx + dy * dy);

  if (dist < PADDLE_RADIUS + BALL_RADIUS) {
    // Мяч сталкивается с клюшкой
    // Простейший отскок (упрощённая физика)
    const overlap = PADDLE_RADIUS + BALL_RADIUS - dist;
    // Нормализованный вектор
    const nx = dx / dist;
    const ny = dy / dist;

    // Сдвигаем мяч за пределы клюшки
    gameState.ball.x += nx * overlap;
    gameState.ball.y += ny * overlap;

    // Перерасчёт скорости (упрощённый)
    // Считаем, что мяч отражается по нормали
    const dot = gameState.ball.vx * nx + gameState.ball.vy * ny; // скалярное произведение
    gameState.ball.vx -= 2 * dot * nx;
    gameState.ball.vy -= 2 * dot * ny;
  }
}

// Сброс мяча после гола
function resetBall() {
  gameState.ball.x = FIELD_WIDTH / 2;
  gameState.ball.y = FIELD_HEIGHT / 2;
  // Рандомная начальная скорость (немного)
  gameState.ball.vx = Math.random() < 0.5 ? 3 : -3;
  gameState.ball.vy = Math.random() < 0.5 ? 2 : -2;
}

// Проверяем, не набрал ли кто-то 3 гола
function checkWinCondition() {
  const p1 = gameState.player1;
  const p2 = gameState.player2;

  if (p1.score >= WIN_SCORE || p2.score >= WIN_SCORE) {
    // Игра заканчивается
    gameState.status = "ended";
  }
}

// Отрисовка кадра
function renderGame() {
  // Очищаем поле
  specialCtx.clearRect(0, 0, FIELD_WIDTH, FIELD_HEIGHT);

  // Рисуем поле (границы, центр и т.д. — по желанию)
  // Для наглядности нарисуем центральную линию
  specialCtx.strokeStyle = "#999";
  specialCtx.setLineDash([5, 5]);
  specialCtx.beginPath();
  specialCtx.moveTo(FIELD_WIDTH / 2, 0);
  specialCtx.lineTo(FIELD_WIDTH / 2, FIELD_HEIGHT);
  specialCtx.stroke();

  // Рисуем "ворота" (прямоугольники)
  specialCtx.setLineDash([]);
  specialCtx.strokeStyle = "red";
  // Левая "рамка" ворот
  specialCtx.beginPath();
  specialCtx.moveTo(0, FIELD_HEIGHT / 2 - GOAL_HALF_HEIGHT);
  specialCtx.lineTo(0, FIELD_HEIGHT / 2 + GOAL_HALF_HEIGHT);
  specialCtx.stroke();
  // Правая "рамка" ворот
  specialCtx.beginPath();
  specialCtx.moveTo(FIELD_WIDTH, FIELD_HEIGHT / 2 - GOAL_HALF_HEIGHT);
  specialCtx.lineTo(FIELD_WIDTH, FIELD_HEIGHT / 2 + GOAL_HALF_HEIGHT);
  specialCtx.stroke();

  // Рисуем игроков (кружки)
  drawCircle(gameState.player1.x, gameState.player1.y, PADDLE_RADIUS, "blue");
  drawCircle(gameState.player2.x, gameState.player2.y, PADDLE_RADIUS, "green");

  // Рисуем мяч
  drawCircle(gameState.ball.x, gameState.ball.y, BALL_RADIUS, "orange");

  // Рисуем счёт
  specialCtx.fillStyle = "#fff";
  specialCtx.font = "14px Arial";
  specialCtx.fillText(
    `${gameState.player1.username || "P1"}: ${gameState.player1.score}`,
    20,
    20
  );
  specialCtx.fillText(
    `${gameState.player2.username || "P2"}: ${gameState.player2.score}`,
    FIELD_WIDTH - 120,
    20
  );
}

// Вспомогательная функция рисования круга
function drawCircle(x, y, radius, color) {
  specialCtx.fillStyle = color;
  specialCtx.beginPath();
  specialCtx.arc(x, y, radius, 0, Math.PI * 2);
  specialCtx.fill();
}

// Обработчики клавиатуры
function onKeyDown(e) {
  if (!localPlayerRole) return;
  const speed = 4; // скорость движения

  // Управляем только своей клюшкой
  let player = gameState[localPlayerRole];
  if (!player) return;

  // Если вы player1 (хост), двигаемся по W / S
  if (localPlayerRole === "player1") {
    if (e.key === "w" || e.key === "ArrowUp") {
      player.dy = -speed;
    }
    if (e.key === "s" || e.key === "ArrowDown") {
      player.dy = speed;
    }
  }
  // Если вы player2, двигаетесь по ↑ / ↓ (или W/S)
  if (localPlayerRole === "player2") {
    if (e.key === "w" || e.key === "ArrowUp") {
      player.dy = -speed;
    }
    if (e.key === "s" || e.key === "ArrowDown") {
      player.dy = speed;
    }
  }

  // Отправляем обновление позиций сразу (чтобы не ждать очередной цикл)
  if (isHost && gameState.status === "running") {
    gameDataRef.update(gameState);
  } else {
    // Для не-хоста: обновим только своё поле
    const path = localPlayerRole === "player1" ? "player1" : "player2";
    gameDataRef.child(path).update({ dy: player.dy });
  }
}

function onKeyUp(e) {
  let player = gameState[localPlayerRole];
  if (!player) return;

  if (
    e.key === "w" ||
    e.key === "s" ||
    e.key === "ArrowUp" ||
    e.key === "ArrowDown"
  ) {
    player.dy = 0;
  }

  // Аналогичная логика отправки обновления
  if (isHost && gameState.status === "running") {
    gameDataRef.update(gameState);
  } else {
    const path = localPlayerRole === "player1" ? "player1" : "player2";
    gameDataRef.child(path).update({ dy: 0 });
  }
}

/********************************************
 * Завершение игры (вызывается из главного кода)
 ********************************************/
function resetSpecialGame1() {
  // Отключаем слушатель и анимацию
  if (gameDataRef) {
    gameDataRef.off();
  }
  cancelAnimationFrame(animationFrameId);

  // Сбрасываем локальные переменные
  localPlayerName = null;
  localPlayerRole = null;
  isHost = false;
  animationFrameId = null;
  gameDataRef = null;

  // Очищаем экран
  if (specialCtx) {
    specialCtx.clearRect(0, 0, FIELD_WIDTH, FIELD_HEIGHT);
  }
}

//
// Дополнительная функция для показа модального окна конца игры,
// она уже существует в вашем "main script": showEndGameModal(title, message).
// В данном коде мы лишь вызываем её при gameState.status === "ended".
//

//
// Конец файла specialgame1.js
//
