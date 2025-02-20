/********************************************************
  specialgame1.js

  Основные изменения по сравнению с предыдущим вариантом:
    - Управление шайбами (paddle) снова через пальцы (touch).
    - Добавлен 5-секундный отсчёт (countdown) после того,
      как второй игрок подключился.
    - На экране отображаются крупные цифры (5,4,3,2,1)
      перед стартом игры (статус "playing").
********************************************************/

/* 
  Окружение (ожидаемое):
  -------------------------------------------------------
  1) db               - firebase.database()
  2) currentUser      - объект пользователя {username, ...}
  3) userRef          - ссылка в БД на "users/username"
  4) localUserData    - объект пользователя {photo, tickets, coins, points}
  5) showEndGameModal(title, message) - показывает финальное окно
  6) finishGame()     - закрывает финальное окно
  7) <canvas id="specialGameCanvas" width="400" height="650"></canvas>
  8) requestAnimationFrame для анимации
*/

/********************************************************
  ГЛОБАЛЬНЫЕ ПЕРЕМЕННЫЕ ДЛЯ ИГРЫ
********************************************************/
let specialGameCanvas;
let specialCtx;

let specialGameRoomRef = null;   // Ссылка на узел комнаты в Firebase
let specialGameKey = null;       // Ключ комнаты
let localPlayerId = null;        // "player1" или "player2"
let gameState = null;            // Текущее состояние (из Firebase)
let animationFrameId = null;     // ID анимации

// Размеры поля (должны совпадать с canvas.width / canvas.height)
const FIELD_WIDTH  = 400;
const FIELD_HEIGHT = 650;

// Параметры шайбы (игрока)
const PLAYER_RADIUS = 30;

// Параметры мяча
const BALL_RADIUS = 15;
const BALL_SPEED  = 6;

// Граница, делящая поле
const MIDDLE_LINE = FIELD_HEIGHT / 2;

// Для 5-секундного обратного отсчёта
// мы будем хранить countdownValue (5,4,3,2,1...) в БД и статус "countdown".
// Как только countdownValue дойдёт до 0, ставим статус "playing".
let countdownInterval = null;  // local setInterval id

/********************************************************
  ИНИЦИАЛИЗАЦИЯ ИГРЫ
********************************************************/
function initSpecialGame1() {
  specialGameCanvas = document.getElementById("specialGameCanvas");
  specialCtx = specialGameCanvas.getContext("2d");

  // Находим/создаём комнату
  findOrCreateRoom()
    .then(() => {
      // Подключаем события на canvas для тач-управления
      addTouchListeners();

      // Слушаем изменения в Firebase
      listenToGameRoom();

      // Запускаем анимационный цикл
      startGameLoop();
    })
    .catch(err => {
      console.error("Ошибка при поиске/создании комнаты:", err);
      // Можно показать модалку об ошибке
    });
}

/********************************************************
  ПОИСК ИЛИ СОЗДАНИЕ КОМНАТЫ
********************************************************/
async function findOrCreateRoom() {
  const roomsRef = db.ref("games/specialgame1/rooms");

  // 1) Поищем комнату со статусом "waiting"
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

    // Обновим комнату, чтобы назначить player2
    // и перевести в статус "countdown"
    await specialGameRoomRef.update({
      "player2/username": currentUser.username,
      status: "countdown",
      countdownValue: 5   // запускаем с 5 секунд
    });
    localPlayerId = "player2";

  } else {
    // Нет свободной комнаты, создаём новую
    specialGameKey = roomsRef.push().key;
    specialGameRoomRef = roomsRef.child(specialGameKey);

    // Случайный выбор владельца мяча
    const startWithBall = Math.random() < 0.5 ? "player1" : "player2";

    const initialState = {
      status: "waiting",   // ждём второго игрока
      countdownValue: 0,   // пока нет отсчёта
      ball: {
        x: FIELD_WIDTH / 2,
        y: FIELD_HEIGHT / 2,
        vx: 0,
        vy: 0
      },
      player1: {
        username: currentUser.username,
        x: FIELD_WIDTH / 2,
        y: FIELD_HEIGHT - 80,
        score: 0
      },
      player2: {
        username: "",
        x: FIELD_WIDTH / 2,
        y: 80,
        score: 0
      },
      startWithBall: startWithBall
    };

    await specialGameRoomRef.set(initialState);
    localPlayerId = "player1";
  }
}

