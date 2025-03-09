/* 
  game2.js – Игра Air Hockey (с ботом)
  Игра идёт до 5 очков. Если игрок побеждает, то получает 200 points.
  Адаптация аналогична game3.js – обновляются очки пользователя через userRef,
  вызывается showEndGameModal и производится сброс игрового состояния.
*/

// Глобальные переменные для game2
let game2Canvas, game2Ctx;
let puck, playerMallet, botMallet;
let playerScore = 0, botScore = 0;
let game2Running = false;     // Флаг игрового цикла
let game2Started = false;     // Флаг начала игры (запускается при первом движении)
let animationFrameId2;

const PUCK_RADIUS = 10;       // Радиус шайбы
const MALLET_RADIUS = 20;     // Радиус ракеток
const INITIAL_PUCK_SPEED = 4; // Начальная скорость шайбы
const BOT_SPEED = 3;          // Максимальная скорость перемещения ракетки бота
const SCORE_TO_WIN = 5;       // Количество очков для победы

// Инициализация игры
function initGame2() {
  game2Canvas = document.getElementById('match3Canvas');
  if (!game2Canvas) {
    console.error("Элемент canvas с id 'match3Canvas' не найден.");
    return;
  }
  game2Ctx = game2Canvas.getContext('2d');

  // Инициализируем позиции мяча и ракеток
  resetPositions();

  // Сброс счёта
  playerScore = 0;
  botScore = 0;

  game2Started = false;
  game2Running = false;

  // Добавляем обработчики для управления игроком
  game2Canvas.addEventListener("mousemove", mouseMoveHandler2, false);
  game2Canvas.addEventListener("touchmove", touchMoveHandler2, { passive: false });

  // Отрисовываем начальное состояние игры
  drawGame2();
}

// Функция сброса позиций объектов (шайбы и ракеток)
function resetPositions() {
  const centerX = game2Canvas.width / 2;
  const centerY = game2Canvas.height / 2;

  // Инициализация шайбы
  puck = {
    x: centerX,
    y: centerY,
    radius: PUCK_RADIUS,
    // Начальное направление выбирается случайно
    dx: (Math.random() > 0.5 ? 1 : -1) * INITIAL_PUCK_SPEED,
    dy: (Math.random() > 0.5 ? 1 : -1) * INITIAL_PUCK_SPEED
  };

  // Ракетка игрока (находится в нижней части экрана)
  playerMallet = {
    x: centerX,
    y: game2Canvas.height - MALLET_RADIUS - 10,
    radius: MALLET_RADIUS
  };

  // Ракетка бота (верхняя часть экрана)
  botMallet = {
    x: centerX,
    y: MALLET_RADIUS + 10,
    radius: MALLET_RADIUS
  };
}

// Основной игровой цикл
function gameLoop2() {
  updateGame2();
  drawGame2();
  if (game2Running) {
    animationFrameId2 = requestAnimationFrame(gameLoop2);
  }
}

// Обновление состояния игры
function updateGame2() {
  // Если игра не началась, не двигаем шайбу
  if (!game2Started) {
    return;
  }

  // Обновляем позицию шайбы
  puck.x += puck.dx;
  puck.y += puck.dy;

  // Отскок от боковых стен
  if (puck.x + puck.radius > game2Canvas.width || puck.x - puck.radius < 0) {
    puck.dx = -puck.dx;
  }

  // Обработка ворот:
  // Определяем "ворота" как центральную область края (ширина ворот – 100 пикселей)
  const goalWidth = 100;
  // Верхние ворота (если шайба уходит за верх, это гол игрока)
  if (puck.y - puck.radius < 0) {
    if (puck.x > (game2Canvas.width - goalWidth) / 2 && puck.x < (game2Canvas.width + goalWidth) / 2) {
      // Гол игрока
      playerScore++;
      checkWinCondition();
      resetPositions();
      game2Started = false;
      return;
    } else {
      puck.dy = -puck.dy;
    }
  }
  // Нижние ворота (если шайба уходит за низ, это гол бота)
  if (puck.y + puck.radius > game2Canvas.height) {
    if (puck.x > (game2Canvas.width - goalWidth) / 2 && puck.x < (game2Canvas.width + goalWidth) / 2) {
      // Гол бота
      botScore++;
      checkWinCondition();
      resetPositions();
      game2Started = false;
      return;
    } else {
      puck.dy = -puck.dy;
    }
  }

  // Проверка столкновений шайбы с ракеткой игрока
  if (isColliding(puck, playerMallet)) {
    handleMalletCollision(playerMallet);
  }

  // Проверка столкновений шайбы с ракеткой бота
  if (isColliding(puck, botMallet)) {
    handleMalletCollision(botMallet);
  }

  // Обновляем позицию ракетки бота (простой ИИ)
  updateBotMallet();
}

// Функция проверки столкновения двух кругов
function isColliding(circle1, circle2) {
  const dx = circle1.x - circle2.x;
  const dy = circle1.y - circle2.y;
  const distance = Math.sqrt(dx * dx + dy * dy);
  return distance < (circle1.radius + circle2.radius);
}

// Обработка столкновения шайбы с ракеткой
function handleMalletCollision(mallet) {
  // Рассчитываем вектор от центра ракетки к центру шайбы
  const dx = puck.x - mallet.x;
  const dy = puck.y - mallet.y;
  const distance = Math.sqrt(dx * dx + dy * dy);
  if (distance === 0) return; // на всякий случай
  // Нормализуем вектор
  const nx = dx / distance;
  const ny = dy / distance;
  // Немного ускоряем шайбу при столкновении (если скорость меньше порога)
  const speed = Math.sqrt(puck.dx * puck.dx + puck.dy * puck.dy);
  const newSpeed = speed < 6 ? speed + 0.5 : speed;
  puck.dx = nx * newSpeed;
  puck.dy = ny * newSpeed;
  // Смещаем шайбу так, чтобы она не "залипла" в ракетке
  puck.x = mallet.x + nx * (mallet.radius + puck.radius);
  puck.y = mallet.y + ny * (mallet.radius + puck.radius);
}

