/********************************************************
  specialgame1.js
  ----------------
  PvP-игра в стиле Glow Hockey (аэрохоккей), с:
    - Поиском соперника (экран "ожидание")
    - Случайным определением, кому достаётся мяч первым
    - Игра до 3 голов
    - Управление шайбами с клавиатуры и/или виртуальными кнопками
    - Отображение имени соперника над его воротами
    - Чёрный фон игрового поля
    - Синхронизация через Firebase Realtime Database
********************************************************/

/* 
  ПРЕДПОЛОЖЕНИЯ ОКРУЖАЮЩЕГО КОДА (из вашего index.html и основного скрипта):

  1) db               - ссылка на firebase.database()
  2) currentUser      - объект пользователя Telegram (tg.initDataUnsafe.user)
  3) userRef          - ссылка на узел 'users/username' в Firebase
  4) localUserData    - объект, в котором хранятся данные пользователя { photo, tickets, coins, points }
  5) showEndGameModal(title, message) - функция для показа финального окна (результат)
  6) finishGame()     - функция, вызываемая по нажатию «Close» в модалке результата
  7) Canvas с id="specialGameCanvas" в HTML
  8) requestAnimationFrame используется для анимации

  И также предполагается, что в HTML (или CSS) у вас есть элементы
  для виртуальных стрелок. Например:

    <div id="virtualControls">
      <button id="btnUp">▲</button>
      <div class="middle-row">
        <button id="btnLeft">◀</button>
        <button id="btnRight">▶</button>
      </div>
      <button id="btnDown">▼</button>
    </div>

  Стили и расположение кнопок (абсолютное, фиксированное и т.д.) вы
  можете сделать по своему вкусу.
*/

/********************************************************
  ГЛОБАЛЬНЫЕ ПЕРЕМЕННЫЕ ДЛЯ ИГРЫ
********************************************************/
let specialGameCanvas;
let specialCtx;
let specialGameRoomRef = null;    // Ссылка на конкретную комнату в Firebase
let specialGameKey     = null;    // Идентификатор комнаты
let localPlayerId      = null;    // 'player1' или 'player2'
let gameState          = null;    // Текущее состояние игры (player1, player2, ball, статус и т.д.)
let animationFrameId   = null;    // ID анимационного фрейма для requestAnimationFrame

// Размеры поля (canvas)
const FIELD_WIDTH  = 400;  // должно совпадать с canvas.width
const FIELD_HEIGHT = 650;  // должно совпадать с canvas.height

// Параметры шайбы-игрока
const PLAYER_RADIUS = 30;   
const PLAYER_SPEED  = 5;   // скорость передвижения шайбы (по клавишам)

// Мяч
const BALL_RADIUS   = 15;
const BALL_SPEED    = 6;   // базовая скорость для начального удара

// Половина поля для каждого игрока
// Предположим: player1 - нижний, player2 - верхний
const MIDDLE_LINE = FIELD_HEIGHT / 2;

// Состояние нажатых клавиш / виртуальных кнопок
let moveLeft  = false;
let moveRight = false;
let moveUp    = false;
let moveDown  = false;