/********************************************************
  ПРОСЛУШКА И ОБНОВЛЕНИЕ gameState
********************************************************/
function listenToGameRoom() {
  if (!specialGameRoomRef) return;

  specialGameRoomRef.on("value", (snapshot) => {
    if (!snapshot.exists()) return;
    gameState = snapshot.val();

    // Проверка, не завершилась ли игра (3 гола)
    checkForWinCondition();

    // Если мы "хост" (player1), и статус "countdown", запустим локальный таймер,
    // чтобы раз в секунду уменьшать countdownValue в БД. (Только один игрок.)
    if (localPlayerId === "player1" && gameState.status === "countdown") {
      // Если таймер ещё не запущен
      if (!countdownInterval) {
        startCountdownTimer();
      }
    }

    // Если статус "playing", а мяч стоит (vx=0, vy=0),
    // и мы — владелец мяча => запускаем
    if (gameState.status === "playing") {
      if (gameState.ball.vx === 0 && gameState.ball.vy === 0) {
        if (gameState.startWithBall === localPlayerId) {
          launchBall(localPlayerId);
        }
      }
    }
  });
}

/********************************************************
  СТАРТ ОБРАТНОГО ОТСЧЁТА (только у player1)
********************************************************/
function startCountdownTimer() {
  if (!specialGameRoomRef) return;
  clearInterval(countdownInterval);

  countdownInterval = setInterval(async () => {
    // Считываем текущее значение
    const currentValue = (gameState && gameState.countdownValue) || 0;
    if (currentValue <= 1) {
      // Ставим 0, статус = "playing"
      clearInterval(countdownInterval);
      countdownInterval = null;
      await specialGameRoomRef.update({
        countdownValue: 0,
        status: "playing"
      });
    } else {
      // Уменьшаем на 1
      await specialGameRoomRef.update({
        countdownValue: currentValue - 1
      });
    }
  }, 1000);
}

/********************************************************
  ПРОВЕРКА ПОБЕДЫ (3 ГОЛА)
********************************************************/
function checkForWinCondition() {
  if (!gameState || !gameState.player1 || !gameState.player2) return;

  const score1 = gameState.player1.score;
  const score2 = gameState.player2.score;

  if (score1 >= 3 || score2 >= 3) {
    let title = "";
    let message = "";
    if (score1 > score2) {
      title = "Победа!";
      message = `Игрок ${gameState.player1.username} выиграл со счётом ${score1}:${score2}`;
    } else {
      title = "Победа!";
      message = `Игрок ${gameState.player2.username} выиграл со счётом ${score2}:${score1}`;
    }
    // Помечаем комнату как finished
    if (specialGameRoomRef && gameState.status !== "finished") {
      specialGameRoomRef.update({ status: "finished" });
    }
    // Показываем результат
    showEndGameModal(title, message);
  }
}

/********************************************************
  ЗАПУСК МЯЧА
********************************************************/
function launchBall(ownerPlayerId) {
  if (!specialGameRoomRef || !gameState) return;
  let vx = (Math.random() * 4) - 2;  // -2..2
  let vy = (ownerPlayerId === "player1") ? -BALL_SPEED : BALL_SPEED;
  specialGameRoomRef.child("ball").update({ vx, vy });
}

/********************************************************
  ЦИКЛ АНИМАЦИИ
********************************************************/
function startGameLoop() {
  function gameLoop() {
    // Только player1 двигает мяч
    if (localPlayerId === "player1" && gameState && gameState.status === "playing") {
      updateBallPosition();
      detectCollisions();
    }

    // Отрисовка
    render();

    animationFrameId = requestAnimationFrame(gameLoop);
  }
  animationFrameId = requestAnimationFrame(gameLoop);
}

