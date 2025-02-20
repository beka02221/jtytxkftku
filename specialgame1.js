/********************************************************
  specialgame1.js

  Изменения по сравнению с предыдущим:
    - Уменьшен BALL_SPEED (примерно в 2 раза)
    - Убрано случайное направление при старте:
      вместо этого мяч стоит, пока владелец его не "толкнёт".
    - Реализован флик (свайп) по мячу для запуска:
      если мяч не движется и вы владелец,
      касание начинается на мяче -> при отрыве
      вычисляем вектор и даём мячу скорость.
    - Если касание НЕ на мяче, или вы не владелец,
      то двигается ваша шайба (как раньше).
********************************************************/

/* 
  Предполагаем, что глобально у нас есть:
  - db              : firebase.database()
  - currentUser     : объект {username, ...}
  - userRef         : firebase-ссылка на /users/<username>
  - localUserData   : {photo, tickets, coins, points}
  - showEndGameModal(title, msg)
  - finishGame()

  HTML:
    <canvas id="specialGameCanvas" width="400" height="650"></canvas>
*/

/********************************************************
  ГЛОБАЛЬНЫЕ ПЕРЕМЕННЫЕ
********************************************************/
let specialGameCanvas;
let specialCtx;
let specialGameRoomRef = null;
let specialGameKey     = null;
let localPlayerId      = null;    // 'player1' или 'player2'
let gameState          = null;    // Данные из Firebase
let animationFrameId   = null;

// Размеры поля (canvas)
const FIELD_WIDTH  = 400;
const FIELD_HEIGHT = 650;
const MIDDLE_LINE  = FIELD_HEIGHT / 2;

// Параметры шайбы (игрока)
const PLAYER_RADIUS = 30;

// Параметры мяча
const BALL_RADIUS = 15;
// Базовая макс. скорость (ниже, чем раньше)
const BALL_SPEED  = 3;

// Время отсчёта (если нужно 5 секунд до начала)
let countdownInterval = null; // Счётчик

// Переменные для "флика" (запуска мяча)
let isFlickingBall  = false;   // мы начали касание по мячу?
let flickStartX     = 0;       // начальная точка
let flickStartY     = 0;       
let flickStartTime  = 0;       // для расчёта силы (при желании)

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
      startGameLoop();
    })
    .catch(err => {
      console.error("Ошибка при инициализации игры:", err);
    });
}

/********************************************************
  ПОИСК ИЛИ СОЗДАНИЕ КОМНАТЫ
********************************************************/
async function findOrCreateRoom() {
  const roomsRef = db.ref("games/specialgame1/rooms");

  // Поищем комнату "waiting"
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
    // Подключаемся как player2
    specialGameKey = foundRoomKey;
    specialGameRoomRef = roomsRef.child(specialGameKey);

    // Запускаем отсчёт 5 сек
    await specialGameRoomRef.update({
      "player2/username": currentUser.username,
      status: "countdown",
      countdownValue: 5
    });
    localPlayerId = "player2";

  } else {
    // Создаём новую
    specialGameKey = roomsRef.push().key;
    specialGameRoomRef = roomsRef.child(specialGameKey);

    // Рандом, кто будет владельцем мяча
    const startWithBall = Math.random() < 0.5 ? "player1" : "player2";

    const initData = {
      status: "waiting", 
      countdownValue: 0,
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
    await specialGameRoomRef.set(initData);
    localPlayerId = "player1";
  }
}

/********************************************************
  ПРОСЛУШКА Firebase
********************************************************/
function listenToGameRoom() {
  if (!specialGameRoomRef) return;

  specialGameRoomRef.on("value", (snapshot) => {
    if (!snapshot.exists()) return;
    gameState = snapshot.val();

    checkForWinCondition();

    // Если player1 и status="countdown", запускаем локальный отсчёт
    if (localPlayerId === "player1" && gameState.status === "countdown") {
      if (!countdownInterval) {
        startCountdownTimer();
      }
    }
  });
}

/********************************************************
  ОТСЧЁТ 5 СЕК
********************************************************/
function startCountdownTimer() {
  countdownInterval = setInterval(() => {
    const currentValue = (gameState && gameState.countdownValue) || 0;
    if (currentValue <= 1) {
      clearInterval(countdownInterval);
      countdownInterval = null;
      // Ставим 0 и статус "playing"
      specialGameRoomRef.update({
        countdownValue: 0,
        status: "playing"
      });
    } else {
      specialGameRoomRef.update({
        countdownValue: currentValue - 1
      });
    }
  }, 1000);
}

