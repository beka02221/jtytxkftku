/* 
  game2.js – Игра Air Hockey (с ботом)
  Улучшенная версия с неоновым оформлением, звуковыми эффектами и улучшенной механикой.
  Игра идёт до 5 очков. Если игрок побеждает, то получает 200 points.
  После забитого гола происходит сброс позиций, скорость шайбы всегда остается постоянной.
  Подача сменяется: если забил игрок, то следующим подает бот, и наоборот.
*/

// Глобальные переменные
let game2Canvas, game2Ctx;
let puck, playerMallet, botMallet;
let playerScore = 0, botScore = 0;
let game2Running = false;
let game2Started = false;
let animationFrameId2;

const PUCK_RADIUS = 10;
const MALLET_RADIUS = 20;
const INITIAL_PUCK_SPEED = 4;
const BOT_SPEED = 6;   // максимальная скорость бота (с плавным приближением)
const SCORE_TO_WIN = 5;

let serveByPlayer = true; // если true – подача игрока, иначе бота

// Звуковые эффекты
let hitSound = new Audio('sounds/hit.mp3');      // звук столкновения шайбы с ракеткой
let scoreSound = new Audio('sounds/score.mp3');    // звук гола
let wallSound = new Audio('sounds/wall.mp3');      // звук отскока от стен

// Инициализация игры
function initGame2() {
  game2Canvas = document.getElementById('match3Canvas');
  if (!game2Canvas) {
    console.error("Элемент canvas с id 'match3Canvas' не найден.");
    return;
  }
  game2Ctx = game2Canvas.getContext('2d');

  // Инициализация ракеток
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

  resetPuckPosition();
  playerScore = 0;
  botScore = 0;

  game2Started = false;
  game2Running = false;

  game2Canvas.addEventListener("mousemove", mouseMoveHandler2, false);
  game2Canvas.addEventListener("touchmove", touchMoveHandler2, { passive: false });

  drawGame2();
}

// Сброс позиции шайбы и установка постоянной скорости в зависимости от подачи
function resetPuckPosition() {
  const centerX = game2Canvas.width / 2;
  if (serveByPlayer) {
    // Игрок подаёт: шайба появляется рядом с его ракеткой, направлена вверх
    puck = {
      x: playerMallet.x,
      y: playerMallet.y - (MALLET_RADIUS + PUCK_RADIUS + 5),
      radius: PUCK_RADIUS,
      dx: (Math.random() > 0.5 ? 1 : -1) * INITIAL_PUCK_SPEED,
      dy: -INITIAL_PUCK_SPEED
    };
  } else {
    // Бот подаёт: шайба появляется рядом с его ракеткой, направлена вниз
    puck = {
      x: botMallet.x,
      y: botMallet.y + (MALLET_RADIUS + PUCK_RADIUS + 5),
      radius: PUCK_RADIUS,
      dx: (Math.random() > 0.5 ? 1 : -1) * INITIAL_PUCK_SPEED,
      dy: INITIAL_PUCK_SPEED
    };
  }
  // Сброс позиции бота в центр
  botMallet.x = centerX;
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
  if (!game2Started) return;

  // Обновление позиции шайбы
  puck.x += puck.dx;
  puck.y += puck.dy;

  // Ограничение по горизонтали
  if (puck.x - puck.radius < 0) {
    puck.x = puck.radius;
    puck.dx = Math.abs(puck.dx); // отскок вправо
    wallSound.play();
  }
  if (puck.x + puck.radius > game2Canvas.width) {
    puck.x = game2Canvas.width - puck.radius;
    puck.dx = -Math.abs(puck.dx); // отскок влево
    wallSound.play();
  }

  const goalWidth = 100;
  // Если шайба уходит за верхнюю границу (гол для игрока)
  if (puck.y - puck.radius < 0) {
    if (puck.x > (game2Canvas.width - goalWidth) / 2 &&
        puck.x < (game2Canvas.width + goalWidth) / 2) {
      playerScore++;
      scoreSound.play();
      serveByPlayer = false; // следующая подача – бот
      checkWinCondition();
      resetPuckPosition();
      game2Started = false;
      return;
    } else {
      puck.y = puck.radius;
      puck.dy = Math.abs(puck.dy);
      wallSound.play();
    }
  }
  // Если шайба уходит за нижнюю границу (гол для бота)
  if (puck.y + puck.radius > game2Canvas.height) {
    if (puck.x > (game2Canvas.width - goalWidth) / 2 &&
        puck.x < (game2Canvas.width + goalWidth) / 2) {
      botScore++;
      scoreSound.play();
      serveByPlayer = true; // следующая подача – игрок
      checkWinCondition();
      resetPuckPosition();
      game2Started = false;
      return;
    } else {
      puck.y = game2Canvas.height - puck.radius;
      puck.dy = -Math.abs(puck.dy);
      wallSound.play();
    }
  }

  // Столкновение шайбы с ракетками
  if (isColliding(puck, playerMallet)) {
    handleMalletCollision(playerMallet);
  }
  if (isColliding(puck, botMallet)) {
    handleMalletCollision(botMallet);
  }

  // Обновление позиции ракетки бота (плавное движение)
  updateBotMallet();
}