/********************************************************
  ИНИЦИАЛИЗАЦИЯ ИГРЫ
********************************************************/
function initSpecialGame1() {
  // Получаем canvas и context
  specialGameCanvas = document.getElementById("specialGameCanvas");
  specialCtx = specialGameCanvas.getContext("2d");

  // Назначаем обработчики клавиатуры
  window.addEventListener("keydown", onKeyDown);
  window.addEventListener("keyup", onKeyUp);

  // Подключим виртуальные кнопки (если они есть в HTML)
  addVirtualButtonsListeners();

  // Ищем / создаём комнату
  findOrCreateRoom()
    .then(() => {
      // Подключаемся к обновлениям в Firebase
      listenToGameRoom();

      // Запускаем анимационный цикл
      startGameLoop();
    })
    .catch(err => {
      console.error("Ошибка при поиске/создании комнаты:", err);
      // Можно показать пользователю сообщение об ошибке
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
    // Нашли существующую комнату, присоединимся как player2
    specialGameKey = foundRoomKey;
    specialGameRoomRef = roomsRef.child(specialGameKey);

    // Обновим данные в этой комнате (назначим player2)
    await specialGameRoomRef.update({
      "player2/username": currentUser.username,
      status: "playing"    // Теперь в комнате 2 игрока, можно играть
    });
    localPlayerId = "player2";
  } else {
    // Нет свободной комнаты: создаём новую
    specialGameKey = roomsRef.push().key;
    specialGameRoomRef = roomsRef.child(specialGameKey);

    // Случайно определим, кто начнёт с мячом
    const startWithBall = Math.random() < 0.5 ? "player1" : "player2";

    // Начальное состояние
    const initialState = {
      status: "waiting", // ждём второго игрока
      ball: {
        x: FIELD_WIDTH / 2,
        y: FIELD_HEIGHT / 2,
        vx: 0,
        vy: 0
      },
      player1: {
        username: currentUser.username,
        x: FIELD_WIDTH / 2,
        y: FIELD_HEIGHT - 80,  // ближе к низу
        score: 0
      },
      player2: {
        username: "",
        x: FIELD_WIDTH / 2,
        y: 80,                // ближе к верху
        score: 0
      },
      startWithBall: startWithBall
    };

    await specialGameRoomRef.set(initialState);
    localPlayerId = "player1";
  }
}

/********************************************************
  ПРОСЛУШКА (REALTIME) И ОБНОВЛЕНИЕ gameState
********************************************************/
function listenToGameRoom() {
  if (!specialGameRoomRef) return;

  specialGameRoomRef.on("value", (snapshot) => {
    if (!snapshot.exists()) return;
    const data = snapshot.val();

    gameState = data;
    checkForWinCondition();

    // Если статус "playing", а мяч не двигается (vx=0, vy=0),
    // и если мы — владелец, то запуск мяч.
    if (data.status === "playing") {
      if (data.ball.vx === 0 && data.ball.vy === 0) {
        if (data.startWithBall === localPlayerId) {
          launchBall(localPlayerId);
        }
      }
    }
  });
}

/********************************************************
  ПРОВЕРКА ПОБЕДЫ
********************************************************/
function checkForWinCondition() {
  if (!gameState || !gameState.player1 || !gameState.player2) return;

  const score1 = gameState.player1.score;
  const score2 = gameState.player2.score;

  // Игра до 3 голов
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

    if (specialGameRoomRef) {
      specialGameRoomRef.update({ status: "finished" });
    }

    showEndGameModal(title, message);
  }
}

/********************************************************
  ЗАПУСК МЯЧА
********************************************************/
function launchBall(ownerPlayerId) {
  if (!specialGameRoomRef || !gameState) return;

  // Случайное направление
  let vx = (Math.random() * 4) - 2;  // -2..2
  let vy = (ownerPlayerId === "player1") ? -BALL_SPEED : BALL_SPEED;

  specialGameRoomRef.child("ball").update({
    vx: vx,
    vy: vy
  });
}

/********************************************************
  ЦИКЛ АНИМАЦИИ
********************************************************/
function startGameLoop() {
  function gameLoop() {
    // 1) Двигаем шайбу локального игрока (по нажатым клавишам) и пишем в Firebase
    if (gameState && gameState.status === "playing") {
      updateLocalPlayerPosition();
    }

    // 2) Физика мяча (отскоки, голы) — только у хозяина (player1)
    if (localPlayerId === "player1" && gameState && gameState.status === "playing") {
      updateBallPosition();
      detectCollisions();
    }

    // 3) Отрисовка
    render();

    animationFrameId = requestAnimationFrame(gameLoop);
  }
  animationFrameId = requestAnimationFrame(gameLoop);
}