/********************************************************
  ПРОВЕРКА ПОБЕДЫ (3 гола)
********************************************************/
function checkForWinCondition() {
  if (!gameState || !gameState.player1 || !gameState.player2) return;
  const score1 = gameState.player1.score;
  const score2 = gameState.player2.score;

  if (score1 >= 3 || score2 >= 3) {
    let title, msg;
    if (score1 > score2) {
      title = "Победа!";
      msg   = `${gameState.player1.username} выиграл со счётом ${score1}:${score2}`;
    } else {
      title = "Победа!";
      msg   = `${gameState.player2.username} выиграл со счётом ${score2}:${score1}`;
    }
    if (specialGameRoomRef && gameState.status !== "finished") {
      specialGameRoomRef.update({ status: "finished" });
    }
    showEndGameModal(title, msg);
  }
}

/********************************************************
  ЦИКЛ АНИМАЦИИ
********************************************************/
function startGameLoop() {
  function gameLoop() {
    // Двигаем мяч (только player1) если status="playing"
    if (localPlayerId === "player1" && gameState && gameState.status === "playing") {
      updateBallPosition();
      detectCollisions();
    }

    render();
    animationFrameId = requestAnimationFrame(gameLoop);
  }
  animationFrameId = requestAnimationFrame(gameLoop);
}