/********************************************************
  ОБНОВЛЕНИЕ ПОЛОЖЕНИЯ МЯЧА (ТОЛЬКО У player1)
********************************************************/
function updateBallPosition() {
  if (!specialGameRoomRef || !gameState) return;
  const ball = gameState.ball;
  if (!ball) return;

  let { x, y, vx, vy } = ball;
  if (vx === 0 && vy === 0) return; // мяч не двигается

  x += vx;
  y += vy;

  // Проверка гола (упрощённо: y < 0 => гол player1, y > FIELD_HEIGHT => гол player2)
  if (y < 0) {
    const newScore = (gameState.player1.score || 0) + 1;
    specialGameRoomRef.child("player1").update({ score: newScore });
    resetBall("player1");
    return;
  }
  if (y > FIELD_HEIGHT) {
    const newScore = (gameState.player2.score || 0) + 1;
    specialGameRoomRef.child("player2").update({ score: newScore });
    resetBall("player2");
    return;
  }

  // Отскоки слева/справа
  if (x < BALL_RADIUS) {
    x = BALL_RADIUS;
    vx = -vx;
  }
  if (x > FIELD_WIDTH - BALL_RADIUS) {
    x = FIELD_WIDTH - BALL_RADIUS;
    vx = -vx;
  }

  specialGameRoomRef.child("ball").update({ x, y, vx, vy });
}

/********************************************************
  СБРОС МЯЧА ПОСЛЕ ГОЛА
********************************************************/
function resetBall(scoringPlayerId) {
  if (!specialGameRoomRef) return;
  // Ставим в центр, останавливаем
  specialGameRoomRef.child("ball").update({
    x: FIELD_WIDTH / 2,
    y: FIELD_HEIGHT / 2,
    vx: 0,
    vy: 0
  });
  // Право удара — у другого игрока
  const nextOwner = (scoringPlayerId === "player1") ? "player2" : "player1";
  specialGameRoomRef.update({ startWithBall: nextOwner });
}

/********************************************************
  СТОЛКНОВЕНИЯ МЯЧА С ШАЙБАМИ
********************************************************/
function detectCollisions() {
  if (!gameState) return;
  checkCollisionWithPlayer("player1");
  checkCollisionWithPlayer("player2");
}

function checkCollisionWithPlayer(playerId) {
  const ball = gameState.ball;
  const player = gameState[playerId];
  if (!ball || !player) return;

  const dx = ball.x - player.x;
  const dy = ball.y - player.y;
  const dist = Math.sqrt(dx*dx + dy*dy);

  if (dist < (BALL_RADIUS + PLAYER_RADIUS)) {
    // Столкнулись
    const overlap = (BALL_RADIUS + PLAYER_RADIUS) - dist;
    const nx = dx / dist;
    const ny = dy / dist;

    let newBallX = ball.x + nx * overlap;
    let newBallY = ball.y + ny * overlap;

    let vx = ball.vx;
    let vy = ball.vy;
    // Отражение: v' = v - 2(v·n)n
    const dot = vx*nx + vy*ny;
    vx = vx - 2*dot*nx;
    vy = vy - 2*dot*ny;
    // Чуть увеличим
    vx *= 1.05;
    vy *= 1.05;

    specialGameRoomRef.child("ball").update({
      x: newBallX,
      y: newBallY,
      vx: vx,
      vy: vy
    });
  }
}

/********************************************************
  ОТРИСОВКА
********************************************************/
function render() {
  if (!gameState) {
    // Нет данных — заливаем чёрным
    specialCtx.fillStyle = "#000";
    specialCtx.fillRect(0, 0, FIELD_WIDTH, FIELD_HEIGHT);
    return;
  }

  // Статус "waiting"
  if (gameState.status === "waiting") {
    drawWaitingScreen();
    return;
  }

  // Статус "countdown"
  if (gameState.status === "countdown") {
    drawCountdownScreen();
    return;
  }

  // Статус "finished" — можно затемнить
  if (gameState.status === "finished") {
    drawFinishedScreen();
    return;
  }

  // Иначе — "playing"
  specialCtx.fillStyle = "#000000";
  specialCtx.fillRect(0, 0, FIELD_WIDTH, FIELD_HEIGHT);

  drawField();
  drawBall();
  drawPlayers();
  drawScore();
}

/********************************************************
  ЭКРАН ОЖИДАНИЯ
********************************************************/
function drawWaitingScreen() {
  specialCtx.fillStyle = "#000";
  specialCtx.fillRect(0, 0, FIELD_WIDTH, FIELD_HEIGHT);

  specialCtx.fillStyle = "#FFF";
  specialCtx.font = "24px Arial";
  specialCtx.textAlign = "center";
  specialCtx.fillText("Поиск соперника...", FIELD_WIDTH / 2, FIELD_HEIGHT / 2);
}