/********************************************************
  ОБНОВЛЕНИЕ ПОЛОЖЕНИЯ ЛОКАЛЬНОГО ИГРОКА
********************************************************/
function updateLocalPlayerPosition() {
  if (!specialGameRoomRef || !gameState) return;
  const player = gameState[localPlayerId];
  if (!player) return;

  let { x, y } = player;

  // Движение по клавишам / виртуальным кнопкам
  if (moveLeft)  x -= PLAYER_SPEED;
  if (moveRight) x += PLAYER_SPEED;
  if (moveUp)    y -= PLAYER_SPEED;
  if (moveDown)  y += PLAYER_SPEED;

  // Ограничиваем игрока своей половиной
  if (localPlayerId === "player1") {
    // Не выше середины
    if (y < MIDDLE_LINE + PLAYER_RADIUS) {
      y = MIDDLE_LINE + PLAYER_RADIUS;
    }
  } else {
    // localPlayerId === "player2": не ниже середины
    if (y > MIDDLE_LINE - PLAYER_RADIUS) {
      y = MIDDLE_LINE - PLAYER_RADIUS;
    }
  }

  // Не выходим за левую/правую границы
  if (x < PLAYER_RADIUS) {
    x = PLAYER_RADIUS;
  }
  if (x > FIELD_WIDTH - PLAYER_RADIUS) {
    x = FIELD_WIDTH - PLAYER_RADIUS;
  }

  // Не выходим за верх/низ поля (для своей половины достаточно)
  if (localPlayerId === "player1") {
    // нижняя часть поля
    if (y > FIELD_HEIGHT - PLAYER_RADIUS) {
      y = FIELD_HEIGHT - PLAYER_RADIUS;
    }
  } else {
    // верхняя часть поля
    if (y < PLAYER_RADIUS) {
      y = PLAYER_RADIUS;
    }
  }

  // Запишем новые координаты в Firebase
  specialGameRoomRef.child(localPlayerId).update({ x, y });
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

  // Проверка на гол
  // Упрощение: ворота по всей ширине, верхнее = y < 0, нижнее = y > FIELD_HEIGHT
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

  // Отскоки от стен слева/справа
  if (x < BALL_RADIUS) {
    x = BALL_RADIUS;
    vx = -vx;
  }
  if (x > FIELD_WIDTH - BALL_RADIUS) {
    x = FIELD_WIDTH - BALL_RADIUS;
    vx = -vx;
  }

  // Обновим в БД
  specialGameRoomRef.child("ball").update({
    x: x,
    y: y,
    vx: vx,
    vy: vy
  });
}