/********************************************************
  ОБНОВЛЕНИЕ МЯЧА (Только у player1)
********************************************************/
function updateBallPosition() {
  if (!specialGameRoomRef || !gameState) return;
  if (gameState.status !== "playing") return;

  const ball = gameState.ball;
  if (!ball) return;

  let { x, y, vx, vy } = ball;
  if (vx === 0 && vy === 0) return; // мяч не двигается

  x += vx;
  y += vy;

  // Проверка гола
  if (y < 0) {
    // Гол player1
    const newScore = (gameState.player1.score || 0) + 1;
    specialGameRoomRef.child("player1").update({ score: newScore });
    resetBall("player1");
    return;
  }
  if (y > FIELD_HEIGHT) {
    // Гол player2
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

  // Обновим в БД
  specialGameRoomRef.child("ball").update({ x, y, vx, vy });
}

/********************************************************
  СБРОС МЯЧА ПОСЛЕ ГОЛА
********************************************************/
function resetBall(scoringPlayerId) {
  if (!specialGameRoomRef || !gameState) return;
  // Ставим мяч по центру, останавливаем
  specialGameRoomRef.child("ball").update({
    x: FIELD_WIDTH / 2,
    y: FIELD_HEIGHT / 2,
    vx: 0,
    vy: 0
  });
  // Владение переходит к другому
  const nextOwner = (scoringPlayerId === "player1") ? "player2" : "player1";
  specialGameRoomRef.update({ startWithBall: nextOwner });
}

/********************************************************
  СТОЛКНОВЕНИЯ МЯЧА С ИГРОКАМИ
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

    // Отражение
    const dot = vx*nx + vy*ny;
    vx = vx - 2*dot*nx;
    vy = vy - 2*dot*ny;

    // Чуть увеличим
    vx *= 1.05;
    vy *= 1.05;

    specialGameRoomRef.child("ball").update({
      x: newBallX,
      y: newBallY,
      vx, vy
    });
  }
}

/********************************************************
  ОТРИСОВКА
********************************************************/
function render() {
  if (!gameState) {
    // Нет ничего
    specialCtx.fillStyle = "#000";
    specialCtx.fillRect(0, 0, FIELD_WIDTH, FIELD_HEIGHT);
    return;
  }

  // Статусы
  if (gameState.status === "waiting") {
    drawWaitingScreen();
    return;
  }
  if (gameState.status === "countdown") {
    drawCountdownScreen();
    return;
  }
  if (gameState.status === "finished") {
    drawFinishedScreen();
    return;
  }

  // Иначе playing
  specialCtx.fillStyle = "#000";
  specialCtx.fillRect(0, 0, FIELD_WIDTH, FIELD_HEIGHT);
  drawField();
  drawPlayers();
  drawBall();
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
  specialCtx.fillText("Поиск соперника...", FIELD_WIDTH/2, FIELD_HEIGHT/2);
}

/********************************************************
  ЭКРАН ОТСЧЁТА
********************************************************/
function drawCountdownScreen() {
  specialCtx.fillStyle = "#000";
  specialCtx.fillRect(0, 0, FIELD_WIDTH, FIELD_HEIGHT);
  
  // (По желанию) Рисуем поле/игроков:
  drawField();
  drawPlayers();
  drawBall();
  drawScore();

  // Поверх — цифра
  const val = gameState.countdownValue || 0;
  specialCtx.fillStyle = "#FFF";
  specialCtx.font = "60px Arial";
  specialCtx.textAlign = "center";
  specialCtx.fillText(String(val), FIELD_WIDTH/2, FIELD_HEIGHT/2);
}

/********************************************************
  ЭКРАН ИГРА ЗАВЕРШЕНА
********************************************************/
function drawFinishedScreen() {
  drawField();
  drawPlayers();
  drawBall();
  drawScore();
  // Тёмная плашка
  specialCtx.fillStyle = "rgba(0,0,0,0.7)";
  specialCtx.fillRect(0, 0, FIELD_WIDTH, FIELD_HEIGHT);
  specialCtx.fillStyle = "#FFF";
  specialCtx.font = "30px Arial";
  specialCtx.textAlign = "center";
  specialCtx.fillText("Игра завершена", FIELD_WIDTH/2, FIELD_HEIGHT/2);
}

/********************************************************
  РИСУЕМ ПОЛЕ
********************************************************/
function drawField() {
  specialCtx.strokeStyle = "#FFF";
  specialCtx.lineWidth = 3;
  specialCtx.strokeRect(0, 0, FIELD_WIDTH, FIELD_HEIGHT);
  // Средняя линия
  specialCtx.beginPath();
  specialCtx.moveTo(0, MIDDLE_LINE);
  specialCtx.lineTo(FIELD_WIDTH, MIDDLE_LINE);
  specialCtx.stroke();
}

/********************************************************
  РИСУЕМ ИГРОКОВ
********************************************************/
function drawPlayers() {
  const p1 = gameState.player1;
  const p2 = gameState.player2;

  // player1 (нижний)
  if (p1) {
    specialCtx.fillStyle = "#00FF00";
    specialCtx.beginPath();
    specialCtx.arc(p1.x, p1.y, PLAYER_RADIUS, 0, Math.PI*2);
    specialCtx.fill();

    // Имя снизу
    if (p1.username) {
      specialCtx.fillStyle = "#FFF";
      specialCtx.font = "16px Arial";
      specialCtx.textAlign = "center";
      specialCtx.fillText(p1.username, FIELD_WIDTH/2, FIELD_HEIGHT - 10);
    }
  }

  // player2 (верхний)
  if (p2) {
    specialCtx.fillStyle = "#FFFF00";
    specialCtx.beginPath();
    specialCtx.arc(p2.x, p2.y, PLAYER_RADIUS, 0, Math.PI*2);
    specialCtx.fill();

    // Имя сверху
    if (p2.username) {
      specialCtx.fillStyle = "#FFF";
      specialCtx.font = "16px Arial";
      specialCtx.textAlign = "center";
      specialCtx.fillText(p2.username, FIELD_WIDTH/2, 20);
    }
  }
}

/********************************************************
  РИСУЕМ МЯЧ
********************************************************/
function drawBall() {
  const ball = gameState.ball;
  if (!ball) return;

  specialCtx.fillStyle = "#FF0000";
  specialCtx.beginPath();
  specialCtx.arc(ball.x, ball.y, BALL_RADIUS, 0, Math.PI*2);
  specialCtx.fill();
}

/********************************************************
  РИСУЕМ СЧЁТ
********************************************************/
function drawScore() {
  const s1 = gameState.player1.score || 0;
  const s2 = gameState.player2.score || 0;
  specialCtx.fillStyle = "#FFF";
  specialCtx.font = "24px Arial";
  specialCtx.textAlign = "center";
  specialCtx.fillText(`${s2} : ${s1}`, FIELD_WIDTH/2, FIELD_HEIGHT/2 - 10);
}

/********************************************************
  TOUCH УПРАВЛЕНИЕ
********************************************************/
function addTouchListeners() {
  if (!specialGameCanvas) return;
  specialGameCanvas.addEventListener("touchstart", onTouchStart, false);
  specialGameCanvas.addEventListener("touchmove", onTouchMove, false);
  specialGameCanvas.addEventListener("touchend", onTouchEnd, false);
}

/********************************************************
  TOUCH START
********************************************************/
function onTouchStart(e) {
  e.preventDefault();
  if (!gameState) return;

  const touch = e.touches[0];
  const rect = specialGameCanvas.getBoundingClientRect();
  const x = touch.clientX - rect.left;
  const y = touch.clientY - rect.top;

  // Проверяем, не хотим ли мы "запустить мяч"
  // Условия:
  //   1) Мы владелец мяча (gameState.startWithBall == localPlayerId)
  //   2) Мяч не двигается (vx=0, vy=0)
  //   3) Касание близко к мячу (dist <= BALL_RADIUS)
  if (gameState.status === "playing" || gameState.status === "countdown") {
    const ball = gameState.ball;
    if (gameState.startWithBall === localPlayerId && ball && ball.vx === 0 && ball.vy === 0) {
      const dx = x - ball.x;
      const dy = y - ball.y;
      const dist = Math.sqrt(dx*dx + dy*dy);
      if (dist <= BALL_RADIUS) {
        // Начинаем флик по мячу
        isFlickingBall = true;
        flickStartX = x;
        flickStartY = y;
        flickStartTime = performance.now();
        return; // выходим, не двигаем шайбу
      }
    }
  }

  // Иначе — двигаем шайбу игрока, если статус позволяет
  movePlayerTo(x, y);
}

/********************************************************
  TOUCH MOVE
********************************************************/
function onTouchMove(e) {
  e.preventDefault();
  if (!gameState) return;

  const touch = e.touches[0];
  const rect = specialGameCanvas.getBoundingClientRect();
  const x = touch.clientX - rect.left;
  const y = touch.clientY - rect.top;

  if (isFlickingBall) {
    // Пока "тянем" для будущего флика, можем ничего не делать
    // или можно визуально показать линию. Сейчас — пропускаем.
    return;
  }

  // Иначе двигаем свою шайбу
  movePlayerTo(x, y);
}

/********************************************************
  TOUCH END
********************************************************/
function onTouchEnd(e) {
  e.preventDefault();
  if (!gameState) return;

  // Если мы фликали мяч
  if (isFlickingBall) {
    const touch = e.changedTouches[0]; // touchend
    const rect = specialGameCanvas.getBoundingClientRect();
    const endX = touch.clientX - rect.left;
    const endY = touch.clientY - rect.top;

    // Рассчитываем вектор
    const dx = endX - flickStartX;
    const dy = endY - flickStartY;
    const dt = performance.now() - flickStartTime; // мс

    // Можно рассчитывать скорость от длины свайпа.
    // Для упрощения: scale = 0.01 (поиграйте с цифрой)
    const scale = 0.01;
    let vx = dx * scale;
    let vy = dy * scale;

    // Ограничим макс скорость
    const maxSpeed = 5; 
    const speed = Math.sqrt(vx*vx + vy*vy);
    if (speed > maxSpeed) {
      vx = vx * (maxSpeed/speed);
      vy = vy * (maxSpeed/speed);
    }

    // Записываем в Firebase
    if (specialGameRoomRef && (gameState.status === "countdown" || gameState.status === "playing")) {
      specialGameRoomRef.child("ball").update({
        vx, vy
      });
    }

    isFlickingBall = false;
    return;
  }

  // Иначе — закончился тап для перемещения шайбы, ничего особого
}

/********************************************************
  ПЕРЕМЕЩЕНИЕ ШАЙБЫ
********************************************************/
function movePlayerTo(x, y) {
  if (!specialGameRoomRef || !gameState) return;
  const player = gameState[localPlayerId];
  if (!player) return;

  // Ограничиваем половиной поля
  let newX = x;
  let newY = y;

  if (localPlayerId === "player1") {
    // Не выше середины
    if (newY < MIDDLE_LINE + PLAYER_RADIUS) newY = MIDDLE_LINE + PLAYER_RADIUS;
    // Не выходит за нижнюю
    if (newY > FIELD_HEIGHT - PLAYER_RADIUS) newY = FIELD_HEIGHT - PLAYER_RADIUS;
  } else {
    // player2 — верхняя
    if (newY > MIDDLE_LINE - PLAYER_RADIUS) newY = MIDDLE_LINE - PLAYER_RADIUS;
    if (newY < PLAYER_RADIUS) newY = PLAYER_RADIUS;
  }

  // Лев/прав
  if (newX < PLAYER_RADIUS) newX = PLAYER_RADIUS;
  if (newX > FIELD_WIDTH - PLAYER_RADIUS) newX = FIELD_WIDTH - PLAYER_RADIUS;

  // Запишем
  if (gameState.status === "playing" || gameState.status === "countdown") {
    specialGameRoomRef.child(localPlayerId).update({ x: newX, y: newY });
  }
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

  // Завершаем комнату, если не finished
  if (specialGameRoomRef && gameState && gameState.status !== "finished") {
    specialGameRoomRef.update({ status: "finished" });
  }

  specialGameRoomRef = null;
  specialGameKey = null;
  localPlayerId = null;
  gameState = null;

  isFlickingBall = false;
}

/********************************************************
  Экспорт
********************************************************/
window.initSpecialGame1 = initSpecialGame1;
window.resetSpecialGame1 = resetSpecialGame1;
