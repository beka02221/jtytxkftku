/********************************************************
  specialgame1.js
  ----------------
  Реализация PvP-игры в стиле Glow Hockey:
  - Вертикальное поле, сверху ворота противника, снизу — ваши.
  - Каждый игрок управляет круглой «шайбой».
  - Мяч (puck/ball) отскакивает от стен и шайб игроков.
  - Счёт до 3 голов. Кто первым забьёт 3, тот и победил.
  - Синхронизация через Firebase Realtime Database.
********************************************************/

/* 
  Важно: предположим, что в основном файле index.html у нас уже
  есть следующие глобальные переменные:
  
  1) db               - ссылка на firebase.database()
  2) currentUser      - объект пользователя Telegram (tg.initDataUnsafe.user)
  3) userRef          - ссылка на узел 'users/username' в Firebase
  4) localUserData    - объект, в котором хранятся данные пользователя { photo, tickets, coins, points }
  5) showEndGameModal(title, message) - функция для показа финального окна (результат)
  6) finishGame()     - функция, вызываемая по нажатию «Close» в модалке результата
  7) Canvas с id="specialGameCanvas" в HTML
  8) requestAnimationFrame используется для анимации

  Функции для инициализации и сброса (initSpecialGame1 и resetSpecialGame1)
  нужно вызвать из вашего основного кода (например, в handleStartGame)
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
// Мяч
const BALL_RADIUS   = 15;
const BALL_SPEED    = 6;  // базовая скорость для начального удара

// Половина поля для каждого игрока
// Предположим: player1 - нижний, player2 - верхний
// (Можно по-другому, но для примера используем такой вариант.)
const MIDDLE_LINE = FIELD_HEIGHT / 2;

/********************************************************
  ИНИЦИАЛИЗАЦИЯ ИГРЫ
********************************************************/
function initSpecialGame1() {
  // Получаем canvas и context
  specialGameCanvas = document.getElementById("specialGameCanvas");
  specialCtx = specialGameCanvas.getContext("2d");

  // При инициализации пытаемся найти свободную комнату
  // или создаём новую и ждём второго игрока.
  findOrCreateRoom()
    .then(() => {
      // Навешиваем обработчики для управления шайбой (касания)
      addTouchListeners();

      // Запускаем прослушку изменений в Firebase (onValue)
      listenToGameRoom();

      // Запускаем цикл анимации
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
  // Идём в узел rooms для specialgame1
  const roomsRef = db.ref("games/specialgame1/rooms");

  // 1) Поищем любую комнату, где статус "waiting" (ждёт второго игрока).
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

    // Начальное состояние игры
    const initialState = {
      status: "waiting",   // ждём второго игрока
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

  // onValue — при любом изменении в комнате
  specialGameRoomRef.on("value", (snapshot) => {
    if (!snapshot.exists()) return;
    const data = snapshot.val();

    // Обновляем локальный gameState
    gameState = data;

    // Проверим, не завершена ли игра (счёт до 3)
    checkForWinCondition();

    // Если игра в статусе 'playing', а у нас есть "startWithBall"
    // и мяч ещё не двигается (vx=0, vy=0), то запускаем мяч
    // только если мы хозяева (player1). Иначе можно сделать,
    // что владелец мяча — тот, кто стартует (startWithBall).
    if (data.status === "playing") {
      // Запускаем мяч (только у «владельца»? или только у player1?)
      // Здесь упрощённо: мяч стартует, если тот игрок, который
      // указан в startWithBall, совпадает с localPlayerId
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

  // Игра длится до достижения любым игроком 3 очков
  if (score1 >= 3 || score2 >= 3) {
    // Формируем сообщение
    let title = "";
    let message = "";
    if (score1 > score2) {
      title = "Победа!";
      message = `Игрок ${gameState.player1.username} выиграл со счётом ${score1}:${score2}`;
    } else {
      title = "Победа!";
      message = `Игрок ${gameState.player2.username} выиграл со счётом ${score2}:${score1}`;
    }

    // Ставим статус = "finished"
    if (specialGameRoomRef) {
      specialGameRoomRef.update({ status: "finished" });
    }

    // Показываем финальное окно
    showEndGameModal(title, message);
  }
}

/********************************************************
  ЗАПУСК МЯЧА
********************************************************/
function launchBall(ownerPlayerId) {
  if (!specialGameRoomRef || !gameState) return;

  // Зададим случайное направление (приблизительно вверх/вниз)
  // Если владелец мяч — player1, мяч полетит вверх, иначе вниз
  let vx = (Math.random() * 4) - 2;  // -2..2
  let vy = ownerPlayerId === "player1" 
             ? -BALL_SPEED 
             : BALL_SPEED;

  // Обновим ball в Firebase
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
    // 1) Только один из игроков должен обрабатывать физику мяча.
    //    Для упрощения — player1 (хозяин комнаты).
    //    Или можно свериться с gameState.startWithBall.
    if (localPlayerId === "player1" && gameState && gameState.status === "playing") {
      updateBallPosition();
      detectCollisions();
    }

    // 2) Отрисовка (оба игрока могут отрисовывать локально
    //    по полученным из БД координатам).
    render();

    animationFrameId = requestAnimationFrame(gameLoop);
  }
  animationFrameId = requestAnimationFrame(gameLoop);
}

/********************************************************
  ОБНОВЛЕНИЕ ПОЛОЖЕНИЯ МЯЧА (ТОЛЬКО У «ХОЗЯИНА»)
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
  // В верхних воротах: y < 0 (пересёк границу)
  // В нижних воротах: y > FIELD_HEIGHT
  // Простая проверка, можно усложнить (учитывая ширину ворот).
  // Здесь: считаем, что ворота по всей ширине (упрощённо).
  if (y < 0) {
    // ГОЛ player1 (снизу)
    const newScore = (gameState.player1.score || 0) + 1;
    specialGameRoomRef.child("player1").update({ score: newScore });
    resetBall("player1");
    return;
  }
  if (y > FIELD_HEIGHT) {
    // ГОЛ player2 (сверху)
    const newScore = (gameState.player2.score || 0) + 1;
    specialGameRoomRef.child("player2").update({ score: newScore });
    resetBall("player2");
    return;
  }

  // Ограничим движение мяча по стенкам слева/справа
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
  СБРОС МЯЧА ПОСЛЕ ГОЛА
********************************************************/
function resetBall(scoringPlayerId) {
  if (!specialGameRoomRef) return;

  // Ставим мяч в центр, скорость 0 (пока не перезапустят)
  specialGameRoomRef.child("ball").update({
    x: FIELD_WIDTH / 2,
    y: FIELD_HEIGHT / 2,
    vx: 0,
    vy: 0
  });

  // Теперь владелец мяча — тот, кто пропустил гол
  // и именно он при следующем update может «запустить» мяч.
  const nextOwner = (scoringPlayerId === "player1") ? "player2" : "player1";
  specialGameRoomRef.update({ startWithBall: nextOwner });
}

/********************************************************
  ОБНАРУЖЕНИЕ СТОЛКНОВЕНИЙ МЯЧА С ШАЙБАМИ ИГРОКОВ
********************************************************/
function detectCollisions() {
  if (!gameState) return;
  const ball = gameState.ball;
  if (!ball) return;

  // проверяем столкновения с player1 и player2
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
    // Простейшая реакция: отбрасываем мяч в направлении от центра игрока
    const overlap = (BALL_RADIUS + PLAYER_RADIUS) - dist;
    // Нормаль
    const nx = dx / dist;
    const ny = dy / dist;

    // Сдвинем мяч, чтобы не было overlap
    let newBallX = ball.x + nx * overlap;
    let newBallY = ball.y + ny * overlap;

    // А скорость развернём по нормали (упрощённо)
    let vx = ball.vx;
    let vy = ball.vy;

    // Отражение вектора (vx,vy) относительно нормали (nx, ny)
    // Формула отражения: v' = v - 2(v·n)*n
    const dot = vx*nx + vy*ny;
    vx = vx - 2 * dot * nx;
    vy = vy - 2 * dot * ny;

    // Увеличим скорость чуть-чуть (или оставим как есть)
    // чтобы мяч не «залипал» в игроке
    vx *= 1.05;
    vy *= 1.05;

    // Обновим в БД
    specialGameRoomRef.child("ball").update({
      x: newBallX,
      y: newBallY,
      vx: vx,
      vy: vy
    });
  }
}

/********************************************************
  РЕНДЕР ИГРЫ
********************************************************/
function render() {
  if (!gameState) return;

  // Очищаем поле
  specialCtx.clearRect(0, 0, FIELD_WIDTH, FIELD_HEIGHT);

  // Рисуем границы поля (можно оформить как хотите)
  drawFieldBorders();

  // Рисуем зоны ворот (верх и низ) другим цветом
  drawGoals();

  // Рисуем мяч
  const ball = gameState.ball;
  if (ball) {
    specialCtx.fillStyle = "#FF0000";
    specialCtx.beginPath();
    specialCtx.arc(ball.x, ball.y, BALL_RADIUS, 0, Math.PI*2);
    specialCtx.fill();
  }

  // Рисуем игрока1
  drawPlayer("player1", "#00FF00");

  // Рисуем игрока2
  drawPlayer("player2", "#FFFF00");

  // Рисуем счёт
  drawScore();
}

function drawFieldBorders() {
  specialCtx.strokeStyle = "#FFFFFF";
  specialCtx.lineWidth = 3;
  specialCtx.strokeRect(0, 0, FIELD_WIDTH, FIELD_HEIGHT);
  // Средняя линия
  specialCtx.beginPath();
  specialCtx.moveTo(0, MIDDLE_LINE);
  specialCtx.lineTo(FIELD_WIDTH, MIDDLE_LINE);
  specialCtx.stroke();
}

function drawGoals() {
  // Допустим, закрасим полосы вверху и внизу
  // Ворота (примитивно) — по всей ширине
  specialCtx.fillStyle = "rgba(255, 0, 255, 0.2)"; // полупрозрачный
  // Верхняя зона
  specialCtx.fillRect(0, 0, FIELD_WIDTH, 30);
  // Нижняя зона
  specialCtx.fillRect(0, FIELD_HEIGHT - 30, FIELD_WIDTH, 30);
}

function drawPlayer(playerId, color) {
  const player = gameState[playerId];
  if (!player) return;

  specialCtx.fillStyle = color;
  specialCtx.beginPath();
  specialCtx.arc(player.x, player.y, PLAYER_RADIUS, 0, Math.PI*2);
  specialCtx.fill();
}

function drawScore() {
  specialCtx.fillStyle = "#FFFFFF";
  specialCtx.font = "24px Arial";
  specialCtx.textAlign = "center";

  const p1Score = gameState.player1.score || 0;
  const p2Score = gameState.player2.score || 0;

  // Выводим счёт в центре
  specialCtx.fillText(`${p2Score} : ${p1Score}`, FIELD_WIDTH / 2, FIELD_HEIGHT / 2 - 10);
}

/********************************************************
  ОБРАБОТКА ТАЧ-СОБЫТИЙ (УПРАВЛЕНИЕ ШАЙБОЙ)
********************************************************/
function addTouchListeners() {
  // Позволим игроку двигать свою шайбу, пока он не пересекает
  // центральную линию (если player1, то нельзя выше MIDDLE_LINE,
  // если player2, то нельзя ниже MIDDLE_LINE).
  if (!specialGameCanvas) return;

  specialGameCanvas.addEventListener("touchstart", onTouchStart, false);
  specialGameCanvas.addEventListener("touchmove", onTouchMove, false);
  specialGameCanvas.addEventListener("touchend", onTouchEnd, false);
}

function onTouchStart(e) {
  // Для простоты можно просто предотвратить скролл
  e.preventDefault();
}

function onTouchMove(e) {
  e.preventDefault();
  if (!gameState) return;
  const player = gameState[localPlayerId];
  if (!player) return;

  // Берём координаты касания
  const touch = e.touches[0];
  const rect = specialGameCanvas.getBoundingClientRect();
  
  const x = touch.clientX - rect.left;
  const y = touch.clientY - rect.top;

  // Ограничим перемещение игрока только своей половиной
  let newY = y;
  if (localPlayerId === "player1") {
    // Не поднимаемся выше середины
    if (newY < MIDDLE_LINE + PLAYER_RADIUS) {
      newY = MIDDLE_LINE + PLAYER_RADIUS;
    }
  } else {
    // localPlayerId === "player2"
    // Не опускаемся ниже середины
    if (newY > MIDDLE_LINE - PLAYER_RADIUS) {
      newY = MIDDLE_LINE - PLAYER_RADIUS;
    }
  }

  // Также не выходим за границы поля
  let newX = Math.max(PLAYER_RADIUS, Math.min(x, FIELD_WIDTH - PLAYER_RADIUS));

  // Обновляем координаты в Firebase
  // (Если статус игры — playing, имеет смысл обновлять)
  if (specialGameRoomRef && gameState.status === "playing") {
    specialGameRoomRef.child(localPlayerId).update({
      x: newX,
      y: newY
    });
  }
}

function onTouchEnd(e) {
  e.preventDefault();
  // Можно ничего не делать
}

/********************************************************
  СБРОС ИГРЫ (resetSpecialGame1)
  Вызывается при выходе / закрытии модалки
********************************************************/
function resetSpecialGame1() {
  // Отключаем слушатель комнаты
  if (specialGameRoomRef) {
    specialGameRoomRef.off();
  }

  // Отменяем анимацию
  if (animationFrameId) {
    cancelAnimationFrame(animationFrameId);
    animationFrameId = null;
  }

  // Убираем слушатели событий на canvas
  if (specialGameCanvas) {
    specialGameCanvas.removeEventListener("touchstart", onTouchStart);
    specialGameCanvas.removeEventListener("touchmove", onTouchMove);
    specialGameCanvas.removeEventListener("touchend", onTouchEnd);
  }

  // При желании можем очистить данные комнаты или выйти из неё
  // чтобы в следующий раз пользователь создавал/находил новую комнату.
  // Но часто лучше просто ставить статус "finished".
  if (specialGameRoomRef && gameState && gameState.status !== "finished") {
    specialGameRoomRef.update({ status: "finished" });
  }

  specialGameRoomRef = null;
  specialGameKey = null;
  localPlayerId = null;
  gameState = null;
}

/********************************************************
  Экспортируем функции в глобальную область,
  чтобы их мог вызвать ваш основной скрипт
********************************************************/
window.initSpecialGame1 = initSpecialGame1;
window.resetSpecialGame1 = resetSpecialGame1;