// Простое управление ракеткой бота – движение по оси X в сторону шайбы
function updateBotMallet() {
  if (puck.x < botMallet.x) {
    botMallet.x -= BOT_SPEED;
  } else if (puck.x > botMallet.x) {
    botMallet.x += BOT_SPEED;
  }
  // Ограничиваем движение бота в пределах канваса
  botMallet.x = Math.max(botMallet.radius, Math.min(game2Canvas.width - botMallet.radius, botMallet.x));
}

// Отрисовка игрового поля
function drawGame2() {
  // Очистка холста
  game2Ctx.clearRect(0, 0, game2Canvas.width, game2Canvas.height);
  // Фон
  game2Ctx.fillStyle = "#00103c";
  game2Ctx.fillRect(0, 0, game2Canvas.width, game2Canvas.height);

  // Рисуем разделительную линию (с пунктиром)
  game2Ctx.strokeStyle = "#fff";
  game2Ctx.setLineDash([5, 5]);
  game2Ctx.beginPath();
  game2Ctx.moveTo(0, game2Canvas.height / 2);
  game2Ctx.lineTo(game2Canvas.width, game2Canvas.height / 2);
  game2Ctx.stroke();
  game2Ctx.setLineDash([]);

  // Рисуем воротные зоны (белыми прямоугольниками)
  const goalWidth = 100;
  // Верхние ворота
  game2Ctx.fillStyle = "#fff";
  game2Ctx.fillRect((game2Canvas.width - goalWidth) / 2, 0, goalWidth, 10);
  // Нижние ворота
  game2Ctx.fillRect((game2Canvas.width - goalWidth) / 2, game2Canvas.height - 10, goalWidth, 10);

  // Рисуем шайбу
  game2Ctx.beginPath();
  game2Ctx.arc(puck.x, puck.y, puck.radius, 0, Math.PI * 2);
  game2Ctx.fillStyle = "#FF4500";
  game2Ctx.fill();
  game2Ctx.closePath();

  // Рисуем ракетку игрока
  game2Ctx.beginPath();
  game2Ctx.arc(playerMallet.x, playerMallet.y, playerMallet.radius, 0, Math.PI * 2);
  game2Ctx.fillStyle = "#0095DD";
  game2Ctx.fill();
  game2Ctx.closePath();

  // Рисуем ракетку бота
  game2Ctx.beginPath();
  game2Ctx.arc(botMallet.x, botMallet.y, botMallet.radius, 0, Math.PI * 2);
  game2Ctx.fillStyle = "#0095DD";
  game2Ctx.fill();
  game2Ctx.closePath();

  // Отображаем счёт
  game2Ctx.font = "16px Arial";
  game2Ctx.fillStyle = "#FFF";
  game2Ctx.fillText("Player: " + playerScore, 10, game2Canvas.height - 20);
  game2Ctx.fillText("Bot: " + botScore, 10, 30);
}

// Проверка условия победы
function checkWinCondition() {
  if (playerScore >= SCORE_TO_WIN || botScore >= SCORE_TO_WIN) {
    game2Running = false;
    // Если игрок побеждает, начисляем 200 points
    if (playerScore >= SCORE_TO_WIN) {
      if (typeof userRef !== 'undefined' && typeof localUserData !== 'undefined') {
        localUserData.points += 200;
        userRef.update({ points: localUserData.points });
      }
      showEndGameModal("You Win!", "Your score: " + playerScore);
    } else {
      showEndGameModal("Game Over", "Your score: " + playerScore);
    }
  }
}

// Обработчик движения мыши – управление ракеткой игрока
function mouseMoveHandler2(e) {
  let rect = game2Canvas.getBoundingClientRect();
  let relativeX = e.clientX - rect.left;
  let relativeY = e.clientY - rect.top;
  // Ограничиваем движение игрока только нижней половиной экрана
  if (relativeY < game2Canvas.height / 2 + MALLET_RADIUS) {
    relativeY = game2Canvas.height / 2 + MALLET_RADIUS;
  }
  if (relativeX > 0 && relativeX < game2Canvas.width) {
    playerMallet.x = relativeX;
    playerMallet.y = relativeY;
  }
  // При первом движении запускаем игру
  if (!game2Started) {
    game2Started = true;
    game2Running = true;
    gameLoop2();
  }
}

// Обработчик касаний для мобильных устройств
function touchMoveHandler2(e) {
  e.preventDefault();
  let touch = e.touches[0];
  let rect = game2Canvas.getBoundingClientRect();
  let relativeX = touch.clientX - rect.left;
  let relativeY = touch.clientY - rect.top;
  if (relativeY < game2Canvas.height / 2 + MALLET_RADIUS) {
    relativeY = game2Canvas.height / 2 + MALLET_RADIUS;
  }
  if (relativeX > 0 && relativeX < game2Canvas.width) {
    playerMallet.x = relativeX;
    playerMallet.y = relativeY;
  }
  if (!game2Started) {
    game2Started = true;
    game2Running = true;
    gameLoop2();
  }
}

// Функция сброса игры (вызывается при завершении)
function resetGame2() {
  cancelAnimationFrame(animationFrameId2);
  game2Running = false;
  game2Canvas.removeEventListener("mousemove", mouseMoveHandler2);
  game2Canvas.removeEventListener("touchmove", touchMoveHandler2);
  if (game2Ctx) {
    game2Ctx.clearRect(0, 0, game2Canvas.width, game2Canvas.height);
  }
}