// Проверка столкновения двух кругов
function isColliding(circle1, circle2) {
  const dx = circle1.x - circle2.x;
  const dy = circle1.y - circle2.y;
  const distance = Math.sqrt(dx * dx + dy * dy);
  return distance < (circle1.radius + circle2.radius);
}

// Обработка столкновения шайбы с ракеткой – устанавливаем постоянную скорость
function handleMalletCollision(mallet) {
  hitSound.play();
  const dx = puck.x - mallet.x;
  const dy = puck.y - mallet.y;
  const distance = Math.sqrt(dx * dx + dy * dy);
  if (distance === 0) return;
  const nx = dx / distance;
  const ny = dy / distance;
  // Всегда устанавливаем скорость равной INITIAL_PUCK_SPEED
  puck.dx = nx * INITIAL_PUCK_SPEED;
  puck.dy = ny * INITIAL_PUCK_SPEED;
  // Смещаем шайбу, чтобы избежать "залипания"
  puck.x = mallet.x + nx * (mallet.radius + puck.radius);
  puck.y = mallet.y + ny * (mallet.radius + puck.radius);
}

// Плавное обновление позиции ракетки бота
function updateBotMallet() {
  // Линейная интерполяция: бот плавно приближается к x-координате шайбы
  const targetX = puck.x;
  const delta = targetX - botMallet.x;
  botMallet.x += delta * 0.1; // коэффициент интерполяции
  
  // Ограничение движения по горизонтали
  botMallet.x = Math.max(botMallet.radius, Math.min(game2Canvas.width - botMallet.radius, botMallet.x));
  
  // Если бот "застрял" в углу с шайбой, сбросим его в центр
  if ((botMallet.x <= botMallet.radius + 2 || botMallet.x >= game2Canvas.width - botMallet.radius - 2) &&
      Math.abs(puck.x - botMallet.x) < 5) {
    botMallet.x = game2Canvas.width / 2;
  }
}

// Отрисовка игрового поля с неоновым оформлением и пунктирными границами
function drawGame2() {
  // Очистка канваса
  game2Ctx.clearRect(0, 0, game2Canvas.width, game2Canvas.height);

  // Фон – темный градиент
  let gradient = game2Ctx.createLinearGradient(0, 0, game2Canvas.width, game2Canvas.height);
  gradient.addColorStop(0, "#000428");
  gradient.addColorStop(1, "#004e92");
  game2Ctx.fillStyle = gradient;
  game2Ctx.fillRect(0, 0, game2Canvas.width, game2Canvas.height);

  // Неоновые границы канваса (пунктир)
  game2Ctx.lineWidth = 3;
  game2Ctx.strokeStyle = "#39ff14";
  game2Ctx.setLineDash([10, 5]);
  game2Ctx.strokeRect(0, 0, game2Canvas.width, game2Canvas.height);
  game2Ctx.setLineDash([]);

  // Разделительная линия (неоновый пунктир)
  game2Ctx.shadowBlur = 20;
  game2Ctx.shadowColor = "#39ff14";
  game2Ctx.strokeStyle = "#39ff14";
  game2Ctx.setLineDash([5, 5]);
  game2Ctx.beginPath();
  game2Ctx.moveTo(0, game2Canvas.height / 2);
  game2Ctx.lineTo(game2Canvas.width, game2Canvas.height / 2);
  game2Ctx.stroke();
  game2Ctx.setLineDash([]);
  game2Ctx.shadowBlur = 10;

  // Воротные зоны – неоновая рамка
  const goalWidth = 100;
  game2Ctx.strokeStyle = "#ffff00";
  game2Ctx.lineWidth = 4;
  game2Ctx.strokeRect((game2Canvas.width - goalWidth) / 2, 0, goalWidth, 10);
  game2Ctx.strokeRect((game2Canvas.width - goalWidth) / 2, game2Canvas.height - 10, goalWidth, 10);
  game2Ctx.lineWidth = 1;

  // Рисуем шайбу
  game2Ctx.beginPath();
  game2Ctx.arc(puck.x, puck.y, puck.radius, 0, Math.PI * 2);
  game2Ctx.fillStyle = "#ff00ff";
  game2Ctx.fill();
  game2Ctx.closePath();

  // Рисуем ракетку игрока
  game2Ctx.beginPath();
  game2Ctx.arc(playerMallet.x, playerMallet.y, playerMallet.radius, 0, Math.PI * 2);
  game2Ctx.fillStyle = "#00ffff";
  game2Ctx.fill();
  game2Ctx.closePath();

  // Рисуем ракетку бота
  game2Ctx.beginPath();
  game2Ctx.arc(botMallet.x, botMallet.y, botMallet.radius, 0, Math.PI * 2);
  game2Ctx.fillStyle = "#00ffff";
  game2Ctx.fill();
  game2Ctx.closePath();

  // Отображение счёта
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

// Обработчик движения мыши – управление ракеткой игрока
function mouseMoveHandler2(e) {
  let rect = game2Canvas.getBoundingClientRect();
  let relativeX = e.clientX - rect.left;
  let relativeY = e.clientY - rect.top;
  // Ограничение области управления: только нижняя половина канваса
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

