/* 
  game2.js – Игра Air Hockey (с ботом)
  Улучшенная версия с неоновым оформлением, звуковыми эффектами и улучшенной механикой.
  Игра идёт до 5 очков. Если игрок побеждает, то получает 200 points.
  При забитом голе сменяется подача: если забил игрок, то следующий розыгрыш начинается с подачи бота, и наоборот.
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
const BOT_SPEED = 3;          // Максимальная скорость движения ракетки бота
const SCORE_TO_WIN = 5;       // Количество очков для победы

// Флаг подачи: если true, то игрок подаёт; если false – бот
let serveByPlayer = true;

// Звуковые эффекты (файлы должны быть доступны по указанным путям)
let hitSound = new Audio('sounds/hit.mp3');    // Звук столкновения
let scoreSound = new Audio('sounds/score.mp3');  // Звук гола

// Инициализация игры
function initGame2() {
  game2Canvas = document.getElementById('match3Canvas');
  if (!game2Canvas) {
    console.error("Элемент canvas с id 'match3Canvas' не найден.");
    return;
  }
  game2Ctx = game2Canvas.getContext('2d');

  // Фиксированные позиции ракеток
  const centerX = game2Canvas.width / 2;
  playerMallet = {
    x: centerX,
    y: game2Canvas.height - MALLET_RADIUS - 10,
    radius: MALLET_RADIUS
  };
  botMallet = {
    x: centerX,
    y: MALLET_RADIUS + 10,
    radius: MALLET_RADIUS
  };

  // Сброс позиций шайбы и счёта
  resetPuckPosition();
  playerScore = 0;
  botScore = 0;

  game2Started = false;
  game2Running = false;

  // Добавляем обработчики событий
  game2Canvas.addEventListener("mousemove", mouseMoveHandler2, false);
  game2Canvas.addEventListener("touchmove", touchMoveHandler2, { passive: false });

  // Отрисовываем начальное состояние
  drawGame2();
}

// Сброс позиции шайбы с учётом подачи
function resetPuckPosition() {
  const centerX = game2Canvas.width / 2;
  if (serveByPlayer) {
    // Игрок подаёт: шайба появляется рядом с ракеткой игрока, направлена вверх
    puck = {
      x: playerMallet.x,
      y: playerMallet.y - (MALLET_RADIUS + PUCK_RADIUS + 5),
      radius: PUCK_RADIUS,
      dx: (Math.random() > 0.5 ? 1 : -1) * INITIAL_PUCK_SPEED,
      dy: -INITIAL_PUCK_SPEED
    };
  } else {
    // Бот подаёт: шайба появляется рядом с ракеткой бота, направлена вниз
    puck = {
      x: botMallet.x,
      y: botMallet.y + (MALLET_RADIUS + PUCK_RADIUS + 5),
      radius: PUCK_RADIUS,
      dx: (Math.random() > 0.5 ? 1 : -1) * INITIAL_PUCK_SPEED,
      dy: INITIAL_PUCK_SPEED
    };
  }
}

// Основной игровой цикл
function gameLoop2() {
  updateGame2();
  drawGame2();
  if (game2Running) {
    animationFrameId2 = requestAnimationFrame(gameLoop2);
  }
}

// Обновление игрового состояния
function updateGame2() {
  if (!game2Started) return;

  // Обновляем позицию шайбы
  puck.x += puck.dx;
  puck.y += puck.dy;

  // Ограничиваем движение по горизонтали
  if (puck.x < puck.radius) {
    puck.x = puck.radius;
    puck.dx = -puck.dx;
  }
  if (puck.x > game2Canvas.width - puck.radius) {
    puck.x = game2Canvas.width - puck.radius;
    puck.dx = -puck.dx;
  }

  // Воротная зона (ширина ворот – 100 пикселей)
  const goalWidth = 100;

  // Если шайба уходит за верхнюю границу (это гол для игрока)
  if (puck.y - puck.radius < 0) {
    if (puck.x > (game2Canvas.width - goalWidth) / 2 && puck.x < (game2Canvas.width + goalWidth) / 2) {
      playerScore++;
      scoreSound.play();
      // Если игрок забил, следующий розыгрыш начинается с подачи бота
      serveByPlayer = false;
      checkWinCondition();
      resetPuckPosition();
      game2Started = false;
      return;
    } else {
      puck.dy = -puck.dy;
    }
  }

  // Если шайба уходит за нижнюю границу (гол для бота)
  if (puck.y + puck.radius > game2Canvas.height) {
    if (puck.x > (game2Canvas.width - goalWidth) / 2 && puck.x < (game2Canvas.width + goalWidth) / 2) {
      botScore++;
      scoreSound.play();
      // Если бот забил, следующий розыгрыш начинается с подачи игрока
      serveByPlayer = true;
      checkWinCondition();
      resetPuckPosition();
      game2Started = false;
      return;
    } else {
      puck.dy = -puck.dy;
    }
  }

  // Проверка столкновений шайбы с ракетками
  if (isColliding(puck, playerMallet)) {
    handleMalletCollision(playerMallet);
  }
  if (isColliding(puck, botMallet)) {
    handleMalletCollision(botMallet);
  }

  // Обновление позиции ракетки бота (простой ИИ: следование за шайбой по оси X)
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
  // Проигрываем звук столкновения
  hitSound.play();
  // Рассчитываем вектор столкновения
  const dx = puck.x - mallet.x;
  const dy = puck.y - mallet.y;
  const distance = Math.sqrt(dx * dx + dy * dy);
  if (distance === 0) return;
  const nx = dx / distance;
  const ny = dy / distance;
  // Фиксируем скорость шайбы равной INITIAL_PUCK_SPEED (не допускаем разгона)
  puck.dx = nx * INITIAL_PUCK_SPEED;
  puck.dy = ny * INITIAL_PUCK_SPEED;
  // Смещаем шайбу, чтобы она не "залипла" в ракетке
  puck.x = mallet.x + nx * (mallet.radius + puck.radius);
  puck.y = mallet.y + ny * (mallet.radius + puck.radius);
}

// Обновление позиции ракетки бота
function updateBotMallet() {
  if (puck.x < botMallet.x) {
    botMallet.x -= BOT_SPEED;
  } else if (puck.x > botMallet.x) {
    botMallet.x += BOT_SPEED;
  }
  // Ограничиваем движение ракетки бота по горизонтали
  botMallet.x = Math.max(botMallet.radius, Math.min(game2Canvas.width - botMallet.radius, botMallet.x));
}

// Отрисовка игрового поля с неоновым оформлением
function drawGame2() {
  // Очистка холста
  game2Ctx.clearRect(0, 0, game2Canvas.width, game2Canvas.height);

  // Фон – градиент в тёмных тонах
  let gradient = game2Ctx.createLinearGradient(0, 0, game2Canvas.width, game2Canvas.height);
  gradient.addColorStop(0, "#000428");
  gradient.addColorStop(1, "#004e92");
  game2Ctx.fillStyle = gradient;
  game2Ctx.fillRect(0, 0, game2Canvas.width, game2Canvas.height);

  // Настраиваем неоновое свечение для разделительной линии
  game2Ctx.shadowBlur = 20;
  game2Ctx.shadowColor = "#39ff14"; // ярко-зелёный неон

  // Разделительная линия (пунктирная)
  game2Ctx.strokeStyle = "#39ff14";
  game2Ctx.setLineDash([5, 5]);
  game2Ctx.beginPath();
  game2Ctx.moveTo(0, game2Canvas.height / 2);
  game2Ctx.lineTo(game2Canvas.width, game2Canvas.height / 2);
  game2Ctx.stroke();
  game2Ctx.setLineDash([]);

  // Рисуем воротные зоны – неоновая рамка
  const goalWidth = 100;
  game2Ctx.strokeStyle = "#ffff00"; // неоновый жёлтый
  game2Ctx.lineWidth = 4;
  // Верхние ворота
  game2Ctx.strokeRect((game2Canvas.width - goalWidth) / 2, 0, goalWidth, 10);
  // Нижние ворота
  game2Ctx.strokeRect((game2Canvas.width - goalWidth) / 2, game2Canvas.height - 10, goalWidth, 10);
  game2Ctx.lineWidth = 1;

  // Сброс теней для объектов
  game2Ctx.shadowBlur = 10;
  game2Ctx.shadowColor = "#ff00ff"; // неоновый розовый

  // Рисуем шайбу
  game2Ctx.beginPath();
  game2Ctx.arc(puck.x, puck.y, puck.radius, 0, Math.PI * 2);
  game2Ctx.fillStyle = "#ff00ff"; // неоновый розовый
  game2Ctx.fill();
  game2Ctx.closePath();

  // Рисуем ракетку игрока
  game2Ctx.beginPath();
  game2Ctx.arc(playerMallet.x, playerMallet.y, playerMallet.radius, 0, Math.PI * 2);
  game2Ctx.fillStyle = "#00ffff"; // неоновый голубой
  game2Ctx.fill();
  game2Ctx.closePath();

  // Рисуем ракетку бота
  game2Ctx.beginPath();
  game2Ctx.arc(botMallet.x, botMallet.y, botMallet.radius, 0, Math.PI * 2);
  game2Ctx.fillStyle = "#00ffff";
  game2Ctx.fill();
  game2Ctx.closePath();

  // Отображаем счёт
  game2Ctx.font = "16px Arial";
  game2Ctx.fillStyle = "#ffffff";
  game2Ctx.fillText("Player: " + playerScore, 10, game2Canvas.height - 20);
  game2Ctx.fillText("Bot: " + botScore, 10, 30);
}

// Проверка условия победы
function checkWinCondition() {
  if (playerScore >= SCORE_TO_WIN || botScore >= SCORE_TO_WIN) {
    game2Running = false;
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

// Обработчик движения мыши для управления ракеткой игрока
function mouseMoveHandler2(e) {
  let rect = game2Canvas.getBoundingClientRect();
  let relativeX = e.clientX - rect.left;
  let relativeY = e.clientY - rect.top;
  // Ограничиваем движение игрока нижней половиной экрана
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

// Сброс игры (вызывается при завершении)
function resetGame2() {
  cancelAnimationFrame(animationFrameId2);
  game2Running = false;
  game2Canvas.removeEventListener("mousemove", mouseMoveHandler2);
  game2Canvas.removeEventListener("touchmove", touchMoveHandler2);
  if (game2Ctx) {
    game2Ctx.clearRect(0, 0, game2Canvas.width, game2Canvas.height);
  }
}