/********************************************************
  ЭКРАН ОТСЧЁТА
********************************************************/
function drawCountdownScreen() {
  specialCtx.fillStyle = "#000";
  specialCtx.fillRect(0, 0, FIELD_WIDTH, FIELD_HEIGHT);

  // Отрисуем поле, чтобы было видно расположение, если хотите
  // или пусть будет просто чёрный фон. Для примера рисуем фон:
  drawField();
  drawPlayers();
  drawScore();

  // Поверх всего — крупная цифра
  const cValue = gameState.countdownValue || 0;
  if (cValue > 0) {
    specialCtx.fillStyle = "#FFFFFF";
    specialCtx.font = "60px Arial";
    specialCtx.textAlign = "center";
    specialCtx.fillText(String(cValue), FIELD_WIDTH / 2, FIELD_HEIGHT / 2);
  }
}

/********************************************************
  ЭКРАН "ИГРА ЗАВЕРШЕНА" (FINISHED)
********************************************************/
function drawFinishedScreen() {
  // Можно отрисовать поле замороженное
  drawField();
  drawBall();
  drawPlayers();
  drawScore();

  // Накладываем полупрозрачный чёрный слой
  specialCtx.fillStyle = "rgba(0, 0, 0, 0.7)";
  specialCtx.fillRect(0, 0, FIELD_WIDTH, FIELD_HEIGHT);

  specialCtx.fillStyle = "#FFFFFF";
  specialCtx.font = "30px Arial";
  specialCtx.textAlign = "center";
  specialCtx.fillText("Игра завершена", FIELD_WIDTH / 2, FIELD_HEIGHT / 2);
}

/********************************************************
  РИСОВАНИЕ ПОЛЯ (ГРАНИЦ И СРЕДНЕЙ ЛИНИИ)
********************************************************/
function drawField() {
  // Чёрный фон уже залили
  specialCtx.strokeStyle = "#FFF";
  specialCtx.lineWidth = 3;
  specialCtx.strokeRect(0, 0, FIELD_WIDTH, FIELD_HEIGHT);

  specialCtx.beginPath();
  specialCtx.moveTo(0, MIDDLE_LINE);
  specialCtx.lineTo(FIELD_WIDTH, MIDDLE_LINE);
  specialCtx.stroke();
}

/********************************************************
  РИСОВАНИЕ МЯЧА
********************************************************/
function drawBall() {
  if (!gameState.ball) return;
  const { x, y } = gameState.ball;
  specialCtx.fillStyle = "#FF0000";
  specialCtx.beginPath();
  specialCtx.arc(x, y, BALL_RADIUS, 0, Math.PI * 2);
  specialCtx.fill();
}

/********************************************************
  РИСОВАНИЕ ИГРОКОВ
********************************************************/
function drawPlayers() {
  const p1 = gameState.player1;
  const p2 = gameState.player2;

  // player1 (нижний, зелёный)
  if (p1) {
    specialCtx.fillStyle = "#00FF00";
    specialCtx.beginPath();
    specialCtx.arc(p1.x, p1.y, PLAYER_RADIUS, 0, Math.PI * 2);
    specialCtx.fill();

    // Имя (при желании) внизу
    if (p1.username) {
      specialCtx.fillStyle = "#FFF";
      specialCtx.font = "16px Arial";
      specialCtx.textAlign = "center";
      specialCtx.fillText(p1.username, FIELD_WIDTH / 2, FIELD_HEIGHT - 10);
    }
  }

  // player2 (верхний, жёлтый)
  if (p2) {
    specialCtx.fillStyle = "#FFFF00";
    specialCtx.beginPath();
    specialCtx.arc(p2.x, p2.y, PLAYER_RADIUS, 0, Math.PI * 2);
    specialCtx.fill();

    // Имя вверху
    if (p2.username) {
      specialCtx.fillStyle = "#FFF";
      specialCtx.font = "16px Arial";
      specialCtx.textAlign = "center";
      specialCtx.fillText(p2.username, FIELD_WIDTH / 2, 20);
    }
  }
}

