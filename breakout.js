function initBreakout() {
  const canvas = document.getElementById("breakoutCanvas");
  if (!canvas) return;
  const ctx = canvas.getContext("2d");

  // Стили canvas
  canvas.style.backgroundColor = "black";
  canvas.style.border = "2px solid blue";

  // Параметры платформы (уменьшим ширину)
  const paddleHeight = 10;
  let paddleWidth = 40;
  let paddleX = (canvas.width - paddleWidth) / 2;

  // Параметры мяча
  const ballRadius = 10;
  // Начальная скорость (будет расти при переходе на следующий уровень)
  let baseSpeedX = 4; 
  let baseSpeedY = 4; 

  // Текущая скорость мяча
  let dx = 0;
  let dy = 0;

  // Координаты мяча
  let x = paddleX + paddleWidth / 2;
  let y = canvas.height - paddleHeight - ballRadius - 2;

  // Параметры кирпичей
  let brickRowCount = 4;    
  let brickColumnCount = 10;
  let brickWidth = 35;
  let brickHeight = 15;
  let brickPadding = 8;
  let brickOffsetTop = 40;
  let brickOffsetLeft = 15;

  // Подсчёт очков/уровней
  let score = 0;
  let level = 1;
  let lives = 1; // только 1 жизнь
  let gameStarted = false; // мяч ждёт, пока пользователь не двинет платформу

  // Массив кирпичей
  let bricks = [];
  function resetBricks() {
    bricks = [];
    for (let c = 0; c < brickColumnCount; c++) {
      bricks[c] = [];
      for (let r = 0; r < brickRowCount; r++) {
        bricks[c][r] = { x: 0, y: 0, status: 1 };
      }
    }
  }
  resetBricks();

  // Управление клавиатурой
  let rightPressed = false;
  let leftPressed = false;

  document.addEventListener("keydown", keyDownHandler, false);
  document.addEventListener("keyup", keyUpHandler, false);

  function keyDownHandler(e) {
    if(e.key === "Right" || e.key === "ArrowRight") {
      rightPressed = true;
      startBallIfNeeded();
    } else if(e.key === "Left" || e.key === "ArrowLeft") {
      leftPressed = true;
      startBallIfNeeded();
    }
  }

  function keyUpHandler(e) {
    if(e.key === "Right" || e.key === "ArrowRight") {
      rightPressed = false;
    } else if(e.key === "Left" || e.key === "ArrowLeft") {
      leftPressed = false;
    }
  }

  // Управление касанием (телефоны, планшеты)
  canvas.addEventListener("touchmove", function(e) {
    // Берём координаты пальца относительно canvas
    let rect = canvas.getBoundingClientRect();
    let touchX = e.touches[0].clientX - rect.left;
    // Центрируем платформу на точке касания
    paddleX = touchX - paddleWidth / 2;
    // Ограничиваем движение платформы
    if(paddleX < 0) paddleX = 0;
    if(paddleX > canvas.width - paddleWidth) {
      paddleX = canvas.width - paddleWidth;
    }
    // Запускаем мяч, если ещё не запущен
    startBallIfNeeded();
    e.preventDefault();
  }, { passive: false });

  // При первом движении платформы запускаем мяч
  function startBallIfNeeded() {
    if(!gameStarted) {
      gameStarted = true;
      dx = baseSpeedX + (level - 1);
      dy = -(baseSpeedY + (level - 1));
    }
  }

  function collisionDetection() {
    for (let c = 0; c < brickColumnCount; c++) {
      for (let r = 0; r < brickRowCount; r++) {
        let b = bricks[c][r];
        if (b.status === 1) {
          if (x > b.x && x < b.x + brickWidth && y > b.y && y < b.y + brickHeight) {
            dy = -dy;
            b.status = 0;
            score++;
            // Если все кирпичи сбиты – новый уровень
            if(score % (brickRowCount * brickColumnCount) === 0) {
              level++;
              // Увеличиваем скорость мяча
              dx = baseSpeedX + (level - 1);
              dy = -(baseSpeedY + (level - 1));
              resetBricks();
              // Возвращаем мяч на платформу
              gameStarted = false;
              x = paddleX + paddleWidth / 2;
              y = canvas.height - paddleHeight - ballRadius - 2;
            }
          }
        }
      }
    }
  }

  function drawBall() {
    ctx.beginPath();
    ctx.arc(x, y, ballRadius, 0, Math.PI * 2);
    ctx.fillStyle = "#FF4500"; // оранжевый
    ctx.fill();
    ctx.closePath();
  }

  function drawPaddle() {
    ctx.beginPath();
    ctx.rect(paddleX, canvas.height - paddleHeight - 2, paddleWidth, paddleHeight);
    ctx.fillStyle = "#0095DD"; 
    ctx.fill();
    ctx.closePath();
  }

  function drawBricks() {
    for (let c = 0; c < brickColumnCount; c++) {
      for (let r = 0; r < brickRowCount; r++) {
        if (bricks[c][r].status === 1) {
          let brickX = (c * (brickWidth + brickPadding)) + brickOffsetLeft;
          let brickY = (r * (brickHeight + brickPadding)) + brickOffsetTop;
          bricks[c][r].x = brickX;
          bricks[c][r].y = brickY;
          ctx.beginPath();
          ctx.rect(brickX, brickY, brickWidth, brickHeight);
          ctx.fillStyle = "#0080FF"; // синий
          ctx.fill();
          ctx.closePath();
        }
      }
    }
  }

  function drawScore() {
    ctx.font = "16px Arial";
    ctx.fillStyle = "#FFFFFF";
    ctx.fillText("Score: " + score, 8, 20);
  }

  function drawLives() {
    ctx.font = "16px Arial";
    ctx.fillStyle = "#FFFFFF";
    ctx.fillText("Lives: " + lives, canvas.width - 75, 20);
  }

  function draw() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    drawBricks();
    drawBall();
    drawPaddle();
    drawScore();
    drawLives();
    collisionDetection();

    if(!gameStarted) {
      // Пока игра не началась, мяч "лежит" на платформе
      x = paddleX + paddleWidth / 2;
      y = canvas.height - paddleHeight - ballRadius - 2;
    } else {
      // Движение мяча
      if(x + dx > canvas.width - ballRadius || x + dx < ballRadius) {
        dx = -dx;
      }
      if(y + dy < ballRadius) {
        dy = -dy;
      } else if(y + dy > canvas.height - ballRadius) {
        // Проверка попадания на платформу
        if(x > paddleX && x < paddleX + paddleWidth) {
          dy = -dy;
        } else {
          // Потеряли жизнь (у нас их всего 1)
          lives--;
          if(lives <= 0) {
            // Game Over через модальное окно
            showGlobalModal("Game Over", "Your final score: " + score);
            // Останавливаем отрисовку
            cancelAnimationFrame(animationId);
            return;
          } else {
            // Возвращаем мяч на платформу
            gameStarted = false;
            x = paddleX + paddleWidth / 2;
            y = canvas.height - paddleHeight - ballRadius - 2;
            dx = 0;
            dy = 0;
          }
        }
      }
      x += dx;
      y += dy;
    }

    // Движение платформы с клавиатуры
    if(rightPressed && paddleX < canvas.width - paddleWidth) {
      paddleX += 7;
    } else if(leftPressed && paddleX > 0) {
      paddleX -= 7;
    }

    animationId = requestAnimationFrame(draw);
  }

  // Запуск
  let animationId = requestAnimationFrame(draw);
}

// Функция для сброса (или закрытия) игры. Можно вызывать из finishGame()
function resetBreakout() {
  // Остановим анимацию, уберём обработчики
  cancelAnimationFrame(animationId);
  document.removeEventListener("keydown", keyDownHandler);
  document.removeEventListener("keyup", keyUpHandler);
  // При необходимости очистить canvas
  const canvas = document.getElementById("breakoutCanvas");
  if (canvas) {
    const ctx = canvas.getContext("2d");
    ctx.clearRect(0, 0, canvas.width, canvas.height);
  }
}

// Пример, как можно завершить игру модально:
function finishBreakout() {
  // Можно закрыть модалку, вернуть интерфейс, скрыть canvas и т.д.
  resetBreakout();
  // Дополнительно вызываем closeGameModal() или showSection() и т.п. по вашему сценарию
}