/********************************************************
  СБРОС МЯЧА (после гола)
********************************************************/
function resetBall(scoringPlayerId) {
  if (!specialGameRoomRef) return;

  // Ставим мяч в центр, останавливаем
  specialGameRoomRef.child("ball").update({
    x: FIELD_WIDTH / 2,
    y: FIELD_HEIGHT / 2,
    vx: 0,
    vy: 0
  });

  // Мяч переходит к тому, кто пропустил
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

    // Формула отражения: v' = v - 2(v·n)*n
    const dot = vx*nx + vy*ny;
    vx = vx - 2 * dot * nx;
    vy = vy - 2 * dot * ny;

    // Чуть увеличим скорость, чтобы "выпихнуть" мяч
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
  ОТРИСОВКА ИГРЫ
********************************************************/
function render() {
  if (!gameState) {
    // Пока нет состояния, просто очистим
    specialCtx.clearRect(0, 0, FIELD_WIDTH, FIELD_HEIGHT);
    return;
  }

  // Если статус "waiting", показываем чёрный экран и надпись "Поиск соперника..."
  if (gameState.status === "waiting") {
    specialCtx.fillStyle = "#000000";
    specialCtx.fillRect(0, 0, FIELD_WIDTH, FIELD_HEIGHT);

    specialCtx.fillStyle = "#FFFFFF";
    specialCtx.font = "24px Arial";
    specialCtx.textAlign = "center";
    specialCtx.fillText("Поиск соперника...", FIELD_WIDTH / 2, FIELD_HEIGHT / 2);
    return;
  }

  // Если статус "finished", можно просто зафризить картинку или тоже затенить
  if (gameState.status === "finished") {
    // Нарисуем чёрный экран с полупрозрачностью
    specialCtx.fillStyle = "rgba(0,0,0,0.7)";
    specialCtx.fillRect(0, 0, FIELD_WIDTH, FIELD_HEIGHT);

    specialCtx.fillStyle = "#FFFFFF";
    specialCtx.font = "24px Arial";
    specialCtx.textAlign = "center";
    specialCtx.fillText("Игра завершена", FIELD_WIDTH / 2, FIELD_HEIGHT / 2);
    return;
  }

  // status === "playing"

  // Фон чёрный
  specialCtx.fillStyle = "#000000";
  specialCtx.fillRect(0, 0, FIELD_WIDTH, FIELD_HEIGHT);

  drawField();
  drawBall();
  drawPlayers();
  drawScore();
}

/********************************************************
  РИСУЕМ ПОЛЕ
********************************************************/
function drawField() {
  // Границы поля (линии)
  specialCtx.strokeStyle = "#FFFFFF";
  specialCtx.lineWidth = 3;
  specialCtx.strokeRect(0, 0, FIELD_WIDTH, FIELD_HEIGHT);

  // Средняя линия
  specialCtx.beginPath();
  specialCtx.moveTo(0, MIDDLE_LINE);
  specialCtx.lineTo(FIELD_WIDTH, MIDDLE_LINE);
  specialCtx.stroke();
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
  РИСУЕМ ИГРОКОВ + ИМЯ СОПЕРНИКА
********************************************************/
function drawPlayers() {
  // player1 (нижний)
  const p1 = gameState.player1;
  if (p1) {
    specialCtx.fillStyle = "#00FF00";
    specialCtx.beginPath();
    specialCtx.arc(p1.x, p1.y, PLAYER_RADIUS, 0, Math.PI*2);
    specialCtx.fill();
  }

  // player2 (верхний)
  const p2 = gameState.player2;
  if (p2) {
    specialCtx.fillStyle = "#FFFF00";
    specialCtx.beginPath();
    specialCtx.arc(p2.x, p2.y, PLAYER_RADIUS, 0, Math.PI*2);
    specialCtx.fill();

    // Отобразим имя игрока player2 над воротами (для наглядности)
    if (p2.username) {
      specialCtx.fillStyle = "#FFFFFF";
      specialCtx.font = "20px Arial";
      specialCtx.textAlign = "center";
      // Пишем над верхними воротами (примерно на 30px от верха)
      specialCtx.fillText(p2.username, FIELD_WIDTH / 2, 30);
    }
  }

  // Хотите — добавьте отображение и собственного имени у нижних ворот
  // (например):
  const p1name = p1 && p1.username ? p1.username : "";
  specialCtx.fillStyle = "#FFFFFF";
  specialCtx.font = "20px Arial";
  specialCtx.textAlign = "center";
  specialCtx.fillText(p1name, FIELD_WIDTH / 2, FIELD_HEIGHT - 10);
}

/********************************************************
  РИСУЕМ СЧЁТ
********************************************************/
function drawScore() {
  const p1Score = gameState.player1.score || 0;
  const p2Score = gameState.player2.score || 0;

  specialCtx.fillStyle = "#FFFFFF";
  specialCtx.font = "24px Arial";
  specialCtx.textAlign = "center";
  specialCtx.fillText(`${p2Score} : ${p1Score}`, FIELD_WIDTH / 2, FIELD_HEIGHT / 2 - 10);
}

/********************************************************
  УПРАВЛЕНИЕ (КЛАВИАТУРА)
********************************************************/
function onKeyDown(e) {
  switch(e.code) {
    case "ArrowLeft":
    case "KeyA":
      moveLeft = true;
      break;
    case "ArrowRight":
    case "KeyD":
      moveRight = true;
      break;
    case "ArrowUp":
    case "KeyW":
      moveUp = true;
      break;
    case "ArrowDown":
    case "KeyS":
      moveDown = true;
      break;
    default:
      break;
  }
}

function onKeyUp(e) {
  switch(e.code) {
    case "ArrowLeft":
    case "KeyA":
      moveLeft = false;
      break;
    case "ArrowRight":
    case "KeyD":
      moveRight = false;
      break;
    case "ArrowUp":
    case "KeyW":
      moveUp = false;
      break;
    case "ArrowDown":
    case "KeyS":
      moveDown = false;
      break;
    default:
      break;
  }
}

/********************************************************
  УПРАВЛЕНИЕ (ВИРТУАЛЬНЫЕ КНОПКИ)
********************************************************/
function addVirtualButtonsListeners() {
  // Пример: кнопки с id="btnLeft", "btnRight", "btnUp", "btnDown".
  // Если их нет в HTML, просто ничего не делаем.
  const btnLeft  = document.getElementById("btnLeft");
  const btnRight = document.getElementById("btnRight");
  const btnUp    = document.getElementById("btnUp");
  const btnDown  = document.getElementById("btnDown");

  if (!btnLeft || !btnRight || !btnUp || !btnDown) return;

  // Для мобильных: touchstart/touchend
  btnLeft.addEventListener("touchstart",  () => { moveLeft = true; });
  btnLeft.addEventListener("touchend",    () => { moveLeft = false; });
  btnRight.addEventListener("touchstart", () => { moveRight = true; });
  btnRight.addEventListener("touchend",   () => { moveRight = false; });
  btnUp.addEventListener("touchstart",    () => { moveUp = true; });
  btnUp.addEventListener("touchend",      () => { moveUp = false; });
  btnDown.addEventListener("touchstart",  () => { moveDown = true; });
  btnDown.addEventListener("touchend",    () => { moveDown = false; });

  // Также можем поддержать mouse events (mousedown/mouseup),
  // если хотим, чтобы в десктопе эти кнопки тоже работали.
  btnLeft.addEventListener("mousedown",  () => { moveLeft = true; });
  btnLeft.addEventListener("mouseup",    () => { moveLeft = false; });
  btnRight.addEventListener("mousedown", () => { moveRight = true; });
  btnRight.addEventListener("mouseup",   () => { moveRight = false; });
  btnUp.addEventListener("mousedown",    () => { moveUp = true; });
  btnUp.addEventListener("mouseup",      () => { moveUp = false; });
  btnDown.addEventListener("mousedown",  () => { moveDown = true; });
  btnDown.addEventListener("mouseup",    () => { moveDown = false; });
}

/********************************************************
  СБРОС ИГРЫ
********************************************************/
function resetSpecialGame1() {
  // Убираем слушатели
  if (specialGameRoomRef) {
    specialGameRoomRef.off();
  }
  if (animationFrameId) {
    cancelAnimationFrame(animationFrameId);
    animationFrameId = null;
  }

  // Убираем клавиатурные слушатели
  window.removeEventListener("keydown", onKeyDown);
  window.removeEventListener("keyup", onKeyUp);

  // (Опционально) можно отключить слушатели с виртуальных кнопок,
  // если нужно, но чаще всего можно оставить.

  // Помечаем статус комнаты "finished", если она ещё в игре
  if (specialGameRoomRef && gameState && gameState.status !== "finished") {
    specialGameRoomRef.update({ status: "finished" });
  }

  specialGameRoomRef = null;
  specialGameKey = null;
  localPlayerId = null;
  gameState = null;

  // Сброс флагов движения
  moveLeft = moveRight = moveUp = moveDown = false;
}

/********************************************************
  Экспортируем функции в глобальную область,
  чтобы их мог вызвать ваш основной скрипт
********************************************************/
window.initSpecialGame1 = initSpecialGame1;
window.resetSpecialGame1 = resetSpecialGame1;
SpecialGame1 = resetSpecialGame1;