/********************************************************
  РИСОВАНИЕ СЧЁТА
********************************************************/
function drawScore() {
  const score1 = (gameState.player1 && gameState.player1.score) || 0;
  const score2 = (gameState.player2 && gameState.player2.score) || 0;
  specialCtx.fillStyle = "#FFF";
  specialCtx.font = "24px Arial";
  specialCtx.textAlign = "center";
  specialCtx.fillText(`${score2} : ${score1}`, FIELD_WIDTH / 2, FIELD_HEIGHT / 2 - 10);
}

/********************************************************
  УПРАВЛЕНИЕ ПАЛЬЦАМИ (TOUCH EVENTS)
********************************************************/
function addTouchListeners() {
  if (!specialGameCanvas) return;
  specialGameCanvas.addEventListener("touchstart", onTouchStart, false);
  specialGameCanvas.addEventListener("touchmove", onTouchMove, false);
  specialGameCanvas.addEventListener("touchend", onTouchEnd, false);
}

function onTouchStart(e) {
  e.preventDefault();
  // При косании ничего особого, просто предотвратим скролл
}

function onTouchMove(e) {
  e.preventDefault();
  if (!gameState) return;
  const player = gameState[localPlayerId];
  if (!player) return;

  // Берём первую «точку касания»
  const touch = e.touches[0];
  const rect = specialGameCanvas.getBoundingClientRect();
  let x = touch.clientX - rect.left;
  let y = touch.clientY - rect.top;

  // Ограничим перемещение только своей половиной
  if (localPlayerId === "player1") {
    // Не выше центра
    if (y < MIDDLE_LINE + PLAYER_RADIUS) {
      y = MIDDLE_LINE + PLAYER_RADIUS;
    }
    // Не за нижнюю границу
    if (y > FIELD_HEIGHT - PLAYER_RADIUS) {
      y = FIELD_HEIGHT - PLAYER_RADIUS;
    }
  } else {
    // player2 — верхняя половина
    if (y > MIDDLE_LINE - PLAYER_RADIUS) {
      y = MIDDLE_LINE - PLAYER_RADIUS;
    }
    if (y < PLAYER_RADIUS) {
      y = PLAYER_RADIUS;
    }
  }

  // Левые/правые стены
  if (x < PLAYER_RADIUS) {
    x = PLAYER_RADIUS;
  }
  if (x > FIELD_WIDTH - PLAYER_RADIUS) {
    x = FIELD_WIDTH - PLAYER_RADIUS;
  }

  // Обновляем позицию в Firebase
  if (specialGameRoomRef && gameState.status === "playing") {
    specialGameRoomRef.child(localPlayerId).update({ x, y });
  } else if (specialGameRoomRef && gameState.status === "countdown") {
    // Разрешим двигать шайбу и во время countdown
    specialGameRoomRef.child(localPlayerId).update({ x, y });
  }
}

function onTouchEnd(e) {
  e.preventDefault();
  // Ничего не делаем
}

/********************************************************
  СБРОС ИГРЫ
********************************************************/
function resetSpecialGame1() {
  // Отключаем слушатели Firebase
  if (specialGameRoomRef) {
    specialGameRoomRef.off();
  }

  // Останавливаем анимацию
  if (animationFrameId) {
    cancelAnimationFrame(animationFrameId);
    animationFrameId = null;
  }

  // Убираем touch-события
  if (specialGameCanvas) {
    specialGameCanvas.removeEventListener("touchstart", onTouchStart);
    specialGameCanvas.removeEventListener("touchmove", onTouchMove);
    specialGameCanvas.removeEventListener("touchend", onTouchEnd);
  }

  // Останавливаем локальный счётчик (если запущен)
  if (countdownInterval) {
    clearInterval(countdownInterval);
    countdownInterval = null;
  }

  // Если игра ещё не "finished", можно завершить комнату
  if (specialGameRoomRef && gameState && gameState.status !== "finished") {
    specialGameRoomRef.update({ status: "finished" });
  }

  specialGameRoomRef = null;
  specialGameKey = null;
  localPlayerId = null;
  gameState = null;
}

/********************************************************
  Экспорт
********************************************************/
window.initSpecialGame1 = initSpecialGame1;
window.resetSpecialGame1 = resetSpecialGame1;
